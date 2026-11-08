/* Losduell: Trainingslast entscheidet. Die kurzen Gesten sind sportliche Reaktionen,
 * keine Trefferpunkte und keine vorgezogene Entscheidung über die Woche. */
(function () {
  "use strict";
  window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
  window.MINISPIEL_SZENEN.duell = function (a) {
    var szene = el("div", { class: "duell-szene" });
    var paare = new Map();
    function name(id) {
      var p = (a.spieler || []).find(function (s) { return s.id === id; });
      return p ? p.name : id === "bot" ? "Botzeps" : "Unbekannt";
    }
    function zahl(n) { return Math.round(n).toLocaleString("de-DE"); }
    function schluessel(p) { return JSON.stringify([p.a, p.b]); }
    function vorne(p) { return p.lastA === p.lastB ? null : p.lastA > p.lastB ? p.a : p.b; }
    function status(p) {
      var f = vorne(p);
      if (!f) return "Gleichstand · " + zahl(p.lastA) + " : " + zahl(p.lastB);
      return name(f) + " führt · +" + zahl(Math.abs(p.lastA - p.lastB)) + " Lastpunkte";
    }
    szene.appendChild(el("p", { class: "duell-regel", text: "Gelostes Paar. Echte Wochenlast. Jedes Training bewegt das Duell – entschieden wird am Sonntag." }));

    function bot() {
      var bild = el("div", { class: "ms-avatar duell-bot", "data-id": "bot", "data-pose": "bereit" });
      bild.innerHTML = '<svg viewBox="0 0 140 180" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Botzeps, gepolsterter Trainingsroboter"><g stroke="#241c3b" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="70" cy="168" rx="40" ry="7" fill="#241c3b" opacity=".25" stroke="none"/><path d="M54 131v24H39v12h28v-36m20 0v24h15v12H74v-36" fill="#92a3c2"/><path d="M42 88q28-11 56 0l-4 47q-24 8-48 0Z" fill="#8b96b7"/><path d="M50 97h40v29H50Z" fill="#47445f"/><path d="m74 99-14 15h10l-5 13 17-18H72Z" fill="#ffe190" stroke-width="2"/><path d="M47 96 30 117 18 101m75-5 17 21 12-16" fill="none" stroke="#aab8d0" stroke-width="13"/><rect x="7" y="79" width="27" height="31" rx="11" fill="#ff827c"/><rect x="106" y="79" width="27" height="31" rx="11" fill="#79ded9"/><path d="M70 23V12"/><circle cx="70" cy="9" r="5" fill="#ffe190"/><rect x="29" y="28" width="82" height="58" rx="19" fill="#afc0d6"/><path d="M38 42h64v29H38Z" fill="#2b334d"/><path d="M45 54h12m26 0h12" stroke="#83f2dd" stroke-width="6"/><path d="M60 68h20" stroke="#fff0b3" stroke-width="3"/><path d="M25 46h-7v20h8m88-20h8v20h-8" fill="#e3d4ec"/><path d="M40 34h23" stroke="#fff" stroke-opacity=".6" stroke-width="3"/></g></svg>';
      return bild;
    }
    function sportler(id, seite) {
      var bild = id === "bot" ? bot() : minispielAvatar(a, id, "bereit");
      if (!bild.querySelector("svg") && id !== "bot") bild.classList.add("duell-ersatz");
      var avatar = el("div", { class: "duell-avatar" }, [bild]);
      var athlet = el("div", { class: "duell-athlet duell-athlet-" + seite }, [avatar]);
      athlet.setAttribute("aria-hidden", "true");
      athlet.addEventListener("animationend", function (event) {
        if (event.target !== athlet) return;
        athlet.classList.remove("duell-angriff", "duell-reaktion");
        if (id !== "bot") minispielSetzePose(bild, a, id, "bereit");
      });
      return { element: athlet, bild: bild, id: id };
    }
    function namensschild(id, seite) {
      var p = (a.spieler || []).find(function (s) { return s.id === id; });
      var n = el("span", { class: "duell-name", text: name(id) });
      if (p && p.ich) n.appendChild(el("span", { class: "duell-ich", text: "DU" }));
      var last = el("strong", { class: "duell-last", text: "0" });
      return { last: last, element: el("div", { class: "duell-" + seite }, [n, last, el("span", { class: "duell-einheit", text: "WOCHENLAST" })]) };
    }
    function baue(p, i) {
      var links = sportler(p.a, "links"), rechts = sportler(p.b, "rechts");
      var sl = namensschild(p.a, "links"), sr = namensschild(p.b, "rechts");
      var info = el("p", { class: "duell-vorsprung" });
      var puls = el("span", { class: "duell-puls", "aria-hidden": "true" });
      puls.innerHTML = '<svg viewBox="0 0 32 32" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><path d="M13 5h6l-1.5 15h-3Z" fill="currentColor"/><circle cx="16" cy="25" r="3" fill="currentColor"/></svg>';
      var ring = el("div", { class: "duell-ring" }, [
        el("div", { class: "duell-boden" }), el("div", { class: "duell-seile" }), links.element, rechts.element, puls
      ]);
      var karte = el("section", { class: "duell-paar", "aria-label": name(p.a) + " gegen " + name(p.b) }, [
        el("div", { class: "duell-kopf" }, [el("span", { class: "duell-nummer", text: "Duell " + (i + 1) }), el("span", { class: "duell-live", text: "Wochenstand" })]),
        el("div", { class: "duell-stand" }, [sl.element, el("span", { class: "duell-vs", text: "VS", "aria-hidden": "true" }), sr.element]), ring, info
      ]);
      if (p.a === "bot" || p.b === "bot") karte.appendChild(el("small", { class: "duell-bot-hinweis", text: "Botzeps bringt genau das Wochenziel mit – von Anfang an." }));
      karte.addEventListener("animationend", function (event) { if (event.target === karte) karte.classList.remove("duell-wechsel"); });
      szene.appendChild(karte);
      return { element: karte, links: links, rechts: rechts, lastA: sl.last, lastB: sr.last, info: info };
    }
    function ruhe(athlet) {
      athlet.element.classList.remove("duell-angriff", "duell-reaktion");
      if (athlet.id !== "bot") minispielSetzePose(athlet.bild, a, athlet.id, "bereit");
    }
    function zeichne(stand, meta) {
      var liste = stand.paare || [];
      var aktiv = new Set(liste.map(schluessel));
      paare.forEach(function (p, key) { if (!aktiv.has(key)) { p.element.remove(); paare.delete(key); } });
      var leer = szene.querySelector(".duell-leer");
      if (leer) leer.remove();
      if (!liste.length) szene.appendChild(el("p", { class: "duell-leer", text: "Die Duellpaare werden noch ausgelost." }));
      liste.forEach(function (p, i) {
        var key = schluessel(p), karte = paare.get(key);
        if (!karte) { karte = baue(p, i); paare.set(key, karte); }
        ruhe(karte.links); ruhe(karte.rechts);
        karte.element.classList.remove("duell-wechsel");
        karte.lastA.textContent = zahl(p.lastA);
        karte.lastB.textContent = zahl(p.lastB);
        karte.info.textContent = status(p);
        karte.element.dataset.vorne = vorne(p) === p.a ? "links" : vorne(p) === p.b ? "rechts" : "gleich";
        var vorher = meta.vorher && (meta.vorher.paare || []).find(function (alt) { return schluessel(alt) === key; });
        if (!meta.bewegt || !vorher) return;
        var deltaA = p.lastA - vorher.lastA, deltaB = p.lastB - vorher.lastB;
        if (deltaA > 0 || deltaB > 0) {
          var angreifer = deltaA >= deltaB ? karte.links : karte.rechts;
          var reaktion = angreifer === karte.links ? karte.rechts : karte.links;
          // CSS-Neustart auch bei zwei unmittelbar aufeinanderfolgenden Einheiten.
          void karte.element.offsetWidth;
          if (angreifer.id !== "bot") minispielSetzePose(angreifer.bild, a, angreifer.id, "schlag");
          angreifer.element.classList.add("duell-angriff");
          reaktion.element.classList.add("duell-reaktion");
        }
        if (vorne(p) !== null && vorne(p) !== vorne(vorher)) {
          void karte.element.offsetWidth;
          karte.element.classList.add("duell-wechsel");
        }
      });
    }
    return minispielAnimationSzene(a, {
      klasse: "ms-duell", inhalt: szene, dauer: 1100, zeichne: zeichne,
      beschreibe: function (stand) {
        return (stand.paare || []).map(function (p) { return name(p.a) + " gegen " + name(p.b) + ": " + status(p); }).join(". ") || "Die Duellpaare werden noch ausgelost.";
      }
    });
  };
})();
