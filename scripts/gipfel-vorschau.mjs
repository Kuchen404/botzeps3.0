import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg, figurLaufSvg, figurKletterSvg} from '../dist/figuren/figuren.js';
import {LAUF_ATLANTEN,JAGD_KULISSE} from '../dist/figuren/lauf-atlanten.js';
import {BERG_ATLANTEN,BERG_BILDER} from '../dist/figuren/berg-atlanten.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';

const nummern=[0,3,7,9,10];
const medien=Object.fromEntries([...nummern.map(nr=>ATLAS_DATEIEN[nr]),...nummern.map(nr=>LAUF_ATLANTEN[nr]),...nummern.map(nr=>BERG_ATLANTEN[nr]),...Object.values(BERG_BILDER)].map(datei=>[datei,'data:image/png;base64,'+figurMedium(datei).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(nr=>[nr,Object.assign({laufen:figurLaufSvg(nr,'gvlauf'+nr),steigen:figurKletterSvg(nr,'gvberg'+nr)},Object.fromEntries(['bereit','schlag','ziehen','ko','jubel','klettern'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`kv${nr}${p}`})])))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','gipfel.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const szene=['runtime.js','gipfel.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Gipfelsturm</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101b18;color:#eef2da;--text:#eef2da;--hint:#adbdab;--bg2:#1d332c;--button:#c7e395;--button-text:#1b2e24}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#adbdab}
</style><h1>Botzeps · Gipfelsturm</h1><p class="note">Vorschau mit Beispieldaten und der echten Animationslogik der Mini-App.</p><label>Verlauf <select id="szenario"><option value="live">Freitag · erste Gipfelankünfte</option><option value="ende">Wochenabschluss · Gipfelpanorama</option><option value="keiner">Wochenabschluss · niemand oben</option><option value="alle">Alle erreichen ihr Wochenziel</option><option value="korrektur">Korrigiertes Training · Fahne zurücknehmen</option><option value="fast">Fast oben · noch keine bestätigte Ankunft</option><option value="gross">80 Bergsteiger</option><option value="start">Aufbruch am Basislager</option><option value="leer">Noch keine Spieler</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${szene}
const figuren=${JSON.stringify(figuren)}, medien=${JSON.stringify(medien)}, BERG_BILDER=${JSON.stringify(BERG_BILDER)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 const modus=document.getElementById('szenario').value;
 let spieler=[{id:'p',name:'Peter',figur:3},{id:'k',name:'Kevin',figur:0,ich:true},{id:'m',name:'Mira',figur:7},{id:'l',name:'Lea',figur:9},{id:'n',name:'Nora',figur:10}];
 if(modus==='gross')spieler=Array.from({length:80},(_,i)=>({id:String(i),name:'Bergsteiger '+(i+1),figur:i%7===0?null:[0,3,7,9,10][i%5],ich:i===79}));
 if(modus==='leer')spieler=[];
 let zeiten={};
 function stand(lasten,zeit){
  const kletterer=spieler.map(sp=>{const last=lasten[sp.id]||0,anteil=Math.min(1,last/300);if(last>=300&&!zeiten[sp.id])zeiten[sp.id]=zeit;if(last<300)delete zeiten[sp.id];return{id:sp.id,last,anteil,hoehe:Math.round(anteil*884.8)*10,oben:zeiten[sp.id]||null};});
  kletterer.sort((a,b)=>a.oben&&b.oben?a.oben.localeCompare(b.oben):a.oben?-1:b.oben?1:b.anteil-a.anteil);return{ziel:300,kletterer};
 }
 let werte=[{}, {p:80}, {p:80,k:165}, {p:255,k:165}, {p:255,k:300}, {p:255,k:300,m:315}, {p:255,k:300,m:315,l:180}];
 if(modus==='keiner')werte=werte.slice(0,4);
 if(modus==='alle')werte.push({p:300,k:330,m:315,l:300,n:360});
 if(modus==='start'||modus==='leer')werte=werte.slice(0,1);
 if(modus==='gross')werte=[{},Object.fromEntries(spieler.map((sp,i)=>[sp.id,i%5*75]))];
 let verlauf=werte.map((lasten,i)=>{const zeit='2026-10-'+(19+Math.floor(i/2))+'T'+(10+i)+':00:00Z';return{art:i?'training':'start',zeitpunkt:zeit,stand:stand(lasten,zeit)};});
 if(modus==='korrektur')verlauf.push({art:'korrektur',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand({p:255,k:80,m:315,l:180},'2026-10-23T12:00:00Z')});
 if(modus==='fast'){const s=stand({p:299.999,k:165},'2026-10-23T12:00:00Z');s.kletterer.find(k=>k.id==='p').anteil=1;verlauf=[verlauf[0],{art:'training',zeitpunkt:'2026-10-23T12:00:00Z',stand:s}];}
 const aktuell=verlauf.at(-1).stand;
 const a={id:'gv'+ ++beispiel,art:'gipfel',name:'Gipfelsturm',spieler,figuren,bergBilder:Object.fromEntries(Object.entries(BERG_BILDER).map(([k,datei])=>[k,medien[datei]])),aktuell,verlauf,zeitzone:'Europe/Berlin',abgeschlossen:['ende','keiner','alle'].includes(modus)};
 document.getElementById('demo').replaceChildren(window.MINISPIEL_SZENEN.gipfel(a));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2]||'gipfel-vorschau.html';writeFileSync(target,html);console.log(target);
