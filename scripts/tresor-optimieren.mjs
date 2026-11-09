// node scripts/tresor-optimieren.mjs quellen.json — {raum:path,tresor:path,innen:path}
// ImageMagick 7; Originale bleiben unverändert. Die SVG-Geometrie erwartet das bestehende Motiv.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const quellen=JSON.parse(readFileSync(process.argv[2],'utf8'));
const temp=mkdtempSync(join(tmpdir(),'botzeps-tresor-')),bilder={};
try{
 for(const [art,format]of Object.entries({raum:'600x750!',tresor:'400x500!',innen:'300x375!'})){
  if(typeof quellen[art]!=='string')throw new Error('Bildquelle fehlt: '+art);
  const ziel=join(temp,art+'.png');
  execFileSync('magick',[quellen[art],'-resize',format,'-strip','-colors','224','-define','png:compression-level=9',ziel]);
  const bytes=readFileSync(ziel),name='tresor-'+art+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.png';
  writeFileSync(new URL('../src/figuren/medien/'+name,import.meta.url),bytes);bilder[art]=name;console.log(name+' · '+bytes.length+' Bytes');
 }
 const modul=new URL('../src/figuren/tresor-medien.ts',import.meta.url);
 writeFileSync(modul,readFileSync(modul,'utf8').replace(/export const TRESOR_BILDER = [\s\S]*? as const;/,'export const TRESOR_BILDER = '+JSON.stringify(bilder,null,2)+' as const;'));
}finally{rmSync(temp,{recursive:true,force:true});}
