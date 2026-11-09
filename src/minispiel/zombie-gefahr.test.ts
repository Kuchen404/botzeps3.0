import { describe, expect, it } from 'vitest';
import { zombieGefahr } from './zombie-gefahr.js';
import { animationsStand } from './animation.js';
import { zeitpunktIn } from '../scoring/datum.js';
import type { DatenVon, SpielTraining } from './spiele.js';

const d: DatenVon<'zombie'> = { art: 'zombie', spieler: ['p', 'a'], patientNull: 'p', gemeldet: [] };
const w = { start: '2026-10-19', ziel: 450 };
const t = (datum: string, faktor = 2): SpielTraining => ({ id: 1, datum, erstellt: datum + 'T10:00:00Z', minuten: 15, faktor });
const zeit = (tag = '2026-10-20', zeitzone = 'Europe/Berlin', berichtszeit = '20:00') => ({ tag, zeitzone, berichtszeit, abgeschlossen: false });
const sp = (trainings: SpielTraining[] = []) => [{ id: 'p', name: 'P', trainings: [] }, { id: 'a', name: 'A', trainings }];
const gefahr = (trainings: SpielTraining[] = [], tag = '2026-10-20') => zombieGefahr(d, sp(trainings), w, zeit(tag), new Set(['p']));

describe('Zombie-Trainingsfristen nach Kalendertagen', () => {
  it('warnt ohne Montagstraining ab Dienstag und lässt bis zum Ende des Dienstags Zeit', () => {
    expect(gefahr().a).toEqual({ warnAb: '2026-10-19T22:00:00.000Z', frist: '2026-10-20T22:00:00.000Z' });
    expect(gefahr().p).toBeUndefined();
  });
  it('verschiebt die Frist nach heutigem Training und rechnet nicht 48 Stunden ab Eintragszeit', () => {
    expect(gefahr([t('2026-10-20')]).a).toEqual({ warnAb: '2026-10-21T22:00:00.000Z', frist: '2026-10-22T22:00:00.000Z' });
    expect(gefahr([t('2026-10-19')]).a?.frist).toBe('2026-10-21T22:00:00.000Z');
  });
  it('ignoriert Training vor der Spielwoche und nach dem betrachteten Tag', () => {
    expect(gefahr([t('2026-10-18'), t('2026-10-21')])).toEqual(gefahr());
  });
  it('zählt auch gültige Trainings ohne Lastpunkte wie die bestehende Infektionsregel', () => {
    expect(gefahr([t('2026-10-20', 0)])).toEqual(gefahr([t('2026-10-20')]));
  });
  it('setzt die Sonntagsfrist auf die konfigurierte Berichtszeit und schützt Wochenendtraining', () => {
    const daten = sp([t('2026-10-23')]);
    expect(zombieGefahr(d, daten, w, zeit('2026-10-25', 'Europe/Berlin', '19:30'), new Set(['p'])).a).toEqual({ warnAb: '2026-10-24T22:00:00.000Z', frist: '2026-10-25T18:30:00.000Z' });
    expect(gefahr([t('2026-10-24')], '2026-10-25')).toEqual({});
    expect(gefahr([t('2026-10-25')], '2026-10-25')).toEqual({});
  });
  it('berücksichtigt die lange Winterzeitnacht und die kurze Sommerzeitnacht', () => {
    for (const [start, freitag, sonntag, stunden] of [['2026-10-19', '2026-10-23', '2026-10-25', 21], ['2026-03-23', '2026-03-27', '2026-03-29', 19]]) {
      const g = zombieGefahr(d, sp([t(freitag as string)]), { start: start as string, ziel: 450 }, zeit(sonntag as string), new Set(['p'])).a!;
      expect((Date.parse(g.frist) - Date.parse(g.warnAb)) / 3_600_000).toBe(stunden);
      expect(g.frist).toBe(zeitpunktIn(sonntag as string, '20:00', 'Europe/Berlin').toISOString());
    }
  });
  it('liefert für Infizierte, fremde Spieler und abgeschlossene Spiele keine Warnung', () => {
    expect(zombieGefahr(d, sp(), w, zeit(), new Set(['p', 'a']))).toEqual({});
    expect(zombieGefahr(d, [{ id: 'fremd', name: 'F', trainings: [] }], w, zeit(), new Set())).toEqual({});
    expect(zombieGefahr(d, sp(), w, { ...zeit(), abgeschlossen: true }, new Set(['p']))).toEqual({});
  });
  it('bildet Nachträge und deren Entfernung deterministisch ab', () => {
    const mit = gefahr([t('2026-10-19')]); expect(mit.a?.frist).not.toBe(gefahr().a?.frist); expect(gefahr([])).toEqual(gefahr());
  });
  it('ergänzt zeitstabile Gefahrendaten und Spieltag, ohne Rohtrainings zu veröffentlichen', () => {
    const s = animationsStand(d, sp(), w, 1, zeit())!;
    expect(s).toMatchObject({ spieltag: '2026-10-20', gefahr: gefahr() });
    expect(JSON.stringify(s)).not.toMatch(/minuten|erstellt|trainings/);
  });
});
