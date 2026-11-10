# Schweinehund Stufe 1: Fortschritt

Jeder fertige Schritt wird geprüft, einzeln committed und sofort auf `codex/schweinehund-stufe1-animationen` gepusht. Jeder veröffentlichte Stand ist für sich nutzbar. Ausschließlich Schweinehund Stufe 1; Spielregeln und andere Bosse bleiben unverändert.

- [x] 1. Auftritt: Gähnen, Schlurfen, Bauchkratzen, Grinsen.
- [ ] 2. Ruhe: Blick, Schnüffeln, Ohrenzucken und Einnicken.
- [ ] 3. Treffer: kleine Reaktionen und Stolpern ab 10 % der maximalen LP.
- [ ] 4. Zustände: selbstsicher, knurrend bei ≤60 %, nervös bei ≤25 % LP.
- [ ] 5. Niederlage: letzter Grunzer, Hinsetzen, Ohren über Augen, Umkippen.
- [ ] 6. Vorschau, abschließende Browserprüfung und Feinschliff.

Nächster Schritt: 2. Ruhephasen ergänzen.

Schritt 1 geprüft: Build, Typprüfung, 15 Boss-Tests; Chromium bei 390 px mit allen vier Auftrittsphasen, unveränderten LP, Überspringen und reduzierter Bewegung. Atlas: 40.165 Bytes.

## Technik

Optionale `reaktion.sequenzen` enthalten Atlas-URL, Bildgröße, Zellgröße und Bildausschnitte mit Anzeigedauer. Die API liefert sie ausschließlich für Schweinehund Stufe 1. Feste Dateien über die bestehende Medien-Allowlist, Inhalts-Hashes für Caching; Zielgröße maximal 100 KB je Atlas. Einheitliche 256×256-Zellen mit konsistenter Fußlinie. `node scripts/schweinehund-optimieren.mjs ART ORIGINAL.png` normalisiert die Originale und ergänzt das Manifest. Originale bleiben erhalten.

Neue Posen verwenden die abbrechbare Boss-Laufzeit. Ohne geladene Sequenz greifen die bestehenden Posen. Reduzierte Bewegung zeigt sofort den tatsächlichen Stand. Reproduzierbare Vorschau: `npm run build && node scripts/boss-vorschau.mjs /tmp/bosse.html`, über einen lokalen HTTP-Server öffnen.
