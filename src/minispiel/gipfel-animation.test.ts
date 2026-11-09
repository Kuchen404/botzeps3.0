import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {describe,expect,it} from "vitest";
import {gipfel,type Spieler} from "./spiele.js";
const api=runInNewContext(readFileSync(new URL('../miniapp/spiele/gipfel.js',import.meta.url),'utf8')+'\n({gipfelOben,gipfelAnteil,gipfelAnkuenfte,gipfelWechsel,gipfelWeg,gipfelPositionen,gipfelSchritte,gipfelZyklus,gipfelSignaturen,gipfelFortsetzung})',{window:{innerWidth:390,addEventListener(){}},document:{addEventListener(){}}});
const k=(id:string,anteil:number,oben:string|null=null)=>({id,last:anteil*100,anteil,hoehe:Math.round(anteil*884.8)*10,oben});
const stand=(...kletterer:ReturnType<typeof k>[])=>({ziel:100,kletterer});
describe('Gipfelsturm: gemeinsamer Aufstieg und echte Ankünfte',()=>{
 it('zeigt weder gerundete Höhe noch 100 Prozent ohne bestätigte Ankunft als Gipfel',()=>{
  for(const eintrag of [k('a',.99999),k('a',1),k('a',1,'unbekannt')]){expect(api.gipfelOben(eintrag)).toBe(false);expect(api.gipfelAnteil(eintrag)).toBeLessThan(1);}
  expect(api.gipfelOben(k('a',1,'2026-11-03T10:00:00Z'))).toBe(true);
 });
 it('übernimmt die echten Zielankünfte und ihre Reihenfolge aus den Trainings',()=>{
  const t=(id:number,last:number,erstellt:string)=>({id,minuten:last,faktor:1 as const,datum:'2026-11-03',erstellt});
  const spieler:Spieler[]=[{id:'a',name:'Alex',trainings:[t(1,99,'2026-11-03T08:00:00Z')]},{id:'b',name:'Alex',trainings:[t(2,100,'2026-11-03T10:00:00Z')]},{id:'c',name:'C',trainings:[t(3,120,'2026-11-03T09:00:00Z')]}];
  const s={kletterer:gipfel({art:'gipfel',spieler:spieler.map(s=>s.id)},spieler,{start:'2026-11-02',ziel:100})};
  expect(api.gipfelAnkuenfte(s)).toEqual(['c','b']);expect(api.gipfelAnteil(s.kletterer.find(k=>k.id==='a'))).toBe(.985);
 });
 it('bestätigt die erste Gipfelankunft beim Training schon während der Woche',()=>{
  const alt=stand(k('a',.7)),neu=stand(k('a',1,'2026-11-03T10:00:00Z'));
  expect(api.gipfelWechsel(alt,{art:'training',stand:neu})).toMatchObject({korrektur:false,training:true,steigt:['a'],ankunft:['a']});
 });
 it('erfindet beim weiteren Training am Gipfel keinen zweiten Zieleinlauf',()=>{
  const a=k('a',1,'2026-11-03T10:00:00Z'),b={...a,last:160};
  expect(api.gipfelWechsel(stand(a),{art:'training',stand:stand(b)})).toMatchObject({training:true,steigt:[],ankunft:[]});
 });
 it('entfernt nach einer Löschung die Fahne ruhig ohne Fall oder neuen Jubel',()=>{
  expect(api.gipfelWechsel(stand(k('a',1,'2026-11-03T10:00:00Z')),{art:'korrektur',stand:stand(k('a',.2))})).toMatchObject({korrektur:true,training:false,ankunft:[],steigt:[]});
  expect(api.gipfelWechsel(stand(k('a',.8)),{art:'training',stand:stand(k('a',.3))}).korrektur).toBe(true);
 });
 it('behandelt veränderte Zielwerte und korrigierte Ankunftszeiten als Korrektur',()=>{
  const a=stand(k('a',.5));expect(api.gipfelWechsel(a,{art:'training',stand:{...a,ziel:50}}).korrektur).toBe(true);
  expect(api.gipfelWechsel(stand(k('a',1,'2026-11-03T10:00:00Z')),{art:'tag',stand:stand(k('a',1,'2026-11-03T11:00:00Z'))}).korrektur).toBe(true);
 });
 it('stellt den Anteil auf demselben monoton steigenden Bergpfad dar',()=>{
  const anfang=api.gipfelWeg(0),ende=api.gipfelWeg(1);expect(anfang.y).toBe(92.5);expect(ende.y).toBeCloseTo(12.4);
  let y=100;for(let i=0;i<=100;i++){const p=api.gipfelWeg(i/100);expect(p.y).toBeLessThanOrEqual(y);expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(100);y=p.y;}
 });
 it('behält bei gleichem Fortschritt jeden der 80 Spieler sichtbar und ohne überlappende Körper',()=>{
  for(const fortschritt of [0,.5,1])for(const breite of [270,330,448]){
   const spieler=Array.from({length:80},(_,i)=>({id:String(i),name:'Alex',ich:i===79})),s=stand(...spieler.map(sp=>k(sp.id,fortschritt,fortschritt===1?'2026-11-03T10:00:00Z':null))),hoehe=breite*1.25;
   const plan=api.gipfelPositionen(s,spieler,breite,hoehe);expect(plan.size).toBe(80);const boxen=[];
   for(const p of plan.values()){const x=p.x/100*breite,y=p.y/100*hoehe,box={l:x-p.w/2,r:x+p.w/2,t:y-p.w*1.5,b:y};expect(box.l).toBeGreaterThanOrEqual(0);expect(box.r).toBeLessThanOrEqual(breite);expect(box.t).toBeGreaterThanOrEqual(0);expect(box.b).toBeLessThanOrEqual(hoehe);for(const b of boxen)expect(box.l<b.r&&box.r>b.l&&box.t<b.b&&box.b>b.t).toBe(false);boxen.push(box);}
  }
 });
 it('stellt eine einzelne bestätigte Ankunft auf die Gipfelplattform statt eine Reihe darunter',()=>{
  const plan=api.gipfelPositionen(stand(k('a',1,'2026-11-03T10:00:00Z')),[{id:'a'}],330,412.5);
  expect(plan.get('a').y).toBeLessThan(15);expect(plan.get('a').x).toBeGreaterThan(48);
 });
 it('setzt den eigenen Spieler auch in einer großen Gruppe auf einen sichtbaren Platz',()=>{
  const spieler=Array.from({length:30},(_,i)=>({id:String(i),ich:i===29})),s=stand(...spieler.map(sp=>k(sp.id,.5)));
  const plan=api.gipfelPositionen(s,spieler,270,337.5);expect(plan.has('29')).toBe(true);expect(new Set([...plan.values()].map((p:{x:number;y:number})=>p.x+':'+p.y)).size).toBe(30);
 });
 it('animiert auch große Aufstiege entlang der Serpentinen und hält die Endpunkte',()=>{
  const vor={...api.gipfelWeg(0),p:0},nach={...api.gipfelWeg(1),p:1},frames=api.gipfelSchritte(vor,nach);
  expect(frames.length).toBeGreaterThan(100);expect(parseFloat(frames[0].top)).toBeCloseTo(vor.y);expect(parseFloat(frames.at(-1).top)).toBeCloseTo(nach.y);
  for(let i=1;i<frames.length;i++)expect(Math.abs(parseFloat(frames[i].left)-parseFloat(frames[i-1].left))).toBeLessThan(10);
 });
 it('wechselt die vier gezeichneten Phasen als geschlossene Schleife',()=>{
  const frames=api.gipfelZyklus();expect(frames).toHaveLength(5);expect(new Set(frames.map((f:{transform:string})=>f.transform)).size).toBe(4);expect(frames[0].transform).toBe(frames.at(-1).transform);expect(frames.every((f:{easing:string})=>f.easing==='steps(1,end)')).toBe(true);
 });
 it('setzt nur neue Stationen fort und erkennt eine geänderte Chronologie',()=>{
  expect(api.gipfelFortsetzung(['a','b'],['a','b','c'])).toBe(1);expect(api.gipfelFortsetzung(['a','b'],['a','c'])).toBe(0);expect(api.gipfelFortsetzung(['a','b'],['a','b'])).toBeNull();
  const a={art:'training',zeitpunkt:'a',stand:stand(k('a',.4))};expect(api.gipfelSignaturen([a])).toEqual(api.gipfelSignaturen([{...a,zeitpunkt:'b'}]));
 });
 it('rendert bei einer leeren Expedition keine erfundenen Teilnehmer',()=>{expect(api.gipfelPositionen(stand(),[],270,337.5).size).toBe(0);expect(api.gipfelAnkuenfte(stand())).toEqual([]);});
});
