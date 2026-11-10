// node scripts/schweinehund-optimieren.mjs auftritt original.png
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';
const [art,quelle]=process.argv.slice(2);if(!/^(auftritt|ruhe|treffer|zustand|niederlage)$/.test(art||'')||!quelle)throw Error('Art und Original-PNG angeben.');
const temp=mkdtempSync(join(tmpdir(),'schweinehund-')),magick=(...a)=>execFileSync('magick',a,{encoding:'utf8'}).trim();
try{
 let [w,h]=magick('identify','-format','%w %h',quelle).split(' ').map(Number);const zellen=[],arbeit=join(temp,'original.png');
 w+=w%2;h+=h%2;magick(quelle,'-background','none','-gravity','northwest','-extent',`${w}x${h}`,arbeit);
 for(let i=0;i<4;i++){
  const datei=join(temp,i+'.png');magick(arbeit,'-crop',`${w/2}x${h/2}+${i%2*w/2}+${Math.floor(i/2)*h/2}`,'+repage',datei);
  const objekte=magick(datei,'-alpha','extract','-threshold','8%','-define','connected-components:verbose=true','-connected-components','8','null:');
  const box=objekte.split('\n').find(z=>/srgb\(255,255,255\)/.test(z))?.match(/(\d+x\d+\+\d+\+\d+)/)?.[1],m=/^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(box||'');if(!m||!+m[1])throw Error('Leere Pose.');
  magick(datei,'-crop',box,'+repage','-background','none','-gravity','northwest','-splice',m[3]+'x'+m[4],'-extent',`${w/2}x${h/2}`,datei);
  zellen.push({datei,w:+m[1],h:+m[2],x:+m[3],y:+m[4]});
 }
 const links=Math.min(...zellen.map(z=>z.x)),rechts=Math.max(...zellen.map(z=>z.x+z.w)),oben=Math.min(...zellen.map(z=>z.y)),breite=rechts-links,hoehe=Math.max(...zellen.map(z=>z.y+z.h-oben)),mass=Math.min(210/breite,184/hoehe);
 for(const z of zellen){const h=z.y+z.h-oben;magick(z.datei,'-crop',`${breite}x${h}+${links}+${oben}`,'+repage','-resize',`${Math.round(breite*mass)}x${Math.round(h*mass)}!`,'-background','none','-gravity','south','-extent','256x250','-gravity','north','-extent','256x256',z.datei);}
 const out=join(temp,'atlas.png');magick('montage',...zellen.map(z=>z.datei),'-tile','2x2','-geometry','256x256+0+0','-background','none',out);magick(out,'-strip','-colors','224','-define','png:compression-level=9',out);
 if(readFileSync(out).length>102400)magick(out,'-colors','128','-define','png:compression-level=9',out);
 const bytes=readFileSync(out);if(bytes.length>102400)throw Error('Atlas über 100 KB.');
 const datei='schweinehund1-'+art+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.png';writeFileSync(new URL('../src/boss/medien/'+datei,import.meta.url),bytes);
 const modul=new URL('../src/boss/schweinehund-atlanten.ts',import.meta.url),text=readFileSync(modul,'utf8'),alt=JSON.parse(text.match(/= (\{[\s\S]*\});/)[1]);alt[art]=datei;
 writeFileSync(modul,'/** Versionierte Sequenzatlanten ausschließlich für Schweinehund Stufe 1. */\nexport const SCHWEINEHUND_ATLANTEN: Readonly<Record<string, string>> = '+JSON.stringify(alt,null,2)+';\n');console.log(datei+' · '+bytes.length+' Bytes');
}finally{rmSync(temp,{recursive:true,force:true});}
