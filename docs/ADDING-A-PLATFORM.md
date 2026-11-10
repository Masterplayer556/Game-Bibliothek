# Eine neue Plattform hinzufügen

Jede Datenquelle ist ein Adapter. Eine neue Quelle braucht genau drei Dinge.

## 1. Eintrag im Katalog

`src/core/adapter-catalog.ts`: ein Objekt in `ADAPTER_CATALOG` mit `id`, `platform`, Anzeigename, Fähigkeiten, Art der Zugangsdaten (`env`, `database` oder `none`) und der Anleitung. Die App zeigt daraus automatisch eine Plattform-Karte.

Für eine ganz neue Plattform (nicht nur eine weitere Quelle) kommt der Name zusätzlich in `PLATFORM_IDS` in `src/core/types.ts` und in die `check`-Regeln der Spalte `platform` (neue Migration).

## 2. Der Adapter

Neuer Ordner `sync/adapters/<id>/` mit:

- `client.ts`: spricht mit der fremden API. Bekommt `fetch` übergeben, damit Tests ohne Netz laufen.
- `adapter.ts`: implementiert `PlatformAdapter` aus `sync/types.ts`:
  - `isConfigured(ctx)`: sind die Zugangsdaten da?
  - `testConnection(ctx)`: kurzer Test für den Knopf «Verbindung testen».
  - `sync(ctx)`: gibt ein `SyncResult` mit einem `SyncBatch` zurück (Geräte, Spiele, Tageswerte, Erfolge).
- `fixtures/`: gespeicherte Beispiel-Antworten der API.
- `adapter.test.ts`: Tests mit den Fixtures.

Regeln:

- Der Adapter schreibt **nie** selbst in die Datenbank. Er gibt Daten zurück, der Runner speichert sie.
- Liefert die Quelle eine Gesamtspielzeit, setzt er `totalPlaytimeMinutes`. Liefert sie nur Tageswerte, bleibt das Feld leer und die Summe wird berechnet.
- Hat die Plattform keine Erfolge, bleiben `achievementsUnlocked` und `achievementsTotal` auf `null`.
- Abgelaufene Anmeldung: `throw new AdapterError("auth_expired", "…")` mit einem deutschen Text für die App.
- Geloggt werden nur Zahlen und Zustände, nie Titel, IDs oder Tokens. Die Logs sind öffentlich.
- Neue oder erneuerte Tokens kommen in `credentialUpdates`. Der Runner speichert sie verschlüsselt.

## 3. Eintrag in der Registry

`sync/registry.ts`: den Adapter in die Liste `adapters` aufnehmen. Mehr ist nicht nötig; der Runner führt ihn aus und fängt seine Fehler ab.

## Beispiel: Minecraft-Mods (geplant)

- Katalog: `id: "minecraft-mods"`, neue Plattform `minecraft_mods`, `credentialSource: "none"`.
- Ein lokales Skript liest den `mods`-Ordner und gleicht die Dateien mit der Modrinth-API ab.
- Weil der Ordner nur auf dem eigenen PC liegt, läuft dieser Adapter nicht in GitHub Actions, sondern von Hand (`npm run sync -- --adapter=minecraft-mods`).
