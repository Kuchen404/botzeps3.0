/* Kopfgeld bleibt bis zum Wochenabschluss offen; die Jagd folgt echten Lastwerten. */
var kopfgeldStaende = {}, kopfgeldAbbrechen = null, kopfgeldFensterbreite = window.innerWidth;
var kopfgeldBewegungsWahl = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
document.addEventListener("visibilitychange", function () { if (document.hidden && kopfgeldAbbrechen) kopfgeldAbbrechen(); });
window.addEventListener("resize", function () {
  if (window.innerWidth !== kopfgeldFensterbreite && kopfgeldAbbrechen) kopfgeldAbbrechen();
  kopfgeldFensterbreite = window.innerWidth;
});
if (kopfgeldBewegungsWahl && kopfgeldBewegungsWahl.addEventListener) kopfgeldBewegungsWahl.addEventListener("change", function (e) {
  if (e.matches && kopfgeldAbbrechen) kopfgeldAbbrechen();
  document.querySelectorAll('.ms-kopfgeld[data-kopfphase="ende"]').forEach(function (s) { s.querySelector(".kg-replay").disabled = e.matches; });
});
function kopfgeldWert(n) { return typeof n === "number" && Number.isFinite(n) ? Math.max(0, n) : 0; }
function kopfgeldLast(stand, id) { return kopfgeldWert(id === stand.gejagter ? stand.gejagterLast : (stand.lasten || {})[id]); }
function kopfgeldVorn(stand) {
  return Array.from(new Set(stand.jaeger || [])).filter(function (id) { return id !== stand.gejagter && kopfgeldLast(stand, id) > kopfgeldWert(stand.gejagterLast); });
}
function kopfgeldWechsel(vorher, station) {
  var s = station.stand, alt = kopfgeldVorn(vorher), neu = kopfgeldVorn(s);
  var ids = Array.from(new Set(Object.keys(vorher.lasten || {}).concat(Object.keys(s.lasten || {}), [s.gejagter, vorher.gejagter])));
  var korrektur = station.art === "korrektur" || vorher.gejagter !== s.gejagter || ids.some(function (id) { return kopfgeldLast(s, id) < kopfgeldLast(vorher, id); });
  return { korrektur: korrektur, training: !korrektur && station.art === "training" && ids.some(function (id) { return kopfgeldLast(s, id) > kopfgeldLast(vorher, id); }),
    dazu: korrektur ? [] : neu.filter(function (id) { return !alt.includes(id); }), weg: korrektur ? [] : alt.filter(function (id) { return !neu.includes(id); }) };
}
function kopfgeldFokus(stand, spieler, kandidaten) {
  var jagd = spieler.filter(function (sp) { return sp.id !== stand.gejagter && (!kandidaten || kandidaten.includes(sp.id)); });
  return jagd.slice().sort(function (x, y) { return Number(!!y.ich) - Number(!!x.ich) || kopfgeldLast(stand, y.id) - kopfgeldLast(stand, x.id); }).map(function (sp) { return sp.id; });
}
// Die ganze Route bleibt sichtbar. Formation und Abstand sind schematisch;
// die Reihenfolge folgt der Last, bei Gleichstand steht der Gejagte davor.
function kopfgeldWeg(p) {
  var punkte = [[12,32],[86,32],[86,52],[14,52],[14,72],[86,72],[86,92],[15,92]];
  var laengen = [], gesamt = 0;
  for (var i = 1; i < punkte.length; i++) { var l = Math.hypot((punkte[i][0]-punkte[i-1][0])*4, (punkte[i][1]-punkte[i-1][1])*4.2); laengen.push(l); gesamt += l; }
  var rest = Math.max(0, Math.min(1, p)) * gesamt;
  for (var j = 0; j < laengen.length; j++) {
    if (rest <= laengen[j] || j === laengen.length-1) { var t = rest/laengen[j]; return { x: punkte[j][0]+(punkte[j+1][0]-punkte[j][0])*t, y: punkte[j][1]+(punkte[j+1][1]-punkte[j][1])*t }; }
    rest -= laengen[j];
  }
}
function kopfgeldLaufplan(stand, spieler, skala) {
  var n = spieler.length, raum = Math.min(.68, Math.max(.24, n*.014));
  var sortiert = spieler.map(function (sp, i) { return { id:sp.id, index:i, last:kopfgeldLast(stand,sp.id) }; }).sort(function (x,y) {
    return x.last-y.last || Number(x.id === stand.gejagter)-Number(y.id === stand.gejagter) || x.index-y.index;
  });
  return new Map(sortiert.map(function (sp,i) {
    var fortschritt = .04 + (n>1 ? i/(n-1)*raum : raum/2) + Math.min(1,sp.last/Math.max(1,skala))*(.92-raum);
    var spur = (sp.index % (n>20 ? 4 : 3) - (n>20 ? 1.5 : 1))*(n>20 ? 3 : 1.7);
    var punkt = kopfgeldWeg(fortschritt);
    return [sp.id,{ fortschritt:fortschritt, spur:spur, x:punkt.x, y:punkt.y+spur }];
  }));
}
function kopfgeldLaufFrames(vor, nach) {
  var schritte = Math.max(1,Math.ceil(Math.abs(nach.fortschritt-vor.fortschritt)/.012)), frames=[];
  for(var i=0;i<=schritte;i++) { var t=i/schritte, punkt=kopfgeldWeg(vor.fortschritt+(nach.fortschritt-vor.fortschritt)*t); frames.push({left:punkt.x+"%",top:(punkt.y+vor.spur+(nach.spur-vor.spur)*t)+"%",offset:t}); }
  return frames;
}
function kopfgeldFortsetzung(alt, neu) {
  if (!neu.length) return null;
  if (!alt || !alt.length || !alt.every(function (s, i) { return s === neu[i]; })) return 0;
  return alt.length === neu.length ? null : alt.length - 1;
}
function kopfgeldSignaturen(stationen) { return stationen.map(function (s) { return JSON.stringify([s.art, s.stand]); }); }
window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
window.MINISPIEL_SZENEN.kopfgeld = function (a) {
  if (kopfgeldAbbrechen) kopfgeldAbbrechen();
  var gesehen = kopfgeldStaende[a.id], spieler = new Map(a.spieler.map(function (sp) { return [sp.id, sp]; }));
  var aktuell = a.aktuell || { gejagter: null, gejagterLast: 0, jaeger: [], lasten: {} };
  var stationen = (a.verlauf || []).filter(function (s) { return !!s.stand; });
  if (!stationen.length) stationen = [{ zeitpunkt: null, art: "start", stand: aktuell }];
  var signaturen = kopfgeldSignaturen(stationen), skala = 1;
  [aktuell].concat(stationen.map(function (s) { return s.stand; })).forEach(function (s) {
    skala = Math.max(skala, kopfgeldWert(s.gejagterLast)); Object.keys(s.lasten || {}).forEach(function (id) { skala = Math.max(skala, kopfgeldLast(s, id)); });
  });
  var status = el("div", { class: "ms-status", role: "status", "aria-live": "polite" });
  var dekor = el("div", { class: "kg-dekor", "aria-hidden": "true" });
  dekor.innerHTML = '<svg viewBox="0 0 400 420" preserveAspectRatio="none"><circle cx="326" cy="43" r="24" fill="#ffe9b3" stroke="#d98e4d" stroke-width="2"/><path d="M0 70L30 42H52L70 70H100L117 34H142L160 70H200L220 50H250L267 70H400V420H0Z" fill="#c8874e" opacity=".3"/><path d="M48 134.4H344V218.4H56V302.4H344V386.4H60" fill="none" stroke="#aa7845" stroke-width="60" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 134.4H344V218.4H56V302.4H344V386.4H60" fill="none" stroke="#efd099" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 134.4H344V218.4H56V302.4H344V386.4H60" fill="none" stroke="#c49a62" stroke-width="2" stroke-dasharray="4 10"/><g fill="none" stroke="#6c7047" stroke-width="7" stroke-linecap="round"><path d="M24 305v-30m0 14H12v-11M367 246v-33m0 17h14v-10M192 354v-24m0 14h-12v-10"/></g><g fill="#b27a45"><ellipse cx="175" cy="151" rx="11" ry="5"/><ellipse cx="248" cy="242" rx="15" ry="5"/></g></svg>';
  dekor.appendChild(el("span", {class:"kg-start",text:"START"})); dekor.appendChild(el("span", {class:"kg-versteck",text:"VERSTECK"}));
  var buehne = el("div", { class: "kg-buehne", "aria-hidden": "true" });
  var arena = el("div", { class: "kg-arena" }, [dekor, buehne]);
  var zielWert = el("div", { class: "kg-zielwert" }), jagdWert = el("div", { class: "kg-jagdwert" });
  var roster = el("div", { class: "kg-roster", role: "list", "aria-label": "Kopfgeldjäger und ihre tatsächliche Wochenlast" });
  var fenster = el("div", { class: "kg-fenster", tabindex: "0", "aria-label": "Alle Kopfgeldjäger, seitlich scrollbar" }, [roster]);
  var zeit = el("div", { class: "ms-zeit" });
  var skip = el("button", { class: "knopf leise", text: "Überspringen" });
  var replay = el("button", { class: "knopf leise kg-replay", text: "↻ Nochmal ansehen" });
  var laden = el("button", { class: "knopf leise", text: "↻ Stand aktualisieren", onclick: function () { aktualisiereBombe(laden); } });
  var hinweis = el("p", { class: "kg-hinweis" });
  var root = el("section", { class: "ms-scene ms-kopfgeld", "aria-label": "Kopfgeldjagd auf der vollständigen Laufstrecke" }, [status, arena, el("div", { class: "kg-stand" }, [zielWert, jagdWert]), fenster, zeit, el("div", { class: "ms-steuerung" }, [skip, replay, laden]), hinweis]);
  var lauf = 0, animationen = new Set(), wartende = new Map();
  function bewegung() { return !(kopfgeldBewegungsWahl && kopfgeldBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && root.isConnected && !document.hidden && bewegung(); }
  function phase(p) { root.setAttribute("data-kopfphase", p); }
  function name(id) { return spieler.has(id) ? spieler.get(id).name : "Unbekannt"; }
  function z(n) { return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }); }
  function reinigen() {
    animationen.forEach(function (anim) { anim.cancel(); }); animationen.clear();
    wartende.forEach(function (resolve, timer) { clearTimeout(timer); resolve(false); }); wartende.clear();
    buehne.replaceChildren(); arena.style.transform = ""; root.removeAttribute("data-ergebnis");
  }
  function warten(ms, nr) {
    return new Promise(function (resolve) { var timer = setTimeout(function () { wartende.delete(timer); resolve(gueltig(nr)); }, ms); wartende.set(timer, resolve); });
  }
  function bewegen(element, frames, optionen, nr) {
    if (!gueltig(nr)) return Promise.resolve(false);
    var anim = element.animate(frames, Object.assign({ fill: "forwards" }, optionen)); animationen.add(anim);
    return anim.finished.then(function () {
      if (!gueltig(nr)) return false;
      var letzter = frames[frames.length - 1]; ["transform", "opacity", "left", "top"].forEach(function (p) { if (letzter[p] != null) element.style[p] = letzter[p]; }); return true;
    }, function () { return false; }).finally(function () { animationen.delete(anim); anim.cancel(); });
  }
  function effekt(klasse, text) { var e = el("div", { class: "kg-effekt " + klasse, text: text || "" }); buehne.appendChild(e); return e; }
  function pose(e, p) { minispielSetzePose(e.querySelector(".ms-avatar"), a, e.getAttribute("data-id"), p); }
  function akteur(id, rolle, x, p, stand) {
    if (!spieler.has(id)) return null;
    var e = el("div", { class: "kg-akteur " + rolle, "data-id": id, "data-ich": String(!!spieler.get(id).ich) }, [
      el("div", { class: "kg-koerper" }, [minispielAvatar(a, id, p)]),
      el("div", { class: "kg-name", text: name(id) + (spieler.get(id).ich ? " · Du" : ""), title: name(id) }),
      el("div", { class: "kg-rolle", text: (rolle.includes("kg-gejagter") ? "Gesucht" : "Jäger") + " · " + z(kopfgeldLast(stand, id)) + " Last" })
    ]);
    e.style.left = x + "%"; buehne.appendChild(e); return e;
  }
  function fokus(stand) {
    var vorn = kopfgeldVorn(stand); return kopfgeldFokus(stand, a.spieler, vorn.length ? vorn : undefined)[0] || null;
  }
  function laufplan(stand) { return kopfgeldLaufplan(stand,a.spieler,skala); }
  function zeichneJagd(stand, fertig) {
    buehne.querySelectorAll(".kg-akteur,.kg-halteseil").forEach(function (e) { e.remove(); });
    var plan=laufplan(stand), vorn=kopfgeldVorn(stand), bekannt=spieler.has(stand.gejagter), resultate=new Map();
    root.setAttribute("data-feld",a.spieler.length>20?"gross":a.spieler.length>8?"mittel":"normal");
    a.spieler.forEach(function(sp) {
      var ziel=sp.id===stand.gejagter, sieger=fertig&&a.abgeschlossen&&bekannt&&vorn.includes(sp.id);
      var p=plan.get(sp.id), pose=ziel&&fertig&&a.abgeschlossen ? vorn.length ? "ko":"jubel" : sieger?"jubel":"bereit";
      if(ziel&&fertig&&a.abgeschlossen&&!vorn.length) { var ende=kopfgeldWeg(1);p={x:ende.x,y:ende.y}; }
      var e=akteur(sp.id,"kg-route "+(ziel?"kg-gejagter":sieger?"kg-held":"kg-jaeger"),p.x,pose,stand);
      e.style.top=p.y+"%"; e.title=sp.name+" · "+z(kopfgeldLast(stand,sp.id))+" Last";
      if(ziel) e.appendChild(el("span",{class:"kg-gesucht",text:"GESUCHT"}));
      resultate.set(sp.id,e);
    });
    if(fertig&&a.abgeschlossen&&bekannt&&vorn.length) halteseil(plan.get(stand.gejagter));
    return resultate;
  }
  function halteseil(p) { var ring=el("div",{class:"kg-halteseil"});ring.style.left=p.x+"%";ring.style.top=p.y+"%";buehne.appendChild(ring); }
  function zeichneListe(stand, fertig) {
    var vorn = kopfgeldVorn(stand), beendet = fertig && a.abgeschlossen && spieler.has(stand.gejagter);
    root.setAttribute("data-ziel", stand.gejagter || ""); root.setAttribute("data-vorn", String(vorn.length));
    zielWert.textContent = name(stand.gejagter) + " · " + z(kopfgeldWert(stand.gejagterLast)) + " Last";
    jagdWert.textContent = vorn.length + (vorn.length === 1 ? " Jäger liegt davor" : " Jäger liegen davor");
    hinweis.textContent = "Nur mehr Wochenlast reicht fürs Kopfgeld. Bei Gleichstand bleibt " + name(stand.gejagter) + " frei. Entscheidend ist der Wochenabschluss. Die Laufabstände sind schematisch.";
    roster.replaceChildren();
    a.spieler.filter(function (sp) { return sp.id !== stand.gejagter; }).forEach(function (sp) {
      var last = kopfgeldLast(stand, sp.id), hat = vorn.includes(sp.id), gleich = last === kopfgeldWert(stand.gejagterLast);
      var badge = hat ? beendet ? "Kassiert" : "Vorn" : gleich ? "Gleichauf" : "Aufholen";
      var balken = el("div", { class: "kg-balken", "aria-hidden": "true" }, [el("i"), el("b")]);
      balken.firstChild.style.width = Math.min(100, last / skala * 100) + "%";
      balken.lastChild.style.left = Math.min(100, kopfgeldWert(stand.gejagterLast) / skala * 100) + "%";
      roster.appendChild(el("div", { class: "kg-person" + (hat ? " kg-vorn" : ""), role: "listitem", "data-id": sp.id, "data-vorn": String(hat), "data-ich": String(!!sp.ich), "aria-label": sp.name + ", " + z(last) + " Last, " + badge }, [
        minispielAvatar(a, sp.id, beendet && hat ? "jubel" : "bereit"), el("span", { class: "kg-roster-name", text: sp.name + (sp.ich ? " · Du" : ""), title: sp.name }),
        el("span", { class: "kg-roster-last", text: z(last) }), el("span", { class: "kg-badge", text: badge }), balken
      ]));
    });
    if (!roster.children.length) roster.appendChild(el("p", { class: "kg-leer", text: a.spieler.length ? "Noch keine Verfolger dabei." : "Noch keine Spieler für die Jagd." }));
  }
  function zeigeJaeger(id) { var e = Array.from(roster.children).find(function (e) { return e.getAttribute("data-id") === id; }); if (e) fenster.scrollLeft = Math.max(0, e.offsetLeft + e.offsetWidth / 2 - fenster.clientWidth / 2); }
  function beschreibe(stand, fertig) {
    if (!a.spieler.length) return "Noch keine Spieler für die Kopfgeldjagd.";
    if (!spieler.has(stand.gejagter)) return "Der Gejagte ist aktuell nicht verfügbar.";
    var vorn = kopfgeldVorn(stand);
    if (fertig && a.abgeschlossen) return vorn.length ? (vorn.length === 1 ? name(vorn[0]) + " kassiert das Kopfgeld!" : vorn.length + " Jäger kassieren das Kopfgeld!") : name(stand.gejagter) + " ist entkommen! Niemand lag darüber.";
    return vorn.length ? vorn.length + (vorn.length === 1 ? " Jäger liegt vor " : " Jäger liegen vor ") + name(stand.gejagter) + ". Das Kopfgeld bleibt bis zum Abschluss offen." : name(stand.gejagter) + " ist frei. Gleichstand reicht den Jägern nicht.";
  }
  function endstand(merken) {
    buehne.replaceChildren(); phase("ende"); root.setAttribute("data-rueckblick", "false"); root.removeAttribute("data-ergebnis"); zeichneListe(aktuell, true);
    var vorn = kopfgeldVorn(aktuell), bekannt = spieler.has(aktuell.gejagter);
    zeichneJagd(aktuell, true);
    if (a.abgeschlossen && bekannt) {
      root.setAttribute("data-ergebnis", vorn.length ? "gefangen" : "entkommen");
      effekt("kg-ergebnis kg-statisch", vorn.length ? "KOPFGELD KASSIERT" : "ENTKOMMEN!");
    }
    status.textContent = beschreibe(aktuell, true); zeit.textContent = a.abgeschlossen ? "Wochenabschluss" : "Aktueller Stand";
    var ich = a.spieler.find(function (sp) { return sp.ich && sp.id !== aktuell.gejagter; }); if (ich) zeigeJaeger(ich.id);
    skip.hidden = true; replay.hidden = !bekannt; replay.disabled = !bewegung();
    if (merken && root.isConnected) kopfgeldStaende[a.id] = { signaturen: signaturen, abgeschlossen: !!a.abgeschlossen };
  }
  function abbrechen() { lauf++; reinigen(); endstand(true); if (kopfgeldAbbrechen === abbrechen) kopfgeldAbbrechen = null; }
  function station(index) {
    var s = stationen[index], d = s.zeitpunkt && new Date(s.zeitpunkt);
    zeit.textContent = (index + 1) + " / " + stationen.length + (d && !Number.isNaN(d.getTime()) ? " · " + d.toLocaleString("de-DE", { timeZone: a.zeitzone || "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "") + (s.art === "korrektur" ? " · Korrektur" : "");
  }
  function staub(nr, x, y) {
    for (var i = 0; i < 6; i++) {
      var e = effekt("kg-staub"); e.style.left = (x + i % 3 * 2 - 2) + "%"; e.style.top=(y || 60)+"%";
      bewegen(e, [{ opacity: 0, transform: "translateY(0) scale(.3)" }, { opacity: .7, transform: "translateY(-9px) scale(1)", offset: .4 }, { opacity: 0, transform: "translateY(-25px) scale(1.5)" }], { duration: 560 }, nr).then(function (teil) { teil.remove(); }.bind(null, e));
    }
  }
  async function auftritt(stand, nr) {
    phase("auftritt"); buehne.replaceChildren(); zeichneJagd(stand,false); status.textContent = "Rückblick · Gesucht: " + name(stand.gejagter);
    var poster = effekt("kg-poster"); poster.appendChild(el("strong", { class: "kg-wanted", text: "GESUCHT" }));
    poster.appendChild(minispielAvatar(a, stand.gejagter, "bereit"));
    poster.appendChild(el("strong", { class: "kg-poster-name", text: name(stand.gejagter), title: name(stand.gejagter) }));
    poster.appendChild(el("span", { class: "kg-poster-last", text: z(kopfgeldWert(stand.gejagterLast)) + " Lastpunkte" }));
    poster.appendChild(el("span", { class: "kg-poster-klein", text: "DIE KOPFGELDJAGD BEGINNT" }));
    if (!await bewegen(poster, [{ opacity: 0, transform: "translateY(-28px) rotate(-14deg) scale(.85)" }, { opacity: 1, transform: "translateY(4px) rotate(3deg) scale(1.03)" }, { opacity: 1, transform: "translateY(0) rotate(-3deg) scale(1)" }], { duration: 480, easing: "ease-out" }, nr)) return false;
    if (!await warten(360, nr)) return false;
    zeichneJagd(stand, false);
    if (!await bewegen(poster, [{ opacity: 1, transform: "rotate(-3deg) scale(1)" }, { opacity: 0, transform: "translate(-75px,-35px) rotate(-12deg) scale(.4)" }], { duration: 220 }, nr)) return false;
    poster.remove(); return true;
  }
  async function zug(vorher, s, nr) {
    var w = kopfgeldWechsel(vorher, s), trainierende = a.spieler.filter(function (sp) { return kopfgeldLast(s.stand, sp.id) > kopfgeldLast(vorher, sp.id); }).map(function (sp) { return sp.id; });
    var k = w.dazu.length ? kopfgeldFokus(s.stand, a.spieler, w.dazu)[0] : w.weg.length ? kopfgeldFokus(vorher, a.spieler, w.weg)[0] : trainierende.find(function (id) { return id !== s.stand.gejagter; }) || fokus(s.stand);
    var feld=zeichneJagd(vorher,false), alt=laufplan(vorher), neu=laufplan(s.stand);
    var paar={ziel:feld.get(s.stand.gejagter),hunter:feld.get(k)};
    if (w.korrektur || !w.training) {
      phase(w.korrektur ? "korrektur" : "rueckblick"); zeichneListe(s.stand, false); zeichneJagd(s.stand, false);
      status.textContent = w.korrektur ? "Rückblick · Der Wochenverlauf wurde korrigiert" : beschreibe(s.stand, false); return warten(w.korrektur ? 550 : 260, nr);
    }
    phase("anlauf"); if (k != null) zeigeJaeger(k);
    status.textContent = trainierende.length === 1 ? name(trainierende[0]) + " legt nach" : "Die Jagd geht weiter";
    var bodies = Array.from(feld.values()).map(function(e) {return e.querySelector(".kg-koerper");});
    if (!(await Promise.all(bodies.map(function (e) { return bewegen(e, [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(3px) rotate(-5deg)" }], { duration: 180 }, nr); }))).every(Boolean)) return false;
    phase("verfolgung"); var staubPunkt=neu.get(k)||neu.get(s.stand.gejagter);if(staubPunkt)staub(nr,staubPunkt.x,staubPunkt.y);
    var bewegungen = [];
    feld.forEach(function(e,id) { bewegungen.push(bewegen(e,kopfgeldLaufFrames(alt.get(id),neu.get(id)),{duration:900,easing:"ease-in-out"},nr)); });
    bodies.forEach(function (body) { bewegungen.push(bewegen(body, [{ transform: "translateY(3px) rotate(-5deg)" }, { transform: "translateY(-6px) rotate(4deg)" }, { transform: "translateY(0) rotate(-3deg)" }, { transform: "translateY(-4px) rotate(3deg)" }, { transform: "translateY(0) rotate(0deg)" }], { duration: 900 }, nr)); });
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false;
    zeichneListe(s.stand, false); if (k != null) zeigeJaeger(k);
    buehne.querySelectorAll(".kg-akteur").forEach(function (e) { e.querySelector(".kg-rolle").textContent = (e.classList.contains("kg-gejagter") ? "Gesucht" : "Jäger") + " · " + z(kopfgeldLast(s.stand, e.getAttribute("data-id"))) + " Last"; });
    phase(w.dazu.length ? "ueberholen" : w.weg.length ? "absetzen" : "aufholen");
    if (w.dazu.length && paar.hunter && paar.ziel) {
      status.textContent = name(k) + " liegt jetzt vor " + name(s.stand.gejagter) + ". Kopfgeld in Reichweite!";
      pose(paar.hunter, "schlag");
      var lasso = effekt("kg-lasso"), von=neu.get(k), zu=neu.get(s.stand.gejagter);
      if (!await bewegen(lasso, [{ left:von.x+"%",top:von.y+"%",opacity:0,transform:"translate(-50%,-35px) rotate(-100deg) scale(.3)" }, {left:(von.x+zu.x)/2+"%",top:((von.y+zu.y)/2-9)+"%",opacity:1,transform:"translate(-50%,-35px) rotate(-35deg) scale(.8)"}, {left:zu.x+"%",top:zu.y+"%",opacity:1,transform:"translate(-50%,-35px) rotate(-12deg) scale(1)"}], {duration:380}, nr)) return false;
      phase("reaktion");
      bewegen(paar.ziel.querySelector(".kg-koerper"), [{ transform: "rotate(0deg)" }, { transform: "translateX(-4px) rotate(-7deg)" }, { transform: "rotate(0deg)" }], { duration: 220 }, nr);
      if (!await bewegen(lasso, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }, nr)) return false;
      lasso.remove(); pose(paar.hunter, "bereit");
    } else if (w.weg.length) {
      var gleich = k != null && kopfgeldLast(s.stand, k) === kopfgeldWert(s.stand.gejagterLast);
      status.textContent = gleich ? "Gleichstand! " + name(s.stand.gejagter) + " entzieht sich " + name(k) : name(s.stand.gejagter) + " setzt sich von " + (w.weg.length > 1 ? w.weg.length + " Jägern" : name(k)) + " ab";
      if (paar.hunter) bewegen(paar.hunter.querySelector(".kg-koerper"), [{ transform: "rotate(0deg)" }, { transform: "rotate(8deg) translateY(3px)" }, { transform: "rotate(0deg)" }], { duration: 280 }, nr);
      if (!await warten(320, nr)) return false;
    } else if (!await warten(180, nr)) return false;
    return true;
  }
  async function finale(nr) {
    if (!spieler.has(aktuell.gejagter)) return true;
    phase("finale"); zeit.textContent="Wochenabschluss"; buehne.replaceChildren(); zeichneListe(aktuell,true);
    var vorn=kopfgeldVorn(aktuell), feld=zeichneJagd(aktuell,false), plan=laufplan(aktuell);
    var schild=effekt("kg-banner",vorn.length?"DAS KOPFGELD WIRD FÄLLIG":"DIE LETZTE FLUCHT");
    status.textContent=vorn.length?"Wochenabschluss · Die Jäger haben die Nase vorn":"Wochenabschluss · Niemand hat mehr Last als "+name(aktuell.gejagter);
    if(!await warten(250,nr))return false;
    if(vorn.length) {
      phase("kassieren"); var ziel=feld.get(aktuell.gejagter); pose(ziel,"ko");halteseil(plan.get(aktuell.gejagter));var spruenge=[];
      vorn.forEach(function(id){var e=feld.get(id);if(!e)return;pose(e,"jubel");spruenge.push(bewegen(e.querySelector(".kg-koerper"),[{transform:"translateY(0)"},{transform:"translateY(-9px) rotate(-3deg)"},{transform:"translateY(0)"},{transform:"translateY(-4px)"},{transform:"translateY(0)"}],{duration:700},nr));});
      for(var i=0;i<10;i++){var muenze=effekt("kg-muenze","★");muenze.style.left=(30+i*5)+"%";bewegen(muenze,[{opacity:0,transform:"translateY(0) rotateY(0deg)"},{opacity:1,transform:"translateY(65px) rotateY(160deg)",offset:.35},{opacity:0,transform:"translateY(250px) rotateY(300deg)"}],{duration:950,delay:i%3*30},nr);}
      spruenge.push(bewegen(ziel.querySelector(".kg-koerper"),[{transform:"rotate(-7deg)"},{transform:"rotate(4deg) translateY(3px)"},{transform:"rotate(0deg)"}],{duration:600},nr));
      if(!(await Promise.all(spruenge)).every(Boolean))return false;
      if(!await warten(400,nr))return false;
    }else{
      phase("entkommen");var e=feld.get(aktuell.gejagter), von=plan.get(aktuell.gejagter), nach={fortschritt:1,spur:0};
      staub(nr,von.x,von.y);
      bewegen(e.querySelector(".kg-koerper"),[{transform:"translateY(0)"},{transform:"translateY(-6px) rotate(6deg)"},{transform:"translateY(0)"}],{duration:900,iterations:2},nr);
      if(!await bewegen(e,kopfgeldLaufFrames(von,nach),{duration:1600,easing:"ease-in-out"},nr))return false;
      pose(e,"jubel");if(!await warten(300,nr))return false;
    }
    schild.remove();return true;
  }
  async function spiele(ab, mitAuftritt) {
    lauf++; reinigen(); var nr = lauf; if (!root.isConnected) return;
    if (!bewegung() || document.hidden || !spieler.has(aktuell.gejagter)) { endstand(true); return; }
    kopfgeldAbbrechen = abbrechen; root.setAttribute("data-rueckblick", "true"); skip.hidden = false; replay.hidden = true; zeichneListe(stationen[ab].stand, false); station(ab);
    try {
      if (mitAuftritt && !await auftritt(stationen[ab].stand, nr)) return;
      if (!mitAuftritt) zeichneJagd(stationen[ab].stand, false); phase("bereit"); status.textContent = beschreibe(stationen[ab].stand, false);
      if (!await warten(260, nr)) return;
      for (var index = ab + 1; index < stationen.length; index++) { station(index); if (!await zug(stationen[index - 1].stand, stationen[index], nr)) return; }
      if (a.abgeschlossen && !await finale(nr)) return;
    } finally { if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (kopfgeldAbbrechen === abbrechen) kopfgeldAbbrechen = null; } }
  }
  async function korrigiere() {
    lauf++; reinigen(); var nr = lauf; kopfgeldAbbrechen = abbrechen;
    phase("korrektur"); root.setAttribute("data-rueckblick", "true"); skip.hidden = false; replay.hidden = true;
    zeichneListe(aktuell, false); zeichneJagd(aktuell, false); status.textContent = "Der Wochenverlauf wurde korrigiert · Neuer Stand";
    await warten(bewegung() && !document.hidden ? 550 : 0, nr);
    if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (kopfgeldAbbrechen === abbrechen) kopfgeldAbbrechen = null; }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); }; endstand(false);
  requestAnimationFrame(function () { if (!root.isConnected) return; var ab = kopfgeldFortsetzung(gesehen && gesehen.signaturen, signaturen); if (ab === null) { if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(Math.max(0, stationen.length - 1), false); else endstand(true); } else if (gesehen && ab === 0) korrigiere(); else spiele(ab, !gesehen); });
  return root;
};
