// ImageGen-Kletterzyklen für die Mini-App komprimieren; Quellen bleiben unverändert.
// Aufruf: node scripts/berg-optimieren.mjs quellen.json bilder.json
// quellen.json: zwölf Objekte {nr,path}; ImageMagick 7 erforderlich.
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const quellen=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(quellen.length!==12||new Set(quellen.map(q=>q.nr)).size!==12||quellen.some(q=>!Number.isInteger(q.nr)||q.nr<0||q.nr>11))throw new Error('Zwölf eindeutige Figuren 0–11 erforderlich.');
const temp=mkdtempSync(join(tmpdir(),'botzeps-berg-')),ziel=new URL('../src/figuren/medien/',import.meta.url),dateien=[];
const magick=(...args)=>execFileSync('magick',args,{encoding:'utf8'}).trim();
function speichern(path,prefix){const bytes=readFileSync(path),name=prefix+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.png';writeFileSync(new URL(name,ziel),bytes);console.log(name+' · '+(bytes.length/1024).toFixed(1)+' KB');return name;}
try{
 for(const {nr,path} of quellen){
  const [w,h]=magick('identify','-format','%w %h',path).split(' ').map(Number);if(w%2||h%2)throw new Error('2×2-Raster erforderlich: '+path);
  const zellen=[];
  for(let i=0;i<4;i++){
   const datei=join(temp,nr+'-'+i+'.png');magick(path,'-crop',`${w/2}x${h/2}+${i%2*w/2}+${Math.floor(i/2)*h/2}`,'+repage',datei);
   const box=magick(datei,'-alpha','extract','-threshold','8%','-format','%@','info:');const m=/^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(box);if(!m||Number(m[1])===0)throw new Error('Leere Phase '+nr+'/'+i);zellen.push({datei,box,w:Number(m[1]),h:Number(m[2])});
  }
  // Alle Griffe und Tritte behalten innerhalb eines Avatars denselben Maßstab.
  const mass=Math.min(180/Math.max(...zellen.map(z=>z.w)),242/Math.max(...zellen.map(z=>z.h)));
  for(const z of zellen){
   magick(z.datei,'-crop',z.box,'+repage','-resize',`${Math.round(z.w*mass)}x${Math.round(z.h*mass)}!`,'-background','none','-gravity','north','-splice','0x40','-extent','200x300',z.datei);
  }
  const atlas=join(temp,'atlas.png');magick('montage',...zellen.map(z=>z.datei),'-tile','2x2','-geometry','200x300+0+0','-background','none',atlas);
  magick(atlas,'-strip','-dither','None','-colors','224','-define','png:compression-level=9',atlas);dateien[nr]=speichern(atlas,'berg-'+nr);
 }
 const bilder={};for(const [art,path]of Object.entries(JSON.parse(readFileSync(process.argv[3],'utf8')))){
  const bild=join(temp,art+'.png');magick(path,'-resize',art==='panorama'?'600x750!':'800x400!','-strip','-dither','None','-colors','224','-define','png:compression-level=9',bild);bilder[art]=speichern(bild,'berg-'+art);
 }
 writeFileSync(new URL('../src/figuren/berg-atlanten.ts',import.meta.url),'// Generiert mit scripts/berg-optimieren.mjs. Vier Kletterphasen je 2×2-Atlas.\nexport const BERG_ATLANTEN: readonly string[] = '+JSON.stringify(dateien,null,2)+';\nexport const BERG_BILDER = '+JSON.stringify(bilder,null,2)+' as const;\n');
}finally{rmSync(temp,{recursive:true,force:true});}
