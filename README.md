# Garten-App – Parzelle 23

Mobiles Gartenbuch für den Kleingarten Parzelle 23 in Magdeburg. Die Seite ist eine statische Progressive Web App: HTML, CSS und JavaScript, ohne Build und ohne Backend.

Adresse: [https://hcrjsy9nf9-sketch.github.io/garten-app/](https://hcrjsy9nf9-sketch.github.io/garten-app/)

Alle Garteninhalte stehen in **einer** Datei: [`data/garten.json`](data/garten.json). Die Oberfläche liest nur diese Datei. Steht `done` auf `true`, ist die Aufgabe im Gartenbuch erledigt. Zusätzliche Häkchen gelten nur auf diesem Gerät.

## Installation auf dem Handy

Die App lässt sich zum Startbildschirm hinzufügen.

- **Android (Chrome):** Menü → „App installieren“ oder „Zum Startbildschirm hinzufügen“.
- **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“.

Danach startet sie ohne Browserleiste. Einmal online geöffnet, bleiben die letzte Datenfassung und die Oberfläche auch offline verfügbar.

## So aktualisierst du die Daten

1. Nur `data/garten.json` ändern. Texte in `index.html`, `app.js` oder `styles.css` sind die Oberfläche, nicht das Gartenbuch.
2. `stand` auf das lesbare Datum der Daten setzen (Beispiel: `10. Nov. 2026`) und `standIso` auf `JJJJ-MM-TT` (Beispiel: `2026-11-10`). Oben steht das getrennt von heute: „Daten vom …“ ist dieses Feld, „Heute …“ ist das Datum des Geräts.
3. `standIso` wählt den Monat in der Jahresübersicht (wenn `jahr[].key` dazu passt, Form `JJJJ-MM`) und den umrandeten Monat im Saisonstreifen. Im Gartenplan öffnet sich derselbe Kalendermonat.
4. Heutige Aufgaben: `heute[].done` auf `true` oder `false`. `true` bleibt immer erledigt. Ein Häkchen nur auf dem Handy steht in `localStorage` (`garten-haken`) und wird mit dem Hinweis „auf diesem Gerät abgehakt“ gezeigt. Dauerhaft wird es erst durch `done: true` in dieser Datei. Setze `heute[].ref` auf die `id` der passenden Aufgabe in `jahr` (eine Id oder eine Liste). Dann gilt dasselbe Häkchen unter Heute und im Kalender. Fehlt `ref`, sucht die App im Monat von `standIso` nach Stichworten (Brunnenpumpe, Regenfässer, Johannisbeeren, Fruchtmumien). Beim Umformulieren einer Monatsaufgabe die `id` behalten und nur `text` ändern.
5. Neue Tagebucheinträge in `tagebuch` anhängen. `datum` ist ISO (`2026-11-03`), `anzeige` der lesbare Text. Die App sortiert neueste zuerst.
6. Monatsaufgaben stehen in `jahr[].aufgaben` unter `wasser`, `beete`, `gewaechshaus`, `obst`, `natur`. Leere Kategorien weglassen.
7. Gerätestatus in `technik[]`: `status`, `stand`, `erfasst`, `winter`, `fruehjahr`, `saison`, optional `erledigtDurch`. `erledigtDurch` ist eine Liste von `jahr`-Ids. Sind auf diesem Gerät alle diese Aufgaben abgehakt, zeigt die Kachel `winterfest`. Haken weg: es gilt wieder `status` aus dieser Datei. `status` selbst bleibt die Grundlage und wird nicht überschrieben.
8. `saison` ist genau 12 Zeichen, Januar bis Dezember: `b` in Betrieb, `u` umstellen (in Betrieb nehmen oder winterfest machen), `w` Winterlage. Beispiel Regenfässer: `wwubbbbbbbuw`.
9. Bestand, offene Punkte und `plan2027` genauso in der JSON pflegen.
10. Auf `main` committen und pushen. Die Aktion `.github/workflows/pages.yml` veröffentlicht die Seite. `data/garten.json` wird beim Öffnen aus dem Netz geladen; offline erscheint die letzte erfolgreiche Fassung.

Hinweis zum Technik-Status: Enthält `status` den Text `nicht winterfest`, zeigt die Karte eine Warnung. Enthält er `winterfest` ohne dieses „nicht“, gilt der Status als erledigt.

## Datenschema

`schemaVersion` ist `1`. Zeichenkodierung UTF-8.

### Stamm

| Feld | Bedeutung |
| --- | --- |
| `titel` | Seitentitel |
| `stand` | Sichtbares Aktualisierungsdatum, groß in der Kopfzeile |
| `standIso` | Maschinenlesbares Datum `JJJJ-MM-TT` |
| `zusammenfassung` | Einleitung auf „Heute“ |
| `kategorien` | `{ key, label }` in Anzeigereihenfolge. Schlüssel: `wasser`, `beete`, `gewaechshaus`, `obst`, `natur` |
| `texte` | Überschriften und Hinweistexte der Garten-App |
| `saisonLegende` | `{ code, label }` für `b`, `u`, `w` |
| `monateKurz` | Zwölf Kürzel Januar–Dezember für den Saisonstreifen |
| `heute` | `{ text, bereich, kategorie, done, ref? }`. `ref` ist die `id` einer `jahr`-Aufgabe oder eine Liste solcher Ids |
| `jahr` | `{ key, label, name, aufgaben }` von November 2026 bis Dezember 2027. `key` ist `JJJJ-MM`. `aufgaben` enthält nur Kategorien mit Einträgen. Jeder Eintrag ist `{ id, text }`; ein reiner Satz ohne `id` funktioniert weiter, bekommt dann aber nur eine abgeleitete Id |
| `technik` | `{ name, status, stand, erfasst, winter, fruehjahr, saison, erledigtDurch? }`. `erledigtDurch` listet `jahr`-Ids; alle abgehakt heißt auf dem Gerät `winterfest` |
| `technikSaison` | `{ zeitraum, aufgabe, betrifft }` |
| `bestand` | `{ name, bereich, typ, masse, notiz }`. `typ` erzeugt die Filter automatisch |
| `tagebuch` | `{ datum, anzeige, bereich, eintrag }` |
| `offen` | Liste noch fehlender Angaben der Garten-App |
| `links` | `{ title, site, date, href }`. Bleibt als Herkunftsverweis in den Daten; der Plan selbst steht in `plan2027` und wird dort angezeigt |
| `plan2027` | Gartenplan 2027, siehe unten |

`texte` enthält `heuteUeberschrift`, `jahrUeberschrift`, `technikUeberschrift`, `bestandUeberschrift`, `tagebuchUeberschrift`, `offenUeberschrift`, `bestandHinweis`, `saisonUeberschrift`, `saisonHinweis` und `wasserZuerst` (`ton`, `lead`, `text`).

### `plan2027`

| Feld | Inhalt |
| --- | --- |
| `titel`, `summary` | Titel und Einleitung |
| `leitidee` | `titel`, `text`, `kennzahlen` (`value`, `label`, `detail`), `punkte` |
| `lageplan` | `titel`, `skizzeTitel`, `aufbauTitel`, `legende` (`klasse`: `stark`, `mittel`, `schwach`, `grau`), `aufbau` (`lead`, `title`, `detail`), `skizze` |
| `lageplan.skizze` | Beschriftungen der Zeichnung und `felder`: `{ code, klasse, l1, l2, gestrichelt? }`. Feldcodes: `1A`–`1D`, `2A`–`2F` |
| `beete` | `titel`, `optionen` (`value`: `b1` oder `b2`), `spalten`, `b1`, `b2`, `hinweis` |
| Beetzeile | `feld`, `kultur`, `aussaat`, `abstand`, `ernte`, `pflege` |
| `fruchtfolge` | `titel`, `spalten`, `zeilen` (Listen), `text` |
| `kulturInfo` | Zusatz fürs Detail-Blatt. Felder, Tomaten und Gewächshaus: `haupt` (eine Kultur), optional `vor` oder `nach`, optional `misch` (nur Möhre/Zwiebel), `naechstes` (2028), `anleitung` (`kopf`, `reihen`, `schritte`). Obst und Säume weiter über `kulturen`. Monate `s`/`p`/`e` als 1–12. Bestehende Felder bleiben |
| `gewaechshaus` | `titel`, `sommerTitel`, `sommerSpalten`, `sommer` (`bereich`, `kultur`, `pflanzung`, `abstand`, `ernte`), `jahreszeitenTitel`, `schritte` (`titel`, `text`), `hinweis` |
| `obst` | `titel`, `spalten`, `zeilen` (`gehoelz`, `schnitt`, `pflege`, `vorbeugung`), `hinweis` |
| `kraeuter` | `titel`, `spalten`, `zeilen` (`standort`, `pflanze`, `anzahl`, `abstand`, `licht`, `kosten`), `punkte` |
| `insekten` | `titel`, `eintraege` (`lead`, `title`, `detail`) |
| `kalender` | `titel`, `monate` (`key`, `label`, `name`, `punkte`), `hinweis`. Schlüssel: `jan` … `dez` |
| `kosten` | `titel`, `hinweis`, `balken` (`label`, `value`, `anzeige`), `spalten`, `posten` (`posten`, `menge`, `kosten`, optional `summe` oder `optional`), `nachsatz` |
| `offen` | `titel`, `punkte` des Plans |
| `regeln` (optional) | `titel`, `hinweis`, `spalten`, `zeilen` (`thema`, `regel`, `quelle`), `bestand` (`ton`, `lead`, `text`). Fehlt das Objekt, zeigt der Plan die Karte nicht |

Hinweise mit `ton` nutzen `warning` oder `info`.

`kulturInfo` ist ein Zusatz. Bestehende Felder, Ids und der Lageplan bleiben; Tagesupdates von `stand` und `heute` lassen `kulturInfo` stehen. Das Schema bleibt kompatibel.

Optional und nur in der Oberfläche, nicht in der JSON:

- Wetter kommt von Open-Meteo für Magdeburg (52,13° N, 11,62° O, Zeitzone Europe/Berlin) und wird unter `garten-wetter` im Browser gespeichert. Ohne Netz erscheint die letzte Fassung, sonst ein kurzer Hinweis.
- Häkchen der Einkaufsliste liegen unter `garten-einkauf`.
- Der Zeitpunkt des letzten erfolgreichen Ladens liegt unter `garten-daten-zeit`.

## Technik

- Relativpfade, damit die App unter `https://hcrjsy9nf9-sketch.github.io/garten-app/` läuft.
- `manifest.webmanifest`: Name, Kurzname „Garten“, Farbe Grün, Icons 192 und 512.
- `sw.js`: `data/garten.json` immer netzwerkzuerst und ohne HTTP-Cache (`cache: no-store`); nur offline die letzte gute Kopie. Statische Dateien cache-zuerst (Aktualisierung im Hintergrund für den nächsten Start).
- Helles und dunkles Erscheinungsbild über `prefers-color-scheme`.
- Unten die Bereiche Heute, Jahr, Technik, Bestand, Plan 2027, Tagebuch.

Ein Push auf `main` startet `.github/workflows/pages.yml` (`actions/deploy-pages`). Die Seite ist auf GitHub Actions als Pages-Quelle eingestellt.

## Seiten veröffentlichen

GitHub Actions kann die Pages-Site nur anlegen, wenn das Token das darf. Das Standard-`GITHUB_TOKEN` darf das oft nicht. Dann einmalig im Repository unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** wählen und den Workflow erneut starten. Danach reicht jeder Push auf `main`.
