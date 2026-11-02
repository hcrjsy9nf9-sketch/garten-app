/* UI-Helfer: Wetter, lokale Häkchen, Suche, Beetblatt.
   Keine Gartendaten. Alles Inhaltliche kommt aus data/garten.json
   oder von Open-Meteo (Magdeburg). */

const STORE_CHECKS = "garten-haken";
const STORE_SHOP = "garten-einkauf";
const STORE_WEATHER = "garten-wetter";
const STORE_FETCHED = "garten-daten-zeit";

const WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=52.13&longitude=11.62" +
  "&current=temperature_2m,precipitation,weather_code" +
  "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum" +
  "&timezone=Europe%2FBerlin&forecast_days=7&past_days=5";

const MILESTONES = [
  { month: 2, day: 0, label: "Ende Februar: Paprika und Chili auf der Fensterbank aussäen (24–28 °C)." },
  { month: 3, day: 15, label: "Ab Mitte/Ende März: Zuckererbsen (1C), Spinat und Radieschen (1D, 2F, 2A), Pastinake (2D)." },
  { month: 3, day: 0, label: "Ende März: Steckzwiebeln (1B), Rhabarber pflanzen (2B)." },
  { month: 5, day: 11, label: "Eisheilige (11.–15. Mai)" },
  { month: 5, day: 15, label: "Wärmebedürftiges erst ab 15. Mai ins Freie" },
];

function loadMap(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveMap(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function checkKey(scope, text) {
  return scope + "|" + text;
}

function isLocalChecked(scope, text) {
  return !!loadMap(STORE_CHECKS)[checkKey(scope, text)];
}

function isTaskDone(scope, text, jsonDone) {
  return !!jsonDone || isLocalChecked(scope, text);
}

function toggleCheck(key) {
  const map = loadMap(STORE_CHECKS);
  if (map[key]) delete map[key];
  else map[key] = true;
  saveMap(STORE_CHECKS, map);
}

function isShopChecked(name) {
  return !!loadMap(STORE_SHOP)[name];
}

function toggleShop(name) {
  const map = loadMap(STORE_SHOP);
  if (map[name]) delete map[name];
  else map[name] = true;
  saveMap(STORE_SHOP, map);
}

function euroNumber(value) {
  const match = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function euroText(amount) {
  return (
    amount.toLocaleString("de-DE", { minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }) + " €"
  );
}

function berlinToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function berlinParts() {
  const [year, month, day] = berlinToday().split("-").map(Number);
  return { year, month, day };
}

function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function deTemp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return number.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " °C";
}

function deMm(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "–";
  return number.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " mm";
}

function weatherWord(code) {
  const value = Number(code);
  if (value === 0) return "klar";
  if (value <= 3) return "bewölkt";
  if (value <= 48) return "Nebel";
  if (value <= 57) return "Niesel";
  if (value <= 67) return "Regen";
  if (value <= 77) return "Schnee";
  if (value <= 82) return "Schauer";
  if (value <= 86) return "Schneeschauer";
  if (value >= 95) return "Gewitter";
  return "";
}

function weekdayShort(iso) {
  const date = new Date(iso + "T12:00:00");
  return date.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "short" });
}

function monthTasks(month) {
  const tasks = [];
  ((state.data && state.data.kategorien) || []).forEach((category) => {
    (((month || {}).aufgaben || {})[category.key] || []).forEach((text) => {
      tasks.push({ text, kategorie: category.key, label: category.label });
    });
  });
  return tasks;
}

function monthProgress(month) {
  const tasks = monthTasks(month);
  const done = tasks.filter((task) => isTaskDone(month.key, task.text, false)).length;
  return { done, total: tasks.length };
}

function ring(done, total) {
  const pct = total ? done / total : 0;
  const length = 2 * Math.PI * 15;
  const svg = svgEl("svg", { class: "ring", viewBox: "0 0 36 36", "aria-hidden": "true" });
  svg.append(svgEl("circle", { cx: 18, cy: 18, r: 15, class: "ring-bg" }));
  const bar = svgEl("circle", {
    cx: 18,
    cy: 18,
    r: 15,
    class: "ring-fg",
    transform: "rotate(-90 18 18)",
  });
  bar.setAttribute("stroke-dasharray", (pct * length).toFixed(2) + " " + length.toFixed(2));
  svg.append(bar);
  return h(
    "span",
    { class: "ring-wrap", title: done + " von " + total + " auf diesem Gerät" },
    svg,
    h("span", { class: "sr" }, done + " von " + total)
  );
}

function taskControl(scope, taskText, jsonDone) {
  const done = isTaskDone(scope, taskText, jsonDone);
  const local = done && !jsonDone;
  const button = h(
    "button",
    {
      type: "button",
      class: "check-btn",
      "data-check": jsonDone ? null : checkKey(scope, taskText),
      "aria-pressed": done ? "true" : "false",
      disabled: jsonDone ? "disabled" : null,
      "aria-label": jsonDone ? "Im Gartenbuch erledigt" : local ? "Auf diesem Gerät abgehakt" : "Auf diesem Gerät abhaken",
    },
    h("span", { class: "check" + (done ? " is-on" : "") + (local ? " is-local" : "") })
  );
  return { done, local, button };
}

function deviceHint() {
  return h(
    "p",
    { class: "hint" },
    "Häkchen ohne Eintrag im Gartenbuch gelten nur ",
    h("strong", {}, "auf diesem Gerät"),
    ". Sag dem Gartenhelfer im Chat Bescheid, dann wird es dauerhaft eingetragen."
  );
}

async function loadWeather() {
  try {
    const response = await fetch(WEATHER_URL);
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const pack = { at: new Date().toISOString(), data, stale: false };
    localStorage.setItem(STORE_WEATHER, JSON.stringify(pack));
    state.weather = pack;
  } catch (error) {
    let cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(STORE_WEATHER) || "null");
    } catch (parseError) {
      cached = null;
    }
    if (cached && cached.data) {
      cached.stale = true;
      state.weather = cached;
    } else {
      state.weather = null;
    }
  }
}

function forecastRows(pack) {
  const daily = pack && pack.data && pack.data.daily;
  if (!daily || !daily.time) return [];
  const today = berlinToday();
  const rows = [];
  daily.time.forEach((day, index) => {
    if (day < today) return;
    if (rows.length >= 7) return;
    rows.push({
      day,
      code: daily.weather_code[index],
      max: daily.temperature_2m_max[index],
      min: daily.temperature_2m_min[index],
      rain: daily.precipitation_sum[index],
    });
  });
  return rows;
}

function pastDry(pack) {
  const daily = pack && pack.data && pack.data.daily;
  if (!daily) return false;
  const today = berlinToday();
  const past = [];
  daily.time.forEach((day, index) => {
    if (day <= today) past.push(Number(daily.precipitation_sum[index]) || 0);
  });
  const window = past.slice(-5);
  return window.length >= 5 && window.every((mm) => mm < 0.2);
}

function buildWarnings(rows, dry) {
  const warnings = [];
  let hard = null;
  let frost = null;
  let rain = null;
  let heat = null;
  rows.forEach((row) => {
    if (row.min <= -5 && !hard) hard = row;
    else if (row.min <= 0 && !frost && !hard) frost = row;
    if (row.rain >= 15 && !rain) rain = row;
    if (row.max >= 30 && !heat) heat = row;
  });
  if (hard) {
    warnings.push({
      tone: "frost-hard",
      title: "Strenger Frost",
      text: "Mindestens " + deTemp(hard.min) + " am " + weekdayShort(hard.day) + ". Wasser und Technik vor dem Frost sichern.",
      frost: true,
    });
  } else if (frost) {
    warnings.push({
      tone: "frost",
      title: "Nachtfrost",
      text: "Mindestens " + deTemp(frost.min) + " am " + weekdayShort(frost.day) + ". Leitungen und Pumpe nicht im Frost lassen.",
      frost: true,
    });
  }
  if (rain) {
    warnings.push({
      tone: "rain",
      title: "Viel Regen",
      text: deMm(rain.rain) + " am " + weekdayShort(rain.day) + ".",
    });
  }
  if (heat) {
    warnings.push({
      tone: "heat",
      title: "Hitze",
      text: "Bis " + deTemp(heat.max) + " am " + weekdayShort(heat.day) + ".",
    });
  }
  if (dry) {
    warnings.push({
      tone: "dry",
      title: "Trocken",
      text: "In den letzten fünf Tagen kein nennenswerter Regen.",
    });
  }
  return warnings;
}

function waterTaskLines() {
  return ((state.data && state.data.heute) || [])
    .filter((task) => task.kategorie === "wasser")
    .map((task) => task.text);
}

function renderWeatherCard() {
  const pack = state.weather;
  if (!pack || !pack.data) {
    return h(
      "section",
      { class: "card weather", "aria-label": "Wetter Magdeburg" },
      h("h2", {}, "Wetter Magdeburg"),
      h("p", { class: "caption" }, "Wetter gerade nicht erreichbar. Ohne gespeicherte Werte bleibt die Karte leer.")
    );
  }
  const current = pack.data.current || {};
  const rows = forecastRows(pack);
  const today = rows[0];
  const warnings = buildWarnings(rows, pastDry(pack));
  const card = h(
    "section",
    { class: "card weather", "aria-label": "Wetter Magdeburg" },
    h(
      "div",
      { class: "weather-now" },
      h("div", {}, h("p", { class: "kicker" }, "Magdeburg"), h("p", { class: "temp" }, deTemp(current.temperature_2m)), h("p", { class: "caption" }, weatherWord(current.weather_code))),
      today
        ? h(
            "div",
            { class: "weather-today" },
            h("p", {}, "Heute " + deTemp(today.min) + " bis " + deTemp(today.max)),
            h("p", {}, "Niederschlag " + deMm(today.rain))
          )
        : null
    ),
    h(
      "div",
      { class: "strip", role: "list" },
      rows.map((row) =>
        h(
          "div",
          { class: "strip-day", role: "listitem" },
          h("span", {}, weekdayShort(row.day)),
          h("strong", {}, deTemp(row.max)),
          h("span", {}, deTemp(row.min)),
          h("span", {}, deMm(row.rain))
        )
      )
    ),
    warnings.map((warning) => {
      const box = h("aside", { class: "alert " + warning.tone }, h("strong", {}, warning.title), h("p", {}, warning.text));
      if (warning.frost) {
        const tasks = waterTaskLines();
        if (tasks.length) {
          box.append(h("p", { class: "caption" }, "Wasser & Technik"));
          box.append(h("ul", { class: "clean" }, tasks.map((task) => h("li", {}, task))));
          box.append(
            h("button", { type: "button", class: "text-btn", "data-goto-tab": "technik" }, "Zur Wasser- und Technikseite")
          );
        }
      }
      return box;
    }),
    h(
      "p",
      { class: "caption" },
      pack.stale ? "Zuletzt gespeichertes Wetter, " + formatWhen(pack.at) + "." : "Open-Meteo, " + formatWhen(pack.at) + "."
    )
  );
  return card;
}

function nextOccurrence(milestone, today) {
  let year = today.year;
  const build = (y) => {
    const last = new Date(Date.UTC(y, milestone.month, 0)).getUTCDate();
    const day = milestone.day === 0 ? last : Math.min(milestone.day, last);
    return { year: y, month: milestone.month, day };
  };
  let date = build(year);
  const key = (value) => value.year * 10000 + value.month * 100 + value.day;
  const todayKey = today.year * 10000 + today.month * 100 + today.day;
  if (key(date) < todayKey) date = build(year + 1);
  return date;
}

function daysUntil(date, today) {
  const a = Date.UTC(today.year, today.month - 1, today.day);
  const b = Date.UTC(date.year, date.month - 1, date.day);
  return Math.round((b - a) / 86400000);
}

function renderNextCard() {
  const today = berlinParts();
  const todayKey = berlinToday().slice(0, 7);
  const months = (state.data && state.data.jahr) || [];
  const index = months.findIndex((month) => month.key === todayKey);
  const upcoming = index >= 0 ? months[index + 1] : months.find((month) => month.key > todayKey);
  const tasks = upcoming ? monthTasks(upcoming).slice(0, 4) : [];
  const countdowns = MILESTONES.map((milestone) => {
    const date = nextOccurrence(milestone, today);
    return { label: milestone.label, days: daysUntil(date, today), date };
  })
    .filter((item) => item.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  return h(
    "section",
    { class: "card next-card" },
    h("h2", {}, "Als Nächstes"),
    upcoming
      ? h("h3", {}, upcoming.name)
      : h("p", {}, "Im Jahresplan liegt kein späterer Monat."),
    tasks.length
      ? h(
          "ul",
          { class: "clean" },
          tasks.map((task) => h("li", {}, h("span", { class: "task-meta" }, task.label), " ", task.text))
        )
      : null,
    countdowns.length
      ? h(
          "ul",
          { class: "countdown" },
          countdowns.map((item) =>
            h(
              "li",
              {},
              h("strong", {}, item.days === 0 ? "heute" : item.days === 1 ? "morgen" : "in " + item.days + " Tagen"),
              h("span", {}, item.label)
            )
          )
        )
      : null
  );
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function searchResults(query) {
  const needle = norm(query.trim());
  if (needle.length < 2 || !state.data) return [];
  const hits = [];
  const push = (title, meta, extra) => {
    if (hits.length >= 24) return;
    const hay = norm(title + " " + meta);
    if (hay.includes(needle)) hits.push(Object.assign({ title, meta }, extra));
  };
  (state.data.heute || []).forEach((task) => push(task.text, task.bereich, { tab: "heute" }));
  (state.data.jahr || []).forEach((month) => {
    monthTasks(month).forEach((task) => push(task.text, month.name + " · " + task.label, { tab: "jahr", monat: month.key }));
  });
  (state.data.bestand || []).forEach((item) => push(item.name, item.bereich + " · " + item.notiz, { tab: "bestand" }));
  (state.data.tagebuch || []).forEach((entry) => push(entry.eintrag, entry.anzeige + " · " + entry.bereich, { tab: "tagebuch" }));
  const plan = state.data.plan2027 || {};
  ["b1", "b2"].forEach((key) => {
    (((plan.beete || {})[key]) || []).forEach((row) => push(row.feld + " " + row.kultur, row.aussaat + " " + row.pflege, { tab: "plan", goto: "plan-beete" }));
  });
  (((plan.obst || {}).zeilen) || []).forEach((row) => push(row.gehoelz, row.schnitt, { tab: "plan", goto: "plan-obst" }));
  (((plan.kalender || {}).monate) || []).forEach((month) => {
    (month.punkte || []).forEach((point) => push(point, "Gartenplan " + month.name, { tab: "plan", goto: "plan-kalender", planMonat: month.key }));
  });
  (((plan.kosten || {}).posten) || []).forEach((row) => push(row.posten, row.kosten, { tab: "plan", goto: "plan-kosten" }));
  (((plan.offen || {}).punkte) || []).forEach((point) => push(point, "Offene Punkte", { tab: "plan", goto: "plan-offen" }));
  return hits;
}

function renderSearch() {
  const query = (state.query || "").trim();
  if (query.length < 2) return null;
  const hits = searchResults(query);
  return h(
    "div",
    { class: "view" },
    h("h2", {}, "Suche"),
    h("p", { class: "caption" }, hits.length ? hits.length + " Treffer" : "Nichts gefunden."),
    h(
      "div",
      { class: "entries" },
      hits.map((hit) =>
        h(
          "button",
          {
            type: "button",
            class: "entry search-hit",
            "data-result-tab": hit.tab,
            "data-result-monat": hit.monat || null,
            "data-result-plan": hit.planMonat || null,
            "data-goto": hit.goto || null,
          },
          h("strong", {}, hit.title),
          h("span", {}, hit.meta)
        )
      )
    )
  );
}

function findField(code) {
  const beete = ((state.data.plan2027 || {}).beete) || {};
  const rows = [].concat(beete.b1 || [], beete.b2 || []);
  return rows.find((row) => {
    const name = String(row.feld || "");
    return name === code || name.startsWith(code + " ") || name.startsWith(code + "·") || name.startsWith(code + " ·");
  });
}

function findRotation(code) {
  const rows = (((state.data.plan2027 || {}).fruchtfolge || {}).zeilen) || [];
  return rows.find((row) => row[0] === code) || null;
}

function findBestand(name) {
  return ((state.data.bestand) || []).find((item) => norm(item.name).includes(norm(name))) || null;
}

function findObst(name) {
  const rows = (((state.data.plan2027 || {}).obst || {}).zeilen) || [];
  return rows.find((row) => norm(row.gehoelz).includes(norm(name))) || null;
}

function renderSheet(id) {
  const [kind, name] = String(id || "").split(":");
  let title = name || "";
  const blocks = [];
  if (kind === "feld") {
    const row = findField(name);
    const rotation = findRotation(name);
    title = row ? row.feld : "Feld " + name;
    if (row) {
      blocks.push(
        h(
          "dl",
          { class: "props" },
          ["Kultur", "Aussaat/Pflanzung", "Abstand", "Ernte", "Partner und Pflege"].map((label, index) =>
            h("div", {}, h("dt", {}, label), h("dd", {}, [row.kultur, row.aussaat, row.abstand, row.ernte, row.pflege][index]))
          )
        )
      );
    }
    if (rotation) {
      const columns = (((state.data.plan2027 || {}).fruchtfolge || {}).spalten) || [];
      blocks.push(h("h3", {}, "Fruchtfolge"));
      blocks.push(
        h(
          "ul",
          { class: "clean" },
          rotation.slice(1).map((value, index) => h("li", {}, (columns[index + 1] || "") + ": " + value))
        )
      );
    }
    if (!row && !rotation) blocks.push(h("p", {}, "Zu diesem Feld steht im Plan kein Eintrag."));
  } else {
    const bestand = findBestand(name);
    const obst = findObst(name);
    title = bestand ? bestand.name : name;
    if (bestand) {
      blocks.push(
        h(
          "dl",
          { class: "props" },
          ["Bereich", "Typ", "Maße", "Notizen"].map((label, index) =>
            h("div", {}, h("dt", {}, label), h("dd", {}, [bestand.bereich, bestand.typ, bestand.masse, bestand.notiz][index]))
          )
        )
      );
    }
    if (obst) {
      blocks.push(h("h3", {}, "Pflege"));
      blocks.push(
        h(
          "dl",
          { class: "props" },
          ["Schnitt", "Pflege", "Vorbeugung"].map((label, index) =>
            h("div", {}, h("dt", {}, label), h("dd", {}, [obst.schnitt, obst.pflege, obst.vorbeugung][index]))
          )
        )
      );
    }
    if (norm(name).includes("gewaechshaus") || norm(name).includes("gewachshaus")) {
      const rows = (((state.data.plan2027 || {}).gewaechshaus || {}).sommer) || [];
      if (rows.length) {
        blocks.push(h("h3", {}, "Sommerbelegung"));
        blocks.push(h("ul", { class: "clean" }, rows.map((row) => h("li", {}, row.bereich + ": " + row.kultur))));
      }
    }
    if (!blocks.length) blocks.push(h("p", {}, "Dazu steht nichts im Bestand oder in der Obstpflege."));
  }
  return h(
    "div",
    { class: "sheet-back", "data-close": "1" },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div", { class: "sheet-bar" }, h("h2", {}, title), h("button", { type: "button", class: "text-btn", "data-close": "1" }, "Schließen")),
      ...blocks
    )
  );
}

function renderShopping(kosten) {
  const rows = (kosten && kosten.posten) || [];
  let open = 0;
  let done = 0;
  let optionalOpen = 0;
  rows.forEach((row) => {
    if (row.summe) return;
    const amount = euroNumber(row.kosten);
    const checked = isShopChecked(row.posten);
    if (row.optional) {
      if (!checked) optionalOpen += amount;
      else done += amount;
      return;
    }
    if (checked) done += amount;
    else open += amount;
  });
  return h(
    "div",
    { class: "shop" },
    h(
      "div",
      { class: "metrics" },
      h("article", { class: "metric" }, h("b", {}, euroText(open)), h("span", {}, "noch offen")),
      h("article", { class: "metric" }, h("b", {}, euroText(done)), h("span", {}, "abgehakt")),
      h("article", { class: "metric" }, h("b", {}, euroText(optionalOpen)), h("span", {}, "optional offen"))
    ),
    h("p", { class: "hint" }, "Häkchen der Einkaufsliste gelten nur auf diesem Gerät."),
    h(
      "div",
      { class: "stack-table" },
      rows.map((row) => {
        if (row.summe) {
          return h(
            "div",
            { class: "stack-row is-sum" },
            h("strong", {}, row.posten),
            h("span", {}, "Summe laut Plan " + (row.kosten || ""))
          );
        }
        const checked = isShopChecked(row.posten);
        return h(
          "button",
          {
            type: "button",
            class: "stack-row shop-row" + (checked ? " is-done" : "") + (row.optional ? " is-optional" : ""),
            "data-shop": row.posten,
            "aria-pressed": checked ? "true" : "false",
          },
          h("span", { class: "check" + (checked ? " is-on is-local" : "") }),
          h("span", { class: "shop-copy" }, h("strong", {}, row.posten), h("span", {}, (row.menge ? row.menge + " · " : "") + (row.kosten || "")))
        );
      })
    )
  );
}

function showUpdateToast(worker) {
  if (!worker || document.querySelector(".update-toast")) return;
  const toast = h(
    "div",
    { class: "update-toast", role: "status" },
    h("p", {}, "Neue Version verfügbar – neu laden"),
    h("button", { type: "button", class: "retry", id: "reload-sw" }, "Neu laden")
  );
  document.body.append(toast);
  toast.querySelector("#reload-sw").addEventListener("click", () => {
    worker.postMessage({ type: "SKIP_WAITING" });
  });
}

function watchWorker(reg) {
  if (!reg) return;
  const announce = () => {
    if (navigator.serviceWorker.controller && reg.waiting) showUpdateToast(reg.waiting);
  };
  announce();
  reg.addEventListener("updatefound", () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed") announce();
    });
  });
}
