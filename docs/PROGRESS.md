# PROGRESS

Eine neue Session braucht nur den Projektauftrag (Prompt) und diese Datei. Details zur Architektur stehen in `ARCHITECTURE.md`.

## Stand

| Phase | Inhalt | Status |
|---|---|---|
| 0 | Plan | fertig (10.11.2026) |
| 1 | Grundgerüst | fertig und eingerichtet (10.11.2026) |
| 2 | Nintendo | fertig (10.11.2026); erste echte Spielzeit am 13.11.2026 korrekt angekommen (Minuten) |
| 3 | App mit Demo-Daten | fertig (11.11.2026) |
| 4 | Jahresrückblick | fertig (11.11.2026) |
| 5 | Steam | fertig (11.11.2026); erster echter Sync am 12.11.2026 erfolgreich (36 Spiele, 1108 Erfolge) |
| 6 | PSN | fertig (13.11.2026); erster echter Sync erfolgreich (116 Spiele, 1433 Trophäen) |
| 7 | IGDB | fertig (13.11.2026); 98 von 122 Einträgen zugeordnet, Rest grösstenteils Apps |
| 8 | Betrieb | fertig (13.11.2026), Knöpfe warten auf `DISPATCH_TOKEN` |
| – | Sicherheits-Check und Polish | fertig (14.11.2026), keine kritische Lücke, Bericht in `SECURITY.md` |
| – | Design hell und dunkel | fertig (16.11.2026), «Lesesaal trifft Spielhalle» |
| – | Redesign «Liquid Arcade», Chronik | fertig (17.11.2026), ersetzt das Design und den Pile of Shame |

## Nächster Schritt

Alle Phasen sind gebaut. Offen:

1. **Marcel:** Nicht gefundene Spiele bei Bedarf im Spiel-Detail über «Anderes Spiel wählen» zuordnen.
2. **Marcel:** Weitere Switch-Spiele als Video aufnehmen und im Claude-Projekt mit dem Prompt aus `PROMPT-NINTENDO-VIDEO-IMPORT.md` in CSV-Dateien umwandeln; dann in der App importieren.
3. **Später:** Minecraft-Mods (`ADDING-A-PLATFORM.md`).

## Neue Funktionen (27.11.2026)

- **Aufgeräumt**: `src/core/library.ts` ist ein Ordner `src/core/library/` (rows, model, stats, series, filter, game, health, period); das Spiel-Detail hat eine Datei pro Karte (`src/components/game-detail/`). Die Rechnungen der Seiten Statistiken (Zeitraum, Summe mit/ohne Apps: `period.ts`) und Erfolge (seltene, neueste: `achievements.ts`) sowie die Regel für «selten» (`src/core/rare.ts`) liegen in `src/core` und sind getestet.
- **Bibliothek merkt sich Suche, Filter und Sortierung** für den Besuch (sessionStorage `gb-library-filter`, geprüft mit `readStoredFilter`): Spiel öffnen und zurück findet alles wieder. Neu: Filter «Nur Favoriten», Sortierung nach Erfolgs-Fortschritt und nach Erscheinungsjahr (Unbekanntes zuletzt).
- **«Was hole ich als Nächstes?»**: In der Erfolgsliste eines Spiels schaltet «Als Nächstes» die offenen Erfolge nach oben, den mit dem höchsten Anteil Spieler (den leichtesten) zuerst (`orderAchievements` in `achievements.ts`).
- **Bewertung und «Durchgespielt am»** (Migration `0006_rating_completed.sql`, am 27.11.2026 auf das Projekt angewendet): `game_user_data.rating` (1–5 Sterne) und `completed_on` (Tag). Im Spiel-Detail unter «Meine Angaben» (Stern nochmals tippen entfernt die Bewertung; Status «Durchgespielt» ohne Tag setzt heute), Anzeige im Kopf des Spiels, Sortierung «Bewertung» in der Bibliothek, Ereignis «Durchgespielt» in der Chronik (Filter «Start/Ziel») und im Rückblick die Karten «Durchgespielt» und «Bestbewertet» (nur wenn es etwas zu zeigen gibt; `finishedAndRated` in `wrapped.ts`).
- **Spieldauer im Vergleich** (Migration `0007_time_to_beat.sql`, am 27.11.2026 angewendet): Der Sync holt nach Cover und Genres für Spiele mit IGDB-Id die Spieldauer aus IGDBs eigenem Endpunkt `game_time_to_beats` (zügig, normal, komplett; `src/core/igdb/time-to-beat.ts`, bewusst getrennt von `client.ts`, das die Edge Function kopiert) nach `games.time_to_beat`, höchstens 500 Spiele pro Lauf, neu gefragt nach 30 Tagen. Scheitert das, bleiben Cover und Genres (nur eine Warnung im Log). Spiel-Detail: Karte «Spieldauer» («Hauptstory ca. 12 Std., du: 8 Std.»), Bibliothek: Sortierung «Kurze Spiele zuerst» (mit Status-Filter «Möchte spielen» für die Ferienplanung). Eine Korrektur der IGDB-Zuordnung von Hand setzt die Spieldauer zurück. `npm run igdb:check` (Workflow «Tools» → igdb-check) fragt den Endpunkt einmal ab.
- **Daten herunterladen** (Plattformen → Konto): «Sicherung (JSON)» liest alle eigenen Tabellen vollständig (`src/lib/backup.ts`, Format in `src/core/backup.ts`: `format`, `version`, `exportedAt`, `counts`, `tables`); Anmeldedaten sind nicht lesbar und darum nicht dabei. «Spieleliste (CSV)» schreibt eine Zeile pro Spiel (Semikolon, BOM für Excel CH). Auf dem iPhone öffnet sich das Teilen-Menü («In Dateien sichern»). Ein Backup per GitHub Actions wäre falsch: Artefakte eines öffentlichen Repos sind öffentlich.
- **Sync-Verlauf** (Plattformen, unter «Synchronisieren», einklappbar): die letzten 20 Läufe aus `sync_runs` mit Zeit, Art (Sync/Test, automatisch/per Knopf), Status, Dauer und dem Ergebnis pro Quelle; oben steht, welche Quelle wie oft fehlschlug (`recentRuns`, `runDurationMs`, `failuresBySource` in `src/lib/sync-control.ts`). Liest neu, sobald ein Lauf fertig ist. Keine neue Tabelle.
- **Sofortstart und offline**: Die zuletzt gezeigten Daten liegen im Browser (IndexedDB, `src/lib/offline-cache.ts`, pro Benutzer, beim Abmelden gelöscht). Beim Start stehen sie sofort da («Stand vom … · wird aktualisiert»), die Datenbank wird im Hintergrund gelesen; ohne Verbindung bleibt der gespeicherte Stand mit Datum. Ist der Zugangs-Token offline abgelaufen, startet die App mit dem gespeicherten Login und lädt neu, sobald er erneuert ist. Dazu ein Service Worker `public/sw.js` (ohne Bibliothek, Registrierung in `ServiceWorker.tsx`, nur im Build): Seiten zuerst aus dem Netz (nach 3,5 s oder offline aus dem Cache), Dateien unter `/_next/static/` aus dem Cache; Supabase und Cover laufen nie durch ihn. Alle Seiten werden bei der Installation geholt, damit jede offline aufgeht.

## Redesign «Liquid Arcade» (17.11.2026)

Wünsche von Marcel: Das Wechseln über die Leiste ruckelte stark; mit «Animationen» war ein Liquid-Glass-Effekt wie in der Leiste der Google-Drive-App gemeint, nur für die Leiste. Das Design war zu schlicht (Pixel-Icons, wenig Farbe, langweiliger Hintergrund): komplett neu, hell und dunkel dürfen verschieden aussehen. Pile of Shame entfernen; an seine Stelle kommt die **Chronik** (von Marcel gewählt aus Glücksrad, Chronik, Fast geschafft, Status-Regale). Unter Erfolge steht «Fortschritt pro Spiel» zuerst, mit einem Abschnitt pro Erfolg im Balken.

- **Ruckeln behoben**: Die Seitenwechsel mit Reacts `<ViewTransition>` sind weg (sie fotografierten bei jedem Tab-Wechsel die ganze Seite samt unscharfen Covern und schoben die Bilder herum). Neu blendet die Seite nur kurz ein (`page-enter`, nur `opacity` und `transform`). Cover zeichnen die unscharfe Kopie nur noch, wenn das Bild nicht hochkant ist (`fitCover` in `game-ui.tsx`, `data-fit` auf `.cover`), statt bei jedem Cover. Der Verlauf rechnet die Reihe nicht mehr bei jeder Wischbewegung neu (`useMemo`, der React Compiler ist in diesem Projekt nicht an). Gemessen mit 6-fach gedrosselter CPU (Produktions-Build, Demo-Daten): neue Seite nach 60–210 ms statt 240–360 ms, längster Hänger 67–167 ms statt bis 283 ms.
- **Liquid-Glass-Leiste** (`src/components/TabBar.tsx`, CSS `.tabbar`, `.tab-lens` in `design.css`): Ein Glastropfen liegt unter dem gewählten Tab und gleitet beim Antippen sofort mit einer Feder (CSS `linear()`-Kurve `--ease-spring`, ~8 % Überschwingen) zum neuen Tab; unterwegs schwillt er an, dehnt sich in Bewegungsrichtung (weiter = stärker) und bekommt helle Glasränder (`.tab-lens-shine`). Gedrückt halten und entlang der Leiste ziehen hebt den Tropfen an, er folgt dem Finger, das Icon darunter wird grösser; loslassen öffnet die Seite darunter. «Mehr» auf dem Handy funktioniert wie bisher (Leiste rutscht), der Tropfen wartet dabei auf «Mehr». Ab Tablet-Breite alle acht Seiten in einer Leiste mit vollen Namen. Bewegt wird nur `translate`, `scale` und `opacity`, die Animation läuft auch weiter, während die neue Seite aufgebaut wird.
- **Neues Design** (`tokens.css`, `design.css`): hell «Tag» mit bunten Farbwolken und einer Tapete aus kleinen Spiele-Symbolen (△ ○ ✕ □, Steuerkreuz, Stern, Herz, Münze, Blitz); dunkel «Arcade-Nacht» mit Neon-Schein, Sternen und einem leuchtenden Gitter am Horizont in der Farbe des Bereichs. Jeder Bereich hat einen eigenen Farbverlauf (`--color-section-<name>-a/-b/-ink`, gesetzt mit `sectionStyle` aus `src/components/section.ts`), Karten und Kacheln nehmen auch Farben anderer Bereiche (`tone`), damit eine Seite nicht einfarbig wirkt. Karten sind getöntes Glas ohne Unschärfe-Filter (günstig beim Scrollen); echtes Milchglas nur für Kopfleiste und Leiste. Schrift: Bricolage Grotesque (Titel und Zahlen, `@fontsource-variable/bricolage-grotesque`), sonst die Systemschrift; Fraunces und Jersey 15 sind entfernt.
- **Icons** (`src/components/Icon.tsx`): Vektor-Icons in zwei Tönen statt Pixel-Icons, in Kacheln mit glänzendem Farbverlauf wie App-Icons.
- **Cover**: abgerundet mit Glanz; Status als farbige Pille, Favorit als Herz; Spiele ohne Bild bekommen einen Farbverlauf mit Initialen.
- **Seiten**: Übersicht mit grosser «Zuletzt gespielt»-Bühne (Cover-Stimmung, weisse Schrift), farbigen Kennzahl-Kacheln, «Davor gespielt» zum Wischen und Top 5 mit Krone; Bibliothek als Raster (drei Spalten auf dem Handy) oder Liste; Spiel-Detail mit Bühne und Geräte-Balken; Rückblick-Karten als Farbverlauf-Karten in Bereichsfarben (weiterhin als Bild speicherbar); Anmeldung mit Logo-Bühne.
- **Erfolge**: «Fortschritt pro Spiel» steht zuerst (12 Spiele, dann «Alle zeigen»). `SegmentedProgress` in `ui.tsx` teilt den Balken in so viele Abschnitte, wie das Spiel Erfolge hat (Exit 8: 4, Minecraft: 137); die Lücken werden mit wachsender Zahl schmaler (4 px bis 0.75 px), über 400 Erfolge ist es ein durchgehender Balken. Komplett = Gold. Dieselben Balken im Spiel-Detail.
- **Chronik** (`/chronik/`, Logik `src/core/chronicle.ts`, getestet): Zeitstrahl nach Jahr und Monat, neueste zuerst, mit Jahres-Zusammenfassung (Stunden, Spieltage, meistgespieltes Spiel). Ereignisse: erstmals gespielt; 10, 25, 50, 100, 250, 500, 1000, 2000 Stunden in einem Spiel (gezählt ab der Zeit vor der Erfassung, also nur Marken, die nach dem ersten Sync fielen); alle Erfolge eines Spiels; Platin; seltene Erfolge (Grenze wie unter Erfolge eingestellt); erster Tag auf einer Konsole (nur wenn die Plattform da schon erfasst wurde, z. B. Switch 2); Beginn der Erfassung pro Plattform. Filter Alles / Starts / Stunden / Erfolge, 60 Einträge, dann «Weiter zurück».
- **Chronik «erstmals gespielt» korrigiert** (Wunsch Marcel, 17.11.2026; Anlass: Detroit erschien als neu, obwohl es schon 27 Std. hatte): Der Eintrag erscheint nur noch für Spiele, die seit Beginn der Erfassung neu sind (`newSinceTracking` in `chronicle.ts`): beim ersten Sync mit 0 Minuten, oder erst nach dem ersten Sync ihrer Plattform aufgetaucht. Hatte ein Spiel beim ersten Sync schon Zeit, gibt es keinen Eintrag. Hat ein Switch-Spiel importierte Historie, verschwindet der Eintrag, auch wenn er vorher schon zu sehen war (die Chronik wird jedes Mal neu berechnet). «Erster Tag auf einer Konsole» nutzt nur noch Tageswerte (nicht Snapshots), sonst erschien z. B. ein «erster Tag auf PC». «Davor gespielt» auf der Übersicht hat links wieder Abstand (Einrasten berücksichtigt den Innenabstand, `scroll-px-card`).
- **Pile of Shame entfernt**: Seite, Logik (`pileOfShame`) und das Häkchen im Spiel-Detail. Die Spalte `hide_from_pile` und die Einstellung `pileThresholdMinutes` bleiben in der Datenbank (keine Migration), werden aber nicht mehr benutzt. Die Rückblick-Karte «Aus dem Pile of Shame geholt» heisst jetzt **«Wiederentdeckt»** (gleiche Regel mit fester Grenze 60 Minuten, `REDISCOVER_MINUTES` in `wrapped.ts`).
- **Startbilder** neu gerendert (dunkler Hintergrund mit Gitter, neue Schrift); das App-Icon bleibt.

**Nachtrag 18.11.2026** (Wünsche von Marcel):

- **Leiste ruckelte noch**: Der Glastropfen und die rutschende Handy-Leiste bewegen sich nur noch über `transform` (äusseres `.tab-lens` gleitet, inneres `.tab-lens-body` schwillt an), das läuft auf der Grafikkarte weiter, während die neue Seite aufgebaut wird. Beim Ziehen wird die Leiste nur einmal beim Start vermessen und der Tropfen höchstens einmal pro Bild bewegt; nach dem Loslassen schwillt er nicht nochmals an. Der angehobene Tropfen wird oben und unten nicht mehr abgeschnitten (`.tab-viewport` schneidet nur seitlich ab).
- **Demo-Daten entfernt** (Karte, Laden/Löschen, Skript `seed-demo`, Tools-Aufgaben); der Beispiel-Datensatz lebt nur noch als Testdaten (`src/testing/sample-library.ts`). Migration `0004_drop_delete_demo_data.sql` entfernt die Funktion `delete_demo_data()` (von Marcel im SQL-Editor ausgeführt am 18.11.2026, geprüft); `check-rls` prüft sie nicht mehr. Karten «PlayStation/Nintendo verbinden» und «Nintendo-Historie importieren» lassen sich einklappen (`Card collapsible`), der Schlüssel-Erzeuger ist eine kleine Zeile in «Konto».
- **Nintendo-Import mit mehreren Dateien**: Im Dateifeld lassen sich mehrere CSV-Dateien auf einmal wählen. Jede wird einzeln gelesen (Übersicht pro Datei), dann zu einem Import vereint (`combineImports` in `src/core/nintendo/import.ts`, getestet): Derselbe Tag in mehreren Dateien zählt einmal, die längere Dauer gilt; unlesbare Zeilen nennen ihre Datei.
- **DELTARUNE im Nintendo-Import** (`VARIANTS` / `importVariant` in `src/core/nintendo/import.ts`): Demo («Chapter 1&2»), Switch-1- und Switch-2-Version werden ein Spiel «DELTARUNE»; die Version bestimmt die Konsole (Demo und Switch-1-Version = Switch 1, «Switch 2 Edition» = Switch 2; reines «DELTARUNE» nimmt die Gerät-Spalte, sonst Switch 1). Demo und Vollversion am selben Tag werden addiert (nicht als Doppelzeile verworfen: Zeilen merken sich ihren Originaltitel `listedAs`). Weitere Spiele mit Versionen lassen sich in `VARIANTS` ergänzen.
- **Pokémon HOME** ist eine App wie YouTube (`src/core/apps.ts`; der Sync markiert es einmal als «Kein Spiel»).
- **App-Zeit mitzählen** (Einstellung `countAppsInTotal`, Checkbox in Statistiken → «Apps (kein Spiel)»): zählt App-Zeit zur Spielzeit (Statistiken «Spielzeit», Übersicht «Diese Woche», «Diesen Monat», «Gesamt»). Ranglisten, Diagramme und Rückblick bleiben nur Spiele.
- **Schlüssel-Erzeuger fragt nach** («Bist du sicher?»): Am 18.11.2026 wurde aus Versehen ein neuer `CREDENTIALS_ENCRYPTION_KEY` eingetragen; danach konnte der Sync die gespeicherten Anmeldungen von PlayStation und Nintendo nicht mehr lesen. Der Sync meldet das jetzt auf Deutsch als «Anmeldung abgelaufen» mit Hinweis (alter Schlüssel zurück oder neu verbinden), und eine Karte, die während des Besuchs dringend wird, klappt von selbst auf.
- **Spieltage-Kalender** (`PlayCalendar.tsx`, `--color-heat-0…8`): eine Farbstufe pro Stunde (unter 1, 1, 2, 3 Std.), volles Lila ab 4 Std., danach Richtung Weiss: ab 5 Std. etwas, ab 7 Std. mehr, ab 10 Std. `#FFFFFF`. Stufe 1 ist deutlich stärker als «nicht gespielt». Im hellen Modus liegt das Raster (und die Legende) auf einem dunklen «Bildschirm» (`.heat-screen`) mit den Farben des dunklen Modus, damit Lila bis Weiss gleich leuchtet wie nachts (Wunsch Marcel). Nur DELTARUNE wird im Import zusammengelegt; andere Demos bleiben eigene Spiele.
- **Sync-Knopf**: hat nie funktioniert, GitHub lehnt `DISPATCH_TOKEN` ab (die «manuellen» Läufe kamen alle aus dem Actions-Tab). `trigger-sync` nennt jetzt den Grund (401/403/404/422). Marcel hat am 18.11.2026 einen neuen Token erstellt und die Functions neu deployt; der erste Sync per Knopf lief gleich danach erfolgreich.
- **3D-Pixel-Icons** für die Seiten (`src/components/PixelIcon.tsx`): jeder Pixel ein Würfel mit heller Oberseite und dunkler rechter Seite (Vorbild: ein Voxel-Pokal von Marcel), feste Farben pro Icon, 12 × 12 Raster. In der Leiste und gross im Seitentitel; die kleinen Icons in Karten bleiben Vektor-Icons (`Icon.tsx`).
- **Neues App-Icon** (`design/app-icon.svg`, ausdrücklich ohne Pixel): drei aufgefächerte Spiele-Cover in Bereichsfarben (○, ★, △) hinter einem Tropfen aus Liquid Glass (die Szene dahinter unscharf, heller Rand, Glanz), darauf ein weisser Controller; dahinter die Arcade-Nacht mit Neon-Wolken, Spiele-Symbolen und leuchtendem Gitter am Horizont. Icons, Favicon und Startbilder neu gerendert mit `node scripts/render-app-images.mjs`.

## Design «Lesesaal trifft Spielhalle» (16.11.2026)

Wunsch von Marcel: ein Design für hell und eines für dunkel, das zum Namen passt (Game und Bibliothek gemischt).

- **Idee**: Tinte und Messing. Wörter gehören der Bibliothek (Serifenschrift Fraunces für Titel), Zahlen gehören dem Spiel (Pixelschrift Jersey 15 für Kennzahlen und Ränge). Cover sind gebundene Bücher (Buchrücken-Kante) und stehen auf einem Regalbrett; Spiele ohne Cover bekommen einen Leineneinband mit goldenen Initialen; Favoriten ein Lesezeichen-Band; Karten sind Karteikarten mit gestrichelter Pixel-Linie; die Navigation sind Registerreiter; Knöpfe drücken sich wie Tasten; Fortschritt in zehn Blöcken, bei 100 % in Messing. Im Spiel-Detail steht eine Signatur wie auf einem Buchrücken (Plattform · Jahr · Titel, «o. J.» ohne Jahr).
- **Hell und dunkel sind dasselbe Design**: nur die Farben in `src/styles/tokens.css` unterscheiden sich (oberer Block hell: Papier und Tintenblau; unterer Block `:root[data-theme="dark"]`: Nachtblau und leuchtendes Blau; Messing in beiden). Sonderformen (Buch, Regal, Taste …) stehen in `src/styles/design.css` und nutzen nur Tokens.
- **Umschalten**: drei Knöpfe oben rechts (wie das Gerät / hell / dunkel), `src/components/ThemeToggle.tsx` und `src/lib/theme.ts`. Die Wahl liegt nur im Browser (`localStorage`, Schlüssel `gb-theme`); ein kleines Skript im `<head>` setzt `data-theme` vor dem ersten Bild.
- **Schriften** liegen im Projekt (`@fontsource-variable/fraunces`, `@fontsource/jersey-15`), es gibt keine Anfrage an einen Schriften-Dienst.
- **Logo**: Buch mit goldenem Steuerkreuz (`src/components/Logo.tsx`, als Favicon `src/app/icon.svg` mit denselben Farben fest eingetragen).
- **Diagramme**: Die acht Plattform- und Gerätefarben haben pro Theme eigene, geprüfte Stufen; der Spielzeit-Verlauf nutzt die Akzentfarbe (`--color-chart-bar`).
- Eingabefelder sind auf dem Handy 16 px gross (iOS zoomt sonst hinein).

**Zweite Runde am selben Tag** (Wunsch: mehr Detail, weniger schlicht, mehr Abwechslung):

- **Eine Farbe pro Bereich** (`--color-section-*` in `tokens.css`, wie farbige Registerkarten): Reiter, Karten-Icons, Kachel-Kanten und Balken einer Seite nehmen die Farbe ihres Bereichs (`--section`, gesetzt in `AppShell.tsx`). Das Spiel-Detail gehört zur Bibliothek.
- **Pixel-Icons** (`src/components/PixelIcon.tsx`, 12 × 12 Raster) in den Reitern, Kartentiteln und Kacheln.
- **Übersicht**: grosses Feld «Zuletzt gespielt» mit dem Cover als verschwommenem Hintergrund (`CoverBackdrop`), Kennzahlen und 14-Tage-Balken; Top 5 mit Block-Balken (Platz 1 in Messing); **Spieltage-Kalender** (`PlayCalendar.tsx`, ein Quadrat pro Tag, auch unter Statistiken).
- **Cover**: Status als Stempel («Durchgespielt», «Am Spielen» …), Buch kippt beim Überfahren.
- **Spiel-Detail**: Kopf mit Cover-Stimmung als Hintergrund.
- **Pile of Shame**: ein Stapel liegender Bücher (Buchrücken mit Goldbändern) statt einer Liste.
- **Erfolge**: Fortschritts-Ring; PlayStation-Trophäen mit Pokal in Bronze, Silber, Gold oder Platin (`Medal`, nur wo Sony eine Stufe liefert).
- **Seitenfuss**: kleines Regal mit Buchrücken; Lichtschein von oben im Hintergrund; «Datenbasis» als Notizzettel.

**Dritte Runde** (alle Ideen aus der zweiten Runde, von Marcel bestätigt; die Farbe pro Bereich bleibt):

- **Spieltage-Kalender antippbar**: Ein Tag zeigt darunter die Spiele dieses Tages mit Zeit und Link. Auf dem Handy gibt es keine halb abgeschnittenen Wochen mehr.
- **Bibliothek als Regal oder Liste** (Schalter «Ansicht», gemerkt im Browser unter `gb-library-view`); die Liste zeigt Cover, Plattformen, Status, zuletzt gespielt und Spielzeit.
- **Seltene Erfolge**: Marke «Selten», wenn weniger als 10 % der Spieler ihn haben (`RARE_PERCENT` in `src/components/ui.tsx`), für Steam und PlayStation.
- **Rückblick**: jede Karte mit Farbverlauf und Icon in ihrer Farbe; Cover auf der Startkarte (Top 3 gefächert), in den Top 5, beim Rekordtag und bei «Neu angefangen». Beim Speichern als Bild wird ein Cover weggelassen, wenn sein Server den Abruf verweigert (`imagePlaceholder` in `src/lib/export-image.ts`); mit echten Covern von Steam, Sony und IGDB noch nicht ausprobiert.

**Vierte Runde** (Wünsche von Marcel, 16.11.2026):

- **Zeit vor dem ersten Sync zählt mit** (Anlass: PlayStation zeigte unter Statistiken nur 15 Std., obwohl allein GTA V fast 300 Std. hat). Die Plattformen melden diese Zeit nur als Gesamtzahl ohne Datum. `undatedTime` in `src/core/library.ts` rechnet pro Eintrag «Gesamt minus Tage mit Datum»; unter Statistiken zählt sie im Zeitraum **«Alles»** (neu die Voreinstellung) bei Spielzeit, Top-Spielen, Plattformen, Geräten und Genres mit (`lifetimeTopGames`, `lifetimeDistribution`). Kürzere Zeiträume können sie nicht enthalten, weil das Datum fehlt; dort steht ein Hinweis, ab wann eine Plattform Tageswerte hat. Im Spiel-Detail zeigt «Spielzeit nach Plattform und Gerät» jetzt auch den Rest vor den Tageswerten.
- **Cover ganz sichtbar**: Bücher sind hochkant (3:4), das Bild wird nie beschnitten (IGDB hochkant, Steam quer, PlayStation quadratisch); der freie Rand ist eine unscharfe Kopie des Bildes.
- **Kalender blättern**: ‹ › zeigt frühere Jahre.
- **Liste sortieren**: Spaltenköpfe Name, Zuletzt, Spielzeit.
- **«Selten» einstellbar** auf der Seite Erfolge: höchstens 10, 5, 3, 2, 1 % oder unter 1 % der Spieler (Einstellung `rareLimit` in `app_settings`); dazu die Kachel «Seltene geschafft».

**Fünfte Runde: wie eine App** (Wünsche von Marcel, 16.11.2026):

- **App-Rahmen** (`src/components/AppShell.tsx`): oben eine Glasleiste mit Logo und Hell/Dunkel, darunter ein grosser Seitentitel mit Icon und Untertitel; unten eine schwebende Glasleiste (Vorbild: die Leiste unten in Apps wie Google Drive) mit Übersicht, Bibliothek, Statistiken, Erfolge und «Mehr» (Pile of Shame, Rückblick, Hinzufügen, Plattformen). Ab Tablet-Breite stehen alle acht direkt in der Leiste. Das Spiel-Detail hat «Zurück» statt eines Titels.
- **Als App auf dem Home-Bildschirm**: `src/app/manifest.webmanifest`, `appleWebApp` in `layout.tsx`, `viewportFit: cover` mit Abständen für Notch und Home-Leiste.
- **App-Icon** (`design/app-icon.svg`, daraus `src/app/icon.svg`, `src/app/apple-icon.png`, `public/icon-96/192/512.png`): Buch mit goldenem Steuerkreuz und Lesezeichen auf einem Messing-Regal neben zwei Buchrücken, Pixel-Sterne, Hintergrund Tintenblau bis Violett. Das Logo oben ist dasselbe Bild. (Seit 18.11.2026 ersetzt, siehe «Liquid Arcade».)
- **Lebhaftere Themes**: kräftigere Bereichsfarben, ein farbiger Schein hinter der Seite in der Farbe des Bereichs (`app-backdrop`), Karten als weisse bzw. dunkle Blätter mit hellem Rand oben (`sheet`), Icons auf farbigen Kacheln (`icon-tile`), runde Schalter und grössere Rundungen.
- **Pile of Shame**: Bücher über die ganze Breite, Titel mittig und bis zwei Zeilen; Spielzeit links, ⋯-Menü rechts («Spiel öffnen», «Vom Stapel nehmen») statt der grossen Knöpfe.
- **Erfolge**: Karte «Deine seltensten Erfolge» (seltenster zuerst, mit %; gleiche Erfolge auf PC und PlayStation einmal), die Kachel «Seltene» springt dorthin. Kacheln auf dem Handy nicht mehr abgeschnitten.

**Sechste Runde** (16.11.2026): Steuerkreuz im App-Icon mit deutlich eingravierten Pfeilen (Marcel fand die Fassung mit Pfeilen besser). **Startbilder** für die Home-Bildschirm-App auf dem iPhone (`public/splash/`, je eine pro iPhone-Grösse, eingebunden über `appleWebApp.startupImage` in `layout.tsx`). Icon und Startbilder entstehen mit `node scripts/render-app-images.mjs` aus `design/app-icon.svg` (braucht Playwright mit Chromium). **Bibliothek**: Filter in einem ausklappbaren Glas-Feld neben der Suche (Knopf «Filter» zeigt die Zahl aktiver Filter, «Filter zurücksetzen»). **Pile of Shame**: Das ⋯-Menü der untersten Bücher klappt nach oben auf, damit die Leiste unten es nicht verdeckt.

**Siebte Runde: Bewegung** (Wunsch Marcel, 16.11.2026): Auf dem Handy rutscht die Leiste unten beim Antippen von «Mehr» um vier Plätze nach links: «Mehr» landet am linken Rand (Punkte werden zum Pfeil), Pile, Rückblick, Hinzufügen und Plattformen rücken nacheinander von rechts nach; nochmals «Mehr» fährt zurück. Kein Glas-Fenster mehr (`PhoneTabBar` in `AppShell.tsx`, Klassen `tab-track`, `tab-following` in `design.css`). Dazu schlichte Bewegungen: neue Seiten steigen kurz ein, Tasten drücken sich ein, Menüs ploppen auf, das Filter-Feld gleitet herunter, Sprünge innerhalb der Seite scrollen weich. Mit «Bewegung reduzieren» auf dem Gerät ist alles aus.

**Seitenwechsel gleiten** (Wunsch Marcel, 17.11.2026): Beim Wechsel über die Leiste gleitet die alte Seite zur Seite hinaus und die neue folgt von der anderen Seite: zu einem Reiter weiter rechts nach links, zu einem weiter links nach rechts. Gebaut mit Reacts `<ViewTransition>` (in `AppShell.tsx` um Seitentitel und Inhalt, mit `key` = Pfad; der Datenspeicher `LibraryProvider` liegt ausserhalb und bleibt erhalten) und `transitionTypes` an den Reiter-Links («nav-forward» / «nav-back»). Andere Seitenwechsel (Spiel öffnen, Zurück) blenden kurz über. Die Leisten oben und unten haben eigene Namen, damit die Seiten darunter durchgleiten. Browser ohne View Transitions zeigen stattdessen das kurze Einblenden; mit «Bewegung reduzieren» ist alles aus. CSS am Ende von `design.css`.

**Steam-Cover hochkant** (Wunsch Marcel, 16.11.2026): Der Steam-Adapter speichert jetzt `library_600x900.jpg` (das Cover aus der Steam-Bibliothek) statt des queren `header.jpg`. Bestehende Einträge bekommen es beim nächsten Sync. Fehlt das hochkante Bild (ältere oder kleine Spiele), zeigt die App automatisch wieder das quere (`steamCoverFallback` in `src/components/game-ui.tsx`). Spiele mit IGDB-Zuordnung zeigen weiterhin das IGDB-Cover, das ohnehin hochkant ist.

## Verlauf und Nintendo-Historie (16.11.2026)

- **Historie-Import per Video** (Entscheidung 15, erster Lauf): Marcel nimmt die Spielaktivitäten eines Spiels in der Nintendo-Store-App als Bildschirmaufnahme auf; Claude liest die Zeilen aus Einzelbildern (ffmpeg, ein Bild alle 2 Sekunden reicht bei ruhigem Scrollen) und erzeugt die CSV im Import-Format. Kontrolle: Anzahl Zeilen = «Spieltage» im Kopf der App. Die Summe ist kleiner als «Spielzeit» im Kopf, weil die App jeden Tag auf Viertelstunden abrundet. Die CSV kommt nicht ins Repo; Marcel lädt sie unter Plattformen hoch.
  - Minecraft for Nintendo Switch: 317 Tage (09.12.2021–13.11.2026), 659 Std. 5 Min., importiert am 16.11.2026, hängt am Spiel «Minecraft» (mit PS5). Gerät: vor dem 13.06.2025 Switch 1, danach Switch 2.
- **Verlauf im Spiel-Detail** (`src/components/PlaytimeHistory.tsx`, Wunsch von Marcel): Tage, Wochen, Monate oder Jahre; ‹ / › oder seitlich wischen verschiebt den Zeitraum, «Zurück zu heute». Beim Wechsel der Einteilung bleibt der Zeitpunkt am rechten Rand gleich (`src/core/history-window.ts`). `playtimeSeries` kennt dafür `day` und `year`.
- **Statistik-Seite**: derselbe Verlauf über alle Spiele (oben); der Zeitraum-Filter gilt nur noch für Zahlen und Listen darunter.
- **Prompt für ein Claude-Projekt** (`docs/PROMPT-NINTENDO-VIDEO-IMPORT.md`): Videos hochladen → CSV pro Spiel, mit Prüfung gegen «Spieltage».
- **Erfolge nach Plattform** (`src/core/achievements.ts`): Wähler «Zusammen / PC / PlayStation» auf der Seite Erfolge und im Spiel-Detail. Steam-Erfolge und PS-Trophäen sind getrennte Listen; eine Trophäe schaltet nie einen Steam-Erfolg frei. «Zusammen» legt Erfolge mit gleichem Namen zusammen (geschafft, wenn auf einer Plattform freigeschaltet); fehlt eine Liste teilweise, werden die Zahlen addiert.
- **Trophäen auf Deutsch** (`TROPHY_LANGUAGE` in `sync/adapters/psn/adapter.ts`, Wunsch 16.11.2026): Sony lieferte die Namen auf Englisch, Steam auf Deutsch, so passten keine Namen zusammen. Der Sync liest die alten Listen nach und nach neu (40 Spiele pro Lauf, Fortschritt in `platform_connections.details.trophyLanguageDone`, danach `trophyLanguage: "de-DE"`). Nebenbei behoben: Beim ersten PSN-Sync mit mehr als 40 Spielen wurden die übrigen Trophäen-Listen nie gelesen.
- **Gerät beim Import** (von Marcel bestätigt, 16.11.2026): vor dem 13.06.2025 Switch 1, ab dann nur noch Switch 2, für alle Spiele. Der Video-Prompt trägt das so ein; Minecraft ist entsprechend importiert.
- **Geschätzte Balken**: hell nur noch, wenn mindestens die Hälfte der Zeit geschätzt ist (`SeriesPoint.estimatedMinutes`); der Tooltip nennt den geschätzten Anteil. Vorher machte ein einziger «Für kurze Zeit»-Tag ein ganzes Jahr hell.

## Sicherheits-Check und Polish (14.11.2026)

Bericht mit allen Funden, bewusst offenen Punkten und «Was tun, wenn ein Schlüssel bekannt wird»: `docs/SECURITY.md`. Die Datenbank wurde nicht geändert.

- **Workflows**: Aktionen auf feste Commits festgelegt (`.github/dependabot.yml` schlägt monatlich Aktualisierungen vor), `persist-credentials: false`, `SUPABASE_ACCESS_TOKEN` nur in den Schritten, die ihn brauchen. Der Sync-Job hat nur noch `contents: read`; das Wiedereinschalten (60-Tage-Regel) ist ein eigener Job `keep-alive` mit eigenem Zeitplan (montags, `43 4 * * 1`) und `actions: write`.
- **Edge Functions**: unbestätigte E-Mail gilt nicht als Anmeldung; `trigger-sync` markiert den Lauf als Fehler, wenn GitHub nicht erreichbar ist.
- **Sync**: `sync/index.ts` prüft seine Optionen (`--adapter`, `--run-id`); die Metadaten-Anbieter laufen über `sync/metadata/run.ts` (Fehlertexte ohne Secrets, «nicht verbunden» erscheint im Ergebnis). Nach jedem Lauf räumt `store.tidyRuns` auf: Läufe ohne Rückmeldung (über 30 Minuten offen) werden geschlossen, Läufe älter als 90 Tage gelöscht.
- **IGDB**: Twitch-Secret im Inhalt der Anfrage statt in der Adresse.
- **App**: Ein Lauf ohne Rückmeldung (über 15 Minuten offen) sperrt die Sync-Knöpfe nicht mehr und wird als «keine Rückmeldung» gezeigt. `referrer: no-referrer`. Texte zu NPSSO und Sync stimmen wieder (NPSSO bleibt gespeichert; Sync per Knopf).
- **Aufgeräumt**: Aufrufe von Edge Functions über `src/lib/functions.ts` (`invokeFunction`, `FunctionError`), Fehlertexte über `src/lib/errors.ts`; `availableFromPhase` / `BUILT_UP_TO_PHASE` entfernt (alle Adapter sind gebaut); alle seitenweisen Abfragen (`fetchAll`) haben eine feste Reihenfolge.
- **`check-rls`** prüft zusätzlich `is_allowed_email()` und alle vier Edge Functions ohne Login.
- **Tests**: 219 (neu: Lauf-Protokoll, Metadaten-Lauf, Function-Aufrufe, Nintendo-Link-Prüfung).

## Was in Phase 8 gebaut wurde

- **Edge Function** `trigger-sync`: legt einen Eintrag in `sync_runs` an und startet den Workflow «Sync» per `workflow_dispatch` mit dessen ID; verweigert einen zweiten Lauf, solange einer in den letzten 15 Minuten nicht fertig ist (gibt dann dessen ID zurück). Secrets `GB_GITHUB_DISPATCH_TOKEN` / `GB_GITHUB_REPO` setzt der Workflow «Edge Functions deployen» aus dem GitHub-Secret `DISPATCH_TOKEN`.
- **App**: Karte «Synchronisieren» unter Plattformen (`src/components/SyncControls.tsx`, `src/lib/sync-control.ts`) mit «Jetzt synchronisieren» / «Verbindung testen» für alle oder eine Quelle; zeigt den letzten Lauf (auch geplante), fragt alle 5 Sekunden nach, zeigt danach das Ergebnis pro Quelle und lädt die Daten neu.
- **60-Tage-Regel**: Der Sync-Workflow schaltet sich montags über die API selbst wieder ein (seit 14.11.2026 als eigener Job `keep-alive`, siehe oben). Dazu die Warnung bei über 24 Stunden ohne Erfolg (seit Phase 3).
- **Apps**: Bekannte Apps (YouTube, Netflix, Spotify, Twitch, …, Liste in `src/core/apps.ts`) markiert der Sync einmal als «Kein Spiel» (`sync/mark-apps.ts`), aber nur Spiele ohne eigene Angaben, sodass ein Zurücksetzen in der App bleibt. Ihre Zeit zählt nicht als Spielzeit, steht aber separat unter Statistiken («Apps») und auf der Übersicht (`library.appDays`). Wunsch von Marcel, 13.11.2026.
- **Anleitungen** final: README, `SETUP-SUPABASE-GITHUB.md` (Token für die Knöpfe, Schutz gegen Einschlafen).

## Was in Phase 7 gebaut wurde

- **IGDB-Client** `src/core/igdb/client.ts` (ohne Imports, die Edge Function nutzt eine Kopie): Twitch-Login (client credentials), Suche (eine Anfrage pro Titel, höchstens 4 pro Sekunde; die Multiquery von IGDB liefert bei Suchen immer eine leere Liste, geprüft am 13.11.2026), Genres auf Deutsch, Cover `t_cover_big`. Diagnose: Workflow «Tools» → `igdb-check`.
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

- «Neu angefangen» = Spiele, deren erster Tag bekannt ist und im gewählten Jahr liegt, gleich wie «Erstmals gespielt» in der Chronik (`startedGames` in `chronicle.ts`): Jeder Plattform-Eintrag mit Spielzeit ist seit Beginn der Erfassung neu, oder er ist auf der PlayStation und Sony meldet «erstmals gespielt» (`first_played_at`, auch vor dem ersten Sync; so zählen PS5-Spiele, die 2026 vor Mitte November angefangen wurden). Der Tag ist das früheste bekannte Datum. Hatte ein Eintrag beim ersten Sync schon Zeit ohne solches Datum (Steam, Switch, importierte Historie, von Hand), zählt das Spiel nicht: es kann viel früher angefangen worden sein. Ausnahme: Hat so ein Eintrag höchstens 10 Minuten (`BRIEF_MINUTES`), gilt er als nur angetestet und zählt nicht mit (Wunsch 27.11.2026: Nine Sols, 1 Min. auf Steam, angefangen im Mai auf der PS5). Liegt Sonys Datum nach einem Sync, der schon Spielzeit zeigte, gilt es nicht. Ein neues Spiel ist nie «wiederentdeckt».
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
