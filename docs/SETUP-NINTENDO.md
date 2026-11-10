# Nintendo verbinden

Nintendo hat keine offizielle Schnittstelle und keine Erfolge. Die App holt die Spielzeit auf zwei Wegen:

- **Weg A, automatisch:** über die Jugendschutz-App. Sie liefert die Spielzeit pro Tag und Spiel, aber erst ab dem Tag, an dem die Konsole verknüpft wurde.
- **Weg B, einmalig von Hand:** die ältere Historie aus der Nintendo-Store-App, als CSV-Datei.

Beide Wege ergänzen sich. Hat die Jugendschutz-App für ein Spiel und einen Tag Daten, zählt der importierte Wert für diesen Tag nicht. Es wird nie doppelt gezählt.

Der Weg ist inoffiziell. Nintendo kann ihn jederzeit ändern. Nutzung auf eigene Verantwortung.

---

## Weg A: Jugendschutz-App (empfohlen)

### 1. Konsole verknüpfen

1. App **«Nintendo Switch Parental Controls»** aufs Handy laden und mit deinem Nintendo-Account anmelden.
2. Auf der Konsole: Systemeinstellungen → Jugendschutz → mit der Smartphone-App verknüpfen → den Code aus der App eingeben.
3. **Keine Einschränkungen setzen**, nur verknüpfen.

Jede Konsole wird einzeln verknüpft. Verknüpfst du später eine weitere (zum Beispiel die Switch 1), erkennt der nächste Sync sie von selbst. Eine Konsole kann nur mit einem Jugendschutz-Account verbunden sein.

### 2. Einmalig: Edge Function hochladen

Öffne <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/functions.yml> → «Run workflow». Der Lauf dauert etwa eine Minute und muss grün sein. Er braucht die GitHub-Secrets `SUPABASE_ACCESS_TOKEN` und `CREDENTIALS_ENCRYPTION_KEY`.

Das ist nur beim ersten Mal nötig und wenn sich die Function ändert.

### 3. In der App anmelden

1. Game Bibliothek öffnen → Karte **«Nintendo verbinden»**.
2. **«Nintendo-Login öffnen»** antippen und mit deinem Nintendo-Account anmelden.
3. Es erscheint eine Seite mit dem roten Knopf **«Dieses Konto auswählen»**. Den Knopf **nicht antippen**, sondern gedrückt halten und **«Link kopieren»** wählen (am PC: Rechtsklick → «Adresse des Links kopieren»).
4. Zurück in die Game Bibliothek, den Link ins Feld einfügen, **«Verbinden»** antippen.
5. Die App zeigt «Nintendo ist verbunden» und die gefundenen Konsolen.

Der kopierte Link beginnt mit `npf54789befb391a838://auth#`. Er gilt nur kurz und nur einmal. Schlägt es fehl, einfach noch einmal bei Punkt 2 beginnen. Der Link ist wie ein Passwort: nicht teilen.

Gespeichert wird ein Anmelde-Token, verschlüsselt in der Datenbank. Dein Nintendo-Passwort sieht die App nie.

### 4. Daten holen

Öffne <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/sync.yml> → «Run workflow» (Modus `sync`). Ab Phase 8 läuft das automatisch alle 6 Stunden.

### Wenn die Anmeldung abläuft

Die Plattform-Karte zeigt dann «Anmeldung abgelaufen». Schritt 3 wiederholen.

### Ohne Handy: am PC mit Terminal

`npm run setup:nintendo` führt durch dieselben Schritte. Braucht Node.js und eine `.env.local` mit `SUPABASE_SECRET_KEY` und `CREDENTIALS_ENCRYPTION_KEY`.

---

## Weg B: Historie aus der Nintendo-Store-App

Die Store-App zeigt unter Benutzerseite → **«Spielaktivitäten»** pro Spiel jeden Spieltag, zurück bis zum ersten. Einen automatischen Zugriff darauf gibt es nicht.

1. In der Game Bibliothek auf der Karte **«Nintendo-Historie importieren»** die **CSV-Vorlage** herunterladen.
2. Pro Spiel und Tag eine Zeile eintragen:

   ```
   Spiel;Datum;Dauer;Gerät
   Minecraft for Nintendo Switch;17.02.2026;1 Std. 15 Min.;
   Minecraft for Nintendo Switch;04.01.2026;Für kurze Zeit;Switch 2
   ```

   - **Dauer:** so wie in der App (`1 Std. 15 Min.`, `45 Min.`) oder einfach Minuten (`75`). `Für kurze Zeit` zählt als 5 Minuten und gilt als geschätzt.
   - **Gerät:** leer lassen, `Switch 1` oder `Switch 2`. Leer heisst: vor dem 13.06.2025 Switch 1, danach «Switch (unbekannt)», weil die Store-App das Gerät nicht pro Tag anzeigt.
3. Datei hochladen. Die App zeigt, wie viele Tage sie gelesen hat und welche Zeilen nicht lesbar sind. Dann **«Importieren»**.

Dieselbe Datei noch einmal zu importieren ändert nichts. Du kannst also in Etappen arbeiten und eine wachsende Datei immer wieder hochladen.

Geplant nach Phase 3: Statt abzutippen lädst du Screenshots oder eine Bildschirmaufnahme der «Spielaktivitäten» hoch, und die App liest sie selbst aus.

Hinweis: Neue Tage erscheinen in der Store-App mit bis zu einem Tag Verzögerung.

---

## Technischer Hintergrund

- Die Endpunkte der Jugendschutz-API (Version 2) sind im Open-Source-Projekt [pynintendoparental](https://github.com/pantherale0/pynintendoparental) (MIT) dokumentiert, der Login zusätzlich in [nxapi](https://github.com/samuelthomas2774/nxapi). Der Client hier ist eigener Code (`src/core/nintendo/`); keine der beiden Bibliotheken ist eingebunden.
- Für diese Anmeldung braucht es keinen Drittanbieter-Dienst.
- Verlangt Nintendo eine neuere App-Version, lassen sich `NINTENDO_APP_VERSION` und `NINTENDO_APP_BUILD` als GitHub-Variablen setzen (Settings → Secrets and variables → Actions → Variables), ohne den Code zu ändern.
