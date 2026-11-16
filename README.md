# Game Bibliothek

Eine Web-App, die Spiele von **Steam**, **PlayStation 5** und **Nintendo Switch / Switch 2** an einem Ort zusammenführt: gemeinsame Bibliothek mit Cover und Spielzeit, Statistiken, Pile of Shame, Trophäen und Erfolge und ein Jahresrückblick zum Teilen.

- App: <https://masterplayer556.github.io/Game-Bibliothek/>
- Stand und Entscheidungen: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- Architektur: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Sicherheit: [`docs/SECURITY.md`](docs/SECURITY.md)

## Einrichten

| Was | Anleitung |
|---|---|
| Supabase, GitHub Pages, Secrets, Sync-Knöpfe | [`docs/SETUP-SUPABASE-GITHUB.md`](docs/SETUP-SUPABASE-GITHUB.md) |
| Steam | [`docs/SETUP-STEAM.md`](docs/SETUP-STEAM.md) |
| PlayStation | [`docs/SETUP-PLAYSTATION.md`](docs/SETUP-PLAYSTATION.md) |
| Nintendo (Jugendschutz-App, Historie-Import) | [`docs/SETUP-NINTENDO.md`](docs/SETUP-NINTENDO.md) |
| IGDB (Cover, Genres) | [`docs/SETUP-IGDB.md`](docs/SETUP-IGDB.md) |
| Neue Plattform anbinden | [`docs/ADDING-A-PLATFORM.md`](docs/ADDING-A-PLATFORM.md) |

## Wie es funktioniert

- **App**: Next.js als statische Seite auf GitHub Pages. Sie liest und schreibt direkt in Supabase; geschützt durch Login und Row Level Security (ohne Login ist nichts lesbar).
- **Sync**: ein Node-Skript (`sync/`), das GitHub Actions alle 6 Stunden startet, per Knopf in der App oder von Hand. Jede Plattform ist ein austauschbarer Adapter; fällt einer aus, laufen die anderen weiter.
- **Edge Functions** (`supabase/functions/`): Nintendo-Login, Tokens verschlüsselt speichern, IGDB-Suche, Sync starten.
- **Tokens** von PlayStation und Nintendo liegen verschlüsselt (AES-256-GCM) in der Datenbank, nie im Browser lesbar.
- **Design**: alle Farben, Abstände und Schriften in [`src/styles/tokens.css`](src/styles/tokens.css); Logik (`src/core`, `src/lib`) und Darstellung (`src/components`, `src/app`) sind getrennt.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | App lokal starten |
| `npm run build` | Statische Seite nach `out/` bauen |
| `npm run lint` | ESLint und Typprüfung |
| `npm test` | Tests (Vitest, inkl. Datenbank-Tests gegen Postgres im Speicher) |
| `npm run sync` | Sync (`-- --adapter=steam`, `-- --mode=test`) |
| `npm run seed:demo` / `npm run clear:demo` | Demo-Daten laden / löschen |
| `npm run check:rls` | Prüft von aussen, dass ohne Login nichts lesbar, schreibbar oder aufrufbar ist |
| `npm run setup:nintendo` | Nintendo-Login im Terminal (sonst in der App) |
| `npm run igdb:check` | IGDB-Verbindung prüfen |

Ohne Terminal geht alles über die App und den Tab «Actions» (Workflows «Sync», «Tools», «Edge Functions deployen»).
