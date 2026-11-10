import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import {Resvg} from '@resvg/resvg-js';
import {bossReaktionen,bossReaktionsMedium} from './reaktionen.js';
import {schweinehundSequenzen} from './schweinehund-animationen.js';
import {BOSS_NAMEN} from '../scoring/boss.js';

describe('Sequenzen ausschließlich für Schweinehund Stufe 1',()=>{
 it('liefert optionale Sequenzen nur für die gewünschte Form',()=>{
  expect(bossReaktionen('Der innere Schweinehund',1)?.sequenzen).toEqual(schweinehundSequenzen());
  for(const name of BOSS_NAMEN)for(const stufe of [1,2] as const)if(name!=='Der innere Schweinehund'||stufe!==1)expect(bossReaktionen(name,stufe)).not.toHaveProperty('sequenzen');
 });
 it('begrenzt und versioniert jeden transparenten 2×2-Atlas auf 100 KB',()=>{
  for(const [name,s]of Object.entries(schweinehundSequenzen())){
   const datei=s.atlas.split('/').at(-1)!,b=bossReaktionsMedium(datei)!;expect(b).not.toBeNull();expect(b.length).toBeLessThanOrEqual(102400);
   expect(datei).toBe('schweinehund1-'+name+'-'+createHash('sha256').update(b).digest('hex').slice(0,12)+'.png');expect([b.readUInt32BE(16),b.readUInt32BE(20)]).toEqual([512,512]);
   const pixel=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><image href="data:image/png;base64,${b.toString('base64')}" width="512" height="512"/></svg>`).render().pixels,hashes=[];
   for(let i=0;i<4;i++){const x=i%2*256,y=Math.floor(i/2)*256,cell=Buffer.concat(Array.from({length:256},(_,j)=>pixel.subarray(((y+j)*512+x)*4,((y+j)*512+x+256)*4)));hashes.push(createHash('sha256').update(cell).digest('hex'));expect(cell[3]).toBe(0);expect(cell.some((n,j)=>j%4===3&&n>128)).toBe(true);}
   expect(new Set(hashes).size).toBe(4);
   for(const f of s.bilder){expect(f.x+256).toBeLessThanOrEqual(512);expect(f.y+256).toBeLessThanOrEqual(512);expect(f.dauer).toBeGreaterThan(0);}
  }
  for(const f of ['../schweinehund.png','schweinehund1-auftritt.png','schweinehund1-auftritt-falsch.png'])expect(bossReaktionsMedium(f)).toBeNull();
 });
 it('hält den Auftritt kurz und vollständig',()=>{expect(schweinehundSequenzen().auftritt!.bilder).toHaveLength(4);expect(schweinehundSequenzen().auftritt!.bilder.reduce((n,f)=>n+f.dauer,0)).toBe(1800);});
});
