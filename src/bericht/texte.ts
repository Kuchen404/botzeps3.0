import { type TeamStand, type TeilnehmerStand, TEAM_BONUS_PRO_WOCHE } from "../scoring/season.js";
import { type Kategorie, fuelle, platzKategorie, waehleSpruch } from "../texte/sprueche.js";
import type { BossKampf } from "../scoring/boss.js";
import { type ErfolgArt, erfolgText } from "../scoring/erfolge.js";

export interface BerichtZusatz {
  /** Bosse, deren Woche dieser Bericht abschließt */
  bosse?: readonly { name: string; kampf: BossKampf }[];
  /** Rote Laterne dieser Woche, mit Zähler über die Season (diese Woche eingerechnet) */
  laterne?: readonly LaterneTraeger[];
}

export interface LaterneTraeger {
  id: string;
  name: string;
  last: number;
  anzahl: number;
}

/** „🏮 Rote Laterne: Name (3×) mit 40 Lastpunkten“, leer ohne Träger. */
export function laternenZeile(traeger: readonly LaterneTraeger[] = []): string[] {
  if (!traeger.length) return [];
  const namen = traeger.map((t) => (t.anzahl > 1 ? `${t.name} (${t.anzahl}× diese Season)` : t.name)).join(", ");
  return [`🏮 Rote Laterne: ${namen} mit ${z(traeger[0]!.last)} Lastpunkten`];
}

/** Ergebnis der Boss-Woche mit Lob für die Beteiligten und Schande für die Drückeberger. */
export function bossZeilen(
  bosse: BerichtZusatz["bosse"],
  staende: readonly TeilnehmerStand[],
  zufall: () => number = Math.random,
): string[] {
  const name = new Map(staende.map((st) => [st.id, st.name]));
  return (bosse ?? []).flatMap(({ name: boss, kampf }) => {
    const kopf = kampf.besiegt
      ? `🐉 ${boss} besiegt (${kampf.schaden.toLocaleString("de-DE")} Schaden)! +${kampf.bonus} für: ${kampf.beteiligte.map((id) => name.get(id)).join(", ")}`
      : `🐉 ${fuelle(waehleSpruch("boss_ueberlebt", undefined, zufall), { boss })} (${kampf.schaden.toLocaleString("de-DE")} von ${kampf.lebenspunkte.toLocaleString("de-DE")} Schaden)`;
    // Eine Zeile für alle Drückeberger statt einer pro Kopf
    const namen = kampf.drueckeberger.map((id) => name.get(id)!);
    const feiglinge =
      namen.length === 1
        ? [fuelle(waehleSpruch("drueckeberger", undefined, zufall), { name: namen[0], boss })]
        : namen.length > 1
          ? [`🐔 Drückeberger: ${namen.join(", ")}. Haben gegen ${boss} keinen Finger gerührt. Feige Säcke.`]
          : [];
    return [kopf, ...feiglinge];
  });
}

export type NeueErfolge = readonly { name: string; arten: readonly ErfolgArt[] }[];

export function erfolgZeilen(erfolge: NeueErfolge | undefined): string[] {
  if (!erfolge?.length) return [];
  return ["Neue Erfolge:", ...erfolge.flatMap((e) => e.arten.map((art) => `${e.name}: ${erfolgText(art)}`))];
}

export interface Vorwoche {
  platz: number;
  /** Spruch-Vorlage der Vorwoche (mit Platzhaltern). */
  vorlage: string | null;
}

export interface BerichtZeile {
  id: string;
  vorlage: string;
  text: string;
}

const z = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 1 });

function pfeil(platz: number, vorher?: Vorwoche): string {
  if (!vorher) return "";
  const diff = vorher.platz - platz;
  if (diff > 0) return ` ⬆${diff}`;
  if (diff < 0) return ` ⬇${-diff}`;
  return "";
}

/** Abstand zum Vordermann, beim Ersten zum Verfolger. */
function abstand(staende: readonly TeilnehmerStand[], i: number): number {
  const ich = staende[i]!;
  const anderer = i === 0 ? staende[1] : staende[i - 1];
  return anderer ? Math.abs(ich.gesamt - anderer.gesamt) : 0;
}

/** Teamwertung als Zeilen, leer ohne Teams. */
export function teamZeilen(teams: readonly TeamStand[]): string[] {
  if (teams.length === 0) return [];
  return [
    "👥 Teamwertung:",
    ...teams.map((t) => `${t.platz}. ${t.name}: ${z(t.gesamt)}${t.bonus > 0 ? ` (Schnitt ${z(t.durchschnitt)} + ${z(t.bonus)} Bonus)` : ""}`),
  ];
}

export interface Wochenbericht {
  text: string;
  sprueche: BerichtZeile[];
}

/**
 * Wochenbericht für die Gruppe (Konzept 6), bewusst kurz: Rangliste mit Veränderung
 * zur Vorwoche, Wochenziel (✅) und Serien (🔥) direkt an den Namen, Fleiß und Rote
 * Laterne, Boss-Ergebnis und derbe Sprüche nur für ganz oben und ganz unten.
 * Erfolge stehen nicht drin, die kommen schon direkt beim Trainingspost.
 * Keine Rohwerte, nur Punkte.
 */
export function wochenbericht(
  season: { name: string; wochen: number; wochenzielLast: number },
  woche: number,
  staende: readonly TeilnehmerStand[],
  vorwoche: ReadonlyMap<string, Vorwoche>,
  teams: readonly TeamStand[] = [],
  zufall: () => number = Math.random,
  zusatz: BerichtZusatz = {},
): Wochenbericht {
  const kopf = `📅 Wochenbericht „${season.name}“, Woche ${woche + 1} von ${season.wochen}`;
  if (staende.length === 0) return { text: `${kopf}\n\nKeiner dabei. Traurig.`, sprueche: [] };

  const zeilen = staende.map((st) => {
    const w = st.wochen[woche];
    const ziel = w?.zielErreicht ? " ✅" : "";
    const serie = w && w.serie >= 2 ? ` 🔥${w.serie}` : "";
    return `${st.platz}. ${st.name}: ${z(st.gesamt)}${pfeil(st.platz, vorwoche.get(st.id))}${ziel}${serie}`;
  });

  const last = (st: TeilnehmerStand) => st.wochen[woche]?.last ?? 0;
  const maxLast = Math.max(0, ...staende.map(last));
  const fleissig = maxLast > 0 ? staende.filter((st) => last(st) === maxLast) : [];
  const geschafft = staende.filter((st) => st.wochen[woche]?.zielErreicht);

  const infos: string[] = [];
  if (fleissig.length) infos.push(`💪 Fleiß der Woche: ${fleissig.map((f) => f.name).join(", ")} mit ${maxLast} Lastpunkten`);
  infos.push(...laternenZeile(zusatz.laterne));
  // Wer das Ziel geschafft hat, sieht man am ✅ in der Rangliste
  if (!geschafft.length) infos.push(`✅ Wochenziel (${season.wochenzielLast}) geschafft: niemand. Peinlich.`);
  const bonusTeams = teams.filter((t) => t.bonusWochen.includes(woche));
  if (bonusTeams.length) {
    infos.push(`🎯 Team-Bonus +${TEAM_BONUS_PRO_WOCHE}: ${bonusTeams.map((t) => t.name).join(", ")}, alle haben ihr Ziel geschafft`);
  }

  // Sprüche nur für den Ersten und den Letzten
  const ziele = staende.length >= 2 ? [0, staende.length - 1] : [0];
  const sprueche: BerichtZeile[] = ziele.map((i) => {
    const st = staende[i]!;
    const vorher = vorwoche.get(st.id);
    let kategorie: Kategorie = platzKategorie(st.platz, staende.length);
    if (vorher && vorher.platz - st.platz >= 2) kategorie = "aufsteiger";
    else if (vorher && st.platz - vorher.platz >= 2) kategorie = "absteiger";
    // Nicht zweimal hintereinander dieselbe Vorlage für dieselbe Person
    const vorlage = waehleSpruch(kategorie, vorher?.vorlage ?? undefined, zufall);
    const text = fuelle(vorlage, { name: st.name, platz: st.platz, punkte: z(st.gesamt), abstand: z(abstand(staende, i)) });
    return { id: st.id, vorlage, text };
  });

  // Höchstens ein Zusatzspruch: lange Serie vor verfehltem Ziel
  const extra: string[] = [];
  const besteSerie = [...staende].sort((a, b) => (b.wochen[woche]?.serie ?? 0) - (a.wochen[woche]?.serie ?? 0))[0];
  const serie = besteSerie?.wochen[woche]?.serie ?? 0;
  const verfehlt = staende.filter((st) => !st.wochen[woche]?.zielErreicht);
  if (besteSerie && serie >= 3) {
    extra.push(fuelle(waehleSpruch("serie", undefined, zufall), { name: besteSerie.name, serie }));
  } else if (verfehlt.length > 0 && verfehlt.length < staende.length) {
    const opfer = verfehlt[Math.min(Math.floor(zufall() * verfehlt.length), verfehlt.length - 1)]!;
    extra.push(fuelle(waehleSpruch("wochenziel_verfehlt", undefined, zufall), { name: opfer.name }));
  }

  const hinweis =
    woche === season.wochen - 2
      ? ["", "⚠️ Nächste Woche ist die letzte. Der Endwert ist der Schnitt eurer Messungen dieser Woche, also messen, messen, messen."]
      : [];

  const team = teamZeilen(teams);
  const boss = bossZeilen(zusatz.bosse, staende, zufall);
  const text = [
    kopf,
    "",
    ...zeilen,
    ...(team.length ? ["", ...team] : []),
    "",
    ...infos,
    ...(boss.length ? ["", ...boss] : []),
    "",
    ...sprueche.map((s) => s.text),
    ...extra,
    ...hinweis,
  ].join("\n");
  return { text, sprueche };
}

export interface Extras {
  minuten: number;
  messungen: number;
  sportarten: number;
}

export interface Sonderpreis {
  art: string;
  titel: string;
  gewinner: string[];
  wert: string;
}

/** Sonderpreise (Konzept 6): je Kategorie alle mit dem besten Wert, nur wenn der Wert zählt. */
export function sonderpreise(staende: readonly TeilnehmerStand[], extras: ReadonlyMap<string, Extras>): Sonderpreis[] {
  const preise: Sonderpreis[] = [];
  function vergib(art: string, titel: string, wert: (st: TeilnehmerStand) => number | null, format: (w: number) => string) {
    const werte = staende.map((st) => ({ st, w: wert(st) })).filter((x): x is { st: TeilnehmerStand; w: number } => x.w !== null && x.w > 0);
    if (werte.length === 0) return;
    const best = Math.max(...werte.map((x) => x.w));
    preise.push({ art, titel, gewinner: werte.filter((x) => x.w === best).map((x) => x.st.id), wert: format(best) });
  }
  const ex = (st: TeilnehmerStand) => extras.get(st.id);
  vergib("slimfast", "Mr. Slimfast", (st) => st.fortschritt?.fettAbbauPct ?? null, (w) => `−${z(w)} % Fett`);
  vergib("bizeps", "Der 30er-Bizeps", (st) => st.fortschritt?.muskelAufbauPct ?? null, (w) => `+${z(w)} % Muskel`);
  vergib("maschine", "Die Maschine", (st) => st.wochen.reduce((s, w) => s + w.last, 0), (w) => `${z(w)} Lastpunkte`);
  vergib("dauerbrenner", "Der Dauerbrenner", (st) => Math.max(0, ...st.wochen.map((w) => w.serie)), (w) => (w === 1 ? "1 Woche" : `${w} Wochen in Folge`));
  vergib("statistiker", "Der Statistiker", (st) => ex(st)?.messungen ?? null, (w) => `${w} Messungen`);
  vergib("allrounder", "Der Allrounder", (st) => ex(st)?.sportarten ?? null, (w) => `${w} Sportarten`);
  return preise;
}

export function finale(
  season: { name: string },
  staende: readonly TeilnehmerStand[],
  extras: ReadonlyMap<string, Extras>,
  teams: readonly TeamStand[] = [],
  zufall: () => number = Math.random,
  erfolge: NeueErfolge = [],
  laterne: { woche?: readonly LaterneTraeger[]; koenig?: { namen: string[]; anzahl: number } | null } = {},
): { text: string; preise: Sonderpreis[] } {
  const kopf = `🏁 Finale „${season.name}“`;
  if (staende.length === 0) return { text: `${kopf}\n\nKeiner hat mitgemacht. Dann halt nächstes Mal.`, preise: [] };
  const name = new Map(staende.map((st) => [st.id, st.name]));
  const sieger = staende.filter((st) => st.platz === 1);
  const zeilen = staende.map(
    (st) =>
      `${st.platz}. ${st.name}: ${z(st.gesamt)} (Fleiß ${z(st.fleiss)} · Fortschritt ${st.fortschritt ? z(st.fortschritt.punkte) : "–"}${st.bossBonus ? ` · Boss +${z(st.bossBonus)}` : ""})`,
  );
  const neueErfolge = erfolgZeilen(erfolge);
  const preise = sonderpreise(staende, extras);
  const preisZeilen = preise.map((p) => `🏅 ${p.titel}: ${p.gewinner.map((id) => name.get(id)).join(", ")} (${p.wert})`);
  const minuten = [...extras.values()].reduce((s, e) => s + e.minuten, 0);
  const letzter = staende.at(-1)!;
  const texte = [
    kopf,
    "",
    fuelle(waehleSpruch("finale_sieger", undefined, zufall), {
      name: sieger.map((s) => s.name).join(" und "),
      punkte: z(sieger[0]!.gesamt),
    }),
    "",
    ...zeilen,
    ...(teams.length
      ? ["", `🏆 Teamsieger: ${teams.filter((t) => t.platz === 1).map((t) => t.name).join(" und ")}`, ...teamZeilen(teams)]
      : []),
    ...(preisZeilen.length ? ["", "Sonderpreise:", ...preisZeilen] : []),
    ...(neueErfolge.length ? ["", ...neueErfolge] : []),
    ...laternenFinale(laterne.woche, laterne.koenig),
    ...(staende.length >= 2 && letzter.platz > 1
      ? ["", fuelle(waehleSpruch("finale_letzter", undefined, zufall), { name: letzter.name, punkte: z(letzter.gesamt) })]
      : []),
    "",
    `Rückblick: zusammen ${z(minuten / 60)} Stunden Sport. Nächste Season mit /season Name.`,
  ];
  return { text: texte.join("\n"), preise };
}

function laternenFinale(woche: readonly LaterneTraeger[] = [], koenig?: { namen: string[]; anzahl: number } | null): string[] {
  const zeilen = laternenZeile(woche).map((l) => l.replace("Rote Laterne:", "Letzte Rote Laterne:"));
  if (koenig && koenig.anzahl >= 2) {
    zeilen.push(`🏮 Laternenkönig der Season: ${koenig.namen.join(" und ")} mit ${koenig.anzahl} Roten Laternen. Die Lampe darfst du behalten.`);
  }
  return zeilen.length ? ["", ...zeilen] : [];
}
