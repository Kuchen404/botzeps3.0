import { plusTage } from "../scoring/datum.js";
import {
  BASISLAGER_ANTEIL,
  BOT_ID,
  BOT_NAME,
  GIPFEL_M,
  MINISPIELE,
  type MinispielArt,
  type MinispielDaten,
  type SpielWoche,
  type Spieler,
  bombentraeger,
  codeText,
  duellFuehrender,
  duelle,
  gipfel,
  kopfgeld,
  lasten,
  seil,
  seilZeile,
  tresor,
  zombies,
} from "./spiele.js";

/** Texte rund um die Minispiele: Teaser, Ankündigung, Lage am Morgen, Meldungen beim Trainingspost und Auflösung. */

const z = (x: number) => Math.round(x).toLocaleString("de-DE");
const aufzaehlung = (namen: readonly string[]) =>
  namen.length <= 1 ? (namen[0] ?? "") : `${namen.slice(0, -1).join(", ")} und ${namen.at(-1)}`;

/** Namen aller Spieler, dazu der Bot als Duellgegner. */
export type Namen = ReadonlyMap<string, string>;
export function namenVon(spieler: readonly { id: string; name: string }[]): Map<string, string> {
  return new Map([...spieler.map((sp): [string, string] => [sp.id, sp.name]), [BOT_ID, BOT_NAME]]);
}
const n = (namen: Namen, id: string) => namen.get(id) ?? "?";

const BEUTE = [
  "ein Proteinriegel von 2019",
  "ein Gutschein für eine Woche ohne Burpees",
  "drei warme Bier und ein Shaker, den nie einer ausgewaschen hat",
  "ein Foto vom Sixpack, das keiner von euch je haben wird",
  "eine Packung Kreatin und ein Zettel: „Ihr seid trotzdem Lauchs“",
];

/** Am Abend vor der Woche, direkt nach dem Wochenbericht. */
export function minispielTeaser(art: MinispielArt): string {
  return {
    zombie: "🧟 Morgen früh bricht was aus. Wascht euch die Hände. Und trainiert, sonst hilft das auch nix.",
    bombe: "💣 Hört ihr das? Tick. Tack. Morgen früh liegt was im Gruppenchat, und es tickt.",
    kopfgeld: "🎯 Morgen früh hängt ein Steckbrief am Saloon. Einer von euch ist ab dann Freiwild.",
    gipfel: "🏔 Packt die Steigeisen ein. Morgen früh geht's nach oben.",
    tauziehen: "🪢 Morgen früh wird gelost, wer mit wem am Seil hängt. Handschuhe nicht vergessen.",
    tresor: "🔐 Im Keller wurde was gefunden. Schwer, aus Stahl, abgeschlossen. Morgen früh mehr.",
    duell: "⚔️ Morgen früh lost der Bot. Jeder kriegt einen Gegner, und keiner kann kneifen.",
  }[art];
}

/** Ankündigung am ersten Tag der Woche. `berichtszeit` ist die Uhrzeit des Sonntagsberichts. */
export function minispielAnkuendigung(d: MinispielDaten, spieler: readonly Spieler[], w: SpielWoche, berichtszeit: string): string {
  const namen = namenVon(spieler);
  const kopf = `${MINISPIELE[d.art].emoji} ${MINISPIELE[d.art].name.toUpperCase()}!`;
  const rumpf = ((): string[] => {
    switch (d.art) {
      case "zombie":
        return [
          `Patient Null ist ${n(namen, d.patientNull)}. Hat sich beim Döner was eingefangen und riecht schon komisch.`,
          "Wer zwei Tage am Stück nicht trainiert, wird gebissen und schlurft ab dann mit 🧟 durch die Rangliste. Jeden Morgen gibt's die Liste der Neuen.",
          "Sonntag werden die Überlebenden gefeiert. Die Zombies auch, nur anders.",
        ];
      case "bombe": {
        const traeger = bombentraeger(d, spieler);
        return [
          "Die Bombe liegt immer bei dem, dessen letztes Training am längsten her ist. Wer trainiert, wirft sie sofort weiter.",
          `Sonntag um ${berichtszeit} geht sie hoch. Wer sie dann hat, ist Matsch.`,
          ...(traeger ? [`Gerade tickt sie bei ${n(namen, traeger)}.`] : []),
        ];
      }
      case "kopfgeld":
        return [
          `Gesucht: ${n(namen, d.gejagter)}, tot oder lebendig.`,
          `Wer bis Sonntag mehr Wochenlast hat als ${n(namen, d.gejagter)}, kassiert das Kopfgeld. Hängt ${n(namen, d.gejagter)} alle ab, gibt's den Titel „Unfassbar“.`,
        ];
      case "gipfel":
        return [
          `Mount Botzeps, ${z(GIPFEL_M)} m. Der Gipfel ist das Wochenziel (${z(w.ziel)} Lastpunkte), jede Einheit bringt euch höher.`,
          "Wer zuerst oben ist, wird gefeiert. Wer Sonntag noch im Basislager hockt, wird ausgelacht. In der Mini App seht ihr alle Kletterer.",
        ];
      case "tauziehen":
        return [
          "Der Bot hat Teams gelost:",
          ...d.teams.map((t) => `${t.name}: ${t.mitglieder.map((id) => n(namen, id)).join(", ")}`),
          "Es zählt die durchschnittliche Wochenlast pro Team, jedes Training zieht am Seil. Die Verlierer landen Sonntag im Schlamm.",
        ];
      case "tresor":
        return [
          `Im Keller steht ein Tresor mit vier Ziffern. Für jedes Viertel von ${z(d.ziel)} Lastpunkten, die ihr zusammen schafft, verrät er eine Ziffer.`,
          `Code: ${codeText(d, 0)}`,
          "Was drin ist, erfahrt ihr nur, wenn ihr ihn bis Sonntag aufkriegt.",
        ];
      case "duell":
        return [
          "Der Bot hat gelost, jeder hat einen Gegner:",
          ...d.paare.map(([a, b]) => `• ${n(namen, a)} gegen ${n(namen, b)}`),
          ...(d.paare.some((p) => p.includes(BOT_ID)) ? [`${BOT_NAME} schafft übrigens genau das Wochenziel. Gegen den Bot verlieren ist besonders peinlich.`] : []),
          "Mehr Wochenlast bis Sonntag gewinnt. Die Verlierer werden namentlich verspottet.",
        ];
    }
  })();
  return [kopf, "", ...rumpf].join("\n");
}

/**
 * Meldung am Morgen von Tag `tag` (1 bis 6) der Woche, oder null, wenn es nichts zu sagen gibt.
 * Bei der Zombie-Woche kommen die neu Gebissenen in `gemeldet`, damit keiner zweimal gemeldet wird.
 */
export function minispielLage(
  d: MinispielDaten,
  spieler: readonly Spieler[],
  w: SpielWoche,
  tag: number,
): { text: string; gemeldet?: string[] } | null {
  const namen = namenVon(spieler);
  const l = lasten(d, spieler, w);
  const halbzeit = tag === 3;
  switch (d.art) {
    case "zombie": {
      const z7 = zombies(d, spieler, w, tag);
      const neu = [...z7].filter(([id, biss]) => biss > 0 && !d.gemeldet.includes(id)).map(([id]) => id);
      if (!neu.length) return null;
      const menschen = d.spieler.filter((id) => !z7.has(id));
      return {
        text: [
          `🧟 Gebissen: ${aufzaehlung(neu.map((id) => n(namen, id)))}. Zwei Tage keinen Finger gerührt, jetzt schlurfen sie.`,
          menschen.length
            ? `🧍 Noch Mensch: ${menschen.map((id) => n(namen, id)).join(", ")}`
            : "Das war der Letzte. Die Menschheit ist verloren.",
        ].join("\n"),
        gemeldet: [...d.gemeldet, ...neu],
      };
    }
    case "bombe": {
      const traeger = bombentraeger(d, spieler);
      if (!traeger) return null;
      if (tag === 6) return { text: `💣 Letzter Tag! Die Bombe tickt bei ${n(namen, traeger)}. Wer sie heute Abend hat, fliegt in die Luft.` };
      return halbzeit ? { text: `💣 Tick, tack. Halbzeit, und die Bombe liegt bei ${n(namen, traeger)}. Beweg deinen Arsch.` } : null;
    }
    case "kopfgeld": {
      if (!halbzeit) return null;
      const k = kopfgeld(d, l);
      return {
        text: k.jaeger.length
          ? `🎯 Halbzeit der Jagd: ${n(namen, d.gejagter)} hat ${z(k.gejagterLast)} Lastpunkte. Geschnappt haben ihn schon: ${k.jaeger.map((id) => n(namen, id)).join(", ")}.`
          : `🎯 Halbzeit der Jagd: ${n(namen, d.gejagter)} hat ${z(k.gejagterLast)} Lastpunkte, und keiner ist rangekommen. Was seid ihr für Jäger?`,
      };
    }
    case "gipfel":
      return halbzeit ? { text: ["🏔 Halbzeit am Berg:", ...gipfelZeilen(d, spieler, w, namen)].join("\n") } : null;
    case "tauziehen": {
      if (!halbzeit) return null;
      const s = seil(d, l);
      const vorne = s.zug === 0 ? null : d.teams[s.zug > 0 ? 0 : 1].name;
      return { text: `🪢 Halbzeit am Seil:\n${seilZeile(d, s.zug)}\n${vorne ? `${vorne} zieht, die anderen rutschen schon Richtung Schlamm.` : "Steht genau in der Mitte. Zieht gefälligst!"}` };
    }
    case "tresor": {
      if (!halbzeit) return null;
      const t = tresor(d, l);
      if (t.offen) return null;
      return { text: `🔐 Halbzeit am Tresor: ${codeText(d, t.ziffern)}. Noch ${z(d.ziel - t.summe)} Lastpunkte bis er aufgeht.` };
    }
    case "duell":
      return halbzeit ? { text: ["⚔️ Halbzeit der Duelle:", ...duelle(d, l).map((du) => `• ${n(namen, du.a)} ${z(du.lastA)}:${z(du.lastB)} ${n(namen, du.b)}`)].join("\n") } : null;
  }
}

function gipfelZeilen(d: Extract<MinispielDaten, { art: "gipfel" }>, spieler: readonly Spieler[], w: SpielWoche, namen: Namen): string[] {
  const k = gipfel(d, spieler, w);
  const oben = k.filter((x) => x.oben);
  const unterwegs = k.filter((x) => !x.oben && x.anteil >= BASISLAGER_ANTEIL);
  const lager = k.filter((x) => x.anteil < BASISLAGER_ANTEIL);
  return [
    ...(oben.length ? [`🚩 Oben: ${oben.map((x, i) => `${i + 1}. ${n(namen, x.id)}`).join(", ")}`] : []),
    ...(unterwegs.length ? [`🧗 Unterwegs: ${unterwegs.map((x) => `${n(namen, x.id)} ${z(x.hoehe)} m`).join(", ")}`] : []),
    ...(lager.length ? [`⛺ Basislager: ${lager.map((x) => n(namen, x.id)).join(", ")}`] : []),
  ];
}

/** Meldungen für den Gruppenpost eines Trainings, aus dem Stand davor und danach. */
export function minispielNachTraining(
  d: MinispielDaten,
  vorher: readonly Spieler[],
  nachher: readonly Spieler[],
  w: SpielWoche,
  ich: string,
): string[] {
  if (!d.spieler.includes(ich)) return [];
  const namen = namenVon(nachher);
  const lv = lasten(d, vorher, w);
  const ln = lasten(d, nachher, w);
  switch (d.art) {
    case "zombie":
      return [];
    case "bombe": {
      const alt = bombentraeger(d, vorher);
      const neu = bombentraeger(d, nachher);
      return alt === ich && neu && neu !== ich ? [`💣 ${n(namen, ich)} wirft die Bombe weiter! Jetzt tickt sie bei ${n(namen, neu)}.`] : [];
    }
    case "kopfgeld": {
      const kv = kopfgeld(d, lv);
      const kn = kopfgeld(d, ln);
      if (ich === d.gejagter) {
        const entwischt = kv.jaeger.filter((id) => !kn.jaeger.includes(id));
        return entwischt.length ? [`🏃 ${n(namen, ich)} entwischt ${aufzaehlung(entwischt.map((id) => n(namen, id)))} wieder.`] : [];
      }
      return kn.jaeger.includes(ich) && !kv.jaeger.includes(ich) ? [`🎯 ${n(namen, ich)} hat ${n(namen, d.gejagter)} geschnappt! Kopfgeld kassiert.`] : [];
    }
    case "gipfel": {
      const k = gipfel(d, nachher, w);
      const x = k.find((y) => y.id === ich)!;
      const warOben = gipfel(d, vorher, w).find((y) => y.id === ich)?.oben;
      if (x.oben && !warOben) {
        const platz = k.filter((y) => y.oben).findIndex((y) => y.id === ich) + 1;
        return [platz === 1 ? `🚩 ${n(namen, ich)} steht als Erster auf dem Gipfel! Der Rest hechelt noch.` : `🚩 ${n(namen, ich)} ist oben, als ${platz}.`];
      }
      return x.oben ? [] : [`🧗 ${n(namen, ich)} klettert auf ${z(x.hoehe)} m.`];
    }
    case "tauziehen":
      return [`🪢 ${seilZeile(d, seil(d, ln).zug)}`];
    case "tresor": {
      const tv = tresor(d, lv);
      const tn = tresor(d, ln);
      if (tn.ziffern <= tv.ziffern) return [];
      return tn.offen
        ? [`💰 TRESOR OFFEN! Code ${codeText(d, tn.ziffern)}, ${n(namen, ich)} hat das letzte Schloss geknackt. Was drin ist, gibt's Sonntag.`]
        : [`🔓 Ziffer geknackt: ${codeText(d, tn.ziffern)}`];
    }
    case "duell": {
      const dv = duelle(d, lv).find((du) => du.a === ich || du.b === ich)!;
      const dn = duelle(d, ln).find((du) => du.a === ich || du.b === ich)!;
      const gegner = dn.a === ich ? dn.b : dn.a;
      if (duellFuehrender(dn) !== ich || duellFuehrender(dv) === ich) return [];
      const [meins, seins] = dn.a === ich ? [dn.lastA, dn.lastB] : [dn.lastB, dn.lastA];
      return [`⚔️ ${n(namen, ich)} geht gegen ${n(namen, gegner)} in Führung (${z(meins)}:${z(seins)}).`];
    }
  }
}

/** Auflösung nach dem Sonntagsbericht. */
export function minispielErgebnis(d: MinispielDaten, spieler: readonly Spieler[], w: SpielWoche, zufall: () => number = Math.random): string {
  const namen = namenVon(spieler);
  const l = lasten(d, spieler, w);
  const liste = (ids: readonly string[]) => ids.map((id) => n(namen, id)).join(", ");
  switch (d.art) {
    case "zombie": {
      const z7 = zombies(d, spieler, w, 7);
      const menschen = d.spieler.filter((id) => !z7.has(id));
      const untot = [...z7.keys()].map((id) => (id === d.patientNull ? `${n(namen, id)} (Patient Null)` : n(namen, id)));
      return [
        "🧟 Die Zombie-Woche ist vorbei!",
        menschen.length ? `🧍 Überlebt: ${liste(menschen)}. Respekt, ihr Kampfmaschinen.` : "🧍 Überlebt hat keiner. Ihr seid ein einziger Haufen Untoter.",
        `🧟 Zombies: ${untot.join(", ")}. Hirn gibt's nächste Woche wieder.`,
      ].join("\n");
    }
    case "bombe": {
      const traeger = bombentraeger(d, spieler);
      if (!traeger) return "💣 Die Bombe war ein Blindgänger. Glück gehabt.";
      const letztes = spieler.find((sp) => sp.id === traeger)!.trainings.map((t) => t.datum).sort().at(-1);
      const seit = letztes ? `letztes Training am ${letztes.split("-").reverse().slice(0, 2).join(".")}.` : "ohne ein einziges Training in der ganzen Season.";
      return `💥 BUMM! Die Bombe ist bei ${n(namen, traeger)} hochgegangen, ${seit} Wir kratzen die Reste mit dem Spachtel von der Wand.`;
    }
    case "kopfgeld": {
      const k = kopfgeld(d, l);
      return k.jaeger.length
        ? `🎯 Kopfgeld kassiert haben ${aufzaehlung(k.jaeger.map((id) => n(namen, id)))}. ${n(namen, d.gejagter)} wurde mit ${z(k.gejagterLast)} Lastpunkten zur Strecke gebracht.`
        : `🎯 ${n(namen, d.gejagter)} ist UNFASSBAR! Keiner kam an ${z(k.gejagterLast)} Lastpunkte ran. Ihr Kopfgeldjäger seid ein Witz.`;
    }
    case "gipfel":
      return ["🏔 Der Gipfelsturm ist vorbei!", ...gipfelZeilen(d, spieler, w, namen).map((zeile) => (zeile.startsWith("⛺") ? `${zeile}. Da gibt's wenigstens Tee.` : zeile))].join("\n");
    case "tauziehen": {
      const s = seil(d, l);
      const schnitt = `${z(s.schnitt[0])}:${z(s.schnitt[1])} im Schnitt`;
      if (s.zug === 0) return `🪢 Das Seil ist gerissen, unentschieden (${schnitt}). Alle in den Schlamm.`;
      const [sieger, verlierer] = s.zug > 0 ? d.teams : [d.teams[1], d.teams[0]];
      return `🪢 ${sieger.name} gewinnt das Tauziehen (${schnitt})! ${verlierer.name} liegt im Schlamm: ${liste(verlierer.mitglieder)}.`;
    }
    case "tresor": {
      const t = tresor(d, l);
      const nichts = d.spieler.filter((id) => (l.get(id) ?? 0) === 0);
      const huehner = nichts.length ? [`🐔 Kein Finger gerührt: ${liste(nichts)}`] : [];
      if (!t.offen) return [`🔐 Der Tresor bleibt zu. Der Code wäre ${d.code.join(" ")} gewesen, gefehlt haben ${z(d.ziel - t.summe)} Lastpunkte.`, ...huehner].join("\n");
      const beute = BEUTE[Math.floor(zufall() * BEUTE.length)]!;
      return [`💰 Tresor geknackt, Code ${d.code.join(" ")}! Drin: ${beute}.`, ...huehner].join("\n");
    }
    case "duell":
      return [
        "⚔️ Die Losduelle:",
        ...duelle(d, l).map((du) => {
          const sieger = duellFuehrender(du);
          if (!sieger) return `• ${n(namen, du.a)} und ${n(namen, du.b)} unentschieden (${z(du.lastA)}:${z(du.lastB)})`;
          const verlierer = sieger === du.a ? du.b : du.a;
          const [hoch, tief] = du.lastA > du.lastB ? [du.lastA, du.lastB] : [du.lastB, du.lastA];
          const bot = sieger === BOT_ID ? " Gegen den Bot verloren, peinlicher geht's nicht." : "";
          return `• ${n(namen, sieger)} schlägt ${n(namen, verlierer)} (${z(hoch)}:${z(tief)}).${bot}`;
        }),
      ].join("\n");
  }
}

/** Zeichen hinter dem Namen in Rangliste und Mini App, solange das Spiel läuft. */
export function minispielMarken(d: MinispielDaten, spieler: readonly Spieler[], w: SpielWoche, fertigeTage: number): Map<string, string> {
  const m = new Map<string, string>();
  if (d.art === "zombie") for (const id of zombies(d, spieler, w, fertigeTage).keys()) m.set(id, "🧟");
  if (d.art === "bombe") {
    const traeger = bombentraeger(d, spieler);
    if (traeger) m.set(traeger, "💣");
  }
  if (d.art === "kopfgeld") m.set(d.gejagter, "🎯");
  if (d.art === "gipfel") for (const k of gipfel(d, spieler, w)) if (k.oben) m.set(k.id, "🚩");
  return m;
}

/** Tage der Woche, die vorbei sind, wenn heute `heute` ist (0 bis 7). */
export function fertigeTage(w: SpielWoche, heute: string): number {
  for (let k = 0; k < 7; k++) if (plusTage(w.start, k) >= heute) return k;
  return 7;
}
