import { zombieGefahr, zombieSchutz, type ZombieZeit } from "./zombie-gefahr.js";
import type { Db } from "../db/index.js";
import type { SeasonZeile } from "../db/season-repo.js";
import { gruppenZeitzone, uhr } from "../bot/kontext.js";
import { lokalesDatum, plusTage, zeitpunktIn } from "../scoring/datum.js";
import { minispielDerApp } from "./ablauf.js";
import { bombenTrainings } from "./bombenverlauf.js";
import { fertigeTage } from "./meldungen.js";
import { MINISPIELE, BOT_ID, BOT_NAME, lasten, zombies, kopfgeld, gipfel, seil, tresor, codeText, duelle, type MinispielDaten, type Spieler, type SpielWoche } from "./spiele.js";

/** Nur öffentliche Spielstände, niemals Waagenwerte, Rohtrainings oder geheime Tresorziffern. */
export function animationsStand(d: MinispielDaten, spieler: readonly Spieler[], w: SpielWoche, tage: number, zeit?: Partial<ZombieZeit>) {
  const l = lasten(d, spieler, w);
  const last = Object.fromEntries(d.spieler.map((id) => [id, l.get(id) ?? 0]));
  switch (d.art) {
    case "zombie": {
      const z = zombies(d, spieler, w, tage);
      const sonntag = plusTage(w.start, 6), datum = zeit?.tag ?? plusTage(w.start, Math.max(0, Math.min(6, tage)));
      const spieltag = datum < w.start ? w.start : datum > sonntag ? sonntag : datum;
      const kontext = { tag: spieltag, zeitzone: zeit?.zeitzone ?? gruppenZeitzone(), berichtszeit: zeit?.berichtszeit ?? "20:00", abgeschlossen: zeit?.abgeschlossen ?? false };
      return { patientNull: d.patientNull, zombies: [...z].map(([id, tag]) => ({ id, tag })), menschen: d.spieler.filter((id) => !z.has(id)), spieltag, gefahr: zombieGefahr(d, spieler, w, kontext, new Set(z.keys())), schutz: zombieSchutz(d, spieler, w, kontext, new Set(z.keys())) };
    }
    case "kopfgeld": return { gejagter: d.gejagter, ...kopfgeld(d, l), lasten: last };
    case "gipfel": return { ziel: Math.max(1, w.ziel), kletterer: gipfel(d, spieler, w) };
    case "tauziehen": return { teams: d.teams, ...seil(d, l), lasten: last };
    case "tresor": {
      const t = tresor(d, l);
      return { ...t, ziel: d.ziel, code: codeText(d, t.ziffern), lasten: last };
    }
    case "duell": return { paare: duelle(d, l) };
    case "bombe": return null; // Hat bereits eine eigene Szene und Historie.
  }
}

/** Chronologie aus Einträgen und Softlöschungen; Tageswechsel ergänzen Zombie-Bisse. */
export function animationFuerApp(db: Db, s: SeasonZeile, tag: string, ich: string) {
  const spiel = minispielDerApp(db, s, tag);
  if (!spiel || spiel.daten.art === "bombe") return null;
  const { daten: d, w, woche, stichtag, abgeschlossen } = spiel, zeitzone = gruppenZeitzone();
  const start = zeitpunktIn(w.start, "09:00", zeitzone).toISOString();
  const jetzt = uhr.jetzt().toISOString(), von = Date.parse(start), bis = Date.parse(jetzt);
  const spieler = spiel.spieler.filter((sp) => d.spieler.includes(sp.id));
  const aktuell = animationsStand(d, spieler, w, spiel.fertigeTage, { tag: stichtag, zeitzone, berichtszeit: s.berichtszeit, abgeschlossen });
  const trainings = bombenTrainings(db, s.id, stichtag).filter((t) => d.spieler.includes(t.spieler));
  const aktiv = new Map(trainings.filter((t) => Date.parse(t.erstellt) < von && (!t.geloescht || Date.parse(t.geloescht) >= von)).map((t) => [t.id, t]));
  const verlauf: { zeitpunkt: string; art: string; stand: NonNullable<typeof aktuell> }[] = [];
  function aufnehmen(zeitpunkt: string, art: string) {
    const stand = animationsStand(d!, spieler.map((sp) => ({ ...sp, trainings: [...aktiv.values()].filter((t) => t.spieler === sp.id) })), w,
      fertigeTage(w, lokalesDatum(new Date(zeitpunkt), zeitzone)), { tag: lokalesDatum(new Date(zeitpunkt), zeitzone), zeitzone, berichtszeit: s.berichtszeit, abgeschlossen: false });
    if (stand && JSON.stringify(stand) !== JSON.stringify(verlauf.at(-1)?.stand)) verlauf.push({ zeitpunkt, art, stand });
  }
  if (bis >= von) {
    aufnehmen(start, "start");
    const ereignisse = trainings.flatMap((t) => [
      { zeitpunkt: t.erstellt, art: "training", training: t, loeschen: false },
      ...(t.geloescht ? [{ zeitpunkt: t.geloescht, art: "korrektur", training: t, loeschen: true }] : []),
    ]).filter((e) => Date.parse(e.zeitpunkt) >= von && Date.parse(e.zeitpunkt) <= bis)
      .map((e) => ({ ...e, id: e.training.id }));
    const ereignisseMitTagen: { zeitpunkt: string; art: string; training?: typeof trainings[number]; loeschen?: boolean; id: number }[] = [...ereignisse];
    for (let t = 1; t < 7; t++) {
      const zeitpunkt = zeitpunktIn(plusTage(w.start, t), "09:00", zeitzone).toISOString();
      if (Date.parse(zeitpunkt) <= bis) ereignisseMitTagen.push({ zeitpunkt, art: "tag", id: -1 });
    }
    ereignisseMitTagen.sort((a, b) => Date.parse(a.zeitpunkt) - Date.parse(b.zeitpunkt) || Number(a.loeschen) - Number(b.loeschen) || a.id - b.id);
    for (const e of ereignisseMitTagen) {
      if (e.training) { if (e.loeschen) aktiv.delete(e.training.id); else aktiv.set(e.training.id, e.training); }
      aufnehmen(e.zeitpunkt, e.art);
    }
  }
  // Aktueller Stand ist maßgeblich, etwa direkt nach einem Tageswechsel vor der Morgenmeldung.
  if (aktuell && JSON.stringify(verlauf.at(-1)?.stand) !== JSON.stringify(aktuell)) verlauf.push({ zeitpunkt: jetzt, art: "tag", stand: aktuell });
  const teilnehmer = spieler.map((sp) => ({ id: sp.id, name: sp.name, ich: sp.id === ich }));
  if (d.art === "duell" && d.paare.some((paar) => paar.includes(BOT_ID))) teilnehmer.push({ id: BOT_ID, name: BOT_NAME, ich: false });
  return { id: `${s.id}:${woche}:${d.art}`, art: d.art, name: MINISPIELE[d.art].name, zeitzone, spieler: teilnehmer, aktuell, verlauf, abgeschlossen, ...(d.art === "zombie" ? { serverZeit: jetzt } : {}) };
}
