# Spielerfiguren – Übergabe für die optische Überarbeitung

Die 12 Kämpferfiguren sind aktuell ein handgezeichneter SVG-Baukasten. Sie sollen – wie die Bosse in PR #52 – durch hochwertige Arcade-Comic-Illustrationen ersetzt werden. Die Spiellogik (Auswahl, Bosskampf, API) muss dafür nicht angefasst werden.

## Wo die Figuren hängen

Einziger Einstiegspunkt ist `figurSvg(figur, pose, optionen)` in `figuren.ts`. Alle Aufrufer:

| Aufrufer | Posen | Optionen |
| --- | --- | --- |
| `src/miniapp/api.ts` → `bossJson` (Bosskampf) | `bereit`, `schlag`, `jubel` (Kämpfer), `ko` (Drückeberger) | `id` |
| `src/miniapp/api.ts` → `GET /api/figuren` (Auswahl im Mehr-Tab) | `bereit` | `id` |
| `scripts/boss-vorschau.mjs` (lokale Vorschau) | `bereit`, `schlag`, `jubel`, `ko` | `id` |

Später für Minispiele vorgesehen: `ziehen` (Tauziehen), `klettern` (Gipfelsturm) und `zombie: true` (Zombie-Woche).

Rückgabe muss ein `<svg …>`-String bleiben. Die Mini App setzt ihn per `innerHTML` in einen 54 × 80 px großen Rahmen (`.figur > svg` in `app.html`, Auswahl: 60 × 88 px). Seitenverhältnis also etwa **2 : 3 hochkant**; das aktuelle `viewBox` ist `-58 -12 116 172`, Füße bei y ≈ 156.

`FIGUREN` (Name, Aussehen) und die Nummern 0–11 müssen gleich bleiben: Die Nummer ist in der Datenbank gespeichert (`teilnahme.figur`).

## Bilder

Pro Figur ein Bild je Pose, also 12 × 4 = 48 Pflicht (bereit, schlag, jubel, ko), 12 × 2 = 24 optional (ziehen, klettern).

- Stil wie `src/boss/medien`: dicke dunkle Konturen, satte glänzende Farben, harte Zellschatten, cremefarbene Lichter.
- Transparenter Hintergrund, ganze Figur von vorn, kein Boden-Schatten, keine Schrift.
- Füße in allen Posen auf gleicher Höhe (ca. 90 % der Bildhöhe), Figur mittig.
- Jede Figur muss in allen Posen eindeutig wiedererkennbar sein (Frisur, Kopfteil, Farben, Emblem auf der Brust).
- `schlag`: rechte Faust hoch zum Boss (Uppercut), Schrei. `jubel`: beide Arme hoch. `ko`: X-Augen, Sterne, leicht eingeknickt. `bereit`: Fäuste vor der Brust, grimmiges Grinsen.
- Vorlage für Aussehen und Posen: `/mnt/project-files/botzeps3/figuren/uebersicht.png` und `posen.png` (Projektordner, nicht im Repo); die Beschreibungen in `FIGUREN` gelten.

## Größe – wichtig

Die SVGs stecken heute direkt in den JSON-Antworten (`/api/ich`, `/api/figuren`); das ist klein, weil SVG sich mit gzip stark komprimieren lässt. **PNGs komprimiert gzip kaum.** Bei 12 Kämpfern × 3 Posen würde `/api/ich` sonst schnell über 1 MB groß.

Deshalb:

1. Bilder klein halten: etwa 200 × 300 px, auf 256 Farben reduziert (wie die Boss-PNGs), Ziel ≤ 15 KB pro Bild.
2. Besser: Bilder nicht als Daten-URL in jede Antwort einbetten, sondern über eine eigene, lange gecachte Route ausliefern (z. B. `GET /app/figuren/<nr>-<pose>.png` in `src/server.ts`, `cache-control: public, max-age=…, immutable`), und `figurSvg` gibt nur ein `<svg><image href="…"/></svg>` zurück. Die CSP der Seite erlaubt `img-src 'self' data:`, eine Route unter derselben Domain funktioniert also ohne Änderung.
3. Der Build kopiert Medien explizit (`package.json` → `build`, `fs.cpSync`); einen neuen Ordner `src/figuren/medien` dort ergänzen, wie bei `src/boss/medien`.

## Prüfen

- `npm test` – `figuren.test.ts` prüft, dass jede Figur in jeder Pose ein SVG mit eigener id liefert; `src/miniapp/server.test.ts` prüft Bosskampf und Auswahl.
- `npm run build && node scripts/boss-vorschau.mjs` erzeugt `boss-vorschau.html` mit Boss und Figuren im echten Kampfablauf der Mini App.
