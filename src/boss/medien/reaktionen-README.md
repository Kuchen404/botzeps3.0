# Treffer- und Niederlagenposen: Sofa und Chipstüte

Mit dem eingebauten ImageGen-Werkzeug am 08.11.2026 aus den jeweiligen bestehenden Stufe-1-/Stufe-2-PNGs erstellt. Die neutralen Originale bleiben erhalten. Beide neuen transparenten RGBA-Atlanten sind 1254 × 1254 Pixel groß.

Layout: oben Stufe 1, unten Stufe 2; links Treffer, rechts Niederlage. Die Trennlinie verläuft bei Sofa bei x = 611 und bei Chips bei x = 618 im transparenten Spalt. Die Muskelarme reichen über die rechnerische Mitte hinaus. Die Zeilentrennung liegt bei y = 627. `reaktionen.ts` begrenzt jeden Ausschnitt zusätzlich mit einem SVG-Clip.

Gestaltungsbrief: Identität, Palette, Konturen und Cel-Shading der vorhandenen Arcade-Cartoon-Figuren erhalten. Treffer von links: zusammengekniffene Augen, erschrockener Mund, zusammengedrückte Polster bzw. Verpackung und gelockerte Kissen/Chips. Niederlage: geschlossene Augen und herausgestreckte Zunge, abgesunkene Arme, verschobene Kissen und etwas sichtbare Füllung bzw. eine eingeknickte Tüte mit verstreuten Chips. Keine Umgebung, kein Schatten und keine Beschriftungen außerhalb der Figur. Die Referenzen waren `sofa1.png`/`sofa2.png` bzw. `chips1.png`/`chips2.png`.

Die Mini-App lädt den benötigten Atlas bereits während des Boss-Auftritts. Bis er geladen ist, bleibt die neutrale Figur sichtbar, damit auf langsamen Verbindungen kein leeres Bild entsteht. Ein fester HTTP-Endpunkt erlaubt ausschließlich die beiden bekannten Dateinamen mit Inhalts-Hash; Treffer- und K.O.-Pose teilen dieselbe langfristig gecachte Datei. Andere Bosse behalten ihre bisherigen Bilder und erhalten ebenfalls den neuen kurzen Auftritt.

SVGs mit eigener Trefferpose bewegen sich nach der kurzen Trefferpause zurück und wechseln anschließend zur neutralen Pose. Beim tatsächlichen Sieg bleibt die eigene K.O.-Pose sichtbar, ergänzt um Kissen/Füllung oder Chips als bewegte Teile. Überspringen und reduzierte Bewegung zeigen sofort den tatsächlichen Stand ohne Auftritt oder Partikel.

Lokale eigenständige Vorschau mit allen Bossen: `npm run build && node scripts/boss-vorschau.mjs /tmp/boss-vorschau.html`. Die Datei enthält die echten Kampf-/Auftrittsfunktionen, alle Bilder und Beispieldaten; sie benötigt keinen Telegram-Zugang.
