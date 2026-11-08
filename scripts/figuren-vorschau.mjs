import {writeFileSync} from 'node:fs';
import {FIGUREN} from '../dist/figuren/figuren.js';
import {ATLAS_DATEIEN} from '../dist/figuren/atlanten.js';
import {figurMedium} from '../dist/figuren/arcade.js';
import {bossSvg} from '../dist/boss/figur.js';

// Die Chat-Vorschau führt kein JavaScript aus. Bilder stehen daher bereits im
// HTML; native Radiofelder und CSS übernehmen Posenwahl und Kampfablauf.
const posen=[
  ['bereit','Bereit',0,0], ['schlag','Schlag',1,0], ['jubel','Jubel',2,0],
  ['ko','K.o.',0,1], ['ziehen','Ziehen',1,1], ['klettern','Klettern',2,1],
  ['zombie','Zombie',0,1],
];
const bilder=ATLAS_DATEIEN.map(datei=>`data:image/png;base64,${figurMedium(datei).toString('base64')}`);
const auswahl=posen.map(([pose],i)=>`<input class="modus" type="radio" name="ansicht" id="pose-${pose}"${i===0?' checked':''}>`).join('');
const regler=posen.map(([pose,name])=>`<label class="pose" for="pose-${pose}">${name}</label>`).join('');
const regeln=posen.map(([pose,,x,y])=>`#pose-${pose}:checked~.raster{--tx:${x*-100/3}%;--ty:${y*-50}%;--filter:${pose==='zombie'?'sepia(1) saturate(1.8) hue-rotate(50deg)':'none'}}
#pose-${pose}:checked~.bedienung label[for="pose-${pose}"]{background:#654399;border-color:#c7a6ef;color:white}
#pose-${pose}:focus-visible~.bedienung label[for="pose-${pose}"]{outline:3px solid #ffcc00;outline-offset:3px}`).join('\n');
const karten=FIGUREN.map((f,nr)=>`<section class="karte"><h2>${f.name}</h2>
<div class="grossfigur"><img class="atlas" src="${bilder[nr]}" width="600" height="600" alt="${f.name} – gewählte Pose"></div>
<figure class="posenblatt"><img src="${bilder[nr]}" width="600" height="600" alt="${f.name}: oben Bereit, Schlag, Jubel; unten K.o., Ziehen, Klettern"><figcaption>Oben: Bereit · Schlag · Jubel<br>Unten: K.o. · Ziehen · Klettern</figcaption></figure></section>`).join('');
// Zwei identische Animationen mit eigenen Namen erlauben erneutes Starten per
// Radiofeld, ohne einen Klick-Handler oder ein Neuladen der Seite zu benötigen.
const kampf='0%,19%{transform:translate(0,0)}20%,35%{transform:translate(-33.333333%,0)}36%,54%{transform:translate(0,0)}55%,70%{transform:translate(-33.333333%,0)}71%,100%{transform:translate(-66.666667%,0)}';
const sprung='0%,19%,36%,54%,71%,100%{translate:0 0}26%,61%{translate:0 -10px}82%,94%{translate:0 -4px}';
const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Botzeps · Spielerfiguren</title><style>
*{box-sizing:border-box}body{max-width:1080px;margin:auto;padding:24px;background:#101522;color:#f4eef7;font-family:system-ui,sans-serif}h1{font-size:28px;margin:0}p{color:#b8adc8;line-height:1.5}.kopf{display:flex;align-items:center;gap:16px}.kopf>svg{width:120px;height:120px;flex-shrink:0}.ansicht{position:relative;margin-top:24px}.modus{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden}.bedienung{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:22px}.bedienung fieldset{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;border:0;width:100%}.bedienung legend{margin-bottom:10px;color:#b8adc8}.pose,.start,button{font:inherit;display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-height:44px;border-radius:9px;background:#20283b;color:#f4eef7;border:1px solid #665576;cursor:pointer}.start{background:#7046ad;border-color:#9465d0;font-weight:650}.start-b{display:none}#kampf-a:checked~.bedienung .start-a{display:none}#kampf-a:checked~.bedienung .start-b{display:inline-flex}#kampf-a:focus-visible~.bedienung .start-b,#kampf-b:focus-visible~.bedienung .start-a{outline:3px solid #ffcc00;outline-offset:3px}.raster{--tx:0%;--ty:0%;--filter:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:16px}.karte{padding:18px;border-radius:16px;background:#20283b;border:1px solid #3b3750}.karte h2{font-size:17px;margin:0 0 12px;color:#e1d5ef}.grossfigur{position:relative;overflow:hidden;width:120px;height:180px;margin:auto}.grossfigur .atlas{position:absolute;inset:0 auto auto 0;display:block;max-width:none;width:300%;height:200%;transform:translate(var(--tx),var(--ty));filter:var(--filter)}.posenblatt{margin:18px 0 0}.posenblatt>img{display:block;width:100%;height:auto}.posenblatt figcaption{text-align:center;color:#b8adc8;font-size:11px;line-height:1.6;margin-top:8px}.hinweis{margin:0 0 20px;color:#b8adc8;font-size:13px}.weniger-bewegung{display:none}
${regeln}
@keyframes kampf-a{${kampf}}@keyframes kampf-b{${kampf}}@keyframes sprung-a{${sprung}}@keyframes sprung-b{${sprung}}
#kampf-a:checked~.raster .grossfigur .atlas{animation:kampf-a 3.6s steps(1,end) both}#kampf-b:checked~.raster .grossfigur .atlas{animation:kampf-b 3.6s steps(1,end) both}#kampf-a:checked~.raster .grossfigur{animation:sprung-a 3.6s ease-in-out both}#kampf-b:checked~.raster .grossfigur{animation:sprung-b 3.6s ease-in-out both}
@media(max-width:480px){body{padding:16px}h1{font-size:23px}.kopf>svg{width:88px;height:100px}.kopf{gap:10px}}
@media(prefers-reduced-motion:reduce){#kampf-a:checked~.raster .grossfigur,#kampf-b:checked~.raster .grossfigur,#kampf-a:checked~.raster .grossfigur .atlas,#kampf-b:checked~.raster .grossfigur .atlas{animation:none}#kampf-a:checked~.raster .grossfigur .atlas,#kampf-b:checked~.raster .grossfigur .atlas{transform:translate(-66.666667%,0)}.weniger-bewegung{display:block}}
</style></head><body><header class="kopf">${bossSvg('König Bierbauch',2)}<div><h1>Botzeps · Spielerfiguren</h1><p>Zwölf Kämpfer im Stil der Arcade-Bosse · alle sechs Posen</p></div></header>
<form class="ansicht">${auswahl}<input class="modus" type="radio" name="ansicht" id="kampf-a"><input class="modus" type="radio" name="ansicht" id="kampf-b">
<div class="bedienung"><fieldset><legend>Pose für alle Figuren</legend>${regler}</fieldset><label class="start start-a" for="kampf-a">▶ Kampf starten</label><label class="start start-b" for="kampf-b">↻ Kampf erneut starten</label><button type="reset">Zurücksetzen</button></div>
<p class="hinweis">Der Kampfablauf zeigt Kampfhaltung, zwei Schläge und Jubel. Über die Posenwahl kannst du jede Ansicht einzeln ansehen.</p><p class="hinweis weniger-bewegung">Dein Browser bevorzugt reduzierte Bewegung. Der Kampfknopf zeigt deshalb direkt die Jubelpose.</p>
<main class="raster">${karten}</main></form></body></html>`;
const target=process.argv[2] || 'figuren-vorschau.html';
writeFileSync(target,html);
console.log(target);
