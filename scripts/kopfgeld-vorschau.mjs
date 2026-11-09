import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';

const nummern=[0,3,7,9,10];
const medien=Object.fromEntries(nummern.map(nr=>[ATLAS_DATEIEN[nr],'data:image/png;base64,'+figurMedium(ATLAS_DATEIEN[nr]).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(nr=>[nr,Object.fromEntries(['bereit','schlag','ziehen','ko','jubel'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`kv${nr}${p}`})]))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','kopfgeld.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const szene=['runtime.js','kopfgeld.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Kopfgeldjagd</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101b18;color:#eef2da;--text:#eef2da;--hint:#adbdab;--bg2:#1d332c;--button:#c7e395;--button-text:#1b2e24}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#adbdab}
</style><h1>Botzeps · Kopfgeldjagd</h1><p class="note">Vorschau mit Beispieldaten und der echten Animationslogik der Mini-App.</p><label>Verlauf <select id="szenario"><option value="live">Freitag · Überholen und Gleichstand</option><option value="ende">Wochenabschluss · zwei erfolgreiche Jäger</option><option value="flucht">Wochenabschluss · entkommen</option><option value="gleich">Wochenabschluss · Gleichstand</option><option value="korrektur">Korrigierter Eintrag</option><option value="start">Spielstart</option><option value="gross">70 Jäger</option><option value="leer">Noch keine Spieler</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${szene}
const figuren=${JSON.stringify(figuren)}, medien=${JSON.stringify(medien)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 const modus=document.getElementById('szenario').value;
 let spieler=[{id:'p',name:'Peter',figur:3},{id:'k',name:'Kevin',figur:0,ich:true},{id:'m',name:'Mira',figur:7},{id:'l',name:'Lea',figur:9},{id:'n',name:'Nora',figur:10}];
 if(modus==='gross')spieler=Array.from({length:71},(_,i)=>({id:i?'j'+i:'p',name:'Spieler '+(i+1),figur:i%7===0?null:[0,3,7,9,10][i%5],ich:i===70}));
 if(modus==='leer')spieler=[];
 function stand(lasten){return{gejagter:spieler[0]?.id??null,gejagterLast:lasten.p||0,jaeger:spieler.filter(s=>s.id!=='p'&&(lasten[s.id]||0)>(lasten.p||0)).map(s=>s.id),lasten};}
 const werte=[{}, {p:120}, {p:120,k:80}, {p:120,k:140}, {p:140,k:140}, {p:140,k:140,m:160}, {p:140,k:180,m:160}];
 let verlauf=werte.map((l,i)=>({art:i?'training':'start',zeitpunkt:'2026-10-'+(19+Math.floor(i/2))+'T'+(10+i)+':00:00Z',stand:stand(l)}));
 if(modus==='flucht')verlauf.push({art:'training',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand({p:200,k:180,m:160})});
 if(modus==='gleich')verlauf.push({art:'training',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand({p:180,k:180,m:160})});
 if(modus==='korrektur')verlauf.push({art:'korrektur',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand({p:140,k:80,m:160})});
 if(modus==='start'||modus==='leer')verlauf=verlauf.slice(0,1);
 if(modus==='gross')verlauf=[verlauf[0],{art:'training',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand(Object.fromEntries(spieler.map((s,i)=>[s.id,i?100+i*2:140])))}];
 const aktuell=verlauf.at(-1).stand;
 const a={id:'kv'+ ++beispiel,art:'kopfgeld',name:'Kopfgeldjagd',spieler,figuren,aktuell,verlauf,zeitzone:'Europe/Berlin',abgeschlossen:['ende','flucht','gleich'].includes(modus)};
 document.getElementById('demo').replaceChildren(window.MINISPIEL_SZENEN.kopfgeld(a));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2]||'kopfgeld-vorschau.html';writeFileSync(target,html);console.log(target);
