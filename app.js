const TABS = [
  { id: "heute", label: "Heute" },
  { id: "jahr", label: "Jahr" },
  { id: "technik", label: "Technik" },
  { id: "bestand", label: "Bestand" },
  { id: "plan", label: "Plan 2027" },
  { id: "tagebuch", label: "Tagebuch" },
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
  pendingScroll: null,
  listening: false,
  query: "",
  sheet: null,
  weather: null,
  fetchedAt: null,
  refreshing: false,
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
  return TABS.some((tab) => tab.id === id) ? id : "heute";
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
  } else if (name === "jahr") {
    svg.append(svgEl("rect", { x: 3, y: 4, width: 18, height: 17, rx: 2 }));
    path("M3 9h18M8 2v4M16 2v4");
  } else if (name === "technik") {
    path("M12 3s5 6 5 10a5 5 0 0 1-10 0c0-4 5-10 5-10z");
  } else if (name === "bestand") {
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
  return h("section", { class: "plan-section", id: "plan-" + id }, h("h3", {}, title), ...nodes);
}

function renderHeader() {
  const data = state.data;
  return h(
    "header",
    { class: "top" },
    h("div", { class: "title-row" }, h("h1", {}, data.titel || "Garten-App – Parzelle 23"), h("button", { type: "button", class: "icon-btn", "data-refresh": "1" }, state.refreshing ? "Lädt …" : "Aktualisieren")),
    h("p", { class: "stand", role: "status" }, "Stand: ", h("strong", {}, data.stand || "")),
    h("p", { class: "fetched" }, state.fetchedAt ? "Daten geladen: " + formatWhen(state.fetchedAt) : "Daten noch nicht frisch geladen"),
    h(
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
  );
}

function renderOffline() {
  return h("p", { class: "offline", role: "status", hidden: navigator.onLine ? "hidden" : null }, "Offline · zuletzt gespeicherte Daten");
}

function renderNav() {
  const open = (state.data.heute || []).filter((task) => !isTaskDone("heute", task.text, task.done)).length;
  const nav = h("nav", { class: "tabbar", "aria-label": "Bereiche" });
  TABS.forEach((tab) => {
    const button = h(
      "button",
      { type: "button", "data-tab": tab.id, "aria-current": state.tab === tab.id ? "page" : null, "aria-label": tab.label },
      icon(tab.id),
      h("span", {}, tab.label)
    );
    if (tab.id === "heute" && open) button.append(h("span", { class: "badge" }, String(open)));
    nav.append(button);
  });
  return nav;
}

function renderHeute() {
  const data = state.data;
  const tasks = data.heute || [];
  const open = tasks.filter((task) => !isTaskDone("heute", task.text, task.done)).length;
  const done = tasks.length - open;
  return h(
    "div",
    { class: "view" },
    renderWeatherCard(),
    h("p", { class: "lead" }, data.zusammenfassung || ""),
    renderNextCard(),
    h(
      "div",
      { class: "section-head" },
      h("h2", {}, tx("heuteUeberschrift", "Heute & diese Woche")),
      ring(done, tasks.length)
    ),
    h("p", { class: "caption" }, "Erfasster Status, Stand " + data.stand + ": " + open + " von " + tasks.length + " Aufgaben offen."),
    h(
      "div",
      { class: "card", id: "heute-aufgaben" },
      tasks.map((task) => {
        const control = taskControl("heute", task.text, task.done);
        return h(
          "article",
          { class: "task" + (control.done ? " is-done" : "") + (control.local ? " is-local" : "") },
          control.button,
          h(
            "div",
            {},
            h("p", { class: "task-text" }, task.text),
            h("p", { class: "task-meta" }, task.bereich),
            control.local ? h("p", { class: "local-flag" }, "auf diesem Gerät abgehakt") : null,
            task.done ? h("p", { class: "local-flag" }, "im Gartenbuch erledigt") : null
          )
        );
      })
    ),
    deviceHint(),
    callout(data.texte && data.texte.wasserZuerst),
    h(
      "button",
      { type: "button", class: "text-btn", "data-goto-tab": "plan", "data-goto": "plan-kosten" },
      "Einkaufsliste"
    ),
    h(
      "button",
      { type: "button", class: "text-btn", "data-goto-tab": "tagebuch", "data-goto": "offen" },
      tx("offenUeberschrift", "Noch zu erfassen") + " (" + (data.offen || []).length + ")"
    )
  );
}

function renderJahr() {
  const data = state.data;
  const months = data.jahr || [];
  const month = months.find((item) => item.key === state.monatKey) || months[0];
  const categories = data.kategorien || [];
  const blocks = month
    ? categories
        .filter((category) => ((month.aufgaben && month.aufgaben[category.key]) || []).length)
        .map((category) =>
          h(
            "section",
            { class: "card cat " + category.key },
            h("h3", {}, h("i", { class: "dot " + category.key, "aria-hidden": "true" }), category.label),
            h(
              "div",
              {},
              (month.aufgaben[category.key] || []).map((taskText) => {
                const control = taskControl(month.key, taskText, false);
                return h(
                  "article",
                  { class: "task" + (control.done ? " is-done" : "") + (control.local ? " is-local" : "") },
                  control.button,
                  h(
                    "div",
                    {},
                    h("p", { class: "task-text" }, taskText),
                    control.local ? h("p", { class: "local-flag" }, "auf diesem Gerät abgehakt") : null
                  )
                );
              })
            )
          )
        )
    : [];
  const progress = month ? monthProgress(month) : { done: 0, total: 0 };
  return h(
    "div",
    { class: "view" },
    h("h2", {}, tx("jahrUeberschrift", "Jahresübersicht")),
    h(
      "div",
      { class: "chips", "data-chipbar": "Jahr", role: "group", "aria-label": "Jahr" },
      months.map((item) => {
        const itemProgress = monthProgress(item);
        const on = month && item.key === month.key;
        return h(
          "button",
          { type: "button", class: "chip" + (on ? " is-on" : ""), "aria-pressed": on ? "true" : "false", "data-monat": item.key },
          h("span", {}, item.label),
          ring(itemProgress.done, itemProgress.total)
        );
      })
    ),
    month ? h("div", { class: "section-head" }, h("h3", {}, month.name), ring(progress.done, progress.total)) : null,
    blocks.length ? blocks : h("p", { class: "caption" }, "Keine Aufgaben erfasst."),
    deviceHint()
  );
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
  return svg;
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
    h("h2", {}, plan.titel || "Gartenplan 2027"),
    h("p", { class: "lead" }, plan.summary || ""),
    h(
      "nav",
      { class: "subnav", "aria-label": "Gartenplan" },
      h(
        "div",
        { class: "chips", "data-chipbar": "plan" },
        PLAN_NAV.filter(([id]) => plan[id]).map(([id, label]) =>
          h("button", { type: "button", class: "chip", "data-jump": "plan-" + id }, label)
        )
      )
    ),
    section(
      "leitidee",
      (plan.leitidee && plan.leitidee.titel) || "Leitidee 2027",
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
            renderSketch(skizze, "0 8 236 468", true)
          ),
          h(
            "div",
            { class: "sketch-card pan" },
            h("p", { class: "sketch-label" }, "Beet 2, Rasen, Obstbäume"),
            renderSketch(skizze, "220 8 380 752", false)
          )
        ),
        h("div", { class: "sketch-full sketch-card" }, renderSketch(skizze, "0 0 600 760", true)),
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
      dataTable(folge.titel || "Fruchtfolge", folge.spalten || [], folge.zeilen || []),
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
      chipBar(
        "Kalender",
        (kalender.monate || []).map((item) => ({ value: item.key, label: item.label })),
        month && month.key,
        "data-plan-monat"
      ),
      month ? h("h4", {}, month.name) : null,
      month ? bullets(month.punkte) : null,
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

function renderView() {
  const query = (state.query || "").trim();
  if (query.length >= 2) return renderSearch();
  if (state.tab === "jahr") return renderJahr();
  if (state.tab === "technik") return renderTechnik();
  if (state.tab === "bestand") return renderBestand();
  if (state.tab === "plan") return renderPlan();
  if (state.tab === "tagebuch") return renderTagebuch();
  return renderHeute();
}

function centerChips() {
  document.querySelectorAll("[data-chipbar]").forEach((bar) => {
    const button = bar.querySelector("[aria-pressed='true']");
    if (!button) return;
    bar.scrollLeft = Math.max(0, button.offsetLeft - (bar.clientWidth - button.offsetWidth) / 2);
  });
}

function syncHeader() {
  const header = document.querySelector(".top");
  if (header) document.documentElement.style.setProperty("--header-h", header.offsetHeight + "px");
}

function paint(resetScroll) {
  const search = document.querySelector("[data-search]");
  const focused = search && document.activeElement === search;
  const selection = focused ? [search.selectionStart, search.selectionEnd] : null;
  const y = resetScroll ? 0 : window.scrollY;
  app.replaceChildren(renderHeader(), renderOffline(), main, renderNav());
  main.replaceChildren(renderView());
  if (state.sheet) app.append(renderSheet(state.sheet));
  syncHeader();
  window.scrollTo(0, y);
  if (focused) {
    const next = document.querySelector("[data-search]");
    if (next) {
      next.focus({ preventScroll: true });
      if (selection) next.setSelectionRange(selection[0], selection[1]);
    }
  }
  requestAnimationFrame(centerChips);
  if (state.pendingScroll) {
    const target = document.getElementById(state.pendingScroll);
    state.pendingScroll = null;
    if (target) revealTarget(target);
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
  const hit = event.target.closest("[data-hit]");
  if (hit && !event.target.closest(".sheet")) {
    state.sheet = hit.getAttribute("data-hit");
    paint(false);
    return;
  }
  if (event.target.closest("[data-close]")) {
    const inside = event.target.closest(".sheet");
    const closeButton = event.target.closest("button[data-close]");
    if (inside && !closeButton) return;
    state.sheet = null;
    paint(false);
    return;
  }
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.check) {
    toggleCheck(button.dataset.check);
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
    if (button.dataset.resultMonat) state.monatKey = button.dataset.resultMonat;
    if (button.dataset.resultPlan) state.planMonat = button.dataset.resultPlan;
    state.pendingScroll = button.dataset.goto || null;
    setTab(button.dataset.resultTab, true);
    return;
  }
  if (button.dataset.tab) {
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
