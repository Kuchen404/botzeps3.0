// node scripts/duell-optimieren.mjs quellen.json — {ring:path,bot:path}; ImageMagick 7.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const quellen=JSON.parse(readFileSync(process.argv[2],'utf8')),temp=mkdtempSync(join(tmpdir(),'botzeps-duell-'));
const magick=(...a)=>execFileSync('magick',a,{encoding:'utf8'}).trim();
function speichern(path,art){const bytes=readFileSync(path),name='duell-'+art+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.png';writeFileSync(new URL('../src/figuren/medien/'+name,import.meta.url),bytes);console.log(name+' · '+bytes.length+' Bytes');return name;}
try{
 const ring=join(temp,'ring.png');magick(quellen.ring,'-resize','600x750!','-strip','-colors','224','-define','png:compression-level=9',ring);
 const [w,h]=magick('identify','-format','%w %h',quellen.bot).split(' ').map(Number);if(w%2||h%2)throw new Error('2×2-Botatlas erforderlich.');
 const zellen=[];
 for(let i=0;i<4;i++){
  const datei=join(temp,'bot-'+i+'.png');magick(quellen.bot,'-crop',`${w/2}x${h/2}+${i%2*w/2}+${Math.floor(i/2)*h/2}`,'+repage',datei);
  const box=magick(datei,'-alpha','extract','-threshold','8%','-format','%@','info:'),m=/^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(box);if(!m||+m[1]===0)throw new Error('Leere Botpose.');zellen.push({datei,box,w:+m[1],h:+m[2]});
 }
 const mass=Math.min(178/Math.max(...zellen.map(z=>z.w)),242/Math.max(...zellen.map(z=>z.h)));
 for(const z of zellen)magick(z.datei,'-crop',z.box,'+repage','-resize',`${Math.round(z.w*mass)}x${Math.round(z.h*mass)}!`,'-background','none','-gravity','south','-extent','200x282','-gravity','north','-extent','200x300',z.datei);
 const bot=join(temp,'bot.png');magick('montage',...zellen.map(z=>z.datei),'-tile','2x2','-geometry','200x300+0+0','-background','none',bot);magick(bot,'-strip','-colors','224','-define','png:compression-level=9',bot);
 const bilder={ring:speichern(ring,'ring'),bot:speichern(bot,'bot')},modul=new URL('../src/figuren/duell-medien.ts',import.meta.url);
 writeFileSync(modul,readFileSync(modul,'utf8').replace(/export const DUELL_BILDER = [\s\S]*? as const;/,'export const DUELL_BILDER = '+JSON.stringify(bilder,null,2)+' as const;'));
}finally{rmSync(temp,{recursive:true,force:true});}
