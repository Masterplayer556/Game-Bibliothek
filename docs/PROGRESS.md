# PROGRESS

Eine neue Session braucht nur den Projektauftrag (Prompt) und diese Datei. Details zur Architektur stehen in `ARCHITECTURE.md`.

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Plan | fertig (10.11.2026) |
| 1 | Grundgerüst | fertig und eingerichtet (10.11.2026) |
| 2 | Nintendo | gebaut (10.11.2026), Test mit echten Daten offen |
| 3 | App mit Demo-Daten | offen |
| 4 | Jahresrückblick | offen |
| 5 | Steam | offen |
| 6 | PSN | offen |
| 7 | IGDB | offen |
| 8 | Betrieb | offen |

## Nächster Schritt

1. **Marcel:** Workflow «Edge Functions deployen» starten, in der App «Nintendo verbinden», dann Workflow «Sync» starten (Anleitung: `SETUP-NINTENDO.md`).
2. **Claude:** nach dem ersten echten Sync die offenen Nintendo-Punkte prüfen (siehe unten) und nötigenfalls korrigieren.
3. Danach **Phase 3 – App mit Demo-Daten**.

**Modell-Empfehlung:**
- Für die Prüfung mit echten Nintendo-Daten (Schritt 2): Fable 5.2, `/effort high`, falls der erste Sync scheitert oder die Zahlen nicht stimmen. Läuft er sauber durch, reicht Opus 5.5.
- Für Phase 3: Opus 5.5, `/effort high`. Klar beschriebene UI-Seiten auf fertiger Logik.

## Was in Phase 2 gebaut wurde

- **Nintendo-Client** (`src/core/nintendo/auth.ts`, `api.ts`): Login (PKCE) und Jugendschutz-API v2. Beide Dateien importieren nichts, weil die Edge Function sie als Kopie benutzt (Deno).
- **Adapter** `sync/adapters/nintendo-parental/`: alle verknüpften Konsolen, Tageswerte pro Spiel, alle Profile zusammengezählt. In der Registry eingetragen. Fixtures und Tests.
- **Edge Function** `supabase/functions/nintendo-login/`: schliesst den Login ab und speichert den Session-Token verschlüsselt. Prüft Login-Token und erlaubte E-Mail selbst (`--no-verify-jwt`).
- **Workflow** `functions.yml`: kopiert den geteilten Code nach `supabase/functions/_shared/` (nicht im Repo), deployt die Function und setzt `GB_CREDENTIALS_ENCRYPTION_KEY`.
- **Import** `src/core/nintendo/import.ts`: CSV-Parser und Batch-Aufbau; Vorlage unter `public/vorlagen/`.
- **App**: Karten «Nintendo verbinden» und «Nintendo-Historie importieren» (`src/components/Nintendo*.tsx`, Logik in `src/lib/nintendo.ts`).
- **Migration** `0002_is_allowed_email.sql`: ausgeführt am 10.11.2026.
- `npm run setup:nintendo` als zweiter Weg mit Terminal.

## Was in Phase 1 gebaut wurde

- **App** (`src/app`, `src/components`, `src/lib`): Next.js 16, statischer Export, Tailwind 4. Startseite mit Login, Datenbank-Check, Plattform-Liste, Knöpfen «Demo-Daten laden/löschen» und einem Schlüssel-Generator. Alle Farben, Abstände und Schriften in `src/styles/tokens.css`.
- **Kern-Logik** (`src/core`, ohne Next.js und ohne Node): Typen, Zeitzone Europe/Zurich, Titel-Abgleich, Spielzeit-Regeln (`playtime/`), AES-256-GCM (`crypto.ts`), Adapter-Katalog, Demo-Daten (`demo/`).
- **Persistenz** (`src/data/persist.ts`): schreibt einen `SyncBatch`; von Sync-Skript und Browser benutzt.
- **Sync** (`sync/`): Adapter-Schnittstelle (`types.ts`), Runner mit Fehlerabfang pro Adapter (`runner.ts`), Registry (noch leer), Metadaten-Schnittstelle, Supabase-Store, Kommandozeile (`index.ts`).
- **Skripte** (`scripts/`): `seed-demo.ts`, `check-rls.ts`.
- **Datenbank**: `supabase/migrations/0001_init.sql` (alle Tabellen, RLS, Rechte, `delete_demo_data()`), alles in den Schemas `game_bibliothek` und `game_bibliothek_private`. Der Schema-Name steht in `DB_SCHEMA` (`src/core/types.ts`); alle Supabase-Clients sind darauf eingestellt.
- **Workflows**: `ci.yml` (lint, test, build bei jedem Pull Request), `deploy.yml` (GitHub Pages), `sync.yml` (nur manuell, Cron folgt in Phase 8), `tools.yml` (check-rls, seed-demo, clear-demo).
- **Tests**: 73, darunter Migration, Row Level Security und Persistenz gegen ein echtes Postgres im Speicher (PGlite).
- **Anleitungen**: `SETUP-SUPABASE-GITHUB.md`, `ADDING-A-PLATFORM.md`.

### Hinweise für spätere Phasen

- TypeScript ist auf Version 6 festgelegt, weil `typescript-eslint` Version 7 noch nicht unterstützt.
- Tailwind 4: Token-Namen dürfen sich zwischen den Gruppen nicht überschneiden (`--spacing-page` und `--container-page` kollidierten bei `max-w-page`).
- `supabase/testing/database.ts` enthält einen kleinen Ersatz für den Supabase-Client. Er kann nur die Aufrufe, die `src/data` und `sync/store.ts` benutzen. Neue Abfrage-Arten dort ergänzen.
- **Migration ausgeführt am 10.11.2026** (von Claude, per SQL, ohne Eintrag in der Migrations-Historie des Projekts, damit die Kalender-App nicht gestört wird). Geprüft: 11 Tabellen, überall RLS, keine Regel für `platform_credentials`, eine erlaubte E-Mail (der bestehende Nutzer des Projekts), Kalender-Tabellen unverändert. Spätere Migrationen genauso ausführen.
- Sicherheitshinweise des Projekts nach der Migration: zwei Info-Meldungen «RLS ohne Regel» für `platform_credentials` und `allowed_emails` (beide gewollt) und die Warnung «Leaked Password Protection» (Projekt-Einstellung, bestand schon vorher).
- Minecraft: Java Edition gibt es nicht auf Steam. In den Demo-Daten ist es ein manueller Eintrag (PC) und wird über den Titel mit Minecraft auf Switch und PS5 zusammengeführt.
- Die Demo-Daten für Steam und PS5 sind Snapshots, die für Nintendo Tageswerte auf zwei Konsolen.

## Antworten von Marcel

- Repo: **öffentlich**, `Masterplayer556/Game-Bibliothek`
- Adresse: `https://masterplayer556.github.io/Game-Bibliothek/`, `basePath` = `/Game-Bibliothek`
- Supabase: **kein neues Projekt.** Beide Gratis-Projekte («Kalender (CC)», «Drive Pool») werden gebraucht. Game Bibliothek läuft im Projekt «Kalender / Game Bibliothek» (früher «Kalender (CC)», `vvgvlrwhnirooxoukbze`, Frankfurt) in eigenen Schemas mit.
- Supabase-Regel (geändert am 10.11.2026): **Claude darf SQL selbst ausführen.** Nur was eine Bestätigung braucht oder scheitert, geht mit Link und Text an Marcel.
- Edge Functions: per Workflow deployen. Öffentliche Werte in `.env.production`: in Ordnung.
- Konsolen: Nur die **Switch 2** wird mit der Jugendschutz-App verknüpft, weil auf der Switch 1 nicht mehr gespielt wird. Die Switch 1 kann später jederzeit dazukommen.
- Jugendschutz-App: **noch nicht** mit den Konsolen verknüpft
- Profile: Nur Marcel spielt. Es gibt mehrere Konten auf den Konsolen, alle gehören ihm; aktuell nutzt er eines.
- Bedienung: **alles über GitHub und die App, auch vom Handy.** Kein Node.js auf dem PC voraussetzen.
- Login: E-Mail und Passwort ist in Ordnung.
- Switch 2: seit etwa **13.06.2025** (Freitag der Woche nach dem Release). Alles davor ist Switch 1. Die Store-App hat keinen Konsolen-Filter.
- Lizenz: **keine** Lizenzdatei. Das Repo ist öffentlich, aber nur für den Eigengebrauch.

## Wichtige Entscheidungen

1. **Nintendo ohne `nxapi`.** Eigener TypeScript-Client gegen die Jugendschutz-API v2 (`app.lp1.znma.srv.nintendo.net`). Vorlage für die Endpunkte: `pynintendoparental` (MIT). Gründe: nxapi nutzt die alte API ohne Switch-2-Kennung, ist AGPL und sehr schwer.
2. **Switch 1 / Switch 2** werden über `platformGeneration` unterschieden (`P00` = Switch 1, `P01` = Switch 2).
3. **`nintendo-store`-Adapter wird nicht gebaut.** Kein dokumentierter Weg gefunden. Alte Historie kommt über `nintendo-import` (CSV).
4. **Eigene Tabelle `devices`.** Das Gerät hängt an den Tagesdaten, nicht nur am Plattform-Spiel.
5. **Tagesdaten behalten ihre Quelle.** Bei Überschneidung zählt pro Spiel, Gerät und Tag nur eine: Jugendschutz vor Import.
6. **Snapshots:** Differenz wird dem Tag von «zuletzt gespielt» zugeordnet, sonst dem Tag des späteren Snapshots. Über 48 Stunden Abstand = geschätzt. Nie auf Tage verteilen.
7. **Adapter schreiben nicht selbst in die Datenbank.** Sie geben ein Ergebnis zurück, der Runner speichert.
8. **Verschlüsselung:** AES-256-GCM in der Anwendung, nicht Supabase Vault.
9. **Statischer Export:** Detailseiten über Parameter (`/game/?id=…`, `/wrapped/?year=…`).
10. **Login:** E-Mail und Passwort.
11. **Logs:** Das Sync-Skript schreibt nur Zahlen und Status, weil Actions-Logs öffentlich sind.
12. **PSN:** `save-credential` speichert nur die verschlüsselte NPSSO; den Tausch gegen Tokens macht der Sync-Workflow.
13. **Kein lokales Terminal nötig** (überschreibt `ARCHITECTURE.md`, wo `npm run setup:nintendo` noch der Hauptweg ist): Der Nintendo-Login läuft in der App über eine Edge Function. Demo-Daten laden, RLS-Prüfung und das Deployen der Edge Functions sind manuell startbare GitHub-Workflows. Die `npm`-Skripte bleiben als zweiter Weg bestehen.
14. **Nintendo-Profile:** Alle Profile einer Konsole werden zusammengezählt, die Profil-ID wird mitgespeichert.

15. **Alte Nintendo-Historie (von Marcel bestätigt, ihm wichtig):** Import aus der Nintendo-Store-App über die **Ansicht pro Spiel**. Layout laut Beispiel-Screenshots (10.11.2026):
    - Kopf: Titel, «Zuerst gespielt», «Zuletzt gespielt», «Spieltage» (z. B. `316 T.`), «Spielzeit» (z. B. `685 Std. oder länger`, gerundet).
    - Darunter Liste, eine Zeile pro Tag: links Datum `TT.MM.JJJJ`, rechts `1 Std. 15 Min.`, `45 Min.` oder `Für kurze Zeit` (unter 15 Minuten). Beim Scrollen bleibt der Titel oben stehen.
    - Die Liste reicht bis zum ersten Spieltag zurück (im Beispiel 2021). Das Gerät steht nicht pro Tag dabei.
    - Umsetzung: Texterkennung im Browser (`tesseract.js`), Eingabe als viele Screenshots **oder** als Bildschirmaufnahme beim Scrollen (Einzelbilder werden im Browser herausgezogen). Doppelte Tage sind harmlos (Schlüssel Spiel + Gerät + Tag).
    - Kontrolle: Anzahl erkannter Tage gegen «Spieltage», Summe gegen «Spielzeit». Abweichungen werden angezeigt.
    - `Für kurze Zeit` zählt als 5 Minuten und gilt als geschätzt.
    - Einträge wie YouTube oder die Nintendo-64-App lassen sich als «kein Spiel» ausblenden.
    - Geplant als eigener Schritt **nach Phase 3** (braucht die Oberfläche). Der Startwert pro Spiel von Hand bleibt als schnelle Alternative.

## Offene Punkte

- [ ] Nach dem ersten echten Nintendo-Sync: Einheit, Anzahl Tage, Token-Gültigkeit und Titel prüfen (`platform_connections.details`), Fixtures mit anonymisierten echten Antworten ergänzen.
- [ ] Phase 5 / 7: Steam-Cover-Adressen und IGDB-Rate-Limit prüfen (in Phase 0 nicht neu recherchiert).
- [ ] Phase 8: Selbst-Wiedereinschalten des Cron-Workflows testen (60-Tage-Regel).
- [ ] Nach Phase 3: Import der Nintendo-Store-Historie per Screenshot/Video (siehe Entscheidung 15).
- [ ] Optional, Marcel: Schutz gegen geleakte Passwörter im Supabase-Projekt einschalten (betrifft auch den Kalender).

## Einrichtung (erledigt am 10.11.2026)

- Supabase-Projekt «Kalender / Game Bibliothek» (`vvgvlrwhnirooxoukbze`): Migration `0001_init.sql` ausgeführt, erlaubte E-Mail eingetragen, Schema `game_bibliothek` in der Data API freigegeben.
- `check-rls` von aussen: alle 11 Tabellen und `delete_demo_data()` ohne Login gesperrt.
- GitHub Pages aktiv: <https://masterplayer556.github.io/Game-Bibliothek/>. Login am Handy funktioniert.
- Demo-Daten über die App geladen (37 Spiele, 41 Plattform-Einträge, 337 Tageswerte, 614 Snapshots, 849 Erfolge, 2 Geräte). Damit ist auch der Weg über die echte Supabase-API geprüft.
- GitHub-Secrets gesetzt: `SUPABASE_SECRET_KEY`, `CREDENTIALS_ENCRYPTION_KEY`, `SUPABASE_ACCESS_TOKEN` (projektbezogen, nur dieses Projekt).

## Was spätere Phasen über Nintendo wissen müssen

**Daten in der Datenbank**
- Plattform `nintendo`, zwei Quellen (`source`): `nintendo-parental` (Jugendschutz-API) und `nintendo-import` (CSV).
- Nintendo-Einträge haben **nur Tageswerte** (`daily_playtime`), keine Snapshots. `platform_games.total_playtime_minutes`, `first_played_at` und `last_played_at` werden daraus berechnet (`recomputeDailyTotals` in `src/data/persist.ts`) und liegen fertig in der Tabelle.
- `achievements_unlocked` und `achievements_total` sind `null`: als «keine Erfolge» anzeigen, nicht als 0/0.
- `external_id`: bei der Jugendschutz-API die Application-ID in Grossbuchstaben (z. B. `0100F2C0115B6000`), beim Import `import:<titel>`. «Nintendo Switch 2 Edition» ist ein eigener Plattform-Eintrag, hängt aber über den Titel am selben Spiel (`game_id`).
- Geräte (`devices`): echte Konsolen mit Nintendos Geräte-ID und Art `switch1`/`switch2`; vom Import zusätzlich `import:switch1`, `import:switch2`, `import:switch-unknown` (Art `other`, «Switch (unbekannt)»). Für Auswertungen nach Gerät die **Art** (`kind`) verwenden, nicht die ID.
- `daily_playtime.details.players`: Minuten pro Profil. `estimated` ist beim Import für «Für kurze Zeit» gesetzt.

**Regel beim Lesen (wichtig für Statistiken)**
- Rohzeilen nie direkt summieren. Immer `resolveDailyRows` bzw. `buildPlayedDays` aus `src/core/playtime` benutzen und dabei `gameKey = game_id` setzen. Nur so wird ein Tag, den Import und Konsole beide kennen, einmal gezählt.
- Import-Zeilen werden nie gelöscht. Sie zählen einfach nicht, sobald eine andere Quelle für dasselbe Spiel und denselben Tag Daten hat.

**Verbindung**
- Session-Token verschlüsselt in `platform_credentials` (`adapter_id = nintendo-parental`, `kind = session_token`).
- `platform_connections.details` nach einem Sync: `unit` (erkannte Einheit), `days`, `devices`, `warnings`. `data_since` ist der früheste je gesehene Tag.

**Noch nicht mit echten Daten geprüft**
- Einheit von `playingTime`: Der Adapter nimmt Minuten an und erkennt Sekunden, sobald ein Wert über 1440 liegt. Erzwingen mit der GitHub-Variable `NINTENDO_PLAYTIME_UNIT` (`minutes` oder `seconds`).
- Welcher Token akzeptiert wird: zuerst der ID-Token, bei Ablehnung der Access-Token.
- Wie viele Tage `fetchDailySummaries` zurückliefert, und die Gültigkeit des Session-Tokens (steht nach dem Login in `token_expires_at`).
- Ältere Monate über `fetchMonthlySummary` sind nicht eingebaut: Das Format ist unbekannt, und die Monatsübersicht hat keine Werte pro Tag und Spiel.
- Die Edge Function ist nur in ihren Teilen getestet (Login-Logik, Verschlüsselung), nicht als Ganzes.
