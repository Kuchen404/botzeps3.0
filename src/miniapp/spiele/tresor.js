(function () {
  "use strict";

  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.tresor = function (a) {
    var nummer = function (wert) { return Math.round(wert).toLocaleString("de-DE"); };
    var ueberschrift = el("p", { class: "tresor-ueberschrift" });
    var ziffern = [];
    var riegel = [];
    var code = el("div", { class: "tresor-code", role: "img" });
    for (var i = 0; i < 4; i++) {
      ziffern.push(el("span", { class: "tresor-ziffer", text: "?", "aria-hidden": "true" }));
      code.appendChild(ziffern[i]);
      riegel.push(el("span", { class: "tresor-riegel r" + i, "aria-hidden": "true" }));
    }
    var rad = el("div", { class: "tresor-rad", "aria-hidden": "true" }, [el("span", { class: "tresor-nabe" })]);
    var tuer = el("div", { class: "tresor-tuer" }, [code, rad].concat(riegel));
    var innen = el("div", { class: "tresor-innen", "aria-hidden": "true" }, [
      el("div", { class: "tresor-goldlicht" }),
      el("span", { class: "tresor-stern eins", text: "✦" }),
      el("span", { class: "tresor-stern zwei", text: "✦" }),
      el("span", { class: "tresor-stern drei", text: "✦" })
    ]);
    var team = el("div", { class: "tresor-team", role: "group", tabindex: "0", "aria-label": "Das Team am Tresor; seitlich scrollen für weitere Beiträge" });
    var szene = el("div", { class: "tresor-szene tresor-ruhig" }, [
      el("div", { class: "tresor-kellerlicht", "aria-hidden": "true" }),
      ueberschrift,
      el("div", { class: "tresor-gehaeuse" }, [innen, tuer]),
      team
    ]);
    var viertel = [];
    var balken = el("div", { class: "tresor-fortschritt", "aria-hidden": "true" });
    for (var j = 0; j < 4; j++) {
      var fuellung = el("span", {});
      var segment = el("span", { class: "tresor-viertel" }, [fuellung]);
      viertel.push({ segment: segment, fuellung: fuellung });
      balken.appendChild(segment);
    }
    var fortschritt = el("div", {});
    var hinweis = el("div", { class: "tresor-zusatz" });
    var inhalt = el("div", { class: "tresor-inhalt" }, [szene, el("div", { class: "tresor-info" }, [balken, fortschritt, hinweis])]);
    var mitglieder = {};

    function standVon(stand) {
      var ziel = Math.max(1, Number(stand.ziel) || 1);
      var summe = Math.max(0, Number(stand.summe) || 0);
      // Die Server-Ziffern sind maßgeblich. Der Text enthält nur bereits verratene Ziffern.
      var anzahl = Math.max(0, Math.min(4, Math.floor(Number(stand.ziffern) || 0)));
      var teile = String(stand.code || "").trim().split(/\s+/);
      var offen = anzahl === 4 && stand.offen === true;
      return { ziel: ziel, summe: summe, ziffern: anzahl, teile: teile, offen: offen };
    }

    function beschreibe(stand) {
      var s = standVon(stand);
      if (s.offen) return "Tresor offen! Alle vier Schlösser sind geknackt. Die Beute wird am Sonntag verraten.";
      return s.ziffern + " von 4 Schlössern geknackt. " + nummer(s.summe) + " von " + nummer(s.ziel) + " Lastpunkten. Noch " + nummer(Math.max(0, s.ziel - s.summe)) + " bis der Tresor aufgeht.";
    }

    function zeichne(stand, meta) {
      var s = standVon(stand);
      var alt = meta.vorher ? standVon(meta.vorher) : null;
      szene.classList.toggle("tresor-ruhig", !meta.bewegt);
      szene.classList.toggle("offen", s.offen);
      szene.style.setProperty("--tresor-drehung", (s.ziffern * 35) + "deg");
      szene.setAttribute("data-ziffern", String(s.ziffern));
      szene.setAttribute("data-offen", String(s.offen));
      ueberschrift.textContent = s.offen ? "Zusammen geknackt!" : s.ziffern ? s.ziffern + " von 4 Schlössern gelöst" : "Vier Schlösser. Ein Team.";
      var sichtbarerCode = [];
      ziffern.forEach(function (feld, index) {
        var sichtbar = index < s.ziffern && /^\d$/.test(s.teile[index] || "");
        var wert = sichtbar ? s.teile[index] : "?";
        feld.textContent = wert;
        sichtbarerCode.push(sichtbar ? wert : "unbekannt");
        feld.classList.toggle("geloest", sichtbar);
        feld.classList.toggle("neu", !!(meta.bewegt && sichtbar && alt && index >= alt.ziffern));
        riegel[index].classList.toggle("geloest", sichtbar);
        viertel[index].segment.classList.toggle("geloest", index < s.ziffern);
        viertel[index].fuellung.style.width = (Math.max(0, Math.min(1, s.summe / s.ziel * 4 - index)) * 100) + "%";
      });
      code.setAttribute("aria-label", "Tresorcode: " + sichtbarerCode.join(", "));
      fortschritt.textContent = nummer(s.summe) + " / " + nummer(s.ziel) + " Lastpunkte · " + s.ziffern + "/4 Schlösser";
      if (s.offen) fortschritt.textContent += " · Code " + ziffern.map(function (feld) { return feld.textContent; }).join(" ");
      hinweis.textContent = s.offen ? "Was im goldenen Licht liegt? Das erfahrt ihr am Sonntag." : "Nächste Ziffer bei " + nummer(s.ziel * (s.ziffern + 1) / 4) + " Lastpunkten. Jedes Training hilft.";

      var beitragende = (a.spieler || []).filter(function (spieler) { return (stand.lasten || {})[spieler.id] > 0; });
      var aktiv = {};
      beitragende.forEach(function (spieler) {
        var id = spieler.id;
        var last = (stand.lasten || {})[id] || 0;
        var vorher = meta.vorher && (meta.vorher.lasten || {})[id] || 0;
        var gerade = !!(meta.bewegt && last > vorher);
        var pose = s.offen ? "jubel" : gerade ? "schlag" : "bereit";
        if (!mitglieder[id]) {
          var avatar = minispielAvatar(a, id, pose);
          var beitrag = el("div", { class: "tresor-beitrag" });
          var zelle = el("div", { class: "tresor-mitglied" + (spieler.ich ? " ich" : ""), title: spieler.name }, [
            avatar,
            el("span", { class: "tresor-name", text: spieler.name }),
            beitrag
          ]);
          mitglieder[id] = { zelle: zelle, avatar: avatar, beitrag: beitrag };
        }
        var m = mitglieder[id];
        minispielSetzePose(m.avatar, a, id, pose);
        m.beitrag.textContent = nummer(last) + " Last";
        m.zelle.classList.toggle("aktiv", gerade);
        team.appendChild(m.zelle);
        aktiv[id] = true;
      });
      Object.keys(mitglieder).forEach(function (id) {
        if (!aktiv[id]) { mitglieder[id].zelle.remove(); delete mitglieder[id]; }
      });
      var leer = team.querySelector(".tresor-wartet");
      if (!beitragende.length && !leer) team.appendChild(el("span", { class: "tresor-wartet", text: "Euer erstes Training setzt das Schloss in Bewegung." }));
      if (beitragende.length && leer) leer.remove();
    }

    return minispielAnimationSzene(a, {
      klasse: "ms-tresor",
      inhalt: inhalt,
      zeichne: zeichne,
      beschreibe: beschreibe,
      dauer: 1200
    });
  };
})();
