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
  function fertig(a, meta) {
    return a.abgeschlossen === true && meta.index === meta.anzahl - 1;
  }
  function beschreibung(a, stand, meta) {
    var l = lage(stand);
    if (!l.schnitt[0] && !l.schnitt[1]) return "Noch kein Zug am Seil. Beide Teams stehen bereit.";
    if (l.seite == null) return "Gleichstand! Der Knoten steht genau in der Mitte.";
    var teams = stand.teams || [];
    var name = (teams[l.seite] || {}).name || (l.seite === 0 ? "Team links" : "Team rechts");
    if (fertig(a, meta)) return name + " gewinnt! Das andere Team landet im Schlamm.";
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
    arena.appendChild(node("div", "tz-splash"));
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
    var details = seiten.map(function () {
      var details = node("details", "tz-members");
      var summary = node("summary");
      var list = node("ul", "tz-roster");
      details.appendChild(summary);
      details.appendChild(list);
      root.appendChild(details);
      return { summary: summary, list: list };
    });
    var spieler = new Map((a.spieler || []).map(function (s) { return [s.id, s]; }));
    function teamZeichnen(team, index, stand, pose) {
      var ids = team.mitglieder || [];
      labels[index].textContent = team.name;
      details[index].summary.textContent = team.name + " · " + ids.length + (ids.length === 1 ? " Person" : " Personen");
      details[index].list.replaceChildren();
      ids.forEach(function (id) {
        var sp = spieler.get(id) || { name: "Unbekannt" };
        var row = node("li");
        row.appendChild(node("span", "", sp.name + (sp.ich ? " (du)" : "")));
        row.appendChild(node("span", "", z(zahl((stand.lasten || {})[id])) + " Last"));
        details[index].list.appendChild(row);
      });
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
        var avatar = minispielAvatar(a, id, pose);
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
      beschreibe: function (stand, meta) { return beschreibung(a, stand, meta); },
      zeichne: function (stand, meta) {
        var l = lage(stand);
        var teams = stand.teams || [];
        root.classList.remove("tz-tug");
        root.setAttribute("data-bewegt", String(!!meta.bewegt));
        root.removeAttribute("data-ergebnis");
        root.setAttribute("data-zug", String(l.zug));
        rope.style.setProperty("--tz-shift", (-l.zug * 14) + "%");
        crews.forEach(function (crew, i) {
          crew.style.setProperty(i === 0 ? "--tz-left" : "--tz-right", (-l.zug * 8) + "%");
          var pose = fertig(a, meta) && l.seite != null ? (i === l.seite ? "jubel" : "ko") : "ziehen";
          teamZeichnen(teams[i] || { name: "Team " + seiten[i], mitglieder: [] }, i, stand, pose);
          averages[i].textContent = z(l.schnitt[i]);
        });
        if (fertig(a, meta) && l.seite != null) root.setAttribute("data-ergebnis", seiten[l.seite]);
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
