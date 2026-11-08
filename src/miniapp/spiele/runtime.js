/* Gemeinsame Laufzeit für getrennt entwickelte Minispiel-Szenen. */
window.MINISPIEL_SZENEN = window.MINISPIEL_SZENEN || {};
var minispielGesehen = {};
function minispielAvatar(a, id, pose) {
  var element = el("div", { class: "ms-avatar", "data-id": id });
  minispielSetzePose(element, a, id, pose || "bereit");
  return element;
}
function minispielSetzePose(element, a, id, pose) {
  var sp = a.spieler.find(function (s) { return s.id === id; });
  if (!sp) { element.textContent = "?"; return; }
  var bilder = sp.figur != null && a.figuren && a.figuren[sp.figur];
  element.setAttribute("data-pose", pose);
  element.setAttribute("aria-label", sp.name);
  element.classList.toggle("ms-avatar-ich", !!sp.ich);
  element.classList.toggle("ms-avatar-ersatz", !(bilder && (bilder[pose] || bilder.bereit)));
  if (bilder && (bilder[pose] || bilder.bereit)) element.innerHTML = bilder[pose] || bilder.bereit;
  else {
    element.textContent = sp.id === "bot" ? "🤖" : initialen(sp.name);
    element.style.setProperty("--ms-avatar-farbe", farbe(sp.name));
  }
}
function minispielAnimationSzene(a, config) {
  var status = el("div", { class: "ms-status", role: "status", "aria-live": "polite" });
  var zeit = el("div", { class: "ms-zeit" });
  var skip = el("button", { class: "knopf leise", text: "Überspringen" });
  var replay = el("button", { class: "knopf leise", text: "↻ Nochmal ansehen" });
  var laden = el("button", { class: "knopf leise", text: "↻ Stand aktualisieren", onclick: function () { aktualisiereBombe(laden); } });
  var wurzel = el("div", { class: "ms-scene " + (config.klasse || "") }, [status, config.inhalt, zeit, el("div", { class: "ms-steuerung" }, [skip, replay, laden])]);
  var stationen = a.verlauf && a.verlauf.length ? a.verlauf : [{ zeitpunkt: null, art: "start", stand: a.aktuell }];
  var signaturen = stationen.map(function (s) { return JSON.stringify(s); });
  var gesehen = minispielGesehen[a.id];
  var lauf = 0, letztes = null;
  var dauer = Math.max(400, Math.min(2000, config.dauer || 1100));
  function zeichne(index, bewegt) {
    var s = stationen[index];
    var meta = { vorher: letztes, bewegt: bewegt, station: s, index: index, anzahl: stationen.length };
    config.zeichne(s.stand, meta);
    status.textContent = (config.beschreibe ? config.beschreibe(s.stand, meta) : a.name) || a.name;
    zeit.textContent = (index + 1) + " / " + stationen.length + (s.zeitpunkt ? " · " + new Date(s.zeitpunkt).toLocaleString("de-DE", { timeZone: a.zeitzone || "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "") + (s.art === "korrektur" ? " · Korrektur" : "");
    letztes = s.stand;
  }
  function ende() {
    lauf++;
    wurzel.setAttribute("data-rueckblick", "false");
    zeichne(stationen.length - 1, false);
    zeit.textContent = "Aktueller Stand";
    minispielGesehen[a.id] = signaturen;
    skip.hidden = true; replay.hidden = stationen.length < 2; replay.disabled = !BEWEGUNG;
  }
  function spiele(ab) {
    if (!wurzel.isConnected) return;
    var nr = ++lauf, index = ab;
    if (!BEWEGUNG || document.hidden || stationen.length < 2) { ende(); return; }
    wurzel.setAttribute("data-rueckblick", "true");
    skip.hidden = false; replay.hidden = true; letztes = null;
    zeichne(index, false);
    function weiter() {
      setTimeout(function () {
        if (nr !== lauf || !wurzel.isConnected) return;
        if (document.hidden || index >= stationen.length - 1) { ende(); return; }
        zeichne(++index, true);
        weiter();
      }, dauer);
    }
    weiter();
  }
  skip.onclick = ende;
  replay.onclick = function () { spiele(0); };
  requestAnimationFrame(function () {
    if (!wurzel.isConnected) return;
    var ab = 0;
    if (gesehen && gesehen.length && gesehen.every(function (sig, i) { return signaturen[i] === sig; })) {
      if (gesehen.length === signaturen.length) { ende(); return; }
      ab = gesehen.length - 1;
    }
    spiele(ab);
  });
  return wurzel;
}
