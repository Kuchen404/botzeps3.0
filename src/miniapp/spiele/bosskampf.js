/* Boss-Inszenierung: dieselben Spielstände und gewählten Figuren, kräftigere Bewegung. */
var bossKampfAbbrechen = null;
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
    arena.querySelectorAll(".zahl, .trefferfunken, .boss-ring, .boss-staub, .boss-ko").forEach(function (e) { e.remove(); });
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
  function setzeLp(schaden, sofort) {
    var prozent = Math.max(0, Math.min(100, (b.lebenspunkte - schaden) / Math.max(1, b.lebenspunkte) * 100));
    arena.classList.toggle("boss-lp-sofort", !!sofort);
    rest.style.width = prozent + "%"; spur.style.width = prozent + "%";
    lpText.textContent = zahl(Math.max(0, b.lebenspunkte - schaden), 0) + " / " + zahl(b.lebenspunkte, 0) + " LP";
  }
  function endstand(animiert) {
    setzeLp(b.schaden, !animiert);
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
    phase("ende"); skip.hidden = true; nochmal.hidden = !b.kaempfer.length || !bewegung();
  }
  function abbrechen() {
    if (arena.isConnected) bossGezeigt[schluessel] = true;
    durchlauf++; reinigen(); endstand(false);
    if (bossKampfAbbrechen === abbrechen) bossKampfAbbrechen = null;
  }
  async function finale(lauf) {
    phase("finale"); status.textContent = "K.O.!";
    var ko = el("div", { class: "boss-ko", text: "K.O.!", "aria-hidden": "true" });
    var staub = el("div", { class: "boss-staub", "aria-hidden": "true" });
    platz.appendChild(staub); platz.appendChild(ko);
    bewegen(ko, [{ opacity: 0, transform: "scale(1.8) rotate(-12deg)" }, { opacity: 1, transform: "scale(1) rotate(-8deg)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.4,1)" }, lauf);
    bewegen(staub, [{ opacity: 0, transform: "scale(.3)" }, { opacity: .8, offset: .35, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.7)" }], { duration: 700 }, lauf);
    return bewegen(bild, [{ transform: "translateY(-8px) rotate(-6deg) scale(1.03)" }, { transform: "translateY(22px) rotate(11deg) scale(.96,.64)", offset: .7 }, { transform: "translateY(35px) rotate(15deg) scale(.94,.55)", opacity: .4 }], { duration: 720, easing: "cubic-bezier(.2,0,.7,1)" }, lauf);
  }
  async function spiele(erzwingen) {
    durchlauf++; reinigen();
    var lauf = durchlauf;
    if (!bewegung() || document.hidden || !b.kaempfer.length || (bossGezeigt[schluessel] && !erzwingen)) { endstand(false); return; }
    bossKampfAbbrechen = abbrechen;
    skip.hidden = false; nochmal.hidden = true;
    platz.classList.remove("tot"); platz.querySelectorAll(".stempel").forEach(function (e) { e.remove(); });
    reihe.querySelectorAll(".boss-team-jubel").forEach(function (e) { e.classList.remove("boss-team-jubel"); });
    Array.prototype.forEach.call(reihe.children, function (z) { if (z._k) stellePose(z, "bereit"); });
    info.replaceChildren(); setzeLp(0, true); arena.classList.add("boss-laeuft");
    var summe = 0, fertig = false;
    try {
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
        setzeLp(summe, false); phase("trefferpause"); arena.classList.add("boss-hitstop");
        var funken = el("div", { class: "trefferfunken", "aria-hidden": "true" });
        var ring = el("div", { class: "boss-ring", "aria-hidden": "true" });
        var schaden = el("div", { class: "zahl", text: "−" + zahl(k.schaden, 0) });
        platz.appendChild(funken); platz.appendChild(ring); platz.appendChild(schaden);
        // Der Kontakt hält kurz still, bevor Rückstoß und Kameraruck einsetzen.
        if (!await warte(toedlich ? 140 : 90, lauf)) return;
        arena.classList.remove("boss-hitstop"); phase("rueckstoss");
        bewegen(kamera, [{ transform: "translate(0,0)" }, { transform: "translate(-4px,2px)" }, { transform: "translate(4px,-2px)" }, { transform: "translate(-2px,0)" }, { transform: "translate(0,0)" }], { duration: 220 }, lauf);
        bewegen(bild, [{ transform: "translate(0,0)", filter: "brightness(1.35)" }, { transform: "translate(13px,-5px) rotate(6deg)", offset: .25 }, { transform: "translate(-5px,0) rotate(-3deg)", offset: .65 }, { transform: "translate(0,0)", filter: "brightness(1)" }], { duration: 280, easing: "ease-out" }, lauf);
        if (!await bewegen(angreifer, [{ transform: "translate(28px,-24px) rotate(5deg) scale(1.08)" }, { transform: "translate(0,0) rotate(0deg) scale(1)" }], { duration: 230, easing: "ease-out" }, lauf)) return;
        if (toedlich) { if (!await finale(lauf)) return; }
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
