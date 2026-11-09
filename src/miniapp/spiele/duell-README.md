# Losduell / Fight Night

Ein gemeinsamer illustrierter Ring zeigt ein gelostes Paar groß. Die Karten darunter enthalten alle Paare und jeden Avatar samt tatsächlicher Wochenlast; sie wechseln den Ring. Die eigene Paarung ist standardmäßig ausgewählt. Ein manueller Wechsel überspringt den laufenden Rückblick und zeigt den aktuellen Stand des gewählten Paars. Die Auswahl bleibt beim Aktualisieren und nach einem Tabwechsel erhalten.

Der erste Besuch spielt die tatsächlichen Trainings chronologisch ab. Jeder positive Zuwachs eines Menschen löst genau eine Aktion aus: Ausholen, schneller Vorstoß, kurzer Trefferstopp, Comic-Impuls, Rückstoß und Rückkehr in die Deckung. Die Schlagpose wird abhängig von ihrer gezeichneten Hand zum Gegner gespiegelt. Die Gegnerlast wird nicht verringert. Der Prozentbalken stellt nur den Anteil an der gemeinsamen Last dieses Paars dar, keine Lebensenergie. Führungswechsel, erste Führung und Ausgleich haben eigene Einblendungen. Während der Woche bleibt jede Figur kampfbereit; Siegerjubel und die erschöpfte Niederlagenpose erscheinen ausschließlich nach `abgeschlossen: true`. Ein Unentschieden lässt beide neutral.

Botzeps hat vier vollständig illustrierte Posen in einem transparenten Atlas. Seine Last ist von Anfang an das Wochenziel, auch bei null Last des menschlichen Gegners. Er bekommt keine erfundenen Trainingseinheiten. Änderungen seines festen Werts, sinkende Last oder andere Paarungen werden ruhig korrigiert. Der Abschluss zeigt nur das ausgewählte Ergebnis; alle anderen Ergebnisse bleiben in den Paar-Karten auswählbar.

Stationen werden über ihre Art und ihren Zustand verglichen, nicht über veränderliche Snapshot-Zeiten. Neue Einträge setzen am letzten gesehenen Zustand fort. Korrekturen spielen keinen Angriff oder alten Führungswechsel ab. Ein reines Abschlussupdate zeigt nur das Ergebnis. Bei mehreren Zuwächsen in einer Station werden die Paare nacheinander mit ihren jeweiligen Zwischenständen abgespielt.

Alle WAAPI-Animationen und Wartezeiten gehören zur Szene. Überspringen, Paarwechsel, Navigation, Hintergrund, reduzierte Bewegung und Breitenänderungen beenden sie. Eine Änderung nur der Fensterhöhe unterbricht nicht. Die statische Ansicht zeichnet bei Breitenänderungen erneut. Fehlende neue Bilder verwenden die Grundkulisse, alte Avatarposen beziehungsweise ein Robotersymbol. Reduzierte Bewegung zeigt die illustrierten Bilder ohne Rückblick.

## Medien und Vorschau

Die feste Liste `src/figuren/duell-medien.ts` liefert ausschließlich die versionierten PNGs über den vorhandenen Cache-Endpunkt. Ring (600×750) und Bot (400×600, vier 200×300-Zellen) benötigen zusammen rund 228 KB. Die Spieler verwenden ihre bestehenden Figuren und gemeinsamen Laufzyklen; es gibt keine zusätzlichen Kampfdownloads pro Avatar.

`node scripts/duell-optimieren.mjs quellen.json` normalisiert Bildquellen, lässt Originale unverändert und schreibt Inhalts-Hashes in die Liste. Die Quellen-Datei enthält `{ "ring": "/pfad/ring.png", "bot": "/pfad/bot.png" }`. Beim Roboter bleiben Maßstab und Fußhöhe über die vier Posen gleich. Stil und Motive stehen in `src/figuren/medien/duell-prompts.json`.

Nach `npm run build` erzeugt `node scripts/duell-vorschau.mjs /tmp/duell.html` eine selbstständige HTML-Datei mit zehn Szenarien: laufende Woche, Abschluss, Remis, Botsieg, Bot überholt, Korrektur, 80 Spieler, fehlende Figuren, Start und leere Gruppe. Sie nutzt dieselbe Laufzeit wie die App mit gekennzeichneten Beispieldaten.
