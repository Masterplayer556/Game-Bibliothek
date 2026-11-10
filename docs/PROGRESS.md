# PROGRESS

Eine neue Session braucht nur den Projektauftrag (Prompt) und diese Datei. Details zur Architektur stehen in `ARCHITECTURE.md`.

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Plan | fertig (10.11.2026), wartet auf OK |
| 1 | Grundgerüst | offen |
| 2 | Nintendo | offen |
| 3 | App mit Demo-Daten | offen |
| 4 | Jahresrückblick | offen |
| 5 | Steam | offen |
| 6 | PSN | offen |
| 7 | IGDB | offen |
| 8 | Betrieb | offen |

## Nächster Schritt

**Phase 1 – Grundgerüst**, sobald das OK zum Plan da ist.

**Modell-Empfehlung:** Fable 5.2, `/effort high`. Begründung: Datenmodell, RLS und Verschlüsselung sind die Teile, die später am schwersten zu korrigieren sind.

## Antworten von Marcel

- Repo: **öffentlich**, `Masterplayer556/Game-Bibliothek`
- Adresse: `https://masterplayer556.github.io/Game-Bibliothek/`, `basePath` = `/Game-Bibliothek`
- Supabase: **neues** Projekt (noch nicht angelegt)
- Jugendschutz-App: **noch nicht** mit den Konsolen verknüpft
- Profile: Nur Marcel spielt. Es gibt mehrere Konten auf den Konsolen, alle gehören ihm; aktuell nutzt er eines.
- Bedienung: **alles über GitHub und die App, auch vom Handy.** Kein Node.js auf dem PC voraussetzen.
- Login: E-Mail und Passwort ist in Ordnung.
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


- [ ] Marcel: Wann kam die Switch 2 dazu, und hat das «…»-Menü der Store-App einen Konsolen-Filter? (Nötig, um importierte Tage einem Gerät zuzuordnen.)
- [ ] Marcel: Supabase-Projekt anlegen (Region Zürich oder Frankfurt) und den Projektnamen nennen.
- [ ] Marcel: Jugendschutz-App mit **beiden** Konsolen verknüpfen, möglichst bald, damit bis Phase 2 Daten da sind.
- [ ] Phase 2: Einheit von `playingTime`, Anzahl Tage in `fetchDailySummaries` und Gültigkeit des Session-Tokens mit echten Daten prüfen.
- [ ] Phase 5 / 7: Steam-Cover-Adressen und IGDB-Rate-Limit prüfen (in Phase 0 nicht neu recherchiert).
- [ ] Phase 8: Selbst-Wiedereinschalten des Cron-Workflows testen (60-Tage-Regel).

## Was spätere Phasen über Nintendo wissen müssen

Wird in Phase 2 ergänzt.
