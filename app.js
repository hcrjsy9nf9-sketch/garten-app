const TABS = [
  { id: "heute", label: "Heute" },
  { id: "kalender", label: "Kalender" },
  { id: "garten", label: "Garten" },
  { id: "plan", label: "Plan" },
  { id: "mehr", label: "Mehr" },
];

const PLAN_NAV = [
  ["leitidee", "Leitidee"],
  ["lageplan", "Lageplan"],
  ["beete", "Beete"],
  ["fruchtfolge", "Fruchtfolge"],
  ["gewaechshaus", "Haus"],
  ["obst", "Obst"],
  ["kraeuter", "Kräuter"],
  ["insekten", "Insekten"],
  ["kalender", "Kalender"],
  ["kosten", "Kosten"],
  ["regeln", "Regeln"],
  ["offen", "Offen"],
];

const PLAN_MONTHS = ["jan", "feb", "mar", "apr", "mai", "jun", "jul", "aug", "sep", "okt", "nov", "dez"];

const state = {
  data: null,
  tab: "heute",
  monatKey: null,
  typ: "alle",
  planMonat: "nov",
  planBeet: "b1",
  rotYear: "2027",
  plotId: null,
  pendingScroll: null,
  listening: false,
  query: "",
  sheet: null,
  weather: null,
  fetchedAt: null,
  refreshing: false,
  searchOpen: false,
  mehrView: null,
  detail: null,
};

const SVGNS = "http://www.w3.org/2000/svg";
const app = document.getElementById("app");
const main = h("main", { id: "inhalt", tabindex: "-1" });

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === "class") el.className = value;
      else el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  const add = (child) => {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(add);
      return;
    }
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  };
  children.forEach(add);
  return el;
}

function svgEl(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value != null) el.setAttribute(key, String(value));
    }
  }
  return el;
}

function text(value) {
  return value == null || value === "" ? "–" : String(value);
}

function tx(key, fallback) {
  const bag = state.data && state.data.texte;
  return (bag && bag[key]) || fallback;
}

function statusTone(status) {
  const value = String(status || "");
  if (value.includes("nicht winterfest")) return "warn";
  if (value.includes("winterfest")) return "ok";
  return "neutral";
}

function tabFromHash() {
  const id = location.hash.replace("#", "");
  const map = { jahr: "kalender", bestand: "garten", technik: "mehr", tagebuch: "mehr" };
  const tab = map[id] || id;
  if (id === "technik") state.mehrView = "technik";
  if (id === "tagebuch") state.mehrView = "tagebuch";
  return TABS.some((item) => item.id === tab) ? tab : "heute";
}

function initialMonth(data) {
  const key = String(data.standIso || "").slice(0, 7);
  return (data.jahr || []).some((month) => month.key === key) ? key : (data.jahr[0] && data.jahr[0].key);
}

function initialPlanMonth(data) {
  const index = Number(String(data.standIso || "").slice(5, 7)) - 1;
  return PLAN_MONTHS[index] || "mar";
}

function sortedDiary(entries) {
  return [...(entries || [])].sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
}

function icon(name) {
  const svg = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  const path = (d) => svg.append(svgEl("path", { d }));
  if (name === "heute") {
    svg.append(svgEl("circle", { cx: 12, cy: 12, r: 4 }));
    ["M12 2v2", "M12 20v2", "M4.9 4.9l1.4 1.4", "M17.7 17.7l1.4 1.4", "M2 12h2", "M20 12h2", "M4.9 19.1l1.4-1.4", "M17.7 6.3l1.4-1.4"].forEach(path);
  } else if (name === "kalender" || name === "jahr") {
    svg.append(svgEl("rect", { x: 3, y: 4, width: 18, height: 17, rx: 2 }));
    path("M3 9h18M8 2v4M16 2v4");
  } else if (name === "search") {
    svg.append(svgEl("circle", { cx: 11, cy: 11, r: 6 }));
    path("M16 16l4 4");
  } else if (name === "refresh") {
    path("M20 12a8 8 0 1 1-2.2-5.6M20 4v5h-5");
  } else if (name === "mehr") {
    path("M4 7h16M4 12h16M4 17h16");
  } else if (name === "technik") {
    path("M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z");
  } else if (name === "bestand") {
    path("M5 19c6-1 8-8 8-14 4 3 6 8 6 12a8 8 0 0 1-14 2z");
    path("M9 13c2 0 4-2 5-5");
  } else if (name === "garten") {
    path("M5 19c6-1 8-8 8-14 4 3 6 8 6 12a8 8 0 0 1-14 2z");
    path("M9 13c2 0 4-2 5-5");
  } else if (name === "plan") {
    svg.append(svgEl("rect", { x: 3, y: 3, width: 7, height: 7, rx: 1 }));
    svg.append(svgEl("rect", { x: 14, y: 3, width: 7, height: 7, rx: 1 }));
    svg.append(svgEl("rect", { x: 3, y: 14, width: 7, height: 7, rx: 1 }));
    svg.append(svgEl("rect", { x: 14, y: 14, width: 7, height: 7, rx: 1 }));
  } else {
    path("M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3z");
    path("M5 4v16");
  }
  return svg;
}

function chipBar(name, options, current, attr) {
  const bar = h("div", {
    class: "chips" + (options.length === 2 ? " segment" : ""),
    "data-chipbar": name,
    role: "group",
    "aria-label": name,
  });
  options.forEach((option) => {
    const on = option.value === current;
    const button = h(
      "button",
      { type: "button", class: "chip" + (on ? " is-on" : ""), "aria-pressed": on ? "true" : "false", [attr]: option.value },
      option.label
    );
    if (option.count != null) button.append(h("span", { class: "chip-count" }, String(option.count)));
    bar.append(button);
  });
  return bar;
}

function bullets(items) {
  return h("ul", { class: "clean" }, (items || []).map((item) => h("li", {}, item)));
}

function callout(block) {
  if (!block) return null;
  if (typeof block === "string") return h("aside", { class: "callout info" }, h("p", {}, block));
  return h("aside", { class: "callout " + (block.ton || "info") }, h("strong", {}, block.lead || ""), block.text ? h("p", {}, block.text) : null);
}

function stackTable(aria, columns, rows) {
  const wrap = h("div", { class: "stack-table", role: "table", "aria-label": aria });
  rows.forEach((row) => {
    const classes = ["stack-row"];
    if (row.sum) classes.push("is-sum");
    if (row.optional) classes.push("is-optional");
    const article = h("div", { class: classes.join(" "), role: "row" });
    columns.forEach((column, index) => {
      const value = text(row.values[index]);
      const cell = h("div", { role: "cell", class: "stack-cell" });
      cell.append(h("span", { class: "cell-label" }, column));
      cell.append(index === 0 ? h("strong", {}, value) : h("span", {}, value));
      article.append(cell);
    });
    wrap.append(article);
  });
  return wrap;
}

function objectsToRows(rows, keys) {
  return (rows || []).map((row) => ({
    values: keys.map((key) => row[key]),
    sum: !!row.summe,
    optional: !!row.optional,
  }));
}

function dataTable(aria, columns, rows) {
  const scroller = h("div", { class: "table-scroll" });
  const table = h("table");
  table.setAttribute("aria-label", aria);
  const head = h("tr", {}, columns.map((column) => h("th", { scope: "col" }, column)));
  const body = h("tbody", {}, rows.map((row) => h("tr", {}, row.map((value) => h("td", {}, text(value))))));
  table.append(h("thead", {}, head), body);
  scroller.append(table);
  return scroller;
}

function section(id, title, ...nodes) {
  const details = h("details", { class: "fold", id: "plan-" + id });
  details.append(h("summary", {}, title));
  details.append(h("div", { class: "fold-body" }, ...nodes));
  return details;
}

function renderHeader() {
  const data = state.data;
  return h(
    "header",
    { class: "top" },
    renderHill(),
    h(
      "div",
      { class: "title-row" },
      h("div", {}, h("h1", {}, "Garten · Parzelle 23"), h("p", { class: "stand-quiet" }, "Stand " + (data.stand || ""))),
      h(
        "div",
        { class: "icon-row" },
        h("button", { type: "button", class: "icon-btn", "data-search-toggle": "1", "aria-label": "Suchen", "aria-expanded": state.searchOpen ? "true" : "false" }, icon("search")),
        h("button", { type: "button", class: "icon-btn", "data-refresh": "1", "aria-label": state.refreshing ? "Lädt" : "Aktualisieren" }, icon("refresh"))
      )
    ),
    state.searchOpen
      ? h(
          "label",
          { class: "search" },
          h("span", { class: "sr" }, "Suchen"),
          h("input", {
            type: "search",
            "data-search": "1",
            placeholder: "Aufgaben, Bestand, Plan, Tagebuch",
            value: state.query || "",
            enterkeyhint: "search",
          })
        )
      : null
  );
}

function renderOffline() {
  return h("p", { class: "offline", role: "status", hidden: navigator.onLine ? "hidden" : null }, "Offline · zuletzt gespeicherte Daten");
}

function renderNav() {
  const nav = h("nav", { class: "tabbar", "aria-label": "Bereiche" });
  TABS.forEach((tab) => {
    nav.append(
      h(
        "button",
        { type: "button", "data-tab": tab.id, "aria-current": state.tab === tab.id ? "page" : null },
        icon(tab.id),
        h("span", {}, tab.label)
      )
    );
  });
  return nav;
}

function taskLine(scope, taskText, meta, jsonDone, clamp) {
  const control = taskControl(scope, taskText, jsonDone);
  return h(
    "article",
    { class: "task" + (control.done ? " is-done" : "") },
    control.button,
    h(
      "button",
      {
        type: "button",
        class: "line" + (clamp ? " clamp" : ""),
        "data-detail": taskText,
        "data-scope": scope,
        "data-json-done": jsonDone ? "1" : "0",
      },
      h("span", { class: "line-text" }, taskText),
      meta ? h("span", { class: "task-meta" }, meta) : null
    )
  );
}

function renderHeute() {
  const data = state.data;
  const tasks = data.heute || [];
  return h(
    "div",
    { class: "view" },
    renderWeatherCard(),
    tasks.length
      ? h(
          "section",
          {},
          h("h2", {}, "Heute zu tun"),
          h("div", { id: "heute-aufgaben" }, tasks.map((task) => taskLine("heute", task.text, task.bereich, task.done))),
          h("p", { class: "hint" }, "Abhaken gilt nur auf diesem Gerät. Sag dem Gartenhelfer Bescheid, dann wird es dauerhaft eingetragen.")
        )
      : h(
          "section",
          {},
          h(
            "div",
            { class: "empty" },
            h("span", { class: "bubble natur", "aria-hidden": "true" }, plantGlyph("blume ringel")),
            h("p", {}, "Heute ist nichts zu tun – genieß den Garten")
          )
        ),
    renderNextCard(),
    h(
      "section",
      {},
      h("h2", {}, "Technik"),
      h(
        "div",
        { class: "status-links" },
        (data.technik || []).map((device) =>
          h(
            "button",
            { type: "button", class: "quiet-link", "data-mehr": "technik" },
            h("i", { class: "dot" + (String(device.status).includes("nicht") ? " warn" : ""), "aria-hidden": "true" }),
            h("span", {}, device.name),
            h("span", { class: "task-meta" }, device.status)
          )
        )
      )
    )
  );
}

function renderJahr() {
  const data = state.data;
  const months = data.jahr || [];
  const month = months.find((item) => item.key === state.monatKey) || months[0];
  const categories = data.kategorien || [];
  const groups = month
    ? categories
        .filter((category) => ((month.aufgaben && month.aufgaben[category.key]) || []).length)
        .map((category, index) => {
          const items = month.aufgaben[category.key] || [];
          const details = h("details", { class: "fold", open: index === 0 ? "open" : null });
          details.append(
            h(
              "summary",
              {},
              h("i", { class: "dot " + category.key, "aria-hidden": "true" }),
              h("span", { class: "fold-label" }, category.label),
              h("span", { class: "task-meta count" }, String(items.length))
            )
          );
          details.append(h("div", { class: "fold-body" }, items.map((taskText) => taskLine(month.key, taskText, "", false, false))));
          return details;
        })
    : [];
  const progress = month ? monthProgress(month) : { done: 0, total: 0 };
  return h(
    "div",
    { class: "view calendar" },
    h(
      "div",
      { class: "section-head" },
      h("h2", {}, month ? month.name : "Kalender"),
      h("div", { class: "progress-side" }, ring(progress.done, progress.total), h("span", { class: "task-meta" }, progress.done + " von " + progress.total))
    ),
    monthChips(
      "Kalender",
      months.map((item) => ({ value: item.key, label: item.label })),
      month && month.key,
      "data-monat"
    ),
    groups.length ? groups : h("p", { class: "caption" }, "Keine Aufgaben erfasst.")
  );
}

function monthChips(name, options, current, attr) {
  const row = h("div", { class: "month-row" });
  const bar = h("div", { class: "chips", "data-chipbar": name, role: "group", "aria-label": name });
  options.forEach((option) => {
    const on = option.value === current;
    bar.append(
      h(
        "button",
        { type: "button", class: "chip" + (on ? " is-on" : ""), "aria-pressed": on ? "true" : "false", [attr]: option.value },
        option.label
      )
    );
  });
  row.append(bar);
  return row;
}

function renderTechnik() {
  const data = state.data;
  const monthIndex = Number(String(data.standIso || "").slice(5, 7)) - 1;
  const letters = data.monateKurz || ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const devices = data.technik || [];
  const head = h("div", { class: "saison-row saison-head" }, h("span", {}, ""));
  letters.forEach((letter, index) => {
    head.append(h("span", { class: index === monthIndex ? "is-now" : "" }, letter));
  });
  const rows = devices.map((device) => {
    const row = h("div", { class: "saison-row" }, h("div", { class: "saison-name" }, device.name));
    const code = String(device.saison || "").padEnd(12, " ").slice(0, 12);
    [...code].forEach((mark, index) => {
      const cls = "saison-cell " + (mark === "b" || mark === "u" || mark === "w" ? mark : "");
      row.append(
        h("div", {
          class: cls + (index === monthIndex ? " is-now" : ""),
          title: `${device.name}, ${letters[index] || ""}`,
        })
      );
    });
    return row;
  });
  return h(
    "div",
    { class: "view" },
    h("h2", {}, tx("technikUeberschrift", "Wasser & Technik")),
    h(
      "div",
      { class: "devices" },
      devices.map((device) =>
        h(
          "article",
          { class: "card device" },
          h(
            "header",
            {},
            h("h3", {}, device.name),
            h("span", { class: "pill " + statusTone(device.status) }, device.status)
          ),
          h(
            "dl",
            { class: "props" },
            ["Stand", "Erfasst", "Winterfest", "Frühjahr"].map((label, index) =>
              h(
                "div",
                {},
                h("dt", {}, label),
                h("dd", {}, [device.stand, device.erfasst, device.winter, device.fruehjahr][index])
              )
            )
          )
        )
      )
    ),
    h("h3", {}, tx("saisonUeberschrift", "Saisonkalender")),
    h("p", { class: "caption" }, tx("saisonHinweis", "")),
    h(
      "ul",
      { class: "legend" },
      (data.saisonLegende || []).map((item) =>
        h("li", {}, h("i", { class: "swatch " + item.code, "aria-hidden": "true" }), item.label)
      )
    ),
    h("div", { class: "saison card", style: "padding:12px" }, head, rows),
    stackTable(
      "Saisonkalender",
      ["Zeitraum", "Aufgabe", "Betrifft"],
      (data.technikSaison || []).map((row) => ({ values: [row.zeitraum, row.aufgabe, row.betrifft] }))
    )
  );
}

function renderBestand() {
  const data = state.data;
  const items = data.bestand || [];
  const types = [];
  items.forEach((item) => {
    if (item.typ && !types.includes(item.typ)) types.push(item.typ);
  });
  const visible = items.filter((item) => state.typ === "alle" || item.typ === state.typ);
  const options = [{ value: "alle", label: "Alle", count: items.length }].concat(
    types.map((type) => ({
      value: type,
      label: type,
      count: items.filter((item) => item.typ === type).length,
    }))
  );
  return h(
    "div",
    { class: "view" },
    h("h2", {}, tx("bestandUeberschrift", "Bestand")),
    chipBar("Bestand", options, state.typ, "data-typ"),
    stackTable(
      "Bestand",
      ["Element", "Bereich", "Typ", "Maße", "Notizen"],
      visible.map((item) => ({ values: [item.name, item.bereich, item.typ, item.masse, item.notiz] }))
    ),
    visible.length ? null : h("p", { class: "caption" }, "Keine Elemente für diesen Typ."),
    h("p", { class: "caption" }, tx("bestandHinweis", ""))
  );
}

function renderTagebuch() {
  const data = state.data;
  const entries = sortedDiary(data.tagebuch);
  return h(
    "div",
    { class: "view" },
    h("h2", {}, tx("tagebuchUeberschrift", "Gartentagebuch")),
    h(
      "ol",
      { class: "diary" },
      entries.map((entry) =>
        h(
          "li",
          {},
          h("time", { datetime: entry.datum }, entry.anzeige || entry.datum),
          h("span", { class: "tag" }, entry.bereich),
          h("p", {}, entry.eintrag)
        )
      )
    ),
    h("section", { id: "offen" }, h("h2", {}, tx("offenUeberschrift", "Noch zu erfassen")), bullets(data.offen))
  );
}

function renderSketch(skizze, viewBox, labelled) {
  const svg = svgEl("svg", {
    viewBox,
    role: labelled ? "img" : "presentation",
    "aria-label": labelled ? skizze.aria || "Skizze" : null,
    "aria-hidden": labelled ? null : "true",
  });
  const S = 44;
  const fw = 1.65 * S;
  const pfad = 0.3 * S;
  const saum = 0.4 * S;
  const b1x = 40;
  const b1y = 80;
  const b1w = 4 * S;
  const b1h = 4.5 * S;
  const half = 2.25 * S;
  const b2x = 260;
  const b2y = 138;
  const b2w = 4 * S;
  const b2h = 7 * S;
  const hs = 2 * S;
  const sun = 2.5 * S;
  const boxes = {
    "1A": [b1x, b1y, fw, half],
    "1B": [b1x + fw + pfad, b1y, fw, half],
    "1C": [b1x, b1y + half, fw, half],
    "1D": [b1x + fw + pfad, b1y + half, fw, half],
    "2A": [b2x + saum, b2y, fw, hs],
    "2B": [b2x + saum + fw + pfad, b2y, fw, hs],
    "2C": [b2x + saum, b2y + hs, fw, sun],
    "2D": [b2x + saum + fw + pfad, b2y + hs, fw, sun],
    "2E": [b2x + saum, b2y + hs + sun, fw, sun],
    "2F": [b2x + saum + fw + pfad, b2y + hs + sun, fw, sun],
  };
  const [vx, vy, vw, vh] = String(viewBox).split(/[\s,]+/).map(Number);
  const label = (value, x, y, cls, extra) => {
    const size = cls === "lbl" ? 11 : cls === "tiny" ? 8 : 8.2;
    const node = svgEl("text", Object.assign({ x, y, class: cls || "sub", "font-size": size }, extra || {}));
    node.textContent = value || "";
    return node;
  };
  const boxHas = (x, y) => x >= vx + 6 && x <= vx + vw - 6 && y >= vy && y <= vy + vh - 4;
  const mark = (node, id, name) => {
    node.setAttribute("data-hit", id);
    node.setAttribute("role", "button");
    node.setAttribute("tabindex", "0");
    node.setAttribute("aria-label", name);
    const cls = node.getAttribute("class") || "";
    node.setAttribute("class", (cls + " hit").trim());
    return node;
  };
  if (boxHas(238, 24)) svg.append(label(skizze.sueden, 238, 24, "lbl", { "text-anchor": "middle" }));
  else if (24 > vy && 24 < vy + vh) svg.append(label(skizze.sueden, vx + vw / 2, Math.max(24, vy + 16), "lbl", { "text-anchor": "middle" }));
  if (boxHas(238, 752)) svg.append(label(skizze.norden, 238, 752, "lbl", { "text-anchor": "middle" }));
  svg.append(svgEl("circle", { cx: 75, cy: 62, r: 7, class: "tree" }));
  svg.append(svgEl("circle", { cx: 140, cy: 62, r: 7, class: "tree" }));
  svg.append(label(skizze.johannisbeeren, 40, 46, "sub"));
  svg.append(mark(svgEl("rect", { x: 52, y: 36, width: 120, height: 42, class: "hit-pad" }), "pflanze:Johannisbeeren", "Johannisbeeren"));
  svg.append(svgEl("rect", { x: 186, y: 54, width: 12, height: 16, class: "soft" }));
  svg.append(label(skizze.nisthilfe, 170, 46, "tiny"));
  svg.append(svgEl("rect", { x: b1x, y: b1y, width: b1w, height: b1h, rx: 4, class: "frame" }));
  (skizze.felder || []).forEach((field) => {
    const box = boxes[field.code];
    if (!box) return;
    const rect = svgEl("rect", {
      x: box[0],
      y: box[1],
      width: box[2],
      height: box[3],
      rx: 3,
      class: "field " + (field.klasse || "grau"),
    });
    if (field.gestrichelt) rect.setAttribute("stroke-dasharray", "4 3");
    mark(rect, "feld:" + field.code, "Feld " + field.code);
    svg.append(rect);
    svg.append(label(field.code, box[0] + 5, box[1] + 14, "lbl"));
    svg.append(label(field.l1, box[0] + 5, box[1] + 28, "sub"));
    svg.append(label(field.l2, box[0] + 5, box[1] + 40, "sub"));
  });
  svg.append(svgEl("rect", { x: b1x + b1w - saum, y: b1y, width: saum, height: b1h, class: "soft" }));
  svg.append(
    svgEl("rect", {
      x: b1x + b1w - saum,
      y: b1y,
      width: saum,
      height: S,
      fill: "none",
      stroke: "currentColor",
      "stroke-dasharray": "2 2",
    })
  );
  const saum1x = b1x + b1w - saum / 2;
  const saum1y = b1y + b1h / 2;
  svg.append(
    label(skizze.saum1, saum1x, saum1y, "tiny", {
      "text-anchor": "middle",
      transform: `rotate(-90 ${saum1x} ${saum1y})`,
    })
  );
  svg.append(label(skizze.beet1, b1x, b1y + b1h + 14, "lbl"));
  svg.append(label(skizze.querweg, b1x, b1y + b1h + 30, "tiny"));
  svg.append(mark(svgEl("rect", { x: 40, y: 322, width: 2.1 * S, height: S, rx: 3, class: "soft" }), "pflanze:Himbeeren", "Himbeeren"));
  svg.append(label(skizze.himbeeren, 46, 348, "sub"));
  svg.append(mark(svgEl("rect", { x: 40, y: 378, width: 2.5 * S, height: 1.9 * S, rx: 3, class: "frame" }), "pflanze:Gewächshaus", "Gewächshaus"));
  svg.append(svgEl("rect", { x: 44, y: 382, width: 2.5 * S - 8, height: 0.54 * S, class: "bed" }));
  svg.append(svgEl("rect", { x: 44, y: 378 + 1.9 * S - 4 - 0.54 * S, width: 2.5 * S - 8, height: 0.54 * S, class: "bed mittel" }));
  svg.append(label(skizze.gewaechshaus, 48, 421, "sub"));
  svg.append(label(skizze.gewaechshausMass, 48, 433, "tiny"));
  svg.append(svgEl("rect", { x: 40 + 2.5 * S, y: 378, width: 12, height: 1.9 * S, class: "soft" }));
  svg.append(label(skizze.bluehstreifen, 40 + 2.5 * S + 18, 420, "tiny"));
  svg.append(
    label(skizze.laengsweg, 238, 360, "sub", { "text-anchor": "middle", transform: "rotate(-90 238 360)" })
  );
  svg.append(mark(svgEl("circle", { cx: 348, cy: 94, r: 44, class: "tree" }), "pflanze:Sauerkirsche", "Sauerkirsche"));
  svg.append(label(skizze.sauerkirsche, 348, 92, "sub", { "text-anchor": "middle" }));
  svg.append(label(skizze.sauerkirscheUnter, 348, 105, "tiny", { "text-anchor": "middle" }));
  svg.append(svgEl("rect", { x: 402, y: 78, width: 34, height: 26, rx: 6, fill: "none", stroke: "currentColor", "stroke-dasharray": "3 2" }));
  svg.append(label(skizze.laub, 402, 70, "tiny"));
  svg.append(svgEl("rect", { x: b2x, y: b2y, width: b2w, height: b2h, rx: 4, class: "frame" }));
  svg.append(svgEl("rect", { x: b2x, y: b2y, width: saum, height: b2h, class: "soft" }));
  svg.append(svgEl("line", { x1: b2x, y1: b2y + hs, x2: b2x + saum, y2: b2y + hs, stroke: "currentColor", "stroke-dasharray": "2 2" }));
  const saum2x = b2x + saum / 2;
  const saum2y = b2y + b2h / 2 + 40;
  svg.append(
    label(skizze.saum2, saum2x, saum2y, "tiny", {
      "text-anchor": "middle",
      transform: `rotate(-90 ${saum2x} ${saum2y})`,
    })
  );
  svg.append(
    svgEl("line", {
      x1: b2x - 4,
      y1: b2y + hs,
      x2: b2x + b2w + 4,
      y2: b2y + hs,
      stroke: "currentColor",
      "stroke-dasharray": "5 3",
    })
  );
  svg.append(label(skizze.halbschatten, b2x + b2w + 8, b2y + hs + 4, "tiny"));
  svg.append(label(skizze.halbschattenAnnahme, b2x + b2w + 8, b2y + hs + 16, "tiny"));
  svg.append(label(skizze.beet2, b2x + b2w + 8, b2y + b2h - 4, "lbl"));
  svg.append(label(skizze.beet2Mass, b2x + b2w + 8, b2y + b2h + 10, "sub"));
  svg.append(svgEl("rect", { x: b2x, y: 460, width: b2w, height: 140, rx: 4, class: "frame", "stroke-dasharray": "6 4" }));
  svg.append(label(skizze.rasen, b2x + b2w / 2, 526, "sub", { "text-anchor": "middle" }));
  svg.append(label(skizze.rasenHinweis, b2x + b2w / 2, 540, "tiny", { "text-anchor": "middle" }));
  svg.append(mark(svgEl("circle", { cx: 292, cy: 650, r: 28, class: "tree" }), "pflanze:Pflaume", "Pflaume"));
  svg.append(label(skizze.pflaume, 292, 686, "sub", { "text-anchor": "middle" }));
  svg.append(mark(svgEl("circle", { cx: 388, cy: 660, r: 55, class: "tree" }), "pflanze:Süßkirsche", "Süßkirsche"));
  svg.append(label(skizze.suesskirsche, 388, 658, "sub", { "text-anchor": "middle" }));
  svg.append(label(skizze.nistkasten, 388, 671, "tiny", { "text-anchor": "middle" }));
  [...svg.childNodes].forEach((node) => {
    if (!(node instanceof Element)) return;
    const x = Number(node.getAttribute("x") ?? node.getAttribute("cx") ?? node.getAttribute("x1"));
    const y = Number(node.getAttribute("y") ?? node.getAttribute("cy") ?? node.getAttribute("y1"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < vx - 24 || x > vx + vw - 2 || y < vy - 24 || y > vy + vh + 8) node.remove();
  });
  return svg;
}

function bindMapZoom(card) {
  if (!card || card.dataset.zoomBound) return;
  card.dataset.zoomBound = "1";
  const pointers = new Map();
  let startDist = 0;
  let startScale = 1;
  let scale = 1;
  const svg = () => card.querySelector("svg");
  const apply = () => {
    const node = svg();
    if (!node) return;
    node.style.width = scale <= 1.01 ? "100%" : scale * 100 + "%";
    card.classList.toggle("is-zoomed", scale > 1.01);
  };
  card.addEventListener("pointerdown", (event) => {
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      startDist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]) || 1;
      startScale = scale;
    }
  });
  card.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      scale = Math.min(4, Math.max(1, startScale * (dist / startDist)));
      apply();
    }
  });
  const end = (event) => {
    pointers.delete(event.pointerId);
  };
  card.addEventListener("pointerup", end);
  card.addEventListener("pointercancel", end);
  card.addEventListener("dblclick", () => {
    scale = 1;
    apply();
  });
}

function renderPlan() {
  const plan = state.data.plan2027 || {};
  const lage = plan.lageplan || {};
  const skizze = lage.skizze || { felder: [] };
  const beete = plan.beete || {};
  const beetKey = state.planBeet === "b2" ? "b2" : "b1";
  const beetRows = beete[beetKey] || [];
  const kalender = plan.kalender || { monate: [] };
  const month = (kalender.monate || []).find((item) => item.key === state.planMonat) || (kalender.monate || [])[0];
  const kosten = plan.kosten || { balken: [], posten: [] };
  const maxBar = Math.max(...(kosten.balken || []).map((bar) => Number(bar.value) || 0), 1);
  const gh = plan.gewaechshaus || {};
  const obst = plan.obst || {};
  const kraeuter = plan.kraeuter || {};
  const folge = plan.fruchtfolge || {};

  return h(
    "div",
    { class: "view" },
    h("h2", {}, "Plan 2027"),
    section(
      "leitidee",
      (plan.leitidee && plan.leitidee.titel) || "Leitidee 2027",
      h("p", {}, plan.summary || ""),
      h("p", {}, (plan.leitidee && plan.leitidee.text) || ""),
      h(
        "div",
        { class: "metrics" },
        ((plan.leitidee && plan.leitidee.kennzahlen) || []).map((item) =>
          h("article", { class: "metric" }, h("b", {}, item.value), h("span", {}, item.label), h("small", {}, item.detail))
        )
      ),
      bullets(plan.leitidee && plan.leitidee.punkte)
    ),
    section(
      "lageplan",
      lage.titel || "Lageplan",
      h(
        "ul",
        { class: "legend" },
        (lage.legende || []).map((item) => h("li", {}, h("i", { class: "swatch " + item.klasse }), item.label))
      ),
      h("h4", {}, lage.skizzeTitel || "Skizze (Süden oben)"),
      h(
        "figure",
        { class: "sketch" },
        h(
          "div",
          { class: "sketch-split" },
          h(
            "div",
            { class: "sketch-card" },
            h("p", { class: "sketch-label" }, "Beet 1, Beeren, Gewächshaus"),
            renderSketch(skizze, "0 0 300 530", true)
          ),
          h(
            "div",
            { class: "sketch-card" },
            h("p", { class: "sketch-label" }, "Beet 2, Rasen, Obstbäume"),
            renderSketch(skizze, "180 0 540 800", false)
          )
        ),
        h("div", { class: "sketch-full sketch-card" }, renderSketch(skizze, "0 0 740 800", true)),
        h("figcaption", {}, (skizze.massstab || "") + " Felder und Gehölze antippen.")
      ),
      h("h4", {}, lage.aufbauTitel || "Aufbau der Beete"),
      h(
        "div",
        { class: "entries" },
        (lage.aufbau || []).map((row) =>
          h("article", { class: "entry" }, h("p", { class: "kicker" }, row.lead), h("h4", {}, row.title), h("p", {}, row.detail))
        )
      )
    ),
    section(
      "beete",
      beete.titel || "Beetplan",
      chipBar("Beete", beete.optionen || [], beetKey, "data-beet"),
      stackTable(
        beete.titel || "Beetplan",
        beete.spalten || [],
        objectsToRows(beetRows, ["feld", "kultur", "aussaat", "abstand", "ernte", "pflege"])
      ),
      callout(beete.hinweis)
    ),
    section(
      "fruchtfolge",
      folge.titel || "Fruchtfolge",
      stackTable(
        folge.titel || "Fruchtfolge",
        folge.spalten || [],
        (folge.zeilen || []).map((row) => ({ values: row }))
      ),
      h("p", {}, folge.text || "")
    ),
    section(
      "gewaechshaus",
      gh.titel || "Gewächshaus",
      h("h4", {}, gh.sommerTitel || ""),
      stackTable(
        gh.sommerTitel || "Sommerbelegung",
        gh.sommerSpalten || [],
        objectsToRows(gh.sommer, ["bereich", "kultur", "pflanzung", "abstand", "ernte"])
      ),
      h("h4", {}, gh.jahreszeitenTitel || ""),
      h(
        "ol",
        { class: "steps" },
        (gh.schritte || []).map((step) => h("li", {}, h("strong", {}, step.titel), h("p", {}, step.text)))
      ),
      callout(gh.hinweis)
    ),
    section(
      "obst",
      obst.titel || "Obst und Beeren",
      stackTable(
        obst.titel || "Obst",
        obst.spalten || [],
        objectsToRows(obst.zeilen, ["gehoelz", "schnitt", "pflege", "vorbeugung"])
      ),
      h("p", {}, obst.hinweis || "")
    ),
    section(
      "kraeuter",
      kraeuter.titel || "Kräuter",
      stackTable(
        kraeuter.titel || "Kräuter",
        kraeuter.spalten || [],
        objectsToRows(kraeuter.zeilen, ["standort", "pflanze", "anzahl", "abstand", "licht", "kosten"])
      ),
      bullets(kraeuter.punkte)
    ),
    section(
      "insekten",
      (plan.insekten && plan.insekten.titel) || "Insektenlebensräume",
      h(
        "div",
        { class: "entries" },
        ((plan.insekten && plan.insekten.eintraege) || []).map((row) =>
          h("article", { class: "entry" }, h("p", { class: "kicker" }, row.lead), h("h4", {}, row.title), h("p", {}, row.detail))
        )
      )
    ),
    section(
      "kalender",
      kalender.titel || "Monatskalender 2027",
      monthChips(
        "Plankalender",
        (kalender.monate || []).map((item) => ({ value: item.key, label: item.label })),
        month && month.key,
        "data-plan-monat"
      ),
      month ? h("h3", {}, month.name) : null,
      month ? h("ul", { class: "clean wrap-list" }, (month.punkte || []).map((point) => h("li", {}, point))) : null,
      callout(kalender.hinweis)
    ),
    section(
      "kosten",
      kosten.titel || "Einkaufsliste und Kosten",
      h("p", { class: "caption" }, kosten.hinweis || ""),
      h(
        "ul",
        { class: "bars" },
        (kosten.balken || []).map((bar) =>
          h(
            "li",
            { class: "bar-row" },
            h("span", { class: "bar-label" }, bar.label),
            h("span", { class: "bar-value" }, bar.anzeige),
            h(
              "span",
              { class: "bar-track" },
              h("span", { class: "bar-fill", style: "width:" + Math.round(((Number(bar.value) || 0) / maxBar) * 100) + "%" })
            )
          )
        )
      ),
      renderShopping(kosten),
      h("p", {}, kosten.nachsatz || "")
    ),
    renderRegeln(plan.regeln),
    section(
      "offen",
      (plan.offen && plan.offen.titel) || "Offene Punkte",
      bullets(plan.offen && plan.offen.punkte)
    )
  );
}

function renderRegeln(regeln) {
  if (!regeln) return null;
  const details = h("details", { class: "card rules", id: "plan-regeln" });
  const summary = h("summary", {}, regeln.titel || "Regeln aus der Gartenordnung");
  const body = h(
    "div",
    { class: "rules-body" },
    h("p", { class: "caption" }, regeln.hinweis || ""),
    stackTable(
      regeln.titel || "Regeln",
      regeln.spalten || ["Thema", "Regel", "Quelle"],
      (regeln.zeilen || []).map((row) => ({ values: [row.thema, row.regel, row.quelle] }))
    ),
    callout(regeln.bestand)
  );
  details.append(summary, body);
  return details;
}

function revealTarget(target) {
  if (!target) return;
  const details = target.tagName === "DETAILS" ? target : target.closest("details");
  if (details) details.open = true;
  target.scrollIntoView({ block: "start" });
}

function fieldCodeOf(feld) {
  const match = String(feld || "").match(/^(Saum|[12][A-F])/);
  return match ? match[1] : "";
}

function mentionsField(text, code) {
  return new RegExp("(^|[^0-9A-Za-z])" + code + "([^0-9A-Za-z]|$)").test(String(text || ""));
}

function tasksForField(code) {
  const today = berlinParts();
  const key = today.year + "-" + String(today.month).padStart(2, "0");
  const found = [];
  const month = (state.data.jahr || []).find((item) => item.key === key);
  if (month) {
    Object.values(month.aufgaben || {}).forEach((list) => {
      (list || []).forEach((task) => {
        if (mentionsField(task, code)) found.push(task);
      });
    });
  }
  const planMonth = ((((state.data.plan2027 || {}).kalender || {}).monate) || [])[today.month - 1];
  if (planMonth) {
    (planMonth.punkte || []).forEach((task) => {
      if (mentionsField(task, code) && found.indexOf(task) < 0) found.push(task);
    });
  }
  return found;
}

function sketchField(code) {
  const fields = ((((state.data.plan2027 || {}).lageplan || {}).skizze || {}).felder) || [];
  return fields.find((field) => field.code === code) || null;
}

function cropFace(row, code) {
  const year = state.rotYear || "2027";
  const rotation = findRotation(code);
  const index = { 2027: 1, 2028: 2, 2029: 3, 2030: 4 }[year];
  if (year !== "2027" && rotation && rotation[index]) return rotation[index];
  const drawn = sketchField(code);
  if (drawn) return (drawn.l1 + " " + (drawn.l2 || "")).replace(/,\s*$/, "").replace(/\s+/g, " ").trim();
  return String((row && row.kultur) || code);
}

function tileClass(row, code) {
  const year = state.rotYear || "2027";
  const face = year === "2027" ? "" : cropFace(row, code);
  const named = /Starkzehrer/.test(face) ? "stark" : /Mittelzehrer/.test(face) ? "mittel" : /Schwachzehrer/.test(face) ? "schwach" : /Gründüngung/.test(face) ? "grau" : "";
  if (named) return named;
  const drawn = sketchField(code);
  if (drawn && drawn.klasse) return drawn.klasse;
  const kultur = String((row && row.kultur) || "");
  if (kultur.indexOf("Starkzehrer") >= 0) return "stark";
  if (kultur.indexOf("Mittelzehrer") >= 0) return "mittel";
  if (kultur.indexOf("Schwachzehrer") >= 0) return "schwach";
  return "grau";
}

function fieldParts(feld) {
  const raw = String(feld || "");
  const size = (raw.match(/\d+(?:,\d+)?\s*m²/) || [""])[0];
  const note = (raw.match(/\(([^)]+)\)/) || [null, ""])[1];
  return { code: fieldCodeOf(raw), size, note };
}

function bedMeasure(text) {
  const match = String(text || "").match(/\d+(?:,\d+)?\s*×\s*\d+(?:,\d+)?\s*m/);
  return match ? match[0] : "";
}

function plantGlyph(label) {
  const value = norm(label);
  const svg = svgEl("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
  const stroke = { fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" };
  if (/zucchini|hokkaido|kuerbis|kürbis/.test(value)) {
    svg.append(svgEl("circle", Object.assign({ cx: 12, cy: 13, r: 6 }, stroke)));
    svg.append(svgEl("path", Object.assign({ d: "M12 7c2-3 5-3 6-1" }, stroke)));
    return svg;
  }
  if (/moehre|möhre|pastinake|zwiebel|lauch/.test(value)) {
    svg.append(svgEl("path", Object.assign({ d: "M12 21c4 0 6-4 5-9-2 1-4 1-5 0-1 1-3 1-5 0  -1 5 1 9 5 9z" }, stroke)));
    svg.append(svgEl("path", Object.assign({ d: "M12 8V3M9 5c2 1 4 1 6 0" }, stroke)));
    return svg;
  }
  if (/bohne|erbse/.test(value)) {
    svg.append(svgEl("path", Object.assign({ d: "M8 16c0-6 8-6 8-12" }, stroke)));
    svg.append(svgEl("circle", Object.assign({ cx: 8, cy: 17, r: 2 }, stroke)));
    svg.append(svgEl("circle", Object.assign({ cx: 12, cy: 14, r: 2 }, stroke)));
    return svg;
  }
  if (/radies|blume|phacelia|nelke|kraeuter|kräuter|saum|ringel/.test(value)) {
    svg.append(svgEl("circle", Object.assign({ cx: 12, cy: 10, r: 3 }, stroke)));
    svg.append(svgEl("path", Object.assign({ d: "M12 13v8M9 16h6" }, stroke)));
    return svg;
  }
  svg.append(svgEl("path", Object.assign({ d: "M12 21c5-1 7-6 6-11-4 2-6 1-6 0 0 1-2 2-6 0  -1 5 1 10 6 11z" }, stroke)));
  svg.append(svgEl("path", Object.assign({ d: "M12 10V4" }, stroke)));
  return svg;
}

function fieldTile(row) {
  const parts = fieldParts(row.feld);
  const code = parts.code;
  const face = cropFace(row, code);
  const now = tasksForField(code);
  const drawn = sketchField(code);
  return h(
    "button",
    {
      type: "button",
      class: "field-tile " + tileClass(row, code) + (drawn && drawn.gestrichelt ? " is-dashed" : ""),
      "data-hit": "feld:" + code,
    },
    h("span", { class: "tile-plant", "aria-hidden": "true" }, plantGlyph(face + " " + (row.kultur || ""))),
    h(
      "span",
      { class: "tile-copy" },
      h(
        "span",
        { class: "tile-meta" },
        h("span", { class: "code" }, code || row.feld),
        parts.size ? h("span", { class: "size" }, parts.size) : null
      ),
      h("span", { class: "crop" }, face),
      parts.note && face.toLowerCase().indexOf(parts.note.toLowerCase()) < 0 ? h("span", { class: "tile-note" }, parts.note) : null,
      now.length ? h("span", { class: "now-pill" }, "jetzt zu tun") : null
    )
  );
}

function renderHill() {
  const svg = svgEl("svg", { viewBox: "0 0 360 56", "aria-hidden": "true" });
  svg.append(svgEl("circle", { cx: 308, cy: 16, r: 9, class: "hill-sun" }));
  svg.append(svgEl("path", { d: "M0 38 C70 38 96 18 150 26 C210 36 230 14 292 28 C320 34 340 32 360 36 L360 56 L0 56 Z", class: "hill-ground" }));
  svg.append(svgEl("path", { d: "M0 48 C90 40 130 52 200 44 C270 36 310 50 360 46 L360 56 L0 56 Z", class: "hill-ground-2" }));
  svg.append(svgEl("circle", { cx: 78, cy: 34, r: 8, class: "hill-tree" }));
  svg.append(svgEl("path", { d: "M78 40 v8", class: "hill-trunk" }));
  return h("div", { class: "hill" }, svg);
}

function plotText(x, y, value, size, anchor) {
  const node = svgEl("text", {
    x,
    y,
    "text-anchor": anchor || "middle",
    class: size >= 15 ? "plot-label" : "plot-sub",
    "font-size": size,
  });
  node.textContent = value || "";
  return node;
}

function plotLines(g, x, y, lines, size) {
  const gap = size + 3;
  lines.forEach((line, index) => g.append(plotText(x, y + index * gap, line, size, "middle")));
}

function taskKey(text) {
  return String(text || "").replace(/[.\s]+$/g, "").toLowerCase();
}

function mentionsAny(text, words) {
  const value = String(text || "");
  return (words || []).some((word) => {
    const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("(^|[^0-9A-Za-zÄÖÜäöüß])" + escaped, "i").test(value);
  });
}

function tasksForPlot(el) {
  const words = el.treffer && el.treffer.length ? el.treffer : [el.name];
  const found = [];
  const push = (task) => {
    const text = typeof task === "string" ? task : task && task.text;
    if (!text) return;
    const key = taskKey(text);
    const blob = typeof task === "string" ? task : text + " " + ((task && task.bereich) || "");
    if (!mentionsAny(blob, words)) return;
    const idx = found.findIndex((item) => {
      const have = taskKey(item);
      if (have === key || have.startsWith(key) || key.startsWith(have)) return true;
      const short = have.length < key.length ? have : key;
      const long = short === have ? key : have;
      return short.length > 24 && long.includes(short);
    });
    if (idx >= 0) {
      if (text.length > found[idx].length) found[idx] = text;
      return;
    }
    found.push(text);
  };
  (state.data.heute || []).forEach(push);
  const today = berlinParts();
  const key = today.year + "-" + String(today.month).padStart(2, "0");
  const month = (state.data.jahr || []).find((item) => item.key === key);
  if (month) Object.values(month.aufgaben || {}).forEach((list) => (list || []).forEach(push));
  return found.slice(0, 3);
}

function bestandByName(name) {
  const wanted = norm(name);
  return ((state.data && state.data.bestand) || []).find((item) => {
    const have = norm(item.name);
    return have === wanted || have.startsWith(wanted) || wanted.startsWith(have);
  });
}

function drawPlotElement(svg, el, on) {
  const g = svgEl("g", {
    class: "plot-hit" + (on ? " is-on" : ""),
    "data-plot": el.id,
    role: "button",
    tabindex: "0",
    "aria-label": el.name,
    "aria-pressed": on ? "true" : "false",
  });
  const x = el.x;
  const y = el.y;
  const b = el.b;
  const hgt = el.h;
  const cx = x + b / 2;
  if (el.typ === "beet") {
    svg.append(svgEl("rect", { x, y, width: b, height: hgt, rx: 16, class: "plot-bed-frame" }));
    drawBedFields(svg, el);
    return;
  } else if (el.typ === "haus") {
    g.append(svgEl("path", { d: `M${cx},${y + 4} L${x + 8},${y + 26} L${x + b - 8},${y + 26} Z`, class: "plot-roof plot-shape" }));
    g.append(svgEl("rect", { x: x + 8, y: y + 26, width: b - 16, height: hgt - 34, rx: 6, class: "plot-house plot-shape" }));
    g.append(svgEl("path", { d: `M${x + 16},${y + 40} H${x + b - 16}`, class: "plot-pane" }));
    plotLines(g, cx, y + hgt - 38, [el.name, el.masse].filter(Boolean), 13);
  } else if (el.typ === "baum") {
    const r = Math.min(b, hgt) * 0.34;
    g.append(svgEl("path", { d: `M${cx},${y + r * 2} v${Math.max(8, r * 0.7)}`, class: "plot-trunk" }));
    g.append(svgEl("circle", { cx, cy: y + r + 4, r, class: "plot-canopy plot-shape" }));
    g.append(svgEl("circle", { cx: cx - r * 0.28, cy: y + r * 0.7, r: r * 0.28, class: "plot-canopy-lite" }));
    plotLines(g, cx, y + hgt - 12, [el.name], 13);
  } else if (el.typ === "strauch" && el.anzahl > 1) {
    const r = 14;
    for (let i = 0; i < el.anzahl; i += 1) {
      const bx = x + (b * (i + 1)) / (el.anzahl + 1);
      g.append(svgEl("circle", { cx: bx, cy: y + r + 2, r, class: "plot-bush plot-shape" }));
      g.append(svgEl("circle", { cx: bx - 4, cy: y + r, r: 2.2, class: "plot-berry" }));
    }
    g.append(plotText(cx, y + hgt - 6, el.name, 13, "middle"));
  } else if (el.typ === "strauch") {
    g.append(svgEl("rect", { x, y, width: b, height: hgt, rx: 12, class: "plot-cane-bed plot-shape" }));
    plotLines(g, cx, y + 20, [el.name, el.masse].filter(Boolean), 14);
    [0.28, 0.5, 0.72].forEach((step) => {
      g.append(svgEl("path", { d: `M${x + b * step},${y + hgt - 4} v-8`, class: "plot-cane" }));
    });
  } else if (el.typ === "rasen") {
    g.append(svgEl("rect", { x, y, width: b, height: hgt, rx: 14, class: "plot-lawn plot-shape" }));
    [0.3, 0.5, 0.7].forEach((step) => {
      g.append(svgEl("path", { d: `M${x + b * step},${y + 28} v16`, class: "plot-grass" }));
    });
    g.append(plotText(cx, y + hgt / 2 + 8, el.name, 16, "middle"));
  } else if (el.typ === "fass") {
    g.append(svgEl("rect", { x: x + 6, y: y + 8, width: b - 12, height: hgt - 12, rx: 8, class: "plot-tech plot-shape" }));
    g.append(svgEl("ellipse", { cx, cy: y + 10, rx: (b - 12) / 2, ry: 4, class: "plot-tech-top" }));
  } else if (el.typ === "pumpe") {
    g.append(svgEl("circle", { cx, cy: y + hgt / 2 + 4, r: 12, class: "plot-tech plot-shape" }));
    g.append(svgEl("path", { d: `M${cx},${y + 8} v10 M${cx},${y + 12} h10`, class: "plot-pane" }));
  } else if (el.typ === "weg" && b < hgt / 3) {
    g.append(svgEl("rect", { x, y, width: b, height: hgt, rx: 10, class: "plot-path plot-shape" }));
    const label = [el.name, el.masse].filter(Boolean).join(" · ");
    const text = plotText(cx, y + hgt / 2, label, 13, "middle");
    text.setAttribute("transform", `rotate(-90 ${cx} ${y + hgt / 2})`);
    g.append(text);
  } else if (el.typ === "weg") {
    g.append(svgEl("rect", { x, y, width: b, height: hgt, rx: 10, class: "plot-path plot-shape" }));
    g.append(plotText(cx, y + hgt / 2 + 5, el.name, 14, "middle"));
  }
  svg.append(g);
}

function bedFieldRows(el) {
  const beete = ((state.data.plan2027 || {}).beete) || {};
  if (el.id === "beet2") return beete.b2 || [];
  if (el.id === "beet1") return beete.b1 || [];
  return [];
}

function bedGrid(el) {
  if (el.id === "beet2") {
    return { cols: [["2A", "2B"], ["2C", "2D"], ["2E", "2F"]], weights: [2, 2.5, 2.5], saum: "left" };
  }
  return { cols: [["1A", "1B"], ["1C", "1D"]], weights: [1, 1], saum: "right" };
}

function drawBedFields(svg, el) {
  const byCode = {};
  bedFieldRows(el).forEach((row) => {
    const code = fieldCodeOf(row.feld);
    if (code) byCode[code] = row;
  });
  const grid = bedGrid(el);
  const known = grid.cols.some((pair) => pair.some((code) => byCode[code]));
  if (!known) {
    plotLines(svg, el.x + el.b / 2, el.y + el.h / 2, [el.name, el.masse].filter(Boolean), 16);
    return;
  }
  const pad = 4;
  const gap = 3;
  const saumW = byCode.Saum ? 18 : 0;
  const pathW = 5;
  const innerX = el.x + pad + (grid.saum === "left" ? saumW + gap : 0);
  const innerY = el.y + pad;
  const innerW = el.b - pad * 2 - (saumW ? saumW + gap : 0);
  const innerH = el.h - pad * 2;
  const colW = (innerW - pathW) / 2;
  const weightSum = grid.weights.reduce((sum, value) => sum + value, 0);
  const rowGaps = gap * (grid.cols.length - 1);
  let cursorY = innerY;
  grid.cols.forEach((pair, rowIndex) => {
    const rowH = ((innerH - rowGaps) * grid.weights[rowIndex]) / weightSum;
    pair.forEach((code, colIndex) => {
      const row = byCode[code];
      if (!row) return;
      drawFieldCell(svg, el, row, code, {
        x: innerX + colIndex * (colW + pathW),
        y: cursorY,
        b: colW,
        h: rowH,
      });
    });
    cursorY += rowH + gap;
  });
  if (byCode.Saum && saumW) {
    const saumX = grid.saum === "left" ? el.x + pad : el.x + el.b - pad - saumW;
    drawFieldCell(svg, el, byCode.Saum, "Saum", { x: saumX, y: innerY, b: saumW, h: innerH, vertical: true });
  }
}

function drawFieldCell(svg, el, row, code, box) {
  const id = "feld:" + el.id + ":" + code;
  const on = state.plotId === id;
  const klasse = tileClass(row, code);
  const face = cropFace(row, code);
  const now = tasksForField(code);
  const g = svgEl("g", {
    class: "plot-hit" + (on ? " is-on" : ""),
    "data-plot": id,
    role: "button",
    tabindex: "0",
    "aria-label": "Feld " + code + ", " + face + (now.length ? ", jetzt zu tun" : ""),
    "aria-pressed": on ? "true" : "false",
  });
  const dashed = sketchField(code) && sketchField(code).gestrichelt ? " is-dashed" : "";
  g.append(svgEl("rect", {
    x: box.x,
    y: box.y,
    width: box.b,
    height: box.h,
    rx: 8,
    class: "plot-field plot-shape " + klasse + dashed,
  }));
  if (box.vertical) {
    const text = plotText(box.x + box.b / 2, box.y + box.h / 2, code, 12, "middle");
    text.setAttribute("transform", "rotate(-90 " + (box.x + box.b / 2) + " " + (box.y + box.h / 2) + ")");
    text.setAttribute("class", "plot-field-label");
    g.append(text);
  } else {
    const size = box.b < 78 ? 15 : 16;
    g.append(plotText(box.x + box.b / 2, box.y + box.h / 2 + size * 0.35, code, size, "middle"));
    g.lastChild.setAttribute("class", "plot-field-label");
  }
  if (now.length) {
    g.append(svgEl("circle", {
      cx: box.x + box.b - 7,
      cy: box.y + 8,
      r: 3.5,
      class: "plot-now",
    }));
  }
  svg.append(g);
}

function renderFieldCard(bedId, code) {
  const rows = bedFieldRows({ id: bedId });
  const row = rows.find((item) => fieldCodeOf(item.feld) === code);
  if (!row) return null;
  const face = cropFace(row, code);
  const parts = fieldParts(row.feld);
  const year = state.rotYear || "2027";
  const bedName = bedId === "beet2" ? "Beet 2" : "Beet 1";
  const tasks = tasksForPlot({ name: code, treffer: [code, bedName, "Beete"] }).filter((task) => {
    const other = String(task).match(/[12][A-F]/g) || [];
    if (other.some((item) => item !== code)) return false;
    if (code !== "Saum" && /Johannisbeer|Himbeer|Kirsche|Pflaume|Gewächshaus|Regenfass|Pumpe/i.test(task)) return false;
    return true;
  });
  return h(
    "article",
    { class: "plot-karte", id: "plot-karte" },
    h("h3", {}, "Feld " + code),
    h("p", { class: "bed-mass" }, face),
    parts.size ? h("p", {}, parts.size) : null,
    parts.note ? h("p", { class: "caption" }, parts.note) : null,
    year !== "2027" && findRotation(code) ? h("p", { class: "caption" }, year + ": nur die Fruchtfolge-Stufe. Die Kultur im Plan gilt für 2027.") : h("p", {}, row.kultur),
    tasks.length ? h("h4", {}, "Jetzt zu tun") : h("p", { class: "caption" }, "Keine Aufgabe für dieses Feld in diesem Monat."),
    tasks.length ? h("ul", { class: "clean wrap-list" }, tasks.map((task) => h("li", {}, task))) : null,
    h("button", { type: "button", class: "text-btn", "data-jump": bedId === "beet2" ? "garten-beet-2" : "garten-beet-1" }, "Felder ansehen")
  );
}

function renderPlotCard(el) {
  if (!el) return null;
  const bestand = bestandByName(el.name);
  const masse = bestand && bestand.masse && bestand.masse !== "–" ? bestand.masse : el.masse || "";
  const tasks = tasksForPlot(el);
  return h(
    "article",
    { class: "plot-karte", id: "plot-karte" },
    h("h3", {}, el.name),
    masse ? h("p", { class: "bed-mass" }, masse) : null,
    el.ungefahr ? h("p", { class: "caption" }, "Lage ungefähr") : null,
    tasks.length ? h("h4", {}, "Jetzt zu tun") : h("p", { class: "caption" }, "Keine Aufgabe für diesen Monat."),
    tasks.length ? h("ul", { class: "clean wrap-list" }, tasks.map((task) => h("li", {}, task))) : null,
    el.link ? h("button", { type: "button", class: "text-btn", "data-jump": el.link }, "Felder ansehen") : null
  );
}

function renderParzelle(lage) {
  if (!lage || !(lage.elemente || []).length) return null;
  const svg = svgEl("svg", {
    viewBox: lage.viewBox || "0 0 340 660",
    role: "img",
    "aria-label": lage.aria || "Lageplan",
  });
  const box = String(lage.viewBox || "0 0 360 680").split(/[\s,]+/).map(Number);
  svg.append(svgEl("rect", { x: 8, y: 52, width: (box[2] || 360) - 16, height: (box[3] || 680) - 68, rx: 28, class: "plot-ground" }));
  const rose = lage.kompass || { x: 170, y: 34, s: "S", n: "N" };
  const compass = svgEl("g", { "aria-hidden": "true" });
  compass.append(svgEl("circle", { cx: rose.x, cy: rose.y, r: 15, class: "plot-compass" }));
  compass.append(svgEl("path", { d: `M${rose.x},${rose.y - 11} l-5,11 h10 z`, class: "plot-needle" }));
  compass.append(plotText(rose.x, rose.y - 20, rose.s || "S", 14, "middle"));
  compass.append(plotText(rose.x, rose.y + 30, rose.n || "N", 14, "middle"));
  svg.append(compass);
  (lage.elemente || []).forEach((el) => drawPlotElement(svg, el, state.plotId === el.id));
  const fieldPick = String(state.plotId || "").match(/^feld:(beet[12]):(.+)$/);
  const chosen = (lage.elemente || []).find((el) => el.id === state.plotId);
  const plan = state.data.plan2027 || {};
  const years = ((plan.fruchtfolge || {}).spalten || []).slice(1);
  return h(
    "section",
    { class: "plot-block" },
    h("p", { class: "bed-place" }, lage.flaeche || ""),
    years.length
      ? h(
          "div",
          { class: "year-toggle", role: "group", "aria-label": "Fruchtfolge-Jahr" },
          years.map((year) =>
            h(
              "button",
              {
                type: "button",
                class: "chip" + ((state.rotYear || "2027") === year ? " is-on" : ""),
                "aria-pressed": (state.rotYear || "2027") === year ? "true" : "false",
                "data-rot": year,
              },
              year
            )
          )
        )
      : null,
    h("div", { class: "plot-wrap" }, svg),
    h("p", { class: "caption" }, lage.fussnote || ""),
    h("p", { class: "caption" }, lage.hinweis || ""),
    fieldPick ? renderFieldCard(fieldPick[1], fieldPick[2]) : renderPlotCard(chosen)
  );
}

function bedCard(title, mass, place, rows) {
  const skizze = (((state.data.plan2027 || {}).lageplan || {}).skizze) || {};
  const anchor = title === "Beet 1" ? "garten-beet-1" : title === "Beet 2" ? "garten-beet-2" : null;
  return h(
    "article",
    { class: "bed-card", id: anchor },
    h(
      "div",
      { class: "bed-head" },
      h("h2", {}, title),
      mass ? h("p", { class: "bed-mass" }, mass) : null,
      place ? h("p", { class: "bed-place" }, place) : null
    ),
    h("p", { class: "compass" }, skizze.sueden || "Süden"),
    h("div", { class: "bed-soil" }, h("div", { class: "bed-tiles" }, rows.map(fieldTile))),
    h("p", { class: "compass" }, skizze.norden || "Norden")
  );
}

function renderGarten() {
  const plan = state.data.plan2027 || {};
  const beete = plan.beete || {};
  const skizze = (plan.lageplan && plan.lageplan.skizze) || {};
  const placeOf = (value) => {
    const parts = String(value || "").split("·");
    return parts.length > 1 ? parts.slice(1).join("·").trim() : "";
  };
  const options = beete.optionen || [];
  const place1 = placeOf((options.find((item) => item.value === "b1") || {}).label);
  const place2 = placeOf((options.find((item) => item.value === "b2") || {}).label);
  const key = [
    ["stark", "Starkzehrer"],
    ["mittel", "Mittelzehrer"],
    ["schwach", "Schwachzehrer"],
    ["grau", "Gründüngung"],
  ];
  const lage = state.data.lageplan || {};
  return h(
    "div",
    { class: "view garten-view" },
    h("h2", {}, lage.titel || "Parzelle 23"),
    renderParzelle(lage),
    h("h2", {}, "Beete"),
    h(
      "ul",
      { class: "bed-key" },
      key.map(([id, label]) => h("li", {}, h("i", { class: "swatch " + id, "aria-hidden": "true" }), label))
    ),
    bedCard("Beet 1", bedMeasure(skizze.beet1), place1, beete.b1 || []),
    bedCard("Beet 2", bedMeasure(skizze.beet2Mass || skizze.beet2), place2, beete.b2 || [])
  );
}

function typSafe(item) {
  return item.typ;
}

function mehrBack() {
  return h("button", { type: "button", class: "back", "data-mehr": "menu" }, "Zurück");
}

function renderMehr() {
  const plan = (state.data && state.data.plan2027) || {};
  if (!state.mehrView || state.mehrView === "menu") {
    const items = [
      ["technik", "Wasser & Technik"],
      ["tagebuch", "Tagebuch"],
      ["einkauf", "Einkauf"],
      ["regeln", "Regeln"],
      ["offen", "Offen"],
    ];
    return h(
      "div",
      { class: "view" },
      h("h2", {}, "Mehr"),
      h(
        "div",
        { class: "menu" },
        items.map(([id, label]) => h("button", { type: "button", class: "menu-item", "data-mehr": id }, label))
      )
    );
  }
  if (state.mehrView === "technik") {
    const view = renderTechnik();
    view.prepend(mehrBack());
    return view;
  }
  if (state.mehrView === "tagebuch") {
    const view = renderTagebuch();
    view.prepend(mehrBack());
    return view;
  }
  if (state.mehrView === "einkauf") {
    return h("div", { class: "view" }, mehrBack(), h("h2", {}, "Einkauf"), renderShopping(plan.kosten || {}), h("p", {}, (plan.kosten && plan.kosten.nachsatz) || ""));
  }
  if (state.mehrView === "regeln") {
    const rules = renderRegeln(plan.regeln);
    if (rules) rules.open = true;
    return h("div", { class: "view" }, mehrBack(), rules);
  }
  return h(
    "div",
    { class: "view" },
    mehrBack(),
    h("h2", {}, tx("offenUeberschrift", "Noch zu erfassen")),
    bullets(state.data.offen),
    h("h2", {}, (plan.offen && plan.offen.titel) || "Offene Punkte"),
    bullets(plan.offen && plan.offen.punkte)
  );
}

function renderDetail() {
  const detail = state.detail;
  if (!detail) return null;
  const control = detail.scope ? taskControl(detail.scope, detail.text, detail.jsonDone) : null;
  return h(
    "div",
    { class: "sheet-back", "data-close": "1" },
    h(
      "div",
      { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Aufgabe" },
      h("div", { class: "sheet-bar" }, h("h2", {}, "Aufgabe"), h("button", { type: "button", class: "text-btn", "data-close": "1" }, "Schließen")),
      control ? control.button : null,
      h("p", {}, detail.text),
      control && isLocalChecked(detail.scope, detail.text) ? h("p", { class: "caption" }, "auf diesem Gerät abgehakt") : null
    )
  );
}

function renderView() {
  const query = (state.query || "").trim();
  if (query.length >= 2) return renderSearch();
  if (state.tab === "kalender") return renderJahr();
  if (state.tab === "garten") return renderGarten();
  if (state.tab === "plan") return renderPlan();
  if (state.tab === "mehr") return renderMehr();
  return renderHeute();
}

function updateChipFades() {
  document.querySelectorAll(".month-row").forEach((row) => {
    const bar = row.querySelector(".chips");
    if (!bar) return;
    const max = bar.scrollWidth - bar.clientWidth;
    row.classList.toggle("can-left", bar.scrollLeft > 6);
    row.classList.toggle("can-right", max > 6 && bar.scrollLeft < max - 6);
  });
}

function centerChips() {
  document.querySelectorAll("[data-chipbar]").forEach((bar) => {
    const button = bar.querySelector("[aria-pressed='true']");
    if (!button) return;
    const barRect = bar.getBoundingClientRect();
    const btnRect = button.getBoundingClientRect();
    const delta = btnRect.left - barRect.left - (bar.clientWidth - btnRect.width) / 2;
    bar.scrollLeft = Math.max(0, bar.scrollLeft + delta);
  });
  updateChipFades();
}

function syncHeader() {
  const header = document.querySelector(".top");
  if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}

function applySeason() {
  const month = berlinParts().month;
  const season = month === 12 || month <= 2 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
  document.documentElement.dataset.season = season;
}

function paint(resetScroll) {
  applySeason();
  const search = document.querySelector("[data-search]");
  const focused = search && document.activeElement === search;
  const selection = focused ? [search.selectionStart, search.selectionEnd] : null;
  const y = resetScroll ? 0 : window.scrollY;
  app.replaceChildren(renderHeader(), renderOffline(), main, renderNav());
  main.replaceChildren(renderView());
  if (state.sheet) app.append(renderSheet(state.sheet));
  if (state.detail) app.append(renderDetail());
  syncHeader();
  window.scrollTo(0, y);
  if (focused) {
    const next = document.querySelector("[data-search]");
    if (next) {
      next.focus({ preventScroll: true });
      if (selection) next.setSelectionRange(selection[0], selection[1]);
    }
  }
  requestAnimationFrame(() => {
    centerChips();
    document.querySelectorAll(".ring-fg").forEach((el) => {
      if (el.dataset.dash) el.setAttribute("stroke-dasharray", el.dataset.dash);
    });
    document.querySelectorAll(".sketch-zoom, .sketch-card").forEach(bindMapZoom);
  });
  if (state.pendingScroll) {
    const target = document.getElementById(state.pendingScroll);
    state.pendingScroll = null;
    if (target) revealTarget(target);
  }
  if (state.plotScroll) {
    state.plotScroll = false;
    const card = document.getElementById("plot-karte");
    if (card) card.scrollIntoView({ block: "nearest" });
  }
}

function setTab(id, push) {
  if (!TABS.some((tab) => tab.id === id)) return;
  state.tab = id;
  const url = "#" + id;
  if (push) history.pushState({ tab: id }, "", url);
  else history.replaceState({ tab: id }, "", url);
  paint(true);
  main.focus({ preventScroll: true });
}

function onClick(event) {
  const plot = event.target.closest("[data-plot]");
  if (plot && !event.target.closest(".sheet")) {
    state.plotId = plot.getAttribute("data-plot");
    state.plotScroll = true;
    paint(false);
    return;
  }
  const hit = event.target.closest("[data-hit]");
  if (hit && !event.target.closest(".sheet")) {
    state.sheet = hit.getAttribute("data-hit");
    paint(false);
    return;
  }
  if (event.target.closest("[data-close]")) {
    const inside = event.target.closest(".sheet");
    const closeButton = event.target.closest("button[data-close]");
    if (!inside || closeButton) {
      state.sheet = null;
      state.detail = null;
      paint(false);
      return;
    }
  }
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.searchToggle) {
    state.searchOpen = !state.searchOpen;
    if (!state.searchOpen) state.query = "";
    paint(false);
    if (state.searchOpen) {
      const input = document.querySelector("[data-search]");
      if (input) input.focus();
    }
    return;
  }
  if (button.hasAttribute("data-mehr")) {
    state.mehrView = button.dataset.mehr === "menu" ? null : button.dataset.mehr;
    if (state.tab !== "mehr") setTab("mehr", true);
    else paint(true);
    return;
  }
  if (button.dataset.detail) {
    state.detail = { text: button.dataset.detail, scope: button.dataset.scope || "", jsonDone: button.dataset.jsonDone === "1" };
    state.sheet = null;
    paint(false);
    return;
  }
  if (button.dataset.check) {
    const key = button.dataset.check;
    const turningOn = !loadMap(STORE_CHECKS)[key];
    toggleCheck(key);
    state.burst = turningOn ? key : null;
    paint(false);
    return;
  }
  if (button.dataset.shop) {
    toggleShop(button.dataset.shop);
    paint(false);
    return;
  }
  if (button.dataset.refresh) {
    refreshAll();
    return;
  }
  if (button.dataset.resultTab) {
    state.query = "";
    state.searchOpen = false;
    if (button.dataset.resultMonat) state.monatKey = button.dataset.resultMonat;
    if (button.dataset.resultPlan) state.planMonat = button.dataset.resultPlan;
    state.pendingScroll = button.dataset.goto || null;
    const raw = button.dataset.resultTab;
    if (raw === "technik") state.mehrView = "technik";
    if (raw === "tagebuch") state.mehrView = "tagebuch";
    const map = { jahr: "kalender", bestand: "garten", technik: "mehr", tagebuch: "mehr" };
    setTab(map[raw] || raw, true);
    return;
  }
  if (button.dataset.tab) {
    state.query = "";
    state.searchOpen = false;
    if (button.dataset.tab === "mehr" && state.tab !== "mehr") state.mehrView = null;
    setTab(button.dataset.tab, true);
    return;
  }
  if (button.dataset.monat) {
    state.monatKey = button.dataset.monat;
    paint(false);
    return;
  }
  if (button.dataset.typ) {
    state.typ = button.dataset.typ;
    paint(false);
    return;
  }
  if (button.dataset.planMonat) {
    state.planMonat = button.dataset.planMonat;
    paint(false);
    return;
  }
  if (button.dataset.beet) {
    state.planBeet = button.dataset.beet;
    paint(false);
    return;
  }
  if (button.dataset.rot) {
    state.rotYear = button.dataset.rot;
    paint(false);
    return;
  }
  if (button.dataset.jump) {
    const target = document.getElementById(button.dataset.jump);
    if (target) revealTarget(target);
    return;
  }
  if (button.dataset.gotoTab) {
    state.pendingScroll = button.dataset.goto || null;
    setTab(button.dataset.gotoTab, true);
  }
}

function listen() {
  if (state.listening) return;
  state.listening = true;
  document.addEventListener("click", onClick);
  document.addEventListener("scroll", updateChipFades, true);
  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-search]")) return;
    state.query = event.target.value;
    paint(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.sheet) {
      state.sheet = null;
      paint(false);
      return;
    }
    const plotKey = event.target.closest && event.target.closest("[data-plot]");
    if ((event.key === "Enter" || event.key === " ") && plotKey) {
      event.preventDefault();
      state.plotId = plotKey.getAttribute("data-plot");
      state.plotScroll = true;
      paint(false);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-hit]")) {
      event.preventDefault();
      state.sheet = event.target.closest("[data-hit]").getAttribute("data-hit");
      paint(false);
    }
  });
  let pullStart = null;
  document.addEventListener(
    "touchstart",
    (event) => {
      if (window.scrollY > 8) return;
      pullStart = event.touches[0].clientY;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (event) => {
      if (pullStart == null) return;
      const distance = event.changedTouches[0].clientY - pullStart;
      pullStart = null;
      if (distance > 90 && window.scrollY <= 8) refreshAll();
    },
    { passive: true }
  );
  window.addEventListener("popstate", () => {
    state.tab = tabFromHash();
    paint(true);
  });
  window.addEventListener("resize", syncHeader);
  const syncNet = () => {
    const banner = document.querySelector(".offline");
    if (banner) banner.hidden = navigator.onLine;
  };
  window.addEventListener("online", syncNet);
  window.addEventListener("offline", syncNet);
}

function showFatal(message) {
  app.replaceChildren(
    h(
      "div",
      { class: "error" },
      h("h1", {}, "Garten-App – Parzelle 23"),
      h("p", {}, message),
      h("button", { type: "button", class: "retry", id: "retry" }, "Erneut versuchen")
    )
  );
  const retry = document.getElementById("retry");
  if (retry) retry.addEventListener("click", () => boot());
}

function jsonUrl() {
  const url = new URL("data/garten.json", document.baseURI);
  url.searchParams.set("t", String(Date.now()));
  return url.href;
}

async function activateWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  if (hadController) {
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        location.reload();
      }
    });
  }
  const ready = navigator.serviceWorker.controller
    ? Promise.resolve()
    : new Promise((resolve) => {
        const timer = setTimeout(resolve, 4000);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      });
  let reg = null;
  try {
    reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
  } catch (error) {
    /* The app still works online without a worker. */
  }
  if (reg && !navigator.serviceWorker.controller) {
    const installing = reg.installing || reg.waiting;
    if (installing && installing.state !== "activated") {
      await new Promise((resolve) => {
        if (installing.state === "installed" || installing.state === "activated") {
          installing.postMessage({ type: "SKIP_WAITING" });
          resolve();
          return;
        }
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" || installing.state === "activated") {
            installing.postMessage({ type: "SKIP_WAITING" });
            resolve();
          }
        });
        setTimeout(resolve, 4000);
      });
    }
  }
  if (reg && hadController) watchWorker(reg);
  state.workerReg = reg;
  await ready;
}

async function loadData() {
  const response = await fetch(jsonUrl(), { cache: "no-store" });
  if (!response.ok) throw new Error("Status " + response.status);
  const data = await response.json();
  if (!data || !Array.isArray(data.heute) || !Array.isArray(data.jahr)) throw new Error("schema");
  state.data = data;
  if (navigator.onLine) {
    state.fetchedAt = new Date().toISOString();
    localStorage.setItem("garten-daten-zeit", state.fetchedAt);
  } else {
    state.fetchedAt = localStorage.getItem("garten-daten-zeit");
  }
  if (data.titel) document.title = data.titel;
  return data;
}

async function refreshAll() {
  if (state.refreshing) return;
  state.refreshing = true;
  paint(false);
  try {
    await loadData();
    if (state.workerReg) state.workerReg.update().catch(() => {});
  } catch (error) {
    state.fetchedAt = state.fetchedAt || localStorage.getItem("garten-daten-zeit");
  }
  await loadWeather();
  state.refreshing = false;
  paint(false);
}

async function boot() {
  app.replaceChildren(h("p", { class: "boot" }, "Gartenbuch wird geladen …"));
  await activateWorker();
  try {
    const data = await loadData();
    if (!state.ready) {
      state.monatKey = initialMonth(data);
      state.planMonat = initialPlanMonth(data);
      state.ready = true;
    }
    state.tab = tabFromHash();
    listen();
    paint(true);
    loadWeather().then(() => {
      if (state.tab === "heute" && !(state.query || "").trim()) paint(false);
    });
  } catch (error) {
    showFatal("Die Daten aus data/garten.json konnten nicht geladen werden. Ohne Netz und ohne gespeicherte Kopie bleibt das Gartenbuch leer.");
  }
}

boot();
