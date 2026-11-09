// ImageGen-Laufzyklen für die Mini-App komprimieren; Quellen bleiben unverändert.
// Aufruf: node scripts/lauf-optimieren.mjs quellen.json canyon.png
// quellen.json: zwölf Objekte {nr,path}; ImageMagick 7 erforderlich.
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const quellen=JSON.parse(readFileSync(process.argv[2],'utf8'));
if(quellen.length!==12||new Set(quellen.map(q=>q.nr)).size!==12||quellen.some(q=>!Number.isInteger(q.nr)||q.nr<0||q.nr>11))throw new Error('Zwölf eindeutige Figuren 0–11 erforderlich.');
const temp=mkdtempSync(join(tmpdir(),'botzeps-lauf-')),ziel=new URL('../src/figuren/medien/',import.meta.url),dateien=[];
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
  // Kontaktphasen 0/2 erhalten dieselbe Höhe. Ihre jeweilige Flugphase behält
  // denselben Maßstab und sitzt am Kopf ausgerichtet höher über dem Boden.
  const maximalBreit=184/Math.max(...zellen.map(z=>z.w));
  for(let i=0;i<4;i++){
   const z=zellen[i],mass=Math.min(maximalBreit,224/zellen[i<2?0:2].h),rw=Math.round(z.w*mass),rh=Math.round(z.h*mass),top=i%2?60:62;
   magick(z.datei,'-crop',z.box,'+repage','-resize',`${rw}x${rh}!`,'-background','none','-gravity','north','-splice',`0x${top}`,'-extent','200x300',z.datei);
  }
  const atlas=join(temp,'atlas.png');magick('montage',...zellen.map(z=>z.datei),'-tile','2x2','-geometry','200x300+0+0','-background','none',atlas);
  magick(atlas,'-strip','-dither','None','-colors','224','-define','png:compression-level=9',atlas);dateien[nr]=speichern(atlas,'lauf-'+nr);
 }
 const kulisse=join(temp,'canyon.png');magick(process.argv[3],'-resize','960x320!','-strip','-dither','None','-colors','224','-define','png:compression-level=9',kulisse);
 const canyon=speichern(kulisse,'jagd-canyon');
 writeFileSync(new URL('../src/figuren/lauf-atlanten.ts',import.meta.url),'// Generiert mit scripts/lauf-optimieren.mjs. Vier Phasen je Atlas (2×2, 200×300).\nexport const LAUF_ATLANTEN: readonly string[] = '+JSON.stringify(dateien,null,2)+';\nexport const JAGD_KULISSE = '+JSON.stringify(canyon)+';\n');
}finally{rmSync(temp,{recursive:true,force:true});}
