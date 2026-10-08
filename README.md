# Botzeps 3.0

Telegram-Bot für Fitness-Challenges in der Gruppe: Seasons, Punkte für Fleiß und Fortschritt, Wochenberichte im derben Ton.
Grundlage ist das Konzept „Botzeps neu“ (Stand 06.10.2026).

## Stand

Dieses Grundgerüst enthält:

- **Wertung** (`src/scoring/`) als reine, getestete Funktionen nach Konzept Kapitel 3: Fleiß (Minuten × Faktor, Wochenziel 300, Deckel 15, Serienbonus), Fortschritt (relative Fett- und Muskelmasse, Kalibrierwoche, 7-Tage-Mittel, Untergrenze −50), Gewichtung, Rangliste mit Tiebreak, „Fleiß der Woche“, Teams mit Team-Bonus.
- **Datenbank** (SQLite, `src/db/`) mit Migrationen und dem Datenmodell aus Kapitel 9.
- **Bot** (grammY, `src/bot/`): `/start` (privat anmelden, in der Gruppe mit „Ich bin dabei“-Knopf), `/sportarten`, `/einfuehrung` (Fleiß und Fortschritt kurz erklärt, kommt auch beim Anlegen einer Season), `/hilfe`.
- **Training** mit `/sport 45 Joggen` oder `/sport` mit Knöpfen (eigene letzte Sportarten zuerst), optional `gestern`/`vorgestern`. Jedes Training wird in der Gruppe gepostet.
- **Neue Sportarten** per `/sportart Name` oder Knopf bei unbekannter Sportart: die Gruppe stimmt über die Stufe ab (Vorschlag laut Compendium), Mehrheit der Mitglieder oder nach 24 Stunden entscheidet; das wartende Training wird danach automatisch eingetragen.
- **Messung** mit `/waage 82,4 18,5 41,2` nur im privaten Chat, mit Plausibilitätsprüfung und Rückfrage bei Sprüngen (> 3 kg oder > 3 Prozentpunkte Fett gegenüber dem 7-Tage-Mittel).
- **Season** mit `/season Name` in der Gruppe: startet am nächsten Montag mit 10 Wochen und 50/50, alle Mitglieder sind dabei. Start, Dauer und Gewichtung lassen sich bis zum Start per Knopf ändern (Ersteller und Gruppenadmins). Wer später dazukommt, macht seine eigene Kalibrierwoche.
- **Stand** mit `/rangliste` (Punkte, Wochenziel ✅, Serie 🔥, „Fleiß der Woche“, Sprüche) und `/stand` (in der Gruppe nur Punkte, privat mit Fett- und Muskelmasse), danach der eigene Punkteverlauf als Diagramm (Gesamt, Fleiß, Fortschritt).
- **Korrigieren** mit `/verlauf` (privat): letzte Einträge als Knöpfe, Trainingsdauer ändern oder Training/Messung löschen. Nur bis 2 Tage zurück, alles wird protokolliert, der Gruppenpost wird angepasst bzw. gelöscht.
- **Teams** (optional): vor dem Start mit `/teams` auslosen (Ersteller oder Admins, 2 bis 4 Teams, ausbalanciert nach der letzten Season) oder mit `/team Name` selbst gründen und beitreten; Nachzügler kommen ins kleinste Team. Teampunkte = Schnitt der Mitglieder mit Startwert, +3 pro Woche, in der alle ihr Ziel schaffen. Teamwertung in `/rangliste`, `/teams`, Wochenbericht und Finale.
- **Wochenbericht** jeden Sonntag um 20 Uhr (Ende jeder Season-Woche) in der Gruppe: Rangliste mit ⬆/⬇ zur Vorwoche, Wochenziel, Serien, Fleiß der Woche, ein Spruch pro Person (nie zweimal hintereinander derselbe), dazu der Punkteverlauf aller Teilnehmer als Diagramm (beliebig viele). Am Ende das **Finale** mit Sonderpreisen und Rückblick.
- **Rote Laterne** 🏮: Wer in der Woche die niedrigste Last hat, bekommt im Wochenbericht den Schandtitel samt derbem Spruch und trägt 🏮 bis zum nächsten Bericht in `/rangliste`, `/stand` und der Mini App. Zählt nur, wer die ganze Woche dabei war; haben alle gleich viel, gibt's keine. Zähler pro Season, im Finale wird der „Laternenkönig“ gekürt.
- **Hype-Woche** mit `/hype` in der Gruppe (nur Admins): sieben Tage Vorfreude ohne Datum und ohne die Bosse oder Minispiele zu verraten. Tag 1 sofort mit Trailer-Video, danach jeden Abend um 19 Uhr ein Beitrag (Regel-Plakat, Fahndungsplakat, Laternen-Umfrage mit den Namen der Gruppe, Minispiel-Andeutungen, Waage-Hausaufgabe). Der letzte nennt Kalibrierwoche und Start, wenn schon eine Season ansteht, sonst ruft er nach `/season`. `/hype` zeigt den nächsten Tag, `/hype stop` bricht ab. Verpasste Abende verfallen nach 12 Stunden. Die Medien liegen in `src/hype/medien/`.
- **Erinnerungen** privat zur eigenen Uhrzeit (Standard 19:00): in der Kalibrierwoche, nach 3 Tagen ohne Training, nach 4 Tagen ohne Messung. `/erinnerungen an|aus|18:30`.
- **Zeitplan** als Termine in der Datenbank: jeder Termin läuft genau einmal, verpasste Berichte werden nach einem Neustart nachgeholt, Erinnerungen nur bis 2 Stunden zu spät.
- **Sprüche** (`src/texte/sprueche.json`) mit Platzhaltern und Auswahl ohne direkte Wiederholung.
- **Mini App** (`src/miniapp/`) unter `/app`, geöffnet über den Menüknopf „📊 Botzeps-App“ im privaten Chat, `/app` oder den App-Knopf unter Begrüßung, `/stand`, `/rangliste` und dem Wochenbericht (auch in der Gruppe; dort öffnet er die App direkt mit der Season dieser Gruppe, wenn beim BotFather eine Haupt-Mini-App eingerichtet ist, sonst führt er in den Privatchat): Stand mit interaktivem Punkteverlauf, Rangliste und Teams, eigene Waagenwerte als Diagramm, im Reiter „Eintragen“ Training (Sportart, Dauer, Tag antippen; wird wie bei `/sport` in der Gruppe gepostet) und Waage (drei Felder, gleiche Prüfung und Rückfrage wie `/waage`) per Formular eintragen, Einträge ändern und löschen, Erinnerungen einstellen, im Reiter „Ruhm“ der eigene Rang mit Fortschrittsbalken, alle Erfolge und die Ruhmeshalle der Gruppe. Anmeldung automatisch über die signierten Telegram-initData, keine PIN.
- **Docker** und Webhook-Betrieb mit `/health`-Endpunkt.
- **Tägliches Backup** der Datenbank mit Prüfung, die letzten 30 werden aufgehoben, optional zusätzlich als Datei per Telegram (siehe „Backup und Wiederherstellen“).

## Lokal starten

Voraussetzung: Node.js 22.

```bash
npm install
cp .env.example .env   # BOT_TOKEN eintragen
npm run dev            # Polling-Modus, startet bei Änderungen neu
npm test               # Unit-Tests
```

## Demo-Modus: alles in ein paar Minuten ansehen

Statt 10 Wochen mit mehreren Leuten zu testen: ein eigener Test-Bot mit Fake-Teilnehmern und einer Uhr, die man vorspulen kann.

1. Bei @BotFather mit `/newbot` einen zweiten Bot anlegen (z. B. `botzeps_test_bot`), Token kopieren.
2. Eine Telegram-Gruppe nur für den Test anlegen und den Test-Bot hinzufügen. Den Test-Bot einmal privat mit `/start` anschreiben (für `/waage` und Erinnerungen).
3. Starten, entweder auf dem Server neben dem echten Bot:
   ```bash
   # in .env zusätzlich: DEMO_BOT_TOKEN=<Token des Test-Bots>
   docker compose --profile demo up -d --build botzeps-demo
   docker compose logs -f botzeps-demo   # beenden: docker compose stop botzeps-demo
   ```
   oder lokal mit Node.js 22: `.env` mit dem Test-Token, `DEMO_MODUS=1` und `DATABASE_PATH=./data/demo.db`, dann `npm run dev`.
4. In der Testgruppe:
   - `/demo` (oder `/demo 10` für 10 Wochen, Standard 6): legt eine Season ab nächstem Montag an, mit dir und fünf Fake-Leuten (Streber, Sofakönig, Muskelprotz, …). Du läufst auf Autopilot mit, damit dein eigener Stand nicht leer ist.
   - `/vorspulen`: springt zum nächsten Ereignis (Wochenbericht, Boss-Ankündigung, Finale) und löst es sofort aus. Die Fake-Leute trainieren und wiegen sich in der übersprungenen Zeit von selbst.
   - `/vorspulen 3` springt 3 Tage, `/vorspulen ende` bis nach dem Finale.
   - Dazwischen funktioniert alles wie im Ernstfall: `/sport`, `/waage` (privat), `/stand`, `/rangliste`, `/teams` (vor dem ersten Sprung), `/erfolge`, `/ruhmeshalle`. Einträge zählen für den vorgespulten Tag.
   - `/autopilot aus`, wenn du lieber selbst einträgst. `/demo` fängt komplett von vorne an.

Die Mini App braucht HTTPS. Für den Test-Bot geht sie nur, wenn der Reverse Proxy eine eigene Adresse (z. B. `https://demo.example.de`) mit `/app` und `/api/` auf Port 3001 weiterreicht und `DEMO_MINIAPP_URL=https://demo.example.de/app` gesetzt ist.

**Wichtig:** Der Demo-Modus ist nur mit `DEMO_MODUS=1` aktiv. `/demo` löscht in der Gruppe alle Seasons und die Einträge aller Mitglieder, und die Uhr gilt für den ganzen Bot. Deshalb nie mit dem echten Bot-Token oder der echten Datenbank benutzen.

## Betrieb mit Docker

```bash
cp .env.example .env   # BOT_TOKEN, BOT_MODE=webhook, WEBHOOK_URL, WEBHOOK_SECRET setzen
docker compose up -d --build
```

- Die Datenbank liegt im Volume `botzeps-daten` unter `/data/botzeps.db`.
- Der Container hört auf Port 3000 (nur `127.0.0.1`). Für den Webhook braucht Telegram HTTPS: einen Reverse Proxy (z. B. Caddy, Traefik, nginx) davor setzen, der `https://<WEBHOOK_URL>/telegram` an den Container weiterreicht.
- Die Mini App liegt unter `https://<WEBHOOK_URL>/app` und spricht mit `/api/…`; der Reverse Proxy muss diese Pfade ebenfalls weiterreichen. Eine andere Adresse geht über `MINIAPP_URL`. Beim Start setzt der Bot den Menüknopf „📊 Botzeps-App“. Damit der App-Knopf in Gruppen die App direkt öffnet und der Bot im Chatverlauf und Profil einen „Öffnen“-Knopf bekommt, beim BotFather einmal `/mybots` → Bot → *Bot Settings* → *Configure Mini App* → *Enable Mini App* mit derselben URL einstellen (je Bot, also auch beim Test-Bot).
- Ohne öffentliche Adresse geht auch `BOT_MODE=polling`; dann ist kein Reverse Proxy nötig, aber auch keine Mini App (Telegram verlangt HTTPS).
- Backups: siehe unten.

### Automatisches Deployment

Nach jedem grünen CI-Lauf auf `main` baut die Action `Deploy` das Image, pusht es als `ghcr.io/kuchen404/botzeps3.0:latest` (und `:sha-<commit>`) nach GHCR und ruft die Portainer-Webhooks auf. Portainer zieht dann das neue Image und startet den Stack neu. GitHub braucht keinen Zugang zum Server; die einzigen Secrets sind die Webhook-URLs. Von Hand auslösen geht unter Actions → Deploy → „Run workflow“.

Es gibt zwei Portainer-Stacks; `docker-compose.yml` bleibt für die lokale Entwicklung.

| Stack | Compose-Pfad | Port | Variablen in Portainer | Webhook-Secret |
|---|---|---|---|---|
| `botzeps` (echter Bot, Webhook) | `deploy/compose.prod.yml` | `127.0.0.1:3002` | `BOT_TOKEN`, `WEBHOOK_SECRET`, optional `BACKUP_CHAT_ID` | `PORTAINER_WEBHOOK_PROD` |
| `botzeps-demo` (Test-Bot, Polling) | `deploy/compose.demo.yml` | `127.0.0.1:3001` | `DEMO_BOT_TOKEN`, `DEMO_MINIAPP_URL` | `PORTAINER_WEBHOOK_DEMO` |

Beim echten Bot ist `WEBHOOK_URL` fest auf `https://botzeps.uklmuckl.com` gesetzt; die Mini App liegt automatisch unter `/app`. Der Reverse Proxy muss `/telegram`, `/app` und `/api/` an Port 3002 weiterreichen. `WEBHOOK_SECRET` ist ein frei gewählter langer Zufallswert (z. B. `openssl rand -hex 32`).

Einmalig einrichten (erst, nachdem der erste Deploy-Lauf auf `main` das Image veröffentlicht hat):

1. In GitHub unter Packages → `botzeps3.0` prüfen, dass das Paket privat und mit dem Repo verknüpft ist.
2. Einen **Classic PAT** nur mit `read:packages` anlegen (fine-grained PATs gehen für GHCR nicht). In Portainer unter Registries → Add registry → Custom eintragen: URL `ghcr.io`, Benutzer `Kuchen404`, Passwort = PAT.
3. Einen **fine-grained PAT** nur für dieses Repo mit *Contents: read* anlegen (für das Git-Repo im Stack).
4. Alte Container stoppen, die denselben Port belegen oder mit demselben Token laufen.
5. Je Stack in Portainer unter Stacks → Add stack → Repository: Name und Compose-Pfad laut Tabelle, URL `https://github.com/Kuchen404/botzeps3.0`, Referenz `refs/heads/main`, Authentifizierung mit dem PAT aus Schritt 3. *GitOps updates* an, Mechanismus *Webhook*, *Re-pull image* an; die Webhook-URL kopieren. Die Variablen aus der Tabelle setzen, dann deployen.
6. In GitHub unter Settings → Secrets and variables → Actions das passende Webhook-Secret mit der Webhook-URL anlegen.
7. „Deploy“ einmal von Hand starten und prüfen, dass Portainer den Stack neu startet.

Fehlt ein Webhook-Secret, überspringt die Action diesen Stack mit einem Hinweis.

### Backup und Wiederherstellen

Der Bot sichert die Datenbank jeden Tag ab 4 Uhr (`BACKUP_UHRZEIT`) nach `/data/backups/botzeps-JJJJ-MM-TT.db` und behält die letzten 30 (`BACKUP_BEHALTEN`, `0` schaltet es ab). Jede Sicherung wird vorher auf Fehler geprüft; ein verpasstes Backup holt er nach dem Start nach.

Weil die Sicherungen im selben Volume liegen, helfen sie nicht, wenn die Platte stirbt. Dafür `BACKUP_CHAT_ID` setzen: dann schickt der Bot jede Sicherung zusätzlich still als Datei in diesen Telegram-Chat, z. B. in deinen privaten Chat mit dem Bot (deine ID verrät dir z. B. @userinfobot; du musst den Bot vorher einmal mit `/start` angeschrieben haben).

Sicherungen ansehen und eine zurückspielen:

```bash
docker compose exec botzeps ls -l /data/backups
docker compose stop botzeps
docker compose run --rm --no-deps botzeps sh -c \
  "cp /data/botzeps.db /data/vor-wiederherstellung.db; rm -f /data/botzeps.db-wal /data/botzeps.db-shm; cp /data/backups/botzeps-2026-10-05.db /data/botzeps.db"
docker compose start botzeps
```

Eine Sicherung aus Telegram zurückspielen: die Datei auf den Server laden, mit `docker compose cp botzeps-2026-10-05.db botzeps:/data/backups/` in den Container kopieren, dann wie oben.

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
