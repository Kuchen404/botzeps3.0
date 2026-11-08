/* Chronologische Bomben-Inszenierung mit den echten Season-Avataren. */
var bombenStaende = {}, bombenAbbrechen = null, bombenSvgNummer = 0, bombenFensterbreite = window.innerWidth;
var bombenBewegungsWahl = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
document.addEventListener("visibilitychange", function () { if (document.hidden && bombenAbbrechen) bombenAbbrechen(); });
window.addEventListener("resize", function () {
  // Mobile Adressleisten und Tastaturen ändern nur die Höhe, nicht die Flugbahn.
  if (window.innerWidth !== bombenFensterbreite && bombenAbbrechen) bombenAbbrechen();
  bombenFensterbreite = window.innerWidth;
});
if (bombenBewegungsWahl && bombenBewegungsWahl.addEventListener) bombenBewegungsWahl.addEventListener("change", function (e) {
  if (e.matches && bombenAbbrechen) bombenAbbrechen();
  document.querySelectorAll('.bomben-szene[data-bombenphase="ende"]').forEach(function (s) {
    s.classList.toggle("bomben-live", !e.matches && !s.querySelector(".bomben-kugel").hidden);
    s.querySelector(".bomben-replay").disabled = e.matches;
  });
});

/** Nur neue Stationen anhängen; geänderte Historien vollständig neu erzählen. */
function bombenFortsetzung(alt, neu) {
  if (!neu.length) return null;
  if (!alt || !alt.length || !alt.every(function (s, i) { return neu[i] === s; })) return 0;
  return alt.length === neu.length ? null : alt.length - 1;
}
function bombenFlugFrames(von, nach, hoehe, richtung) {
  return Array.from({ length: 17 }, function (_, i) {
    var p = i / 16;
    return { transform: "translate(" + (von + (nach - von) * p) + "px," + (140 - hoehe * Math.sin(Math.PI * p)) + "px) rotate(" + (richtung * 360 * p) + "deg)" };
  });
}
function bombenSzene(b, abgeschlossen) {
  if (bombenAbbrechen) bombenAbbrechen();
  var vorher = bombenStaende[b.id], spieler = Object.create(null), zellen = Object.create(null);
  b.spieler.forEach(function (sp) { spieler[sp.id] = sp; });
  var traeger = spieler[b.traeger], a = { spieler: b.spieler, figuren: b.figuren || {} };
  var status = el("div", { class: "bomben-status", role: "status", "aria-live": "polite" });
  var buehne = el("div", { class: "bomben-buehne", "aria-label": "Bomben-Arena" });
  var schatten = el("div", { class: "bomben-bodenschatten", "aria-hidden": "true" });
  var bombe = el("div", { class: "bomben-kugel", "aria-hidden": "true" });
  var id = "bombenkugel" + ++bombenSvgNummer;
  bombe.innerHTML = '<svg viewBox="0 0 80 100"><defs><radialGradient id="' + id + '" cx="30%" cy="25%"><stop stop-color="#708c80"/><stop offset=".45" stop-color="#304c42"/><stop offset="1" stop-color="#13271f"/></radialGradient></defs><path d="M43 36Q30 13 55 17L61 7" fill="none" stroke="#17241c" stroke-width="8"/><path d="M43 36Q30 13 55 17L61 7" fill="none" stroke="#dbb875" stroke-width="4"/><path class="bomben-funke" d="M61 0L64 8 73 4 68 13 77 18 67 20 63 29 58 20 49 23 53 14 47 9 57 9Z" fill="#ffd76a"/><path d="M29 35L32 27 48 29 51 39" fill="#798c73" stroke="#10251b" stroke-width="3"/><circle cx="39" cy="65" r="29" fill="url(#' + id + ')" stroke="#10251b" stroke-width="4"/><path d="M19 56Q22 46 33 46" fill="none" stroke="#a3baa7" stroke-width="4" stroke-linecap="round"/><path d="M39 51V66M39 76V78" stroke="#ffda79" stroke-width="5" stroke-linecap="round"/></svg>';
  buehne.appendChild(schatten); buehne.appendChild(bombe);
  var reihe = el("div", { class: "bomben-reihe" }, b.spieler.map(function (sp) {
    var z = el("div", { class: "bomben-spieler" + (sp.ich ? " ich" : ""), "data-spieler": sp.id }, [
      minispielAvatar(a, sp.id, "bereit"), el("div", { class: "name", text: sp.name, title: sp.name }), el("div", { class: "bomben-marke" })
    ]);
    zellen[sp.id] = z; return z;
  }));
  var fenster = el("div", { class: "bomben-fenster", tabindex: "0", "aria-label": "Alle Spieler, seitlich scrollbar" }, [reihe]);
  var fortschritt = el("div", { class: "bomben-fortschritt" });
  var balken = el("div", { class: "bomben-verlaufspur", "aria-hidden": "true" }, [el("span")]);
  var skip = el("button", { class: "knopf leise", text: "Überspringen" });
  var replay = el("button", { class: "knopf leise bomben-replay", text: "↻ Nochmal ansehen" });
  var laden = el("button", { class: "knopf leise", text: "↻ Stand aktualisieren", onclick: function () { aktualisiereBombe(laden); } });
  var szene = el("div", { class: "bomben-szene" }, [status, buehne, balken, fortschritt, fenster,
    el("div", { class: "bomben-steuerung" }, [skip, replay, laden])]);
  var stationen = (b.verlauf || []).filter(function (e) { return !!spieler[e.traeger]; });
  if (!stationen.length && traeger) stationen = [{ traeger: b.traeger, zeitpunkt: null, art: "start" }];
  var signaturen = stationen.map(function (e) { return JSON.stringify([e.traeger, e.zeitpunkt, e.art]); });
  var lauf = 0, animationen = new Set(), wartende = new Map(), akteure = {};
  function bewegung() { return !(bombenBewegungsWahl && bombenBewegungsWahl.matches); }
  function gueltig(nr) { return lauf === nr && szene.isConnected && !document.hidden && bewegung(); }
  function phase(p) { szene.setAttribute("data-bombenphase", p); }
  function punkt(x, y, r) { return "translate(" + x + "px," + y + "px) rotate(" + (r || 0) + "deg)"; }
  function mitte(seite) { return buehne.clientWidth * (seite === "links" ? .25 : seite === "rechts" ? .75 : .5); }
  function hand(seite) { return mitte(seite) + (seite === "rechts" ? -27 : 27); }
  function stelleBombe(x) {
    bombe.style.transform = punkt(x, 140);
    schatten.style.transform = "translateX(" + x + "px)";
  }
  function reinigen() {
    animationen.forEach(function (anim) { anim.cancel(); }); animationen.clear();
    wartende.forEach(function (resolve, timer) { clearTimeout(timer); resolve(false); }); wartende.clear();
    buehne.querySelectorAll(".bomben-effekt, .bomben-akteur").forEach(function (e) { e.remove(); }); akteure = {};
    bombe.removeAttribute("style"); schatten.removeAttribute("style");
    szene.classList.remove("bomben-live"); buehne.style.transform = "";
  }
  function warten(ms, nr) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { wartende.delete(timer); resolve(gueltig(nr)); }, ms);
      wartende.set(timer, resolve);
    });
  }
  function bewegen(element, frames, optionen, nr) {
    if (!gueltig(nr)) return Promise.resolve(false);
    var anim = element.animate(frames, Object.assign({ fill: "forwards" }, optionen));
    animationen.add(anim);
    return anim.finished.then(function () {
      if (!gueltig(nr)) return false;
      var letzter = frames[frames.length - 1];
      ["transform", "opacity"].forEach(function (p) { if (letzter[p] != null) element.style[p] = letzter[p]; });
      return true;
    }, function () { return false; }).finally(function () { animationen.delete(anim); anim.cancel(); });
  }
  function akteur(id, seite) {
    if (akteure[seite]) akteure[seite].remove();
    var sp = spieler[id];
    var e = el("div", { class: "bomben-akteur bomben-" + seite, "data-spieler": id }, [
      minispielAvatar(a, id, "bereit"), el("div", { class: "bomben-akteur-name", text: sp.name + (sp.ich ? " · Du" : ""), title: sp.name })
    ]);
    buehne.appendChild(e); akteure[seite] = e; return e;
  }
  function pose(e, p) { minispielSetzePose(e.querySelector(".ms-avatar"), a, e.getAttribute("data-spieler"), p); }
  function markiere(id, fertig) {
    b.spieler.forEach(function (sp) {
      var z = zellen[sp.id], hat = sp.id === id;
      z.classList.toggle("traeger", hat);
      z.setAttribute("aria-label", sp.name + (hat ? fertig && abgeschlossen ? ", Bombe explodiert" : ", trägt die Bombe" : ""));
      z.querySelector(".bomben-marke").textContent = hat ? fertig && abgeschlossen ? "Erwischt" : "am Zug" : sp.ich ? "Du" : "";
      minispielSetzePose(z.querySelector(".ms-avatar"), a, sp.id, fertig && abgeschlossen ? hat ? "ko" : "jubel" : "bereit");
    });
    var z = zellen[id];
    if (z) fenster.scrollLeft = Math.max(0, z.offsetLeft + z.offsetWidth / 2 - fenster.clientWidth / 2);
  }
  function station(index) {
    var e = stationen[index], datum = e.zeitpunkt && new Date(e.zeitpunkt);
    var zeit = datum && !Number.isNaN(datum.getTime()) ? datum.toLocaleString("de-DE", { timeZone: b.zeitzone || "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Spielstart";
    fortschritt.textContent = (index + 1) + " / " + stationen.length + " · " + zeit + (e.art === "korrektur" ? " · Training gelöscht" : e.art === "training" ? " · Training eingetragen" : " · Spielstart");
    balken.firstChild.style.width = (stationen.length > 1 ? index / (stationen.length - 1) * 100 : 100) + "%";
    markiere(e.traeger, false);
  }
  function endstand(merken) {
    buehne.querySelectorAll(".bomben-akteur, .bomben-effekt").forEach(function (e) { e.remove(); }); akteure = {};
    phase("ende"); szene.setAttribute("data-rueckblick", "false");
    bombe.hidden = !traeger || abgeschlossen; schatten.hidden = !traeger || abgeschlossen;
    if (traeger) {
      var e = akteur(b.traeger, "zentrum");
      if (abgeschlossen) {
        pose(e, "ko");
        buehne.appendChild(el("div", { class: "bomben-effekt bomben-ergebnis", text: "ERWISCHT!", "aria-hidden": "true" }));
      }
    }
    markiere(b.traeger, true);
    status.textContent = traeger ? abgeschlossen ? "Hochgegangen bei " + traeger.name : "Tickt bei " + traeger.name : "Noch kein Bombenträger";
    fortschritt.textContent = (abgeschlossen ? "Endstand" : "Aktueller Stand") + (stationen.length > 1 ? " · " + (stationen.length - 1) + " Übergaben seit Spielstart" : "");
    balken.firstChild.style.width = "100%";
    szene.classList.toggle("bomben-live", !!traeger && !abgeschlossen && bewegung());
    skip.hidden = true; replay.hidden = !traeger; replay.disabled = !bewegung();
    if (merken && szene.isConnected) bombenStaende[b.id] = { signaturen: signaturen, traeger: b.traeger, abgeschlossen: !!abgeschlossen };
  }
  function abbrechen() {
    lauf++; reinigen(); endstand(true);
    if (bombenAbbrechen === abbrechen) bombenAbbrechen = null;
  }
  async function auftritt(e, seite, nr) {
    phase("auftritt"); status.textContent = "Rückblick · Die Bombe kommt ins Spiel";
    var schild = el("div", { class: "bomben-effekt bomben-ansage", text: "DIE BOMBE TICKT", "aria-hidden": "true" });
    buehne.appendChild(schild);
    bewegen(e, [{ transform: "translateY(18px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 360, easing: "ease-out" }, nr);
    var x = hand(seite);
    if (!await bewegen(bombe, [{ transform: punkt(x - 35, 30, -40), opacity: 0 }, { transform: punkt(x, 145, 8), opacity: 1 }, { transform: punkt(x, 140), opacity: 1 }], { duration: 650, easing: "ease-out" }, nr)) return false;
    if (!await bewegen(schild, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }, nr)) return false;
    schild.remove(); return true;
  }
  async function uebergabe(index, seite, nr) {
    var von = stationen[index - 1].traeger, nach = stationen[index].traeger;
    var andere = seite === "links" ? "rechts" : "links", richtung = seite === "links" ? 1 : -1;
    var werfer = akteure[seite], empfaenger = akteur(nach, andere), korrektur = stationen[index].art === "korrektur";
    var start = hand(seite), ziel = hand(andere);
    bewegen(empfaenger, [{ transform: "translateX(" + richtung * 12 + "px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 200, easing: "ease-out" }, nr);
    status.textContent = korrektur ? "Korrektur · " + spieler[nach].name + " übernimmt" : spieler[von].name + " wirft zu " + spieler[nach].name;
    if (!korrektur) {
      phase("ausholen"); pose(werfer, "schlag");
      bewegen(bombe, [{ transform: punkt(start, 140) }, { transform: punkt(start - richtung * 10, 143, -richtung * 18) }], { duration: 180 }, nr);
      if (!await bewegen(werfer, [{ transform: "translateX(0) rotate(0deg)" }, { transform: "translateX(" + -richtung * 8 + "px) rotate(" + -richtung * 8 + "deg)" }], { duration: 180, easing: "ease-in" }, nr)) return false;
    }
    phase(korrektur ? "korrektur" : "flug");
    var frames = bombenFlugFrames(start, ziel, korrektur ? 8 : Math.min(80, 40 + Math.abs(ziel - start) * .16), richtung);
    if (korrektur) frames.forEach(function (f, i) { f.opacity = i === 0 || i === frames.length - 1 ? 1 : .35; });
    else {
      for (var i = 0; i < 4; i++) {
        var spur = el("span", { class: "bomben-effekt bomben-flugspur", "aria-hidden": "true" });
        buehne.appendChild(spur);
        bewegen(spur, frames.map(function (f, n) { return { transform: f.transform, opacity: n < 2 || n > 13 ? 0 : .45 }; }), { duration: 650, delay: 25 + i * 30 }, nr).then(function (e) { e.remove(); }.bind(null, spur));
      }
      bewegen(werfer, [{ transform: "translateX(" + -richtung * 8 + "px) rotate(" + -richtung * 8 + "deg)" }, { transform: "translateX(" + richtung * 6 + "px) rotate(" + richtung * 5 + "deg)" }, { transform: "translateX(0) rotate(0deg)" }], { duration: 300 }, nr);
    }
    bewegen(schatten, [{ transform: "translateX(" + start + "px) scale(1)" }, { transform: "translateX(" + (start + ziel) / 2 + "px) scale(.5)" }, { transform: "translateX(" + ziel + "px) scale(1)" }], { duration: korrektur ? 450 : 650 }, nr);
    if (!await bewegen(bombe, frames, { duration: korrektur ? 450 : 650, easing: "linear" }, nr)) return false;
    station(index); phase("fangen");
    pose(werfer, korrektur ? "bereit" : "jubel");
    if (!korrektur) {
      var ring = el("div", { class: "bomben-effekt bomben-fangring", "aria-hidden": "true" });
      ring.style.left = ziel + "px"; buehne.appendChild(ring);
      bewegen(ring, [{ transform: "translate(-50%,-50%) scale(.3)", opacity: .8 }, { transform: "translate(-50%,-50%) scale(1.5)", opacity: 0 }], { duration: 300 }, nr).then(function () { ring.remove(); });
      bewegen(bombe, [{ transform: punkt(ziel, 140) + " scale(1.12,.88)" }, { transform: punkt(ziel, 133) + " scale(.95,1.05)" }, { transform: punkt(ziel, 140) + " scale(1)" }], { duration: 250 }, nr);
      if (!await bewegen(empfaenger, [{ transform: "translateY(0) rotate(0deg)" }, { transform: "translate(" + richtung * 5 + "px,6px) rotate(" + richtung * 6 + "deg)" }, { transform: "translateY(0) rotate(0deg)" }], { duration: 280, easing: "ease-out" }, nr)) return false;
    }
    return warten(280, nr);
  }
  async function finale(nr) {
    phase("zuendung"); status.textContent = "Wochenende · Die Bombe geht hoch!";
    var e = akteure.zentrum, x = hand("zentrum");
    if (!await bewegen(bombe, [{ transform: punkt(x, 140) }, { transform: punkt(x - 3, 138) + " scale(1.1)" }, { transform: punkt(x + 3, 140) + " scale(1.17)" }, { transform: punkt(x, 140) + " scale(1.25)" }], { duration: 450 }, nr)) return false;
    phase("explosion"); bombe.hidden = true; schatten.hidden = true; pose(e, "ko");
    var wolke = el("div", { class: "bomben-effekt bomben-wolke", "aria-hidden": "true" });
    var knall = el("div", { class: "bomben-effekt bomben-knall", text: "BOOM!", "aria-hidden": "true" });
    buehne.appendChild(wolke); buehne.appendChild(knall);
    bewegen(wolke, [{ opacity: 0, transform: "translate(-50%,-50%) scale(.2)" }, { opacity: .95, transform: "translate(-50%,-50%) scale(1)", offset: .3 }, { opacity: 0, transform: "translate(-50%,-50%) scale(1.45)" }], { duration: 850 }, nr);
    bewegen(knall, [{ opacity: 0, transform: "translateX(-50%) scale(.4) rotate(-12deg)" }, { opacity: 1, transform: "translateX(-50%) scale(1) rotate(-6deg)" }], { duration: 230 }, nr);
    bewegen(buehne, [{ transform: "translateX(0)" }, { transform: "translateX(-4px)" }, { transform: "translateX(4px)" }, { transform: "translateX(-2px)" }, { transform: "translateX(0)" }], { duration: 260 }, nr);
    for (var i = 0; i < 10; i++) {
      var stern = el("span", { class: "bomben-effekt bomben-stern", "aria-hidden": "true" });
      stern.style.left = x + "px"; buehne.appendChild(stern);
      var winkel = Math.PI * 2 * i / 10;
      bewegen(stern, [{ transform: "translate(0,0) scale(.2)", opacity: 0 }, { transform: "translate(" + Math.cos(winkel) * 50 + "px," + Math.sin(winkel) * 45 + "px) rotate(60deg) scale(1)", opacity: 1, offset: .3 }, { transform: "translate(" + Math.cos(winkel) * 100 + "px," + (Math.sin(winkel) * 60 + 50) + "px) rotate(150deg) scale(.5)", opacity: 0 }], { duration: 950 }, nr);
    }
    if (!await bewegen(e, [{ transform: "translateY(-6px) rotate(-5deg)" }, { transform: "translateY(8px) rotate(4deg)" }, { transform: "translateY(0) rotate(0deg)" }], { duration: 650 }, nr)) return false;
    return warten(450, nr);
  }
  async function spiele(ab, mitAuftritt) {
    lauf++; reinigen(); var nr = lauf;
    if (!szene.isConnected || !traeger) { endstand(false); return; }
    if (!bewegung() || document.hidden) { endstand(true); return; }
    bombenAbbrechen = abbrechen; skip.hidden = false; replay.hidden = true;
    szene.setAttribute("data-rueckblick", "true"); bombe.hidden = false; schatten.hidden = false;
    var seite = "links", e = akteur(stationen[ab].traeger, seite);
    station(ab); stelleBombe(hand(seite));
    try {
      if (mitAuftritt && !await auftritt(e, seite, nr)) return;
      phase("halten"); status.textContent = "Rückblick · Bombe bei " + spieler[stationen[ab].traeger].name;
      if (!await warten(300, nr)) return;
      for (var index = ab + 1; index < stationen.length; index++) {
        if (!await uebergabe(index, seite, nr)) return;
        seite = seite === "links" ? "rechts" : "links";
      }
      // Der Endstand kommt immer vom Server, auch bei unvollständigen älteren Historien.
      phase("ankommen");
      var mitteAlt = mitte(seite), xAlt = hand(seite);
      buehne.querySelectorAll(".bomben-akteur").forEach(function (p) { p.remove(); }); akteure = {};
      e = akteur(b.traeger, "zentrum");
      if (!await bewegen(e, [{ transform: "translateX(" + (mitteAlt - mitte("zentrum")) + "px)" }, { transform: "translateX(0)" }], { duration: 250, easing: "ease-out" }, nr)) return;
      if (!await bewegen(bombe, [{ transform: punkt(xAlt, 140) }, { transform: punkt(hand("zentrum"), 140) }], { duration: 180 }, nr)) return;
      schatten.style.transform = "translateX(" + hand("zentrum") + "px)";
      if (abgeschlossen && !await finale(nr)) return;
    } finally {
      if (nr === lauf) {
        reinigen(); if (szene.isConnected) endstand(true);
        if (bombenAbbrechen === abbrechen) bombenAbbrechen = null;
      }
    }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); };
  endstand(false);
  requestAnimationFrame(function () {
    if (!szene.isConnected) return;
    var ab = bombenFortsetzung(vorher && vorher.signaturen, signaturen);
    if (ab === null) {
      if (abgeschlossen && vorher && !vorher.abgeschlossen && traeger) spiele(Math.max(0, stationen.length - 1), false);
      else endstand(true);
    } else spiele(ab, !vorher);
  });
  return szene;
}
