import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
const api = runInNewContext(readFileSync(new URL("../miniapp/spiele/kopfgeld.js", import.meta.url), "utf8") + `\n({kopfgeldVorn,kopfgeldWechsel,kopfgeldFokus,kopfgeldWeg,kopfgeldLaufplan,kopfgeldLaufFrames,kopfgeldFortsetzung,kopfgeldSignaturen,kopfgeldLast})`, {
  window: { addEventListener() {}, innerWidth: 390 }, document: { addEventListener() {} },
});
const stand = (ziel: number, hunter: number, extra = 0) => ({ gejagter: "ziel", gejagterLast: ziel, jaeger: ["hunter", "extra"].filter(id => ({hunter, extra})[id as "hunter" | "extra"] > ziel), lasten: { ziel, hunter, extra } });
describe("Kopfgeldjagd: echte Wochenlast und Wiedergabe", () => {
  it("lässt bei Gleichstand und bei null Last das Kopfgeld offen", () => {
    expect(api.kopfgeldVorn(stand(120,120))).toEqual([]);
    expect(api.kopfgeldVorn(stand(0,0))).toEqual([]);
    expect(api.kopfgeldVorn(stand(120,120.01))).toEqual(["hunter"]);
  });
  it("zählt alle gemeldeten berechtigten Jäger genau einmal und niemals den Gejagten", () => {
    const s = stand(100,130,140); s.jaeger.push("hunter","ziel","unbekannt");
    expect(api.kopfgeldVorn(s)).toEqual(["hunter","extra"]);
    s.jaeger=[]; expect(api.kopfgeldVorn(s)).toEqual([]);
  });
  it("erkennt Überholen und den Verlust des Kopfgelds bei Gleichstand", () => {
    expect(api.kopfgeldWechsel(stand(120,80),{art:"training",stand:stand(120,140)})).toMatchObject({training:true,dazu:["hunter"],weg:[]});
    expect(api.kopfgeldWechsel(stand(120,140),{art:"training",stand:stand(140,140)})).toMatchObject({training:true,dazu:[],weg:["hunter"]});
  });
  it("verwechselt den Rückstand eines Jägers nicht mit dem Ergebnis aller Jäger", () => {
    const neu=stand(140,140,180);
    expect(api.kopfgeldWechsel(stand(120,140,180),{art:"training",stand:neu}).weg).toEqual(["hunter"]);
    expect(api.kopfgeldVorn(neu)).toEqual(["extra"]);
  });
  it("spielt nach Löschung und nachträglichen Änderungen keine erfundenen Überholmanöver", () => {
    expect(api.kopfgeldWechsel(stand(100,150),{art:"training",stand:stand(100,80)})).toMatchObject({korrektur:true,training:false,dazu:[],weg:[]});
    expect(api.kopfgeldWechsel(stand(100,80),{art:"korrektur",stand:stand(100,150)})).toMatchObject({korrektur:true,training:false,dazu:[]});
  });
  it("gibt dem eigenen berechtigten Avatar Vorrang, ohne falsche Sieger auszuwählen", () => {
    const s=stand(100,130,160), p=[{id:"ziel",ich:true},{id:"hunter",ich:true},{id:"extra"}];
    expect(api.kopfgeldFokus(s,p,["hunter","extra"])).toEqual(["hunter","extra"]);
    expect(api.kopfgeldFokus(s,p,["extra"])).toEqual(["extra"]);
  });
  it("zeigt jeden Spieler auf der vollständigen Route und hält bei Gleichstand den Gejagten davor", () => {
    const spieler=[{id:"ziel"},{id:"hunter"},{id:"extra"}];
    const gleich=api.kopfgeldLaufplan(stand(100,100,0),spieler,200);
    expect([...gleich.keys()].sort()).toEqual(["extra","hunter","ziel"]);
    expect(gleich.get("ziel").fortschritt).toBeGreaterThan(gleich.get("hunter").fortschritt);
    const vor=api.kopfgeldLaufplan(stand(100,101,0),spieler,200);
    expect(vor.get("hunter").fortschritt).toBeGreaterThan(vor.get("ziel").fortschritt);
  });
  it("behält auch 80 Jäger im Bild, ohne Spieler auszusortieren", () => {
    const spieler=Array.from({length:81},(_,i)=>({id:String(i)}));
    const s={gejagter:"0",gejagterLast:0,lasten:{},jaeger:[]};
    const plan=api.kopfgeldLaufplan(s,spieler,1);
    expect(plan.size).toBe(81);
    for(const p of plan.values()) {expect(p.x).toBeGreaterThanOrEqual(12);expect(p.x).toBeLessThanOrEqual(86);expect(p.y).toBeGreaterThan(10);expect(p.y).toBeLessThan(96);}
    expect(new Set([...plan.values()].map((p: {x:number;y:number})=>p.x+":"+p.y)).size).toBe(81);
  });
  it("folgt in beiden Richtungen allen Kurven statt quer über die Karte zu springen", () => {
    expect(api.kopfgeldWeg(0)).toEqual({x:12,y:32});expect(api.kopfgeldWeg(1)).toEqual({x:15,y:92});
    for(const [von,nach] of [[.04,.93],[.93,.04]]) {
      const frames=api.kopfgeldLaufFrames({fortschritt:von,spur:0},{fortschritt:nach,spur:0});
      expect(frames.length).toBeGreaterThan(50);expect(frames[0].offset).toBe(0);expect(frames.at(-1).offset).toBe(1);
      for(let i=1;i<frames.length;i++) {expect(Math.abs(parseFloat(frames[i].left)-parseFloat(frames[i-1].left))).toBeLessThan(5);expect(Math.abs(parseFloat(frames[i].top)-parseFloat(frames[i-1].top))).toBeLessThan(5);}
    }
  });
  it("setzt nur neue Stationen fort und startet bei geänderter Historie neu", () => {
    expect(api.kopfgeldFortsetzung(["a","b"],["a","b","c"])).toBe(1);
    expect(api.kopfgeldFortsetzung(["a","b"],["a","b"])).toBeNull();
    expect(api.kopfgeldFortsetzung(["a","b"],["a","c"])).toBe(0);
    expect(api.kopfgeldFortsetzung(null,[])).toBeNull();
  });
  it("ignoriert wechselnde Abfragezeiten, erhält aber Änderungen der Lastwerte", () => {
    const a=[{art:"training",zeitpunkt:"a",stand:stand(100,130)}], b=[{...a[0],zeitpunkt:"b"}];
    expect(api.kopfgeldSignaturen(a)).toEqual(api.kopfgeldSignaturen(b));
    expect(api.kopfgeldLast(stand(100,NaN),"hunter")).toBe(0);
  });
});
