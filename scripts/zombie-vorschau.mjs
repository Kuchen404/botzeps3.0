import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg} from '../dist/figuren/figuren.js';
import {ZOMBIE_BILDER} from '../dist/figuren/zombie-medien.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';

const nummern=[0,3,7,9,10];
const medien=Object.fromEntries([...nummern.map(nr=>ATLAS_DATEIEN[nr]),...Object.values(ZOMBIE_BILDER)].map(datei=>[datei,'data:image/png;base64,'+figurMedium(datei).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(nr=>[nr,Object.fromEntries(['bereit','schlag','ziehen','ko','jubel'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`zv${nr}${p}`})]))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','zombie.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const szene=['runtime.js','zombie.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Zombie-Woche</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101b18;color:#eef2da;--text:#eef2da;--hint:#adbdab;--bg2:#1d332c;--button:#c7e395;--button-text:#1b2e24}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#adbdab}
</style><h1>Botzeps · Zombie-Woche</h1><p class="note">Vorschau mit Beispieldaten und der echten Animationslogik der Mini-App.</p><label>Verlauf <select id="szenario"><option value="live">Freitag · Patient Null und Bisse</option><option value="ende">Wochenabschluss · ein Überlebender</option><option value="gruppe">Wochenabschluss · drei Überlebende</option><option value="alle">Wochenabschluss · alle infiziert</option><option value="korrektur">Nachgetragenes Training · Korrektur</option><option value="start">Fünf Menschen und Patient Null · wie im Screenshot</option><option value="gross">60 Spieler · lange Tribüne</option><option value="leer">Noch keine Spieler</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${szene}
const figuren=${JSON.stringify(figuren)}, medien=${JSON.stringify(medien)},ZOMBIE_BILDER=${JSON.stringify(ZOMBIE_BILDER)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 if(zombieAbbrechen)zombieAbbrechen();
 const modus=document.getElementById('szenario').value;
 let spieler=[{id:'p',name:'Peter',figur:3},{id:'k',name:'Kevin',figur:0,ich:true},{id:'m',name:'Mira',figur:7},{id:'l',name:'Lea',figur:9}];
 if(modus==='gruppe')spieler.push({id:'n',name:'Nora',figur:10});
 if(modus==='gross')spieler=Array.from({length:60},(_,i)=>({id:String(i),name:'Spieler '+(i+1),figur:i%7===0?null:[0,3,7,9,10][i%5],ich:i===59}));
 if(modus==='leer')spieler=[];
 const patient=spieler[0]?.id??null;
 function stand(ids){return{patientNull:patient,zombies:ids.map((id,i)=>({id,tag:i?1:0})),menschen:spieler.filter(p=>!ids.includes(p.id)).map(p=>p.id)};}
 const start=stand(patient?[patient]:[]), spaeter=stand(patient?[patient,spieler[2].id]:[]);
 let aktuell=stand(patient?[patient,spieler[2].id,spieler[3].id]:[]);
 let verlauf=[{zeitpunkt:'2026-10-19T07:00:00Z',art:'start',stand:start},{zeitpunkt:'2026-10-21T07:00:00Z',art:'tag',stand:spaeter},{zeitpunkt:'2026-10-23T07:00:00Z',art:'tag',stand:aktuell}];
 if(modus==='gruppe'){aktuell=spaeter;verlauf=verlauf.slice(0,2);}
 if(modus==='alle'){aktuell=stand(spieler.map(p=>p.id));verlauf[2].stand=aktuell;}
 if(modus==='korrektur'){aktuell=stand([patient,spieler[3].id]);verlauf.push({zeitpunkt:'2026-10-23T12:00:00Z',art:'korrektur',stand:aktuell});}
 if(modus==='start'){spieler=[{id:'p',name:'Couch-Carsten',figur:null},{id:'k',name:'Kevin',figur:0,ich:true},{id:'m',name:'Yoga-Yvonne',figur:null},{id:'l',name:'Hantel-Hans',figur:null},{id:'w',name:'Wackel-Willi',figur:null},{id:'f',name:'Pumper-Paul',figur:null}];aktuell={patientNull:'p',zombies:[{id:'p',tag:0}],menschen:spieler.filter(p=>p.id!=='p').map(p=>p.id)};verlauf=[{art:'start',zeitpunkt:'2026-10-19T07:00:00Z',stand:aktuell}];}
 if(modus==='leer'){aktuell=start;verlauf=verlauf.slice(0,1);}
 if(modus==='gross'){aktuell=stand([patient,'29','59']);verlauf=[verlauf[0],{zeitpunkt:'2026-10-23T07:00:00Z',art:'tag',stand:aktuell}];}
 const a={id:'zv'+ ++beispiel,art:'zombie',name:'Zombie-Woche',spieler,figuren,zombieBilder:Object.fromEntries(Object.entries(ZOMBIE_BILDER).map(([k,datei])=>[k,medien[datei]])),aktuell,verlauf,zeitzone:'Europe/Berlin',abgeschlossen:['ende','gruppe','alle'].includes(modus)};
 document.getElementById('demo').replaceChildren(window.MINISPIEL_SZENEN.zombie(a));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2]||'zombie-vorschau.html';writeFileSync(target,html);console.log(target);
