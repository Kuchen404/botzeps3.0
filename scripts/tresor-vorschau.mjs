import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg, figurLaufSvg} from '../dist/figuren/figuren.js';
import {LAUF_ATLANTEN} from '../dist/figuren/lauf-atlanten.js';
import {TRESOR_BILDER} from '../dist/figuren/tresor-medien.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';

const nummern=[0,3,7,9,10];
const medien=Object.fromEntries([...nummern.map(nr=>ATLAS_DATEIEN[nr]),...nummern.map(nr=>LAUF_ATLANTEN[nr]),...Object.values(TRESOR_BILDER)].map(datei=>[datei,'data:image/png;base64,'+figurMedium(datei).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(nr=>[nr,Object.assign({laufen:figurLaufSvg(nr,'gvlauf'+nr)},Object.fromEntries(['bereit','schlag','ziehen','ko','jubel','klettern'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`kv${nr}${p}`})])))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','tresor.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const szene=['runtime.js','tresor.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Tresor-Coup</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101b18;color:#eef2da;--text:#eef2da;--hint:#adbdab;--bg2:#1d332c;--button:#c7e395;--button-text:#1b2e24}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#adbdab}
</style><h1>Botzeps · Tresor-Coup</h1><p class="note">Vorschau mit Beispieldaten und der echten Animationslogik der Mini-App.</p><label>Verlauf <select id="szenario"><option value="live">Freitag · Tresor geknackt</option><option value="ende">Wochenabschluss · Mission geschafft</option><option value="zu">Wochenabschluss · Tresor bleibt zu</option><option value="sprung">Ein Training löst mehrere Schlösser</option><option value="korrektur">Training gelöscht · Tresor wieder zu</option><option value="fast">Fast geschafft · vierte Ziffer fehlt</option><option value="gross">80 Spieler gemeinsam am Tresor</option><option value="start">Die Crew am ersten Tag</option><option value="leer">Noch keine Spieler</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${szene}
const figuren=${JSON.stringify(figuren)}, medien=${JSON.stringify(medien)}, TRESOR_BILDER=${JSON.stringify(TRESOR_BILDER)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 const modus=document.getElementById('szenario').value;
 let spieler=[{id:'p',name:'Peter',figur:3},{id:'k',name:'Kevin',figur:0,ich:true},{id:'m',name:'Mira',figur:7},{id:'l',name:'Lea',figur:9},{id:'n',name:'Nora',figur:10}];
 if(modus==='gross')spieler=Array.from({length:80},(_,i)=>({id:String(i),name:'Spieler '+(i+1),figur:i%7===0?null:[0,3,7,9,10][i%5],ich:i===79}));
 if(modus==='leer')spieler=[];
 function stand(lasten){const summe=Object.values(lasten).reduce((a,b)=>a+b,0),ziffern=Math.min(4,Math.floor(summe/800*4));return{ziel:800,summe,ziffern,offen:ziffern===4,code:[0,7,1,9].map((c,i)=>i<ziffern?c:'_').join(' '),lasten};}
 let werte=[{}, {p:100}, {p:100,k:120}, {p:300,k:120}, {p:300,k:280}, {p:300,k:280,m:120}, {p:300,k:280,m:120,l:100}];
 if(modus==='zu'||modus==='fast')werte=werte.slice(0,-1);
 if(modus==='start'||modus==='leer')werte=werte.slice(0,1);
 if(modus==='sprung')werte=[{}, {k:800}];
 if(modus==='gross')werte=[{},Object.fromEntries(spieler.map((sp,i)=>[sp.id,i%4*8]))];
 let verlauf=werte.map((lasten,i)=>({art:i?'training':'start',zeitpunkt:'2026-10-'+(19+Math.floor(i/2))+'T'+(10+i)+':00:00Z',stand:stand(lasten)}));
 if(modus==='korrektur')verlauf.push({art:'korrektur',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand({p:300,k:280,m:120})});
 const aktuell=verlauf.at(-1).stand;
 const a={id:'tv'+ ++beispiel,art:'tresor',name:'Tresor',spieler,figuren,tresorBilder:Object.fromEntries(Object.entries(TRESOR_BILDER).map(([k,datei])=>[k,medien[datei]])),aktuell,verlauf,zeitzone:'Europe/Berlin',abgeschlossen:['ende','zu'].includes(modus)};
 document.getElementById('demo').replaceChildren(window.MINISPIEL_SZENEN.tresor(a));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2]||'tresor-vorschau.html';writeFileSync(target,html);console.log(target);
