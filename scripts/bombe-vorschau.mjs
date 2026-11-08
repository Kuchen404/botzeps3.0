import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';

const nummern=[0,3,7];
const medien=Object.fromEntries(nummern.map(nr=>[ATLAS_DATEIEN[nr],'data:image/png;base64,'+figurMedium(ATLAS_DATEIEN[nr]).toString('base64')]));
const figuren=Object.fromEntries(nummern.map(nr=>[nr,Object.fromEntries(['bereit','schlag','jubel','ko'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`bv${nr}${p}`})]))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'))+['runtime.css','bombe.css'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const grundlagen=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/* bossKarte'));
const szene=['runtime.js','bombe.js'].map(f=>readFileSync(new URL('../src/miniapp/spiele/'+f,import.meta.url),'utf8')).join('\n');
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Tickende Bombe</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101b1b;color:#f2f4df;--text:#f2f4df;--hint:#adbdab;--bg2:#1d332c;--button:#e7c37d;--button-text:#1b2e24}h1{font-size:24px}label{display:block;margin:16px 0}select{font:inherit;max-width:100%;padding:10px;min-height:44px}.note{font-size:12px;color:#adbdab}
</style><h1>Botzeps · Tickende Bombe</h1><p class="note">Vorschau mit Beispieldaten und der echten Animationslogik der Mini-App.</p><label>Verlauf <select id="szenario"><option value="live">Freitag · chronologischer Rückblick</option><option value="ende">Abgeschlossen · Explosion</option><option value="korrektur">Gelöschtes Training · Korrektur</option><option value="start">Spielstart · noch keine Übergabe</option><option value="gross">24 Spieler · lange Tribüne</option><option value="leer">Noch keine Spieler</option></select></label><main id="demo"></main><script>${helpers}\n${grundlagen}\n${szene}
const figuren=${JSON.stringify(figuren)}, medien=${JSON.stringify(medien)};
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
var beispiel=0;
function aktualisiereBombe(){render();}
function render(){
 const modus=document.getElementById('szenario').value;
 let spieler=[{id:'p',name:'Peter',figur:3},{id:'k',name:'Kevin',figur:0,ich:true},{id:'m',name:'Mira',figur:7}];
 let folge=['p','k','m','p','k'];
 if(modus==='gross'){spieler=Array.from({length:24},(_,i)=>({id:String(i),name:i===23?'Du':'Spieler '+(i+1),figur:i%4===0?null:[0,3,7][i%3],ich:i===23}));folge=['0','23','1','22','23'];}
 if(modus==='start')folge=['p'];
 if(modus==='leer'){spieler=[];folge=[];}
 const verlauf=folge.map((traeger,i)=>({traeger,zeitpunkt:'2026-10-'+(19+i)+'T08:00:00Z',art:i?'training':'start'}));
 if(modus==='korrektur')verlauf.push({traeger:'p',zeitpunkt:'2026-10-23T12:00:00Z',art:'korrektur'});
 const b={id:'vorschau'+ ++beispiel,spieler,figuren,traeger:verlauf.at(-1)?.traeger??null,verlauf,zeitzone:'Europe/Berlin'};
 document.getElementById('demo').replaceChildren(bombenSzene(b,modus==='ende'));
}
document.getElementById('szenario').addEventListener('change',render);render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2]||'bombe-vorschau.html';writeFileSync(target,html);console.log(target);
