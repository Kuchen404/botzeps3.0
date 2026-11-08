(function () {
  "use strict";
  var seiten = ["links", "rechts"];
  var z = function (wert) { return (Math.round(wert * 10) / 10).toLocaleString("de-DE", { maximumFractionDigits: 1 }); };
  var zahl = function (wert) { return typeof wert === "number" && Number.isFinite(wert) ? Math.max(0, wert) : 0; };
  function node(tag, klasse, text) {
    var element = document.createElement(tag);
    if (klasse) element.className = klasse;
    if (text != null) element.textContent = text;
    return element;
  }
  function lage(stand) {
    var schnitt = (stand.schnitt || [0, 0]).map(zahl);
    var summe = schnitt[0] + schnitt[1];
    // Dasselbe Verhältnis wie seil(): Jedes Team zählt mit seinem Durchschnitt.
    var zug = summe > 0 ? (schnitt[0] - schnitt[1]) / summe : 0;
    return { schnitt: schnitt, zug: zug, seite: zug === 0 ? null : zug > 0 ? 0 : 1 };
  }
  // Schon knappe Vorsprünge sollen sichtbar ziehen: Wurzel statt linear, bis 1 begrenzt.
  function ausschlag(zug) {
    return zug === 0 ? 0 : (zug > 0 ? 1 : -1) * Math.min(1, Math.sqrt(Math.abs(zug)));
  }
  function beschreibung(stand) {
    var l = lage(stand);
    if (!l.schnitt[0] && !l.schnitt[1]) return "Noch kein Zug am Seil. Beide Teams stehen bereit.";
    if (l.seite == null) return "Gleichstand! Der Knoten steht genau in der Mitte.";
    var teams = stand.teams || [];
    var name = (teams[l.seite] || {}).name || (l.seite === 0 ? "Team links" : "Team rechts");
    return name + " zieht! Bis zum Finale ist noch alles offen.";
  }
  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.tauziehen = function (a) {
    var root = node("div", "tauziehen");
    var arena = node("div", "tz-arena");
    arena.setAttribute("aria-hidden", "true");
    ["sun", "cloud", "flag", "mud"].forEach(function (teil) { arena.appendChild(node("div", "tz-" + teil)); });
    arena.appendChild(node("div", "tz-field-label", "DIE SCHLAMMGRUBE"));
    var rope = node("div", "tz-rope");
    rope.appendChild(node("div", "tz-knot"));
    arena.appendChild(rope);
    var crews = seiten.map(function (seite) {
      var crew = node("div", "tz-crew " + seite);
      crew.style.setProperty("--tz-team-color", seite === "links" ? "#236ca0" : "#bf4638");
      arena.appendChild(crew);
      return crew;
    });
    var more = seiten.map(function (seite) {
      var badge = node("div", "tz-more " + seite);
      badge.hidden = true;
      arena.appendChild(badge);
      return badge;
    });
    root.appendChild(arena);
    var score = node("div", "tz-score");
    var labels = [], averages = [];
    seiten.forEach(function (seite, i) {
      if (i) score.appendChild(node("div", "tz-versus", "VS"));
      var team = node("div", "tz-team " + seite);
      labels[i] = node("div", "tz-team-name");
      averages[i] = node("div", "tz-average");
      team.appendChild(labels[i]);
      team.appendChild(averages[i]);
      team.appendChild(node("div", "tz-unit", "Ø Last pro Kopf"));
      score.appendChild(team);
    });
    root.appendChild(score);
    root.appendChild(node("p", "tz-rule", "Jedes Training zieht. Es zählt die Wochenlast pro Kopf – auch bei unterschiedlich großen Teams."));
    var spieler = new Map((a.spieler || []).map(function (s) { return [s.id, s]; }));
    // Wer in welchem Team mit wie viel Last zieht, steht in der Liste unter der Szene.
    function teamZeichnen(team, index) {
      var ids = team.mitglieder || [];
      labels[index].textContent = team.name;
      // Die eigene gewählte Figur bleibt auch in großen Gruppen sichtbar.
      var sichtbar = ids.filter(function (id) { return (spieler.get(id) || {}).ich; })
        .concat(ids.filter(function (id) { return !(spieler.get(id) || {}).ich; })).slice(0, 4);
      crews[index].replaceChildren();
      sichtbar.forEach(function (id, platz) {
        var person = node("div", "tz-person");
        person.setAttribute("data-id", id);
        person.setAttribute("data-ich", String(!!(spieler.get(id) || {}).ich));
        var slot = sichtbar.length === 1 ? 57 : 25 + platz * (50 / Math.max(1, sichtbar.length - 1));
        person.style.setProperty("--tz-slot", (index === 0 ? slot : 100 - slot) + "%");
        person.style.zIndex = String(index === 0 ? platz + 1 : sichtbar.length - platz);
        var body = node("div", "tz-body");
        var avatar = minispielAvatar(a, id, "ziehen");
        avatar.classList.add("tz-avatar");
        body.appendChild(avatar);
        person.appendChild(body);
        crews[index].appendChild(person);
      });
      more[index].hidden = ids.length <= sichtbar.length;
      more[index].textContent = "+" + (ids.length - sichtbar.length) + " am Seil";
    }
    return minispielAnimationSzene(a, {
      klasse: "ms-tauziehen",
      inhalt: root,
      dauer: 1100,
      beschreibe: function (stand) { return beschreibung(stand); },
      zeichne: function (stand, meta) {
        var l = lage(stand);
        var teams = stand.teams || [];
        root.classList.remove("tz-tug");
        root.setAttribute("data-bewegt", String(!!meta.bewegt));
        root.setAttribute("data-zug", String(l.zug));
        var x = ausschlag(l.zug);
        rope.style.setProperty("--tz-shift", (-x * 16).toFixed(1) + "%");
        crews.forEach(function (crew, i) {
          crew.style.setProperty(i === 0 ? "--tz-left" : "--tz-right", (-x * 10).toFixed(1) + "%");
          teamZeichnen(teams[i] || { name: "Team " + seiten[i], mitglieder: [] }, i);
          averages[i].textContent = z(l.schnitt[i]);
        });
        var vorher = meta.vorher && lage(meta.vorher);
        var training = meta.station && meta.station.art === "training";
        if (meta.bewegt && training && vorher && (l.schnitt[0] > vorher.schnitt[0] || l.schnitt[1] > vorher.schnitt[1])) {
          root.style.setProperty("--tz-tug-angle", l.schnitt[0] - vorher.schnitt[0] >= l.schnitt[1] - vorher.schnitt[1] ? "-7deg" : "7deg");
          void root.offsetWidth;
          root.classList.add("tz-tug");
        }
      }
    });
  };
}());
