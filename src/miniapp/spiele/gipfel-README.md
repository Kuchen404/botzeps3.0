# Gipfelsturm

Eine gemeinsame illustrierte Bergübersicht zeigt alle Teilnehmer vom Basislager bis zur Gipfelplattform. Der gezeichnete Pfad wird über den Anteil am tatsächlichen Wochenziel parametrisiert. Figuren mit ähnlichem Fortschritt werden zur Übersicht räumlich verteilt; die Liste enthält die genauen Lastwerte, das Ziel und den Status. Große Gruppen bleiben vollständig auf demselben Berg sichtbar und verwenden kleinere Figuren.

Der Rückblick folgt den Trainingsstationen aus der API. Unterwegs werden die gemeinsamen Laufbilder verwendet, an der Felsroute eigene Vier-Phasen-Kletterzyklen für alle zwölf Avatare. Beim ersten Überqueren von 50 und 80 Prozent folgt eine kurze Nahaufnahme an der Felswand beziehungsweise im Schnee; die komplette Bergübersicht bleibt darunter sichtbar.

Nur ein gültiger `oben`-Zeitpunkt aus dem Serverstand bestätigt eine Gipfelankunft. Ein gerundeter Höhenwert oder ein Anteil von 100 Prozent allein genügt nicht. Bestätigte Ankünfte erhalten sofort während der Woche Fahne, Jubel und den Rang nach Ankunftszeit. Weitere Trainings nach dem Zieleinlauf erzeugen keinen zweiten Gipfelaufstieg. Beim Wochenabschluss folgt ein gemeinsames Panorama; ohne bestätigte Ankünfte bleibt der Gipfel unbesetzt. Es werden keine Punkte, Stürze oder Ausscheidungen erfunden.

Neue Stationen setzen den bereits gesehenen Rückblick fort. Veränderte Historie, gelöschte Trainings, veränderte Zielwerte oder Ankunftszeiten aktualisieren den Stand ruhig und nehmen nicht mehr gültige Fahnen zurück. Die aktuellen API-Daten bleiben maßgeblich. „Nochmal ansehen“ startet bewusst erneut am Basislager. Reine Abfrage-Zeitstempel lösen keine neue Wiedergabe aus.

Die Szene besitzt ihre Animationen und Timer selbst. Überspringen, Ansichtswechsel, Hintergrund, reduzierte Bewegung und geänderte Fensterbreite räumen sie vollständig auf. Eine ausschließlich geänderte Fensterhöhe unterbricht den Aufstieg nicht. Die statische Bergübersicht verteilt Figuren bei einer Breitenänderung erneut. Benötigte Bilder werden vor dem Rückblick geladen; bei Ausfällen bleiben die bisherigen Avatarbilder und die Grundkulisse verfügbar.

Die API ergänzt `ziel`, die Avatarbilder `laufen`/`steigen` und drei feste `bergBilder`-Medien. Alle Dateien werden über die vorhandene feste Medien-Allowlist mit Inhalts-Hash und langfristigem Cache ausgeliefert. `scripts/berg-optimieren.mjs` normalisiert und komprimiert die Bildquellen; die Rohdateien bleiben außerhalb des Repositories.

Vorschau: `npm run build` und `node scripts/gipfel-vorschau.mjs /tmp/gipfel.html`. Die eigenständige HTML-Datei enthält dieselbe Szenenlogik mit eingebetteten Figuren und Kulissen. Neun Beispiele decken laufende Expedition, Wochenabschluss, keine/alle Ankünfte, Korrektur, unbestätigte gerundete Gipfelhöhe, 80 Teilnehmer, Basislager und eine leere Gruppe ab.
