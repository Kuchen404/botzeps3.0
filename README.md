# Botzeps 3.0

Telegram-Bot für Fitness-Challenges in der Gruppe: Seasons, Punkte für Fleiß und Fortschritt, Wochenberichte im derben Ton.
Grundlage ist das Konzept „Botzeps neu“ (Stand 06.10.2026).

## Stand

Dieses Grundgerüst enthält:

- **Wertung** (`src/scoring/`) als reine, getestete Funktionen nach Konzept Kapitel 3: Fleiß (Minuten × Faktor, Wochenziel 300, Deckel 15, Serienbonus), Fortschritt (relative Fett- und Muskelmasse, Kalibrierwoche, 7-Tage-Mittel, Untergrenze −50), Gewichtung, Rangliste mit Tiebreak, „Fleiß der Woche“, Teams mit Team-Bonus.
- **Datenbank** (SQLite, `src/db/`) mit Migrationen und dem Datenmodell aus Kapitel 9.
- **Bot** (grammY, `src/bot/`): `/start` (privat anmelden, in der Gruppe mit „Ich bin dabei“-Knopf), `/sportarten`, `/hilfe`.
- **Sprüche** (`src/texte/sprueche.json`) mit Platzhaltern und Auswahl ohne direkte Wiederholung.
- **Docker** und Webhook-Betrieb mit `/health`-Endpunkt.

Als Nächstes: `/sport`, `/waage`, `/season`, `/stand`, `/rangliste`, Wochenbericht und Erinnerungen, danach Teams, Mini App.

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
  Aktuell   = Mittel der letzten 7 Tage (≥ 2 Messungen, sonst die letzten 2)
```

Rangliste: mehr Gesamtpunkte vorne, bei Gleichstand gewinnt mehr Fleiß.
