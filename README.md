# Botzeps 3.0

Telegram-Bot für Fitness-Challenges in der Gruppe: Seasons, Punkte für Fleiß und Fortschritt, Wochenberichte im derben Ton.
Grundlage ist das Konzept „Botzeps neu“ (Stand 06.10.2026).

## Stand

Dieses Grundgerüst enthält:

- **Wertung** (`src/scoring/`) als reine, getestete Funktionen nach Konzept Kapitel 3: Fleiß (Minuten × Faktor, Wochenziel 300, Deckel 15, Serienbonus), Fortschritt (relative Fett- und Muskelmasse, Kalibrierwoche, 7-Tage-Mittel, Untergrenze −50), Gewichtung, Rangliste mit Tiebreak, „Fleiß der Woche“, Teams mit Team-Bonus.
- **Datenbank** (SQLite, `src/db/`) mit Migrationen und dem Datenmodell aus Kapitel 9.
- **Bot** (grammY, `src/bot/`): `/start` (privat anmelden, in der Gruppe mit „Ich bin dabei“-Knopf), `/sportarten`, `/hilfe`.
- **Training** mit `/sport 45 Joggen` oder `/sport` mit Knöpfen (eigene letzte Sportarten zuerst), optional `gestern`/`vorgestern`. Jedes Training wird in der Gruppe gepostet.
- **Neue Sportarten** per `/sportart Name` oder Knopf bei unbekannter Sportart: die Gruppe stimmt über die Stufe ab (Vorschlag laut Compendium), Mehrheit der Mitglieder oder nach 24 Stunden entscheidet; das wartende Training wird danach automatisch eingetragen.
- **Messung** mit `/waage 82,4 18,5 41,2` nur im privaten Chat, mit Plausibilitätsprüfung und Rückfrage bei Sprüngen (> 3 kg oder > 3 Prozentpunkte Fett gegenüber dem 7-Tage-Mittel).
- **Season** mit `/season Name` in der Gruppe: startet am nächsten Montag mit 10 Wochen und 50/50, alle Mitglieder sind dabei. Start, Dauer und Gewichtung lassen sich bis zum Start per Knopf ändern (Ersteller und Gruppenadmins). Wer später dazukommt, macht seine eigene Kalibrierwoche.
- **Stand** mit `/rangliste` (Punkte, Wochenziel ✅, Serie 🔥, „Fleiß der Woche“, Sprüche) und `/stand` (in der Gruppe nur Punkte, privat mit Fett- und Muskelmasse), danach der eigene Punkteverlauf als Diagramm (Gesamt, Fleiß, Fortschritt).
- **Korrigieren** mit `/verlauf` (privat): letzte Einträge als Knöpfe, Trainingsdauer ändern oder Training/Messung löschen. Nur bis 2 Tage zurück, alles wird protokolliert, der Gruppenpost wird angepasst bzw. gelöscht.
- **Wochenbericht** jeden Sonntag um 20 Uhr (Ende jeder Season-Woche) in der Gruppe: Rangliste mit ⬆/⬇ zur Vorwoche, Wochenziel, Serien, Fleiß der Woche, ein Spruch pro Person (nie zweimal hintereinander derselbe), dazu der Punkteverlauf aller Teilnehmer als Diagramm (beliebig viele). Am Ende das **Finale** mit Sonderpreisen und Rückblick.
- **Erinnerungen** privat zur eigenen Uhrzeit (Standard 19:00): in der Kalibrierwoche, nach 3 Tagen ohne Training, nach 4 Tagen ohne Messung. `/erinnerungen an|aus|18:30`.
- **Zeitplan** als Termine in der Datenbank: jeder Termin läuft genau einmal, verpasste Berichte werden nach einem Neustart nachgeholt, Erinnerungen nur bis 2 Stunden zu spät.
- **Sprüche** (`src/texte/sprueche.json`) mit Platzhaltern und Auswahl ohne direkte Wiederholung.
- **Docker** und Webhook-Betrieb mit `/health`-Endpunkt.

Als Nächstes: Teams, Mini App.

## Lokal starten

Voraussetzung: Node.js 22.

```bash
npm install
cp .env.example .env   # BOT_TOKEN eintragen
npm run dev            # Polling-Modus, startet bei Änderungen neu
npm test               # Unit-Tests
```

## Betrieb mit Docker

```bash
cp .env.example .env   # BOT_TOKEN, BOT_MODE=webhook, WEBHOOK_URL, WEBHOOK_SECRET setzen
docker compose up -d --build
```

- Die Datenbank liegt im Volume `botzeps-daten` unter `/data/botzeps.db`.
- Der Container hört auf Port 3000 (nur `127.0.0.1`). Für den Webhook braucht Telegram HTTPS: einen Reverse Proxy (z. B. Caddy, Traefik, nginx) davor setzen, der `https://<WEBHOOK_URL>/telegram` an den Container weiterreicht.
- Ohne öffentliche Adresse geht auch `BOT_MODE=polling`; dann ist kein Reverse Proxy nötig.
- Backup: `docker compose exec botzeps node -e "require('better-sqlite3')('/data/botzeps.db').backup('/data/backup.db')"` oder das Volume sichern.

**Der Bot-Token gehört nie ins Repo.** Er steht nur in `.env`, die von Git ignoriert wird.

## Wertung in Kürze

```
Gesamt = Fleiß × (Gewicht Fleiß / 50) + Fortschritt × (Gewicht Fortschritt / 50)      (Standard 50/50 → 1 : 1)

Fleiß pro Woche = 10 × min(Last / 300, 1,5) + Serienbonus
  Last = Σ min(Minuten, 120) × Faktor (leicht 1, mittel 2, intensiv 3), pro Tag die 2 stärksten Einheiten
  Serienbonus: 3. Woche in Folge mit Ziel +1, 4. Woche +2, ab 5. Woche +3

Fortschritt = 10 × Fettabbau % + 30 × Muskelaufbau %   (mindestens −50)
  Startwert = Mittel aus ≥ 3 Messungen der Kalibrierwoche
  Aktuell   = Mittel der letzten 7 Tage nach der Kalibrierung (≥ 2 Messungen, sonst die letzten 2)
```

Rangliste: mehr Gesamtpunkte vorne, bei Gleichstand gewinnt mehr Fleiß.
