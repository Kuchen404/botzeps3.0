import { afterEach, describe, expect, it } from "vitest";
import { uhr } from "../bot/kontext.js";
import { testBot, befehl, knopf, GRUPPE, PETER } from "../bot/testhilfe.js";
import { aendereSeason, seasonNachId } from "../db/season-repo.js";
import { animationFuerApp, animationsStand } from "./animation.js";
import type { MinispielDaten } from "./spiele.js";
const original = uhr.jetzt;
afterEach(() => { uhr.jetzt = original; });
async function aufbau() {
  uhr.jetzt = () => new Date("2026-10-05T10:00:00Z");
  const t = testBot();
  await t.bot.handleUpdate(knopf("mitmachen", GRUPPE, PETER));
  await t.bot.handleUpdate(befehl("/season Herbst"));
  aendereSeason(t.db, 1, { wochen: 4 });
  const s = seasonNachId(t.db, 1)!;
  const teilnehmer = t.db.prepare("SELECT CAST(id AS TEXT) AS id, name FROM nutzer ORDER BY name").all() as { id: string; name: string }[];
  const ids = teilnehmer.map((p) => p.id);
  const sport = (t.db.prepare("SELECT id FROM sportart LIMIT 1").get() as { id: number }).id;
  const training = (id: string, datum: string, erstellt: string, geloescht: string | null = null) => t.db.prepare("INSERT INTO training (nutzer,datum,minuten,sportart,faktor,erstellt_am,geloescht_am) VALUES (?,?,60,?,2,?,?)").run(Number(id), datum, sport, erstellt, geloescht);
  uhr.jetzt = () => new Date("2026-11-06T12:00:00Z");
  const spiel = (d: MinispielDaten) => t.db.prepare("INSERT OR REPLACE INTO minispiel (season,woche,art,daten) VALUES (1,3,?,?)").run(d.art, JSON.stringify(d));
  return { ...t, s, ids, training, spiel };
}

describe("Minispiel-Szenen und chronologische Spielstände", () => {
  it("liefert für alle sechs Spiele historische und aktuelle echte Spielstände", async () => {
    const t = await aufbau();
    try {
      const [a,b] = t.ids as [string,string];
      t.training(a,"2026-11-02","2026-11-02T10:00:00Z");
      t.training(b,"2026-11-03","2026-11-03T10:00:00Z");
      const arten: MinispielDaten[] = [
        {art:"zombie",spieler:t.ids,patientNull:a,gemeldet:[]},
        {art:"kopfgeld",spieler:t.ids,gejagter:a}, {art:"gipfel",spieler:t.ids},
        {art:"tauziehen",spieler:t.ids,teams:[{name:"Eisen",mitglieder:[a]},{name:"Pizza",mitglieder:[b]}]},
        {art:"tresor",spieler:t.ids,code:[7,8,9,6],ziel:400},
        {art:"duell",spieler:t.ids,paare:[[a,b],[a,"bot"]]},
      ];
      for (const d of arten) {
        t.spiel(d);
        const anim = animationFuerApp(t.db,t.s,"2026-11-06",a)!;
        expect(anim.art).toBe(d.art);
        expect(anim.verlauf[0]?.art).toBe("start");
        expect(anim.verlauf.at(-1)?.stand).toEqual(anim.aktuell);
        expect(anim.spieler[0]).toMatchObject({id:a,ich:true});
        expect(anim.abgeschlossen).toBe(false);
        expect(JSON.stringify(anim)).not.toMatch(/erstellt_am|minuten|fett|muskel/);
        if (d.art === "tresor") {
          expect(anim.aktuell).toMatchObject({ziffern:2,code:"7 8 _ _",offen:false});
          expect(JSON.stringify(anim)).not.toContain("7 8 9 6");
        }
        if (d.art === "duell") expect(anim.spieler).toContainEqual({id:"bot",name:"Botzeps",ich:false});
      }
    } finally { t.db.close(); }
  });
  it("ordnet Nachträge nach Eintrag, enthält Löschungen und ignoriert spätere Einträge", async () => {
    const t = await aufbau();
    try {
      const [a] = t.ids as [string,string];
      t.spiel({art:"gipfel",spieler:t.ids});
      t.training(a,"2026-11-02","2026-11-04T10:00:00Z","2026-11-05T11:00:00Z");
      t.training(a,"2026-11-07","2026-11-07T13:00:00Z");
      const anim = animationFuerApp(t.db,t.s,"2026-11-06",a)!;
      // Zukünftige Eintragszeiten dürfen in der Vergangenheit noch nicht erscheinen.
      expect(anim.verlauf.map((v)=>v.zeitpunkt)).not.toContain("2026-11-07T13:00:00Z");
      expect(anim.verlauf.some((v)=>v.art==="training" && v.zeitpunkt==="2026-11-04T10:00:00Z")).toBe(true);
      expect(anim.verlauf.some((v)=>v.art==="korrektur" && v.zeitpunkt==="2026-11-05T11:00:00Z")).toBe(true);
    } finally {t.db.close();}
  });
  it("berechnet den Tauziehstand pro Kopf und kopiert keine geheimen Tresorziffern", () => {
    const sp = [{id:"a",name:"A",trainings:[]},{id:"b",name:"B",trainings:[]}];
    const w={start:"2026-11-02",ziel:300};
    expect(animationsStand({art:"tauziehen",spieler:["a","b"],teams:[{name:"A",mitglieder:["a"]},{name:"B",mitglieder:["b"]}]},sp,w,2)).toMatchObject({schnitt:[0,0],zug:0});
    expect(animationsStand({art:"tresor",spieler:["a","b"],code:[1,2,3,4],ziel:400},sp,w,2)).toMatchObject({code:"_ _ _ _",ziffern:0,offen:false});
  });
});
