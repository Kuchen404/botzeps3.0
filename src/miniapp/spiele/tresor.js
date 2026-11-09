/* Gemeinsamer Tresor: jede echte Trainingseinheit bewegt die Mechanik. */
var tresorStaende = {}, tresorAbbrechen = null, tresorDarstellung = null;
var tresorFensterbreite = window.innerWidth, tresorSvgNummer = 0;
var tresorBewegungsWahl = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('visibilitychange', function () { if (document.hidden && tresorAbbrechen) tresorAbbrechen(); });
window.addEventListener('resize', function () {
  if (window.innerWidth !== tresorFensterbreite) {
    if (tresorAbbrechen) tresorAbbrechen(); else if (tresorDarstellung) tresorDarstellung();
  }
  tresorFensterbreite = window.innerWidth;
});
if (tresorBewegungsWahl && tresorBewegungsWahl.addEventListener) tresorBewegungsWahl.addEventListener('change', function (e) {
  if (e.matches && tresorAbbrechen) tresorAbbrechen();
  document.querySelectorAll('.ms-tresor[data-tresorphase="ende"] .tr-replay').forEach(function (b) { b.disabled = e.matches; });
});
function tresorZahl(n) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0; }
function tresorStand(s) {
  s = s || {};
  var ziffern = Math.min(4, Math.floor(tresorZahl(s.ziffern))), teile = String(s.code || '').trim().split(/\s+/);
  return { summe: tresorZahl(s.summe), ziel: Math.max(1, tresorZahl(s.ziel)), ziffern: ziffern,
    code: [0, 1, 2, 3].map(function (i) { return i < ziffern && /^\d$/.test(teile[i] || '') ? teile[i] : '?'; }),
    offen: ziffern === 4 && s.offen === true, lasten: s.lasten || {} };
}
function tresorWechsel(vorher, station) {
  var v = tresorStand(vorher), n = tresorStand(station.stand), korrektur = station.art === 'korrektur' || v.ziel !== n.ziel || n.summe < v.summe || n.ziffern < v.ziffern || (v.offen && !n.offen);
  Object.keys(v.lasten).forEach(function (id) { if (tresorZahl(n.lasten[id]) < tresorZahl(v.lasten[id])) korrektur = true; });
  v.code.forEach(function (c, i) { if (c !== '?' && c !== n.code[i]) korrektur = true; });
  var ids = Object.keys(n.lasten).filter(function (id) { return tresorZahl(n.lasten[id]) > tresorZahl(v.lasten[id]); });
  return { korrektur: korrektur, training: !korrektur && station.art === 'training' && ids.length > 0, ids: ids,
    neu: korrektur ? [] : [0, 1, 2, 3].filter(function (i) { return i >= v.ziffern && i < n.ziffern; }), oeffnen: !korrektur && !v.offen && n.offen };
}
function tresorSignaturen(stationen) { return stationen.map(function (s) { return JSON.stringify([s.art, s.stand]); }); }
function tresorFortsetzung(alt, neu) {
  if (!neu.length) return null;
  if (!alt || !alt.length || !alt.every(function (s, i) { return s === neu[i]; })) return 0;
  return alt.length === neu.length ? null : alt.length - 1;
}
function tresorPositionen(spieler, breite, hoehe) {
  var n = spieler.length, w = Math.min(n > 32 ? 14 : n > 12 ? 24 : n > 6 ? 32 : 44, (breite - 24) / Math.max(1, Math.min(n, 6)) - 5);
  var cols = Math.max(1, Math.floor((breite - 20) / (w + 5))), plan = new Map();
  // Eigene Figur in der vordersten Reihe; jede ID bleibt sichtbar, auch bei null Last.
  var reihe = spieler.slice().sort(function (a, b) { return Number(!!b.ich) - Number(!!a.ich); });
  reihe.forEach(function (sp, i) {
    var row = Math.floor(i / cols), anzahl = Math.min(cols, n - row * cols), x = breite / 2 + (i % cols - (anzahl - 1) / 2) * (w + 5);
    plan.set(sp.id, { x: x / breite * 100, y: (hoehe - 22 - row * (w * 1.5 + 5)) / hoehe * 100, w: w });
  });
  return plan;
}
var tresorBildCache = new Map(), tresorBildFehler = new Set(), tresorBildBereit = new Set();
function tresorBilder(a) {
  var urls = new Set(Object.values(a.tresorBilder || {}));
  a.spieler.forEach(function (sp) { var b = a.figuren && a.figuren[sp.figur], m = b && b.laufen && /href="([^"]+)"/.exec(b.laufen); if (m) urls.add(m[1]); });
  return Promise.all(Array.from(urls).map(function (url) {
    if (!tresorBildCache.has(url)) tresorBildCache.set(url, new Promise(function (ok) {
      var b = new Image(); b.onload = function () { tresorBildFehler.delete(url); tresorBildBereit.add(url); ok(true); };
      b.onerror = function () { tresorBildFehler.add(url); tresorBildCache.delete(url); ok(false); }; b.src = url;
    }));
    return tresorBildCache.get(url);
  }));
}
window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
window.MINISPIEL_SZENEN.tresor = function (a) {
  if (tresorAbbrechen) tresorAbbrechen();
  var aktuell = a.aktuell || {}, stationen = (a.verlauf || []).filter(function (s) { return !!s.stand; });
  if (!stationen.length) stationen = [{ art: 'start', stand: aktuell, zeitpunkt: null }];
  var signaturen = tresorSignaturen(stationen), gesehen = tresorStaende[a.id], ab = tresorFortsetzung(gesehen && gesehen.signaturen, signaturen);
  var lauf = 0, animationen = new Set(), wartende = new Map(), mitglieder = new Map(), spieler = new Map(a.spieler.map(function (s) { return [s.id, s]; }));
  var status = el('div', { class: 'ms-status', role: 'status', 'aria-live': 'polite' });
  var raum = el('div', { class: 'tr-raum', 'aria-hidden': 'true' }), licht = el('div', { class: 'tr-licht', 'aria-hidden': 'true' });
  var innen = el('div', { class: 'tr-innen', 'aria-hidden': 'true' }), chassis = el('div', { class: 'tr-chassis', 'aria-hidden': 'true' });
  var tuerbild = el('div', { class: 'tr-tuerbild', 'aria-hidden': 'true' }), rad = el('div', { class: 'tr-rad', 'aria-hidden': 'true' });
  var code = el('div', { class: 'tr-code', role: 'img' }), ziffern = [0, 1, 2, 3].map(function () { var e = el('span', { text: '?', 'aria-hidden': 'true' }); code.appendChild(e); return e; });
  var tuer = el('div', { class: 'tr-tuer' }, [tuerbild, rad, code]), riegel = [0, 1, 2, 3].map(function (i) { return el('i', { class: 'tr-riegel tr-r' + i, 'aria-hidden': 'true' }); });
  // Vollständig deckendes Mosaik: darunter liegt keine unzensierte Darstellung.
  var pixel = el('div', { class: 'tr-fund-pixel', 'aria-hidden': 'true' });
  var palette = ['#efb09e', '#f4c3a9', '#c27d78', '#a65c68', '#d99186', '#ffd1ad', '#805668'];
  for (var pi = 0; pi < 80; pi++) {
    var punkt = el('i'); punkt.style.backgroundColor = palette[(pi * 7 + Math.floor(pi / 8) * 3 + pi % 5) % palette.length]; pixel.appendChild(punkt);
  }
  var fund = el('div', { class: 'tr-fund', role: 'img', 'aria-label': 'Vollständig verpixelter Überraschungsfund' }, [
    el('div', { class: 'tr-fund-blitz', 'aria-hidden': 'true' }), pixel,
    el('span', { class: 'tr-fund-zensur', text: 'ZENSIERT', 'aria-hidden': 'true' })
  ]); fund.hidden = true;
  var safe = el('div', { class: 'tr-safe' }, [innen, chassis, fund].concat(riegel, [tuer]));
  var feld = el('div', { class: 'tr-feld', 'aria-hidden': 'true' }), effekte = el('div', { class: 'tr-effekte', 'aria-hidden': 'true' });
  var arena = el('div', { class: 'tr-arena' }, [raum, licht, safe, feld, effekte]);
  var balken = [0, 1, 2, 3].map(function () { return el('span', {}, [el('i')]); }), wert = el('strong'), hinweis = el('p', { class: 'tr-hinweis' });
  var liste = el('div', { class: 'tr-liste', role: 'list', 'aria-label': 'Alle Spieler und ihre Beiträge zum Tresor' });
  var fenster = el('div', { class: 'tr-fenster', tabindex: '0', 'aria-label': 'Spielerbeiträge, seitlich scrollbar' }, [liste]);
  var zeit = el('div', { class: 'ms-zeit' }), skip = el('button', { class: 'knopf leise', text: 'Überspringen' });
  var replay = el('button', { class: 'knopf leise tr-replay', text: '↻ Nochmal ansehen' });
  var laden = el('button', { class: 'knopf leise', text: '↻ Stand aktualisieren', onclick: function () { aktualisiereBombe(laden); } });
  var root = el('section', { class: 'ms-scene ms-tresor', 'aria-label': 'Gemeinsam den Tresor knacken' }, [status, arena,
    el('div', { class: 'tr-fortschritt' }, [el('div', { class: 'tr-balken', 'aria-hidden': 'true' }, balken), wert, hinweis]), fenster, zeit,
    el('div', { class: 'ms-steuerung' }, [skip, replay, laden])]);
  function z(n) { return tresorZahl(n).toLocaleString('de-DE', { maximumFractionDigits: 2 }); }
  function name(id) { return spieler.has(id) ? spieler.get(id).name : 'Das Team'; }
  function bewegung() { return !(tresorBewegungsWahl && tresorBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && root.isConnected && !document.hidden && bewegung(); }
  function phase(p) { root.setAttribute('data-tresorphase', p); }
  function warten(ms, nr) { return new Promise(function (ok) { var t = setTimeout(function () { wartende.delete(t); ok(gueltig(nr)); }, ms); wartende.set(t, ok); }); }
  function bewegen(e, frames, opt, nr) {
    if (!gueltig(nr) || !e) return Promise.resolve(false);
    var an = e.animate(frames, Object.assign({ fill: 'forwards' }, opt)); animationen.add(an);
    return an.finished.then(function () {
      if (!gueltig(nr)) return false;
      var f = frames[frames.length - 1]; ['transform', 'opacity', 'left', 'top', 'width'].forEach(function (p) { if (f[p] != null) e.style[p] = f[p]; }); return true;
    }, function () { return false; }).finally(function () { animationen.delete(an); an.cancel(); });
  }
  function reinigen() {
    animationen.forEach(function (an) { an.cancel(); }); animationen.clear();
    wartende.forEach(function (ok, t) { clearTimeout(t); ok(false); }); wartende.clear();
    effekte.replaceChildren(); root.removeAttribute('data-aktiv');
    fund.classList.remove('tr-fund-auftritt'); fund.style.transform = ''; fund.style.opacity = '';
  }
  function svg(parent, text) { parent.innerHTML = text; }
  function medien() {
    var b = a.tresorBilder || {}, url = b.tresor, id = 'tr' + (++tresorSvgNummer);
    raum.replaceChildren(); innen.replaceChildren(); chassis.replaceChildren(); tuerbild.replaceChildren(); rad.replaceChildren();
    riegel.forEach(function (e, i) {
      var bolzen = el('span', { class: 'tr-bolzen' }); bolzen.style.transform = 'translateX(' + (e.classList.contains('geloest') ? i % 2 ? -100 : 100 : 0) + '%)'; e.replaceChildren(bolzen);
    });
    if (b.innen && !tresorBildFehler.has(b.innen)) {
      var kammer = el('img', { src: b.innen, alt: '' }); kammer.onerror = function () { kammer.remove(); }; innen.appendChild(kammer);
    }
    if (b.raum && !tresorBildFehler.has(b.raum)) {
      var bg = el('img', { src: b.raum, alt: '' }); bg.onerror = function () { bg.remove(); }; raum.appendChild(bg);
    }
    var art = !!url && tresorBildBereit.has(url) && !tresorBildFehler.has(url); root.setAttribute('data-illustration', String(art));
    // Adressen kommen aus der festen Medienliste des Servers. Keine Namen oder Codes im SVG.
    if (!art || !/^(?:\/api\/figurbild\/[a-z0-9-]+\.png|data:image\/png;base64,[A-Za-z0-9+/=]+)$/.test(url)) return;
    var image = '<image href="' + url + '" width="400" height="500"/>';
    var patches = [0, 1, 2, 3].map(function (i) {
      var x = i % 2 ? 364 : 0, y = i < 2 ? 108 : 318;
      return '<defs><clipPath id="' + id + 'p' + i + '"><rect x="' + x + '" y="' + y + '" width="36" height="44"/></clipPath></defs><g clip-path="url(#' + id + 'p' + i + ')"><image href="' + url + '" width="400" height="500" y="-48"/></g>';
    }).join('');
    svg(chassis, '<svg viewBox="0 0 400 500"><defs><mask id="' + id + 'c"><rect width="400" height="500" fill="white"/><rect x="55" y="65" width="285" height="350" rx="28" fill="black"/><rect x="0" y="108" width="36" height="44" fill="black"/><rect x="364" y="108" width="36" height="44" fill="black"/><rect x="0" y="318" width="36" height="44" fill="black"/><rect x="364" y="318" width="36" height="44" fill="black"/></mask></defs><g mask="url(#' + id + 'c)">' + image + '</g>' + patches + '</svg>');
    svg(tuerbild, '<svg viewBox="55 65 285 350"><defs><clipPath id="' + id + 'd"><rect x="55" y="65" width="285" height="350" rx="28"/></clipPath><mask id="' + id + 'w"><rect width="400" height="500" fill="white"/><circle cx="199" cy="274" r="101" fill="black"/></mask></defs><g clip-path="url(#' + id + 'd)" mask="url(#' + id + 'w)">' + image + '</g></svg>');
    riegel.forEach(function (e, i) {
      var x = i % 2 ? 364 : 0, y = i < 2 ? 108 : 318;
      svg(e.firstChild, '<svg viewBox="' + x + ' ' + y + ' 36 44"><defs><clipPath id="' + id + 'b' + i + '"><rect x="' + x + '" y="' + y + '" width="36" height="44"/></clipPath></defs><g clip-path="url(#' + id + 'b' + i + ')">' + image + '</g></svg>');
    });
    svg(rad, '<svg viewBox="98 173 202 202"><defs><clipPath id="' + id + 'r"><circle cx="199" cy="274" r="101"/></clipPath></defs><g clip-path="url(#' + id + 'r)">' + image + '</g></svg>');
  }
  function zeichneSchloss(s, oeffnungswinkel) {
    var n = tresorStand(s); root.setAttribute('data-ziffern', String(n.ziffern)); root.setAttribute('data-offen', String(n.offen));
    tuer.style.transform = 'rotateY(' + (oeffnungswinkel == null ? n.offen ? -82 : 0 : oeffnungswinkel) + 'deg)';
    rad.style.transform = 'rotate(' + (n.ziffern * 90) + 'deg)'; licht.style.opacity = n.offen ? '.85' : '0';
    fund.hidden = !n.offen; root.setAttribute('data-fund', String(n.offen));
    ziffern.forEach(function (e, i) { e.textContent = n.code[i]; e.classList.toggle('geloest', n.code[i] !== '?'); riegel[i].classList.toggle('geloest', i < n.ziffern); if (riegel[i].firstChild) riegel[i].firstChild.style.transform = 'translateX(' + (i < n.ziffern ? i % 2 ? -100 : 100 : 0) + '%)'; });
    code.setAttribute('aria-label', 'Tresorcode: ' + n.code.map(function (c) { return c === '?' ? 'unbekannt' : c; }).join(', '));
    balken.forEach(function (b, i) { b.firstChild.style.width = Math.min(1, Math.max(0, n.summe / n.ziel * 4 - i)) * 100 + '%'; b.classList.toggle('geloest', i < n.ziffern); });
    wert.textContent = z(n.summe) + ' / ' + z(n.ziel) + ' Last · ' + n.ziffern + '/4 Schlösser' + (n.offen ? ' · Code ' + n.code.join(' ') : '');
    hinweis.textContent = n.offen ? (a.abgeschlossen ? 'Die Beute steht im Wochenbericht.' : 'Die Beute verrät der Wochenbericht.') : a.abgeschlossen ? 'Der Tresor bleibt verschlossen · ' + z(Math.max(0, n.ziel - n.summe)) + ' Last fehlen.' : n.ziffern === 4 ? 'Alle vier Codeziffern sind bekannt.' : 'Nächste Ziffer bei ' + z(n.ziel * (n.ziffern + 1) / 4) + ' Last. Jedes Training zählt.';
  }
  function plan() { var w = arena.clientWidth || Math.min(448, Math.max(240, window.innerWidth - 64)); return tresorPositionen(a.spieler, w, w * 1.25); }
  function pose(e, p) { minispielSetzePose(e.querySelector('.ms-avatar'), a, e.getAttribute('data-id'), p); }
  function zeichneTeam(s) {
    var n = tresorStand(s), positionen = plan(); feld.replaceChildren(); liste.replaceChildren(); mitglieder.clear(); root.setAttribute('data-feld', a.spieler.length > 12 ? 'gross' : 'normal');
    a.spieler.forEach(function (sp) {
      var p = positionen.get(sp.id), last = tresorZahl(n.lasten[sp.id]), jubel = n.offen && last > 0, avatar = minispielAvatar(a, sp.id, jubel ? 'jubel' : 'bereit');
      var e = el('div', { class: 'tr-akteur', 'data-id': sp.id, 'data-ich': String(!!sp.ich), title: sp.name + ' · ' + z(last) + ' Last' }, [el('div', { class: 'tr-koerper' }, [avatar]), el('span', { class: 'tr-name', text: sp.name + (sp.ich ? ' · Du' : '') })]);
      e.style.left = p.x + '%'; e.style.top = p.y + '%'; e.style.width = p.w + 'px'; feld.appendChild(e); mitglieder.set(sp.id, e);
      liste.appendChild(el('div', { class: 'tr-person', role: 'listitem', 'data-id': sp.id, 'data-ich': String(!!sp.ich), 'aria-label': sp.name + ': ' + z(last) + ' Last' }, [minispielAvatar(a, sp.id, jubel ? 'jubel' : 'bereit'), el('span', { class: 'tr-person-name', text: sp.name + (sp.ich ? ' · Du' : ''), title: sp.name }), el('strong', { class: 'tr-last', text: z(last) + ' Last' })]));
    });
    if (!a.spieler.length) liste.appendChild(el('p', { class: 'tr-leer', text: 'Das Team wird zusammengestellt.' }));
  }
  function zeichne(s) { zeichneSchloss(s); zeichneTeam(s); }
  function beschreibe(s, ende) {
    var n = tresorStand(s);
    if (ende && a.abgeschlossen) return n.offen ? 'Mission geschafft · zusammen geknackt!' : 'Mission beendet · diesmal bleibt der Tresor zu';
    return n.offen ? 'Zusammen geknackt! Der Tresor ist offen.' : n.ziffern ? n.ziffern + ' von 4 Schlössern gelöst · das Team legt nach' : 'Vier Schlösser. Ein Team. Euer nächster Coup.';
  }
  function zeige(id) { var e = Array.from(liste.children).find(function (e) { return e.getAttribute('data-id') === id; }); if (e) fenster.scrollLeft = Math.max(0, e.offsetLeft + e.offsetWidth / 2 - fenster.clientWidth / 2); }
  function endstand(merken) {
    phase('ende'); root.setAttribute('data-rueckblick', 'false'); root.removeAttribute('data-aktiv'); zeichne(aktuell); medien();
    status.textContent = beschreibe(aktuell, true); zeit.textContent = a.abgeschlossen ? 'Wochenabschluss' : 'Aktueller Stand';
    skip.hidden = true; replay.hidden = !a.spieler.length; replay.disabled = !bewegung();
    var ich = a.spieler.find(function (sp) { return sp.ich; }); if (ich) zeige(ich.id);
    if (merken && root.isConnected) tresorStaende[a.id] = { signaturen: signaturen, abgeschlossen: !!a.abgeschlossen };
  }
  function abbrechen() { lauf++; reinigen(); endstand(true); if (tresorAbbrechen === abbrechen) tresorAbbrechen = null; }
  function station(i) {
    var s = stationen[i], d = s.zeitpunkt && new Date(s.zeitpunkt);
    zeit.textContent = (i + 1) + ' / ' + stationen.length + (d && Number.isFinite(d.getTime()) ? ' · ' + d.toLocaleString('de-DE', { timeZone: a.zeitzone || 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + (s.art === 'korrektur' ? ' · Korrektur' : '');
  }
  function partikel(nr, gross) {
    for (var i = 0; i < (gross ? 14 : 5); i++) {
      var e = el('i', { class: gross ? 'tr-funke' : 'tr-klick' }); e.style.left = (gross ? 30 + i % 7 * 7 : 34 + i * 8) + '%'; e.style.top = (gross ? 40 + i % 3 * 12 : 29) + '%'; effekte.appendChild(e);
      bewegen(e, [{ opacity: 0, transform: 'translate(0,0) scale(.2)' }, { opacity: .9, offset: .25 }, { opacity: 0, transform: 'translate(' + (i % 2 ? 16 : -16) + 'px,-35px) scale(1)' }], { duration: gross ? 1200 : 600, delay: i * 25 }, nr).then(function (e) { e.remove(); }.bind(null, e));
    }
  }
  async function laufzyklus(e, dauer, nr) {
    pose(e, 'laufen'); var atlas = e.querySelector('.bz-lauf-atlas');
    if (atlas && !tresorBildFehler.has(atlas.getAttribute('href'))) return bewegen(atlas, [[0, 0], [-200, 0], [0, -300], [-200, -300], [0, 0]].map(function (p, i) { return { transform: 'translate(' + p[0] + 'px,' + p[1] + 'px)', offset: i / 4, easing: 'steps(1,end)' }; }), { duration: 400, iterations: dauer / 400 }, nr);
    pose(e, 'bereit'); return bewegen(e.querySelector('.tr-koerper'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 350, iterations: dauer / 350 }, nr);
  }
  async function auftritt(s, nr) {
    phase('auftritt'); status.textContent = 'Die Crew ist da · vier Schlösser bis zum Coup';
    var e = el('div', { class: 'tr-auftritt' }, [el('span', { text: 'MISSION TRESOR' }), el('strong', { text: 'Vier Schlösser. Ein Team.' }), el('small', { text: 'Jedes Training bringt euch an den Code.' })]); effekte.appendChild(e);
    if (!await bewegen(e, [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 320 }, nr)) return false;
    if (!await warten(650, nr)) return false;
    if (!await bewegen(e, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 }, nr)) return false; e.remove(); return true;
  }
  async function oeffnen(s, nr) {
    phase('riegel'); status.textContent = 'Vier Ziffern. Vier Riegel. Jetzt!';
    if (!await bewegen(rad, [{ transform: 'rotate(360deg)' }, { transform: 'rotate(354deg)' }, { transform: 'rotate(450deg)' }], { duration: 500, easing: 'ease-in-out' }, nr)) return false;
    if (!await warten(200, nr)) return false;
    phase('oeffnen'); root.setAttribute('data-offen', 'true');
    bewegen(licht, [{ opacity: 0 }, { opacity: .85 }], { duration: 1250 }, nr);
    if (!await bewegen(tuer, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-5deg)', offset: .15 }, { transform: 'rotateY(-82deg)' }], { duration: 1400, easing: 'cubic-bezier(.25,.1,.2,1)' }, nr)) return false;
    phase('licht'); partikel(nr, true); status.textContent = 'Zusammen geknackt! Die Beute verrät der Wochenbericht.';
    if (!await warten(450, nr)) return false;
    phase('fund'); fund.hidden = false; fund.classList.add('tr-fund-auftritt'); root.setAttribute('data-fund', 'true');
    status.textContent = 'BOING! Ein vollständig verpixelter Überraschungsfund.';
    var ruf = el('strong', { class: 'tr-boing', text: 'BOING!', 'aria-hidden': 'true' }); effekte.appendChild(ruf);
    var auftritt = await Promise.all([
      bewegen(fund, [
        { opacity: 0, transform: 'translateY(32px) scale(.45,.25) rotate(-9deg)' },
        { opacity: 1, transform: 'translateY(-14px) scale(1.12,.92) rotate(4deg)', offset: .48 },
        { opacity: 1, transform: 'translateY(3px) scale(.96,1.04) rotate(-2deg)', offset: .73 },
        { opacity: 1, transform: 'translateY(0) scale(1) rotate(0deg)' }
      ], { duration: 760, easing: 'ease-out' }, nr),
      bewegen(ruf, [
        { opacity: 0, transform: 'translateY(12px) scale(.5) rotate(-18deg)' },
        { opacity: 1, transform: 'translateY(0) scale(1.12) rotate(-12deg)', offset: .3 },
        { opacity: 1, transform: 'translateY(0) scale(1) rotate(-12deg)', offset: .75 },
        { opacity: 0, transform: 'translateY(-8px) scale(1) rotate(-12deg)' }
      ], { duration: 1100 }, nr)
    ]);
    if (!auftritt.every(Boolean)) return false;
    ruf.remove(); fund.classList.remove('tr-fund-auftritt');
    phase('jubel'); var bewegungen = [];
    mitglieder.forEach(function (e, id) { if (tresorZahl(tresorStand(s).lasten[id]) > 0) { pose(e, 'jubel'); bewegungen.push(bewegen(e.querySelector('.tr-koerper'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], { duration: 800 }, nr)); } });
    return (await Promise.all(bewegungen)).every(Boolean) && await warten(400, nr);
  }
  async function zug(vorher, s, nr) {
    var w = tresorWechsel(vorher, s), v = tresorStand(vorher), n = tresorStand(s.stand); zeichne(vorher);
    if (w.korrektur || !w.training) {
      phase(w.korrektur ? 'korrektur' : 'rueckblick'); zeichne(s.stand); status.textContent = w.korrektur ? 'Der Wochenverlauf wurde korrigiert · neuer Stand' : beschreibe(s.stand, false); return warten(w.korrektur ? 500 : 180, nr);
    }
    var ids = w.ids.filter(function (id) { return spieler.has(id); }), id = ids.find(function (id) { return spieler.get(id).ich; }) || ids[0], e = mitglieder.get(id);
    if (v.offen) { phase('nachlegen'); zeichne(s.stand); status.textContent = name(id) + ' legt nach · der Tresor ist bereits offen'; return warten(500, nr); }
    root.setAttribute('data-aktiv', id || 'team'); if (id) zeige(id);
    phase('antritt'); status.textContent = name(id) + ' bringt ' + z(tresorZahl(n.lasten[id]) - tresorZahl(v.lasten[id])) + ' Last an den Tresor';
    if (e) {
      var ziel = { left: '73%', top: '80%', width: '78px' };
      var erfolg = await Promise.all([laufzyklus(e, 700, nr), bewegen(e, [{ left: e.style.left, top: e.style.top, width: e.style.width }, ziel], { duration: 700, easing: 'ease-in-out' }, nr)]);
      if (!erfolg.every(Boolean)) return false; pose(e, 'schlag'); e.querySelector('.tr-koerper').style.transform = '';
    } else if (!await warten(300, nr)) return false;
    phase('drehen'); status.textContent = name(id) + ' setzt die Mechanik in Bewegung';
    if (!await bewegen(rad, [{ transform: 'rotate(' + v.ziffern * 90 + 'deg)' }, { transform: 'rotate(' + (v.ziffern * 90 - 16) + 'deg)', offset: .18 }, { transform: 'rotate(' + (v.ziffern * 90 + (w.neu.length ? 45 : 35)) + 'deg)' }], { duration: 650, easing: 'ease-in-out' }, nr)) return false;
    if (e) { e.querySelector('.tr-koerper').style.transform = ''; pose(e, 'bereit'); }
    Array.from(liste.children).forEach(function (person) {
      var id = person.getAttribute('data-id'), label = person.querySelector('.tr-last');
      if (label) { label.textContent = z(n.lasten[id]) + ' Last'; person.setAttribute('aria-label', name(id) + ': ' + z(n.lasten[id]) + ' Last'); }
    });
    for (var i = 0; i < w.neu.length; i++) {
      var index = w.neu[i], zwischen = Object.assign({}, s.stand, { ziffern: index + 1, offen: false });
      phase('ziffer'); zeichneSchloss(zwischen, 0); status.textContent = 'Klick! Schloss ' + (index + 1) + ' von 4 gelöst'; partikel(nr, false);
      if (!(await Promise.all([
        bewegen(ziffern[index], [{ transform: 'translateY(-8px)', opacity: .2 }, { transform: 'translateY(2px)', opacity: 1, offset: .7 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 450 }, nr),
        bewegen(rad, [{ transform: 'rotate(' + (index * 90 + (i === 0 ? 45 : 0)) + 'deg)' }, { transform: 'rotate(' + (index + 1) * 90 + 'deg)' }], { duration: 450, easing: 'ease-in-out' }, nr),
        bewegen(riegel[index].firstChild, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (index % 2 ? -100 : 100) + '%)' }], { duration: 450, easing: 'ease-in-out' }, nr)
      ])).every(Boolean)) return false;
      if (!await warten(280, nr)) return false;
    }
    if (w.oeffnen) { if (!await oeffnen(s.stand, nr)) return false; }
    else { zeichneSchloss(s.stand); if (!await warten(250, nr)) return false; }
    if (e) {
      var p = plan().get(id); phase('zurueck');
      if (!(await Promise.all([laufzyklus(e, 550, nr), bewegen(e, [{ left: '73%', top: '80%', width: '78px' }, { left: p.x + '%', top: p.y + '%', width: p.w + 'px' }], { duration: 550, easing: 'ease-in-out' }, nr)])).every(Boolean)) return false;
    }
    zeichne(s.stand); root.removeAttribute('data-aktiv'); return true;
  }
  async function finale(nr) {
    phase('abschluss'); zeichne(aktuell); status.textContent = beschreibe(aktuell, true); zeit.textContent = 'Wochenabschluss';
    var e = el('div', { class: 'tr-ergebnis' }, [el('strong', { text: tresorStand(aktuell).offen ? 'MISSION GESCHAFFT' : 'DIESMAL BLEIBT ER ZU' }), el('span', { text: tresorStand(aktuell).offen ? 'Euer Team hat den Code geknackt.' : z(Math.max(0, tresorStand(aktuell).ziel - tresorStand(aktuell).summe)) + ' Last haben gefehlt.' })]); effekte.appendChild(e);
    if (!await bewegen(e, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 }, nr)) return false;
    return warten(1400, nr);
  }
  async function spiele(start, intro) {
    lauf++; reinigen(); var nr = lauf; if (!root.isConnected) return;
    if (!bewegung() || document.hidden || !a.spieler.length) { endstand(true); return; }
    tresorAbbrechen = abbrechen; root.setAttribute('data-rueckblick', 'true'); skip.hidden = false; replay.hidden = true; zeichne(stationen[start].stand); station(start);
    try {
      phase('laden'); status.textContent = 'Die Crew bereitet den Coup vor'; await Promise.race([tresorBilder(a), warten(1600, nr)]); if (!gueltig(nr)) return; medien();
      if (intro && !await auftritt(stationen[start].stand, nr)) return;
      for (var i = start + 1; i < stationen.length; i++) { station(i); if (!await zug(stationen[i - 1].stand, stationen[i], nr)) return; }
      if (a.abgeschlossen && !await finale(nr)) return;
    } finally { if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (tresorAbbrechen === abbrechen) tresorAbbrechen = null; } }
  }
  async function korrigiere() {
    lauf++; reinigen(); var nr = lauf; tresorAbbrechen = abbrechen; root.setAttribute('data-rueckblick', 'true'); phase('korrektur'); skip.hidden = false; replay.hidden = true;
    zeichne(aktuell); status.textContent = 'Der Wochenverlauf wurde korrigiert · neuer Stand'; await warten(500, nr);
    if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (tresorAbbrechen === abbrechen) tresorAbbrechen = null; }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); }; medien();
  // Kein Aufblitzen späterer Ziffern vor dem ersten Frame des Rückblicks.
  var rueckblick = bewegung() && !document.hidden && a.spieler.length && ab !== null && !(gesehen && ab === 0);
  if (rueckblick) { phase('bereit'); zeichne(stationen[ab].stand); status.textContent = beschreibe(stationen[ab].stand, false); replay.hidden = true; }
  else endstand(false);
  tresorDarstellung = function () { if (root.isConnected) endstand(false); };
  tresorBilder(a).then(function () { if (root.isConnected) medien(); });
  requestAnimationFrame(function () {
    if (!root.isConnected) return;
    if (!bewegung() || document.hidden) { endstand(true); return; }
    if (ab === null) { if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(stationen.length - 1, false); else endstand(true); }
    else if (gesehen && ab === 0) korrigiere(); else spiele(ab, !gesehen);
  });
  return root;
};
