import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {gzipSync} from 'node:zlib';
import {it,expect} from 'vitest';
const fluss=readFileSync(new URL('./spiele/boss-schweinehund-fluss.js',import.meta.url),'utf8');
const quelle=readFileSync(new URL('./spiele/boss-schweinehund.js',import.meta.url),'utf8');
const {bossSchweinNetzPunkt:punkt,bossSchweinBewegung:bewegung}=runInNewContext(fluss+'\n'+quelle+';({bossSchweinNetzPunkt,bossSchweinBewegung})') as {
 bossSchweinNetzPunkt:(x:number,y:number,p:Record<string,number>)=>number[];
 bossSchweinBewegung:(name:string,zeit:number,anteil:number,wucht:number)=>Record<string,number>;
};
it('verformt Kopf und Ohren kontinuierlich bei unverändertem Standpunkt',()=>{
 const a=bewegung('zustandSelbstsicher',600,.2,1),b=bewegung('zustandSelbstsicher',650,.25,1);
 expect(punkt(128,250,a)).toEqual([128,250]);expect(punkt(128,250,b)).toEqual([128,250]);
 const x=punkt(80,120,a),y=punkt(80,120,b);expect(x).not.toEqual(y);expect(Math.hypot(x[0]!-y[0]!,x[1]!-y[1]!)).toBeLessThan(3);
});
it('hält auch starke Treffer und alle Ruhebewegungen endlich und begrenzt',()=>{
 for(const name of ['auftritt','trefferGross','niederlage','zustandNervoes','zustandKnurren','schnueffeln','einnicken','ruheLinks'])for(let t=0;t<=1000;t+=50){
  const p=bewegung(name,t,t/1000,2);for(const [x,y]of [[128,250],[80,120],[175,125],[128,190]]){const q=punkt(x!,y!,p);expect(q.every(Number.isFinite)).toBe(true);expect(Math.hypot(q[0]!-x!,q[1]!-y!)).toBeLessThan(30);}
 }
});
it('erhöht den Bilddownload nicht und hält den komprimierten Renderer klein',()=>{
 const dir=new URL('../boss/medien/',import.meta.url);const dateien=readdirSync(dir).filter(f=>/^schweinehund1-.*\.png$/.test(f));
 expect(dateien).toHaveLength(5);expect(dateien.reduce((n,f)=>n+readFileSync(new URL(f,dir)).length,0)).toBe(199826);expect(gzipSync(quelle+fluss).length).toBeLessThan(10000);
});

it('verbindet Schlüsselposen mit kleinen begrenzten Bewegungsfeldern in beiden Richtungen',()=>{
 const api=runInNewContext(fluss+'\n'+quelle+';({bossSchweinFluss,bossSchweinFlussPunkt,bossSchweinFlussDaten})',{atob:(s:string)=>Buffer.from(s,'base64').toString('binary')}) as {bossSchweinFluss:(a:string,b:string)=>Int8Array[]|null;bossSchweinFlussPunkt:(a:Int8Array,x:number,y:number,w:number)=>number[];bossSchweinFlussDaten:Record<string,string[]>};
 for(const key of Object.keys(api.bossSchweinFlussDaten)){
  const [a,b]=key.split('|') as [string,string],paar=api.bossSchweinFluss(a,b)!,zurueck=api.bossSchweinFluss(b,a)!;
  expect(paar[0]).toHaveLength(162);expect(paar[1]).toHaveLength(162);expect([...zurueck[0]!]).toEqual([...paar[1]!]);
  for(const f of paar)for(const [x,y]of [[0,0],[128,117],[256,256]]){const v=api.bossSchweinFlussPunkt(f,x!,y!,1);expect(v.every(Number.isFinite)).toBe(true);expect(Math.max(...v.map(Math.abs))).toBeLessThanOrEqual(64);expect(api.bossSchweinFlussPunkt(f,x!,y!,0)).toEqual([0,0]);}
 }
 expect(api.bossSchweinFluss('alt','unbekannt')).toBeNull();
});
