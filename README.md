# Game Bibliothek

Eine Web-App, die Spiele von Steam, PlayStation 5 und Nintendo Switch an einem Ort zusammenführt: gemeinsame Bibliothek, Spielzeit, Statistiken, Erfolge und Jahresrückblick.

Das Projekt ist im Aufbau. Der aktuelle Stand steht in [`docs/PROGRESS.md`](docs/PROGRESS.md).

- App: <https://masterplayer556.github.io/Game-Bibliothek/>
- Einrichtung: [`docs/SETUP-SUPABASE-GITHUB.md`](docs/SETUP-SUPABASE-GITHUB.md)
- Architektur: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Neue Plattform hinzufügen: [`docs/ADDING-A-PLATFORM.md`](docs/ADDING-A-PLATFORM.md)

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | App lokal starten |
| `npm run build` | Statische Seite nach `out/` bauen |
| `npm run lint` | ESLint und Typprüfung |
| `npm test` | Tests (Vitest) |
| `npm run sync` | Sync aller Plattformen (`-- --adapter=steam`, `-- --mode=test`) |
| `npm run seed:demo` / `npm run clear:demo` | Demo-Daten laden / löschen |
| `npm run check:rls` | Prüft von aussen, dass ohne Login nichts lesbar ist |

Alles davon geht auch ohne Terminal: Demo-Daten über die App, Sync und Prüfung über den Tab «Actions».
