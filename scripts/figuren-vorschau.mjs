import {readFileSync, writeFileSync} from 'node:fs';
import {FIGUREN, figurSvg} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';
import {bossSvg} from '../dist/boss/figur.js';

const posen=['bereit','schlag','jubel','ko','ziehen','klettern'];
const medien=Object.fromEntries(ATLAS_DATEIEN.map(datei=>[datei,`data:image/png;base64,${figurMedium(datei).toString('base64')}`]));
const figuren=FIGUREN.map((f,nr)=>({nr,name:f.name,posen:Object.fromEntries(posen.map(p=>[p,figurSvg(f,p,{id:`v${nr}${p}`})])),zombie:figurSvg(f,'ko',{id:`z${nr}`,zombie:true})}));
const app=readFileSync(new URL('../src/miniapp/app.html',import.meta.url),'utf8');
const css=app.slice(app.indexOf('<style>')+7,app.indexOf('</style>'));
const html=`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Spielerfiguren</title><style>${css}
body{max-width:1080px;margin:auto;padding:24px;background:#101522;color:#f4eef7;--bg2:#20283b;--text:#f4eef7;--hint:#b8adc8}
h1{font-size:28px;margin:0}p{color:#b8adc8}.kopf{display:flex;align-items:center;gap:16px}.kopf>svg{width:120px;height:120px;flex-shrink:0}.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:24px 0}select,button{font:inherit;padding:10px;min-height:44px;border-radius:8px;background:#20283b;color:#f4eef7;border:1px solid #665576}.raster{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}.karte{padding:18px;border-radius:16px;background:#20283b;border:1px solid #3b3750}.karte h2{font-size:17px;margin:0 0 12px}.grossfigur{width:120px;height:180px;margin:auto}.grossfigur>svg{width:120px;height:180px}.posen{display:grid;grid-template-columns:repeat(6,1fr);margin-top:12px}.mini{width:42px;height:63px}.mini>svg{width:42px;height:63px}.label{font-size:9px;display:block;text-align:center;color:#b8adc8}.mini::before{display:none}
</style><div class="kopf">${bossSvg('König Bierbauch',2)}<div><h1>Botzeps · Spielerfiguren</h1><p>Zwölf Kämpfer im Stil der Arcade-Bosse · alle sechs Posen</p></div></div><div class="controls"><label>Pose <select id="pose">${posen.map(p=>`<option>${p}</option>`).join('')}<option>zombie</option></select></label><button id="ablauf">Kampfablauf abspielen</button><span id="status" aria-live="polite"></span></div><div class="raster" id="raster"></div><script>
const figuren=${JSON.stringify(figuren)},medien=${JSON.stringify(medien)},posen=${JSON.stringify(posen)};
function bild(svg){return svg.replace(/href="\\/app\\/figuren\\/([^\"]+)"/g,(_,datei)=>'href="'+medien[datei]+'"');}
let timer=null;
function render(pose){document.getElementById('raster').innerHTML=figuren.map(f=>'<section class="karte"><h2>'+f.name+'</h2><div class="figur grossfigur" data-pose="'+pose+'">'+bild(pose==='zombie'?f.zombie:f.posen[pose])+'</div><div class="posen">'+posen.map(p=>'<div><div class="figur mini">'+bild(f.posen[p])+'</div><span class="label">'+p+'</span></div>').join('')+'</div></section>').join('');document.getElementById('status').textContent=pose;}
document.getElementById('pose').onchange=e=>{clearInterval(timer);render(e.target.value);};
document.getElementById('ablauf').onclick=()=>{clearInterval(timer);if(matchMedia('(prefers-reduced-motion:reduce)').matches){render('jubel');return;}let i=0;const ablauf=['bereit','schlag','bereit','schlag','jubel'];render(ablauf[i]);timer=setInterval(()=>{render(ablauf[++i]);if(i===ablauf.length-1)clearInterval(timer);},750);};
render('bereit');
</script></html>`;
new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
const target=process.argv[2] || 'figuren-vorschau.html';
writeFileSync(target,html);
console.log(target);
