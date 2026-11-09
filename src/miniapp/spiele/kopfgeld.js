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
function kopfgeldPosition(stand, hunter) {
  if (hunter == null) return { ziel: 50, jaeger: 26 };
  var last = kopfgeldLast(stand, hunter), ziel = kopfgeldWert(stand.gejagterLast);
  if (kopfgeldVorn(stand).includes(hunter)) return { ziel: 30, jaeger: 70 };
  return { ziel: 70, jaeger: 22 + Math.min(1, last / Math.max(1, ziel)) * 16 };
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
  dekor.innerHTML = '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice"><circle cx="322" cy="53" r="28" fill="#ffe9b3" stroke="#d98e4d" stroke-width="2"/><path d="M0 187L35 149 56 149 72 172 98 172 116 141 140 141 162 189 190 189 225 159 253 159 278 188 302 188 332 130 353 130 368 167 400 167V300H0Z" fill="#c47740" opacity=".55"/><path d="M0 222Q90 189 201 218T400 214V300H0Z" fill="#e2ae69" stroke="#aa7445" stroke-width="2"/><g fill="none" stroke="#6c7047" stroke-width="8" stroke-linecap="round"><path d="M375 225v-48m0 25h-13v-16m13 7h13v-17M25 222v-35m0 18H13v-12"/></g><path d="M13 276h23m105-26h24m115 23h26m45-30h18" stroke="#ba8850" stroke-width="3" stroke-linecap="round"/></svg>';
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
  var root = el("section", { class: "ms-scene ms-kopfgeld", "aria-label": "Kopfgeldjagd in der Western-Arena" }, [status, arena, el("div", { class: "kg-stand" }, [zielWert, jagdWert]), fenster, zeit, el("div", { class: "ms-steuerung" }, [skip, replay, laden]), hinweis]);
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
      var letzter = frames[frames.length - 1]; ["transform", "opacity", "left"].forEach(function (p) { if (letzter[p] != null) element.style[p] = letzter[p]; }); return true;
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
  function zeichnePaar(stand, hunter) {
    buehne.querySelectorAll(".kg-akteur,.kg-halteseil").forEach(function (e) { e.remove(); });
    var p = kopfgeldPosition(stand, hunter);
    return { ziel: akteur(stand.gejagter, "kg-gejagter", p.ziel, "bereit", stand), hunter: hunter != null ? akteur(hunter, "kg-jaeger", p.jaeger, "bereit", stand) : null };
  }
  function zeichneListe(stand, fertig) {
    var vorn = kopfgeldVorn(stand), beendet = fertig && a.abgeschlossen && spieler.has(stand.gejagter);
    root.setAttribute("data-ziel", stand.gejagter || ""); root.setAttribute("data-vorn", String(vorn.length));
    zielWert.textContent = name(stand.gejagter) + " · " + z(kopfgeldWert(stand.gejagterLast)) + " Last";
    jagdWert.textContent = vorn.length + (vorn.length === 1 ? " Jäger liegt davor" : " Jäger liegen davor");
    hinweis.textContent = "Nur mehr Wochenlast reicht fürs Kopfgeld. Bei Gleichstand bleibt " + name(stand.gejagter) + " frei. Entscheidend ist der Wochenabschluss.";
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
    if (a.abgeschlossen && bekannt) {
      root.setAttribute("data-ergebnis", vorn.length ? "gefangen" : "entkommen");
      if (vorn.length) {
        akteur(aktuell.gejagter, "kg-gejagter kg-gefangen", 20, "ko", aktuell);
        var helden = kopfgeldFokus(aktuell, a.spieler, vorn).slice(0, 2);
        helden.forEach(function (id, i) { akteur(id, "kg-held" + (helden.length > 1 ? " kg-gruppe" : ""), helden.length > 1 ? 57 + i * 25 : 70, "jubel", aktuell); });
        var ring = el("div", { class: "kg-halteseil" }); ring.style.left = "20%"; buehne.appendChild(ring);
        if (vorn.length > helden.length) effekt("kg-plus kg-statisch", "+" + (vorn.length - helden.length) + " kassieren mit");
      } else akteur(aktuell.gejagter, "kg-gejagter kg-solo", 50, "jubel", aktuell);
      effekt("kg-ergebnis kg-statisch", vorn.length ? "KOPFGELD KASSIERT" : "ENTKOMMEN!");
    } else zeichnePaar(aktuell, fokus(aktuell));
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
  function staub(nr, x) {
    for (var i = 0; i < 6; i++) {
      var e = effekt("kg-staub"); e.style.left = (x + i % 3 * 3 - 3) + "%";
      bewegen(e, [{ opacity: 0, transform: "translateY(0) scale(.3)" }, { opacity: .7, transform: "translateY(-9px) scale(1)", offset: .4 }, { opacity: 0, transform: "translateY(-25px) scale(1.5)" }], { duration: 560 }, nr).then(function (teil) { teil.remove(); }.bind(null, e));
    }
  }
  async function auftritt(stand, nr) {
    phase("auftritt"); buehne.replaceChildren(); status.textContent = "Rückblick · Gesucht: " + name(stand.gejagter);
    var poster = effekt("kg-poster"); poster.appendChild(el("strong", { class: "kg-wanted", text: "GESUCHT" }));
    poster.appendChild(minispielAvatar(a, stand.gejagter, "bereit"));
    poster.appendChild(el("strong", { class: "kg-poster-name", text: name(stand.gejagter), title: name(stand.gejagter) }));
    poster.appendChild(el("span", { class: "kg-poster-last", text: z(kopfgeldWert(stand.gejagterLast)) + " Lastpunkte" }));
    poster.appendChild(el("span", { class: "kg-poster-klein", text: "DIE KOPFGELDJAGD BEGINNT" }));
    if (!await bewegen(poster, [{ opacity: 0, transform: "translateY(-28px) rotate(-14deg) scale(.85)" }, { opacity: 1, transform: "translateY(4px) rotate(3deg) scale(1.03)" }, { opacity: 1, transform: "translateY(0) rotate(-3deg) scale(1)" }], { duration: 480, easing: "ease-out" }, nr)) return false;
    if (!await warten(360, nr)) return false;
    zeichnePaar(stand, fokus(stand));
    if (!await bewegen(poster, [{ opacity: 1, transform: "rotate(-3deg) scale(1)" }, { opacity: 0, transform: "translate(-75px,-35px) rotate(-12deg) scale(.4)" }], { duration: 220 }, nr)) return false;
    poster.remove(); return true;
  }
  async function zug(vorher, s, nr) {
    var w = kopfgeldWechsel(vorher, s), trainierende = a.spieler.filter(function (sp) { return kopfgeldLast(s.stand, sp.id) > kopfgeldLast(vorher, sp.id); }).map(function (sp) { return sp.id; });
    var k = w.dazu.length ? kopfgeldFokus(s.stand, a.spieler, w.dazu)[0] : w.weg.length ? kopfgeldFokus(vorher, a.spieler, w.weg)[0] : trainierende.find(function (id) { return id !== s.stand.gejagter; }) || fokus(s.stand);
    var paar = zeichnePaar(vorher, k), alt = kopfgeldPosition(vorher, k), neu = kopfgeldPosition(s.stand, k);
    if (w.korrektur || !w.training) {
      phase(w.korrektur ? "korrektur" : "rueckblick"); zeichneListe(s.stand, false); zeichnePaar(s.stand, fokus(s.stand));
      status.textContent = w.korrektur ? "Rückblick · Der Wochenverlauf wurde korrigiert" : beschreibe(s.stand, false); return warten(w.korrektur ? 550 : 260, nr);
    }
    phase("anlauf"); if (k != null) zeigeJaeger(k);
    status.textContent = trainierende.length === 1 ? name(trainierende[0]) + " legt nach" : "Die Jagd geht weiter";
    var bodies = [paar.ziel, paar.hunter].filter(Boolean).map(function (e) { return e.querySelector(".kg-koerper"); });
    if (!(await Promise.all(bodies.map(function (e) { return bewegen(e, [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(3px) rotate(-5deg)" }], { duration: 180 }, nr); }))).every(Boolean)) return false;
    phase("verfolgung"); staub(nr, neu.jaeger);
    var bewegungen = [];
    if (paar.ziel) bewegungen.push(bewegen(paar.ziel, [{ left: alt.ziel + "%" }, { left: neu.ziel + "%" }], { duration: 520, easing: "ease-in-out" }, nr));
    if (paar.hunter) bewegungen.push(bewegen(paar.hunter, [{ left: alt.jaeger + "%" }, { left: neu.jaeger + "%" }], { duration: 520, easing: "ease-in-out" }, nr));
    bodies.forEach(function (body) { bewegungen.push(bewegen(body, [{ transform: "translateY(3px) rotate(-5deg)" }, { transform: "translateY(-6px) rotate(4deg)" }, { transform: "translateY(0) rotate(-3deg)" }, { transform: "translateY(-4px) rotate(3deg)" }, { transform: "translateY(0) rotate(0deg)" }], { duration: 520 }, nr)); });
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false;
    zeichneListe(s.stand, false); if (k != null) zeigeJaeger(k);
    buehne.querySelectorAll(".kg-akteur").forEach(function (e) { e.querySelector(".kg-rolle").textContent = (e.classList.contains("kg-gejagter") ? "Gesucht" : "Jäger") + " · " + z(kopfgeldLast(s.stand, e.getAttribute("data-id"))) + " Last"; });
    phase(w.dazu.length ? "ueberholen" : w.weg.length ? "absetzen" : "aufholen");
    if (w.dazu.length && paar.hunter && paar.ziel) {
      status.textContent = name(k) + " liegt jetzt vor " + name(s.stand.gejagter) + ". Kopfgeld in Reichweite!";
      pose(paar.hunter, "schlag");
      var lasso = effekt("kg-lasso");
      if (!await bewegen(lasso, [{ left: neu.jaeger + "%", opacity: 0, transform: "translate(-50%,-35px) rotate(-100deg) scale(.3)" }, { left: (neu.jaeger + neu.ziel) / 2 + "%", opacity: 1, transform: "translate(-50%,-50px) rotate(-35deg) scale(.8)" }, { left: neu.ziel + "%", opacity: 1, transform: "translate(-50%,0) rotate(-12deg) scale(1)" }], { duration: 380 }, nr)) return false;
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
    phase("finale"); zeit.textContent = "Wochenabschluss"; buehne.replaceChildren(); zeichneListe(aktuell, true);
    var vorn = kopfgeldVorn(aktuell), schild = effekt("kg-banner", vorn.length ? "DAS KOPFGELD WIRD FÄLLIG" : "DIE LETZTE FLUCHT");
    status.textContent = vorn.length ? "Wochenabschluss · Die Jäger haben die Nase vorn" : "Wochenabschluss · Niemand hat mehr Last als " + name(aktuell.gejagter);
    if (!await warten(250, nr)) return false;
    if (vorn.length) {
      phase("kassieren"); var ziel = akteur(aktuell.gejagter, "kg-gejagter kg-gefangen", 20, "ko", aktuell);
      var ring = el("div", { class: "kg-halteseil" }); ring.style.left = "20%"; buehne.appendChild(ring);
      var helden = kopfgeldFokus(aktuell, a.spieler, vorn).slice(0, 2), spruenge = [];
      helden.forEach(function (id, i) { var e = akteur(id, "kg-held" + (helden.length > 1 ? " kg-gruppe" : ""), helden.length > 1 ? 57 + i * 25 : 70, "jubel", aktuell); spruenge.push(bewegen(e.querySelector(".kg-koerper"), [{ transform: "translateY(0)" }, { transform: "translateY(-12px) rotate(-3deg)" }, { transform: "translateY(0)" }, { transform: "translateY(-5px)" }, { transform: "translateY(0)" }], { duration: 700 }, nr)); });
      for (var i = 0; i < 10; i++) { var muenze = effekt("kg-muenze", "★"); muenze.style.left = (42 + i * 5) + "%"; bewegen(muenze, [{ opacity: 0, transform: "translateY(-15px) rotateY(0deg)" }, { opacity: 1, transform: "translateY(65px) rotateY(160deg)", offset: .35 }, { opacity: 0, transform: "translateY(185px) rotateY(300deg)" }], { duration: 950, delay: i % 3 * 30 }, nr); }
      spruenge.push(bewegen(ziel.querySelector(".kg-koerper"), [{ transform: "rotate(-7deg) translateY(-3px)" }, { transform: "rotate(4deg) translateY(5px)" }, { transform: "rotate(0deg) translateY(0)" }], { duration: 600 }, nr));
      if (!(await Promise.all(spruenge)).every(Boolean)) return false;
      if (!await warten(400, nr)) return false;
    } else {
      phase("entkommen"); var e = akteur(aktuell.gejagter, "kg-gejagter kg-solo", 50, "bereit", aktuell); staub(nr, 50);
      bewegen(e.querySelector(".kg-koerper"), [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-7px) rotate(7deg)" }, { transform: "translateY(0) rotate(0deg)" }], { duration: 600 }, nr);
      if (!await bewegen(e, [{ left: "50%", opacity: 1 }, { left: "112%", opacity: 0 }], { duration: 650, easing: "ease-in" }, nr)) return false;
      e.remove(); var held = akteur(aktuell.gejagter, "kg-gejagter kg-solo", 50, "jubel", aktuell);
      if (!await bewegen(held, [{ opacity: 0 }, { opacity: 1 }], { duration: 280 }, nr)) return false;
    }
    schild.remove(); return true;
  }
  async function spiele(ab, mitAuftritt) {
    lauf++; reinigen(); var nr = lauf; if (!root.isConnected) return;
    if (!bewegung() || document.hidden || !spieler.has(aktuell.gejagter)) { endstand(true); return; }
    kopfgeldAbbrechen = abbrechen; root.setAttribute("data-rueckblick", "true"); skip.hidden = false; replay.hidden = true; zeichneListe(stationen[ab].stand, false); station(ab);
    try {
      if (mitAuftritt && !await auftritt(stationen[ab].stand, nr)) return;
      if (!mitAuftritt) zeichnePaar(stationen[ab].stand, fokus(stationen[ab].stand)); phase("bereit"); status.textContent = beschreibe(stationen[ab].stand, false);
      if (!await warten(260, nr)) return;
      for (var index = ab + 1; index < stationen.length; index++) { station(index); if (!await zug(stationen[index - 1].stand, stationen[index], nr)) return; }
      if (a.abgeschlossen && !await finale(nr)) return;
    } finally { if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (kopfgeldAbbrechen === abbrechen) kopfgeldAbbrechen = null; } }
  }
  async function korrigiere() {
    lauf++; reinigen(); var nr = lauf; kopfgeldAbbrechen = abbrechen;
    phase("korrektur"); root.setAttribute("data-rueckblick", "true"); skip.hidden = false; replay.hidden = true;
    zeichneListe(aktuell, false); zeichnePaar(aktuell, fokus(aktuell)); status.textContent = "Der Wochenverlauf wurde korrigiert · Neuer Stand";
    await warten(bewegung() && !document.hidden ? 550 : 0, nr);
    if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (kopfgeldAbbrechen === abbrechen) kopfgeldAbbrechen = null; }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); }; endstand(false);
  requestAnimationFrame(function () { if (!root.isConnected) return; var ab = kopfgeldFortsetzung(gesehen && gesehen.signaturen, signaturen); if (ab === null) { if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(Math.max(0, stationen.length - 1), false); else endstand(true); } else if (gesehen && ab === 0) korrigiere(); else spiele(ab, !gesehen); });
  return root;
};
