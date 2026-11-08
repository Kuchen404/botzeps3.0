import {readFileSync, writeFileSync} from 'node:fs';
import {bossReaktionen, bossReaktionsMedium} from '../dist/boss/reaktionen.js';
import {bossSvg} from '../dist/boss/figur.js';
import {BOSS_NAMEN} from '../dist/scoring/boss.js';
import {FIGUREN, figurSvg} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';
const medien=Object.fromEntries(ATLAS_DATEIEN.map(datei=>[datei,`data:image/png;base64,${figurMedium(datei).toString('base64')}`]));
const figuren=Object.fromEntries([0,1,2,7].map(nr=>[nr,Object.fromEntries(['bereit','schlag','jubel','ko'].map(p=>[p,figurSvg(FIGUREN[nr],p,{id:`f${nr}${p}`})]))]));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>')) + readFileSync(new URL('../src/miniapp/spiele/bosskampf.css',import.meta.url),'utf8');
const helpers=app.slice(app.indexOf('function el('),app.indexOf('function zeile('));
const fight=app.slice(app.indexOf('var bossGezeigt'),app.indexOf('/** Mount Botzeps')) + readFileSync(new URL('../src/miniapp/spiele/bosskampf.js',import.meta.url),'utf8');
const reaktionen=BOSS_NAMEN.map(name=>[1,2].map(stufe=>bossReaktionen(name,stufe)));
const bossMedien=Object.fromEntries(reaktionen.flat().filter(Boolean).map(r=>[r.atlas,'data:image/png;base64,'+bossReaktionsMedium(r.atlas.split('/').at(-1)).toString('base64')]));
const drawings=BOSS_NAMEN.map(name=>[bossSvg(name,1),bossSvg(name,2)]);
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Arcade-Bosse</title><style>${css}
body{max-width:480px;margin:auto;padding:16px;background:#101522;color:#f4eef7;--bg:#101522;--bg2:#20283b;--text:#f4eef7;--hint:#b8adc8;--button:#9465d0;--button-text:white;--link:#c7a6ef}label{display:block;margin:10px 0}select,button{font:inherit;padding:10px;max-width:100%;min-height:44px}h1{font-size:24px}.controls{margin-bottom:16px}.note{font-size:12px;color:#b8adc8}
</style><h1>Botzeps · Arcade-Bosse</h1><p class="note">Lokale Vorschau mit Beispieldaten und der Kampflogik der Mini-App.</p><div class="controls"><label>Boss <select id="boss">${BOSS_NAMEN.map((name,i)=>`<option value="${i}">${name}</option>`).join('')}</select></label><label>Form <select id="stage"><option value="1">Stufe 1 · gemütlich</option><option value="2" selected>Stufe 2 · aufgepumpt</option></select></label><label><input type="checkbox" id="won"> Sieg zeigen</label></div><div id="demo"></div><script>${helpers}\n${fight}
const names=${JSON.stringify(BOSS_NAMEN)}, drawings=${JSON.stringify(drawings)}, reaktionen=${JSON.stringify(reaktionen)}, figuren=${JSON.stringify(figuren)};
const medien=${JSON.stringify(medien)}, bossMedien=${JSON.stringify(bossMedien)};
reaktionen.flat().filter(Boolean).forEach(r=>{const uri=bossMedien[r.atlas];r.treffer=r.treffer.replaceAll(r.atlas,uri);r.ko=r.ko.replaceAll(r.atlas,uri);r.atlas=uri;});
Object.values(figuren).forEach(posen=>Object.keys(posen).forEach(p=>{posen[p]=posen[p].replace(/href="\\/api\\/figurbild\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}));
function render(){const i=Number(document.getElementById('boss').value),stufe=Number(document.getElementById('stage').value),won=document.getElementById('won').checked;bossGezeigt={};bossAuftrittGezeigt={};document.getElementById('demo').replaceChildren(bossKarte({name:names[i],stufe,woche:4,bild:drawings[i][stufe-1],reaktion:reaktionen[i][stufe-1],lebenspunkte:2400,schaden:won?2600:1380,besiegt:won,aktiv:true,bonus:stufe===2?10:5,schwaeche:'Joggen',drueckeberger:['Horst'],pennen:[{name:'Horst',figur:7}],figuren,kaempfer:[{name:'Alex',schaden:won?1400:680,ich:true,figur:0},{name:'Sam',schaden:450,figur:1},{name:'Kim',schaden:won?750:250,figur:2}]}));}
['boss','stage','won'].forEach(id=>document.getElementById(id).addEventListener('change',render));render();</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2] || 'boss-vorschau.html';writeFileSync(target,html);console.log(target);
