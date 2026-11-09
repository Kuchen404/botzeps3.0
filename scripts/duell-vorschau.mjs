import {readFileSync,writeFileSync} from 'node:fs';
import {FIGUREN,figurSvg,figurLaufSvg} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {LAUF_ATLANTEN} from '../dist/figuren/lauf-atlanten.js';
import {DUELL_BILDER} from '../dist/figuren/duell-medien.js';
import {figurMedium} from '../dist/figuren/arcade.js';
const nummern=[0,3,7,9,10];
const medien=Object.fromEntries([...nummern.map(n=>ATLAS_DATEIEN[n]),...nummern.map(n=>LAUF_ATLANTEN[n]),...Object.values(DUELL_BILDER)].map(datei=>[datei,'data:image/png;base64,'+figurMedium(datei).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(n=>[n,Object.assign({laufen:figurLaufSvg(n,'dvlauf'+n)},Object.fromEntries(['bereit','schlag','jubel','ko','ziehen','klettern'].map(p=>[p,figurSvg(FIGUREN[n],p,{id:'dv'+n+p})])))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','duell.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const runtime=['runtime.js','duell.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Fight Night</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101b2b;color:#f8e8c6;--text:#f8e8c6;--hint:#b4c5d1;--bg2:#1d3048;--button:#e5bd79;--button-text:#172b42}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#b4c5d1}
</style><h1>Botzeps · Fight Night</h1><p class="note">Beispieldaten mit der echten Duell-Laufzeit der Mini-App. Die Paar-Karten wechseln den Ring.</p><label>Verlauf <select id="szenario"><option value="live">Freitag · Schlagabtausch und Führungswechsel</option><option value="ende">Wochenabschluss · Sieg und Niederlage</option><option value="remis">Wochenabschluss · Unentschieden</option><option value="bot">Botzeps gewinnt</option><option value="botbesiegt">Botzeps überholt</option><option value="korrektur">Training gelöscht · ruhige Korrektur</option><option value="gross">80 Spieler · 40 Duelle</option><option value="ersatz">Fehlende Figuren und sichere Namen</option><option value="start">Erster Auftritt · noch keine Last</option><option value="leer">Noch keine Paare</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${runtime}
const figuren=${JSON.stringify(figuren)},medien=${JSON.stringify(medien)},DUELL_BILDER=${JSON.stringify(DUELL_BILDER)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 if(duellAbbrechen)duellAbbrechen();
 const mode=document.getElementById('szenario').value;
 let spieler=[{id:'k',name:'Kevin',figur:0,ich:true},{id:'p',name:'Peter',figur:3},{id:'m',name:'Mira',figur:7},{id:'l',name:'Lea',figur:9},{id:'n',name:'Nora',figur:10},{id:'bot',name:'Botzeps',figur:null}];
 let paare=[['k','p'],['m','l'],['n','bot']],werte=[{}, {p:100}, {p:100,k:120}, {p:180,k:120}, {p:180,k:180}, {p:180,k:180,m:80}, {p:180,k:180,m:80,l:100}, {p:180,k:180,m:80,l:100,n:320}];
 if(mode==='ende')werte.push({p:180,k:230,m:80,l:100,n:320});
 if(mode==='bot'||mode==='botbesiegt'){spieler.forEach(s=>s.ich=s.id==='n');werte=[{}, {n:100}, {n:mode==='bot'?280:320}];}
 if(mode==='start')werte=[{}];
 if(mode==='gross'){spieler=Array.from({length:80},(_,i)=>({id:String(i),name:'Spieler '+i,figur:i%7===0?null:[0,3,7,9,10][i%5],ich:i===79}));paare=Array.from({length:40},(_,i)=>[String(i*2),String(i*2+1)]);werte=[{},Object.fromEntries(spieler.map((s,i)=>[s.id,i%4*50]))];}
 if(mode==='ersatz'){spieler.forEach((s,i)=>{s.figur=null;s.name=i<2?'Alex':i===2?'<script>alert(1)<'+ '/script>':s.name;});}
 if(mode==='leer'){spieler=[];paare=[];werte=[{}];}
 function stand(lasten){return{paare:paare.map(([a,b])=>({a,b,lastA:a==='bot'?300:lasten[a]||0,lastB:b==='bot'?300:lasten[b]||0}))};}
 let verlauf=werte.map((lasten,i)=>({art:i?'training':'start',zeitpunkt:'2026-10-'+(19+Math.floor(i/2))+'T'+(10+i)+':00:00Z',stand:stand(lasten)}));
 if(mode==='korrektur')verlauf.push({art:'korrektur',zeitpunkt:'2026-10-23T12:00:00Z',stand:stand({k:40,p:180,m:80,l:100,n:320})});
 const aktuell=verlauf.at(-1).stand;
 const a={id:'dv'+ ++beispiel,art:'duell',name:'Losduell',spieler,figuren,duellBilder:Object.fromEntries(Object.entries(DUELL_BILDER).map(([k,datei])=>[k,medien[datei]])),aktuell,verlauf,zeitzone:'Europe/Berlin',abgeschlossen:['ende','remis','bot'].includes(mode)};
 document.getElementById('demo').replaceChildren(window.MINISPIEL_SZENEN.duell(a));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);const target=process.argv[2]||'duell-vorschau.html';writeFileSync(target,html);console.log(target);
