/* Boss-Inszenierung: dieselben Spielstände und gewählten Figuren, kräftigere Bewegung. */
var bossKampfAbbrechen = null;
var bossAuftrittGezeigt = {};
document.addEventListener("visibilitychange", function () { if (document.hidden && bossKampfAbbrechen) bossKampfAbbrechen(); });
var bossBewegungsWahl = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
if (bossBewegungsWahl && bossBewegungsWahl.addEventListener) bossBewegungsWahl.addEventListener("change", function (e) { if (e.matches && bossKampfAbbrechen) bossKampfAbbrechen(); });

function bossKarte(b, kontext) {
  if (bossKampfAbbrechen) bossKampfAbbrechen();
  var lpText = el("div", { class: "text" });
  var spur = el("div", { class: "boss-lp-spur" });
  var rest = el("div", { class: "rest" });
  var bild = el("div", { class: "bossbild" + (b.bild ? " gezeichnet" : ""), text: b.bild ? "" : b.emoji });
  if (b.bild) bild.innerHTML = b.bild; // Feste Illustration vom eigenen Server.
  var illustriert = !!bild.querySelector(".boss-illustriert");
  if (illustriert) bild.classList.add("neu");
  var reaktionGeladen = false, erwarteteBossPose = "bereit";
  // Früh laden; auf langsamen Verbindungen bleibt die neutrale Figur bis dahin sichtbar.
  if (b.reaktion && b.reaktion.atlas) {
    var vorladen = new Image();
    vorladen.onload = function () {
      reaktionGeladen = true;
      if (arena && arena.isConnected) setzeBossPose(erwarteteBossPose);
    };
    vorladen.src = b.reaktion.atlas;
  }
  var platz = el("div", { class: "bossplatz boss-buehne" }, [bild]);
  var kamera = el("div", { class: "boss-kamera" }, [platz]);
  var figuren = b.figuren || {};
  function figurBild(nr, pose) {
    var svg = nr != null && figuren[nr] && (figuren[nr][pose] || figuren[nr].bereit);
    if (!svg) return null;
    var f = el("div", { class: "figur", "data-pose": pose });
    f.innerHTML = svg;
    return f;
  }
  function stellePose(zelle, pose) {
    var k = zelle._k, alt = zelle.querySelector(".figur");
    var neu = k && figurBild(k.figur, pose);
    if (alt && neu) alt.replaceWith(neu);
  }
  var reihe = el("div", { class: "kaempfer" }, b.kaempfer.map(function (k) {
    var bildchen = figurBild(k.figur, "bereit");
    var zelle = el("div", { class: (k.ich ? "ich" : "") + (bildchen ? " mitfigur" : "") }, [
      bildchen || el("div", { class: "avatar", style: "background:" + farbe(k.name), text: initialen(k.name) }),
      el("div", { class: "name", text: k.name }), el("div", { class: "schaden", text: "−" + zahl(k.schaden, 0) })
    ]);
    zelle._k = k;
    return zelle;
  }));
  (b.pennen || []).forEach(function (p) {
    var f = figurBild(p.figur, "ko");
    if (!f) return;
    f.appendChild(el("div", { class: "zzz", text: "Zzz" }));
    reihe.appendChild(el("div", { class: "mitfigur pennt" + (p.ich ? " ich" : "") }, [f, el("div", { class: "name", text: p.name }), el("div", { class: "schaden", text: "pennt" })]));
  });
  if (!b.kaempfer.length) reihe.appendChild(el("div", { class: "hint", style: "width:auto;color:#ddd", text: "Noch keiner hat sich getraut." }));
  var status = el("div", { class: "boss-kampf-status", role: "status", "aria-live": "polite" });
  var arena = el("div", { class: "arena boss-arcade" + (b.stufe === 2 ? " stufe2" : "") + (illustriert ? " illustriert" : ""), "data-kampfphase": "bereit" }, [
    el("div", { class: "lp" }, [spur, rest, lpText]), kamera, status, reihe
  ]);
  var info = el("div", { class: "bossinfo" });
  var nochmal = el("button", { class: "knopf leise", text: "↻ Nochmal kämpfen", onclick: function () { spiele(true); } });
  var skip = el("button", { class: "knopf leise", text: "Überspringen", onclick: abbrechen });
  var steuerung = el("div", { class: "boss-steuerung" }, [skip, nochmal]);
  var titel = (b.aktiv ? "🐉 Boss-Woche " : "🐉 Boss aus Woche ") + b.woche;
  var karteElement = karte(titel, [el("div", { class: "gross", style: "font-size:20px", text: b.name }), arena, info, steuerung]);
  var auftrittSchluessel = JSON.stringify([kontext || "", b.name, b.woche, b.stufe]);
  var durchlauf = 0, animationen = new Set(), wartende = new Map(), angreifer = null, quelle = null;
  var schluessel = JSON.stringify([kontext || "", b.name, b.woche, b.stufe, b.schaden, b.besiegt, b.kaempfer.map(function (k) { return [k.name, k.schaden]; })]);
  function bewegung() { return BEWEGUNG && !(bossBewegungsWahl && bossBewegungsWahl.matches); }
  function gueltig(lauf) { return lauf === durchlauf && arena.isConnected && !document.hidden && bewegung(); }
  function phase(name) { arena.setAttribute("data-kampfphase", name); }
  function reinigen() {
    animationen.forEach(function (a) { a.cancel(); }); animationen.clear();
    wartende.forEach(function (resolve, id) { clearTimeout(id); resolve(false); }); wartende.clear();
    if (angreifer) angreifer.remove(); angreifer = null;
    if (quelle) quelle.style.visibility = ""; quelle = null;
    arena.classList.remove("boss-hitstop", "boss-laeuft");
    arena.querySelectorAll(".zahl, .trefferfunken, .boss-ring, .boss-staub, .boss-ko, .boss-schnipsel, .boss-auftritt").forEach(function (e) { e.remove(); });
  }
  function warte(ms, lauf) {
    return new Promise(function (resolve) {
      var id = setTimeout(function () { wartende.delete(id); resolve(gueltig(lauf)); }, ms);
      wartende.set(id, resolve);
    });
  }
  function bewegen(element, frames, optionen, lauf) {
    if (!gueltig(lauf)) return Promise.resolve(false);
    var a = element.animate(frames, Object.assign({ fill: "forwards" }, optionen));
    animationen.add(a);
    return a.finished.then(function () { return gueltig(lauf); }, function () { return false; });
  }
  function setzeBossPose(pose) {
    erwarteteBossPose = pose;
    var svg = pose !== "bereit" && reaktionGeladen && b.reaktion && b.reaktion[pose];
    bild.setAttribute("data-boss-pose", svg ? pose : "bereit");
    if (b.bild) bild.innerHTML = svg || b.bild;
  }
  function schnipsel(final, lauf) {
    if (!b.reaktion) return;
    var sofa = b.reaktion.motiv === "sofa";
    var layer = el("div", { class: "boss-schnipsel", "aria-hidden": "true" });
    var p = platz.getBoundingClientRect(), r = bild.getBoundingClientRect();
    var cx = r.left - p.left + r.width / 2, cy = r.top - p.top + r.height * (sofa ? .6 : .24);
    platz.appendChild(layer);
    var anzahl = final ? 12 : 6;
    for (var i = 0; i < anzahl; i++) {
      var art = sofa ? (i % 3 === 0 ? "kissen" : "polster") : "chip";
      var teil = el("span", { class: "boss-splitter boss-splitter-" + art });
      if (art === "chip") teil.innerHTML = '<svg viewBox="0 0 28 24"><path d="M3 18Q-1 6 11 3Q23-2 25 9Q30 22 16 22Z" fill="#ffd447" stroke="#ae6417" stroke-width="2"/><path d="M7 8L16 18M13 6L22 15" stroke="#e5a429" stroke-width="2"/></svg>';
      teil.style.left = cx + "px"; teil.style.top = cy + "px"; layer.appendChild(teil);
      var richtung = i % 2 ? 1 : -1, dx = richtung * (28 + (i % 5) * (final ? 21 : 13));
      var hoch = -(30 + (i % 4) * 13), unten = final ? 110 - i % 3 * 16 : 35 + i % 4 * 11;
      bewegen(teil, [
        { transform: "translate(-50%,-50%) scale(.4) rotate(0deg)", opacity: 0 },
        { transform: "translate(" + dx * .45 + "px," + hoch + "px) scale(1) rotate(" + richtung * 65 + "deg)", opacity: 1, offset: .35 },
        { transform: "translate(" + dx + "px," + unten + "px) scale(.8) rotate(" + richtung * 165 + "deg)", opacity: 0 }
      ], { duration: final ? 1000 : 650, easing: "ease-out" }, lauf);
    }
    warte(final ? 1050 : 700, lauf).then(function () { layer.remove(); });
  }
  async function auftritt(lauf) {
    phase("auftritt"); status.textContent = b.stufe === 2 ? "Er ist zurück. Aufgepumpt!" : "Der Boss betritt die Arena!";
    var schild = el("div", { class: "boss-auftritt", "aria-hidden": "true" }, [
      el("span", { class: "boss-auftritt-stufe", text: b.stufe === 2 ? "STUFE 2 · AUFGEPUMPT" : "BOSS-WOCHE " + b.woche }),
      el("strong", { text: b.name })
    ]);
    var staub = el("div", { class: "boss-staub boss-auftritt-staub", "aria-hidden": "true" });
    platz.appendChild(schild); platz.appendChild(staub);
    bewegen(schild, [{ opacity: 0, transform: "translateX(-25px) skewX(-5deg)" }, { opacity: 1, transform: "translateX(0) skewX(0deg)" }], { duration: 260, easing: "ease-out" }, lauf);
    if (!await bewegen(bild, [
      { transform: "translateY(-175px) scale(.7)", opacity: 0 },
      { transform: "translateY(-18px) scale(1.03)", opacity: 1, offset: .7 },
      { transform: "translateY(9px) scale(1.08,.91)", opacity: 1 }
    ], { duration: b.stufe === 2 ? 680 : 570, easing: "cubic-bezier(.4,0,.8,1)" }, lauf)) return false;
    phase("landung");
    bewegen(staub, [{ opacity: 0, transform: "scale(.2)" }, { opacity: .8, transform: "scale(1)", offset: .25 }, { opacity: 0, transform: "scale(1.8)" }], { duration: 600 }, lauf);
    var wucht = b.stufe === 2 ? 6 : 3;
    bewegen(kamera, [{ transform: "translateY(0)" }, { transform: "translateY(" + wucht + "px)" }, { transform: "translateY(-2px)" }, { transform: "translateY(0)" }], { duration: 230 }, lauf);
    if (!await bewegen(bild, [
      { transform: "translateY(9px) scale(1.08,.91)" }, { transform: "translateY(-7px) scale(.98,1.03)", offset: .35 },
      { transform: "translateY(0) rotate(-2deg) scale(1.025)", offset: .65 }, { transform: "translateY(0) rotate(0deg) scale(1)" }
    ], { duration: 430, easing: "ease-out" }, lauf)) return false;
    if (!await bewegen(schild, [{ opacity: 1, transform: "translateX(0)" }, { opacity: 0, transform: "translateX(25px)" }], { duration: 220 }, lauf)) return false;
    schild.remove(); staub.remove();
    bossAuftrittGezeigt[auftrittSchluessel] = true;
    return true;
  }
  function setzeLp(schaden, sofort) {
    var prozent = Math.max(0, Math.min(100, (b.lebenspunkte - schaden) / Math.max(1, b.lebenspunkte) * 100));
    arena.classList.toggle("boss-lp-sofort", !!sofort);
    rest.style.width = prozent + "%"; spur.style.width = prozent + "%";
    lpText.textContent = zahl(Math.max(0, b.lebenspunkte - schaden), 0) + " / " + zahl(b.lebenspunkte, 0) + " LP";
  }
  function endstand(animiert) {
    setzeLp(b.schaden, !animiert);
    setzeBossPose(b.besiegt ? "ko" : "bereit");
    platz.querySelectorAll(".stempel").forEach(function (e) { e.remove(); });
    platz.classList.toggle("tot", !!b.besiegt);
    reihe.querySelectorAll(".boss-team-jubel").forEach(function (e) { e.classList.remove("boss-team-jubel"); });
    Array.prototype.forEach.call(reihe.children, function (z) {
      if (z._k) { stellePose(z, b.besiegt ? "jubel" : "bereit"); if (b.besiegt && animiert) z.classList.add("boss-team-jubel"); }
    });
    if (b.besiegt) platz.appendChild(el("div", { class: "stempel sieg", text: "BESIEGT" }));
    else if (!b.aktiv) platz.appendChild(el("div", { class: "stempel niederlage", text: "ÜBERLEBT" }));
    var texte = [];
    if (b.besiegt) texte.push(el("p", { class: "boss-belohnung", text: "Erledigt! +" + b.bonus + " Punkte für alle, die mitgeprügelt haben." }));
    else if (b.aktiv) texte.push(el("p", { text: "Noch " + zahl(Math.max(0, b.lebenspunkte - b.schaden), 0) + " Lebenspunkte. Hau rein, jeder Lastpunkt bis Sonntag ist Schaden. Fällt er, gibt's +" + b.bonus + " Punkte." }));
    if (b.aktiv && b.schwaeche) texte.push(el("p", { text: "💥 Schwäche: " + b.schwaeche + ". Jede Einheit davon macht doppelten Schaden." }));
    if (b.aktiv && b.resistenz) texte.push(el("p", { text: "🛡 Abgehärtet gegen " + b.resistenz + ". Das macht nur halben Schaden." }));
    if (!b.besiegt && !b.aktiv) texte.push(el("p", { text: "Er hat überlebt und lacht euch aus. Kein Bonus." }));
    if (b.drueckeberger.length) texte.push(el("p", { class: "hint", text: "Versteckt sich hinter dem Sofa: " + b.drueckeberger.join(", ") }));
    info.replaceChildren.apply(info, texte);
    status.textContent = b.besiegt ? "K.O. – gemeinsam erledigt!" : !b.aktiv ? "Der Boss hat überlebt." : "Aktueller Kampfstand";
    phase("ende"); skip.hidden = true; nochmal.hidden = !bewegung();
    nochmal.textContent = b.kaempfer.length ? "↻ Nochmal kämpfen" : "↻ Auftritt ansehen";
  }
  function abbrechen() {
    if (arena.isConnected) { bossGezeigt[schluessel] = true; bossAuftrittGezeigt[auftrittSchluessel] = true; }
    durchlauf++; reinigen(); endstand(false);
    if (bossKampfAbbrechen === abbrechen) bossKampfAbbrechen = null;
  }
  async function finale(lauf) {
    phase("finale"); status.textContent = "K.O.!";
    var eigen = !!(b.reaktion && b.reaktion.ko);
    if (eigen) { setzeBossPose("ko"); schnipsel(true, lauf); }
    var ko = el("div", { class: "boss-ko", text: "K.O.!", "aria-hidden": "true" });
    var staub = el("div", { class: "boss-staub", "aria-hidden": "true" });
    platz.appendChild(staub); platz.appendChild(ko);
    bewegen(ko, [{ opacity: 0, transform: "scale(1.8) rotate(-12deg)" }, { opacity: 1, transform: "scale(1) rotate(-8deg)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.4,1)" }, lauf);
    bewegen(staub, [{ opacity: 0, transform: "scale(.3)" }, { opacity: .8, offset: .35, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.7)" }], { duration: 700 }, lauf);
    if (eigen) return bewegen(bild, [
      { transform: "translateY(-6px) rotate(-5deg) scale(1.06)", opacity: 1 },
      { transform: "translateY(20px) rotate(3deg) scale(1.03,.93)", opacity: 1, offset: .65 },
      { transform: "translateY(14px) rotate(0deg) scale(1)", opacity: 1 }
    ], { duration: 850, easing: "ease-out" }, lauf);
    return bewegen(bild, [{ transform: "translateY(-8px) rotate(-6deg) scale(1.03)" }, { transform: "translateY(22px) rotate(11deg) scale(.96,.64)", offset: .7 }, { transform: "translateY(35px) rotate(15deg) scale(.94,.55)", opacity: .4 }], { duration: 720, easing: "cubic-bezier(.2,0,.7,1)" }, lauf);
  }
  async function spiele(erzwingen) {
    durchlauf++; reinigen();
    var lauf = durchlauf;
    if (!bewegung() || document.hidden || (bossGezeigt[schluessel] && !erzwingen)) { endstand(false); return; }
    bossKampfAbbrechen = abbrechen;
    skip.hidden = false; nochmal.hidden = true;
    setzeBossPose("bereit");
    platz.classList.remove("tot"); platz.querySelectorAll(".stempel").forEach(function (e) { e.remove(); });
    reihe.querySelectorAll(".boss-team-jubel").forEach(function (e) { e.classList.remove("boss-team-jubel"); });
    Array.prototype.forEach.call(reihe.children, function (z) { if (z._k) stellePose(z, "bereit"); });
    info.replaceChildren(); setzeLp(0, true); arena.classList.add("boss-laeuft");
    var summe = 0, fertig = false;
    try {
      if ((!bossAuftrittGezeigt[auftrittSchluessel] || erzwingen) && !await auftritt(lauf)) return;
      var folge = b.kaempfer.map(function (k, i) { return i; }).reverse();
      for (var n = 0; n < folge.length; n++) {
        if (!gueltig(lauf)) return;
        var zelle = reihe.children[folge[n]], k = zelle._k;
        quelle = zelle.querySelector(".figur, .avatar");
        var ziel = figurBild(k.figur, "bereit") || el("div", { class: "avatar", style: "background:" + farbe(k.name), text: initialen(k.name) });
        angreifer = el("div", { class: "boss-angreifer" + (k.ich ? " boss-angreifer-ich" : ""), "aria-hidden": "true" }, [ziel]);
        angreifer._k = k;
        var p = platz.getBoundingClientRect(), q = quelle.getBoundingClientRect();
        var zielX = p.width / 2 - 112, zielY = p.height - 144;
        var dx = q.left + q.width / 2 - p.left - zielX - 43;
        var dy = q.top + q.height - p.top - zielY - 128;
        var ursprung = "translate(" + dx + "px," + dy + "px) scale(" + (q.width / 86) + ")";
        angreifer.style.left = zielX + "px"; angreifer.style.top = zielY + "px";
        platz.appendChild(angreifer); quelle.style.visibility = "hidden";
        status.textContent = k.name + " greift an · " + (n + 1) + " / " + folge.length;
        phase("vorsturm");
        if (!await bewegen(angreifer, [{ transform: ursprung }, { transform: "translate(-8px,0) scale(1)" }], { duration: 380, easing: "cubic-bezier(.15,.7,.3,1)" }, lauf)) return;
        phase("ausholen");
        if (!await bewegen(angreifer, [{ transform: "translate(-8px,0) rotate(0deg)" }, { transform: "translate(-22px,4px) rotate(-9deg) scale(.98,1.03)" }], { duration: 220, easing: "ease-in" }, lauf)) return;
        stellePose(angreifer, "schlag"); phase("schlag");
        if (!await bewegen(angreifer, [{ transform: "translate(-22px,4px) rotate(-9deg)" }, { transform: "translate(28px,-24px) rotate(5deg) scale(1.08)" }], { duration: 115, easing: "ease-in" }, lauf)) return;
        summe += k.schaden;
        var toedlich = b.besiegt && summe >= b.lebenspunkte;
        setzeBossPose("treffer");
        setzeLp(summe, false); phase("trefferpause"); arena.classList.add("boss-hitstop");
        var funken = el("div", { class: "trefferfunken", "aria-hidden": "true" });
        var ring = el("div", { class: "boss-ring", "aria-hidden": "true" });
        var schaden = el("div", { class: "zahl", text: "−" + zahl(k.schaden, 0) });
        platz.appendChild(funken); platz.appendChild(ring); platz.appendChild(schaden);
        // Der Kontakt hält kurz still, bevor Rückstoß und Kameraruck einsetzen.
        if (!await warte(toedlich ? 140 : 90, lauf)) return;
        arena.classList.remove("boss-hitstop"); phase("rueckstoss");
        schnipsel(false, lauf);
        bewegen(kamera, [{ transform: "translate(0,0)" }, { transform: "translate(-4px,2px)" }, { transform: "translate(4px,-2px)" }, { transform: "translate(-2px,0)" }, { transform: "translate(0,0)" }], { duration: 220 }, lauf);
        bewegen(bild, [{ transform: "translate(0,0)", filter: "brightness(1.35)" }, { transform: "translate(13px,-5px) rotate(6deg)", offset: .25 }, { transform: "translate(-5px,0) rotate(-3deg)", offset: .65 }, { transform: "translate(0,0)", filter: "brightness(1)" }], { duration: 280, easing: "ease-out" }, lauf);
        if (!await bewegen(angreifer, [{ transform: "translate(28px,-24px) rotate(5deg) scale(1.08)" }, { transform: "translate(0,0) rotate(0deg) scale(1)" }], { duration: 230, easing: "ease-out" }, lauf)) return;
        if (toedlich) { if (!await finale(lauf)) return; }
        else { if (!await warte(55, lauf)) return; setzeBossPose("bereit"); }
        stellePose(angreifer, toedlich ? "jubel" : "bereit"); phase("rueckzug");
        if (!await bewegen(angreifer, [{ transform: "translate(0,0) scale(1)" }, { transform: ursprung }], { duration: 340, easing: "ease-in-out" }, lauf)) return;
        angreifer.remove(); angreifer = null; quelle.style.visibility = ""; quelle = null;
        platz.querySelectorAll(".zahl, .trefferfunken, .boss-ring").forEach(function (e) { e.remove(); });
        // Kein weiterer Angriff gegen einen bereits besiegten Boss.
        if (toedlich) break;
        if (!await warte(80, lauf)) return;
      }
      fertig = true;
      bossGezeigt[schluessel] = true;
    } finally {
      if (lauf === durchlauf) {
        reinigen();
        if (arena.isConnected) endstand(fertig);
        if (bossKampfAbbrechen === abbrechen) bossKampfAbbrechen = null;
      }
    }
  }
  // Kein 0-LP-Zwischenstand beim Öffnen mit reduzierter Bewegung oder leerem Team.
  endstand(false);
  requestAnimationFrame(function () { if (arena.isConnected) spiele(false); });
  return karteElement;
}
