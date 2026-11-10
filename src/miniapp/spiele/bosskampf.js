/* Boss-Inszenierung: dieselben Spielstände und gewählten Figuren, kräftigere Bewegung. */
var bossKampfAbbrechen = null;
var bossAuftrittGezeigt = {};
document.addEventListener("visibilitychange", function () { if (document.hidden && bossKampfAbbrechen) bossKampfAbbrechen(); });
var bossBewegungsWahl = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
if (bossBewegungsWahl && bossBewegungsWahl.addEventListener) bossBewegungsWahl.addEventListener("change", function (e) { if (e.matches && bossKampfAbbrechen) bossKampfAbbrechen(); });

// Sequenzen sind optional. Jede Karte kann auf die bisherigen Posen zurückfallen.
var bossSequenzCache = new Map(), bossSequenzBereit = new Set(), bossSequenzZaehler = 0;
function bossSequenzenLaden(sequenzen) {
  return Promise.all(Array.from(new Set(Object.values(sequenzen).map(function (s) { return s.atlas; }))).map(function (url) {
    if (!bossSequenzCache.has(url)) bossSequenzCache.set(url, new Promise(function (ok) {
      var bild = new Image(); bild.onload = function () { bossSequenzBereit.add(url); ok(true); }; bild.onerror = function () { bossSequenzCache.delete(url); ok(false); }; bild.src = url;
    }));
    return bossSequenzCache.get(url);
  }));
}
/** Kurze, abgeschlossene Auftritte; jede Bewegung endet wieder am selben Bühnenpunkt. */
function bossAuftrittProfil(motiv, stufe) {
  var schwer = stufe === 2, druck = schwer ? 1.12 : 1.06, sprung = schwer ? 12 : 7;
  function pose(x, y, winkel, sx, sy) {
    return { transform: "translate(" + x + "px," + y + "px) rotate(" + winkel + "deg) scale(" + (sx || 1) + "," + (sy || sx || 1) + ")", opacity: 1 };
  }
  var ruhe = pose(0, 0, 0), kontakt = pose(0, sprung, 0, druck, 2 - druck);
  var start, ende, dauer, wucht, easing = "ease-in-out";
  switch (motiv) {
    case "chips": // Leichte Tüte: flattert im Zickzack herunter.
      kontakt = pose(0, 4, 4, 1.03, .97);
      start = [pose(-48, -125, -28, .8), pose(24, -88, 19, .9), pose(-18, -45, -15), pose(12, -17, 10), kontakt];
      ende = [kontakt, pose(-4, -sprung, -7), pose(3, 0, 4), ruhe];
      dauer = 900; wucht = .8; break;
    case "schweinehund": // Zwei ungeduldige Sätze, dann ein Abschütteln.
      start = [pose(-100, 28, -10, .85), pose(-55, -30, 5), pose(-30, 8, -5), pose(-12, -18, 3), kontakt];
      ende = [kontakt, pose(-5, -sprung, -5), pose(5, 0, 5), ruhe];
      dauer = 760; wucht = 2.5; break;
    case "doenerteller": // Rutscht herein und balanciert den Teller aus.
      kontakt = pose(-8, 6, -9, druck, 2 - druck);
      start = [pose(135, 28, 18, .9), pose(55, 18, 10), pose(8, 7, -4), kontakt];
      ende = [kontakt, pose(9, -4, 7), pose(-3, 0, -3), ruhe];
      dauer = 650; wucht = 2; easing = "cubic-bezier(.15,.65,.3,1)"; break;
    case "bierbauch": // Stampft heran; Bauch und Krone schwingen nach.
      start = [pose(-82, 6, -8, .9), pose(-58, -12, 6), pose(-39, 8, -6), pose(-18, -10, 4), kontakt];
      ende = [kontakt, pose(0, -sprung, -4, .97, 1.04), pose(0, 3, 3, 1.04, .97), ruhe];
      dauer = 1000; wucht = 4.5; break;
    case "lieferdienst": // Schneller Antritt mit sichtbarer Vollbremsung.
      kontakt = pose(12, 5, 11, druck, 2 - druck);
      start = [pose(-155, 5, -20, .85), pose(-55, -6, -15), pose(-6, -3, -9), kontakt];
      ende = [kontakt, pose(-7, -4, -6), pose(3, 0, 3), ruhe];
      dauer = 570; wucht = 2.5; easing = "cubic-bezier(.1,.6,.25,1)"; break;
    case "gemuetlich": // Sinkt gemächlich auf die Bühne, fast ohne Erschütterung.
      kontakt = pose(0, 0, -2);
      start = [pose(0, -90, -6, .9), pose(-9, -58, -3, .95), pose(7, -29, 3), kontakt];
      ende = [kontakt, pose(0, -4, 2), ruhe];
      dauer = 1150; wucht = .35; break;
    default: // Sofa und unbekannte ältere Bosse landen schwer von oben.
      motiv = motiv === "sofa" ? "sofa" : "standard";
      start = [pose(0, -175, -3, .7), pose(0, -25, 0, 1.02), kontakt];
      ende = [kontakt, pose(0, -sprung, -2, .97, 1.04), pose(0, 2, 1, 1.03, .98), ruhe];
      dauer = 580; wucht = 4;
      easing = "cubic-bezier(.4,0,.8,1)";
  }
  start[0].opacity = 0;
  return { motiv: motiv, start: start, ende: ende, dauer: dauer + (schwer ? 120 : 0), erholung: schwer ? 500 : 420, wucht: wucht * (schwer ? 1.5 : 1), easing: easing };
}

/** Rein visuelle Wucht aus echtem Schaden relativ zu den gesamten Boss-LP, begrenzt. */
function bossTrefferWucht(schaden, lebenspunkte) {
  var anteil = Math.max(0, schaden) / Math.max(1, lebenspunkte);
  var w = Math.pow(Math.min(1, anteil * 3), .65);
  return { rueckstoss: 4 + 15 * w, kamera: 1 + 4 * w, funken: 48 + 48 * w,
    ring: 46 + 50 * w, schrift: 22 + 14 * w, pause: 60 + 50 * w, partikel: 4 + Math.round(4 * w) };
}

function bossKarte(b, kontext) {
  if (bossKampfAbbrechen) bossKampfAbbrechen();
  var lpText = el("div", { class: "text" });
  var spur = el("div", { class: "boss-lp-spur" });
  var rest = el("div", { class: "rest" });
  var bild = el("div", { class: "bossbild" + (b.bild ? " gezeichnet" : ""), text: b.bild ? "" : b.emoji });
  if (b.bild) bild.innerHTML = b.bild; // Feste Illustration vom eigenen Server.
  var illustriert = !!bild.querySelector(".boss-illustriert");
  var auftrittProfil = bossAuftrittProfil(b.reaktion && b.reaktion.motiv, b.stufe);
  if (illustriert) bild.classList.add("neu");
  var reaktionGeladen = false, erwarteteBossPose = "bereit", sequenzAktiv = null, sequenzMarke = 0;
  var sequenzen = b.name === "Der innere Schweinehund" && b.stufe === 1 && b.reaktion && b.reaktion.sequenzen || {};
  var sequenzLaden = bossSequenzenLaden(sequenzen);
  // Früh laden; auf langsamen Verbindungen bleibt die neutrale Figur bis dahin sichtbar.
  if (b.reaktion && b.reaktion.atlas) {
    var vorladen = new Image();
    vorladen.onload = function () {
      reaktionGeladen = true;
      if (arena && arena.isConnected && !sequenzAktiv) setzeBossPose(erwarteteBossPose);
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
    sequenzMarke++; sequenzAktiv = null;
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
  function sequenzVerfuegbar(name) { var s = sequenzen[name]; return !!(s && s.bilder && s.bilder.length && bossSequenzBereit.has(s.atlas)); }
  function sequenzBild(name, index) {
    var s = sequenzen[name], f = s && s.bilder[index]; if (!f || !sequenzVerfuegbar(name)) return false;
    var id = 'bosssequenz' + (++bossSequenzZaehler);
    bild.setAttribute('data-boss-pose', name + '-' + index);
    bild.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="boss-illustriert boss-reaktionspose boss-sequenzpose" viewBox="-30 -20 300 280"><svg x="0" y="0" width="240" height="240" viewBox="' + f.x + ' ' + f.y + ' ' + s.zelle + ' ' + s.zelle + '" overflow="hidden"><defs><clipPath id="' + id + '"><rect x="' + f.x + '" y="' + f.y + '" width="' + s.zelle + '" height="' + s.zelle + '"/></clipPath></defs><image clip-path="url(#' + id + ')" href="' + s.atlas + '" width="' + s.groesse + '" height="' + s.groesse + '"/></svg></svg>';
    return true;
  }
  async function spieleSequenz(name, lauf) {
    if (!sequenzVerfuegbar(name) || !gueltig(lauf)) return false;
    var marke = ++sequenzMarke; sequenzAktiv = name;
    try {
      for (var i = 0; i < sequenzen[name].bilder.length; i++) {
        if (!gueltig(lauf) || marke !== sequenzMarke) return false;
        sequenzBild(name, i);
        if (!await warte(sequenzen[name].bilder[i].dauer, lauf)) return false;
      }
      return true;
    } finally { if (marke === sequenzMarke) sequenzAktiv = null; }
  }
  function schnipsel(final, lauf, anzahlTreffer) {
    if (!b.reaktion) return;
    var motive = {
      sofa: { teile: ["kissen", "polster", "polster"], hoehe: .6 },
      chips: { teile: ["chip"], hoehe: .24 },
      schweinehund: { teile: ["tropfen", "staub", "staub"], hoehe: .45 },
      doenerteller: { teile: ["salat", "tomate", "pommes", "kraut"], hoehe: .5 },
      bierbauch: { teile: ["schaum", "schaum", "hopfen"], hoehe: .45 },
      lieferdienst: { teile: ["karton", "zettel", "tuete"], hoehe: .4 },
      gemuetlich: { teile: ["glanz", "fell", "knopf"], hoehe: .35 }
    };
    var motiv = motive[b.reaktion.motiv];
    if (!motiv) return;
    var layer = el("div", { class: "boss-schnipsel", "aria-hidden": "true" });
    var p = platz.getBoundingClientRect(), r = bild.getBoundingClientRect();
    var cx = r.left - p.left + r.width / 2, cy = r.top - p.top + r.height * motiv.hoehe;
    platz.appendChild(layer);
    var anzahl = final ? 12 : anzahlTreffer || 6;
    for (var i = 0; i < anzahl; i++) {
      var art = motiv.teile[i % motiv.teile.length];
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
    if (sequenzen.auftritt) {
      await Promise.race([sequenzLaden, warte(600, lauf)]); if (!gueltig(lauf)) return false;
      if (sequenzVerfuegbar('auftritt')) {
        phase('auftritt'); status.textContent = 'Der innere Schweinehund · Morgen reicht auch!';
        var spruch = el('div', { class: 'boss-auftritt boss-schwein-spruch', 'aria-hidden': 'true' }, [el('span', { class: 'boss-auftritt-stufe', text: 'BOSS-WOCHE ' + b.woche }), el('strong', { text: 'Morgen reicht auch!' })]); platz.appendChild(spruch);
        var ok = await Promise.all([
          spieleSequenz('auftritt', lauf),
          bewegen(bild, [{ opacity: 0, transform: 'translate(-75px,4px)' }, { opacity: 1, transform: 'translate(-45px,0)', offset: .2 }, { opacity: 1, transform: 'translate(0,0)', offset: .7 }, { opacity: 1, transform: 'translate(0,0)' }], { duration: 1800, easing: 'ease-in-out' }, lauf)
        ]);
        if (!ok.every(Boolean)) return false;
        setzeBossPose('bereit');
        if (!await bewegen(spruch, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }, lauf)) return false;
        spruch.remove(); bossAuftrittGezeigt[auftrittSchluessel] = true; return true;
      }
    }
    phase("auftritt"); status.textContent = b.stufe === 2 ? "Er ist zurück. Aufgepumpt!" : "Der Boss betritt die Arena!";
    var schild = el("div", { class: "boss-auftritt", "aria-hidden": "true" }, [
      el("span", { class: "boss-auftritt-stufe", text: b.stufe === 2 ? "STUFE 2 · AUFGEPUMPT" : "BOSS-WOCHE " + b.woche }),
      el("strong", { text: b.name })
    ]);
    var staub = el("div", { class: "boss-staub boss-auftritt-staub boss-auftritt-effekt-" + auftrittProfil.motiv, "aria-hidden": "true" });
    platz.appendChild(schild); platz.appendChild(staub);
    bewegen(schild, [{ opacity: 0, transform: "translateX(-25px) skewX(-5deg)" }, { opacity: 1, transform: "translateX(0) skewX(0deg)" }], { duration: 260, easing: "ease-out" }, lauf);
    if (!await bewegen(bild, auftrittProfil.start, { duration: auftrittProfil.dauer, easing: auftrittProfil.easing }, lauf)) return false;
    phase("landung");
    bewegen(staub, [{ opacity: 0, transform: "scale(.2)" }, { opacity: .8, transform: "scale(1)", offset: .25 }, { opacity: 0, transform: "scale(1.8)" }], { duration: 600 }, lauf);
    var wucht = auftrittProfil.wucht;
    bewegen(kamera, [{ transform: "translateY(0)" }, { transform: "translateY(" + wucht + "px)" }, { transform: "translateY(" + -wucht / 3 + "px)" }, { transform: "translateY(0)" }], { duration: 230 }, lauf);
    if (!await bewegen(bild, auftrittProfil.ende, { duration: auftrittProfil.erholung, easing: "ease-out" }, lauf)) return false;
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
        var wucht = bossTrefferWucht(k.schaden, b.lebenspunkte);
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
        funken.style.width = funken.style.height = wucht.funken + "px";
        ring.style.width = ring.style.height = wucht.ring + "px";
        schaden.style.fontSize = wucht.schrift + "px";
        platz.appendChild(funken); platz.appendChild(ring); platz.appendChild(schaden);
        // Der Kontakt hält kurz still, bevor Rückstoß und Kameraruck einsetzen.
        if (!await warte(wucht.pause + (toedlich ? 30 : 0), lauf)) return;
        arena.classList.remove("boss-hitstop"); phase("rueckstoss");
        schnipsel(false, lauf, wucht.partikel);
        var ruck = wucht.kamera, weg = wucht.rueckstoss;
        bewegen(kamera, [{ transform: "translate(0,0)" }, { transform: "translate(" + -ruck + "px," + ruck / 2 + "px)" }, { transform: "translate(" + ruck + "px," + -ruck / 2 + "px)" }, { transform: "translate(" + -ruck / 2 + "px,0)" }, { transform: "translate(0,0)" }], { duration: 220 }, lauf);
        // Beide Rückbewegungen abschließen, bevor die K.O.-Animation den Boss übernimmt.
        var reaktionen = await Promise.all([
          bewegen(bild, [{ transform: "translate(0,0)", filter: "brightness(1.2)" }, { transform: "translate(" + weg + "px," + -weg / 3 + "px) rotate(" + weg / 2.5 + "deg)", offset: .25 }, { transform: "translate(" + -weg / 3 + "px,0) rotate(" + -weg / 5 + "deg)", offset: .65 }, { transform: "translate(0,0)", filter: "brightness(1)" }], { duration: 280, easing: "ease-out" }, lauf),
          bewegen(angreifer, [{ transform: "translate(28px,-24px) rotate(5deg) scale(1.08)" }, { transform: "translate(0,0) rotate(0deg) scale(1)" }], { duration: 230, easing: "ease-out" }, lauf)
        ]);
        if (!reaktionen.every(Boolean)) return;
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
