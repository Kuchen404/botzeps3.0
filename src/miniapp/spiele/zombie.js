/* Ein gemeinsames Gym: alle Namen im Bild, dekorative Abwehr ohne Zustandsänderung. */
var zombieStaende = {}, zombieAbbrechen = null, zombieDarstellung = null, zombieSvgNummer = 0;
var zombieFristAbrufe = new Map();
var zombieFensterbreite = window.innerWidth;
var zombieBewegungsWahl = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('visibilitychange', function () {
  if (document.hidden) { if (zombieAbbrechen) zombieAbbrechen(); }
  else if (zombieDarstellung) zombieDarstellung();
});
window.addEventListener('resize', function () {
  if (window.innerWidth !== zombieFensterbreite) { if (zombieAbbrechen) zombieAbbrechen(); if (zombieDarstellung) zombieDarstellung(); }
  zombieFensterbreite = window.innerWidth;
});
if (zombieBewegungsWahl && zombieBewegungsWahl.addEventListener) zombieBewegungsWahl.addEventListener('change', function () {
  if (zombieAbbrechen) zombieAbbrechen(); if (zombieDarstellung) zombieDarstellung();
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
function zombieVerlaufGeaendert(alt, neu) { return !!(alt && alt.length && !alt.every(function (s, i) { return s === neu[i]; })); }
function zombieVersuch(s, spieler, index) {
  var ids = zombieInfizierte(s), zombies = spieler.filter(function (sp) { return ids.has(sp.id); }), menschen = spieler.filter(function (sp) { return !ids.has(sp.id); });
  if (!zombies.length || !menschen.length) return null;
  return { angreifer: zombies[index % zombies.length].id, ziel: menschen[index % menschen.length].id };
}
// Nur eine tatsächlich verlängerte Schutzwirkung wird als Gegengift-Einnahme erzählt.
function zombieGegengift(vorher, station) {
  if (station.art !== 'training' || zombieWechsel(vorher, station).korrektur) return [];
  var neu = station.stand, infiziert = zombieInfizierte(neu);
  return Object.keys(neu.schutz || {}).filter(function (id) {
    var alt = vorher.schutz && vorher.schutz[id], bis = Date.parse(neu.schutz[id].bis);
    return !infiziert.has(id) && Number.isFinite(bis) && (!alt || bis > Date.parse(alt.bis) || !!(vorher.gefahr && vorher.gefahr[id] && !(neu.gefahr && neu.gefahr[id])));
  });
}
function zombieBissAngreifer(s, spieler, ziel) {
  var infiziert = zombieInfizierte(s);
  return spieler.find(function (sp) { return sp.id !== ziel && infiziert.has(sp.id); })?.id ?? null;
}
function zombiePositionen(s, spieler, breite) {
  var ids = zombieInfizierte(s), menschen = spieler.filter(function (sp) { return !ids.has(sp.id); }), zombies = spieler.filter(function (sp) { return ids.has(sp.id); });
  var cols = Math.max(2, Math.min(5, Math.floor((breite - 16) / 90))), w = Math.min(60, (breite - 24) / cols * .62), h = w * 1.5, zelle = h + 34, oben = Math.max(85, Math.min(130, breite * .29));
  var mRows = menschen.length ? Math.ceil((menschen.length + 1) / cols) : 0, zRows = Math.ceil(zombies.length / cols), barriere = oben + mRows * zelle + 6;
  var hoehe = Math.max(breite * 1.42, oben + (Math.ceil(spieler.length / cols) + 1) * zelle + 66), plan = new Map();
  function gruppe(liste, start, zombie) {
    liste.forEach(function (sp, i) { var row = Math.floor(i / cols), n = Math.min(cols, liste.length - row * cols), x = breite / 2 + (i % cols - ((zombie ? n : cols) - 1) / 2) * ((breite - 20) / cols); plan.set(sp.id, { x: x, y: start + row * zelle + h + 25, w: w, zombie: zombie }); });
  }
  gruppe(menschen, oben, false); gruppe(zombies, menschen.length ? barriere + 54 : oben, true);
  return { plan: plan, hoehe: Math.max(hoehe, oben + mRows * zelle + (zRows ? 60 + zRows * zelle : 0) + 8), barriere: barriere, cols: cols, menschen: menschen.length, zombies: zombies.length };
}
// Absolutfristen kommen ausschließlich vom Server; hier wird nur die Anzeige berechnet.
function zombieWarnung(s, id, jetzt, abgeschlossen) {
  var g = s.gefahr && s.gefahr[id], ab = g && Date.parse(g.warnAb), frist = g && Date.parse(g.frist);
  if (abgeschlossen || zombieInfizierte(s).has(id) || !Number.isFinite(ab) || !Number.isFinite(frist) || frist <= ab || !Number.isFinite(jetzt) || jetzt < ab) return null;
  var rest = frist - jetzt, kritisch = rest <= 6 * 3600000, minuten = Math.ceil(rest / 60000);
  var text = rest <= 0 ? 'Frist abgelaufen · wird geprüft' : rest < 60000 ? '<1 Min.' : String(Math.floor(minuten / 60)).padStart(2, '0') + ':' + String(minuten % 60).padStart(2, '0') + ' h';
  return { stufe: rest <= 0 ? 'abgelaufen' : kritisch ? 'kritisch' : 'warnung', text: rest <= 0 ? text : (kritisch ? '⚠ Noch ' : 'Trainieren: ') + text, frist: frist, rest: rest };
}
// Richtung der vorhandenen gezeichneten Posen. Neue Angriffsphasen sind immer rechts.
function zombiePoseBlick(figur, pose) {
  if (/^angriff[0-3]$/.test(pose)) return 1;
  if (figur == null) return 1;
  if (pose === 'ziehen') return -1;
  return Number(figur) === 0 ? 1 : -1;
}
var zombieBildCache = new Map(), zombieBildFehler = new Set(), zombieBildBereit = new Set();
function zombieBilder(a) {
  return Promise.all(Object.values(a.zombieBilder || {}).concat(Object.values(a.zombieAngriffe || {})).map(function (url) {
    if (!zombieBildCache.has(url)) zombieBildCache.set(url, new Promise(function (ok) { var b = new Image(); b.onload = function () { zombieBildFehler.delete(url); zombieBildBereit.add(url); ok(true); }; b.onerror = function () { zombieBildFehler.add(url); zombieBildCache.delete(url); ok(false); }; b.src = url; })); return zombieBildCache.get(url);
  }));
}
window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
window.MINISPIEL_SZENEN.zombie = function (a) {
  if (zombieAbbrechen) zombieAbbrechen();
  var aktuell = a.aktuell || { zombies: [], patientNull: null }, stationen = (a.verlauf || []).filter(function (s) { return !!s.stand; });
  if (!stationen.length) stationen = [{ art: 'start', zeitpunkt: null, stand: aktuell }];
  var signaturen = zombieSignaturen(stationen), gesehen = zombieStaende[a.id], ab = zombieFortsetzung(gesehen && gesehen.signaturen, signaturen);
  var geaendert = zombieVerlaufGeaendert(gesehen && gesehen.signaturen, signaturen);
  var spieler = new Map(a.spieler.map(function (sp) { return [sp.id, sp]; })), figuren = new Map(), lauf = 0, lebenMarke = 0, lebenAktiv = false, versuche = 0, animationen = new Set(), wartende = new Map();
  var serverStart = Date.parse(a.serverZeit), uhrStart = performance.now(), uhrTimer = null, uhrGeneration = 0, fristAngefragt = false, anzeigeStand = aktuell, anzeigeFertig = true, replayZeit = NaN;
  if (!Number.isFinite(serverStart)) serverStart = Date.now();
  var status = el('div', { class: 'ms-status', role: 'status', 'aria-live': 'polite' }), titel = el('strong', { text: 'BOTZEPS · ZOMBIE GYM' });
  var hintergrund = el('div', { class: 'zh-hintergrund', 'aria-hidden': 'true' }), nebel = el('div', { class: 'zh-hordenlicht', 'aria-hidden': 'true' });
  var menschenSchild = el('span', { class: 'zh-zonenname zh-menschen', 'aria-hidden': 'true' }), zombieSchild = el('span', { class: 'zh-zonenname zh-zombies', 'aria-hidden': 'true' });
  var barriere = el('div', { class: 'zh-barriere', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]);
  var feld = el('div', { class: 'zh-feld', role: 'list', 'aria-label': 'Alle Spieler im Gym und vor der Barrikade' }), effekte = el('div', { class: 'zh-effekte', 'aria-hidden': 'true' });
  var arena = el('div', { class: 'zh-arena' }, [hintergrund, nebel, menschenSchild, zombieSchild, feld, barriere, effekte]);
  var counter = el('div', { class: 'zh-zaehler' }), roster = el('div', { class: 'zh-roster' }), details = el('details', { class: 'zh-details' }, [el('summary', { text: 'Spielerstatus im Detail' }), roster]);
  var zeit = el('div', { class: 'ms-zeit' }), skip = el('button', { class: 'knopf leise', text: 'Überspringen' }), replay = el('button', { class: 'knopf leise zg-replay', text: '↻ Nochmal ansehen' });
  var laden = el('button', { class: 'knopf leise', text: '↻ Stand aktualisieren', onclick: function () { aktualisiereBombe(laden); } });
  var root = el('section', { class: 'ms-scene ms-zombie zombie-gym', 'aria-label': 'Die ganze Gruppe im Zombie-Gym', 'data-abgeschlossen': String(!!a.abgeschlossen) }, [status,
    el('div', { class: 'zh-kopf' }, [titel, el('span', { text: 'KEINE RUHE IN FRIEDEN' })]), arena, counter, details, zeit,
    el('div', { class: 'ms-steuerung' }, [skip, replay, laden]), el('p', { class: 'zh-regel', text: 'Training ist dein Gegengift: Es erneuert deinen Schutz. Zwei Tage am Stück ohne Training: Die Horde erwischt dich. Patient Null startet als Zombie; Infizierte bleiben es bis zum Wochenende.' })]);
  function name(id) { return spieler.has(id) ? spieler.get(id).name : 'Unbekannt'; }
  function bewegung() { return !(zombieBewegungsWahl && zombieBewegungsWahl.matches); }
  function gueltig(nr) { return nr === lauf && root.isConnected && !document.hidden && bewegung(); }
  function phase(p) { root.setAttribute('data-zombiephase', p); }
  function warten(ms, nr) { return new Promise(function (ok) { var t = setTimeout(function () { wartende.delete(t); ok(gueltig(nr)); }, ms); wartende.set(t, ok); }); }
  function bewegen(e, frames, opt, nr) {
    if (!e || !gueltig(nr)) return Promise.resolve(false);
    var an = e.animate(frames, Object.assign({ fill: 'forwards' }, opt)); animationen.add(an);
    return an.finished.then(function () { if (!gueltig(nr)) return false; var f = frames[frames.length - 1]; ['transform', 'opacity', 'left', 'top', 'filter'].forEach(function (p) { if (f[p] != null) e.style[p] = f[p]; }); return true; }, function () { return false; }).finally(function () { animationen.delete(an); an.cancel(); });
  }
  function reinigen() {
    stoppeUhr(); lebenMarke++; lebenAktiv = false; animationen.forEach(function (an) { an.cancel(); }); animationen.clear(); wartende.forEach(function (ok, t) { clearTimeout(t); ok(false); }); wartende.clear();
    effekte.replaceChildren(); root.removeAttribute('data-angreifer'); root.removeAttribute('data-ziel'); root.removeAttribute('data-begegnung'); arena.style.filter = '';
  }
  function medien() { hintergrund.replaceChildren(); var url = a.zombieBilder && a.zombieBilder.gym; if (url && !zombieBildFehler.has(url)) { var b = el('img', { src: url, alt: '' }); b.onerror = function () { b.remove(); }; hintergrund.appendChild(b); } }
  function avatar(id, pose) {
    var sp = spieler.get(id), bilder = sp && sp.figur != null && a.figuren && a.figuren[sp.figur], key = bilder && bilder.bereit ? String(sp.figur) : 'gast';
    var angriff = /^angriff([0-3])$/.exec(pose), url = angriff && a.zombieAngriffe && a.zombieAngriffe[key];
    if (angriff && (!url || !zombieBildBereit.has(url) || zombieBildFehler.has(url))) { pose = 'ziehen'; angriff = null; }
    if (!angriff && bilder && bilder.bereit) return minispielAvatar(a, id, pose);
    var e = el('div', { class: 'ms-avatar ' + (angriff ? 'zh-angriff' : 'zh-gast'), 'data-id': id, 'data-pose': pose, 'aria-label': name(id) });
    if (!angriff) url = a.zombieBilder && a.zombieBilder.gast;
    if (url && !zombieBildFehler.has(url) && /^(?:\/api\/figurbild\/[a-z0-9-]+\.png|data:image\/png;base64,[A-Za-z0-9+/=]+)$/.test(url)) {
      var index = angriff ? Number(angriff[1]) : pose === 'ziehen' ? 3 : pose === 'jubel' ? 2 : pose === 'schlag' || pose === 'ko' ? 1 : 0, x = index % 2 * 200, y = Math.floor(index / 2) * 300, svgId = 'zgatlas' + (++zombieSvgNummer);
      e.innerHTML = '<svg viewBox="' + x + ' ' + y + ' 200 300"><defs><clipPath id="' + svgId + '"><rect x="' + x + '" y="' + y + '" width="200" height="300"/></clipPath></defs><image clip-path="url(#' + svgId + ')" href="' + url + '" width="400" height="600"/></svg>';
    } else { e.classList.add('ms-avatar-ersatz'); e.textContent = initialen(name(id)); }
    return e;
  }
  function flasche(klasse) {
    var e = el('span', { class: klasse, 'aria-hidden': 'true' });
    e.innerHTML = '<svg viewBox="0 0 32 40"><path d="M11 3h10v5l-2 2v7l8 13q3 6-4 6H9q-7 0-4-6l8-13v-7l-2-2z" fill="#163d38" stroke="#c5ffde" stroke-width="2"/><path class="zh-serum" d="M11 23h10l5 9q1 2-3 2H9q-4 0-3-2z" fill="#72f2b7"/><path d="M9 3h14v5H9z" fill="#e7c879" stroke="#403d29"/><path d="M16 24v7m-3-3.5h6" stroke="#e8fff2" stroke-width="2" stroke-linecap="round"/></svg>';
    return e;
  }
  function richte(e, blick) {
    if (blick) e.setAttribute('data-blick', blick < 0 ? 'links' : 'rechts');
    var av = e.querySelector('.ms-avatar'), sp = spieler.get(e.getAttribute('data-id')), nativ = zombiePoseBlick(av.classList.contains('zh-gast') ? null : sp && sp.figur, av.getAttribute('data-pose'));
    e.querySelector('.zh-spiegel').style.transform = av.classList.contains('ms-avatar-ersatz') ? 'none' : 'scaleX(' + ((e.getAttribute('data-blick') === 'links' ? -1 : 1) * nativ) + ')';
  }
  function pose(e, p, blick) { e.querySelector('.ms-avatar').replaceWith(avatar(e.getAttribute('data-id'), p)); richte(e, blick); }
  function serverJetzt() { return serverStart + performance.now() - uhrStart; }
  function stoppeUhr() { uhrGeneration++; clearTimeout(uhrTimer); uhrTimer = null; }
  function warnungen() {
    var rueckblick = root.getAttribute('data-rueckblick') === 'true', jetzt = rueckblick ? replayZeit : serverJetzt(), abgelaufen = false;
    a.spieler.forEach(function (sp) {
      var e = figuren.get(sp.id); if (!e) return;
      var g = zombieWarnung(anzeigeStand, sp.id, jetzt, anzeigeFertig && a.abgeschlossen), grund = badge(anzeigeStand, sp.id, anzeigeFertig), text = g ? g.text : grund;
      e.setAttribute('data-gefahr', g ? g.stufe : 'keine'); e.querySelector('.zh-schild small').textContent = text;
      var schutz = anzeigeStand.schutz && anzeigeStand.schutz[sp.id], geschuetzt = !zombieInfizierte(anzeigeStand).has(sp.id) && !(anzeigeFertig && a.abgeschlossen) && schutz && jetzt < Date.parse(schutz.bis);
      e.setAttribute('data-schutz', geschuetzt ? 'aktiv' : 'keiner');
      if (geschuetzt && !g) e.querySelector('.zh-schild small').textContent = 'Mensch · Gegengift';
      var detail = grund + (geschuetzt ? ' · Gegengift durch Training' + (g ? ' wird knapp' : ' aktiv') : '') + (g ? ' · ' + g.text + ' · Training spätestens ' + new Date(g.frist).toLocaleString('de-DE', { timeZone: a.zeitzone || 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : geschuetzt ? ' · Schutz bis ' + new Date(schutz.bis).toLocaleString('de-DE', { timeZone: a.zeitzone || 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
      e.title = sp.name + ' · ' + detail; e.setAttribute('aria-label', sp.name + ': ' + detail);
      var row = Array.from(roster.children).find(function (r) { return r.getAttribute('data-id') === sp.id; }); if (row) row.lastChild.textContent = detail + (sp.figur == null ? ' · noch kein Avatar gewählt' : '');
      if (g && g.rest <= 0) abgelaufen = true;
    });
    return !rueckblick && !a.abgeschlossen && abgelaufen;
  }
  function starteUhr() {
    stoppeUhr(); if (!root.isConnected || document.hidden || a.abgeschlossen || root.getAttribute('data-rueckblick') === 'true') return;
    zombieAbbrechen = abbrechen; var marke = uhrGeneration;
    function tick() {
      if (marke !== uhrGeneration || !root.isConnected || document.hidden) return;
      if (warnungen() && !fristAngefragt && performance.now() - (zombieFristAbrufe.get(a.id) ?? -Infinity) >= 60000) { fristAngefragt = true; zombieFristAbrufe.set(a.id, performance.now()); aktualisiereBombe(laden); }
      var pause = 60000, jetzt = serverJetzt();
      Object.values(aktuell.gefahr || {}).forEach(function (g) { [Date.parse(g.warnAb), Date.parse(g.frist), Date.parse(g.frist) - 6 * 3600000].forEach(function (t) { var rest = t - jetzt; if (rest > 0) pause = Math.min(pause, rest + 20); }); });
      if (marke === uhrGeneration) uhrTimer = setTimeout(tick, pause);
    } tick();
  }
  function plan(s) { return zombiePositionen(s, a.spieler, arena.clientWidth || Math.min(448, Math.max(240, window.innerWidth - 64))); }
  function badge(s, id, fertig) { var ids = zombieInfizierte(s), biss = (s.zombies || []).find(function (z) { return z.id === id; }); return id === s.patientNull ? 'Patient Null' : ids.has(id) ? 'Zombie' + (biss && Number.isFinite(biss.tag) ? ' · Tag ' + (biss.tag + 1) : '') : fertig && a.abgeschlossen ? 'Überlebt' : 'Mensch'; }
  function zaehle(s, fertig) {
    var ids = zombieInfizierte(s), z = a.spieler.filter(function (sp) { return ids.has(sp.id); }).length, m = a.spieler.length - z;
    root.setAttribute('data-menschen', String(m)); root.setAttribute('data-zombies', String(z)); counter.textContent = m + (m === 1 ? ' Mensch · ' : ' Menschen · ') + z + (z === 1 ? ' Zombie' : ' Zombies'); roster.replaceChildren();
    a.spieler.forEach(function (sp) { roster.appendChild(el('div', { class: 'zh-person', 'data-id': sp.id, 'data-status': ids.has(sp.id) ? 'zombie' : 'mensch' }, [el('strong', { text: sp.name + (sp.ich ? ' · Du' : '') }), el('span', { text: badge(s, sp.id, fertig) + (sp.figur == null ? ' · noch kein Avatar gewählt' : '') })])); });
  }
  function zeichne(s, fertig) {
    anzeigeStand = s; anzeigeFertig = fertig;
    var p = plan(s), ids = zombieInfizierte(s); arena.style.height = p.hoehe + 'px'; feld.replaceChildren(); figuren.clear();
    barriere.style.top = p.barriere + 'px'; barriere.hidden = !p.menschen || !p.zombies; nebel.style.top = (p.menschen ? p.barriere : 70) + 'px';
    menschenSchild.textContent = p.menschen ? 'IM GYM · ' + p.menschen : a.spieler.length ? 'DAS GYM IST ÜBERNOMMEN' : 'DAS GYM WARTET';
    zombieSchild.textContent = p.zombies ? 'DIE HORDE · ' + p.zombies : ''; zombieSchild.style.top = (p.menschen ? p.barriere + 28 : 60) + 'px';
    a.spieler.forEach(function (sp) {
      var punkt = p.plan.get(sp.id), zombie = ids.has(sp.id), e = el('div', { class: 'zh-akteur' + (zombie ? ' is-zombie' : ''), role: 'listitem', 'data-id': sp.id, 'data-ich': String(!!sp.ich), 'data-status': zombie ? 'zombie' : 'mensch', 'aria-label': sp.name + ': ' + badge(s, sp.id, fertig), title: sp.name + ' · ' + badge(s, sp.id, fertig) }, [
        el('div', { class: 'zh-koerper', 'aria-hidden': 'true' }, [el('div', { class: 'zh-haltung' }, [el('div', { class: 'zh-spiegel' }, [avatar(sp.id, zombie ? 'ziehen' : fertig && a.abgeschlossen ? 'jubel' : 'bereit')])])]),
        flasche('zh-schutz'),
        el('div', { class: 'zh-schild' }, [el('span', { class: 'zh-name', text: sp.name + (sp.ich ? ' · Du' : '') }), el('small', { text: badge(s, sp.id, fertig) })])
      ]); e.style.left = punkt.x + 'px'; e.style.top = punkt.y + 'px'; e.style.width = punkt.w + 'px'; feld.appendChild(e); figuren.set(sp.id, e); richte(e, punkt.x > (arena.clientWidth || 326) / 2 ? -1 : 1);
    }); zaehle(s, fertig); warnungen();
  }
  function beschreibe(s) { var ids = zombieInfizierte(s), m = a.spieler.filter(function (sp) { return !ids.has(sp.id); }).length; return !a.spieler.length ? 'Noch keine Spieler im Gym.' : a.abgeschlossen ? m ? m + (m === 1 ? ' hat die Zombie-Woche überlebt.' : ' haben die Zombie-Woche überlebt.') : 'Die ganze Gruppe ist infiziert.' : m ? m + (m === 1 ? ' hält im Gym durch · die Horde lauert an der Barrikade' : ' halten im Gym durch · die Horde lauert an der Barrikade') : 'Das ganze Gym schlurft · alle sind infiziert'; }
  function endstand(merken, beleben) {
    phase('ende'); root.setAttribute('data-rueckblick', 'false'); zeichne(aktuell, true); medien(); status.textContent = beschreibe(aktuell); zeit.textContent = a.abgeschlossen ? 'Wochenabschluss' : 'Aktueller Stand'; skip.hidden = true; replay.hidden = !a.spieler.length; replay.disabled = !bewegung();
    if (merken && root.isConnected) zombieStaende[a.id] = { signaturen: signaturen, abgeschlossen: !!a.abgeschlossen };
    if (zombieAbbrechen === abbrechen) zombieAbbrechen = null;
    if (beleben) { starteUhr(); starteLeben(); }
  }
  function abbrechen() { lauf++; reinigen(); endstand(true, false); if (zombieAbbrechen === abbrechen) zombieAbbrechen = null; }
  function station(i) { var s = stationen[i], d = s.zeitpunkt && new Date(s.zeitpunkt); replayZeit = d ? d.getTime() : NaN; zeit.textContent = (i + 1) + ' / ' + stationen.length + (d && Number.isFinite(d.getTime()) ? ' · ' + d.toLocaleString('de-DE', { timeZone: a.zeitzone || 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + (s.art === 'korrektur' ? ' · Korrektur' : ''); }
  function sporen(nr, x, y) { for (var i = 0; i < 8; i++) { var e = el('i', { class: 'zh-spore' }); e.style.left = x + 'px'; e.style.top = y + 'px'; effekte.appendChild(e); bewegen(e, [{ opacity: 0, transform: 'translate(0,0) scale(.3)' }, { opacity: .8, offset: .3 }, { opacity: 0, transform: 'translate(' + ((i % 2 ? 1 : -1) * (15 + i * 5)) + 'px,-70px) scale(1.3)' }], { duration: 850 }, nr).then(function (e) { e.remove(); }.bind(null, e)); } }
  async function versuch(nr, auswahl, stand, bestaetigt) {
    var angreifer = figuren.get(auswahl.angreifer), ziel = figuren.get(auswahl.ziel); if (!angreifer || !ziel) return true;
    var p = plan(stand || aktuell), w = arena.clientWidth, v = p.plan.get(auswahl.angreifer), h = p.plan.get(auswahl.ziel), zielY = p.barriere - 15, angriffY = p.barriere - 13;
    var schritt = (w - 20) / p.cols, zielX = w / 2 + (p.cols - 2 - (p.cols - 1) / 2) * schritt, angriffX = zielX + schritt;
    var platzId = Array.from(p.plan.keys()).find(function (id) { var punkt = p.plan.get(id); return id !== auswahl.ziel && !punkt.zombie && Math.abs(punkt.x - zielX) < 1 && Math.abs(punkt.y - zielY) < 2; }), platz = figuren.get(platzId);
    phase(bestaetigt ? 'bedrohung' : 'versuch'); root.setAttribute('data-begegnung', bestaetigt ? 'infektion' : 'abwehr'); root.setAttribute('data-angreifer', auswahl.angreifer); root.setAttribute('data-ziel', auswahl.ziel); angreifer.style.zIndex = '8'; ziel.style.zIndex = '8';
    richte(angreifer, zielX - angriffX); richte(ziel, angriffX - zielX);
    var antritt = [
      bewegen(angreifer, [{ left: v.x + 'px', top: v.y + 'px' }, { left: angriffX + 'px', top: angriffY + 'px' }], { duration: 650, easing: 'ease-in-out' }, nr),
      bewegen(ziel, [{ left: h.x + 'px', top: h.y + 'px' }, { left: zielX + 'px', top: zielY + 'px' }], { duration: 650, easing: 'ease-in-out' }, nr)
    ];
    if (platz) { platz.style.zIndex = '7'; antritt.push(bewegen(platz, [{ left: platz.style.left, top: platz.style.top }, { left: h.x + 'px', top: h.y + 'px' }], { duration: 650, easing: 'ease-in-out' }, nr)); }
    if (!(await Promise.all(antritt)).every(Boolean)) return false;
    var richtung = Math.sign(zielX - angriffX) || -1, reichweite = Math.max(22, schritt - v.w * (bestaetigt ? .25 : .75)), zKoerper = angreifer.querySelector('.zh-koerper'), mKoerper = ziel.querySelector('.zh-koerper');
    function angriffPhase(index, dauer, von, nach) { phase(['ausholen', 'vorstoss', bestaetigt ? 'biss' : 'schnappen', bestaetigt ? 'getroffen' : 'abwehr'][index]); pose(angreifer, 'angriff' + index, richtung); return bewegen(zKoerper, [{ transform: von }, { transform: nach }], { duration: dauer, easing: index === 1 ? 'cubic-bezier(.2,.8,.3,1)' : 'ease-out' }, nr); }
    if (!await angriffPhase(0, 250, 'translateX(0)', 'translateX(' + (-richtung * 5) + 'px) rotate(' + (-richtung * 7) + 'deg)')) return false;
    pose(ziel, bestaetigt ? 'bereit' : spieler.get(auswahl.ziel).figur == null ? 'schlag' : 'ziehen', -richtung);
    if (!await angriffPhase(1, 160, zKoerper.style.transform, 'translateX(' + (richtung * reichweite) + 'px) rotate(' + (richtung * 6) + 'deg)')) return false;
    var kontakt = 'translateX(' + (richtung * reichweite) + 'px) rotate(' + (richtung * 6) + 'deg)';
    if (!await angriffPhase(2, 90, kontakt, kontakt)) return false;
    var ruf = el('strong', { class: 'zh-abgewehrt' + (bestaetigt ? ' zh-gebissen' : ''), text: bestaetigt ? 'GEBISSEN!' : 'ABGEWEHRT!' }); ruf.style.top = p.barriere - 40 + 'px'; effekte.appendChild(ruf);
    if (bestaetigt) { pose(ziel, 'ko', -richtung); status.textContent = name(auswahl.ziel) + ' · Gegengift verbraucht · von der Horde gebissen'; }
    if (!(await Promise.all([
      angriffPhase(3, 500, kontakt, 'translateX(' + (-richtung * 8) + 'px) rotate(' + (-richtung * 9) + 'deg)'),
      bewegen(mKoerper, [{ transform: 'translateX(0)' }, { transform: 'translateX(' + (richtung * (bestaetigt ? 16 : 8)) + 'px) rotate(' + (richtung * 7) + 'deg)', offset: .3 }, { transform: 'translateX(0)' }], { duration: 500 }, nr)
    ])).every(Boolean)) return false;
    ruf.remove(); zKoerper.style.transform = ''; mKoerper.style.transform = ''; pose(angreifer, 'ziehen', Math.sign(v.x - angriffX) || richtung); pose(ziel, bestaetigt ? 'ko' : 'bereit', Math.sign(h.x - zielX) || -richtung);
    var rueckweg = [
      bewegen(angreifer, [{ left: angriffX + 'px', top: angriffY + 'px' }, { left: v.x + 'px', top: v.y + 'px' }], { duration: 600, easing: 'ease-in-out' }, nr)
    ];
    if (!bestaetigt) rueckweg.push(bewegen(ziel, [{ left: zielX + 'px', top: zielY + 'px' }, { left: h.x + 'px', top: h.y + 'px' }], { duration: 600, easing: 'ease-in-out' }, nr));
    if (platz && !bestaetigt) { var alt = p.plan.get(platzId); rueckweg.push(bewegen(platz, [{ left: h.x + 'px', top: h.y + 'px' }, { left: alt.x + 'px', top: alt.y + 'px' }], { duration: 600, easing: 'ease-in-out' }, nr)); }
    if (!(await Promise.all(rueckweg)).every(Boolean)) return false;
    if (platz) platz.style.zIndex = '';
    angreifer.style.zIndex = ''; ziel.style.zIndex = ''; root.removeAttribute('data-angreifer'); root.removeAttribute('data-ziel'); root.removeAttribute('data-begegnung'); richte(angreifer, h.x - v.x); richte(ziel, v.x - h.x); phase(bestaetigt ? 'gebissen' : 'ende'); return true;
  }
  async function starteLeben() {
    if (lebenAktiv || a.abgeschlossen || !gueltig(lauf) || !zombieVersuch(aktuell, a.spieler, 0)) return;
    lebenAktiv = true; var marke = ++lebenMarke, nr = lauf; zombieAbbrechen = abbrechen;
    try { while (marke === lebenMarke && gueltig(nr)) { if (!await warten(4800, nr) || marke !== lebenMarke) return; var v = zombieVersuch(aktuell, a.spieler, versuche++); if (!v || !await versuch(nr, v)) return; } }
    finally { if (marke === lebenMarke) { lebenAktiv = false; if (zombieAbbrechen === abbrechen && !uhrTimer) zombieAbbrechen = null; } }
  }
  async function auftritt(s, nr) {
    phase('auftritt'); zeichne(s, false); var schild = el('div', { class: 'zh-banner' }, [el('small', { text: 'DER AUSBRUCH BEGINNT' }), el('strong', { text: 'Haltet die Horde draußen!' })]); effekte.appendChild(schild);
    var e = figuren.get(s.patientNull); if (e) { sporen(nr, parseFloat(e.style.left), parseFloat(e.style.top) - 25); bewegen(e.querySelector('.zh-koerper'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650 }, nr); }
    if (!await warten(950, nr)) return false; if (!await bewegen(schild, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }, nr)) return false; schild.remove(); return true;
  }
  async function biss(id, s, sichtbar, nr, vorherigerStand) {
    var vorher = Object.assign({}, s, { zombies: (s.zombies || []).filter(function (z) { return sichtbar.has(z.id); }), gefahr: Object.assign({}, vorherigerStand.gefahr, s.gefahr), schutz: Object.assign({}, vorherigerStand.schutz, s.schutz) }); zeichne(vorher, false);
    var e = figuren.get(id), angreifer = zombieBissAngreifer(vorher, a.spieler, id);
    if (!e || !angreifer) { sichtbar.add(id); zeichne(Object.assign({}, s, { zombies: (s.zombies || []).filter(function (z) { return sichtbar.has(z.id); }) }), false); return true; }
    status.textContent = name(id) + ' · Schutz verbraucht · die Horde kommt durch';
    e.setAttribute('data-gefahr', 'kritisch'); e.querySelector('.zh-schild small').textContent = 'Gegengift verbraucht';
    if (!await versuch(nr, { angreifer: angreifer, ziel: id }, vorher, true)) return false;
    e.style.zIndex = '9'; var x = parseFloat(e.style.left), y = parseFloat(e.style.top);
    phase('verwandlung'); pose(e, 'ko'); sporen(nr, x, y - 25);
    if (!await bewegen(e.querySelector('.zh-koerper'), [{ filter: 'sepia(0) saturate(1)' }, { filter: 'sepia(.8) saturate(1.5) hue-rotate(35deg)', transform: 'translateY(5px) rotate(-7deg)', offset: .55 }, { filter: 'sepia(.8) saturate(1.5) hue-rotate(35deg)', transform: 'translateY(0) rotate(0deg)' }], { duration: 850 }, nr)) return false;
    sichtbar.add(id); var zwischen = Object.assign({}, s, { zombies: (s.zombies || []).filter(function (z) { return sichtbar.has(z.id); }) }), p = plan(zwischen);
    phase('horde'); status.textContent = name(id) + ' ist jetzt Zombie und schließt sich der Horde an'; pose(e, 'ziehen'); e.classList.add('is-zombie'); e.setAttribute('data-status', 'zombie');
    var schild = e.querySelector('.zh-schild'); schild.lastChild.textContent = badge(zwischen, id, false); e.setAttribute('aria-label', name(id) + ': ' + badge(zwischen, id, false));
    arena.style.height = p.hoehe + 'px'; barriere.style.top = p.barriere + 'px'; barriere.hidden = !p.menschen || !p.zombies; menschenSchild.textContent = p.menschen ? 'IM GYM · ' + p.menschen : 'DAS GYM IST ÜBERNOMMEN'; zombieSchild.textContent = 'DIE HORDE · ' + p.zombies; nebel.style.top = (p.menschen ? p.barriere : 70) + 'px'; zombieSchild.style.top = (p.menschen ? p.barriere + 28 : 60) + 'px'; zaehle(zwischen, false);
    var bewegungen = []; figuren.forEach(function (e, id) { var neu = p.plan.get(id); bewegungen.push(bewegen(e, [{ left: e.style.left, top: e.style.top }, { left: neu.x + 'px', top: neu.y + 'px' }], { duration: 850, easing: 'ease-in-out' }, nr)); });
    if (!(await Promise.all(bewegungen)).every(Boolean)) return false; zeichne(zwischen, false); return true;
  }
  async function gegengift(ids, s, nr) {
    zeichne(s, false); phase('gegengift'); status.textContent = ids.map(name).join(', ') + ' · Training wirkt als Gegengift · Schutz erneuert';
    var aktionen = [], dosis = [];
    ids.forEach(function (id) {
      var e = figuren.get(id); if (!e) return;
      var f = flasche('zh-dosis'), welle = el('span', { class: 'zh-serumwelle', 'aria-hidden': 'true' }); e.append(welle, f); dosis.push(welle, f);
      aktionen.push(bewegen(f, [{ opacity: 0, transform: 'translateY(24px) rotate(-25deg) scale(.6)' }, { opacity: 1, transform: 'translateY(-5px) rotate(15deg) scale(1)', offset: .4 }, { opacity: 0, transform: 'translateY(-16px) rotate(15deg) scale(.5)' }], { duration: 1050 }, nr));
      aktionen.push(bewegen(welle, [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)', offset: .4 }, { opacity: 0, transform: 'scale(1.25)' }], { duration: 1050 }, nr));
      aktionen.push(bewegen(e.querySelector('.zh-koerper'), [{ filter: 'saturate(.4)' }, { filter: 'saturate(1.4) brightness(1.15)', transform: 'translateY(-5px)', offset: .45 }, { filter: 'none', transform: 'translateY(0)' }], { duration: 1050 }, nr));
    });
    var ok = (await Promise.all(aktionen)).every(Boolean); dosis.forEach(function (e) { e.remove(); }); return ok;
  }
  async function finale(nr) {
    phase('finale'); zeichne(aktuell, true); status.textContent = beschreibe(aktuell); zeit.textContent = 'Wochenabschluss'; var m = a.spieler.filter(function (sp) { return !zombieInfizierte(aktuell).has(sp.id); });
    var schild = el('div', { class: 'zh-banner' }, [el('small', { text: 'WOCHENABSCHLUSS' }), el('strong', { text: m.length ? m.length + (m.length === 1 ? ' hat überlebt!' : ' haben überlebt!') : 'Das ganze Gym schlurft.' })]); effekte.appendChild(schild);
    if (!await bewegen(schild, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 300 }, nr)) return false;
    var b = []; m.forEach(function (sp) { var e = figuren.get(sp.id); if (e) b.push(bewegen(e.querySelector('.zh-koerper'), [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }], { duration: 650 }, nr)); });
    if (b.length && !(await Promise.all(b)).every(Boolean)) return false; return warten(900, nr);
  }
  async function spiele(start, intro) {
    lauf++; reinigen(); var nr = lauf; if (!root.isConnected) return;
    if (!bewegung() || document.hidden || !a.spieler.length) { endstand(true, false); return; }
    zombieAbbrechen = abbrechen; root.setAttribute('data-rueckblick', 'true'); skip.hidden = false; replay.hidden = true; station(start); zeichne(stationen[start].stand, false);
    try { phase('laden'); await Promise.race([zombieBilder(a), warten(1600, nr)]); if (!gueltig(nr)) return; medien(); if (intro && !await auftritt(stationen[start].stand, nr)) return;
      for (var i = start + 1; i < stationen.length; i++) { var s = stationen[i], v = stationen[i - 1].stand, w = zombieWechsel(v, s); station(i);
        if (w.korrektur) { phase('korrektur'); zeichne(s.stand, false); status.textContent = 'Der Wochenverlauf wurde korrigiert · neuer Stand'; if (!await warten(500, nr)) return; }
        else { var sichtbar = zombieInfizierte(v); for (var j = 0; j < w.bisse.length; j++) if (spieler.has(w.bisse[j]) && !await biss(w.bisse[j], s.stand, sichtbar, nr, v)) return; zeichne(s.stand, false); var dosen = zombieGegengift(v, s).filter(function (id) { return spieler.has(id); }); if (dosen.length) { if (!await gegengift(dosen, s.stand, nr)) return; } else if (!w.bisse.length && !await warten(160, nr)) return; }
      } if (a.abgeschlossen && !await finale(nr)) return;
    } finally { if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true, true); } }
  }
  async function korrigiere() {
    lauf++; reinigen(); var nr = lauf; zombieAbbrechen = abbrechen; phase('korrektur'); replayZeit = serverJetzt(); root.setAttribute('data-rueckblick', 'true'); skip.hidden = false; replay.hidden = true; zeichne(aktuell, true); status.textContent = 'Der Wochenverlauf wurde korrigiert · neuer Stand'; await warten(500, nr);
    if (nr === lauf) { reinigen(); if (root.isConnected) endstand(true, true); }
  }
  skip.onclick = function () { abbrechen(); starteUhr(); starteLeben(); }; replay.onclick = function () { spiele(0, true); }; medien();
  var rueckblick = bewegung() && !document.hidden && a.spieler.length && ab !== null && !geaendert;
  if (rueckblick) { root.setAttribute('data-rueckblick', 'true'); station(ab); phase('bereit'); zeichne(stationen[ab].stand, false); status.textContent = 'Die Gruppe sammelt sich im Gym'; replay.hidden = true; }
  else endstand(false, false);
  zombieDarstellung = function () { if (root.isConnected) { lauf++; reinigen(); endstand(false, true); } };
  zombieBilder(a).then(function () { if (root.isConnected) { medien(); if (root.getAttribute('data-zombiephase') === 'ende') zeichne(aktuell, true); } });
  var anfang = lauf; requestAnimationFrame(function () {
    if (!root.isConnected || lauf !== anfang) return;
    if (!bewegung() || document.hidden) { endstand(true, true); return; }
    if (ab === null) { if (a.abgeschlossen && gesehen && !gesehen.abgeschlossen) spiele(stationen.length - 1, false); else endstand(true, true); }
    else if (geaendert) korrigiere(); else spiele(ab, !gesehen);
  }); return root;
};
