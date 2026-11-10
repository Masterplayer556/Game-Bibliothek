# Einrichtung: Supabase und GitHub

Diese Anleitung bringt die App zum Laufen. Alles geht im Browser, auch am Handy. Stand: Phase 1. Die Schritte für Edge Functions und den automatischen Sync kommen in Phase 6 und 8 dazu.

Überall, wo `<ref>` steht, ist die Projekt-Kennung deines Supabase-Projekts gemeint (die Zeichenfolge in der Adresse `https://<ref>.supabase.co`).

---

## 1. Supabase-Projekt anlegen

1. Öffne <https://supabase.com/dashboard/new>.
2. Name: `game-bibliothek`.
3. Datenbank-Passwort erzeugen lassen und sicher ablegen.
4. Region: Central EU (Zürich) oder Frankfurt.
5. Plan: Free.

**Achtung:** Der Gratis-Plan erlaubt nur zwei aktive Projekte. Sind schon zwei aktiv, musst du zuerst eines pausieren (Projekt → Project Settings → General → «Pause project») oder ein bestehendes Projekt mitbenutzen.

Sag Claude danach den Projektnamen. Claude trägt die öffentliche Adresse und den öffentlichen Schlüssel in die Datei `.env.production` ein. Beide Werte sind dafür gemacht, öffentlich zu sein; geschützt werden die Daten durch Login und Row Level Security.

## 2. Tabellen anlegen

1. Öffne `https://supabase.com/dashboard/project/<ref>/sql/new`.
2. Kopiere den ganzen Inhalt von [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) hinein und klicke «Run».
3. Führe danach diese eine Zeile aus, mit deiner Login-E-Mail:

   ```sql
   insert into app_private.allowed_emails (email) values ('deine@email.ch');
   ```

   Die E-Mail steht absichtlich in keiner Datei im Repo.

## 3. Login einrichten

1. **Registrierung ausschalten:** `https://supabase.com/dashboard/project/<ref>/auth/providers` → «Allow new users to sign up» **aus** → speichern. Das ist der wichtigste Schritt: Die Seite ist öffentlich erreichbar.
2. **Deinen Nutzer anlegen:** `https://supabase.com/dashboard/project/<ref>/auth/users` → «Add user» → «Create new user» → E-Mail und Passwort eingeben, «Auto Confirm User» ankreuzen.
3. **Adresse der App eintragen:** `https://supabase.com/dashboard/project/<ref>/auth/url-configuration` → Site URL: `https://masterplayer556.github.io/Game-Bibliothek/`.

## 4. GitHub Pages einschalten

1. Öffne <https://github.com/Masterplayer556/Game-Bibliothek/settings/pages>.
2. Unter «Build and deployment» bei «Source» **GitHub Actions** wählen.
3. Öffne <https://github.com/Masterplayer556/Game-Bibliothek/actions/workflows/deploy.yml> → «Run workflow». Nach etwa zwei Minuten ist die App unter <https://masterplayer556.github.io/Game-Bibliothek/> erreichbar.

Die Seite selbst ist immer öffentlich erreichbar. Ohne Login zeigt sie nur das Anmeldeformular.

## 5. Secrets für den Sync

Öffne <https://github.com/Masterplayer556/Game-Bibliothek/settings/secrets/actions> → «New repository secret».

| Name | Wert | Woher |
|---|---|---|
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_…`) | `https://supabase.com/dashboard/project/<ref>/settings/api-keys` |
| `CREDENTIALS_ENCRYPTION_KEY` | 32 Byte, base64 | In der App anmelden → Karte «Schlüssel für die Verschlüsselung» → «Schlüssel erzeugen» |

Den `CREDENTIALS_ENCRYPTION_KEY` zusätzlich an einem sicheren Ort ablegen (Passwort-Manager). Geht er verloren, müssen PlayStation und Nintendo neu verbunden werden.

## 6. Prüfen

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
| `ALLOWED_EMAIL` | GitHub-Secret, später auch Supabase-Secret | Nur nötig, wenn es mehr als einen Nutzer gibt | optional |
| `STEAM_API_KEY`, `STEAM_ID` | GitHub-Secrets | Steam | Phase 5 |
| `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET` | GitHub-Secrets | Cover und Genres | Phase 7 |
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO` | Supabase-Secrets | Knopf «Jetzt synchronisieren» | Phase 8 |

PlayStation- und Nintendo-Tokens stehen in keiner Variable. Sie liegen verschlüsselt in der Datenbank.
