# Spielerfiguren – Übergabe

## Stand der Überarbeitung

Alle zwölf festen Spielerfiguren besitzen jetzt sechs mit ImageGen erstellte, transparente Arcade-Illustrationen: `bereit`, `schlag`, `jubel`, `ko`, `ziehen` und `klettern`. Stilvorlage ist `src/boss/medien/bierbauch.png`: kräftige dunkle Tuschekonturen, organische sportliche Körper, satte Farben, harte Zellschatten und cremefarbene Glanzlichter. Kleidung, Hautfarben, Frisuren, Kopfteile und Brustembleme orientieren sich an den ursprünglichen Figuren. Namen und Nummern 0–11 bleiben identisch; die gespeicherte Auswahl gilt weiterhin pro Season.

Der Einstiegspunkt bleibt `figurSvg(figur, pose, optionen)` in `figuren.ts`, die Rückgabe bleibt ein SVG-String mit dem bisherigen `viewBox`. Die API, Auswahlregeln und Schadensberechnung sind unverändert. Individuell zusammengestellte Baukastenfiguren und explizite `mimik`-Optionen verwenden weiterhin den SVG-Baukasten. `zombie: true` färbt auch die Illustrationen über den bestehenden SVG-Farbfilter grün.

## Medien und Auslieferung

`medien/` enthält pro Figur einen PNG-Atlas mit allen sechs Posen, drei Spalten und zwei Zeilen in obiger Reihenfolge. Jede Zelle misst 200 × 300 px; der gesamte Atlas 600 × 600 px. Die Füße stehen bei y=286 jeder Zelle; alle Posen einer Figur haben denselben Maßstab. Die Bilder sind auf maximal 192 Farben einschließlich Transparenz reduziert.

`atlanten.ts` ordnet Figurennummern den Dateinamen zu. Jeder Dateiname enthält einen SHA-256-Inhaltshash. `arcade.ts` beschneidet den richtigen Ausschnitt im SVG und liefert nur eine Referenz auf `/app/figuren/<nr>-<hash>.png`. Alle Posen teilen dieselbe URL: Beim Zuschlagen oder Jubeln ist kein zusätzlicher Bilddownload nötig. Die API-Antworten enthalten keine eingebetteten PNG-Daten.

`src/server.ts` liefert ausschließlich die zwölf bekannten Dateien aus, ohne Telegram-Anmeldung, mit `image/png`, `nosniff` und `cache-control: public, max-age=31536000, immutable`. Unbekannte Dateien und Pfade werden mit 404 beantwortet. Neue Bilder bekommen neue Hashes; Browser können keine alten Figuren unter derselben URL behalten. Die vorhandene CSP mit `img-src 'self' data:` reicht aus. Der Build kopiert den Medienordner nach `dist/figuren/medien`, auch im Docker-Build.

## Animationen und Aufrufer

- Bosskampf: `bereit` → `schlag` → `bereit`, beim Sieg `jubel`; Drückeberger bleiben `ko`. Der bestehende Ablauf mit Sprung, Schaden und Boss-Trefferreaktion bleibt erhalten. Die illustrierten Figuren atmen in der Kampfhaltung leicht und jubeln dreimal kurz. `prefers-reduced-motion` unterbindet diese Bewegung.
- Auswahl im Mehr-Tab: `bereit`, unverändert 60 × 88 px. Bosskampf: 54 × 80 px.
- Die Posen `ziehen`, `klettern` und der Zombie-Filter sind vollständig vorhanden und in der Figuren-Vorschau sichtbar. Die Minispiele verwenden bisher weiterhin ihre bisherige Darstellung; die Anbindung der Figuren dort ist eine eigene spätere Aufgabe.

## Vorschauen und Prüfung

```sh
npm ci
npm run typecheck
npm test
npm run build
node scripts/figuren-vorschau.mjs
node scripts/boss-vorschau.mjs
```

`figuren-vorschau.html` zeigt alle zwölf Figuren, alle sechs Posen, die Zombie-Variante und einen abspielbaren Posenwechsel. `boss-vorschau.html` verwendet den tatsächlichen Kampfablauf und das CSS der Mini App. Beide HTML-Dateien sind eigenständig, enthalten ihre Bilder und können lokal ohne Telegram oder Webserver geöffnet werden. Die erzeugten Vorschauen gehören nicht ins Repository.

Die Tests prüfen die vollständige Figuren-/Posenmatrix, eindeutige IDs und Ausschnitte, PNG-Abmessungen, Dateihashes, Größenbudget, Zombie-Filter sowie die Medienroute und weiterhin Auswahl und Bosskampf.

Prüfstand 2026-11-08: Typprüfung, Build und alle 279 Tests (35 Dateien) erfolgreich. Chromium prüfte alle zwölf Atlanten, alle Posen einschließlich Zombie, den echten Posenwechsel im Bosskampf, Sieg, reduzierte Bewegung sowie die mobile Ansicht bei 390 px ohne horizontalen Überlauf oder Seitenfehler. Die Transparenz nach der Palettenreduktion wird zusätzlich durch einen Rastertest abgesichert.

## Spätere Bildänderungen

Die verwendeten Beschreibungen und Rastervorgaben stehen in `medien/prompts.json`. Ausgangspunkt war je Figur eine transparente ImageGen-Tafel mit sechs Posen in einem 3×2-Raster, Stilreferenz der Boss und Identitätsreferenz die ursprüngliche SVG-Figur. Die hochauflösenden Originale sind Arbeitsdateien; eingecheckt sind die kleinen Produktionsatlanten.

`scripts/figuren-optimieren.mjs` normalisiert Maßstab und Fußlinie, reduziert die Palette, schreibt die PNGs mit Inhaltshashes und aktualisiert `atlanten.ts`. Es benötigt ImageMagick 7 und eine lokale JSON-Liste mit genau zwölf Einträgen `{ "nr": 0, "path": "/absolut/zur/quelle.png" }` (Nummern 0–11):

```sh
node scripts/figuren-optimieren.mjs quellen.json
```

Anschließend die nicht mehr referenzierten alten PNGs entfernen, Vorschauen prüfen und Tests/Build ausführen. Der Produktionsbetrieb benötigt ImageMagick nicht.
