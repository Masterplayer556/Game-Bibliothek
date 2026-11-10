# PROGRESS

Eine neue Session braucht nur den Projektauftrag (Prompt) und diese Datei. Details zur Architektur stehen in `ARCHITECTURE.md`.

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Plan | fertig (10.11.2026) |
| 1 | Grundgerüst | fertig (10.11.2026), Einrichtung durch Marcel offen |
| 2 | Nintendo | offen |
| 3 | App mit Demo-Daten | offen |
| 4 | Jahresrückblick | offen |
| 5 | Steam | offen |
| 6 | PSN | offen |
| 7 | IGDB | offen |
| 8 | Betrieb | offen |

## Nächster Schritt

**Phase 2 – Nintendo**, sobald Marcel das OK gibt. Vorher sinnvoll: Supabase-Projekt anlegen und die Schritte aus `SETUP-SUPABASE-GITHUB.md` ausführen, damit Phase 2 gegen eine echte Datenbank geprüft werden kann.

**Modell-Empfehlung:** Fable 5.2, `/effort high`. Begründung: inoffizielle Nintendo-API ohne echte Beispieldaten, Login über eine Edge Function und der Schutz vor Doppelzählungen beim Import.

## Was in Phase 1 gebaut wurde

- **App** (`src/app`, `src/components`, `src/lib`): Next.js 16, statischer Export, Tailwind 4. Startseite mit Login, Datenbank-Check, Plattform-Liste, Knöpfen «Demo-Daten laden/löschen» und einem Schlüssel-Generator. Alle Farben, Abstände und Schriften in `src/styles/tokens.css`.
- **Kern-Logik** (`src/core`, ohne Next.js und ohne Node): Typen, Zeitzone Europe/Zurich, Titel-Abgleich, Spielzeit-Regeln (`playtime/`), AES-256-GCM (`crypto.ts`), Adapter-Katalog, Demo-Daten (`demo/`).
- **Persistenz** (`src/data/persist.ts`): schreibt einen `SyncBatch`; von Sync-Skript und Browser benutzt.
- **Sync** (`sync/`): Adapter-Schnittstelle (`types.ts`), Runner mit Fehlerabfang pro Adapter (`runner.ts`), Registry (noch leer), Metadaten-Schnittstelle, Supabase-Store, Kommandozeile (`index.ts`).
- **Skripte** (`scripts/`): `seed-demo.ts`, `check-rls.ts`.
- **Datenbank**: `supabase/migrations/0001_init.sql` (alle Tabellen, RLS, Rechte, `delete_demo_data()`). **Noch nicht ausgeführt.**
- **Workflows**: `ci.yml` (lint, test, build bei jedem Pull Request), `deploy.yml` (GitHub Pages), `sync.yml` (nur manuell, Cron folgt in Phase 8), `tools.yml` (check-rls, seed-demo, clear-demo).
- **Tests**: 73, darunter Migration, Row Level Security und Persistenz gegen ein echtes Postgres im Speicher (PGlite).
- **Anleitungen**: `SETUP-SUPABASE-GITHUB.md`, `ADDING-A-PLATFORM.md`.

### Hinweise für spätere Phasen

- TypeScript ist auf Version 6 festgelegt, weil `typescript-eslint` Version 7 noch nicht unterstützt.
- Tailwind 4: Token-Namen dürfen sich zwischen den Gruppen nicht überschneiden (`--spacing-page` und `--container-page` kollidierten bei `max-w-page`).
- `supabase/testing/database.ts` enthält einen kleinen Ersatz für den Supabase-Client. Er kann nur die Aufrufe, die `src/data` und `sync/store.ts` benutzen. Neue Abfrage-Arten dort ergänzen.
- Der echte Weg über die Supabase-API (PostgREST) ist erst geprüft, wenn das Projekt existiert: einmal «Demo-Daten laden» in der App.
- Minecraft: Java Edition gibt es nicht auf Steam. In den Demo-Daten ist es ein manueller Eintrag (PC) und wird über den Titel mit Minecraft auf Switch und PS5 zusammengeführt.
- Die Demo-Daten für Steam und PS5 sind Snapshots, die für Nintendo Tageswerte auf zwei Konsolen.

## Antworten von Marcel

- Repo: **öffentlich**, `Masterplayer556/Game-Bibliothek`
- Adresse: `https://masterplayer556.github.io/Game-Bibliothek/`, `basePath` = `/Game-Bibliothek`
- Supabase: **neues** Projekt (noch nicht angelegt). Im Konto sind bereits zwei aktive Gratis-Projekte («Kalender (CC)», «Drive Pool»); der Gratis-Plan erlaubt nur zwei.
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


- [ ] Marcel: Supabase-Projekt anlegen (vorher eines der zwei bestehenden pausieren oder anders entscheiden) und den Namen nennen. Danach trägt Claude Adresse und öffentlichen Schlüssel in `.env.production` ein.
- [ ] Marcel: Schritte 2 bis 6 aus `SETUP-SUPABASE-GITHUB.md` (Migration, Login, GitHub Pages, Secrets, Prüfung).
- [ ] Import nach dem 13.06.2025: Gerät ist unbekannt. Vorschlag für Phase 2: importierte Tage ab diesem Datum einem Gerät «Switch (unbekannt)» zuordnen, Jugendschutz-Daten haben ohnehin Vorrang.
- [ ] Marcel: Jugendschutz-App mit **beiden** Konsolen verknüpfen, möglichst bald, damit bis Phase 2 Daten da sind.
- [ ] Phase 2: Einheit von `playingTime`, Anzahl Tage in `fetchDailySummaries` und Gültigkeit des Session-Tokens mit echten Daten prüfen.
- [ ] Phase 5 / 7: Steam-Cover-Adressen und IGDB-Rate-Limit prüfen (in Phase 0 nicht neu recherchiert).
- [ ] Phase 8: Selbst-Wiedereinschalten des Cron-Workflows testen (60-Tage-Regel).

## Was spätere Phasen über Nintendo wissen müssen

Wird in Phase 2 ergänzt.
