# IGDB verbinden (Cover und Genres)

[IGDB](https://www.igdb.com) ist eine Spiele-Datenbank von Twitch. Die App holt dort Cover, Genres und das Erscheinungsjahr und erkennt darüber, wenn dasselbe Spiel auf mehreren Plattformen unterschiedlich heisst (z. B. «Kirby und das vergessene Land» und «Kirby and the Forgotten Land»). IGDB ist kostenlos. Ohne IGDB läuft die App normal weiter, nur ohne Genres und mit den Covern der Plattformen.

## 1. Twitch-App anlegen

1. Auf <https://dev.twitch.tv/console> mit einem Twitch-Konto anmelden. Die **Zwei-Faktor-Authentifizierung** muss im Twitch-Konto aktiv sein (Einstellungen → Sicherheit und Datenschutz).
2. «Applications» → **«Register Your Application»**:
   - Name: z. B. `Game Bibliothek Marcel` (muss bei Twitch eindeutig sein)
   - OAuth Redirect URLs: `http://localhost`
   - Category: **Application Integration**
   - Client Type: **Confidential**
3. «Create», dann bei der App auf «Manage».
4. Die **Client-ID** kopieren.
5. **«New Secret»** drücken und das Secret kopieren. Es wird nur einmal angezeigt.

## 2. Secrets eintragen

Unter <https://github.com/Masterplayer556/Game-Bibliothek/settings/secrets/actions> → «New repository secret»:

| Name | Wert |
|---|---|
| `IGDB_CLIENT_ID` | die Client-ID |
| `IGDB_CLIENT_SECRET` | das Secret |

## 3. Suche in der App einschalten

Die Suche in der App («Anderes Spiel wählen», «Auf IGDB suchen» beim Hinzufügen) läuft über eine Edge Function, die die Secrets auch braucht:

<https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/functions.yml> → «Run workflow».

## 4. Testen und synchronisieren

<https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/sync.yml> → «Run workflow»:

- Modus `test`, Adapter `igdb`: prüft nur die Verbindung. Unter Plattformen steht danach bei IGDB «Verbunden».
- Modus `sync`: ergänzt Cover, Genres und Jahr. Pro Lauf werden bis zu 200 Titel nachgeschlagen, der Rest folgt in den nächsten automatischen Syncs.

## Wie die Zuordnung funktioniert

- Jeder Titel wird einmal nachgeschlagen und das Ergebnis gespeichert. Titel ohne Treffer werden nach 30 Tagen noch einmal versucht.
- Ein Treffer zählt, wenn der Titel (oder ein alternativer Titel, z. B. der deutsche) genau passt oder sehr ähnlich ist. Bei mehreren gleich guten Treffern gewinnt der für die richtige Konsole.
- Haben zwei Spiele denselben IGDB-Eintrag, werden sie zu einem zusammengeführt. Von Hand abgetrennte Einträge bleiben getrennt.
- **Falsche Zuordnung?** Im Spiel-Detail unter «Cover und Genres (IGDB)» → «Anderes Spiel wählen» oder «Zuordnung entfernen». Eine Korrektur von Hand ändert der Sync nie wieder.
- Genres kommen auf Deutsch (z. B. «Rollenspiel», «Jump 'n' Run»).
