import type { Db } from "../db/index.js";
import { aktuelleSeason, bosseDerSeason, einstellungen, ladeTeilnehmer } from "../db/season-repo.js";
import { alleTrainings, lebenslangeLast, vergebeErfolge, vergebeErfolgeAn } from "../db/erfolg-repo.js";
import { RESISTENZ_FAKTOR, SCHWAECHE_FAKTOR, bossAnzeigename, bossKampf, bossSchadenVon, lebensbalken } from "../scoring/boss.js";
import { BOSS_BLUTET } from "../boss/texte.js";
import { bossSiegErfolge, freischaltZeilen, trainingsErfolge, wochenErfolge, type ErfolgArt } from "../scoring/erfolge.js";
import { rangIndex, rangText, RAENGE } from "../scoring/raenge.js";
import { type Teilnehmer, type TeilnehmerStand, seasonEnde, seasonStand, wocheVon } from "../scoring/season.js";
import { fuelle, waehleSpruch } from "../texte/sprueche.js";
import { minispielMeldungen } from "../minispiel/ablauf.js";
import { lauwarmBeimPost, lauwarmBilanz } from "../scoring/lauwarm.js";

const z = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 0 });

interface TrainingZeile {
  nutzer: number;
  name: string;
  gruppe: number;
  datum: string;
  minuten: number;
  faktor: number;
  sportartId: number;
  sportartName: string;
}

/** Teilnehmer so, als gäbe es dieses eine Training noch nicht. */
function ohneTraining(teilnehmer: readonly Teilnehmer[], id: string, t: TrainingZeile): Teilnehmer[] {
  return teilnehmer.map((tn) => {
    if (tn.id !== id) return tn;
    const i = tn.trainings.findIndex((x) => x.datum === t.datum && x.minuten === t.minuten && x.faktor === t.faktor);
    return i < 0 ? tn : { ...tn, trainings: tn.trainings.filter((_, j) => j !== i) };
  });
}

/** Wer vorher vor mir lag und jetzt hinter mir. */
function ueberholte(vorher: readonly TeilnehmerStand[], nachher: readonly TeilnehmerStand[], ich: string): TeilnehmerStand[] {
  const platzVorher = new Map(vorher.map((st) => [st.id, st.platz]));
  const meinVorher = platzVorher.get(ich)!;
  const meinNachher = nachher.find((st) => st.id === ich)!.platz;
  return nachher.filter((st) => st.id !== ich && platzVorher.get(st.id)! < meinVorher && st.platz > meinNachher);
}

/**
 * Meldungen, die an den Gruppenpost eines neuen Trainings angehängt werden:
 * Überholmanöver, Boss-Schaden, Minispiel, Spott für Faktor-Minimalisten, Rangaufstieg und neue Erfolge.
 */
export function meldungenNachTraining(db: Db, trainingId: number, tag: string, zufall: () => number = Math.random): string[] {
  const t = db
    .prepare(
      `SELECT t.nutzer, n.name, s.gruppe, t.datum, t.minuten, t.faktor, t.sportart AS sportartId, s.name AS sportartName FROM training t
       JOIN nutzer n ON n.id = t.nutzer JOIN sportart s ON s.id = t.sportart
       WHERE t.id = ? AND t.geloescht_am IS NULL`,
    )
    .get(trainingId) as TrainingZeile | undefined;
  if (!t) return [];
  const zeilen: string[] = [];
  const erfolge: ErfolgArt[] = trainingsErfolge(alleTrainings(db, t.nutzer));
  /** Was schon ohne dieses Training verdient war, aber erst jetzt geprüft wird (z. B. neu eingeführte Erfolge) */
  const schonVorher = new Set<ErfolgArt>(trainingsErfolge(alleTrainings(db, t.nutzer, trainingId)));
  /** Neue Erfolge der anderen, die beim Bosssieg mitgeprügelt haben */
  const mitgepruegelt: { name: string; arten: ErfolgArt[] }[] = [];

  const s = aktuelleSeason(db, t.gruppe, tag);
  const id = String(t.nutzer);
  const teilnehmer = s && s.start <= tag && t.datum >= s.start && t.datum <= seasonEnde(s) ? ladeTeilnehmer(db, s) : [];
  if (s && teilnehmer.some((tn) => tn.id === id)) {
    const bosse = bosseDerSeason(db, s);
    const e = einstellungen(s, bosse);
    const nachher = seasonStand(e, teilnehmer, tag);
    const vorher = seasonStand(e, ohneTraining(teilnehmer, id, t), tag);
    const ich = nachher.find((st) => st.id === id)!;

    const weg = ueberholte(vorher, nachher, id);
    if (weg.length) {
      const opfer = weg.map((st) => st.name).join(" und ");
      const spitze = ich.platz === 1 && vorher.find((st) => st.id === id)!.platz > 1;
      zeilen.push(fuelle(waehleSpruch(spitze ? "spitze" : "ueberholt", undefined, zufall), { name: t.name, opfer, platz: ich.platz }));
    }

    const woche = wocheVon(s, t.datum);
    for (const boss of bosse.filter((b) => b.woche === woche)) {
      const name = bossAnzeigename(boss.name, boss.stufe);
      const kVorher = bossKampf(boss, vorher);
      const kNachher = bossKampf(boss, nachher);
      if (kVorher.besiegt) continue;
      if (boss.schwaeche === t.sportartId) {
        zeilen.push(`💥 Volltreffer! ${t.sportartName} ist die Schwäche von ${name}: ${SCHWAECHE_FAKTOR}× Schaden.`);
        erfolge.push("boss_volltreffer");
      } else if (boss.resistenz === t.sportartId) {
        zeilen.push(`🛡 Abgeprallt! ${t.sportartName} kitzelt ${name} nur: ${String(RESISTENZ_FAKTOR).replace(".", ",")}× Schaden.`);
        erfolge.push("boss_abgeprallt");
      }
      if (kNachher.besiegt) {
        zeilen.push(fuelle(waehleSpruch("boss_besiegt", undefined, zufall), { name: t.name, boss: name }));
        erfolge.push(...bossSiegErfolge(boss), "boss_gnadenstoss");
        // Schlachter: wer beim Fall den meisten Schaden hatte (bei Gleichstand alle)
        const schaden = new Map(nachher.map((st) => [st.id, bossSchadenVon(boss, st)]));
        const meister = Math.max(...kNachher.beteiligte.map((b) => schaden.get(b) ?? 0));
        const schlachter = new Set(kNachher.beteiligte.filter((b) => (schaden.get(b) ?? 0) === meister));
        if (schlachter.has(id)) erfolge.push("boss_schlachter");
        const andere = new Map(
          kNachher.beteiligte
            .filter((b) => b !== id)
            .map((b): [number, ErfolgArt[]] => [Number(b), [...bossSiegErfolge(boss), ...(schlachter.has(b) ? (["boss_schlachter"] as const) : [])]]),
        );
        const namen = new Map(nachher.map((st) => [Number(st.id), st.name]));
        mitgepruegelt.push(...[...vergebeErfolgeAn(db, andere, tag)].map(([nutzer, arten]) => ({ name: namen.get(nutzer) ?? "?", arten })));
      } else {
        const uebrig = kNachher.lebenspunkte - kNachher.schaden;
        zeilen.push(`🐉 ${name}: ${lebensbalken(kNachher)} noch ${z(uebrig)} von ${z(kNachher.lebenspunkte)} Lebenspunkten`);
        if (kVorher.schaden * 2 < kNachher.lebenspunkte && kNachher.schaden * 2 >= kNachher.lebenspunkte) {
          zeilen.push(fuelle(BOSS_BLUTET, { boss: name }));
        }
      }
    }
    zeilen.push(...minispielMeldungen(db, s, trainingId, t.nutzer, t.datum, tag));

    // Faktor-Minimalisten gelegentlich aufziehen (jeder 3. Kuschel-Eintrag der Woche)
    const meineWoche = teilnehmer.find((tn) => tn.id === id)!.trainings.filter((x) => wocheVon(s, x.datum) === woche);
    if (lauwarmBeimPost(t, lauwarmBilanz(meineWoche))) {
      zeilen.push(fuelle(waehleSpruch("lauwarm", undefined, zufall), { name: t.name, sportart: t.sportartName }));
    }
    erfolge.push(...wochenErfolge(ich.wochen, s.wochenziel_last));
    for (const art of wochenErfolge(vorher.find((st) => st.id === id)!.wochen, s.wochenziel_last)) schonVorher.add(art);
  }

  const lastJetzt = lebenslangeLast(db, t.nutzer);
  const rangJetzt = rangIndex(lastJetzt);
  if (rangJetzt > rangIndex(lebenslangeLast(db, t.nutzer, trainingId))) {
    zeilen.push(fuelle(waehleSpruch("rang_aufstieg", undefined, zufall), { name: t.name, rang: rangText(RAENGE[rangJetzt]!) }));
  }

  const neu = vergebeErfolge(db, t.nutzer, erfolge, tag);
  zeilen.push(...freischaltZeilen([{ name: t.name, arten: neu }, ...mitgepruegelt], schonVorher));
  return zeilen;
}

/** Hängt die Meldungen an einen Trainingspost an. */
export function mitMeldungen(post: string, meldungen: readonly string[]): string {
  return meldungen.length ? `${post}\n\n${meldungen.join("\n")}` : post;
}
