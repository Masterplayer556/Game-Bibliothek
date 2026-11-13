# Einrichtung: Supabase und GitHub

Diese Anleitung bringt die App zum Laufen. Alles geht im Browser, auch am Handy.

## Ausgangslage

Game Bibliothek hat kein eigenes Supabase-Projekt, weil der Gratis-Plan nur zwei aktive Projekte erlaubt. Die App läuft im Projekt **«Kalender / Game Bibliothek»** (früher «Kalender (CC)», Kennung `vvgvlrwhnirooxoukbze`) mit, in zwei eigenen Schemas:

- `game_bibliothek`: alle Tabellen der App
- `game_bibliothek_private`: die Liste der erlaubten E-Mail-Adressen

Die Tabellen des Kalenders in `public` werden nicht angefasst. Game Bibliothek lässt sich jederzeit rückstandslos entfernen:

```sql
drop schema game_bibliothek cascade;
drop schema game_bibliothek_private cascade;
```

**Was die beiden Apps teilen:** die Nutzer und Login-Einstellungen, das Speicherlimit des Projekts und den geheimen Schlüssel (er hat Zugriff auf beide Apps; der Code von Game Bibliothek spricht nur das eigene Schema an).

Adresse und öffentlicher Schlüssel stehen in [`.env.production`](../.env.production). Beide sind dafür gemacht, öffentlich zu sein.

---

## 1. Tabellen anlegen (macht Claude)

Claude führt [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) aus und trägt deine Login-E-Mail in `game_bibliothek_private.allowed_emails` ein. Die E-Mail steht in keiner Datei im Repo.

Von Hand ginge es so: <https://supabase.com/dashboard/project/vvgvlrwhnirooxoukbze/sql/new> öffnen, den Inhalt der Datei einfügen, «Run». Danach:

```sql
insert into game_bibliothek_private.allowed_emails (email) values ('deine@email.ch');
```

## 2. Schema freigeben (machst du)

Ohne diesen Schritt erreicht die App ihre Tabellen nicht.

1. Öffne <https://supabase.com/dashboard/project/vvgvlrwhnirooxoukbze/settings/api>.
2. Bei «Data API» → «Exposed schemas» das Schema `game_bibliothek` hinzufügen. Die bestehenden Einträge (`public`, `graphql_public`) bleiben.
3. Speichern.

`game_bibliothek_private` wird **nicht** freigegeben.

## 3. Login

Game Bibliothek benutzt denselben Nutzer wie der Kalender: gleiche E-Mail, gleiches Passwort.

- Nutzer ansehen oder anlegen: <https://supabase.com/dashboard/project/vvgvlrwhnirooxoukbze/auth/users>
- Registrierung: <https://supabase.com/dashboard/project/vvgvlrwhnirooxoukbze/auth/providers> → «Allow new users to sign up». **Aus** ist am sichersten. Braucht der Kalender die Registrierung, darf sie an bleiben: Jede Tabelle von Game Bibliothek prüft zusätzlich, ob die angemeldete E-Mail auf der Liste der erlaubten Adressen steht. Ein fremder Nutzer sieht nichts.

## 4. GitHub Pages einschalten (machst du)

1. Öffne <https://github.com/Masterplayer556/Game-Bibliothek/settings/pages>.
2. Unter «Build and deployment» bei «Source» **GitHub Actions** wählen.
3. Öffne <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/deploy.yml> → «Run workflow». Nach etwa zwei Minuten ist die App unter <https://masterplayer556.github.io/Game-Bibliothek/> erreichbar.

Die Seite selbst ist immer öffentlich erreichbar. Ohne Login zeigt sie nur das Anmeldeformular.

## 5. Secrets für den Sync (machst du)

Öffne <https://github.com/Masterplayer556/Game-Bibliothek/settings/secrets/actions> → «New repository secret».

| Name | Wert | Woher |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`) | <https://supabase.com/dashboard/project/vvgvlrwhnirooxoukbze/settings/api-keys> |
| `CREDENTIALS_ENCRYPTION_KEY` | 32 Byte, base64 | In der App anmelden → Karte «Schlüssel für die Verschlüsselung» → «Schlüssel erzeugen» |
| `ALLOWED_EMAIL` | deine Login-E-Mail | Nur nötig, wenn das Projekt mehr als einen Nutzer hat |
| `SUPABASE_ACCESS_TOKEN` | Zugangstoken (`sbp_…`) | <https://supabase.com/dashboard/account/tokens> → «Generate new token» → auf das Projekt «Kalender / Game Bibliothek» beschränken. Erlaubt dem Workflow, Edge Functions hochzuladen (ab Phase 2). |

Den geheimen Schlüssel nie in einen Chat oder ins Repo kopieren. Den `CREDENTIALS_ENCRYPTION_KEY` zusätzlich an einem sicheren Ort ablegen (Passwort-Manager). Geht er verloren, müssen PlayStation und Nintendo neu verbunden werden.

## 6. Knöpfe «Jetzt synchronisieren» und «Verbindung testen»

Die Knöpfe unter Plattformen starten den Sync-Workflow auf GitHub. Dafür braucht die App einen GitHub-Token, der **nur** dieses eine Repo und **nur** Workflows starten darf:

1. Öffne <https://github.com/settings/personal-access-tokens/new> (Settings → Developer settings → Personal access tokens → Fine-grained tokens → «Generate new token»).
2. Token name: `game-bibliothek-sync`. Expiration: so lang wie möglich (z. B. 1 Jahr); danach einen neuen erstellen.
3. Repository access: **Only select repositories** → `Masterplayer556/Game-Bibliothek`.
4. Permissions → Repository permissions → **Actions: Read and write**. Sonst nichts.
5. «Generate token», den Token (`github_pat_…`) kopieren.
6. Unter <https://github.com/Masterplayer556/Game-Bibliothek/settings/secrets/actions> als Secret `DISPATCH_TOKEN` eintragen.
7. Workflow [Edge Functions deployen](https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/functions.yml) → «Run workflow». Er gibt den Token an die Edge Function `trigger-sync` weiter.

Läuft der Token ab, meldet die App beim Knopf «GitHub lehnt den Token ab». Dann Schritte 1 bis 7 wiederholen. Der automatische Sync alle 6 Stunden braucht den Token nicht.

## 7. Prüfen

1. App öffnen, anmelden. Die Karte «Datenbank» zeigt «Verbindung zur Datenbank funktioniert».
2. «Demo-Daten laden» antippen. Die Zähler füllen sich.
3. Sicherheit prüfen: <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/tools.yml> → «Run workflow» → `check-rls`. Der Lauf muss grün sein und für jede Tabelle `ok` melden.

---

## Alle Variablen

| Variable | Wo | Wofür | Nötig ab |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.production` im Repo (öffentlich) | Adresse des Supabase-Projekts | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.production` im Repo (öffentlich) | Öffentlicher Schlüssel für den Browser | Phase 1 |
| `NEXT_PUBLIC_BASE_PATH` | GitHub-Variable, nur bei eigener Domain (`/` eintragen) | Pfad der Seite | optional |
| `SUPABASE_SECRET_KEY` | GitHub-Secret | Voller Zugriff für das Sync-Skript. Nie im Browser. | Phase 1 |
| `CREDENTIALS_ENCRYPTION_KEY` | GitHub-Secret, später auch Supabase-Secret | Verschlüsselt PlayStation- und Nintendo-Tokens | Phase 2 |
| `ALLOWED_EMAIL` | GitHub-Secret | Wählt den Nutzer, wenn es mehrere gibt | optional |
| `SUPABASE_ACCESS_TOKEN` | GitHub-Secret | Edge Functions hochladen (nur dieses Projekt) | Phase 2 |
| `DISPATCH_TOKEN` | GitHub-Secret (wird als `GB_GITHUB_DISPATCH_TOKEN` an die Edge Function weitergegeben) | Knöpfe «Jetzt synchronisieren» / «Verbindung testen» | Phase 8 |
| `STEAM_API_KEY`, `STEAM_ID` | GitHub-Secrets | Steam | Phase 5 |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | GitHub-Secrets | Cover und Genres | Phase 7 |

Die Secrets der Edge Functions haben das Präfix `GB_`, damit sie sich nicht mit Secrets des Kalenders überschneiden. Der Workflow [Edge Functions deployen](https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/functions.yml) setzt sie aus den GitHub-Secrets; von Hand ist nichts einzutragen.

PlayStation- und Nintendo-Tokens stehen in keiner Variable. Sie liegen verschlüsselt in der Datenbank.

## Damit der automatische Sync nicht einschläft

- **GitHub** schaltet geplante Workflows in öffentlichen Repos ab, wenn das Repo 60 Tage lang keine Aktivität hatte. Der Sync-Workflow schaltet sich darum jeden Montag selbst wieder ein, was die Frist zurücksetzt. Zusätzlich zeigt die Übersicht der App eine Warnung, wenn eine verbundene Quelle seit über 24 Stunden keinen erfolgreichen Sync hatte. Falls doch einmal alles steht: <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/sync.yml> → «Enable workflow».
- **Supabase** pausiert Gratis-Projekte nach etwa 7 Tagen ohne Aktivität. Der Sync schreibt alle 6 Stunden in die Datenbank und verhindert das, solange er läuft. Pausiert das Projekt trotzdem, schickt Supabase eine E-Mail; im Dashboard «Restore project» drücken.
