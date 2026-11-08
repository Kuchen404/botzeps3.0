(function () {
  'use strict';

  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.kopfgeld = function (a) {
    function neu(tag, klasse, text) {
      var node = document.createElement(tag);
      if (klasse) node.className = klasse;
      if (text != null) node.textContent = text;
      return node;
    }
    function last(stand, id) {
      var wert = stand && stand.lasten && stand.lasten[id];
      return typeof wert === 'number' && Number.isFinite(wert) ? Math.max(0, wert) : 0;
    }
    function zahl(wert) {
      return wert.toLocaleString('de-DE', { maximumFractionDigits: 2 });
    }
    function name(id) {
      var spieler = a.spieler.find(function (p) { return p.id === id; });
      return spieler ? spieler.name : 'Unbekannt';
    }
    function namen(ids) {
      var kurz = ids.slice(0, 3).map(name).join(', ');
      return kurz + (ids.length > 3 ? ' und ' + (ids.length - 3) + ' weitere' : '');
    }
    var zielId = a.aktuell.gejagter;
    var root = neu('div', 'kg-szene');
    var western = neu('div', 'kg-western');
    var landschaft = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    landschaft.setAttribute('class', 'kg-dekor');
    landschaft.setAttribute('viewBox', '0 0 400 260');
    landschaft.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    landschaft.setAttribute('aria-hidden', 'true');
    // Ausschließlich feste Landschaft: Figuren und Spielstände kommen aus der API.
    landschaft.innerHTML = '<circle cx="322" cy="54" r="29" fill="#ffe9b3" stroke="#d98e4d" stroke-width="2"/>' +
      '<path d="M0 183 35 145 56 145 72 168 98 168 116 137 140 137 162 185 190 185 225 155 253 155 278 184 302 184 332 126 353 126 368 163 400 163V260H0Z" fill="#c47740" opacity=".6"/>' +
      '<path d="M0 216Q90 183 201 212T400 208V260H0Z" fill="#e0ab65" stroke="#9e653c" stroke-width="2"/>' +
      '<g fill="none" stroke="#606444" stroke-width="9" stroke-linecap="round"><path d="M374 221v-49m0 25h-13v-16m13 7h13v-17"/><path d="M27 216v-35m0 18H15v-12"/></g>' +
      '<path d="M173 238h25m97-13h16m-80 24h35M5 231h17" stroke="#a56f3b" stroke-width="3" stroke-linecap="round"/>';
    western.appendChild(landschaft);

    var poster = neu('div', 'kg-poster');
    poster.appendChild(neu('div', 'kg-wanted', 'WANTED'));
    var portrait = neu('div', 'kg-poster-figur');
    portrait.appendChild(minispielAvatar(a, zielId, 'bereit'));
    poster.appendChild(portrait);
    poster.appendChild(neu('strong', 'kg-poster-name', name(zielId)));
    var posterLast = neu('span', 'kg-poster-last');
    poster.appendChild(posterLast);
    poster.appendChild(neu('div', 'kg-steckbrief-klein', 'GESUCHT BIS SONNTAG'));
    western.appendChild(poster);

    var held = neu('div', 'kg-held');
    var schild = neu('div', 'kg-schild', 'Auf der Flucht');
    var heldBild = neu('div', 'kg-held-bild');
    var heldAvatar = minispielAvatar(a, zielId, 'bereit');
    heldBild.appendChild(heldAvatar);
    held.appendChild(schild);
    held.appendChild(heldBild);
    held.appendChild(neu('div', 'kg-name', name(zielId)));
    western.appendChild(held);
    root.appendChild(western);

    var lage = neu('div', 'kg-lage');
    var icon = neu('span', 'kg-lage-icon', '★');
    icon.setAttribute('aria-hidden', 'true');
    var lageText = neu('div', 'kg-lage-text');
    lage.appendChild(icon);
    lage.appendChild(lageText);
    root.appendChild(lage);

    var spuren = neu('div', 'kg-spuren');
    var legende = neu('div', 'kg-legende');
    legende.appendChild(neu('strong', '', 'Die Verfolger'));
    legende.appendChild(neu('span', '', 'Marke = Last des Gejagten'));
    spuren.appendChild(legende);
    var liste = neu('div', 'kg-liste');
    liste.setAttribute('role', 'list');
    liste.setAttribute('aria-label', 'Wochenlast der Kopfgeldjäger');
    liste.setAttribute('tabindex', '0');
    var jaeger = a.spieler.filter(function (p) { return p.id !== zielId; });
    var zeilen = jaeger.map(function (p) {
      var zeile = neu('div', 'kg-spur' + (p.ich ? ' kg-ich' : ''));
      zeile.setAttribute('role', 'listitem');
      zeile.setAttribute('data-id', p.id);
      var kopf = neu('div', 'kg-spurkopf');
      kopf.appendChild(neu('span', 'kg-spurname', p.name + (p.ich ? ' · du' : '')));
      var punkte = neu('span', 'kg-spurlast');
      kopf.appendChild(punkte);
      var status = neu('div', 'kg-spurstatus');
      var bahn = neu('div', 'kg-bahn');
      bahn.setAttribute('aria-hidden', 'true');
      bahn.appendChild(neu('div', 'kg-ziel'));
      var laeufer = neu('div', 'kg-laeufer');
      var avatar = minispielAvatar(a, p.id, 'bereit');
      laeufer.appendChild(avatar);
      bahn.appendChild(laeufer);
      bahn.appendChild(neu('div', 'kg-lasso'));
      zeile.appendChild(kopf);
      zeile.appendChild(status);
      zeile.appendChild(bahn);
      liste.appendChild(zeile);
      return { id: p.id, node: zeile, punkte: punkte, status: status, laeufer: laeufer, avatar: avatar };
    });
    if (!zeilen.length) liste.appendChild(neu('p', 'kg-leer', 'Noch keine Verfolger dabei.'));
    spuren.appendChild(liste);
    root.appendChild(spuren);
    root.appendChild(neu('p', 'kg-hinweis', 'Nur mehr Wochenlast fängt den Gejagten. Bei Gleichstand ist er frei. Der Stand kann sich bis Sonntag ändern.'));

    // Eine Skala für den gesamten Verlauf: Die Figur rückt nur mit echter Last vor.
    var skala = 1;
    [a.aktuell].concat((a.verlauf || []).map(function (s) { return s.stand; })).forEach(function (stand) {
      Object.keys(stand.lasten || {}).forEach(function (id) { skala = Math.max(skala, last(stand, id)); });
      skala = Math.max(skala, stand.gejagterLast || 0);
    });
    function gefangen(stand) {
      return (stand.jaeger || []).filter(function (id) { return id !== zielId && last(stand, id) > stand.gejagterLast; });
    }
    function beschreibe(stand, meta) {
      var jetzt = gefangen(stand);
      var vorher = meta && meta.vorher ? gefangen(meta.vorher) : [];
      var neuGefangen = jetzt.filter(function (id) { return vorher.indexOf(id) < 0; });
      var entwischt = vorher.filter(function (id) { return jetzt.indexOf(id) < 0; });
      if (meta && meta.bewegt && entwischt.length) return name(zielId) + ' entwischt ' + namen(entwischt) + ' wieder!';
      if (meta && meta.bewegt && neuGefangen.length) return namen(neuGefangen) + ' ' + (neuGefangen.length === 1 ? 'wirft' : 'werfen') + ' das Lasso: ' + name(zielId) + ' geschnappt!';
      if (jetzt.length) return namen(jetzt) + ' ' + (jetzt.length === 1 ? 'liegt' : 'liegen') + ' vor ' + name(zielId) + ' · Kopfgeld in Reichweite.';
      return name(zielId) + ' ist frei. ' + (jaeger.length ? 'Noch hat niemand mehr Wochenlast.' : 'Die Jagd wartet auf Verfolger.');
    }
    return minispielAnimationSzene(a, {
      klasse: 'ms-kopfgeld',
      inhalt: root,
      dauer: 1350,
      beschreibe: beschreibe,
      zeichne: function (stand, meta) {
        var jetzt = gefangen(stand);
        var vorher = meta.vorher ? gefangen(meta.vorher) : [];
        var fang = jetzt.some(function (id) { return vorher.indexOf(id) < 0; });
        var flucht = vorher.some(function (id) { return jetzt.indexOf(id) < 0; });
        root.dataset.aktion = meta.bewegt ? (flucht ? 'flucht' : fang ? 'fang' : '') : '';
        root.dataset.abspielen = String(meta.bewegt);
        root.dataset.sofort = String(!meta.bewegt);
        root.style.setProperty('--kg-ziel', Math.min(100, 100 * Math.max(0, stand.gejagterLast) / skala) + '%');
        posterLast.textContent = zahl(stand.gejagterLast) + ' Lastpunkte';
        schild.textContent = jetzt.length ? 'Lasso sitzt!' : 'Auf der Flucht';
        lageText.textContent = beschreibe(stand, meta);
        icon.textContent = flucht && meta.bewegt ? '➜' : jetzt.length ? '◎' : '★';
        minispielSetzePose(heldAvatar, a, zielId, jetzt.length ? 'ko' : flucht && meta.bewegt ? 'jubel' : 'bereit');
        zeilen.forEach(function (zeile) {
          var wert = last(stand, zeile.id);
          var gefasst = jetzt.indexOf(zeile.id) >= 0;
          zeile.node.dataset.gefangen = String(gefasst);
          zeile.node.dataset.aktion = meta.bewegt ? (gefasst && vorher.indexOf(zeile.id) < 0 ? 'fang' : !gefasst && vorher.indexOf(zeile.id) >= 0 ? 'flucht' : '') : '';
          zeile.node.style.setProperty('--kg-jaeger', Math.min(100, 100 * wert / skala) + '%');
          zeile.punkte.textContent = zahl(wert) + ' Last';
          zeile.status.textContent = gefasst ? 'Geschnappt · ' + zahl(wert - stand.gejagterLast) + ' Last voraus' :
            wert === stand.gejagterLast ? 'Gleichauf · Gleichstand reicht nicht' :
            'Noch ' + zahl(stand.gejagterLast - wert) + ' Last bis Gleichstand';
          zeile.laeufer.style.left = Math.min(100, 100 * wert / skala) + '%';
          minispielSetzePose(zeile.avatar, a, zeile.id, gefasst ? 'ziehen' : 'bereit');
        });
      }
    });
  };
})();
