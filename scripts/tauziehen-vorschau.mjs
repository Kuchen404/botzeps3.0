import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';

const nummern=[0,3,7,9,10];
const medien=Object.fromEntries(nummern.map(nr=>[ATLAS_DATEIEN[nr],'data:image/png;base64,'+figurMedium(ATLAS_DATEIEN[nr]).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(nr=>[nr,Object.fromEntries(['bereit','ziehen','ko','jubel'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`tv${nr}${p}`})]))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','tauziehen.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const szene=['runtime.js','tauziehen.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Tauziehen</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#edf2e8;color:#304a43;--text:#304a43;--hint:#687b64;--bg2:#e1e9db;--button:#405d63;--button-text:#eef3df}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#687b64}
</style><h1>Botzeps · Tauziehen</h1><p class="note">Vorschau mit Beispieldaten und der echten Animationslogik der Mini-App.</p><label>Verlauf <select id="szenario"><option value="live">Laufend · drei Führungswechsel</option><option value="rechts">Wochenabschluss · Team Pizza gewinnt</option><option value="links">Wochenabschluss · Team Eisen gewinnt</option><option value="gleich">Wochenabschluss · Seilriss bei Gleichstand</option><option value="nullgleich">Wochenabschluss · Gleichstand ohne Training</option><option value="korrektur">Gelöschtes Training · Korrektur</option><option value="start">Spielstart · noch keine Last</option><option value="gross">80 Spieler · große Teams</option><option value="leer">Noch keine Spieler</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${szene}
const figuren=${JSON.stringify(figuren)}, medien=${JSON.stringify(medien)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 const modus=document.getElementById('szenario').value;
 let spieler=[{id:'k',name:'Kevin',figur:0,ich:true},{id:'p',name:'Peter',figur:3},{id:'m',name:'Mira',figur:7},{id:'l',name:'Lea',figur:9},{id:'n',name:'Nora',figur:10}];
 if(modus==='gross')spieler=Array.from({length:80},(_,i)=>({id:String(i),name:'Spieler '+(i+1),figur:i%7===0?null:[0,3,7,9,10][i%5],ich:i===79}));
 if(modus==='leer')spieler=[];
 const teams=modus==='gross'?[{name:'Team Eisen',mitglieder:spieler.slice(0,50).map(p=>p.id)},{name:'Team Pizza',mitglieder:spieler.slice(50).map(p=>p.id)}]:[{name:'Team Eisen',mitglieder:spieler.slice(0,3).map(p=>p.id)},{name:'Team Pizza',mitglieder:spieler.slice(3).map(p=>p.id)}];
 const lasten=Object.fromEntries(spieler.map(p=>[p.id,0]));
 function stand(){const schnitt=teams.map(t=>t.mitglieder.length?t.mitglieder.reduce((n,id)=>n+lasten[id],0)/t.mitglieder.length:0),summe=schnitt[0]+schnitt[1];return{teams,schnitt,zug:summe?(schnitt[0]-schnitt[1])/summe:0,lasten:{...lasten}};}
 let verlauf=[{zeitpunkt:'2026-10-19T07:00:00Z',art:'start',stand:stand()}];
 function zug(id,last,zeitpunkt,art='training'){lasten[id]=last;verlauf.push({zeitpunkt,art,stand:stand()});}
 if(modus==='gross'){zug('79',180,'2026-10-20T10:00:00Z');zug('0',180,'2026-10-21T10:00:00Z');}
 else if(!['leer','start','nullgleich'].includes(modus)){
  zug('k',120,'2026-10-19T10:00:00Z');zug('l',120,'2026-10-20T10:00:00Z');zug('p',120,'2026-10-21T10:00:00Z');zug('n',120,'2026-10-22T10:00:00Z');zug('m',40,'2026-10-23T10:00:00Z');
  if(modus==='links')zug('k',360,'2026-10-23T12:00:00Z');
  if(modus==='gleich')zug('m',120,'2026-10-23T12:00:00Z');
  if(modus==='korrektur')zug('n',0,'2026-10-23T12:00:00Z','korrektur');
 }
 const a={id:'tv'+ ++beispiel,art:'tauziehen',name:'Tauziehen',spieler,figuren,aktuell:stand(),verlauf,zeitzone:'Europe/Berlin',abgeschlossen:['rechts','links','gleich','nullgleich'].includes(modus)};
 document.getElementById('demo').replaceChildren(window.MINISPIEL_SZENEN.tauziehen(a));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2]||'tauziehen-vorschau.html';writeFileSync(target,html);console.log(target);
