# Kopfgeldjagd

Die eigene Western-Bühne verwendet die Spieler-Avatare aus der bestehenden Mini-App-API. Ein Steckbrief stellt den Gejagten vor. Trainingsstationen werden in ihrer tatsächlichen Reihenfolge abgespielt: Anlauf, Verfolgung, Überholen mit Lasso und eine kurze Reaktion. Bei Gleichstand entzieht sich der Gejagte dem betroffenen Jäger. Andere Jäger können weiterhin davorliegen.

Die Bühne stellt den Vorsprung schematisch dar. Die Zahlen und die Balken darunter verwenden echte Wochenlast; alle Balken behalten während des Rückblicks dieselbe Skala. Die horizontal scrollbar bleibende Liste enthält jeden Jäger mit Namen, Last und Status. Der eigene Avatar wird hervorgehoben.

Erst `abgeschlossen` aus der API löst das Finale aus: Einfangen und Jubel der erfolgreichen Jäger oder eine letzte Flucht des Gejagten. Mehrere Jäger können kassieren. Auf der Bühne stehen höchstens zwei Sieger, bevorzugt der eigene berechtigte Spieler, ergänzt um die Zahl weiterer Sieger. Die Liste zeigt weiterhin alle. Die Münzen sind Dekoration und behaupten keinen konkreten Belohnungsbetrag.

Neue Stationen setzen den bereits gesehenen Rückblick fort. Geänderte Historie oder gelöschte Trainings aktualisieren den Stand ruhig. Zeitstempel allein lösen keine erneute Wiedergabe aus. „Nochmal ansehen“ spielt den vollständigen Verlauf bewusst erneut. Der aktuelle Stand und der Abschluss aus der API sind maßgeblich.

Überspringen, Ansichtswechsel, Hintergrund, geänderte Fensterbreite und reduzierte Bewegung beenden die eigenen Animationen und Timer und stellen den aktuellen Stand her. Änderungen ausschließlich an der Fensterhöhe unterbrechen die Jagd nicht. Ohne bekannten Gejagten werden weder ein Ersatzspieler noch ein erfundenes Finale erzeugt.

Nach `npm run build` erzeugt `node scripts/kopfgeld-vorschau.mjs /tmp/kopfgeld.html` eine eigenständig öffnende Vorschau mit eingebetteten Figuren und derselben Szenenlogik. Beispieldaten decken Rückblick, mehrere Sieger, Flucht, Gleichstand, Korrektur, Spielstart, 70 Jäger und eine leere Gruppe ab.
