# Treffer- und Niederlagenposen: alle sieben Bosse

Mit dem eingebauten ImageGen-Werkzeug am 08.11.2026 aus den jeweiligen bestehenden Stufe-1-/Stufe-2-Illustrationen erstellt. Sofa und Chipstüte verwenden zwei separate Referenz-PNGs, die übrigen Bosse die bestehenden Doppelbilder. Die neutralen Originale bleiben erhalten. Die sieben transparenten RGBA-Atlanten sind 1254 × 1254 Pixel groß.

Layout: oben Stufe 1, unten Stufe 2; links Treffer, rechts Niederlage. Die Trennlinie verläuft bei Sofa bei x = 611 bei Chips bei x = 618 und beim Schweinehund bei x = 616 im transparenten Spalt. Die Muskelarme reichen über die rechnerische Mitte hinaus. Die anderen Atlanten werden mittig bei x = 627 getrennt. Die Zeilentrennung liegt bei y = 627. `reaktionen.ts` begrenzt jeden Ausschnitt zusätzlich mit einem SVG-Clip.

Gestaltungsbrief: Identität, Palette, Konturen und Cel-Shading der vorhandenen Arcade-Cartoon-Figuren erhalten. Treffer: zusammengekniffene Augen, erschrockener Mund und körperliche Reaktion mit gelockerten Gegenständen. Niederlage: geschlossene Augen und herausgestreckte Zunge, zusammengesunkene Haltung und abgesunkene Arme. Beim Sofa verrutschen Kissen und Füllung, die Chipstüte knickt ein; die übrigen Bosse behalten ihre charakteristischen Accessoires und Muskelvarianten. Keine Umgebung, kein Schatten und keine Beschriftungen außerhalb der Figur. Referenzen: `sofa1.png`/`sofa2.png`, `chips1.png`/`chips2.png` und die Doppelbilder `schweinehund.png`, `doenerteller.png`, `bierbauch.png`, `lieferdienst.png`, `gemuetlich.png`.

Die Mini-App lädt den benötigten Atlas bereits während des Boss-Auftritts. Bis er geladen ist, bleibt die neutrale Figur sichtbar, damit auf langsamen Verbindungen kein leeres Bild entsteht. Ein fester HTTP-Endpunkt erlaubt ausschließlich die sieben bekannten Motive und Dateinamen mit Inhalts-Hash; Treffer- und K.O.-Pose teilen dieselbe langfristig gecachte Datei. Alle sieben Bosse besitzen eigene Treffer- und K.O.-Posen in beiden Stufen. Ältere, unbekannte Namen behalten die bisherige Ersatzdarstellung.

SVGs mit eigener Trefferpose bewegen sich nach der kurzen Trefferpause zurück und wechseln anschließend zur neutralen Pose. Beim tatsächlichen Sieg bleibt die eigene K.O.-Pose sichtbar, ergänzt um passende bewegte Teile: Kissen/Füllung, Chips, Speichel-/Staubtropfen beim Schweinehund, Salat/Tomate/Pommes/Kraut beim Dönerteller, Schaum/Hopfen beim Bierbauch, Kartons/Zettel/Tüten beim Lieferdienst und Gold-/Fellpartikel bei Graf Gemütlich. Überspringen und reduzierte Bewegung zeigen sofort den tatsächlichen Stand ohne Auftritt oder Partikel.

Lokale eigenständige Vorschau mit allen Bossen: `npm run build && node scripts/boss-vorschau.mjs /tmp/boss-vorschau.html`. Die Datei enthält die echten Kampf-/Auftrittsfunktionen, alle Bilder und Beispieldaten; sie benötigt keinen Telegram-Zugang.

Die vollständigen Generation-Prompts für die fünf ergänzten Motive stehen in `weitere-reaktionen-prompts.json`.
