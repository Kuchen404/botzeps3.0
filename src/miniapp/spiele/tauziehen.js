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
/* Das geflochtene Seil wird als Kurve gezeichnet: Enden bleiben in den Händen,
   die gedämpfte Welle läuft nach einem Ruck über die freie Mitte. */
function tauziehenSeilPunkte(breite, versatz, senke, impuls, zeit) {
  if (!(breite > 0)) return [];
  var punkte = [];
  for (var i = 0; i <= 40; i++) {
    var x = i / 40 * breite, mitte = breite / 2 + versatz;
    var u = x <= mitte ? x / mitte / 2 : .5 + (x - mitte) / (breite - mitte) / 2;
    var frei = Math.pow(Math.sin(u * Math.PI), 6);
    punkte.push([x, 18 + senke * frei + impuls * Math.sin(u * Math.PI * 5 - zeit * .025) * frei]);
  }
  return punkte;
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
  ["licht", "flag", "mud"].forEach(function (name) { arena.appendChild(el("div", { class: "tz-" + name })); });
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
  var wellenStart = 0, wellenStaerke = 0, seilVersatz = 0, lockeresSeil = 0, seilBewegung = null, rigKraft = 5, spannenAb = 0;
  function kurve(zeit) {
    var ctx = seilCanvas.getContext('2d'); if (!ctx) return;
    arena.classList.add('tz-hat-seil');
    if(spannenAb){var rest=Math.max(0,1-(zeit-spannenAb)/300);lockeresSeil=18*rest*rest;if(!rest)spannenAb=0;}
    if(seilBewegung){var u=Math.max(0,Math.min(1,(zeit-seilBewegung.start)/seilBewegung.dauer)),e=1-Math.pow(1-u,3);seilVersatz=seilBewegung.von+(seilBewegung.nach-seilBewegung.von)*e+Math.sin(u*Math.PI*2)*(1-u)*seilBewegung.stoss;if(u===1)seilBewegung=null;}
    var w = arena.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (seilCanvas.width !== Math.round(w*dpr)) { seilCanvas.width = Math.round(w*dpr); seilCanvas.height = 90*dpr; }
    ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,90);
    var ab = Math.max(0,zeit-wellenStart), impuls = wellenStaerke*Math.exp(-ab/240);
    var punkte = tauziehenSeilPunkte(w,seilVersatz,lockeresSeil,impuls,ab);
    function linie(farbe, dicke, strich) { ctx.beginPath(); punkte.forEach(function(p,i){if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);}); ctx.strokeStyle=farbe;ctx.lineWidth=dicke;ctx.setLineDash(strich||[]);ctx.stroke(); }
    ctx.lineCap='round'; linie('#211d19',10); linie('#ad743f',7); linie('#f1d49a',4,[2,5]); ctx.setLineDash([]);
    var x=w/2+seilVersatz,y=18+lockeresSeil+impuls*Math.sin(Math.PI*2.5-ab*.025);
    ctx.save();ctx.translate(x,y);ctx.rotate(impuls*.025);ctx.fillStyle='#d95342';ctx.strokeStyle='#542a23';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-5,-5);ctx.lineTo(6,-5);ctx.lineTo(8,31);ctx.lineTo(1,27);ctx.lineTo(-6,32);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle='#ffc28a';ctx.fillRect(-3,-4,3,13);ctx.restore();
  }
  function rigZeichnen(zeit, animiert) {
    var ph=root.getAttribute('data-tauphase'),ziel=ph==='ausholen'?-5:ph==='ziehen'?18:5;rigKraft=animiert?rigKraft+(ziel-rigKraft)*.18:5;
    crews.forEach(function(crew,i){crew.querySelectorAll('.tz-person').forEach(function(person,j){
      var avatar=person.querySelector('.ms-avatar'); if(avatar.getAttribute('data-pose')!=='ziehen')return;
      var bild=tauziehenZugBild(avatar);if(!bild)return;
      var canvas=person.querySelector('.tz-koerper');
      if(!canvas){canvas=document.createElement('canvas');canvas.className='tz-koerper';canvas.setAttribute('aria-hidden','true');canvas.width=240;canvas.height=320;avatar.appendChild(canvas);}
      var t=animiert?(zeit*.005+j*.65+i*.4):0;
      var kraft=rigKraft;
      var pulse=animiert?Math.sin(t)*2:0;
      if(tauziehenKoerper(canvas,bild,kraft+pulse,animiert?3+Math.sin(t-.5)*2:0,i===0))avatar.classList.add('tz-geriggt');
    });});
  }
  function bildlauf(zeit) {
    raf=0;if(!root.isConnected||document.hidden||!bewegung())return;
    if(zeit-letzteZeichnung>=30){kurve(zeit);rigZeichnen(zeit,true);letzteZeichnung=zeit;}
    raf=requestAnimationFrame(bildlauf);
  }
  function bildlaufStart(){if(!raf)raf=requestAnimationFrame(bildlauf);}
  function bildlaufStop(){cancelAnimationFrame(raf);raf=0;}

  function bewegung() { return !(tauziehenBewegungsWahl && tauziehenBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && root.isConnected && !document.hidden && bewegung(); }
  function phase(p) { root.setAttribute("data-tauphase", p); }
  function z(n) { return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }); }
  function team(stand, i) { return (stand.teams || [])[i] || { name: "Team " + seiten[i], mitglieder: [] }; }
  function position(stand) { var x = tauziehenAusschlag(tauziehenLage(stand).zug); return { seil: -x * arena.clientWidth * .13, crew: -x * arena.clientWidth * .045 }; }
  function reinigen() {
    bildlaufStop(); wellenStaerke=0; lockeresSeil=0;seilBewegung=null;spannenAb=0;
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
    var t = team(stand, i), ids = t.mitglieder || [], limit = arena.clientWidth >= 400 ? 3 : 2;
    var sichtbar = tauziehenSichtbar(ids, a.spieler, aktiv, limit);
    labels[i].textContent = t.name; werte[i].textContent = z(tauziehenLage(stand).schnitt[i]); anzahl[i].textContent = ids.length + " Spieler";
    crews[i].replaceChildren();
    sichtbar.forEach(function (id, platz) {
      var slot = sichtbar.length === 1 ? .6 : sichtbar.length === 2 ? (arena.clientWidth < 280 ? .38 + platz * .48 : .33 + platz * .55) : .25 + platz * .32;
      var person = el("div", { class: "tz-person" + (aktiv && aktiv.includes(id) ? " tz-beitrag" : ""), "data-id": id, "data-ich": String(!!spieler.get(id).ich), title: spieler.get(id).name });
      person.style.left = ((i === 0 ? slot : 1 - slot) * 100) + "%"; person.style.zIndex = String(platz + 1);
      person.appendChild(el("div", { class: "tz-body" }, [minispielAvatar(a, id, pose), el("div", { class: "tz-schmutz" })])); person.appendChild(el('div',{class:'tz-name',text:(spieler.get(id).ich?'DU · ':'')+spieler.get(id).name})); crews[i].appendChild(person); medienErsatz(person.querySelector(".ms-avatar"),id);
    });
    mehr[i].hidden = ids.length <= sichtbar.length; mehr[i].textContent = "+" + (ids.length - sichtbar.length) + " am Seil";
  }
  function posen(i, pose) { crews[i].querySelectorAll(".ms-avatar").forEach(function (e) { e.classList.remove("tz-geriggt"); minispielSetzePose(e, a, e.getAttribute("data-id"), pose); medienErsatz(e,e.getAttribute("data-id")); }); }
  function zeichneStand(stand, fertig, aktiv) {
    var l = tauziehenLage(stand), x = tauziehenAusschlag(l.zug), geschlossen = fertig && a.abgeschlossen && a.spieler.length;
    seilVersatz=-x*arena.clientWidth*.13;
    root.setAttribute("data-zug", String(l.zug)); root.removeAttribute("data-ergebnis"); seil.style.transform = "translateX(" + -x * 10 + "%)";
    seilTeile.forEach(function (e) { e.style.transform = ""; }); knoten.style.transform = ""; knoten.style.opacity = "";
    if (geschlossen) root.setAttribute("data-ergebnis", l.seite === null ? "unentschieden" : seiten[l.seite]);
    crews.forEach(function (crew, i) {
      var verloren = geschlossen && (l.seite === null || i !== l.seite), richtung = i === 0 ? 1 : -1;
      var offset = verloren ? richtung * (l.seite === null ? .09 : .16) : 0;
      teamZeichnen(stand, i, geschlossen ? verloren ? "ko" : "jubel" : "ziehen", aktiv); crew.style.transform = "translate(" + ((-x * .045 + offset) / .36 * 100) + "%," + (verloren ? 10 : 0) + "px)";
      crew.querySelectorAll(".tz-body").forEach(function (body) { body.style.transform = verloren ? "rotate(" + richtung * 11 + "deg) scale(1,.9)" : "none"; });
    });
    kurve(performance.now());
    if (!geschlossen) rigZeichnen(performance.now(),!!raf);
    if (geschlossen && l.seite === null) {
      seilTeile.forEach(function (e, i) { e.style.transform = "translateX(" + (i === 0 ? -1 : 1) * .12 / .65 * 100 + "%) rotate(" + (i === 0 ? -8 : 8) + "deg)"; }); knoten.style.transform = "translateY(32px) rotate(22deg)"; knoten.style.opacity = ".5";
    }
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
  function staub(nr, aktiv) {
    for (var i = 0; i < 6; i++) {
      var e = effekt("tz-staub"); e.style.left = ((aktiv === 0 ? 22 : aktiv === 1 ? 78 : i % 2 ? 22 : 78) + (i % 3 - 1) * 4) + "%";
      bewegen(e, [{ opacity: 0, transform: "translateY(0) scale(.3)" }, { opacity: .7, transform: "translateY(-9px) scale(1)", offset: .4 }, { opacity: 0, transform: "translateY(-22px) scale(1.7)" }], { duration: 560 }, nr).then(function (teil) { teil.remove(); }.bind(null, e));
    }
  }
  async function zug(vorher, s, nr) {
    var w = tauziehenWechsel(vorher, s), alt = position(vorher), neu = position(s.stand), l = tauziehenLage(s.stand);
    var beitrag = a.spieler.filter(function (sp) { return ((s.stand.lasten || {})[sp.id] || 0) > ((vorher.lasten || {})[sp.id] || 0); }).map(function (sp) { return sp.id; });
    zeichneStand(vorher, false, w.training ? beitrag : []);
    if (w.korrektur || !w.training) { phase(w.korrektur ? "korrektur" : "rueckblick"); status.textContent = w.korrektur ? "Rückblick · Der Wochenverlauf wurde korrigiert" : beschreibe(s.stand, false); zeichneStand(s.stand, false); return warten(w.korrektur ? 550 : 280, nr); }
    phase("ausholen"); status.textContent = beitrag.length === 1 ? spieler.get(beitrag[0]).name + " setzt am Seil nach" : "Beide Teams stemmen sich ins Seil";
    var aktiv = w.aktiv;
    if (!await warten(220, nr)) return false;
    phase("ziehen"); wellenStart=performance.now();wellenStaerke=w.wechsel?7:4; staub(nr, aktiv);
    var zucken = w.wechsel ? 6 : 3, richtung = aktiv === 1 ? 1 : -1;
    seilBewegung={von:alt.seil,nach:neu.seil,stoss:richtung*zucken,start:performance.now(),dauer:460};
    var bewegungen = crews.map(function (crew) { return bewegen(crew, [{ transform: "translateX(" + alt.crew + "px)" }, { transform: "translate(" + (neu.crew + richtung * zucken) + "px,-3px)" }, { transform: "translateX(" + neu.crew + "px)" }], { duration: 460, easing: "ease-out" }, nr); });
    bewegungen.push(bewegen(seil, [{ transform: "translateX(" + alt.seil + "px)" }, { transform: "translate(" + (neu.seil + richtung * zucken) + "px,-2px) scaleY(1.1)" }, { transform: "translateX(" + neu.seil + "px)" }], { duration: 460, easing: "ease-out" }, nr));
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false;
    root.setAttribute("data-zug", String(l.zug)); werte.forEach(function (e, i) { e.textContent = z(l.schnitt[i]); });
    phase(w.wechsel ? "fuehrungswechsel" : w.ausgleich ? "ausgleich" : "nachsetzen");
    if (w.wechsel) {
      status.textContent = "Führungswechsel! " + team(s.stand, l.seite).name + " zieht jetzt"; var schild = effekt("tz-banner tz-wechsel", "FÜHRUNGSWECHSEL!");
      bewegen(schild, [{ opacity: 1 }, { opacity: 0 }], { duration: 500 }, nr).then(function () { schild.remove(); });
      bewegen(arena, [{ transform: "translateX(0)" }, { transform: "translateX(" + richtung * 3 + "px)" }, { transform: "translateX(" + -richtung * 2 + "px)" }, { transform: "translateX(0)" }], { duration: 220 }, nr);
    } else status.textContent = w.ausgleich ? "Ausgleich! Beide Teams halten dagegen" : beschreibe(s.stand, false);
    if (!await warten(300, nr)) return false;
    zeichneStand(s.stand, false, beitrag); return warten(w.wechsel ? 240 : 140, nr);
  }
  async function finale(nr) {
    if (!a.spieler.length) return true;
    var l = tauziehenLage(aktuell), p = position(aktuell), gleich = l.seite === null;
    zeichneStand(aktuell, false); bildlaufStop(); kurve(performance.now()); phase("finale"); zeit.textContent = "Wochenabschluss"; status.textContent = gleich ? "Unentschieden! Das Seil reißt" : team(aktuell, l.seite).name + " holt den letzten Zug";
    var schild = effekt("tz-banner", gleich ? "SEIL GERISSEN!" : "DER LETZTE ZUG!"); if (!await warten(280, nr)) return false;
    phase(gleich ? "seilriss" : "stolpern");
    if (gleich) {
      seilTeile.forEach(function (e, i) { bewegen(e, [{ transform: "translateX(0) rotate(0deg)" }, { transform: "translateX(" + (i === 0 ? -1 : 1) * arena.clientWidth * .12 + "px) rotate(" + (i === 0 ? -8 : 8) + "deg)" }], { duration: 300, easing: "ease-out" }, nr); });
      bewegen(knoten, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(32px) rotate(22deg)", opacity: .5 }], { duration: 350 }, nr);
    }
    var stuerze = [];
    crews.forEach(function (crew, i) {
      var verloren = gleich || i !== l.seite, richtung = i === 0 ? 1 : -1; posen(i, verloren ? "ko" : "jubel");
      if (verloren) {
        var ziel = p.crew + richtung * arena.clientWidth * (gleich ? .09 : .16);
        stuerze.push(bewegen(crew, [{ transform: "translateX(" + p.crew + "px)" }, { transform: "translate(" + (ziel - richtung * 5) + "px,-4px)", offset: .45 }, { transform: "translate(" + ziel + "px,10px)" }], { duration: 650, easing: "ease-in" }, nr));
        crew.querySelectorAll(".tz-body").forEach(function (body) { stuerze.push(bewegen(body, [{ transform: "rotate(0deg)" }, { transform: "rotate(" + richtung * 18 + "deg) scale(1,.88)" }, { transform: "rotate(" + richtung * 11 + "deg) scale(1,.9)" }], { duration: 650 }, nr)); });
      } else crew.querySelectorAll(".tz-body").forEach(function (body) { stuerze.push(bewegen(body, [{ transform: "translateY(0)" }, { transform: "translateY(-12px) rotate(-3deg)" }, { transform: "translateY(0)" }, { transform: "translateY(-5px)" }, { transform: "translateY(0)" }], { duration: 650 }, nr)); });
    });
    if (!(await Promise.all(stuerze)).every(Boolean)) return false;
    phase("schlamm");
    for (var i = 0; i < 12; i++) {
      var tropfen = effekt("tz-spritzer"); tropfen.style.left = ((gleich ? i % 2 ? 35 : 65 : l.seite === 0 ? 58 : 42) + (i % 3 - 1) * 4) + "%";
      bewegen(tropfen, [{ opacity: 0, transform: "translateY(0) scale(.3)" }, { opacity: 1, transform: "translate(" + (i % 2 ? 1 : -1) * (8 + i % 4 * 8) + "px,-35px) scale(1)", offset: .35 }, { opacity: 0, transform: "translate(" + (i % 2 ? 1 : -1) * (15 + i % 4 * 12) + "px,12px) scale(.7)" }], { duration: 650 }, nr);
    }
    root.setAttribute("data-ergebnis", gleich ? "unentschieden" : seiten[l.seite]); status.textContent = beschreibe(aktuell, true);
    if (!await warten(700, nr)) return false; schild.remove(); return true;
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
