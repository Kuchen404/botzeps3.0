(function () {
  "use strict";

  function node(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text != null) e.textContent = text;
    return e;
  }

  // Vier feste Plätze pro Seilschaft: Auch bei identischer Höhe verdeckt niemand
  // eine andere Figur. Namen bleiben zusätzlich vollständig im title/aria-label.
  function kulisse() {
    var e = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    e.setAttribute("viewBox", "0 0 360 350");
    e.setAttribute("preserveAspectRatio", "none");
    e.setAttribute("class", "gipfel-kulisse");
    e.setAttribute("aria-hidden", "true");
    e.innerHTML = '<rect width="360" height="350" fill="#b7dfe5"/>' +
      '<circle cx="301" cy="43" r="24" fill="#fff2b6" stroke="#27384e" stroke-width="3"/>' +
      '<path d="M-20 75Q5 53 28 65Q44 42 63 61Q90 55 96 75Z M187 36Q202 20 216 31Q233 12 248 31Q271 26 277 39Z" fill="#f8faf1" stroke="#27384e" stroke-width="2"/>' +
      '<path d="M-20 226L42 129L91 201L151 106L211 201L280 119L385 243V350H0Z" fill="#7fa7b3" stroke="#27384e" stroke-width="3"/>' +
      '<path d="M-30 331L22 174L40 114L313 114L341 184L387 331Z" fill="#81949a" stroke="#27384e" stroke-width="4" stroke-linejoin="round"/>' +
      '<path d="M40 114H313L325 151L299 140L279 163L257 143L238 161L212 138L187 161L165 143L139 164L115 143L88 165L65 143L28 158Z" fill="#fbf6e6" stroke="#27384e" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M185 163L172 216L194 243L174 278L189 315H318L291 244L269 214L258 170L237 164L212 140Z" fill="#6d808b"/>' +
      '<path d="M29 283L76 263L45 237L101 215L68 191 M331 279L285 257L313 234L262 210L289 185" fill="none" stroke="#c8c8ae" stroke-width="5" stroke-dasharray="4 8" stroke-linecap="round"/>' +
      '<path d="M79 195l12-4m33 62l13-4m88-54l14-4m40 94l13-4M56 290l10-4m128-78l13-4" stroke="#3e5667" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M0 310Q70 297 133 311T262 308T360 314V350H0Z" fill="#5d7776" stroke="#27384e" stroke-width="3"/>' +
      '<path d="M19 325L42 288L68 325Z" fill="#f4b34f" stroke="#27384e" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M42 288L45 325H68Z" fill="#e18940" stroke="#27384e" stroke-width="2"/>' +
      '<path d="M24 325L40 302L42 325Z" fill="#27384e"/>' +
      '<path d="M307 319h19v9q-10 7-19 0Z M326 321q12-1 6 7h-6" fill="#c4d5cd" stroke="#27384e" stroke-width="2"/>' +
      '<path d="M309 314q-5-5 0-9m9 9q-5-5 0-9" fill="none" stroke="#ecf1d7" stroke-width="2" stroke-linecap="round"/>';
    return e;
  }

  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.gipfel = function (a) {
    var inhalt = node("div", "gipfel-expedition");
    var kopf = node("div", "gipfel-kopf");
    var titel = node("div");
    titel.appendChild(node("p", "gipfel-titel", "Mount Botzeps"));
    titel.appendChild(node("p", "gipfel-untertitel", "Gipfel = Wochenziel. Jede Einheit zählt."));
    kopf.appendChild(titel);
    kopf.appendChild(node("span", "gipfel-hoehe", "8.848 m"));
    inhalt.appendChild(kopf);
    var figuren = new Map();
    var timer = null;
    var spieler = a.spieler || [];
    var fazit = node("p", "gipfel-fazit");
    if (!spieler.length) inhalt.appendChild(node("p", "gipfel-leer", "Die Seilschaft wird zusammengestellt."));

    for (var gruppe = 0; gruppe < spieler.length; gruppe += 4) {
      var team = spieler.slice(gruppe, gruppe + 4);
      var block = node("div", "gipfel-seilschaft");
      var landschaft = node("div", "gipfel-landschaft");
      landschaft.appendChild(kulisse());
      landschaft.appendChild(node("span", "gipfel-etikett", spieler.length > 4 ? "Seilschaft " + (gruppe / 4 + 1) : "Die Expedition"));
      landschaft.appendChild(node("span", "gipfel-lager", "BASISLAGER · unter 25 %"));
      var liste = node("ul", "gipfel-stand");
      team.forEach(function (sp, index) {
        var links = (index + 0.5) / team.length * 100;
        var spur = node("div", "gipfel-spur");
        spur.style.left = links + "%";
        spur.setAttribute("aria-hidden", "true");
        landschaft.appendChild(spur);
        var k = node("div", "gipfel-kletterer" + (sp.ich ? " ich" : ""));
        k.style.left = links + "%";
        k.dataset.id = sp.id;
        k.setAttribute("aria-hidden", "true");
        k.appendChild(node("span", "gipfel-schatten"));
        var figur = node("div", "gipfel-figur");
        var avatar = minispielAvatar(a, sp.id, "bereit");
        figur.appendChild(avatar);
        k.appendChild(figur);
        var fahne = node("span", "gipfel-fahne");
        fahne.hidden = true;
        k.appendChild(fahne);
        var name = node("span", "gipfel-name", sp.name);
        name.title = sp.name;
        k.appendChild(name);
        landschaft.appendChild(k);
        var zeile = node("li", sp.ich ? "ich" : "");
        var person = node("span", "gipfel-person", sp.name + (sp.ich ? " (du)" : ""));
        person.title = sp.name;
        var wert = node("span", "gipfel-wert", "0 m");
        zeile.appendChild(person);
        zeile.appendChild(wert);
        liste.appendChild(zeile);
        figuren.set(sp.id, { spieler: sp, element: k, avatar: avatar, fahne: fahne, wert: wert, zeile: zeile });
      });
      block.appendChild(landschaft);
      block.appendChild(liste);
      inhalt.appendChild(block);
    }
    inhalt.appendChild(fazit);

    function zusammenfassung(stand) {
      var k = stand.kletterer || [];
      var oben = k.filter(function (x) { return !!x.oben; });
      if (!k.length) return "Die Expedition wartet auf die ersten Trainings.";
      if (!oben.length) return "Noch niemand am Gipfel. Das Wochenziel bestimmt eure Höhe.";
      var erste = figuren.get(oben[0].id);
      return oben.length + " von " + k.length + " am Gipfel. Zuerst oben: " + (erste ? erste.spieler.name : "–") + ".";
    }

    return minispielAnimationSzene(a, {
      klasse: "ms-gipfel",
      inhalt: inhalt,
      dauer: 1100,
      beschreibe: zusammenfassung,
      zeichne: function (stand, meta) {
        if (timer !== null) clearTimeout(timer);
        var kletterer = stand.kletterer || [];
        var ankunft = kletterer.filter(function (x) { return !!x.oben; });
        var vorher = new Map(((meta.vorher && meta.vorher.kletterer) || []).map(function (x) { return [x.id, x]; }));
        var aktuell = new Map(kletterer.map(function (x) { return [x.id, x]; }));
        var bewegt = [];
        figuren.forEach(function (f, id) {
          var k = aktuell.get(id) || { anteil: 0, hoehe: 0, oben: null };
          var alt = vorher.get(id);
          var anteil = Number.isFinite(k.anteil) ? Math.max(0, Math.min(k.oben ? 1 : .97, k.anteil)) : 0;
          var steigt = meta.bewegt && alt && k.anteil > alt.anteil;
          f.element.style.transition = meta.bewegt ? "transform 1s steps(6, end)" : "none";
          f.element.style.transform = "translateY(" + (-190 * anteil) + "px)";
          f.element.classList.toggle("steigt", !!steigt);
          f.element.classList.remove("angekommen");
          var pose = k.oben ? "jubel" : k.anteil > 0 ? "klettern" : "bereit";
          minispielSetzePose(f.avatar, a, id, steigt ? "klettern" : pose);
          var platz = ankunft.findIndex(function (x) { return x.id === id; }) + 1;
          // Eine Fahne wird ausschließlich aus der vom Server bestätigten Ankunft abgeleitet.
          f.fahne.hidden = !k.oben || !!steigt;
          f.fahne.textContent = "⚑ " + platz;
          var hoehe = Number.isFinite(k.hoehe) ? Math.max(0, Math.round(k.hoehe)) : 0;
          var standText = k.oben ? "⚑ " + platz + ". oben" : hoehe.toLocaleString("de-DE") + " m";
          f.wert.textContent = standText;
          f.zeile.setAttribute("aria-label", f.spieler.name + ": " + standText + (!k.oben && k.anteil < .25 ? ", Basislager" : ""));
          if (steigt) bewegt.push({ figur: f, kletterer: k, pose: pose });
        });
        fazit.textContent = zusammenfassung(stand);
        if (bewegt.length) timer = setTimeout(function () {
          bewegt.forEach(function (x) {
            x.figur.element.classList.remove("steigt");
            x.figur.element.classList.toggle("angekommen", !!x.kletterer.oben);
            x.figur.fahne.hidden = !x.kletterer.oben;
            minispielSetzePose(x.figur.avatar, a, x.figur.spieler.id, x.pose);
          });
          timer = null;
        }, 1000);
      }
    });
  };
})();
