import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
const api = runInNewContext(readFileSync(new URL("../miniapp/spiele/kopfgeld.js", import.meta.url), "utf8") + `\n({kopfgeldVorn,kopfgeldWechsel,kopfgeldFokus,kopfgeldPosition,kopfgeldFortsetzung,kopfgeldSignaturen,kopfgeldLast})`, {
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
  it("hält Darsteller im Bild und tauscht ihre Reihenfolge erst beim Überholen", () => {
    const vor=api.kopfgeldPosition(stand(100,100),"hunter"), nach=api.kopfgeldPosition(stand(100,101),"hunter");
    expect(vor.jaeger).toBeLessThan(vor.ziel);expect(nach.jaeger).toBeGreaterThan(nach.ziel);
    for(const s of [stand(0,0),stand(0,1000),stand(1000,0)]) for(const n of Object.values(api.kopfgeldPosition(s,"hunter")) as number[]) {expect(n).toBeGreaterThanOrEqual(20);expect(n).toBeLessThanOrEqual(80);}
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
