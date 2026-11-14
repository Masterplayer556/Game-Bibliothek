# Sicherheit

Wie die App geschützt ist, was am 14.11.2026 geprüft wurde und welche Punkte bewusst offen bleiben.

## So ist die App geschützt

| Was | Schutz |
|---|---|
| Spieldaten | Login plus Row Level Security auf jeder Tabelle: nur eigene Zeilen, nur für die erlaubte E-Mail. Ohne Login ist nichts lesbar oder schreibbar. |
| Plattform-Tokens (PlayStation, Nintendo) | Verschlüsselt mit AES-256-GCM. Der Schlüssel liegt nur in den GitHub- und Edge-Function-Secrets, nicht in der Datenbank. Die Tabelle hat keine Regel: Der Browser kann sie auch mit Login nicht lesen. |
| Schlüssel (Steam, IGDB, Supabase, GitHub-Token) | Nur als GitHub-Secrets. Nichts davon steht im Repo oder im Browser-Code. |
| Edge Functions | Prüfen das Login-Token selbst, verlangen eine bestätigte, erlaubte E-Mail und geben in Fehlermeldungen nie Token-Inhalte zurück. |
| Öffentliche Logs (GitHub Actions) | Enthalten nur Zahlen und Zustände, keine Titel, IDs oder Tokens. |
| Workflows | Aktionen sind auf feste Versionen (Commit) festgelegt. Der Sync darf das Repo nur lesen. |

Öffentlich und ungefährlich sind die Projekt-Adresse und der «publishable key» in `.env.production`: Sie stehen in jedem Browser, der die Seite öffnet. Den Schutz machen Login und Row Level Security.

## Selbst prüfen

Workflow «Tools» → `check-rls` (oder `npm run check:rls`). Er fragt das echte Projekt von aussen ab, ohne Login, und erwartet:

- jede Tabelle: nicht lesbar, nicht schreibbar
- die Datenbank-Funktionen: nicht aufrufbar
- jede Edge Function: Antwort «nicht angemeldet»

## Prüfung vom 14.11.2026

Geprüft: Migrationen und der echte Zustand der Datenbank (Rechte, Regeln, Funktionen), alle vier Edge Functions, alle Workflows, die Verschlüsselung, der Browser-Code, das öffentliche Log des letzten Syncs, die Git-Historie auf Schlüssel, bekannte Lücken in den Paketen.

**Keine kritische Lücke gefunden.** Alle Tabellen sind gesperrt, die Tokens sind verschlüsselt, in der Historie und in den Logs steht nichts Geheimes, die Pakete der App haben keine bekannte Lücke.

Behoben (Härtung):

1. **Workflows:** Aktionen waren nur auf eine Hauptversion festgelegt («v5»), die der Herausgeber verschieben kann. Jetzt feste Commits; Dependabot schlägt einmal im Monat Aktualisierungen vor.
2. **Workflows:** Das Auschecken liess den Workflow-Token im Arbeitsordner liegen, im Sync sogar mit dem Recht, Workflows zu ändern. Der Token wird nicht mehr abgelegt; das Recht hat nur noch ein eigener kleiner Job, der keinen Projekt-Code ausführt.
3. **Workflows:** Der Supabase-Zugangstoken ist nur noch in den Schritten sichtbar, die ihn brauchen.
4. **IGDB:** Das Twitch-Secret stand in der Adresse der Anfrage. Jetzt im Inhalt der Anfrage, damit es in keinem Server-Log landet.
5. **Edge Functions:** Eine unbestätigte E-Mail gilt nicht mehr als Anmeldung. `trigger-sync` hinterlässt keinen hängenden Lauf mehr, wenn GitHub nicht erreichbar ist.
6. **Sync:** Eingaben des Workflows (Quelle, Lauf-ID) werden auf ihre Form geprüft, bevor sie verwendet oder ins Log geschrieben werden. Fehlertexte von IGDB werden wie bei den Plattformen von Secrets befreit.
7. **App:** Cover-Server (Steam, Sony, Nintendo, IGDB) erfahren nicht mehr, von welcher Seite ein Bild geladen wird. Der gespeicherte Nintendo-Login-Link wird nur verwendet, wenn er wirklich zu Nintendo zeigt.
8. **Texte:** Die App behauptete, die NPSSO werde nach dem ersten Sync gelöscht. Sie bleibt verschlüsselt gespeichert (seit Phase 6 nötig); der Text stimmt jetzt.

## Bewusst offen

- **Passwort-Prüfung gegen bekannte Leaks** ist im Supabase-Projekt aus. Die Einstellung gibt es nur im bezahlten Plan. Ausgleich: ein langes, nur hier verwendetes Passwort.
- **`is_allowed_user()`** meldet Supabase als Warnung (Funktion mit erhöhten Rechten, von angemeldeten Nutzern aufrufbar). Das ist nötig und harmlos: Sie beantwortet nur «Ist die eigene E-Mail erlaubt?».
- **Geteiltes Supabase-Projekt:** Der geheime Schlüssel im GitHub-Secret hat auch Zugriff auf die Tabellen der Kalender-App. Der Code von Game Bibliothek spricht nur das Schema `game_bibliothek` an.
- **Gleiche Herkunft auf GitHub Pages:** Alle Seiten unter `masterplayer556.github.io` teilen sich den Browser-Speicher, also auch die Anmeldung dieser App. Dort darum keinen fremden Code veröffentlichen.
- **CORS der Edge Functions ist offen (`*`).** Der Zugriff hängt am Login-Token im Header, den eine fremde Seite nicht mitschicken kann, nicht an Cookies.
- **Keine Content Security Policy.** GitHub Pages kann keine Header setzen, und der Bild-Export des Rückblicks lädt Cover von mehreren Servern. Die App baut nirgends HTML aus Daten zusammen.
- **Entwicklungs-Pakete:** `npm audit` meldet Lücken mittlerer Stufe in ESLint-Abhängigkeiten. Sie laufen nur beim Prüfen des Codes, nicht in der App und nicht im Sync.
- **Inoffizielle Schnittstellen** (PlayStation, Nintendo): Die Tokens erlauben mehr als nur Lesen. Sie sind verschlüsselt, aber wer GitHub-Konto und Datenbank zugleich übernimmt, kann sie nutzen. Ausgleich: Zwei-Faktor-Anmeldung bei GitHub und Supabase.

## Wenn ein Schlüssel bekannt wird

| Schlüssel | Was tun |
|---|---|
| `SUPABASE_SECRET_KEY` | In Supabase einen neuen «Secret key» erzeugen, den alten löschen, GitHub-Secret ersetzen. |
| `CREDENTIALS_ENCRYPTION_KEY` | Neuen Schlüssel in der App erzeugen, GitHub-Secret ersetzen, «Edge Functions deployen» starten, PlayStation und Nintendo in der App neu anmelden. |
| `DISPATCH_TOKEN`, `SUPABASE_ACCESS_TOKEN` | Bei GitHub bzw. Supabase widerrufen, neu anlegen, Secret ersetzen. |
| `STEAM_API_KEY`, IGDB-Secret | Beim Anbieter neu erzeugen, Secret ersetzen (IGDB: danach «Edge Functions deployen»). |
| NPSSO / Nintendo-Anmeldung | Beim Anbieter abmelden bzw. Passwort ändern, in der App neu anmelden. |
