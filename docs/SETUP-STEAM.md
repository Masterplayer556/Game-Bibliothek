# Steam verbinden

Steam hat eine offizielle Schnittstelle. Du brauchst zwei Werte: deinen **API-Key** und deine **Steam-ID**. Beide kommen als GitHub-Secrets ins Repo; in der App gibst du nichts ein.

## 1. API-Key holen

1. Öffne <https://steamcommunity.com/dev/apikey> und melde dich mit deinem Steam-Konto an.
2. Bei «Domain Name» die Adresse der App eintragen: `masterplayer556.github.io`
3. Den Bedingungen zustimmen und «Register» drücken.
4. Den angezeigten Key (32 Zeichen) kopieren.

Voraussetzungen von Steam: Das Konto braucht den **Steam Guard Mobile Authenticator** (Steam-App auf dem Handy), und es darf kein eingeschränktes Konto sein (es muss schon einmal mindestens 5 USD im Steam-Shop ausgegeben worden sein).

Der Key ist wie ein Passwort: nicht teilen, nicht in einen Chat kopieren.

## 2. Steam-ID herausfinden

Öffne in Steam dein Profil und kopiere den Link (Profil → Rechtsklick bzw. «Teilen» → «Link kopieren»).

- Steht dort `steamcommunity.com/profiles/7656…`, ist die 17-stellige Zahl deine Steam-ID.
- Steht dort `steamcommunity.com/id/deinname`, kannst du einfach `deinname` oder den ganzen Link verwenden. Die App fragt Steam selbst nach der Zahl.

## 3. Privatsphäre einstellen

Steam-Profil → «Profil bearbeiten» → «Privatsphäre-Einstellungen»:

- **Spieldetails** auf **Öffentlich** stellen.
- «Gesamtspielzeit immer privat halten» **nicht** ankreuzen.

Mit dem eigenen Key klappt es teilweise auch privat. Öffentlich ist aber zuverlässiger; ist es privat, meldet die App «Steam liefert keine Spiele».

## 4. Secrets eintragen

Öffne <https://github.com/Masterplayer556/Game-Bibliothek/settings/secrets/actions> → «New repository secret»:

| Name | Wert |
|---|---|
| `STEAM_API_KEY` | der Key aus Schritt 1 |
| `STEAM_ID` | die Zahl, der Profilname oder der Profil-Link aus Schritt 2 |

## 5. Testen und synchronisieren

1. Öffne <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/sync.yml> → «Run workflow».
   - Modus `test`, Adapter `steam`: prüft nur die Verbindung. Die Plattformen-Seite zeigt danach z. B. «312 Spiele gefunden, davon 87 gespielt».
   - Modus `sync`, Adapter leer: holt alle Daten.
2. Der erste Sync liest die Erfolge aller gespielten Spiele und kann ein paar Minuten dauern. Bei sehr vielen Spielen kommen die Erfolge in Etappen über die nächsten automatischen Syncs.

Danach läuft alles automatisch alle 6 Stunden.

## Was die App von Steam holt

- Alle Spiele im Besitz, auch kostenlose, die du gespielt hast.
- Gesamtspielzeit und «zuletzt gespielt» pro Spiel. Steam kennt keine Spielzeit pro Tag: Die App merkt sich die Gesamtzeit bei jedem Sync und berechnet daraus, wann du wie viel gespielt hast. Die Zeit vor dem ersten Sync zählt zur Gesamtzeit, aber zu keinem bestimmten Tag.
- Erfolge mit Namen, Beschreibung, Freischalt-Datum und Seltenheit. Um Steam nicht zu überlasten, werden sie nur neu gelesen, wenn sich die Spielzeit eines Spiels geändert hat.
- Cover-Bilder direkt von Steam.
