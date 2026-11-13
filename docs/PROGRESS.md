# PROGRESS

Eine neue Session braucht nur den Projektauftrag (Prompt) und diese Datei. Details zur Architektur stehen in `ARCHITECTURE.md`.

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Plan | fertig (10.11.2026) |
| 1 | Grundgerüst | fertig und eingerichtet (10.11.2026) |
| 2 | Nintendo | fertig (10.11.2026); Login und erster Sync mit echter Switch 2 erfolgreich, Prüfung echter Spielzeiten offen |
| 3 | App mit Demo-Daten | fertig (11.11.2026) |
| 4 | Jahresrückblick | fertig (11.11.2026) |
| 5 | Steam | fertig (11.11.2026); erster echter Sync am 12.11.2026 erfolgreich (36 Spiele, 1108 Erfolge) |
| 6 | PSN | fertig (13.11.2026); erster echter Sync erfolgreich (116 Spiele, 1433 Trophäen) |
| 7 | IGDB | gebaut (13.11.2026), Verbindung mit echten Zugangsdaten offen |
| 8 | Betrieb | offen |

## Nächster Schritt

1. **Marcel:** Twitch-App anlegen, `IGDB_CLIENT_ID` und `IGDB_CLIENT_SECRET` als GitHub-Secrets eintragen, Workflow «Edge Functions deployen» starten (`SETUP-IGDB.md`).
2. **Claude:** Sync mit IGDB starten und die Zuordnungen in der Datenbank prüfen (Trefferquote, falsche Treffer, Zusammenführungen).
3. **Marcel:** PSN-NPSSO einmal neu eintragen (die alte Version hatte sie nach dem ersten Sync gelöscht).
4. **Phase 8 – Betrieb**: Edge Function `trigger-sync` (Knöpfe «Jetzt synchronisieren» / «Verbindung testen» in der App), Schutz gegen das Abschalten des Cron nach 60 Tagen, alle Anleitungen final, README.

**Modell-Empfehlung:** Opus 5.5, `/effort high` für Phase 8. Danach optional Fable 5.2, `/effort high` für einen gezielten Sicherheits-Check (RLS, Edge Functions, Verschlüsselung).

## Was in Phase 7 gebaut wurde

- **IGDB-Client** `src/core/igdb/client.ts` (ohne Imports, die Edge Function nutzt eine Kopie): Twitch-Login (client credentials), Suche, Multiquery (10 Suchen pro Anfrage), Genres auf Deutsch, Cover `t_cover_big`.
- **Zuordnung** `src/core/igdb/match.ts`: Suchtitel ohne ®/™ und Plattform-Zusätze; Treffer bei exakt gleichem (auch alternativem) Titel oder Ähnlichkeit ≥ 0.6; Gleichstand → passende Konsole, dann Beliebtheit.
- **Sync-Schritt** `sync/metadata/enrich.ts` (nach den Plattformen, Anbieter in `sync/registry.ts`): bis 200 Nachschläge pro Lauf, Cache in `metadata_cache` (Migration `0003`, ausgeführt am 13.11.2026; Fehltreffer nach 30 Tagen neu), setzt `igdb_id`, Cover, Genres, Jahr (nie bei `igdb_locked`), führt Spiele mit gleicher IGDB-ID zusammen (nicht bei `game_link_locked`, eigene Notizen wandern mit). Status in `platform_connections` unter `igdb`. `npm run sync -- --mode=test --adapter=igdb` testet nur IGDB.
- **Edge Function** `igdb-search` (Secrets `GB_IGDB_CLIENT_ID`/`GB_IGDB_CLIENT_SECRET`, setzt der Workflow aus den GitHub-Secrets, falls vorhanden).
- **App**: Spiel-Detail «Cover und Genres (IGDB)» mit «Anderes Spiel wählen» / «Zuordnung entfernen» (setzt `igdb_locked`, holt ein Spiel mit gleicher IGDB-ID dazu); «Auf IGDB suchen» beim Hinzufügen; IGDB-Karte unter Plattformen.
- **PlayStation**: Jedes gespielte Spiel gilt als im Besitz, auch PS Plus (Entscheid Marcel, 13.11.2026).
- Anleitung `docs/SETUP-IGDB.md`.

## Was in Phase 6 gebaut wurde

- **Adapter** `sync/adapters/psn/`: `client.ts` kapselt die Bibliothek `psn-api` (MIT) hinter einer kleinen Schnittstelle (`PsnClient`); `adapter.ts` nutzt nur diese, darum testbar ohne Sony.
- **Anmeldung und Token-Rotation** (`authenticate`): zuerst der gespeicherte Refresh-Token; scheitert er, eine neu eingegebene NPSSO; sonst `auth_expired` («Neue NPSSO nötig»). Jeder neue Refresh-Token wird gespeichert (der Runner speichert Tokens vor den Daten). **Geändert am 13.11.2026:** Die NPSSO bleibt verschlüsselt gespeichert, weil Sonys Refresh-Token nur ~10 Tage gilt und sich beim Erneuern nicht verlängert (mit echtem Konto geprüft); läuft er ab, meldet sich der Sync mit der NPSSO neu an. `token_expires_at` ist bei gespeicherter NPSSO leer (Ablauf der NPSSO unbekannt). Netzwerkfehler gelten nicht als abgelaufene Anmeldung. `token_expires_at` = jetzt + `refreshTokenExpiresIn`.
- **Daten**: gespielte Spiele (`getUserPlayedGames`, Spielzeit aus ISO-8601-Dauer, erstes/letztes Spieldatum), gekaufte Spiele (`getPurchasedGames`; nie gestartete Käufe kommen mit 0 Minuten dazu; gespielte Spiele ohne Kauf gelten als nicht im Besitz; scheitert der Abruf, gilt alles als im Besitz), Trophäen (`getUserTrophiesForSpecificTitle` in Fünfergruppen, dann `getTitleTrophies` und `getUserTrophiesEarnedForTitle`) mit Typ und Seltenheit; höchstens 40 Spiele pro Lauf, nur bei geänderter Spielzeit. Gerät immer `ps5`.
- **Edge Function** `save-credential`: speichert die NPSSO verschlüsselt (nur erlaubte Arten, Format geprüft, auch die ganze `{"npsso":"…"}`-Zeile wird akzeptiert), löscht dabei einen alten Refresh-Token. Prüft Login und erlaubte E-Mail über `supabase/functions/_common/http.ts`, das jetzt auch `nintendo-login` nutzt. Der Workflow «Edge Functions deployen» lädt beide hoch.
- **App**: Karte «PlayStation verbinden» unter Plattformen (`src/components/PlayStationConnect.tsx`, `src/lib/credentials.ts`).
- Anleitung `docs/SETUP-PLAYSTATION.md`.

## Was in Phase 5 gebaut wurde

- **Steam-Client** `sync/adapters/steam/client.ts`: `GetOwnedGames` (inkl. kostenlose gespielte Spiele), `ResolveVanityURL` (STEAM_ID darf Zahl, Profilname oder Link sein), `GetPlayerAchievements`, `GetSchemaForGame` (deutsche Namen), `GetGlobalAchievementPercentagesForApp` (Seltenheit, liefert Prozent als Text). Der Key steht in der URL (Steam verlangt das); URLs werden nie geloggt.
- **Adapter** `steam`: Gesamtspielzeit und «zuletzt gespielt» pro Spiel → Snapshots; Cover `shared.akamai.steamstatic.com/store_item_assets/steam/apps/<id>/header.jpg`; `data_since` = erster Sync.
- **Erfolge sparsam:** nur für Spiele mit Stats und Spielzeit, beim ersten Lauf alle, danach nur bei geänderter Spielzeit; höchstens 150 Spiele pro Lauf, der Rest beim nächsten Sync. Spiele ohne Stats → `null` (keine Erfolge), unveränderte Spiele → bisherige Werte bleiben.
- `GetRecentlyPlayedGames` wird nicht gebraucht: `GetOwnedGames` liefert «zuletzt gespielt» schon für jedes Spiel.
- **Rückblick:** Das laufende Jahr erscheint erst ab Dezember (Wunsch von Marcel, `CURRENT_YEAR_OPENS_IN_MONTH` in `src/core/wrapped.ts`).
- Anleitung `docs/SETUP-STEAM.md`.

## Was in Phase 4 gebaut wurde

- **Seite** `/rueckblick/?year=…` (Navigation «Rückblick»): Karten im Story-Format (9:16) zum Wischen oder mit Pfeilen, Jahr wählbar.
- **Karten**: Jahr und Spielzeit, Vergleich Vorjahr, Top 5, Lieblingsplattform und -gerät, Lieblings-Genre (Platzhalter bis IGDB), Rekordtag und längste Serie, neu angefangene Spiele, Erfolge und seltenste Trophäe, aus dem Pile of Shame geholt, Hinweis auf nicht ganz erfasste Plattformen.
- **Rechenkern** `src/core/wrapped.ts` (rein, getestet): `buildWrapped`, `longestStreak`, `bestDay`, `availableYears`, `yearRange`.
- **Bild-Export** `src/lib/export-image.ts` (Bibliothek `html-to-image`, MIT): PNG in dreifacher Auflösung; am Handy über «Teilen», sonst als Download. Die Karten enthalten bewusst keine Cover-Bilder: Fremde Bilder ohne CORS würden den Export verhindern.
- **Markierungen**: * auf einer Karte heisst geschätzt; ein Vorjahr mit Lücken wird als «nur teilweise erfasst» genannt.

### Regeln im Jahresrückblick

- «Neu angefangen» = erstes Spieldatum (über alle Plattformen) im gewählten Jahr.
- «Aus dem Pile of Shame geholt» = vor dem 1. Januar schon angespielt, aber unter der Pile-Grenze, und im Jahr darüber. Nie gespielte Spiele zählen nicht, weil ohne Kaufdatum nicht erkennbar ist, ob sie schon auf dem Stapel lagen. Liefert PSN (Phase 6) ein Kaufdatum, kann die Regel erweitert werden.
- Das laufende Jahr zählt bis heute.

## Was in Phase 3 gebaut wurde

- **Seiten** (`src/app/*/page.tsx`): Übersicht (`/`), Bibliothek, Spiel-Detail (`/spiel/?id=…`), Statistiken, Pile of Shame, Erfolge, Hinzufügen, Plattformen. Navigation und Login in `src/components/AppShell.tsx` (im Layout).
- **Daten**: `src/lib/library-data.ts` lädt alle Tabellen einmal (`loadRawData`) und enthält alle Schreib-Aktionen (Status/Favorit/Notiz, Einstellungen, Zusammenführen, Abtrennen, manuell hinzufügen/löschen, Demo-Daten). `LibraryProvider` hält die Daten, `LibraryGate` zeigt Laden/Fehler.
- **Rechenkern** `src/core/library.ts` (rein, getestet): Spiele aus Plattform-Einträgen, gespielte Tage (über `buildPlayedDays`, `gameKey = game_id`), Top-Spiele, Verteilung nach Plattform/Gerät/Genre, Verlauf pro Woche/Monat, Pile of Shame, Filter/Sortierung, Spielzeit pro Gerät, veraltete Syncs. Für Phase 4 direkt wiederverwenden.
- **Diagramme**: Recharts für den Verlauf, HTML-Balken für Anteile (`src/components/charts.tsx`). Farben als Tokens in `tokens.css` (`--color-chart-1…8`, `--color-platform-*`, `--color-device-*`), Palette mit dem Validator für die dunkle Fläche geprüft. Jeder Verlauf hat eine Tabellenansicht.
- **Plattformen-Seite**: Status pro Quelle, Anleitungs-Links, Nintendo verbinden, Historie importieren, Demo-Daten, Schlüssel, Abmelden. «Jetzt synchronisieren» verlinkt bis Phase 8 auf den GitHub-Workflow.
- **Warnung** auf der Übersicht, wenn eine verbundene Quelle seit über 24 Stunden keinen erfolgreichen Sync hatte.

### Hinweise für spätere Phasen

- `tokens.css` nutzt `@theme static`: Tailwind 4 würde sonst Farbvariablen entfernen, die nur per `var(--…)` im Code vorkommen.
- **Geändert: Regel «geschätzt»** (`src/core/playtime`): Ein Snapshot-Tag gilt nur noch als geschätzt, wenn die Plattform kein «zuletzt gespielt» im Intervall liefert **und** die Lücke über 48 Stunden ist. Grund: Snapshots werden nur bei Änderung gespeichert, lange Lücken sind normal. Steam (Phase 5) und PSN (Phase 6) müssen darum `lastPlayedAt` liefern.
- Snapshots aus Batches (`SyncBatch.snapshots`) können jetzt `lastPlayedAt` mitgeben.
- Genres und «Anderes Spiel wählen» (IGDB) sind als Platzhalter eingebaut und kommen in Phase 7.
- Die Bibliothek lädt alles in den Browser. Bei einigen tausend Tageswerten kein Problem; erst bei sehr vielen Jahren Daten über serverseitige Summen nachdenken.

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
