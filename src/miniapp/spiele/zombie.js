/* Eigene Ablaufsteuerung: ein Biss darf vor dem nächsten Zeitabschnitt zu Ende spielen. */
var zombieStaende = {}, zombieAbbrechen = null, zombieFensterbreite = window.innerWidth;
var zombieBewegungsWahl = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
document.addEventListener("visibilitychange", function () { if (document.hidden && zombieAbbrechen) zombieAbbrechen(); });
window.addEventListener("resize", function () {
  if (window.innerWidth !== zombieFensterbreite && zombieAbbrechen) zombieAbbrechen();
  zombieFensterbreite = window.innerWidth;
});
if (zombieBewegungsWahl && zombieBewegungsWahl.addEventListener) zombieBewegungsWahl.addEventListener("change", function (e) {
  if (e.matches && zombieAbbrechen) zombieAbbrechen();
  document.querySelectorAll('.ms-zombie[data-zombiephase="ende"]').forEach(function (s) {
    s.classList.toggle("zg-live", !e.matches && s.getAttribute("data-abgeschlossen") !== "true");
    s.querySelector(".zg-replay").disabled = e.matches;
  });
});
function zombieInfizierte(stand) {
  var ids = new Set((stand.zombies || []).map(function (z) { return z.id; }));
  if (stand.patientNull != null) ids.add(stand.patientNull);
  return ids;
}
function zombieWechsel(vorher, station) {
  var alt = zombieInfizierte(vorher), neu = zombieInfizierte(station.stand);
  var korrektur = station.art === "korrektur" || vorher.patientNull !== station.stand.patientNull || Array.from(alt).some(function (id) { return !neu.has(id); });
  return { korrektur: korrektur, bisse: korrektur ? [] : Array.from(neu).filter(function (id) { return !alt.has(id) && id !== station.stand.patientNull; }) };
}
function zombieFortsetzung(alt, neu) {
  if (!neu.length) return null;
  if (!alt || !alt.length || !alt.every(function (s, i) { return s === neu[i]; })) return 0;
  return alt.length === neu.length ? null : alt.length - 1;
}
function zombieSignaturen(stationen) {
  // Vor der Morgenmeldung trägt der aktuelle Tagesstand die jeweilige Abrufzeit.
  // Eine neue Abrufzeit allein ist kein neuer Biss und wiederholt keinen Rückblick.
  return stationen.map(function (s) { return JSON.stringify([s.art, s.stand]); });
}
function zombieSzene(a, kulisse) {
  if (zombieAbbrechen) zombieAbbrechen();
  var gesehen = zombieStaende[a.id], spieler = Object.create(null);
  a.spieler.forEach(function (sp) { spieler[sp.id] = sp; });
  var aktuell = a.aktuell || { patientNull: null, zombies: [], menschen: a.spieler.map(function (sp) { return sp.id; }) };
  var stationen = (a.verlauf || []).filter(function (s) { return !!s.stand; });
  if (!stationen.length) stationen = [{ zeitpunkt: null, art: "start", stand: aktuell }];
  var signaturen = zombieSignaturen(stationen);
  var status = el("div", { class: "ms-status", role: "status", "aria-live": "polite" });
  var titel = el("strong"), geschichte = el("p", { class: "zg-story" });
  var tage = el("span", { class: "zg-day" }), menschZahl = el("span"), zombieZahl = el("span");
  var hintergrund = el("div", { "aria-hidden": "true" }); hintergrund.innerHTML = kulisse;
  var buehne = el("div", { class: "zg-stage", "aria-hidden": "true" });
  var raum = el("div", { class: "zg-room" }, [el("div", { class: "zg-floor", "aria-hidden": "true" }), hintergrund, buehne]);
  var roster = el("div", { class: "zg-roster", role: "list", "aria-label": "Alle Spieler und ihr Infektionsstatus" });
  var fenster = el("div", { class: "zg-fenster", tabindex: "0", "aria-label": "Spieler im Gym, seitlich scrollbar" }, [roster]);
  var zeit = el("div", { class: "ms-zeit" });
  var skip = el("button", { class: "knopf leise", text: "Überspringen" });
  var replay = el("button", { class: "knopf leise zg-replay", text: "↻ Nochmal ansehen" });
  var laden = el("button", { class: "knopf leise", text: "↻ Stand aktualisieren", onclick: function () { aktualisiereBombe(laden); } });
  var wurzel = el("section", { class: "ms-scene ms-zombie zombie-gym", "aria-label": "Zombie-Woche im verlassenen Gym", "data-abgeschlossen": String(!!a.abgeschlossen) }, [
    status, el("div", { class: "zg-top" }, [el("div", { class: "zg-heading" }, [titel, tage]), geschichte]), raum,
    el("div", { class: "zg-bottom" }, [el("span", { class: "zg-counter" }, [el("i", { class: "zg-dot", "aria-hidden": "true" }), menschZahl]), el("span", { class: "zg-counter zg-infected" }, [el("i", { class: "zg-dot", "aria-hidden": "true" }), zombieZahl])]),
    fenster, zeit, el("div", { class: "ms-steuerung" }, [skip, replay, laden]),
    el("p", { class: "zg-rule", text: "Zwei Tage am Stück ohne Training: gebissen. Patient Null ist von Anfang an Zombie. Ein Biss bleibt bis zum Ende der Woche." })
  ]);
  var lauf = 0, animationen = new Set(), wartende = new Map();
  function bewegung() { return !(zombieBewegungsWahl && zombieBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && wurzel.isConnected && !document.hidden && bewegung(); }
  function phase(p) { wurzel.setAttribute("data-zombiephase", p); }
  function reinigen() {
    animationen.forEach(function (anim) { anim.cancel(); }); animationen.clear();
    wartende.forEach(function (resolve, timer) { clearTimeout(timer); resolve(false); }); wartende.clear();
    buehne.replaceChildren(); raum.style.transform = ""; wurzel.classList.remove("zg-live");
    roster.querySelectorAll(".zg-schreck").forEach(function (e) { e.classList.remove("zg-schreck"); });
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
      ["transform", "opacity", "filter"].forEach(function (p) { if (letzter[p] != null) element.style[p] = letzter[p]; });
      return true;
    }, function () { return false; }).finally(function () { animationen.delete(anim); anim.cancel(); });
  }
  function menschen(stand) { var ids = zombieInfizierte(stand); return a.spieler.filter(function (sp) { return !ids.has(sp.id); }); }
  function zeichneRoster(stand, fertig, sichtbar) {
    var ids = sichtbar || zombieInfizierte(stand), mensch = a.spieler.filter(function (sp) { return !ids.has(sp.id); }).length;
    menschZahl.textContent = mensch + (mensch === 1 ? " Mensch" : " Menschen");
    var krank = a.spieler.length - mensch; zombieZahl.textContent = krank + (krank === 1 ? " Zombie" : " Zombies");
    roster.replaceChildren();
    a.spieler.forEach(function (sp) {
      var zombie = ids.has(sp.id), biss = (stand.zombies || []).find(function (z) { return z.id === sp.id; });
      var badge = sp.id === stand.patientNull ? "Patient Null" : zombie ? "Zombie" + (biss && Number.isFinite(biss.tag) ? " · Tag " + (biss.tag + 1) : "") : fertig && a.abgeschlossen ? "Überlebt" : "Noch Mensch";
      var p = zombie ? "ziehen" : fertig && a.abgeschlossen ? "jubel" : "bereit";
      roster.appendChild(el("div", { class: "zg-person " + (zombie ? "is-zombie" : "is-human"), role: "listitem", "data-id": sp.id, "data-me": String(!!sp.ich), "data-status": zombie ? "zombie" : "mensch" }, [
        minispielAvatar(a, sp.id, p), el("span", { class: "zg-name", text: sp.name + (sp.ich ? " (du)" : ""), title: sp.name }), el("span", { class: "zg-badge", text: badge })
      ]));
    });
    if (!a.spieler.length) roster.appendChild(el("p", { class: "zg-empty", text: "Das Gym ist leer. Noch keine Spieler in dieser Woche." }));
  }
  function fokus(id) {
    var z = Array.from(roster.children).find(function (e) { return e.getAttribute("data-id") === id; });
    if (z) fenster.scrollLeft = Math.max(0, z.offsetLeft + z.offsetWidth / 2 - fenster.clientWidth / 2);
  }
  function akteur(id, position, infiziert, pose) {
    if (!spieler[id]) return null;
    var e = el("div", { class: "zg-focus " + position + (infiziert ? " is-zombie" : " is-human"), "data-id": id }, [
      minispielAvatar(a, id, pose || (infiziert ? "ziehen" : "bereit")), el("span", { class: "zg-focus-name", text: spieler[id].name + (spieler[id].ich ? " · Du" : ""), title: spieler[id].name })
    ]);
    buehne.appendChild(e); return e;
  }
  function pose(e, p) { minispielSetzePose(e.querySelector(".ms-avatar"), a, e.getAttribute("data-id"), p); }
  function effekt(klasse, text) { var e = el("div", { class: "zg-effekt " + klasse, text: text || "" }); buehne.appendChild(e); return e; }
  function sporen(nr, x) {
    for (var i = 0; i < 8; i++) {
      var e = effekt("zg-spore"); e.style.left = (x || 50) + "%";
      var dx = (i % 2 ? 1 : -1) * (15 + i % 4 * 12);
      bewegen(e, [{ opacity: 0, transform: "translate(0,0) scale(.3)" }, { opacity: .8, transform: "translate(" + dx * .5 + "px,-25px) scale(1)", offset: .35 }, { opacity: 0, transform: "translate(" + dx + "px,-90px) scale(1.5)" }], { duration: 750 }, nr).then(function (teil) { teil.remove(); }.bind(null, e));
    }
  }
  function station(index) {
    var s = stationen[index], d = s.zeitpunkt && new Date(s.zeitpunkt);
    tage.textContent = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("de-DE", { timeZone: a.zeitzone || "Europe/Berlin", day: "2-digit", month: "2-digit" }) : "Wochenverlauf";
    zeit.textContent = (index + 1) + " / " + stationen.length + (s.zeitpunkt && d && !Number.isNaN(d.getTime()) ? " · " + d.toLocaleString("de-DE", { timeZone: a.zeitzone || "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "") + (s.art === "korrektur" ? " · Korrektur" : "");
  }
  function ruhendeFiguren(stand, fertig) {
    var ids = zombieInfizierte(stand), mensch = menschen(stand);
    var auswahl;
    if (fertig && a.abgeschlossen) auswahl = mensch.length ? mensch : a.spieler.filter(function (sp) { return ids.has(sp.id); });
    else {
      // Patient Null und die noch lebenden Menschen teilen sich die Bühne.
      var kandidaten = [spieler[stand.patientNull], a.spieler.find(function (sp) { return sp.ich; })].concat(mensch, a.spieler);
      var gezeigt = new Set();
      auswahl = kandidaten.filter(function (sp) { if (!sp || gezeigt.has(sp.id)) return false; gezeigt.add(sp.id); return true; });
    }
    // Der eigene Avatar bleibt bei vielen Überlebenden im Bild; keine Rangliste.
    auswahl = auswahl.slice().sort(function (x, y) { return Number(!!y.ich) - Number(!!x.ich); }).slice(0, 3);
    if (!auswahl.length) auswahl = a.spieler.slice(0, 3);
    auswahl.forEach(function (sp, i) { akteur(sp.id, auswahl.length === 1 ? "zg-center" : "zg-gruppe zg-platz" + (i + 1) + " zg-anzahl" + auswahl.length, ids.has(sp.id), fertig && a.abgeschlossen && !ids.has(sp.id) ? "jubel" : undefined); });
  }
  function endstand(merken) {
    buehne.replaceChildren(); phase("ende"); wurzel.setAttribute("data-rueckblick", "false");
    zeichneRoster(aktuell, true); ruhendeFiguren(aktuell, true);
    var ich = a.spieler.find(function (sp) { return sp.ich; }); if (ich) fokus(ich.id);
    var anzahl = menschen(aktuell).length;
    titel.textContent = !a.spieler.length ? "Das Gym ist leer" : a.abgeschlossen ? anzahl ? "Die Überlebenden stehen fest" : "Das ganze Gym schlurft" : "Die letzte Trainingsrunde";
    geschichte.textContent = !a.spieler.length ? "Noch keine Spieler in dieser Woche." : !anzahl ? "Alle sind Zombies. Im Gym schlurft jetzt die ganze Mannschaft." : a.abgeschlossen ? anzahl + (anzahl === 1 ? " Mensch hat überlebt." : " Menschen haben überlebt.") : anzahl + (anzahl === 1 ? " Mensch hält" : " Menschen halten") + " noch durch. Wer gebissen wurde, bleibt Zombie.";
    status.textContent = a.abgeschlossen ? "Der Ausbruch · Endstand" : "Der Ausbruch · Aktueller Stand";
    zeit.textContent = a.abgeschlossen ? "Wochenabschluss" : "Aktueller Stand";
    tage.textContent = a.abgeschlossen ? "Abgeschlossen" : "Live";
    if (a.abgeschlossen && a.spieler.length) effekt("zg-ergebnis" + (anzahl ? " zg-gerettet" : ""), anzahl ? "ÜBERLEBT!" : "ALLE INFIZIERT");
    skip.hidden = true; replay.hidden = !a.spieler.length; replay.disabled = !bewegung();
    wurzel.classList.toggle("zg-live", !a.abgeschlossen && bewegung());
    if (merken && wurzel.isConnected) zombieStaende[a.id] = { signaturen: signaturen, abgeschlossen: !!a.abgeschlossen };
  }
  function abbrechen() {
    lauf++; reinigen(); endstand(true); if (zombieAbbrechen === abbrechen) zombieAbbrechen = null;
  }
  async function auftritt(stand, nr) {
    phase("auftritt"); buehne.replaceChildren();
    var patient = spieler[stand.patientNull], e = patient && akteur(patient.id, "zg-center", true, "ziehen");
    titel.textContent = patient ? patient.name + " ist Patient Null" : "Der Ausbruch beginnt";
    geschichte.textContent = "Patient Null ist von Anfang an Zombie. Die anderen halten sich mit Training auf den Beinen.";
    status.textContent = "Rückblick · Patient Null";
    var schild = effekt("zg-banner", patient ? "PATIENT NULL" : "DER AUSBRUCH"), nebel = effekt("zg-nebel");
    bewegen(nebel, [{ opacity: 0, transform: "scale(.3)" }, { opacity: .9, transform: "scale(1)", offset: .4 }, { opacity: 0, transform: "scale(1.4)" }], { duration: 900 }, nr);
    sporen(nr, 50);
    if (e && !await bewegen(e, [{ transform: "translateY(28px) rotate(-8deg)", opacity: 0 }, { transform: "translateY(-5px) rotate(4deg)", opacity: 1 }, { transform: "translateY(0) rotate(0deg)", opacity: 1 }], { duration: 700, easing: "ease-out" }, nr)) return false;
    if (!await warten(e ? 220 : 800, nr)) return false;
    if (!await bewegen(schild, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }, nr)) return false;
    schild.remove(); nebel.remove(); return true;
  }
  async function biss(id, stand, sichtbar, index, anzahl, nr) {
    phase("bedrohung"); buehne.replaceChildren(); fokus(id);
    var e = akteur(id, "zg-opfer", false, "bereit"), schatten = effekt("zg-schatten");
    // Der Server modelliert keinen Verursacher. Der Schatten stellt nur den Ausbruch dar.
    schatten.innerHTML = '<svg viewBox="0 0 100 150"><path d="M35 55Q17 53 12 83L2 93 9 105 23 89 31 76 32 112 22 141 39 144 50 120 61 141 80 141 67 109 68 77 82 66 92 75 98 65 86 51 66 53Z" fill="#172e28" stroke="#63835a" stroke-width="2"/><path d="M31 29Q32 5 56 8Q78 13 73 37L64 52 43 54 31 41Z" fill="#1b352b" stroke="#63835a" stroke-width="2"/><path d="M39 28L48 30M58 30L67 27" stroke="#dcf99c" stroke-width="4"/><path d="M45 42L60 41" stroke="#c5dd9d" stroke-width="3"/></svg>';
    titel.textContent = spieler[id].name + " wird gebissen";
    geschichte.textContent = "Zwei Tage am Stück ohne Training." + (anzahl > 1 ? " Biss " + (index + 1) + " von " + anzahl + " an diesem Tag." : "");
    status.textContent = "Rückblick · Der Ausbruch greift um sich";
    bewegen(schatten, [{ transform: "translateX(-24px)", opacity: 0 }, { transform: "translateX(0)", opacity: .8 }], { duration: 250 }, nr);
    if (!await warten(220, nr)) return false;
    phase("ausweichen");
    if (!await bewegen(e, [{ transform: "translateX(0) rotate(0deg)" }, { transform: "translate(11px,-4px) rotate(7deg)" }], { duration: 220, easing: "ease-out" }, nr)) return false;
    bewegen(schatten, [{ transform: "translateX(0)", opacity: .8 }, { transform: "translateX(" + Math.round(buehne.clientWidth * .21) + "px) rotate(9deg)", opacity: 1 }], { duration: 130, easing: "ease-in" }, nr);
    if (!await bewegen(e, [{ transform: "translate(11px,-4px) rotate(7deg)" }, { transform: "translate(16px,1px) rotate(10deg)" }], { duration: 130 }, nr)) return false;
    phase("biss");
    var funken = effekt("zg-bissfunken"), ring = effekt("zg-bissring");
    roster.querySelectorAll(".is-human").forEach(function (z) { z.classList.add("zg-schreck"); });
    if (!await warten(110, nr)) return false;
    phase("verwandlung"); pose(e, "ko");
    bewegen(schatten, [{ opacity: 1 }, { opacity: 0 }], { duration: 250 }, nr);
    bewegen(funken, [{ opacity: 1, transform: "scale(.5)" }, { opacity: 0, transform: "scale(1.3)" }], { duration: 280 }, nr);
    bewegen(ring, [{ opacity: .8, transform: "translate(-50%,-50%) scale(.3)" }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.5)" }], { duration: 330 }, nr);
    var nebel = effekt("zg-nebel zg-nebel-opfer"); sporen(nr, 66);
    bewegen(nebel, [{ opacity: 0, transform: "scale(.5)" }, { opacity: .9, transform: "scale(1)", offset: .4 }, { opacity: 0, transform: "scale(1.4)" }], { duration: 750 }, nr);
    var avatar = e.querySelector(".ms-avatar");
    bewegen(avatar, [{ filter: "sepia(0) saturate(1) hue-rotate(0deg)" }, { filter: "sepia(.65) saturate(1.45) hue-rotate(35deg)" }], { duration: 480 }, nr);
    if (!await bewegen(e, [{ transform: "translate(16px,1px) rotate(10deg)" }, { transform: "translate(5px,8px) rotate(-7deg)" }, { transform: "translate(0,0) rotate(0deg)" }], { duration: 500, easing: "ease-out" }, nr)) return false;
    phase("schlurfen"); pose(e, "ziehen"); e.classList.remove("is-human"); e.classList.add("is-zombie"); avatar.style.filter = "";
    sichtbar.add(id); zeichneRoster(stand, false, sichtbar); fokus(id);
    if (!await bewegen(e, [{ transform: "translateX(-3px) rotate(-4deg)" }, { transform: "translateX(3px) rotate(4deg)" }, { transform: "translateX(0) rotate(0deg)" }], { duration: 400 }, nr)) return false;
    return true;
  }
  async function finale(nr) {
    if (!a.spieler.length) return true;
    phase("finale"); buehne.replaceChildren(); zeichneRoster(aktuell, true); ruhendeFiguren(aktuell, true);
    tage.textContent = "Wochenabschluss"; zeit.textContent = "Abschluss des Wochenrückblicks";
    var mensch = menschen(aktuell), schild = effekt("zg-banner" + (mensch.length ? " zg-gerettet" : ""), mensch.length ? "ÜBERLEBT!" : "DAS GYM SCHLURFT");
    titel.textContent = mensch.length ? "Die Überlebenden stehen fest" : "Alle sind Zombies";
    geschichte.textContent = mensch.length ? mensch.length + (mensch.length === 1 ? " Mensch hat die Woche überstanden." : " Menschen haben die Woche überstanden.") : "Keiner hat die Zombie-Woche als Mensch überstanden.";
    status.textContent = "Wochenabschluss · " + (mensch.length ? "Die Überlebenden feiern" : "Das ganze Gym schlurft");
    var figuren = Array.from(buehne.querySelectorAll(".zg-focus"));
    if (mensch.length) {
      for (var i = 0; i < 12; i++) {
        var teil = effekt("zg-konfetti"); teil.style.left = (10 + i * 7) + "%";
        bewegen(teil, [{ opacity: 0, transform: "translateY(-15px) rotate(0deg)" }, { opacity: 1, transform: "translateY(55px) rotate(70deg)", offset: .3 }, { opacity: 0, transform: "translateY(185px) rotate(160deg)" }], { duration: 1050, delay: i % 3 * 35 }, nr);
      }
      if (!(await Promise.all(figuren.map(function (e) { return bewegen(e, [{ transform: "translateY(0)" }, { transform: "translateY(-12px) rotate(-3deg)" }, { transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-6px)" }, { transform: "translateY(0)" }], { duration: 750, easing: "ease-out" }, nr); }))).every(Boolean)) return false;
    } else {
      sporen(nr, 50);
      if (!(await Promise.all(figuren.map(function (e) { return bewegen(e, [{ transform: "translateX(-4px) rotate(-5deg)" }, { transform: "translateX(4px) rotate(5deg)" }, { transform: "translateX(0) rotate(0deg)" }], { duration: 750 }, nr); }))).every(Boolean)) return false;
    }
    if (!await warten(450, nr)) return false;
    schild.remove(); return true;
  }
  async function spiele(ab, mitAuftritt) {
    lauf++; reinigen(); var nr = lauf;
    if (!wurzel.isConnected) return;
    if (!bewegung() || document.hidden || !a.spieler.length) { endstand(true); return; }
    zombieAbbrechen = abbrechen; wurzel.setAttribute("data-rueckblick", "true"); skip.hidden = false; replay.hidden = true;
    station(ab); zeichneRoster(stationen[ab].stand, false);
    try {
      if (mitAuftritt && !await auftritt(stationen[ab].stand, nr)) return;
      phase("rueckblick");
      if (!mitAuftritt) ruhendeFiguren(stationen[ab].stand, false);
      if (!await warten(280, nr)) return;
      for (var index = ab + 1; index < stationen.length; index++) {
        var s = stationen[index], vorher = stationen[index - 1].stand, wechsel = zombieWechsel(vorher, s);
        station(index);
        if (wechsel.korrektur) {
          phase("korrektur"); buehne.replaceChildren(); zeichneRoster(s.stand, false); ruhendeFiguren(s.stand, false);
          titel.textContent = "Der Verlauf wurde korrigiert"; geschichte.textContent = "Der Wochenverlauf wurde nachträglich korrigiert.";
          status.textContent = "Rückblick · Korrektur";
          if (!await warten(650, nr)) return;
        } else {
          var neu = wechsel.bisse.filter(function (id) { return !!spieler[id]; }), sichtbar = zombieInfizierte(vorher);
          for (var j = 0; j < neu.length; j++) if (!await biss(neu[j], s.stand, sichtbar, j, neu.length, nr)) return;
          zeichneRoster(s.stand, false);
          if (!neu.length) {
            phase("rueckblick"); titel.textContent = "Die letzte Trainingsrunde"; geschichte.textContent = "Die Gruppe hält weiter durch. Bereits Gebissene bleiben Zombies.";
            if (!await warten(300, nr)) return;
          }
        }
      }
      if (a.abgeschlossen && !await finale(nr)) return;
    } finally {
      if (nr === lauf) { reinigen(); if (wurzel.isConnected) endstand(true); if (zombieAbbrechen === abbrechen) zombieAbbrechen = null; }
    }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); };
  endstand(false);
  requestAnimationFrame(function () {
    if (!wurzel.isConnected) return;
    var ab = zombieFortsetzung(gesehen && gesehen.signaturen, signaturen);
    if (ab === null) {
      if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(Math.max(0, stationen.length - 1), false);
      else endstand(true);
    } else spiele(ab, !gesehen);
  });
  return wurzel;
}

(function () {
  'use strict';

  // Nur Kulisse. Die Figuren darunter kommen aus der gespeicherten Season-Auswahl.
  var kulisse = '<svg class="zg-scenery" viewBox="0 0 520 255" preserveAspectRatio="xMidYMin slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><linearGradient id="zg-glass" x2="0" y2="1"><stop stop-color="#b3ce8b"/><stop offset="1" stop-color="#617f5d"/></linearGradient></defs>' +
    '<path d="M0 8H520M0 145H520" stroke="#1b322a" stroke-width="5"/>' +
    '<g stroke="#1a3029" stroke-width="4" stroke-linejoin="round"><path d="M32 24H125V107H32Z" fill="url(#zg-glass)"/><path d="M78 26V106M33 64H125" fill="none"/>' +
    '<path d="M395 24H488V107H395Z" fill="url(#zg-glass)"/><path d="M441 26V106M396 64H487" fill="none"/></g>' +
    '<path d="M44 27L58 47L49 59L64 78L55 103M474 27L461 51L471 65L450 85L460 105" stroke="#415b44" stroke-width="2" fill="none"/>' +
    '<path d="M34 108L4 203H116L123 108M398 108L368 201H513L487 108" fill="#c3df8920"/>' +
    '<g transform="rotate(-4 258 52)"><path d="M168 22H351V88H168Z" fill="#152c26" stroke="#10211d" stroke-width="5"/><path d="M177 31H342V79H177Z" fill="none" stroke="#759266" stroke-width="1"/>' +
    '<text x="260" y="51" fill="#d2e8a4" font-family="system-ui,sans-serif" font-weight="900" font-size="15" letter-spacing="3" text-anchor="middle">BOTZEPS GYM</text>' +
    '<text x="260" y="69" fill="#9fb786" font-family="system-ui,sans-serif" font-size="9" letter-spacing="2" text-anchor="middle">KEINE RUHE IN FRIEDEN</text></g>' +
    '<g stroke="#223a2d" stroke-width="4" fill="#3b5140"><path d="M147 111V157M365 111V157M139 122H373M143 117L151 126M361 117L369 126"/><path d="M162 116V129M168 113V132M177 117V128M331 116V129M340 113V132M347 117V128" stroke-width="6"/></g>' +
    '<path d="M16 159L77 155L93 165L29 171Z" fill="#273c32" stroke="#152b24" stroke-width="3"/><path d="M27 172L22 184M82 169L86 180" stroke="#152b24" stroke-width="4"/>' +
    '<path d="M467 122L479 110L491 124L480 138Z" fill="#b2a05b" stroke="#263c2d" stroke-width="3"/><path d="M480 118V126M480 130V132" stroke="#263c2d" stroke-width="3"/>' +
    '<path d="M0 0L48 0M0 0L0 57M0 0L44 42M0 17Q11 12 17 0M0 34Q22 27 34 0M13 12Q18 7 22 0M25 24Q34 13 37 0M0 18Q5 27 13 12M0 37Q12 41 25 24" stroke="#b0c4a36b" stroke-width="1" fill="none"/>' +
    '<path d="M307 91V110L315 119L307 133M212 111L219 121L214 132" stroke="#294132" stroke-width="2" fill="none"/>' +
    '<g fill="#839a5f"><path d="M104 148Q92 128 106 131L109 147Q109 123 119 129L114 148Z"/><path d="M423 150Q412 136 424 137L427 149Q428 130 436 134L432 151Z"/></g>' +
    '<path d="M0 221L34 213L44 219L61 215M454 206L469 214L493 211L520 220" stroke="#142c244d" stroke-width="3" fill="none"/></svg>';

  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.zombie = function (a) { return zombieSzene(a, kulisse); };
}());
