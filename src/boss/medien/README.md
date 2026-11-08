# Arcade-Bosse

Mit dem eingebauten ImageGen-Werkzeug erstellte transparente Illustrationen im gemeinsam abgestimmten Arcade-Cartoon-Stil. Die fünf breiten PNGs enthalten Stufe 1 links und Stufe 2 rechts. Sofa und Chipstüte verwenden separate Bilder je Stufe. Die erste Form bleibt kleiner; die zweite erhält übertriebene Muskelarme bei erkennbarer Grundform.

Die PNGs sind auf maximal 1024 × 512 bzw. 512 × 512 Pixel und 256 Farben reduziert. `arcade.ts` bettet sie gecacht als Daten-URLs ein und begrenzt Doppelbilder im SVG auf die jeweilige Hälfte. Damit benötigen Mini-App und Telegram-Steckbriefe weder externe Bildserver noch neue öffentliche Routen. Der Build kopiert die Assets nach `dist/boss/medien` (auch im Docker-Build).

Die Mini-App animiert den Auftritt und die ganze Figur mit Atmen/Posieren und dem Kampfablauf. Alle sieben Bosse verwenden zusätzlich eigene Treffer- und Niederlagenposen in beiden Stufen, ergänzt um motivabhängige bewegte Teile wie Kissen, Chips, Zutaten oder Verpackungen. Arme und Gesichter sind keine separat animierten Ebenen. Bei reduzierter Bewegung und nach dem Sieg stoppt die Bewegung. Details und Zuschnitte stehen in `reaktionen-README.md`.

Die Prompts der neuen Motive stehen in `prompts.json`; Sofa und Chipstüte in Stufe 2 stammen aus den zuvor abgestimmten Arcade-Entwürfen.

Lokale Vorschau mit allen 14 Formen: `npm run build && node scripts/boss-vorschau.mjs`. Die erzeugte `boss-vorschau.html` kann im Browser geöffnet werden; sie enthält Beispieldaten und verwendet das tatsächliche Markup/CSS und die Kampffunktion aus der Mini-App. Keine Verbindung zu Telegram erforderlich.
