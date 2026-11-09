/* Losduell: ein Schlag pro Trainingszuwachs, entschieden wird erst beim Abschluss. */
var duellStaende = {}, duellAuswahl = {}, duellAbbrechen = null, duellDarstellung = null, duellSvgNummer = 0;
var duellFensterbreite = window.innerWidth;
var duellBewegungsWahl = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('visibilitychange', function () { if (document.hidden && duellAbbrechen) duellAbbrechen(); });
window.addEventListener('resize', function () {
  if (window.innerWidth !== duellFensterbreite) { if (duellAbbrechen) duellAbbrechen(); else if (duellDarstellung) duellDarstellung(); }
  duellFensterbreite = window.innerWidth;
});
if (duellBewegungsWahl && duellBewegungsWahl.addEventListener) duellBewegungsWahl.addEventListener('change', function (e) {
  if (e.matches && duellAbbrechen) duellAbbrechen();
  document.querySelectorAll('.ms-duell[data-duellphase="ende"] .dd-replay').forEach(function (b) { b.disabled = e.matches; });
});
function duellZahl(n) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0; }
function duellKey(p) { return JSON.stringify([p.a, p.b]); }
function duellListe(s) { return s && Array.isArray(s.paare) ? s.paare : []; }
function duellFuehrt(p) { var a = duellZahl(p.lastA), b = duellZahl(p.lastB); return a === b ? null : a > b ? p.a : p.b; }
function duellAnteil(p) { var a = duellZahl(p.lastA), b = duellZahl(p.lastB); return a + b > 0 ? a / (a + b) : .5; }
function duellWechsel(vorher, station) {
  var alt = new Map(duellListe(vorher).map(function (p) { return [duellKey(p), p]; })), neu = duellListe(station.stand), aktionen = [];
  var korrektur = station.art === 'korrektur' || alt.size !== neu.length;
  neu.forEach(function (p) {
    var v = alt.get(duellKey(p)); if (!v) { korrektur = true; return; }
    ['A', 'B'].forEach(function (seite) {
      var id = seite === 'A' ? p.a : p.b, delta = duellZahl(p['last' + seite]) - duellZahl(v['last' + seite]);
      if (delta < 0 || (id === 'bot' && delta !== 0)) korrektur = true;
      if (id !== 'bot' && delta > 0) aktionen.push({ key: duellKey(p), id: id, delta: delta });
    });
  });
  return { korrektur: korrektur, aktionen: !korrektur && station.art === 'training' ? aktionen : [] };
}
function duellSignaturen(stationen) { return stationen.map(function (s) { return JSON.stringify([s.art, s.stand]); }); }
function duellFortsetzung(alt, neu) {
  if (!neu.length) return null;
  if (!alt || !alt.length || !alt.every(function (s, i) { return s === neu[i]; })) return 0;
  return alt.length === neu.length ? null : alt.length - 1;
}
function duellStartpaar(paare, spieler, wahl) {
  if (paare.some(function (p) { return duellKey(p) === wahl; })) return wahl;
  var ich = new Set(spieler.filter(function (sp) { return sp.ich; }).map(function (sp) { return sp.id; }));
  var p = paare.find(function (p) { return ich.has(p.a) || ich.has(p.b); }) || paare[0]; return p ? duellKey(p) : null;
}
var duellBildCache = new Map(), duellBildFehler = new Set();
function duellBilder(a) {
  var urls = new Set(Object.values(a.duellBilder || {}));
  a.spieler.forEach(function (sp) { var b = a.figuren && a.figuren[sp.figur], m = b && b.laufen && /href="([^"]+)"/.exec(b.laufen); if (m) urls.add(m[1]); });
  return Promise.all(Array.from(urls).map(function (url) {
    if (!duellBildCache.has(url)) duellBildCache.set(url, new Promise(function (ok) {
      var b = new Image(); b.onload = function () { duellBildFehler.delete(url); ok(true); };
      b.onerror = function () { duellBildFehler.add(url); duellBildCache.delete(url); ok(false); }; b.src = url;
    })); return duellBildCache.get(url);
  }));
}
window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
window.MINISPIEL_SZENEN.duell = function (a) {
  if (duellAbbrechen) duellAbbrechen();
  var aktuell = a.aktuell || { paare: [] }, stationen = (a.verlauf || []).filter(function (s) { return !!s.stand; });
  if (!stationen.length) stationen = [{ art: 'start', zeitpunkt: null, stand: aktuell }];
  var spieler = new Map(a.spieler.map(function (sp) { return [sp.id, sp]; })), signaturen = duellSignaturen(stationen), gesehen = duellStaende[a.id];
  var ab = duellFortsetzung(gesehen && gesehen.signaturen, signaturen), wahl = duellStartpaar(duellListe(aktuell), a.spieler, duellAuswahl[a.id]);
  var lauf = 0, animationen = new Set(), wartende = new Map(), athleten = new Map(), gezeigt = wahl;
  var status = el('div', { class: 'ms-status', role: 'status', 'aria-live': 'polite' });
  var kulisse = el('div', { class: 'dd-kulisse', 'aria-hidden': 'true' }), feld = el('div', { class: 'dd-feld', 'aria-hidden': 'true' }), effekte = el('div', { class: 'dd-effekte', 'aria-hidden': 'true' });
  var hud = el('div', { class: 'dd-hud' }), arena = el('div', { class: 'dd-arena' }, [kulisse, feld, effekte, hud]);
  var vorsprung = el('div', { class: 'dd-vorsprung' }), anteil = el('div', { class: 'dd-anteil', 'aria-hidden': 'true' }, [el('i')]);
  var liste = el('div', { class: 'dd-liste', role: 'group', 'aria-label': 'Alle gelosten Duelle; Paar auswählen' });
  var fenster = el('div', { class: 'dd-fenster', tabindex: '0', 'aria-label': 'Duelle, seitlich scrollbar' }, [liste]);
  var zeit = el('div', { class: 'ms-zeit' }), skip = el('button', { class: 'knopf leise', text: 'Überspringen' });
  var replay = el('button', { class: 'knopf leise dd-replay', text: '↻ Nochmal ansehen' }), laden = el('button', { class: 'knopf leise', text: '↻ Stand aktualisieren', onclick: function () { aktualisiereBombe(laden); } });
  var root = el('section', { class: 'ms-scene ms-duell', 'aria-label': 'Losduell im Botzeps-Ring' }, [status, arena,
    el('div', { class: 'dd-stand' }, [vorsprung, anteil]), fenster,
    el('p', { class: 'dd-regel', text: 'Echte Wochenlast. Keine Trefferpunkte. Mehr Last beim Wochenabschluss gewinnt.' }), zeit,
    el('div', { class: 'ms-steuerung' }, [skip, replay, laden])]);
  function name(id) { return spieler.has(id) ? spieler.get(id).name : id === 'bot' ? 'Botzeps' : 'Unbekannt'; }
  function z(n) { return duellZahl(n).toLocaleString('de-DE', { maximumFractionDigits: 2 }); }
  function bewegung() { return !(duellBewegungsWahl && duellBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && root.isConnected && !document.hidden && bewegung(); }
  function phase(p) { root.setAttribute('data-duellphase', p); }
  function paar(s, key) { return duellListe(s).find(function (p) { return duellKey(p) === key; }) || null; }
  function warten(ms, nr) { return new Promise(function (ok) { var t = setTimeout(function () { wartende.delete(t); ok(gueltig(nr)); }, ms); wartende.set(t, ok); }); }
  function bewegen(e, frames, opt, nr) {
    if (!e || !gueltig(nr)) return Promise.resolve(false);
    var an = e.animate(frames, Object.assign({ fill: 'forwards' }, opt)); animationen.add(an);
    return an.finished.then(function () { if (!gueltig(nr)) return false; var f = frames[frames.length - 1]; ['transform', 'opacity', 'left', 'top'].forEach(function (p) { if (f[p] != null) e.style[p] = f[p]; }); return true; }, function () { return false; })
      .finally(function () { animationen.delete(an); an.cancel(); });
  }
  function reinigen() {
    animationen.forEach(function (an) { an.cancel(); }); animationen.clear(); wartende.forEach(function (ok, t) { clearTimeout(t); ok(false); }); wartende.clear();
    effekte.replaceChildren(); feld.style.transform = ''; root.removeAttribute('data-angreifer');
  }
  function medien() {
    kulisse.replaceChildren(); var url = a.duellBilder && a.duellBilder.ring;
    if (url && !duellBildFehler.has(url)) { var b = el('img', { src: url, alt: '' }); b.onerror = function () { b.remove(); }; kulisse.appendChild(b); }
  }
  function avatar(id, p) {
    if (id !== 'bot') return minispielAvatar(a, id, p);
    var e = el('div', { class: 'ms-avatar dd-bot', 'data-id': 'bot', 'data-pose': p }), url = a.duellBilder && a.duellBilder.bot;
    e.setAttribute('aria-label', 'Botzeps, Trainingsroboter');
    if (url && !duellBildFehler.has(url) && /^(?:\/api\/figurbild\/[a-z0-9-]+\.png|data:image\/png;base64,[A-Za-z0-9+/=]+)$/.test(url)) {
      var index = p === 'schlag' ? 1 : p === 'jubel' ? 2 : p === 'ko' ? 3 : 0, x = index % 2 * 200, y = Math.floor(index / 2) * 300, idSvg = 'ddbot' + (++duellSvgNummer);
      e.innerHTML = '<svg viewBox="' + x + ' ' + y + ' 200 300"><defs><clipPath id="' + idSvg + '"><rect x="' + x + '" y="' + y + '" width="200" height="300"/></clipPath></defs><image clip-path="url(#' + idSvg + ')" href="' + url + '" width="400" height="600"/></svg>';
    } else { e.classList.add('ms-avatar-ersatz'); e.textContent = '🤖'; }
    return e;
  }
  function pose(e, p) {
    var id = e.getAttribute('data-id'), alt = e.querySelector('.ms-avatar'), sp = spieler.get(id), rechts = e.classList.contains('dd-athlet-rechts');
    // Figur 0 und der Roboter heben die rechte Bildhand; die übrigen Atlanten die linke.
    var nativeRechts = id === 'bot' || !!(sp && sp.figur === 0), spiegeln = p === 'schlag' ? nativeRechts === rechts : rechts;
    e.querySelector('.dd-spiegel').style.transform = spiegeln ? 'scaleX(-1)' : 'scaleX(1)';
    if (id === 'bot') alt.replaceWith(avatar(id, p)); else minispielSetzePose(alt, a, id, p);
  }
  function text(p, fertig) {
    if (!p) return 'Die Duellpaare werden noch ausgelost.';
    var f = duellFuehrt(p), delta = z(Math.abs(duellZahl(p.lastA) - duellZahl(p.lastB)));
    return f ? name(f) + (fertig && a.abgeschlossen ? ' gewinnt' : ' führt') + ' · +' + delta + ' Last' : 'Unentschieden · ' + z(p.lastA) + ' : ' + z(p.lastB);
  }
  function zeichneHud(p, fertig) {
    hud.replaceChildren(); vorsprung.textContent = text(p, fertig); anteil.firstChild.style.width = (p ? duellAnteil(p) * 100 : 50) + '%';
    if (!p) return;
    var f = duellFuehrt(p); root.setAttribute('data-fuehrt', f || 'gleich');
    [p.a, p.b].forEach(function (id, i) {
      var sp = spieler.get(id), n = i === 0 ? p.lastA : p.lastB;
      hud.appendChild(el('div', { class: 'dd-ecke dd-' + (i ? 'blau' : 'rot'), 'data-id': id, 'data-ich': String(!!(sp && sp.ich)) }, [
        el('span', { class: 'dd-name', text: name(id) + (sp && sp.ich ? ' · Du' : ''), title: name(id) }), el('strong', { class: 'dd-last', text: z(n) }), el('small', { text: id === 'bot' ? 'WOCHENZIEL · FEST' : 'WOCHENLAST' })
      ]));
    });
    hud.appendChild(el('span', { class: 'dd-vs', text: 'VS', 'aria-hidden': 'true' }));
  }
  function zeichneFeld(p, fertig) {
    feld.replaceChildren(); athleten.clear(); root.removeAttribute('data-ergebnis');
    if (!p) { feld.appendChild(el('p', { class: 'dd-leer', text: 'Der Ring wartet auf die Auslosung.' })); return; }
    var f = duellFuehrt(p), ergebnis = fertig && a.abgeschlossen;
    [p.a, p.b].forEach(function (id, i) {
      var sp = spieler.get(id), e = el('div', { class: 'dd-athlet dd-athlet-' + (i ? 'rechts' : 'links'), 'data-id': id, 'data-ich': String(!!(sp && sp.ich)) }, [
        el('div', { class: 'dd-spiegel' }, [el('div', { class: 'dd-koerper' }, [avatar(id, ergebnis && f ? id === f ? 'jubel' : 'ko' : 'bereit')])]),
        el('span', { class: 'dd-fighter-name', text: name(id), title: name(id) })
      ]); feld.appendChild(e); athleten.set(id, e);
    });
    if (ergebnis) root.setAttribute('data-ergebnis', f ? 'sieg' : 'remis');
  }
  function zeichneListe(s, fertig) {
    liste.replaceChildren();
    duellListe(s).forEach(function (p, i) {
      var key = duellKey(p), f = duellFuehrt(p), b = el('button', { class: 'dd-paar', type: 'button', 'aria-pressed': String(key === gezeigt), 'data-paar': key,
        'aria-label': 'Duell ' + (i + 1) + ': ' + name(p.a) + ' gegen ' + name(p.b) + '. ' + text(p, fertig), onclick: function () { wahl = key; duellAuswahl[a.id] = key; abbrechen(); zeige(key); } }, [el('span', { class: 'dd-paar-nr', text: 'DUELL ' + (i + 1) })]);
      [p.a, p.b].forEach(function (id, seite) { var sp = spieler.get(id), sieg = fertig && a.abgeschlossen && f === id;
        b.appendChild(el('div', { class: 'dd-teilnehmer', 'data-id': id, 'data-ich': String(!!(sp && sp.ich)), 'data-gewonnen': String(sieg) }, [avatar(id, sieg ? 'jubel' : 'bereit'), el('span', { class: 'dd-paar-name', text: name(id) + (sp && sp.ich ? ' · Du' : ''), title: name(id) }), el('strong', { class: 'dd-paar-last', text: z(seite ? p.lastB : p.lastA) })]));
      });
      b.appendChild(el('span', { class: 'dd-paar-status', text: text(p, fertig) })); liste.appendChild(b);
    });
    if (!duellListe(s).length) liste.appendChild(el('p', { class: 'dd-leer', text: 'Die Duellpaare werden noch ausgelost.' }));
  }
  function zeige(key) { var e = Array.from(liste.children).find(function (e) { return e.getAttribute('data-paar') === key; }); if (e) fenster.scrollLeft = Math.max(0, e.offsetLeft + e.offsetWidth / 2 - fenster.clientWidth / 2); }
  function zeichne(s, key, fertig) {
    gezeigt = duellStartpaar(duellListe(s), a.spieler, key); root.setAttribute('data-paar', gezeigt || ''); var p = paar(s, gezeigt);
    zeichneHud(p, fertig); zeichneFeld(p, fertig); zeichneListe(s, fertig);
  }
  function endstand(merken) {
    phase('ende'); root.setAttribute('data-rueckblick', 'false'); zeichne(aktuell, wahl, true); medien(); status.textContent = text(paar(aktuell, gezeigt), true);
    zeit.textContent = a.abgeschlossen ? 'Wochenabschluss' : 'Aktueller Stand · entschieden wird beim Wochenabschluss'; skip.hidden = true; replay.hidden = !duellListe(aktuell).length; replay.disabled = !bewegung(); zeige(gezeigt);
    if (merken && root.isConnected) duellStaende[a.id] = { signaturen: signaturen, abgeschlossen: !!a.abgeschlossen };
  }
  function abbrechen() { lauf++; reinigen(); endstand(true); if (duellAbbrechen === abbrechen) duellAbbrechen = null; }
  function station(i) {
    var s = stationen[i], d = s.zeitpunkt && new Date(s.zeitpunkt); zeit.textContent = (i + 1) + ' / ' + stationen.length + (d && Number.isFinite(d.getTime()) ? ' · ' + d.toLocaleString('de-DE', { timeZone: a.zeitzone || 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + (s.art === 'korrektur' ? ' · Korrektur' : '');
  }
  async function laufzyklus(e, dauer, nr) {
    pose(e, 'laufen'); var atlas = e.querySelector('.bz-lauf-atlas');
    if (atlas && !duellBildFehler.has(atlas.getAttribute('href'))) return bewegen(atlas, [[0, 0], [-200, 0], [0, -300], [-200, -300], [0, 0]].map(function (p, i) { return { transform: 'translate(' + p[0] + 'px,' + p[1] + 'px)', offset: i / 4, easing: 'steps(1,end)' }; }), { duration: 400, iterations: dauer / 400 }, nr);
    pose(e, 'bereit'); return warten(dauer, nr);
  }
  async function auftritt(s, nr) {
    phase('auftritt'); zeichne(s, wahl, false); var p = paar(s, gezeigt); if (!p) return true;
    status.textContent = name(p.a) + ' gegen ' + name(p.b) + ' · ab in den Ring';
    var banner = el('div', { class: 'dd-banner' }, [el('small', { text: 'BOTZEPS FIGHT NIGHT' }), el('strong', { text: 'Euer Duell. Eure Last.' })]); effekte.appendChild(banner);
    var bewegungen = []; athleten.forEach(function (e, id) { var links = id === p.a; bewegungen.push(laufzyklus(e, 800, nr)); bewegungen.push(bewegen(e, [{ left: links ? '-18%' : '118%' }, { left: links ? '28%' : '72%' }], { duration: 800, easing: 'ease-out' }, nr)); });
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false;
    athleten.forEach(function (e) { pose(e, 'bereit'); }); if (!await warten(350, nr)) return false;
    if (!await bewegen(banner, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-8px)' }], { duration: 220 }, nr)) return false; banner.remove(); return true;
  }
  function impact(nr, x) {
    var e = el('div', { class: 'dd-impact' }); e.style.left = x + '%';
    e.innerHTML = '<svg viewBox="0 0 100 100"><path d="M50 5 59 31 80 16 74 39 98 46 76 58 89 82 63 73 54 97 42 73 17 87 26 62 3 51 28 41 16 18 40 30Z" fill="#ffe69a" stroke="#352633" stroke-width="4"/><path d="M49 25 56 43 74 39 62 53 72 67 54 62 44 79 43 60 25 61 37 49 29 36 45 42Z" fill="#fff8d6"/></svg>';
    effekte.appendChild(e); bewegen(e, [{ opacity: 0, transform: 'translate(-50%,-50%) scale(.35) rotate(-12deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1) rotate(5deg)', offset: .2 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.2) rotate(10deg)' }], { duration: 500 }, nr).then(function () { e.remove(); });
    for (var i = 0; i < 4; i++) { var strich = el('i', { class: 'dd-tempo' }); strich.style.top = (52 + i * 3) + '%'; effekte.appendChild(strich); bewegen(strich, [{ opacity: .7, transform: 'translateX(-12px)' }, { opacity: 0, transform: 'translateX(28px)' }], { duration: 400, delay: i * 20 }, nr).then(function (s) { s.remove(); }.bind(null, strich)); }
  }
  async function schlag(s, nachher, aktion, nr) {
    var p = paar(s, aktion.key), neu = paar(nachher, aktion.key); if (!p || !neu) return true;
    zeichne(s, aktion.key, false); zeige(aktion.key); var links = aktion.id === p.a, gegner = links ? p.b : p.a, e = athleten.get(aktion.id), ziel = athleten.get(gegner), normal = links ? '28%' : '72%', kontakt = links ? '58%' : '42%';
    e.style.zIndex = '4'; root.setAttribute('data-angreifer', aktion.id); phase('ausholen'); status.textContent = name(aktion.id) + ' legt ' + z(aktion.delta) + ' Last nach';
    if (!await bewegen(e.querySelector('.dd-koerper'), [{ transform: 'translateX(0) rotate(0deg)' }, { transform: 'translateX(-5px) rotate(-7deg)' }], { duration: 230, easing: 'ease-in' }, nr)) return false;
    pose(e, 'schlag'); phase('angriff');
    var body = bewegen(e.querySelector('.dd-koerper'), [{ transform: 'translateX(-5px) rotate(-7deg)' }, { transform: 'translateX(0) rotate(3deg)' }], { duration: 160, easing: 'ease-in' }, nr);
    if (!(await Promise.all([body, bewegen(e, [{ left: normal }, { left: kontakt }], { duration: 160, easing: 'ease-in' }, nr)])).every(Boolean)) return false;
    phase('treffer'); impact(nr, links ? 63 : 37); zeichneHud(neu, false); zeichneListe(nachher, false);
    var plus = el('strong', { class: 'dd-plus', text: '+' + z(aktion.delta) + ' LAST' }); plus.style.left = links ? '22%' : '62%'; effekte.appendChild(plus);
    bewegen(plus, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)', offset: .3 }, { opacity: 0, transform: 'translateY(-15px)' }], { duration: 850 }, nr).then(function () { plus.remove(); });
    if (!await warten(110, nr)) return false;
    phase('rueckstoss');
    var bewegungen = [bewegen(ziel, [{ left: links ? '72%' : '28%' }, { left: links ? '77%' : '23%', offset: .3 }, { left: links ? '72%' : '28%' }], { duration: 470, easing: 'ease-out' }, nr),
      bewegen(ziel.querySelector('.dd-koerper'), [{ transform: 'rotate(0deg)' }, { transform: 'rotate(7deg)', offset: .3 }, { transform: 'rotate(0deg)' }], { duration: 470 }, nr),
      bewegen(e, [{ left: kontakt }, { left: normal }], { duration: 470, easing: 'ease-out' }, nr),
      bewegen(e.querySelector('.dd-koerper'), [{ transform: 'rotate(3deg)' }, { transform: 'rotate(0deg)' }], { duration: 470 }, nr)];
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false;
    zeichne(nachher, aktion.key, false); root.removeAttribute('data-angreifer');
    var altF = duellFuehrt(p), neuF = duellFuehrt(neu);
    if (altF !== neuF) {
      phase(neuF ? 'fuehrung' : 'ausgleich'); status.textContent = neuF ? name(neuF) + (altF ? ' dreht das Duell!' : ' geht in Führung!') : 'Ausgleich! ' + name(p.a) + ' und ' + name(p.b) + ' liegen gleichauf';
      var banner = el('div', { class: 'dd-wechsel', text: neuF ? altF ? 'FÜHRUNGSWECHSEL' : 'IN FÜHRUNG' : 'AUSGLEICH' }); effekte.appendChild(banner);
      if (!await bewegen(banner, [{ opacity: 0, transform: 'scale(.88) rotate(-5deg)' }, { opacity: 1, transform: 'scale(1) rotate(-3deg)' }], { duration: 220 }, nr)) return false;
      if (!await warten(550, nr)) return false;
      if (!await bewegen(banner, [{ opacity: 1 }, { opacity: 0 }], { duration: 180 }, nr)) return false; banner.remove();
    } else if (!await warten(160, nr)) return false;
    return true;
  }
  async function zug(vorher, s, nr) {
    var w = duellWechsel(vorher, s);
    if (w.korrektur || !w.aktionen.length) { phase(w.korrektur ? 'korrektur' : 'rueckblick'); zeichne(s.stand, gezeigt, false); status.textContent = w.korrektur ? 'Der Wochenverlauf wurde korrigiert · neuer Stand' : text(paar(s.stand, gezeigt), false); return warten(w.korrektur ? 500 : 160, nr); }
    // Jede Aktion verwendet nur ihren damaligen Paarstand. Andere Paare springen nicht voraus.
    var stand = { paare: duellListe(vorher).map(function (p) { return Object.assign({}, p, { lastA: duellZahl(p.lastA), lastB: duellZahl(p.lastB) }); }) };
    for (var i = 0; i < w.aktionen.length; i++) { var aktion = w.aktionen[i], nachher = { paare: stand.paare.map(function (p) { return Object.assign({}, p, { lastA: duellZahl(p.lastA), lastB: duellZahl(p.lastB) }); }) }, p = paar(nachher, aktion.key); p[aktion.id === p.a ? 'lastA' : 'lastB'] += aktion.delta; if (!await schlag(stand, nachher, aktion, nr)) return false; stand = nachher; }
    return true;
  }
  async function finale(nr) {
    phase('abschluss'); zeichne(aktuell, wahl, true); zeit.textContent = 'Wochenabschluss'; var p = paar(aktuell, gezeigt); status.textContent = text(p, true); if (!p) return true;
    var f = duellFuehrt(p), banner = el('div', { class: 'dd-ergebnis' }, [el('small', { text: 'DAS DUELL IST ENTSCHIEDEN' }), el('strong', { text: f ? name(f) + ' gewinnt!' : 'Unentschieden' }), el('span', { text: z(p.lastA) + ' : ' + z(p.lastB) + ' Last' })]); effekte.appendChild(banner);
    if (!await bewegen(banner, [{ opacity: 0, transform: 'translateY(12px) scale(.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 350 }, nr)) return false;
    if (f && athleten.has(f)) bewegen(athleten.get(f).querySelector('.dd-koerper'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-9px)' }, { transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 850 }, nr);
    return warten(1400, nr);
  }
  async function spiele(start, intro) {
    lauf++; reinigen(); var nr = lauf; if (!root.isConnected) return;
    if (!bewegung() || document.hidden || !duellListe(aktuell).length) { endstand(true); return; }
    duellAbbrechen = abbrechen; root.setAttribute('data-rueckblick', 'true'); skip.hidden = false; replay.hidden = true; zeichne(stationen[start].stand, wahl, false); station(start);
    try { phase('laden'); status.textContent = 'Der Ring wird vorbereitet'; await Promise.race([duellBilder(a), warten(1600, nr)]); if (!gueltig(nr)) return; medien();
      if (intro && !await auftritt(stationen[start].stand, nr)) return;
      for (var i = start + 1; i < stationen.length; i++) { station(i); if (!await zug(stationen[i - 1].stand, stationen[i], nr)) return; }
      if (a.abgeschlossen && !await finale(nr)) return;
    } finally { if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (duellAbbrechen === abbrechen) duellAbbrechen = null; } }
  }
  async function korrigiere() {
    lauf++; reinigen(); var nr = lauf; duellAbbrechen = abbrechen; phase('korrektur'); root.setAttribute('data-rueckblick', 'true'); skip.hidden = false; replay.hidden = true;
    zeichne(aktuell, wahl, true); status.textContent = 'Der Wochenverlauf wurde korrigiert · neuer Stand'; await warten(500, nr);
    if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true); if (duellAbbrechen === abbrechen) duellAbbrechen = null; }
  }
  skip.onclick = abbrechen; replay.onclick = function () { spiele(0, true); }; medien();
  var rueckblick = bewegung() && !document.hidden && duellListe(aktuell).length && ab !== null && !(gesehen && ab === 0);
  if (rueckblick) { phase('bereit'); zeichne(stationen[ab].stand, wahl, false); status.textContent = text(paar(stationen[ab].stand, gezeigt), false); replay.hidden = true; }
  else endstand(false);
  duellDarstellung = function () { if (root.isConnected) endstand(false); }; duellBilder(a).then(function () { if (root.isConnected) { medien(); if (root.getAttribute('data-duellphase') === 'ende') zeichne(aktuell, wahl, true); } });
  var anfang = lauf;
  requestAnimationFrame(function () {
    if (!root.isConnected || lauf !== anfang) return;
    if (!bewegung() || document.hidden) { endstand(true); return; }
    if (ab === null) { if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(stationen.length - 1, false); else endstand(true); }
    else if (gesehen && ab === 0) korrigiere(); else spiele(ab, !gesehen);
  }); return root;
};
