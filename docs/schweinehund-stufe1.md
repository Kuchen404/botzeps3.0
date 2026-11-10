# Schweinehund Stufe 1: Fortschritt

Jeder fertige Schritt wird geprüft, einzeln committed und sofort auf `codex/schweinehund-stufe1-animationen` gepusht. Jeder veröffentlichte Stand ist für sich nutzbar. Ausschließlich Schweinehund Stufe 1; Spielregeln und andere Bosse bleiben unverändert.

- [x] 1. Auftritt: Gähnen, Schlurfen, Bauchkratzen, Grinsen.
- [x] 2. Ruhe: Blick, Schnüffeln, Ohrenzucken und Einnicken.
- [x] 3. Treffer: kleine Reaktionen und Stolpern ab 10 % der maximalen LP.
- [x] 4. Zustände: selbstsicher, knurrend bei ≤60 %, nervös bei ≤25 % LP.
- [x] 5. Niederlage: letzter Grunzer, Hinsetzen, Ohren über Augen, Umkippen.
- [ ] 6. Vorschau, abschließende Browserprüfung und Feinschliff.

Nächster Schritt: 6. Browsermatrix, Vorschau und abschließender Feinschliff.

Schritt 1 geprüft: Build, Typprüfung, 15 Boss-Tests; Chromium bei 390 px mit allen vier Auftrittsphasen, unveränderten LP, Überspringen und reduzierter Bewegung. Atlas: 40.165 Bytes.

## Technik

Optionale `reaktion.sequenzen` enthalten Atlas-URL, Bildgröße, Zellgröße und Bildausschnitte mit Anzeigedauer. Die API liefert sie ausschließlich für Schweinehund Stufe 1. Feste Dateien über die bestehende Medien-Allowlist, Inhalts-Hashes für Caching; Zielgröße maximal 100 KB je Atlas. Einheitliche 256×256-Zellen mit konsistenter Fußlinie. `node scripts/schweinehund-optimieren.mjs ART ORIGINAL.png` normalisiert die Originale und ergänzt das Manifest. Originale bleiben erhalten.

Neue Posen verwenden die abbrechbare Boss-Laufzeit. Ohne geladene Sequenz greifen die bestehenden Posen. Reduzierte Bewegung zeigt sofort den tatsächlichen Stand. Reproduzierbare Vorschau: `npm run build && node scripts/boss-vorschau.mjs /tmp/bosse.html`, über einen lokalen HTTP-Server öffnen.

Schritt 2 geprüft: Build, Typprüfung und 15 Boss-Tests; Chromium bei 390 px mit Blick/Schnüffeln/Ohren/Einnicken, angeforderten Pausen von 6/7/8 Sekunden, Unterbrechung, reduzierter Bewegung, Hintergrund und Fortsetzung. Stufe 2 verwendet keine Ruhe-Sequenzen. Atlas: 39.911 Bytes. Ruheaktionen laufen ausschließlich beim aktiven, nicht besiegten Boss und werden vor neuen Kampfläufen abgebrochen.

Schritt 3 geprüft: Build, Typprüfung und 16 Boss-Tests einschließlich exakter 10-%-Grenze; Chromium bei 390 px mit 5-%-Treffer, 10-%-Treffer, Zunge/Stolpern/Halsband und Abbruch im Rückstoß. LP bleiben korrekt. Ein tödlicher Treffer endet ohne Halsband-Richten. Atlas: 43.076 Bytes.

Schritt 4 geprüft: Build, Typprüfung und 17 Boss-Tests; Chromium bei 390 px mit exakt 60 %/25 % verbleibenden LP, gesundem Start des Rückblicks und korrektem statischem Zustand nach Überspringen/reduzierter Bewegung. Die Berechnung folgt dem gezeigten kumulierten Schaden. Nervöse Figuren nicken nicht mehr ein. Atlas: 39.760 Bytes.

Schritt 5 geprüft: Build, Typprüfung und 18 Boss-Tests; Chromium bei 390 px mit allen vier Niederlagenphasen, synchronem „Pff“, dauerhaftem letzten K.O.-Bild und Abbruch während des Hinsetzens. Reduzierte Bewegung zeigt direkt die bestätigte K.O.-Pose. Atlas: 36.914 Bytes.
