# Schweinehund Stufe 1: Fortschritt

Jeder fertige Schritt wird geprüft, einzeln committed und sofort auf `codex/schweinehund-stufe1-animationen` gepusht. Jeder veröffentlichte Stand ist für sich nutzbar. Ausschließlich Schweinehund Stufe 1; Spielregeln und andere Bosse bleiben unverändert.

- [x] 1. Auftritt: Gähnen, Schlurfen, Bauchkratzen, Grinsen.
- [x] 2. Ruhe: Blick, Schnüffeln, Ohrenzucken und Einnicken.
- [x] 3. Treffer: kleine Reaktionen und Stolpern ab 10 % der maximalen LP.
- [x] 4. Zustände: selbstsicher, knurrend bei ≤60 %, nervös bei ≤25 % LP.
- [x] 5. Niederlage: letzter Grunzer, Hinsetzen, Ohren über Augen, Umkippen.
- [x] 6. Vorschau, abschließende Browserprüfung und Feinschliff.

Die ursprünglichen Schritte 1–5 sind mit PR #80 gemerged. Schritt 6 und die Überarbeitung zur flüssigen Wiedergabe liegen auf `codex/schweinehund-fluessige-animationen`.

Schritt 1 geprüft: Build, Typprüfung, 15 Boss-Tests; Chromium bei 390 px mit allen vier Auftrittsphasen, unveränderten LP, Überspringen und reduzierter Bewegung. Atlas: 40.165 Bytes.

## Technik

Optionale `reaktion.sequenzen` enthalten Atlas-URL, Bildgröße, Zellgröße und Bildausschnitte mit Anzeigedauer. Die API liefert sie ausschließlich für Schweinehund Stufe 1. Feste Dateien über die bestehende Medien-Allowlist, Inhalts-Hashes für Caching; Zielgröße maximal 100 KB je Atlas. Einheitliche 256×256-Zellen mit konsistenter Fußlinie. `node scripts/schweinehund-optimieren.mjs ART ORIGINAL.png` normalisiert die Originale und ergänzt das Manifest. Originale bleiben erhalten.

Neue Posen verwenden die abbrechbare Boss-Laufzeit. Ohne geladene Sequenz greifen die bestehenden Posen. Reduzierte Bewegung zeigt sofort den tatsächlichen Stand. Reproduzierbare Vorschau: `npm run build && node scripts/boss-vorschau.mjs /tmp/bosse.html`, über einen lokalen HTTP-Server öffnen.

Schritt 2 geprüft: Build, Typprüfung und 15 Boss-Tests; Chromium bei 390 px mit Blick/Schnüffeln/Ohren/Einnicken, angeforderten Pausen von 6/7/8 Sekunden, Unterbrechung, reduzierter Bewegung, Hintergrund und Fortsetzung. Stufe 2 verwendet keine Ruhe-Sequenzen. Atlas: 39.911 Bytes. Ruheaktionen laufen ausschließlich beim aktiven, nicht besiegten Boss und werden vor neuen Kampfläufen abgebrochen.

Schritt 3 geprüft: Build, Typprüfung und 16 Boss-Tests einschließlich exakter 10-%-Grenze; Chromium bei 390 px mit 5-%-Treffer, 10-%-Treffer, Zunge/Stolpern/Halsband und Abbruch im Rückstoß. LP bleiben korrekt. Ein tödlicher Treffer endet ohne Halsband-Richten. Atlas: 43.076 Bytes.

Schritt 4 geprüft: Build, Typprüfung und 17 Boss-Tests; Chromium bei 390 px mit exakt 60 %/25 % verbleibenden LP, gesundem Start des Rückblicks und korrektem statischem Zustand nach Überspringen/reduzierter Bewegung. Die Berechnung folgt dem gezeigten kumulierten Schaden. Nervöse Figuren nicken nicht mehr ein. Atlas: 39.760 Bytes.

Schritt 5 geprüft: Build, Typprüfung und 18 Boss-Tests; Chromium bei 390 px mit allen vier Niederlagenphasen, synchronem „Pff“, dauerhaftem letzten K.O.-Bild und Abbruch während des Hinsetzens. Reduzierte Bewegung zeigt direkt die bestätigte K.O.-Pose. Atlas: 36.914 Bytes.


## Flüssige Wiedergabe statt langer Standbilder

Der bisherige Wechsel kompletter SVGs wird durch einen wiederverwendeten Canvas ersetzt. Ein verformbares Dreiecksnetz bewegt Kopf, Ohren, Arme und Körper kontinuierlich. Kleine vorab berechnete Bewegungsfelder verbinden die vorhandenen gemalten Schlüsselposen; zusätzliche PNG-Zwischenbilder werden nicht ausgeliefert. Einheitliche Fußmittelpunkte verhindern seitliche Sprünge. Die Felder benötigen rund 3,9 KB gzip, der Renderer rund 4,7 KB gzip. Alle fünf PNGs bleiben bytegenau unverändert: zusammen 199.826 Bytes.

WebGL übernimmt die Verformung auf der Grafikhardware; bei fehlendem oder verlorenem Grafik-Kontext zeichnet ein Canvas-2D-Netz weiter. Die Darstellung zielt auf die Bildwiederholrate des Browsers. Navigation entfernt Renderer und Grafikressourcen; Hintergrund, Überspringen und reduzierte Bewegung stoppen die laufenden Renderframes. Abgeschlossene Kämpfe bleiben statisch. Eine verspätete Grafik blockiert keine bereits geladenen anderen Posen.

Treffer kombinieren stärkeres Ausholen, einen schnelleren Kontakt, eine begrenzte Trefferpause, deutlicheren Rückstoß und nachschwingende Ohren. Kräftige Treffer erzeugen eine kurze Bodenwelle. Die Schadenswerte, LP-Grenzen und das bestätigte Siegflag bleiben unverändert. Die Erweiterung greift weiterhin ausschließlich bei Schweinehund Stufe 1.

Die Vorschau öffnet direkt Stufe 1; `?stufe=1&sieg=1` zeigt den Sieg, `?boss=1&stufe=2` die bisherigen anderen Formen. Browserprüfung: `PLAYWRIGHT_MODULE=/pfad/playwright/index.mjs node scripts/schweinehund-browser.mjs /tmp/bosse.html`. Prüft 320/390/600 px, echte Zwischenbilder bei unveränderter Pose, Treffer, LP, Abbruch, Hintergrund, reduzierte Bewegung, Stufe-2-/Boss-Isolation, Grafik-Kontextverlust, Bildausfälle und exakt fünf Atlas-Downloads.

Bewegungsfelder neu berechnen: nach `npm run build` mit Python/OpenCV `node scripts/schweinehund-fluss.mjs`. Dies ist eine Entwicklungshilfe; die App erhält weder OpenCV noch weitere Bibliotheken. Es werden ausschließlich Bewegungszahlen aus den bestehenden PNGs gemessen, keine neuen Bilder erzeugt. Bei neuen Zeichnungen müssen deren Fußanker kontrolliert werden.

Die gewichteten vormultiplizierten Posen werden additiv zusammengesetzt: Die Figur wird in der Übergangsmitte nicht halb durchsichtig. Eine Browserprüfung misst die Deckkraft direkt im Renderpuffer. Während der Ladephase wird keine vorzeitige K.O.-Pose in einen laufenden Rückblick übernommen. Abschließend: Build/Typprüfung, 448 Tests und Browsermatrix erfolgreich; Videovorschau und direkter Vorher-nachher-Vergleich erstellt.
