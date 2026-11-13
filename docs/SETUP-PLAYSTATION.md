# PlayStation verbinden

PlayStation hat keine offizielle Schnittstelle. Die App benutzt denselben Weg wie die PlayStation-App, über die Open-Source-Bibliothek [psn-api](https://github.com/achievements-app/psn-api). Das ist inoffiziell: Sony kann es jederzeit ändern. Nutzung auf eigene Verantwortung.

Einmalig: Ist der Workflow «Edge Functions deployen» seit Phase 6 schon gelaufen? Falls nicht: <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/functions.yml> → «Run workflow».

## 1. NPSSO holen

1. Im Browser auf <https://www.playstation.com/> mit deinem PSN-Konto anmelden.
2. Im **gleichen Browser** <https://ca.account.sony.com/api/v1/ssocookie> öffnen.
3. Die Seite zeigt etwas wie `{"npsso":"Abc…xyz"}`. Den 64-stelligen Wert kopieren. Du kannst auch die ganze Zeile kopieren; die App nimmt sich den Wert selbst heraus.

Die NPSSO ist **wie ein Passwort**: nie teilen, nie in einen Chat oder ins Repo kopieren.

Zeigt die Seite in Schritt 2 einen Fehler, einen anderen Browser versuchen oder in Schritt 1 neu anmelden.

## 2. In der App eintragen

1. Game Bibliothek → **Plattformen** → Karte **«PlayStation verbinden»**.
2. NPSSO einfügen → **«Speichern»**. Sie wird verschlüsselt gespeichert.

## 3. Verbindung prüfen und synchronisieren

1. <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/sync.yml> → «Run workflow»:
   - Modus `test`, Adapter `psn`: meldet sich mit der NPSSO an und zeigt danach unter Plattformen «Verbunden: … gespielte Spiele gefunden».
   - Modus `sync`: holt alle Daten. Der erste Lauf liest die Trophäen der zuletzt gespielten 40 Spiele, die übrigen folgen in den nächsten automatischen Syncs.
2. Danach läuft alles automatisch alle 6 Stunden.

## Etwa alle zwei Monate: neue NPSSO

Die NPSSO hält etwa zwei Monate. Läuft sie ab (oder nach einem Passwortwechsel), zeigt die App unter Plattformen «Anmeldung abgelaufen – Neue NPSSO nötig». Dann die Schritte 1 bis 3 wiederholen. Ein genaues Ablaufdatum gibt Sony nicht heraus, darum zeigt die App keines an.

## Was die App von PlayStation holt

- Alle gespielten Spiele mit Gesamtspielzeit, erstem und letztem Spieldatum. Wie bei Steam gibt es keine Spielzeit pro Tag; die App berechnet sie aus den Änderungen zwischen den Syncs.
- Gekaufte Spiele, auch nie gestartete (für den Pile of Shame). Jedes gespielte Spiel gilt als «im Besitz», auch Spiele aus dem PS-Plus-Katalog.
- Trophäen mit Typ (Bronze bis Platin), Datum und Seltenheit. Neu gelesen werden sie nur bei Spielen, deren Spielzeit sich geändert hat.
- Alle PlayStation-Spiele werden dem Gerät **PS5** zugeordnet, auch PS4-Spiele, weil sie auf der PS5 laufen.

## Wie die Anmeldung gespeichert wird

1. Die NPSSO geht über die Edge Function `save-credential` verschlüsselt (AES-256-GCM) in die Datenbank. Der Browser kann gespeicherte Tokens nie lesen.
2. Der Sync tauscht sie gegen einen Refresh-Token. Sony gibt bei jeder Anmeldung einen neuen heraus; der Sync speichert ihn jedes Mal sofort, noch bevor er die Spieldaten schreibt.
3. Der Refresh-Token gilt bei Sony nur etwa 10 Tage und verlängert sich nicht. Darum bleibt die NPSSO (verschlüsselt) gespeichert: Läuft der Refresh-Token ab, meldet sich der Sync mit ihr neu an, ohne dass du etwas tun musst.
