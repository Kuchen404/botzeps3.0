// node scripts/zombie-angriffe-optimieren.mjs quellen.json — Figurenschlüssel auf Original-PNG.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const quellen=JSON.parse(readFileSync(process.argv[2],'utf8')),temp=mkdtempSync(join(tmpdir(),'zombie-angriffe-'));
const magick=(...a)=>execFileSync('magick',a,{encoding:'utf8'}).trim(),atlas={};
try {
 for(const [key,quelle] of Object.entries(quellen)){
  const [w,h]=magick('identify','-format','%w %h',quelle).split(' ').map(Number),zellen=[];
  if(w%2||h%2)throw Error('2×2-Atlas erforderlich: '+key);
  for(let i=0;i<4;i++){
   const datei=join(temp,key+'-'+i+'.png');magick(quelle,'-crop',`${w/2}x${h/2}+${i%2*w/2}+${Math.floor(i/2)*h/2}`,'+repage',datei);
   // Entfernt isolierte Reste einer Nachbarzelle, ohne die gezeichnete Figur zu verändern.
   const objekte=magick(datei,'-alpha','extract','-threshold','8%','-define','connected-components:verbose=true','-connected-components','8','null:');
   const box=objekte.split('\n').find(zeile=>/srgb\(255,255,255\)/.test(zeile))?.match(/(\d+x\d+\+\d+\+\d+)/)?.[1];
   const m=/^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(box||'');if(!m||!+m[1])throw Error('Leere Pose '+key);
   magick(datei,'-crop',box,'+repage','-background','none','-gravity','northwest','-splice',m[3]+'x'+m[4],'-extent',`${w/2}x${h/2}`,datei);
   zellen.push({datei,w:+m[1],h:+m[2],x:+m[3],y:+m[4]});
  }
  const links=Math.min(...zellen.map(z=>z.x)),rechts=Math.max(...zellen.map(z=>z.x+z.w)),oben=Math.min(...zellen.map(z=>z.y)),breite=rechts-links,hoehe=Math.max(...zellen.map(z=>z.y+z.h-oben)),mass=Math.min(180/breite,242/hoehe);
  for(const z of zellen){const h=z.y+z.h-oben;magick(z.datei,'-crop',`${breite}x${h}+${links}+${oben}`,'+repage','-resize',`${Math.round(breite*mass)}x${Math.round(h*mass)}!`,'-background','none','-gravity','south','-extent','200x282','-gravity','north','-extent','200x300',z.datei);}
  const out=join(temp,'atlas-'+key+'.png');magick('montage',...zellen.map(z=>z.datei),'-tile','2x2','-geometry','200x300+0+0','-background','none',out);magick(out,'-strip','-colors','224','-define','png:compression-level=9',out);
  if(readFileSync(out).length>102400)magick(out,'-colors','128','-define','png:compression-level=9',out);
  const bytes=readFileSync(out);if(bytes.length>102400)throw Error('Atlas zu groß: '+key);
  const name='zombie-angriff-'+key+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.png';writeFileSync(new URL('../src/figuren/medien/'+name,import.meta.url),bytes);atlas[key]=name;console.log(key+': '+bytes.length+' Bytes');
 }
 writeFileSync(new URL('../src/figuren/zombie-angriffe.ts',import.meta.url),'// 2×2: Ausholen, Vorstoß, Schnappen, Rückstoß. Alle Phasen schauen nativ nach rechts.\nexport const ZOMBIE_ANGRIFFE: Readonly<Record<string,string>> = '+JSON.stringify(atlas,null,2)+';\n');
}finally{rmSync(temp,{recursive:true,force:true});}
