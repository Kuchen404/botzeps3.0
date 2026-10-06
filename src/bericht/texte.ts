import type { TeilnehmerStand } from "../scoring/season.js";
import { type Kategorie, fuelle, platzKategorie, waehleSpruch } from "../texte/sprueche.js";

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

export interface Wochenbericht {
  text: string;
  sprueche: BerichtZeile[];
}

/**
 * Wochenbericht für die Gruppe (Konzept 6): Rangliste mit Veränderung zur Vorwoche,
 * Wochenziel, Serien, Fleiß der Woche und je ein derber Spruch pro Person.
 * Keine Rohwerte, nur Punkte.
 */
export function wochenbericht(
  season: { name: string; wochen: number; wochenzielLast: number },
  woche: number,
  staende: readonly TeilnehmerStand[],
  vorwoche: ReadonlyMap<string, Vorwoche>,
  zufall: () => number = Math.random,
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
  infos.push(
    geschafft.length
      ? `✅ Wochenziel (${season.wochenzielLast}) geschafft: ${geschafft.map((g) => g.name).join(", ")}`
      : `✅ Wochenziel (${season.wochenzielLast}) geschafft: niemand. Peinlich.`,
  );

  const sprueche: BerichtZeile[] = staende.map((st, i) => {
    const vorher = vorwoche.get(st.id);
    let kategorie: Kategorie = platzKategorie(st.platz, staende.length);
    if (vorher && vorher.platz - st.platz >= 2) kategorie = "aufsteiger";
    else if (vorher && st.platz - vorher.platz >= 2) kategorie = "absteiger";
    // Nicht zweimal hintereinander dieselbe Vorlage für dieselbe Person
    const vorlage = waehleSpruch(kategorie, vorher?.vorlage ?? undefined, zufall);
    const text = fuelle(vorlage, { name: st.name, platz: st.platz, punkte: z(st.gesamt), abstand: z(abstand(staende, i)) });
    return { id: st.id, vorlage, text };
  });

  const extra: string[] = [];
  const verfehlt = staende.filter((st) => !st.wochen[woche]?.zielErreicht);
  if (verfehlt.length > 0 && verfehlt.length < staende.length) {
    const opfer = verfehlt[Math.min(Math.floor(zufall() * verfehlt.length), verfehlt.length - 1)]!;
    extra.push(fuelle(waehleSpruch("wochenziel_verfehlt", undefined, zufall), { name: opfer.name }));
  }
  const besteSerie = [...staende].sort((a, b) => (b.wochen[woche]?.serie ?? 0) - (a.wochen[woche]?.serie ?? 0))[0];
  const serie = besteSerie?.wochen[woche]?.serie ?? 0;
  if (besteSerie && serie >= 3) {
    extra.push(fuelle(waehleSpruch("serie", undefined, zufall), { name: besteSerie.name, serie }));
  }

  const hinweis =
    woche === season.wochen - 2
      ? ["", "⚠️ Nächste Woche ist die letzte. Der Endwert ist der Schnitt eurer Messungen dieser Woche, also messen, messen, messen."]
      : [];

  const text = [kopf, "", ...zeilen, "", ...infos, "", ...sprueche.map((s) => s.text), ...extra, ...hinweis].join("\n");
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
  zufall: () => number = Math.random,
): { text: string; preise: Sonderpreis[] } {
  const kopf = `🏁 Finale „${season.name}“`;
  if (staende.length === 0) return { text: `${kopf}\n\nKeiner hat mitgemacht. Dann halt nächstes Mal.`, preise: [] };
  const name = new Map(staende.map((st) => [st.id, st.name]));
  const sieger = staende.filter((st) => st.platz === 1);
  const zeilen = staende.map(
    (st) => `${st.platz}. ${st.name}: ${z(st.gesamt)} (Fleiß ${z(st.fleiss)} · Fortschritt ${st.fortschritt ? z(st.fortschritt.punkte) : "–"})`,
  );
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
    ...(preisZeilen.length ? ["", "Sonderpreise:", ...preisZeilen] : []),
    ...(staende.length >= 2 && letzter.platz > 1
      ? ["", fuelle(waehleSpruch("finale_letzter", undefined, zufall), { name: letzter.name, punkte: z(letzter.gesamt) })]
      : []),
    "",
    `Rückblick: zusammen ${z(minuten / 60)} Stunden Sport. Nächste Season mit /season Name.`,
  ];
  return { text: texte.join("\n"), preise };
}
