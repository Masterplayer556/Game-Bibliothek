# Game Bibliothek – Architektur und Plan (Phase 0)

Stand: 10.11.2026. Dieses Dokument ist das Ergebnis von Phase 0. Es beschreibt, **was** gebaut wird und **warum**. Der laufende Stand steht in `PROGRESS.md`.

---

## 1. Ergebnis der Recherche

| Thema | Stand | Quelle der Prüfung |
|---|---|---|
| `psn-api` | Version 2.18.1 (August 2026), MIT. Alle benötigten Funktionen sind vorhanden: `exchangeNpssoForAccessCode`, `exchangeAccessCodeForAuthTokens`, `exchangeRefreshTokenForAuthTokens`, `getUserPlayedGames`, `getPurchasedGames`, `getUserTitles`, `getTitleTrophies`, `getUserTrophiesEarnedForTitle`. Die Token-Antwort enthält `refreshTokenExpiresIn`. | npm-Paket heruntergeladen und gelesen |
| `nxapi` | Letzte stabile Version 1.6.1 ist vom März 2023, seither nur Vorab-Versionen (letzte: September 2026). Lizenz **AGPL-3.0-or-later**. Der Jugendschutz-Teil spricht noch die **alte** API an (`api-lp1.pctl.srv.nintendo.net/moon/v1`, App-Version 1.x). Keine Switch-2-Kennung im Code. | npm-Paket (`next`) heruntergeladen und gelesen |
| `pynintendoparental` | Version 2.6.3, **MIT**. Steckt hinter der offiziellen Home-Assistant-Integration. Spricht die **aktuelle** API an (`app.lp1.znma.srv.nintendo.net`, `/v2/actions/...`, App-Version 2.6.0) und unterscheidet Switch 1 und Switch 2 über `platformGeneration` (`P00` / `P01`). | PyPI-Paket heruntergeladen und gelesen |
| Nintendo-Store «Spielaktivität» | **Kein** Open-Source-Client und kein dokumentierter Weg gefunden. Bekannt ist nur ein Weg über Screenshots und Texterkennung (OCR). | Websuche |
| GitHub-Cron | In öffentlichen Repos werden geplante Workflows nach 60 Tagen ohne Repo-Aktivität abgeschaltet. | GitHub-Doku |
| Supabase-Pause | Gratis-Projekte werden nach etwa 7 Tagen mit wenig Aktivität pausiert. | Supabase-Doku |
| Steam Web API, IGDB | In Phase 0 **nicht neu geprüft**. Beides sind offizielle, stabile APIs; die Feinprüfung (Cover-Adressen, Rate-Limits) passiert in Phase 5 bzw. 7. | – |

### Nintendo im Detail

**Entscheid: eigener kleiner TypeScript-Client statt `nxapi` als Abhängigkeit.** Gründe:
1. nxapi nutzt für den Jugendschutz noch die alte API-Version ohne Switch-2-Kennung.
2. AGPL würde das ganze Repo an die AGPL binden (siehe Abschnitt 8).
3. nxapi bringt viele schwere Abhängigkeiten mit (`sharp`, `express`, `discord-rpc`), die der Sync nicht braucht.

Der Client spricht nur Endpunkte an, die in `pynintendoparental` (MIT) und `nxapi` dokumentiert sind. Das ist im Projektauftrag ausdrücklich erlaubt und kein eigenes Reverse Engineering.

**Login-Ablauf** (identisch in nxapi und pynintendoauth, kein Drittanbieter-Dienst nötig):
1. `npm run setup:nintendo` erzeugt einen Link auf `accounts.nintendo.com/connect/1.0.0/authorize` (Client-ID der Jugendschutz-App `54789befb391a838`, PKCE mit S256, `response_type=session_token_code`).
2. Du loggst dich im Browser ein. Beim Knopf «Dieses Konto auswählen» kopierst du die Link-Adresse (`npf54789befb391a838://auth#session_token_code=...`) und fügst sie im Terminal ein.
3. Das Skript tauscht den Code bei `/connect/1.0.0/api/session_token` gegen einen **Session-Token** und speichert ihn verschlüsselt in `platform_credentials`. Das Ablaufdatum steht im Token selbst und wird in `platform_connections.token_expires_at` abgelegt.
4. Bei jedem Sync: Session-Token → kurzlebiger Access-Token (`/connect/1.0.0/api/token`) → Jugendschutz-API. Schlägt der Tausch fehl: Status `auth_expired`.

**Endpunkte:**
- `GET /v2/actions/user/fetchOwnedDevices` → alle verknüpften Konsolen (`deviceId`, `label`, `platformGeneration`). Jede Konsole wird einzeln verknüpft und erscheint als eigenes Gerät.
- `GET /v2/actions/playSummary/fetchDailySummaries?deviceId=…` → Tage mit `date`, darin `players[]` mit `playedGames[]` (`meta.applicationId`, `playingTime`). Die Switch 1 liefert die Spiel-ID teils direkt als `applicationId`; der Client liest beide Formen.
- `GET /v2/actions/playSummary/fetchMonthlySummary?deviceId=…&year=…&month=…` → Monatsübersicht für ältere Monate.
- Titel und Cover der Spiele kommen aus den Gerätedaten (`title`, `imageUri`).

**Offen, wird in Phase 2 mit echten Daten geklärt:**
- Einheit von `playingTime` (Sekunden oder Minuten; die Quellen widersprechen sich).
- Wie viele Tage `fetchDailySummaries` zurückliefert. Vermutlich nur die letzten Wochen; darum sammelt der Sync fortlaufend.
- Genaue Gültigkeitsdauer des Session-Tokens.

**Nintendo-Store-Adapter:** wird **nicht** gebaut (kein dokumentierter Weg). Die alte Historie kommt über `nintendo-import` (CSV).

---

## 2. Überblick

```
Browser (GitHub Pages, statisch)
   │  liest/schreibt direkt, geschützt durch Login + RLS
   ▼
Supabase ── Postgres (RLS auf jeder Tabelle)
   │        Auth (nur ein Nutzer, Registrierung aus)
   │        Edge Functions: save-credential, trigger-sync
   ▲
   │  schreibt mit Secret-Key
Sync-Skript (Node, ohne Next.js)
   ▲
   │  startet es
GitHub Actions (Cron alle 6 h, manuell, oder über trigger-sync)
```

- Die App hat **keinen eigenen Server**. Alles, was ein Geheimnis braucht, läuft im Sync-Skript (GitHub-Secrets) oder in einer Edge Function (Supabase-Secrets).
- Adresse: `https://masterplayer556.github.io/Game-Bibliothek/`. Der `basePath` ist `/Game-Bibliothek` (Gross-/Kleinschreibung zählt) und über `NEXT_PUBLIC_BASE_PATH` einstellbar.

### Folgen des statischen Exports
- Keine dynamischen Routen mit unbekannten IDs. Spiel-Detail und Jahresrückblick laufen über Parameter: `/game/?id=…` und `/wrapped/?year=2026`.
- `trailingSlash: true`, `images.unoptimized: true`, `.nojekyll` in `public/`.
- Login mit **E-Mail und Passwort**. Ein Login per E-Mail-Link wäre auf dem Gratis-Plan auf wenige Mails pro Stunde begrenzt und braucht Redirects.

---

## 3. Ordnerstruktur

```
.github/workflows/   ci.yml (lint, test, build), deploy.yml (Pages), sync.yml
docs/                Anleitungen, ARCHITECTURE.md, PROGRESS.md
public/              .nojekyll, Platzhalter-Cover
src/
  app/               Seiten (nur Darstellung)
  components/        UI-Bausteine
  styles/tokens.css  ALLE Farben, Abstände, Schriften (einzige Stelle)
  lib/               Supabase-Client und Abfragen für den Browser
  core/              reine Logik ohne Next.js und ohne Node-Abhängigkeit:
                     Typen, Spielzeit-Berechnung, Statistiken, Titel-Abgleich, Zeitzone
sync/
  index.ts           Kommandozeile: --mode=sync|test, --adapter=…
  runner.ts          führt Adapter einzeln aus, fängt Fehler pro Adapter ab
  registry.ts        Liste aller Adapter (einzige Stelle zum Eintragen)
  adapters/<id>/     adapter.ts, client.ts, fixtures/, *.test.ts
  metadata/          Schnittstelle + igdb.ts
  crypto.ts, db.ts
scripts/             seed-demo.ts, setup-nintendo.ts, check-rls.ts
supabase/
  migrations/        SQL-Dateien (führst du aus)
  functions/         save-credential/, trigger-sync/, _shared/
```

`src/core` wird von der App **und** vom Sync-Skript benutzt. So gibt es jede Rechenregel nur einmal, und sie ist mit Vitest testbar.

---

## 4. Adapter-System

Die Schnittstelle aus dem Projektauftrag bleibt, mit drei Ergänzungen:

```ts
interface PlatformAdapter {
  id: string;                      // 'steam', 'psn', 'nintendo-parental', 'nintendo-import', 'demo'
  platform: PlatformId;            // 'steam' | 'psn' | 'nintendo' | 'manual'
  displayName: string;
  capabilities: AdapterCapabilities;
  credentialSource: 'env' | 'database' | 'none';   // NEU: wo liegen die Zugangsdaten?
  requiredEnv?: string[];                          // NEU: für den Hinweis «diese GitHub-Secrets fehlen»
  isConfigured(ctx): Promise<boolean>;
  testConnection(ctx): Promise<TestResult>;
  sync(ctx: SyncContext): Promise<SyncResult>;
}
```

- **Adapter schreiben nicht selbst in die Datenbank.** `sync()` gibt ein einheitliches Ergebnis zurück (Geräte, Spiele, Gesamtspielzeiten, Tagesdaten, Erfolge, neue Tokens). Der Runner speichert es. Das macht Adapter mit Fixtures testbar, ohne Datenbank.
- Der `SyncContext` gibt dem Adapter: entschlüsselte Zugangsdaten, den Stand des letzten Laufs (z. B. welche Spielzeiten sich geändert haben) und einen Logger.
- Fehler haben eine Art: `auth_expired`, `rate_limited`, `network`, `unknown`. Daraus setzt der Runner den Status in `platform_connections`.
- **Öffentliche Logs:** Die Actions-Logs eines öffentlichen Repos kann jeder lesen. Der Logger schreibt darum nur Zahlen und Statusmeldungen, nie Titel, IDs, E-Mails oder Tokens.

**Metadaten-Anbieter** (getrennt): `findGame(title, platform)` und `searchGames(query)`. Erste Umsetzung IGDB in Phase 7, Ergebnisse in `metadata_cache`.

---

## 5. Datenmodell

Alle Tabellen haben `user_id` und RLS (`user_id = auth.uid()` plus Prüfung der erlaubten E-Mail).

| Tabelle | Inhalt | Wichtig |
|---|---|---|
| `games` | Das plattformübergreifende Spiel: Titel, normalisierter Titel, IGDB-ID, Cover, Genres, Erscheinungsjahr | `igdb_locked`: von Hand korrigiert, wird nicht mehr automatisch überschrieben |
| `devices` | **Neu.** Ein Gerät: Plattform, Art (`pc`, `ps5`, `ps4`, `switch1`, `switch2`, `xbox360` …), Name, externe ID | Nintendo-Konsolen kommen aus der API, die übrigen legt der Runner an |
| `platform_games` | Ein Spiel auf einer Plattform: Quelle, externe ID, Titel, Cover, besessen, zuerst/zuletzt gespielt, Gesamtspielzeit, Erfolge x/y, `raw` | Eindeutig über `(user_id, platform, external_id)`. `game_link_locked`: von Hand zusammengeführt oder getrennt |
| `playtime_snapshots` | Gesamtspielzeit zu einem Zeitpunkt (Steam, PSN) | Wird nur geschrieben, wenn sich der Wert geändert hat (plus der erste) |
| `daily_playtime` | Minuten pro Spiel, **Gerät**, Tag und **Quelle** | Eindeutig über `(platform_game_id, device_id, play_date, source)` |
| `achievements` | Einzelne Trophäen/Erfolge: Name, Beschreibung, Icon, freigeschaltet am, Seltenheit, Stufe | |
| `game_user_data` | Status, Favorit, Notiz, «nicht im Pile of Shame» | Hängt am `games`-Eintrag |
| `platform_connections` | Status pro Adapter, letzter Sync, letzter Erfolg, Fehlermeldung, `data_since`, `token_expires_at`, fehlende Secrets | Von der App lesbar |
| `platform_credentials` | Verschlüsselte Tokens | RLS an, **keine** Policy: aus dem Browser unlesbar |
| `sync_runs` | Protokoll: Modus, Adapter, Status, Start, Ende, Ergebnis pro Adapter | |
| `metadata_cache` | Zwischengespeicherte IGDB-Antworten | Phase 7 |
| `app_settings` | Einstellungen, z. B. Grenze für den Pile of Shame | |

### Warum eine eigene `devices`-Tabelle?
Im Auftrag steht das Gerät an `platform_games`. Bei Nintendo reicht das nicht: Dasselbe Spiel kann auf Switch 1 **und** Switch 2 laufen. Darum hängt das Gerät an den Tagesdaten. Für Steam, PS5 und manuelle Spiele bleibt zusätzlich `platform_games.device_kind` als fester Wert.

### Regeln für die Spielzeit (in `src/core/playtime`, mit Tests)
1. Der erste Snapshot ist nur der Startwert.
2. Differenz zwischen zwei Snapshots = gespielte Zeit. Negative Differenz zählt 0 und wird protokolliert.
3. **Zuordnung zum Tag:** Liegt «zuletzt gespielt» zwischen den beiden Snapshots, zählt die Differenz für diesen Tag, sonst für den Tag des späteren Snapshots. Liegen mehr als 48 Stunden dazwischen, gilt der Wert als **geschätzt**. Die Zeit wird nie gleichmässig auf Tage verteilt, weil das erfundene Spieltage erzeugt.
4. Echte Tagesdaten haben Vorrang vor Snapshots; nie beides zusammenzählen.
5. **Überschneidung Jugendschutz und Import:** Beide bleiben gespeichert. Pro Spiel, Gerät und Tag zählt nur **eine** Quelle: Jugendschutz vor Import. So geht nichts verloren und nichts wird doppelt gezählt.
6. Alle Tage, Wochen (Start Montag) und Monate in **Europe/Zurich**; in der Datenbank UTC.
7. `data_since` pro Adapter zeigt, ab wann Daten vorhanden sind.

### Gleiches Spiel auf mehreren Plattformen
Zuordnung zuerst über die IGDB-ID, sonst über den normalisierten Titel (Kleinbuchstaben, ohne Sonderzeichen, ohne Zusätze wie «Nintendo Switch 2 Edition»). Manuelles Zusammenführen oder Trennen setzt `game_link_locked`, damit der nächste Sync es nicht rückgängig macht.

---

## 6. Sicherheit

- **Verschlüsselung:** AES-256-GCM mit `CREDENTIALS_ENCRYPTION_KEY`, Format `v1:<iv>:<daten>`. Dieselbe Implementierung im Sync-Skript (Node) und in der Edge Function (Web Crypto). **Nicht** Supabase Vault: Dort läge der Schlüssel im selben Projekt wie die Daten. So ist ein Datenbank-Abzug allein wertlos.
- **Erlaubte E-Mail:** liegt in einer Tabelle in einem privaten Schema. Du trägst sie einmal per SQL ein; sie steht in keiner Datei im öffentlichen Repo.
- **RLS-Prüfung in zwei Teilen:**
  1. Test ohne Datenbank: liest die Migrationen und stellt sicher, dass jede Tabelle RLS einschaltet und `platform_credentials` keine Policy hat. Läuft in der CI.
  2. `npm run check:rls`: fragt jede Tabelle ohne Login ab und erwartet überall «nichts lesbar».

---

## 7. Edge Functions

Beide prüfen das Login-Token und die E-Mail selbst und teilen sich `_shared/auth.ts`.

- **`save-credential`**: nimmt einen Token entgegen (z. B. NPSSO), verschlüsselt und speichert ihn. Der Tausch NPSSO → Refresh-Token passiert danach im Sync-Workflow (Modus `test`); die NPSSO wird anschliessend gelöscht.
- **`trigger-sync`**: legt eine Zeile in `sync_runs` an (Status `queued`) und startet den Workflow per `workflow_dispatch`. Lehnt ab, wenn schon ein Lauf wartet oder läuft.

Einen einfacheren Weg ohne Edge Functions gibt es nicht: Der GitHub-Token und der Schlüssel dürfen nie in den Browser.

---

## 8. Lizenzen

| Paket | Lizenz | Bedeutung für dieses Repo |
|---|---|---|
| `psn-api` | MIT | Frei nutzbar, auch öffentlich. Nichts weiter zu tun. |
| `nxapi` | AGPL-3.0-or-later | Wer es einbindet, muss das eigene Programm ebenfalls unter AGPL stellen. **Wird darum nicht eingebunden.** |
| `pynintendoparental` | MIT | Dient nur als Dokumentation der Endpunkte. Wird in `docs/SETUP-NINTENDO.md` als Quelle genannt. |

---

## 9. Die zwei Stolpersteine

1. **GitHub schaltet den Cron nach 60 Tagen ab.**
   - Die App zeigt ein Warnbanner, wenn der letzte erfolgreiche Sync älter als 24 Stunden ist.
   - Der Sync-Workflow schaltet sich einmal pro Woche über die GitHub-API selbst wieder ein, was die Frist zurücksetzt. Das wird in Phase 8 gebaut und getestet.
2. **Supabase pausiert Gratis-Projekte nach etwa 7 Tagen.**
   - Der Sync schreibt alle 6 Stunden in die Datenbank; das zählt als Aktivität. Solange der Cron läuft, wird nicht pausiert.
   - Fällt der Cron aus, greift nach einer Woche auch die Pause. Darum ist Punkt 1 wichtig. Supabase schickt vorher eine E-Mail.

---

## 10. Risiken

| Risiko | Einschätzung | Gegenmassnahme |
|---|---|---|
| Nintendo ändert die Jugendschutz-API oder verlangt eine neue App-Version | mittel | App-Version an einer Stelle einstellbar; Fehler setzt nur diesen Adapter auf `error` |
| Nintendo-Fixtures stammen nicht aus deinem Konto | sicher, bis die Konsolen verknüpft sind | Früh verknüpfen; in Phase 2 mit echten Daten gegenprüfen |
| Jugendschutz-Daten zählen alle Profile der Konsole | offen | Profil-ID mitspeichern; Auswahl «nur mein Profil» |
| Sony ändert den NPSSO-Weg | mittel | Nur `psn-api` nutzen, Fehler klar anzeigen |
| Öffentliche Actions-Logs verraten Daten | hoch, wenn man nicht aufpasst | Logger schreibt nur Zahlen (Abschnitt 4) |
| Jemand registriert sich in deinem Supabase-Projekt | hoch, wenn vergessen | Registrierung ausschalten ist Schritt 1 der Anleitung; RLS prüft zusätzlich die E-Mail |

---

## 11. Änderungen seit Phase 0

Diese Punkte gelten vor dem Text weiter oben.

- **Kein Terminal nötig.** Der Nintendo-Login läuft in der App über eine Edge Function statt über `npm run setup:nintendo`. Demo-Daten lädt ein Knopf in der App. Sync, Sicherheitsprüfung und Demo-Daten gibt es zusätzlich als manuell startbare Workflows.
- **Öffentliche Werte im Repo.** Adresse und öffentlicher Schlüssel des Supabase-Projekts stehen in `.env.production`. GitHub-Variablen mit demselben Namen haben Vorrang.
- **Adapter-Katalog.** `src/core/adapter-catalog.ts` beschreibt alle Quellen einmal, für App und Sync. Die Registry (`sync/registry.ts`) enthält nur die fertigen Adapter.
- **Snapshots speichern «zuletzt gespielt»** (`playtime_snapshots.last_played_at`). Nur so lässt sich Regel 3 der Spielzeit auch für ältere Abschnitte anwenden.
- **Import ist geräteunabhängig.** Die Nintendo-Store-Historie kennt kein Gerät pro Tag. Hat eine andere Quelle für dasselbe Spiel und denselben Tag Daten, zählt der Import-Wert nicht, egal auf welchem Gerät. Ein Import übernimmt nie einen bestehenden Eintrag.
- **Persistenz in `src/data/persist.ts`.** Dieselbe Funktion schreibt für das Sync-Skript, die Demo-Daten im Browser und später den Import.
- **Tests gegen echtes Postgres.** Migration, Row Level Security und Persistenz laufen in den Tests gegen eine Postgres-Instanz im Speicher (PGlite).
- **Geteiltes Supabase-Projekt.** Der Gratis-Plan erlaubt nur zwei aktive Projekte, und beide sind belegt. Game Bibliothek läuft darum im Projekt «Kalender / Game Bibliothek» (früher «Kalender (CC)») in den eigenen Schemas `game_bibliothek` und `game_bibliothek_private` statt in `public`. Der Schema-Name steht einmal im Code (`DB_SCHEMA` in `src/core/types.ts`). Ein Test stellt sicher, dass die Migration nichts in `public` anlegt und fremde Tabellen und Rechte nicht verändert. Überall, wo dieses Dokument `public.` oder `app_private` meint, gilt das neue Schema.
- **Supabase-Änderungen.** Claude führt SQL selbst aus. Was eine Bestätigung braucht oder nur im Dashboard geht, bekommt Marcel mit Link und Text.
- **Doppelzählung pro Spiel statt pro Eintrag.** Import und Konsole können für dasselbe Spiel getrennte Plattform-Einträge haben. Welche Tageswerte zählen, entscheidet darum das verknüpfte Spiel (`gameKey = game_id`).
- **Geteilter Code für Edge Functions.** `src/core/crypto.ts` und `src/core/nintendo/*.ts` importieren nichts und werden vom Deploy-Workflow nach `supabase/functions/_shared/` kopiert. So gibt es Login-Logik und Verschlüsselung nur einmal.
- **Erlaubte E-Mail in Edge Functions:** über `game_bibliothek.is_allowed_email()`, nur für die Service-Rolle aufrufbar. Ein Secret `ALLOWED_EMAIL` für die Functions entfällt.
