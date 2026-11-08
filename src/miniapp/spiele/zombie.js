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

  function infizierte(stand) {
    var ids = new Set((stand.zombies || []).map(function (z) { return z.id; }));
    if (stand.patientNull != null) ids.add(stand.patientNull);
    return ids;
  }

  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.zombie = function (a) {
    var tage = el('span', { class: 'zg-day' });
    var titel = el('strong', { text: 'Die letzte Trainingsrunde' });
    var geschichte = el('p', { class: 'zg-story' });
    var roster = el('div', { class: 'zg-roster', role: 'list', 'aria-label': 'Spieler im verlassenen Fitnessstudio' });
    var menschZahl = el('span');
    var zombieZahl = el('span');
    var hintergrund = el('div', { 'aria-hidden': 'true' });
    hintergrund.innerHTML = kulisse;
    var raum = el('div', { class: 'zg-room' }, [el('div', { class: 'zg-floor', 'aria-hidden': 'true' }), hintergrund, roster]);
    var szene = el('section', { class: 'zombie-gym', 'aria-label': 'Zombie-Woche im verlassenen Gym' }, [
      el('div', { class: 'zg-top' }, [el('div', { class: 'zg-kicker', text: 'Quarantäne · Zombie-Woche' }), el('div', { class: 'zg-heading' }, [titel, tage]), geschichte]),
      raum,
      el('div', { class: 'zg-bottom' }, [
        el('span', { class: 'zg-counter' }, [el('i', { class: 'zg-dot', 'aria-hidden': 'true' }), menschZahl]),
        el('span', { class: 'zg-counter zg-infected' }, [el('i', { class: 'zg-dot', 'aria-hidden': 'true' }), zombieZahl])
      ]),
      el('p', { class: 'zg-rule', text: 'Zwei Tage am Stück ohne Training: gebissen. Patient Null ist von Anfang an Zombie. Ein Biss bleibt bis zum Ende der Woche.' })
    ]);

    function beschreibe(stand, meta) {
      var zombies = infizierte(stand);
      var menschen = a.spieler.filter(function (sp) { return !zombies.has(sp.id); });
      var vorher = meta.vorher ? infizierte(meta.vorher) : new Set();
      var neue = a.spieler.filter(function (sp) { return zombies.has(sp.id) && !vorher.has(sp.id) && sp.id !== stand.patientNull; });
      if (meta.vorher && neue.length) return neue.map(function (sp) { return sp.name; }).join(', ') + (neue.length === 1 ? ' wurde gebissen. ' : ' wurden gebissen. ') + 'Zwei Tage ohne Training. Der Biss bleibt.';
      if (!menschen.length) return 'Alle sind Zombies. Im Gym schlurft jetzt die ganze Mannschaft.';
      if (a.abgeschlossen && meta.index === meta.anzahl - 1) return 'Wochenende: ' + menschen.length + (menschen.length === 1 ? ' Mensch hat überlebt.' : ' Menschen haben überlebt.');
      if (meta.station.art === 'start') {
        var patient = a.spieler.find(function (sp) { return sp.id === stand.patientNull; });
        return (patient ? patient.name : 'Patient Null') + ' ist Patient Null. Die anderen halten sich mit Training auf den Beinen.';
      }
      return menschen.length + (menschen.length === 1 ? ' Mensch hält' : ' Menschen halten') + ' noch durch. Training hält dich bereit; wer gebissen wurde, bleibt Zombie.';
    }

    return minispielAnimationSzene(a, {
      klasse: 'ms-zombie',
      inhalt: szene,
      dauer: 1250,
      beschreibe: function (stand, meta) {
        var ids = infizierte(stand);
        var krank = a.spieler.filter(function (sp) { return ids.has(sp.id); }).length;
        return (meta.index === meta.anzahl - 1 ? 'Der Ausbruch · letzter Stand' : 'Der Ausbruch · Rückblick') + ' · ' + krank + (krank === 1 ? ' Zombie' : ' Zombies');
      },
      zeichne: function (stand, meta) {
        var zombies = infizierte(stand);
        var vorher = meta.vorher ? infizierte(meta.vorher) : zombies;
        var menschen = a.spieler.filter(function (sp) { return !zombies.has(sp.id); }).length;
        var krank = a.spieler.length - menschen;
        var datum = new Date(meta.station.zeitpunkt);
        tage.textContent = !meta.station.zeitpunkt || Number.isNaN(datum.getTime()) ? 'Wochenverlauf' : datum.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: a.zeitzone || 'Europe/Berlin' });
        titel.textContent = !menschen ? 'Nur noch Schlurfen' : a.abgeschlossen && meta.index === meta.anzahl - 1 ? 'Die Überlebenden stehen fest' : 'Die letzte Trainingsrunde';
        geschichte.textContent = beschreibe(stand, meta);
        menschZahl.textContent = menschen + (menschen === 1 ? ' Mensch' : ' Menschen');
        zombieZahl.textContent = krank + (krank === 1 ? ' Zombie' : ' Zombies');
        roster.replaceChildren();
        a.spieler.forEach(function (sp, i) {
          var istZombie = zombies.has(sp.id);
          var neu = meta.bewegt && meta.vorher && istZombie && !vorher.has(sp.id);
          var biss = (stand.zombies || []).find(function (z) { return z.id === sp.id; });
          var status = sp.id === stand.patientNull ? 'Patient Null' : istZombie ? 'Zombie' + (biss ? ' · Tag ' + (biss.tag + 1) : '') : 'Noch Mensch';
          var avatar = minispielAvatar(a, sp.id, 'bereit');
          avatar.classList.add('zg-avatar');
          var figur = el('div', { class: 'zg-person ' + (istZombie ? 'is-zombie' : 'is-human') + (neu ? ' is-new' : ''), role: 'listitem', 'data-id': sp.id, 'data-me': String(!!sp.ich), 'data-status': istZombie ? 'zombie' : 'mensch', style: '--zg-delay:-' + (i % 11 * .31).toFixed(2) + 's' }, [
            el('div', { class: 'zg-body' }, [avatar, el('div', { class: 'zg-fog', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')])]),
            el('span', { class: 'zg-name', text: sp.name + (sp.ich ? ' (du)' : '') }),
            el('span', { class: 'zg-badge', text: status })
          ]);
          roster.appendChild(figur);
        });
        if (!a.spieler.length) roster.appendChild(el('p', { class: 'zg-empty', text: 'Das Gym ist leer. Noch keine Spieler in dieser Woche.' }));
      }
    });
  };
}());
