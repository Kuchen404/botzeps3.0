/* Eigene Bühne: echte Teamdurchschnitte, gemeinsame Züge und ein echtes Wochenfinale. */
var tauziehenStaende = {}, tauziehenAbbrechen = null, tauziehenFensterbreite = window.innerWidth;
var tauziehenBewegungsWahl = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
document.addEventListener("visibilitychange", function () { if (document.hidden && tauziehenAbbrechen) tauziehenAbbrechen(); });
window.addEventListener("resize", function () {
  if (window.innerWidth !== tauziehenFensterbreite && tauziehenAbbrechen) tauziehenAbbrechen();
  tauziehenFensterbreite = window.innerWidth;
});
if (tauziehenBewegungsWahl && tauziehenBewegungsWahl.addEventListener) tauziehenBewegungsWahl.addEventListener("change", function (e) {
  if (e.matches && tauziehenAbbrechen) tauziehenAbbrechen();
  document.querySelectorAll('.ms-tauziehen[data-tauphase="ende"]').forEach(function (s) { s.querySelector(".tz-replay").disabled = e.matches; });
});
function tauziehenLage(stand) {
  var schnitt = [0, 1].map(function (i) { var n = (stand.schnitt || [])[i]; return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0; });
  var summe = schnitt[0] + schnitt[1], zug = summe > 0 ? (schnitt[0] - schnitt[1]) / summe : 0;
  return { schnitt: schnitt, zug: zug, seite: zug === 0 ? null : zug > 0 ? 0 : 1 };
}
function tauziehenAusschlag(zug) { return zug === 0 ? 0 : (zug > 0 ? 1 : -1) * Math.min(1, Math.sqrt(Math.abs(zug))); }
function tauziehenWechsel(vorher, station) {
  var alt = tauziehenLage(vorher), neu = tauziehenLage(station.stand);
  var delta = [neu.schnitt[0] - alt.schnitt[0], neu.schnitt[1] - alt.schnitt[1]];
  var korrektur = station.art === "korrektur" || delta.some(function (d) { return d < 0; });
  var training = !korrektur && station.art === "training" && delta.some(function (d) { return d > 0; });
  return { korrektur: korrektur, training: training, aktiv: !training || delta[0] === delta[1] ? null : delta[0] > delta[1] ? 0 : 1,
    wechsel: training && alt.seite !== null && neu.seite !== null && alt.seite !== neu.seite, ausgleich: training && alt.seite !== null && neu.seite === null };
}
function tauziehenSichtbar(ids, spieler, aktiv, limit) {
  var bekannte = new Map(spieler.map(function (sp) { return [sp.id, sp]; })), gesehen = new Set();
  return ids.filter(function (id) { return (bekannte.get(id) || {}).ich; }).concat(aktiv || [], ids).filter(function (id) {
    if (!ids.includes(id) || !bekannte.has(id) || gesehen.has(id)) return false;
    gesehen.add(id); return true;
  }).slice(0, limit);
}
function tauziehenFortsetzung(alt, neu) {
  if (!neu.length) return null;
  if (!alt || !alt.length || !alt.every(function (s, i) { return s === neu[i]; })) return 0;
  return alt.length === neu.length ? null : alt.length - 1;
}
function tauziehenSignaturen(stationen) { return stationen.map(function (s) { return JSON.stringify([s.art, s.stand]); }); }
// Griffmitte der gemalten Ziehen-Pose, in der 200 × 300 großen Atlaszelle.
var tauziehenGriffe = [[55,178],[40,168],[46,165],[50,153],[52,167],[49,164],[51,151],[46,151],[40,158],[40,158],[51,163],[53,167]];
function tauziehenAufstellung(breite, anzahl) {
  if (!anzahl || breite <= 0) return [];
  var w = Math.min(86, breite * (anzahl > 3 ? .16 : anzahl > 2 ? .205 : .24));
  var aussen = w / 2 + breite * .025 + 17, innen = Math.max(aussen, breite * .38);
  return Array.from({length:anzahl},function(_,i){
    return {x:anzahl===1?breite*.26:aussen+(innen-aussen)*i/(anzahl-1),w:w,h:w*1.5,
      label:anzahl===1?80:Math.max(30,Math.min(80,(innen-aussen)/(anzahl-1)*(anzahl>2?2:1)-3))};
  });
}
function tauziehenLandung(breite, seite, platz, anzahl, gleich) {
  var von = gleich ? (seite===0?.27:.56) : .39;
  var bis = gleich ? (seite===0?.44:.73) : .61;
  return {x:breite*(anzahl===1?(von+bis)/2:von+(bis-von)*platz/(anzahl-1)),fuss:307+(platz%2)*7,
    label:anzahl===1?80:Math.max(30,Math.min(80,(bis-von)*breite/(anzahl-1)*(anzahl>2?2:1)-3))};
}
/* Enden und alle Griffpunkte liegen innerhalb der Bühne. Nur das freie Stück
   zwischen den Teams bekommt Durchhang und die kräftige Rückstoßwelle. */
function tauziehenSeilPunkte(breite, versatz, senke, impuls, zeit, griffe) {
  if (!(breite > 0)) return [];
  griffe = (griffe && griffe.length ? griffe : [{x:breite*.2,y:228,seite:0},{x:breite*.8,y:228,seite:1}]).slice().sort(function(a,b){return a.x-b.x;});
  var a=griffe[0], b=griffe[griffe.length-1], links=griffe.filter(function(g){return g.seite===0;}).pop()||a;
  var rechts=griffe.find(function(g){return g.seite===1;})||b;
  var punkte=[[Math.max(8,a.x-14),a.y+20],[Math.max(10,a.x-9),a.y+7]];
  griffe.forEach(function(g,i){
    if (!i) {punkte.push([g.x,g.y]);return;}
    var vorher=griffe[i-1], frei=vorher===links&&g===rechts;
    for(var j=1;j<=12;j++){
      var u=j/12, gewicht=Math.pow(Math.sin(u*Math.PI),2), x=vorher.x+(g.x-vorher.x)*u;
      var y=vorher.y+(g.y-vorher.y)*(u*u*(3-2*u));
      y+=(frei?senke:senke*.04)*gewicht + impuls*Math.sin(u*Math.PI*3-zeit*.025)*gewicht*(frei?1:.1);
      punkte.push([x,y]);
    }
  });
  punkte.push([Math.min(breite-10,b.x+9),b.y+7],[Math.min(breite-8,b.x+14),b.y+20]);
  return punkte;
}
function tauziehenSeilMarke(punkte, x) {
  for(var i=1;i<punkte.length;i++)if(punkte[i][0]>=x){var a=punkte[i-1],b=punkte[i],u=(x-a[0])/(b[0]-a[0]||1);return [x,a[1]+(b[1]-a[1])*u];}
  return punkte.length?punkte[punkte.length-1]:[x,228];
}
/* Scanline-Verformung der vorhandenen Ziehen-Pose: kein neuer Atlas und kein
   Austausch von Einzelbildern. Die letzten Fußzeilen bleiben fest am Boden. */
function tauziehenKoerperZeile(y, neigung, beuge) {
  var gewicht = Math.max(0, Math.min(1, (284 - y) / 180));
  return { x: neigung * gewicht, y: y + beuge * Math.sin(Math.PI * Math.min(1, y / 284)) * gewicht };
}
var tauziehenBildCache = new Map();
function tauziehenZugBild(avatar) {
  var bild = avatar.querySelector('svg image'), url = bild && bild.getAttribute('href');
  if (!url) return null;
  if (!tauziehenBildCache.has(url)) {
    var img = new Image(); img.src = url; tauziehenBildCache.set(url, img);
  }
  return tauziehenBildCache.get(url);
}
function tauziehenKoerper(canvas, bild, neigung, beuge, links) {
  var ctx = canvas.getContext('2d'); if (!ctx || !bild || !bild.complete || !bild.naturalWidth) return false;
  ctx.setTransform(canvas.width / 240, 0, 0, canvas.height / 320, 0, 0); ctx.clearRect(0,0,240,320);
  ctx.save(); ctx.translate(20, 10); if (links) { ctx.translate(200,0); ctx.scale(-1,1); }
  for (var y = 0; y < 300; y += 10) {
    var a = tauziehenKoerperZeile(y, neigung, beuge), b = tauziehenKoerperZeile(y + 10, neigung, beuge);
    ctx.save(); ctx.transform(1,0,(b.x-a.x)/10,(b.y-a.y)/10,a.x,a.y);
    ctx.drawImage(bild,200,300+y,200,10,0,0,200,10.3); ctx.restore();
  }
  ctx.restore(); return true;
}

window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
window.MINISPIEL_SZENEN.tauziehen = function (a) {
  if (tauziehenAbbrechen) tauziehenAbbrechen();
  var gesehen = tauziehenStaende[a.id], seiten = ["links", "rechts"];
  var spieler = new Map(a.spieler.map(function (sp) { return [sp.id, sp]; }));
  var aktuell = a.aktuell || { teams: [], schnitt: [0, 0], zug: 0, lasten: {} };
  var stationen = (a.verlauf || []).filter(function (s) { return !!s.stand; });
  if (!stationen.length) stationen = [{ zeitpunkt: null, art: "start", stand: aktuell }];
  var signaturen = tauziehenSignaturen(stationen);
  var status = el("div", { class: "ms-status", role: "status", "aria-live": "polite" });
  var arena = el("div", { class: "tz-arena" });
  ["licht", "flag", "mud", "boden"].forEach(function (name) { arena.appendChild(el("div", { class: "tz-" + name })); });
  if (a.tauziehenArena) {
    var kulisse = new Image(); kulisse.className = 'tz-kulisse'; kulisse.alt = ''; kulisse.src = a.tauziehenArena;
    kulisse.onload = function () { if (kulisse.naturalWidth) arena.classList.add('tz-mit-kulisse'); };
    arena.prepend(kulisse);
  }
  var seilCanvas = document.createElement('canvas'); seilCanvas.className = 'tz-seil-kurve'; seilCanvas.setAttribute('aria-hidden','true'); arena.appendChild(seilCanvas);
  var seilTeile = seiten.map(function (seite) { return el("div", { class: "tz-seilhaelfte " + seite }); });
  var knoten = el("div", { class: "tz-knoten" });
  var seil = el("div", { class: "tz-seil" }, seilTeile.concat([knoten])); arena.appendChild(seil);
  var crews = seiten.map(function (seite) { var e = el("div", { class: "tz-crew " + seite, "aria-hidden": "true" }); arena.appendChild(e); return e; });
  var mehr = seiten.map(function (seite) { var e = el("div", { class: "tz-more " + seite }); arena.appendChild(e); return e; });
  var labels = [], werte = [], anzahl = [];
  var score = el("div", { class: "tz-score" }, seiten.map(function (seite, i) {
    labels[i] = el("div", { class: "tz-team-name" }); werte[i] = el("div", { class: "tz-average" }); anzahl[i] = el("div", { class: "tz-anzahl" });
    return el("div", { class: "tz-team " + seite }, [labels[i], werte[i], el("div", { class: "tz-unit", text: "Ø Last pro Kopf" }), anzahl[i]]);
  }));
  arena.appendChild(score);
  var zeit = el("div", { class: "ms-zeit" });
  var skip = el("button", { class: "knopf leise", text: "Überspringen" });
  var replay = el("button", { class: "knopf leise tz-replay", text: "↻ Nochmal ansehen" });
  var laden = el("button", { class: "knopf leise", text: "↻ Stand aktualisieren", onclick: function () { aktualisiereBombe(laden); } });
  var root = el("section", { class: "ms-scene ms-tauziehen", "aria-label": "Tauziehen an der Schlammgrube" }, [status, arena, zeit,
    el("div", { class: "ms-steuerung" }, [skip, replay, laden]), el("p", { class: "tz-rule", text: "Jedes Training zieht. Es zählt die Wochenlast pro Kopf – auch bei unterschiedlich großen Teams. Erst der Wochenabschluss entscheidet." })]);
  var lauf = 0, animationen = new Set(), wartende = new Map(), raf = 0, letzteZeichnung = 0;
  var aktiveSeite=null, rutschStaerke=0, seilLos=null;
  var wellenStart = 0, wellenStaerke = 0, seilVersatz = 0, lockeresSeil = 0, seilBewegung = null, rigKraft = 5, spannenAb = 0;
  function kurve(zeit) {
    var w=arena.clientWidth,ctx=seilCanvas.getContext('2d');if(!w)return;
    if(spannenAb){var rest=Math.max(0,1-(zeit-spannenAb)/300);lockeresSeil=18*rest*rest;if(!rest)spannenAb=0;}
    if(seilBewegung){var u=Math.max(0,Math.min(1,(zeit-seilBewegung.start)/seilBewegung.dauer)),e=1-Math.pow(1-u,3);seilVersatz=seilBewegung.von+(seilBewegung.nach-seilBewegung.von)*e+Math.sin(u*Math.PI*2)*(1-u)*seilBewegung.stoss;if(u===1)seilBewegung=null;}
    var griffe=seilLos?seilLos.griffe:figurenGriffe();if(!griffe.length){seil.hidden=true;return;}seil.hidden=false;
    var ab=Math.max(0,zeit-wellenStart),impuls=wellenStaerke*Math.exp(-ab/240);
    var punkte=tauziehenSeilPunkte(w,seilVersatz,lockeresSeil,impuls,ab,griffe);
    var links=griffe.filter(function(g){return g.seite===0;}).pop()||griffe[0];
    var rechts=griffe.find(function(g){return g.seite===1;})||griffe[griffe.length-1];
    var mitte=(links.x+rechts.x)/2,markeX=Math.max(links.x+4,Math.min(rechts.x-4,mitte+seilVersatz*.22));
    var marke=tauziehenSeilMarke(punkte,markeX),fall=seilLos?(seilLos.start?Math.min(1,(zeit-seilLos.start)/620):1):0;
    fall=1-Math.pow(1-Math.max(0,fall),3);
    if(seilLos){
      punkte=punkte.map(function(p){return [Math.max(9,Math.min(w-9,p[0]+(seilLos.gleich?(p[0]<mitte?-12:12):(mitte-p[0])*.06)*fall)),p[1]+(303+Math.sin(p[0]*.06)*3-p[1])*fall];});
      marke=[marke[0]+(seilLos.gleich?8:0)*fall,marke[1]+(314-marke[1])*fall];
    }
    seil.style.left=punkte[0][0]+'px';seil.style.width=(punkte[punkte.length-1][0]-punkte[0][0])+'px';seil.style.top=(seilLos?303:links.y)+'px';seil.style.transform='none';
    knoten.style.left=(markeX-punkte[0][0]-8)+'px';knoten.style.transform=seilLos?'rotate(14deg)':'none';
    seilTeile.forEach(function(e,i){e.style.transform=seilLos&&seilLos.gleich?'translateY(8px) rotate('+(i===0?9:-9)+'deg)':'none';});
    if(!ctx)return;
    arena.classList.add('tz-hat-seil');
    var dpr=Math.min(2,window.devicePixelRatio||1);
    if(seilCanvas.width!==Math.round(w*dpr)){seilCanvas.width=Math.round(w*dpr);seilCanvas.height=360*dpr;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,360);
    function linie(farbe,dicke,strich){
      ctx.beginPath();var angefangen=false;
      punkte.forEach(function(p){
        if(seilLos&&seilLos.gleich&&Math.abs(p[0]-mitte)<12*fall){angefangen=false;return;}
        if(angefangen)ctx.lineTo(p[0],p[1]);else{ctx.moveTo(p[0],p[1]);angefangen=true;}
      });
      ctx.strokeStyle=farbe;ctx.lineWidth=dicke;ctx.setLineDash(strich||[]);ctx.stroke();
    }
    ctx.lineCap='round';linie('#241b1a',9);linie('#b47e46',6);linie('#ffe3a3',3,[2,5]);ctx.setLineDash([]);
    [punkte[0],punkte[punkte.length-1]].forEach(function(p){
      ctx.strokeStyle='#e5b979';ctx.lineWidth=1.5;
      for(var k=-1;k<=1;k++){ctx.beginPath();ctx.moveTo(p[0]+k*2,p[1]-2);ctx.lineTo(p[0]+k*3,p[1]+5);ctx.stroke();}
    });
    ctx.save();ctx.translate(marke[0],marke[1]);ctx.rotate(seilLos?fall*.7:impuls*.025);ctx.fillStyle='#df5948';ctx.strokeStyle='#542a23';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(6,-5);ctx.lineTo(8,25);ctx.lineTo(1,21);ctx.lineTo(-6,26);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffc28a';ctx.fillRect(-3,-4,3,11);ctx.restore();
    // Kleine Datenpunkte für reproduzierbare Geometrieprüfungen, keine Spielzustände.
    seilCanvas.dataset.enden=JSON.stringify([punkte[0],punkte[punkte.length-1]]);
  }
  function rigZeichnen(zeit,animiert){
    var ph=root.getAttribute('data-tauphase'),ziel=ph==='ausholen'?-7:ph==='ziehen'?23:ph==='finale'?29:5;
    rigKraft=animiert?rigKraft+(ziel-rigKraft)*.2:5;
    crews.forEach(function(crew,i){crew.querySelectorAll('.tz-person').forEach(function(person,j){
      var avatar=person.querySelector('.ms-avatar');if(avatar.dataset.pose!=='ziehen')return;
      var bild=tauziehenZugBild(avatar);if(!bild)return;
      var canvas=person.querySelector('.tz-koerper');
      if(!canvas){canvas=document.createElement('canvas');canvas.className='tz-koerper';canvas.setAttribute('aria-hidden','true');canvas.width=240;canvas.height=320;avatar.appendChild(canvas);}
      var t=animiert?zeit*.005+j*.65+i*.4:0,gegenseite=aktiveSeite!==null&&i!==aktiveSeite;
      var neigung=rigKraft*(gegenseite?.65:1)+(animiert?Math.sin(t)*2:0);
      var beuge=animiert?(ph==='ausholen'?12:5)+Math.sin(t-.5)*2:0;
      if(gegenseite&&rutschStaerke&&ph==='ziehen'){neigung-=Math.sin(t*2)*5;beuge+=5;}
      person.dataset.neigung=neigung;person.dataset.beuge=beuge;
      if(tauziehenKoerper(canvas,bild,neigung,beuge,i===0))avatar.classList.add('tz-geriggt');
    });});
  }
  function bildlauf(zeit) {
    raf=0;if(!root.isConnected||document.hidden||!bewegung())return;
    if(zeit-letzteZeichnung>=30){rigZeichnen(zeit,true);kurve(zeit);letzteZeichnung=zeit;}
    raf=requestAnimationFrame(bildlauf);
  }
  function bildlaufStart(){if(!raf)raf=requestAnimationFrame(bildlauf);}
  function bildlaufStop(){cancelAnimationFrame(raf);raf=0;}

  function bewegung() { return !(tauziehenBewegungsWahl && tauziehenBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && root.isConnected && !document.hidden && bewegung(); }
  function phase(p) { root.setAttribute("data-tauphase", p); }
  function z(n) { return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }); }
  function team(stand, i) { return (stand.teams || [])[i] || { name: "Team " + seiten[i], mitglieder: [] }; }
  function position(stand) { var x = tauziehenAusschlag(tauziehenLage(stand).zug); return { seil: -x * arena.clientWidth * .13, crew: -x * arena.clientWidth * .025 }; }
  function reinigen() {
    bildlaufStop(); wellenStaerke=0; lockeresSeil=0;seilBewegung=null;spannenAb=0;seilLos=null;aktiveSeite=null;rutschStaerke=0;
    root.removeAttribute("data-wucht");root.removeAttribute("data-seil-los");
    animationen.forEach(function (anim) { anim.cancel(); }); animationen.clear();
    wartende.forEach(function (resolve, timer) { clearTimeout(timer); resolve(false); }); wartende.clear();
    arena.querySelectorAll(".tz-effekt").forEach(function (e) { e.remove(); });
    arena.style.transform = ""; seil.removeAttribute("style"); knoten.removeAttribute("style");
    seilTeile.forEach(function (e) { e.removeAttribute("style"); }); crews.forEach(function (e) { e.removeAttribute("style"); });
    root.removeAttribute("data-ergebnis");
  }
  function warten(ms, nr) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { wartende.delete(timer); resolve(gueltig(nr)); }, ms);
      wartende.set(timer, resolve);
    });
  }
  function bewegen(element, frames, optionen, nr) {
    if (!gueltig(nr)) return Promise.resolve(false);
    var anim = element.animate(frames, Object.assign({ fill: "forwards" }, optionen)); animationen.add(anim);
    return anim.finished.then(function () {
      if (!gueltig(nr)) return false;
      var letzter = frames[frames.length - 1];
      ["transform", "opacity"].forEach(function (p) { if (letzter[p] != null) element.style[p] = letzter[p]; });
      return true;
    }, function () { return false; }).finally(function () { animationen.delete(anim); anim.cancel(); });
  }
  function effekt(klasse, text) { var e = el("div", { class: "tz-effekt " + klasse, text: text || "" }); arena.appendChild(e); return e; }
  function medienErsatz(avatar, id) {
    avatar.querySelectorAll('svg image').forEach(function(image){
      image.addEventListener('error',function(){
        if(!avatar.isConnected)return;
        var sp=spieler.get(id);avatar.classList.remove('tz-geriggt');avatar.classList.add('ms-avatar-ersatz');
        avatar.textContent=initialen(sp.name);avatar.style.setProperty('--ms-avatar-farbe',farbe(sp.name));
      },{once:true});
    });
  }
  function teamZeichnen(stand, i, pose, aktiv) {
    var breite=arena.clientWidth||Math.max(240,Math.min(480,window.innerWidth-64));
    var t=team(stand,i),ids=t.mitglieder||[],limit=breite>=400?4:3;
    var bekannt=ids.filter(function(id){return spieler.has(id);});
    var sichtbar=tauziehenSichtbar(ids,a.spieler,bekannt.length<=limit?[]:aktiv,limit),plan=tauziehenAufstellung(breite,sichtbar.length);
    labels[i].textContent=t.name;werte[i].textContent=z(tauziehenLage(stand).schnitt[i]);anzahl[i].textContent=ids.length+" Spieler";
    crews[i].replaceChildren();
    sichtbar.forEach(function(id,j){
      var sp=spieler.get(id),g=tauziehenGriffe[sp.figur]||[50,170],p=plan[j];
      var person=el('div',{class:'tz-person'+(aktiv&&aktiv.includes(id)?' tz-beitrag':''),'data-id':id,'data-ich':String(!!sp.ich),title:sp.name});
      var x=i===0?p.x:breite-p.x,top=228-g[1]/300*p.h+(j%2?-3:0);
      person.style.left=x+'px';person.style.top=top+'px';person.style.width=p.w+'px';person.style.height=p.h+'px';
      person.style.setProperty('--tz-label',p.label+'px');person.style.setProperty('--tz-label-y',sichtbar.length>2&&j%2?'17px':'0px');person.style.zIndex=String(j+1);
      person.dataset.basisX=x;person.dataset.basisY=top;person.dataset.griffX=g[0];person.dataset.griffY=g[1];
      person.appendChild(el('div',{class:'tz-body'},[minispielAvatar(a,id,pose),el('div',{class:'tz-schmutz'})]));
      person.appendChild(el('div',{class:'tz-name',text:(sp.ich?'DU · ':'')+sp.name}));
      crews[i].appendChild(person);medienErsatz(person.querySelector('.ms-avatar'),id);
    });
    mehr[i].hidden=ids.length<=sichtbar.length;mehr[i].textContent='+'+(ids.length-sichtbar.length)+' am Seil';
  }
  function posen(i,pose){crews[i].querySelectorAll('.ms-avatar').forEach(function(e){e.classList.remove('tz-geriggt');minispielSetzePose(e,a,e.dataset.id,pose);medienErsatz(e,e.dataset.id);});}
  function figurenGriffe(){
    var rect=arena.getBoundingClientRect(),griffe=[];
    crews.forEach(function(crew,i){crew.querySelectorAll('.tz-person').forEach(function(p){
      var r=p.getBoundingClientRect(),dx=Number(p.dataset.griffX),dy=Number(p.dataset.griffY);
      var verformt=p.querySelector('.tz-geriggt'),zeile=verformt?tauziehenKoerperZeile(dy,Number(p.dataset.neigung)||5,Number(p.dataset.beuge)||0):{x:0,y:dy};
      var x=(dx+zeile.x)/200;griffe.push({x:r.left-rect.left+r.width*(i===0?1-x:x),y:r.top-rect.top+r.height*zeile.y/300,seite:i});
    });});
    return griffe.sort(function(a,b){return a.x-b.x;});
  }
  function finaleAufstellung(lage){
    crews.forEach(function(crew,i){
      var verloren=lage.seite===null||i!==lage.seite,personen=Array.from(crew.querySelectorAll('.tz-person'));
      crew.style.transform='none';
      personen.forEach(function(p,j){
        if(verloren){var ziel=tauziehenLandung(arena.clientWidth,i,j,personen.length,lage.seite===null);p.style.left=ziel.x+'px';p.style.top=(ziel.fuss-p.clientHeight)+'px';p.style.setProperty('--tz-label',ziel.label+'px');}
        p.querySelector('.tz-body').style.transform=verloren?'rotate('+(i===0?12:-12)+'deg) scale(1,.9)':'none';
      });
    });
  }
  function zeichneStand(stand,fertig,aktiv){
    var l=tauziehenLage(stand),geschlossen=fertig&&a.abgeschlossen&&a.spieler.length;
    seilLos=null;root.removeAttribute('data-seil-los');seilVersatz=position(stand).seil;root.setAttribute('data-zug',String(l.zug));root.setAttribute('data-fuehrung',l.seite===null?'gleich':seiten[l.seite]);root.removeAttribute('data-ergebnis');
    crews.forEach(function(crew,i){teamZeichnen(stand,i,geschlossen?(l.seite===null||i!==l.seite?'ko':'jubel'):'ziehen',aktiv);crew.style.transform='translateX('+position(stand).crew+'px)';});
    if(!geschlossen)rigZeichnen(performance.now(),!!raf);
    var griffe=figurenGriffe();
    if(geschlossen){root.setAttribute('data-seil-los','true');root.setAttribute('data-ergebnis',l.seite===null?'unentschieden':seiten[l.seite]);seilLos={start:0,griffe:griffe,gleich:l.seite===null};finaleAufstellung(l);}
    kurve(performance.now());
  }
  function beschreibe(stand, fertig) {
    var l = tauziehenLage(stand);
    if (!a.spieler.length) return "Noch keine Spieler am Seil.";
    if (fertig && a.abgeschlossen) return l.seite === null ? "Unentschieden! Das Seil ist gerissen. Beide Teams im Schlamm." : team(stand, l.seite).name + " gewinnt! Die Gegenseite landet im Schlamm.";
    return l.seite === null ? l.schnitt[0] === 0 ? "Beide Teams stehen bereit. Noch kein Zug am Seil." : "Gleichstand! Der Knoten steht genau in der Mitte." : team(stand, l.seite).name + " zieht. Bis zum Wochenabschluss ist noch alles offen.";
  }
  function station(index) {
    var s = stationen[index], d = s.zeitpunkt && new Date(s.zeitpunkt);
    zeit.textContent = (index + 1) + " / " + stationen.length + (d && !Number.isNaN(d.getTime()) ? " · " + d.toLocaleString("de-DE", { timeZone: a.zeitzone || "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "") + (s.art === "korrektur" ? " · Korrektur" : "");
  }
  function endstand(merken) {
    arena.querySelectorAll(".tz-effekt").forEach(function (e) { e.remove(); }); zeichneStand(aktuell, true); phase("ende"); root.setAttribute("data-rueckblick", "false");
    status.textContent = beschreibe(aktuell, true); zeit.textContent = a.abgeschlossen ? "Wochenabschluss" : "Aktueller Stand";
    if (a.abgeschlossen && a.spieler.length) { var l = tauziehenLage(aktuell); effekt("tz-ergebnis", l.seite === null ? "UNENTSCHIEDEN" : team(aktuell, l.seite).name + " gewinnt!"); }
    skip.hidden = true; replay.hidden = !a.spieler.length; replay.disabled = !bewegung();
    if (merken && root.isConnected) tauziehenStaende[a.id] = { signaturen: signaturen, abgeschlossen: !!a.abgeschlossen };
  }
  function abbrechen() { lauf++; reinigen(); endstand(true); if (tauziehenAbbrechen === abbrechen) tauziehenAbbrechen = null; }
  async function auftritt(stand, nr) {
    phase("auftritt"); status.textContent = "Rückblick · Beide Teams treten an"; var schild = effekt("tz-banner", "ANS SEIL!"), p = position(stand);
    crews.forEach(function (crew, i) { posen(i, "bereit"); bewegen(crew, [{ transform: "translateX(" + (p.crew + (i === 0 ? -18 : 18)) + "px)", opacity: 0 }, { transform: "translateX(" + p.crew + "px)", opacity: 1 }], { duration: 380, easing: "ease-out" }, nr); });
    var senke = arena.clientWidth * .65 * Math.sin(7 * Math.PI / 180); lockeresSeil=18;
    seilTeile.forEach(function (e, i) { e.style.transform = "rotate(" + (i === 0 ? 7 : -7) + "deg)"; }); knoten.style.transform = "translateY(" + senke + "px)";
    if (!await warten(400, nr)) return false;
    spannenAb=performance.now(); wellenStart=performance.now();wellenStaerke=3;
    phase("greifen"); posen(0, "ziehen"); posen(1, "ziehen");
    var teile = seilTeile.map(function (e, i) { return bewegen(e, [{ transform: "rotate(" + (i === 0 ? 7 : -7) + "deg)" }, { transform: "rotate(0deg)" }], { duration: 300, easing: "ease-out" }, nr); });
    teile.push(bewegen(knoten, [{ transform: "translateY(" + senke + "px)" }, { transform: "translateY(0)" }], { duration: 300 }, nr));
    if (!(await Promise.all(teile)).every(Boolean)) return false;
    if (!await bewegen(schild, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }, nr)) return false;
    schild.remove(); return true;
  }
  function staub(nr,aktiv){
    var rect=arena.getBoundingClientRect();
    crews.forEach(function(crew,seite){if(aktiv!==null&&seite!==aktiv)return;
      crew.querySelectorAll('.tz-person').forEach(function(person){
        var r=person.getBoundingClientRect(),x=r.left-rect.left+r.width/2,y=r.bottom-rect.top-4;
        var spur=effekt('tz-spur');spur.style.left=x+'px';spur.style.top=y+'px';
        bewegen(spur,[{opacity:.8,transform:'scaleX(.3)'},{opacity:0,transform:'scaleX(1.5)'}],{duration:900},nr).then(function(){spur.remove();});
        for(var k=0;k<3;k++){
          var e=effekt('tz-staub');e.style.left=(x+(k-1)*7)+'px';e.style.top=y+'px';
          bewegen(e,[{opacity:0,transform:'translateY(0) scale(.3)'},{opacity:.8,transform:'translateY(-7px) scale(1)',offset:.3},{opacity:0,transform:'translate('+((seite===0?1:-1)*(9+k*5))+'px,-18px) scale(1.8)'}],{duration:550+k*70},nr).then(function(teil){teil.remove();}.bind(null,e));
        }
      });
    });
  }
  async function zug(vorher, s, nr) {
    var w = tauziehenWechsel(vorher, s), alt = position(vorher), neu = position(s.stand), l = tauziehenLage(s.stand);
    var beitrag = a.spieler.filter(function (sp) { return ((s.stand.lasten || {})[sp.id] || 0) > ((vorher.lasten || {})[sp.id] || 0); }).map(function (sp) { return sp.id; });
    zeichneStand(vorher, false, w.training ? beitrag : []);
    if (w.korrektur || !w.training) { phase(w.korrektur ? "korrektur" : "rueckblick"); status.textContent = w.korrektur ? "Rückblick · Der Wochenverlauf wurde korrigiert" : beschreibe(s.stand, false); zeichneStand(s.stand, false); return warten(w.korrektur ? 550 : 280, nr); }
    phase("ausholen"); status.textContent = beitrag.length === 1 ? spieler.get(beitrag[0]).name + " setzt am Seil nach" : "Beide Teams stemmen sich ins Seil";
    var aktiv = w.aktiv;aktiveSeite=aktiv;rutschStaerke=w.wechsel?1:0;
    if (!await warten(220, nr)) return false;
    phase("ziehen");root.setAttribute("data-wucht",w.wechsel?"wechsel":"zug"); wellenStart=performance.now();wellenStaerke=w.wechsel?7:4; staub(nr, aktiv);
    var zucken = w.wechsel ? 6 : 3, richtung = aktiv === 1 ? 1 : -1;
    seilBewegung={von:alt.seil,nach:neu.seil,stoss:richtung*zucken,start:performance.now(),dauer:460};
    var bewegungen = crews.map(function (crew) { return bewegen(crew, [{ transform: "translateX(" + alt.crew + "px)" }, { transform: "translate(" + (neu.crew + richtung * zucken) + "px,-3px)" }, { transform: "translateX(" + neu.crew + "px)" }], { duration: 460, easing: "ease-out" }, nr); });
    if(w.wechsel)crews.forEach(function(crew,i){if(i===aktiv)return;crew.querySelectorAll('.tz-body').forEach(function(body,j){
      bewegen(body,[{transform:'none'},{transform:'translate('+(i===0?4:-4)+'px,2px) rotate('+(i===0?5:-5)+'deg)',offset:.35},{transform:'none'}],{duration:600,delay:j*30,easing:'ease-out'},nr);
    });});
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false;
    root.setAttribute("data-zug", String(l.zug)); werte.forEach(function (e, i) { e.textContent = z(l.schnitt[i]); });
    phase(w.wechsel ? "fuehrungswechsel" : w.ausgleich ? "ausgleich" : "nachsetzen");
    if (w.wechsel) {
      status.textContent = "Führungswechsel! " + team(s.stand, l.seite).name + " zieht jetzt"; var schild = effekt("tz-banner tz-wechsel", "FÜHRUNGSWECHSEL!");
      bewegen(schild, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }, nr).then(function () { schild.remove(); });
      bewegen(arena, [{ transform: "translateX(0)" }, { transform: "translateX(" + richtung * 3 + "px)" }, { transform: "translateX(" + -richtung * 2 + "px)" }, { transform: "translateX(0)" }], { duration: 220 }, nr);
    } else status.textContent = w.ausgleich ? "Ausgleich! Beide Teams halten dagegen" : beschreibe(s.stand, false);
    if (!await warten(300, nr)) return false;
    aktiveSeite=null;rutschStaerke=0;root.removeAttribute("data-wucht");zeichneStand(s.stand, false, beitrag); return warten(w.wechsel ? 240 : 140, nr);
  }
  function schlammeinschlag(nr,seitenImSchlamm){
    seitenImSchlamm.forEach(function(seite){
      var personen=Array.from(crews[seite].querySelectorAll('.tz-person'));
      personen.forEach(function(person,j){
        var ziel=tauziehenLandung(arena.clientWidth,seite,j,personen.length,seitenImSchlamm.length===2);
        var ring=effekt('tz-welle');ring.style.left=ziel.x+'px';ring.style.top=(ziel.fuss-7)+'px';
        bewegen(ring,[{opacity:1,transform:'translateX(-50%) scale(.2)'},{opacity:0,transform:'translateX(-50%) scale(1.8)'}],{duration:750},nr).then(function(){ring.remove();});
        for(var k=0;k<8;k++){
          var e=effekt('tz-spritzer'),dx=(k%2?1:-1)*(12+(k%4)*9);
          e.style.left=ziel.x+'px';e.style.top=(ziel.fuss-5)+'px';
          bewegen(e,[{opacity:0,transform:'translate(0,0) scale(.3)'},{opacity:1,transform:'translate('+dx+'px,'+(-24-k%3*13)+'px) scale(1)',offset:.35},{opacity:0,transform:'translate('+dx*1.5+'px,10px) scale(.6)'}],{duration:600+k%3*90},nr).then(function(teil){teil.remove();}.bind(null,e));
        }
      });
    });
    bewegen(arena,[{transform:'translateY(0)'},{transform:'translateY(4px)'},{transform:'translateY(-2px)'},{transform:'translateY(0)'}],{duration:220},nr);
  }
  async function finale(nr){
    if(!a.spieler.length)return true;
    var l=tauziehenLage(aktuell),p=position(aktuell),gleich=l.seite===null;
    zeichneStand(aktuell,false);phase('finale');root.setAttribute('data-wucht','finale');
    zeit.textContent='Wochenabschluss';status.textContent=gleich?'Beide Teams halten dagegen. Das Seil gibt nach!':team(aktuell,l.seite).name+' setzt zum letzten Zug an';
    var schild=effekt('tz-banner',gleich?'DAS SEIL GIBT NACH!':'DER LETZTE ZUG!');
    if(!await warten(350,nr))return false;
    aktiveSeite=l.seite;wellenStart=performance.now();wellenStaerke=9;staub(nr,l.seite);
    var letzterZug=crews.map(function(crew,i){var richtung=i===0?1:-1,verloren=gleich||i!==l.seite;return bewegen(crew,[{transform:'translateX('+p.crew+'px)'},{transform:'translateX('+(p.crew+richtung*(verloren?9:-4))+'px)'}],{duration:280,easing:'cubic-bezier(.45,0,.2,1)'},nr);});
    if(!(await Promise.all(letzterZug)).every(Boolean))return false;
    phase(gleich?'seilriss':'stolpern');root.setAttribute('data-seil-los','true');
    seilLos={start:performance.now(),griffe:figurenGriffe(),gleich:gleich};
    schild.textContent=gleich?'SEIL GERISSEN!':'KEIN HALT MEHR!';
    var kippen=[];
    crews.forEach(function(crew,i){var verloren=gleich||i!==l.seite,r=i===0?1:-1;crew.querySelectorAll('.tz-body').forEach(function(body){kippen.push(bewegen(body,[{transform:'none'},{transform:'translateY(-3px) rotate('+(verloren?r*14:-r*7)+'deg)'}],{duration:230,easing:'ease-out'},nr));});});
    if(!(await Promise.all(kippen)).every(Boolean))return false;
    phase('rutschen');status.textContent=gleich?'Beide Teams verlieren den Halt!':'Die Gegenseite rutscht in die Schlammgrube!';
    var stuerze=[],arenaRect=arena.getBoundingClientRect();
    crews.forEach(function(crew,i){
      var verloren=gleich||i!==l.seite,r=i===0?1:-1,personen=Array.from(crew.querySelectorAll('.tz-person'));
      var orte=personen.map(function(person){var rect=person.getBoundingClientRect();return {x:rect.left-arenaRect.left+rect.width/2,y:rect.top-arenaRect.top};});
      crew.style.transform='none';
      personen.forEach(function(person,j){
        person.style.left=orte[j].x+'px';person.style.top=orte[j].y+'px';
        if(verloren){
          var ziel=tauziehenLandung(arena.clientWidth,i,j,personen.length,gleich);person.style.setProperty('--tz-label',ziel.label+'px');
          var dx=ziel.x-orte[j].x,dy=ziel.fuss-person.clientHeight-orte[j].y;
          stuerze.push(bewegen(person,[{transform:'translateX(-50%)'},{transform:'translate(calc(-50% + '+dx*.65+'px),'+(dy*.25-5)+'px)',offset:.65},{transform:'translate(calc(-50% + '+dx+'px),'+dy+'px)'}],{duration:650,easing:'cubic-bezier(.4,0,.8,.6)'},nr));
          stuerze.push(bewegen(person.querySelector('.tz-body'),[{transform:'translateY(-3px) rotate('+r*14+'deg)'},{transform:'rotate('+r*24+'deg) scale(1,.92)'}],{duration:650,easing:'ease-in'},nr));
        }else{
          stuerze.push(bewegen(person.querySelector('.tz-body'),[{transform:'rotate('+-r*7+'deg)'},{transform:'rotate('+r*3+'deg)'},{transform:'none'}],{duration:450,easing:'ease-out'},nr));
        }
      });
    });
    if(!(await Promise.all(stuerze)).every(Boolean))return false;
    phase('schlamm');root.setAttribute('data-ergebnis',gleich?'unentschieden':seiten[l.seite]);
    var schlammSeiten=gleich?[0,1]:[1-l.seite],jubel=[];
    crews.forEach(function(crew,i){
      var verloren=schlammSeiten.includes(i),r=i===0?1:-1;posen(i,verloren?'ko':'jubel');
      crew.querySelectorAll('.tz-body').forEach(function(body){
        if(verloren)jubel.push(bewegen(body,[{transform:'rotate('+r*24+'deg) scale(1,.92)'},{transform:'rotate('+r*12+'deg) scale(1,.82)'},{transform:'rotate('+r*12+'deg) scale(1,.9)'}],{duration:300},nr));
        else jubel.push(bewegen(body,[{transform:'none'},{transform:'translateY(-13px) rotate(-3deg)'},{transform:'none'},{transform:'translateY(-6px)'},{transform:'none'}],{duration:700},nr));
      });
    });
    schlammeinschlag(nr,schlammSeiten);status.textContent=beschreibe(aktuell,true);schild.remove();
    if(!(await Promise.all(jubel)).every(Boolean))return false;
    return warten(180,nr);
  }
  async function spiele(ab, mitAuftritt) {
    lauf++; reinigen(); var nr = lauf; if (!root.isConnected) return;
    if (!bewegung() || document.hidden || !a.spieler.length) { endstand(true); return; }
    tauziehenAbbrechen = abbrechen; bildlaufStart(); root.setAttribute("data-rueckblick", "true"); skip.hidden = false; replay.hidden = true; zeichneStand(stationen[ab].stand, false); station(ab);
    try {
      if (mitAuftritt && !await auftritt(stationen[ab].stand, nr)) return; phase("bereit"); status.textContent = beschreibe(stationen[ab].stand, false);
      if (!await warten(280, nr)) return;
      for (var index = ab + 1; index < stationen.length; index++) { station(index); if (!await zug(stationen[index - 1].stand, stationen[index], nr)) return; }
      if (a.abgeschlossen && !await finale(nr)) return;
    } finally { if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (tauziehenAbbrechen === abbrechen) tauziehenAbbrechen = null; } }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); }; endstand(false);
  requestAnimationFrame(function () {
    if (!root.isConnected) return; var ab = tauziehenFortsetzung(gesehen && gesehen.signaturen, signaturen);
    if (ab === null) { if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(Math.max(0, stationen.length - 1), false); else endstand(true); }
    else spiele(ab, !gesehen);
  });
  return root;
};
