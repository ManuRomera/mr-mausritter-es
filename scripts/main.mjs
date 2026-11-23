import {listenCombat, registerCombatSettings} from "./combat.mjs";
// Hooks add opt-in presentation and controls to the installed system's own documents.
import {esc, get, icon, ID, rootOf, settings, tr, visible} from "./common.mjs";
import {describe, facts, openInventory, slotContents} from "./inventory.mjs";
import {openCatalog} from "./catalog.mjs";

const isMaus = () => game.system.id === "mausritter";
const spanish = () => /^es(?:$|[.-])/i.test(game.i18n.lang);
function apply() {
  const html = document.documentElement;
  for (const [key, type] of settings) if (type === Boolean) html.classList.toggle(`mrm-${key}`, get(key));
  const scale = Math.min(160, Math.max(90, get("scale"))) / 100;
  html.classList.toggle("mrm-scaled", scale !== 1);
  html.style.setProperty("--mrm-text-size", `${1.0625 * scale}rem`);
}

async function preferences() {
  const result = await foundry.applications.api.DialogV2.input({
    window: {title: tr("preferences"), icon: icon("preferences")}, classes: ["mrm", "mrm-window"],
    content: `<div class="mrm-panel"><label>${esc(tr("scale"))}
      <input name="scale" type="number" min="90" max="160" step="5" value="${get("scale")}"></label>
      ${settings.filter(([, type]) => type === Boolean).map(([key]) => `<label class="mrm-switch">
        <input type="checkbox" name="${key}" ${get(key) ? "checked" : ""}>
        <span>${esc(tr(key))}<small>${esc(tr(`${key}Hint`))}</small></span></label>`).join("")}</div>`,
    ok: {label: tr("save"), icon: icon("save")}, rejectClose: false
  });
  if (!result) return;
  for (const [key, type] of settings) await game.settings.set(ID, key,
    type === Boolean ? result[key] === true || result[key] === "on" : Math.min(160, Math.max(90, Number(result[key]) || 100)));
}

// Ficha resumida: la propia hoja se compacta (clase en la ventana, estilos en mesa.css), sin abrir otra ventana.
// Sigue siendo la hoja del sistema: se edita, se tira y se usa el inventario igual. Se recuerda por personaje en este navegador.
const compactKey = actor => `${ID}.resumida.${actor.id}`;
function isCompact(actor) {
  try { return localStorage.getItem(compactKey(actor)) === "1"; } catch { return false; }
}
function applyCompact(app) {
  const el = rootOf(app.element);
  if (!el || app.actor?.type !== "character") return;
  const on = isCompact(app.actor);
  el.classList.toggle("mrm-resumida", on);
  const control = el.querySelector(".window-header a.mrm-summary");
  if (control) {
    const name = tr(on ? "fullSheet" : "summary");
    control.querySelector("i")?.setAttribute("class", `fa-solid ${on ? "fa-expand" : "fa-compress"}`);
    control.dataset.tooltip = name;
    control.setAttribute("aria-label", name);
    control.setAttribute("aria-pressed", String(on));
  }
  if (on && app._tabs?.[0]?.active !== "drag") app._tabs?.[0]?.activate("drag");
  el.querySelector(".mrm-slots")?.remove();
  if (on) el.querySelector(".sheet-body")?.prepend(slotList(app.actor));
}

// En la ficha resumida la cuadrícula se sustituye por una lista de huecos. Pulsar el nombre tira el objeto
// igual que en la cuadrícula del sistema (actor.rollItem); el lápiz abre su ficha.
function slotList(actor) {
  const list = document.createElement("ol");
  list.className = "mrm-slots";
  list.innerHTML = slotContents(actor).map(({id, here}) => `<li class="mrm-slot${here.length ? "" : " mrm-slot-empty"}">
    <span class="mrm-slot-place">${esc(tr(id))}</span>
    <span class="mrm-slot-items">${here.length ? here.map(({item, first}) => {
      const s = item.system;
      const info = [s.weapon?.dmg1 ? [s.weapon.dmg1, s.weapon.dmg2].filter(Boolean).join("/") : "",
        Number(s.pips?.max) > 0 ? `${Number(s.pips.value) || 0}/${s.pips.max}` : ""].filter(Boolean).join(" · ");
      return `<span class="mrm-slot-item${first ? "" : " mrm-slot-more"}">
        <a class="mrm-slot-roll" role="button" tabindex="0" data-item-id="${item.id}" data-tooltip="${esc(facts(item))}">${esc(item.name)}</a>
        ${info ? `<small>${esc(info)}</small>` : ""}
        <a class="mrm-slot-edit" role="button" tabindex="0" data-item-id="${item.id}" aria-label="${esc(tr("sheet"))}" data-tooltip="${esc(tr("sheet"))}"><i class="fa-solid fa-pen-to-square" inert></i></a></span>`;
    }).join("") : "—"}</span></li>`).join("");
  const run = event => {
    const target = event.target.closest("[data-item-id]");
    const item = actor.items.get(target?.dataset.itemId);
    if (!item) return;
    if (target.classList.contains("mrm-slot-edit")) return item.sheet.render(true);
    if (actor.isOwner) actor.rollItem(item.id, {event});
  };
  list.addEventListener("click", run);
  list.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    run(event);
  });
  return list;
}
function fitCompact(app) {
  if (isCompact(app.actor)) requestAnimationFrame(() => app.setPosition({height: "auto"}));
}
function toggleCompact(app) {
  const on = !isCompact(app.actor);
  try { on ? localStorage.setItem(compactKey(app.actor), "1") : localStorage.removeItem(compactKey(app.actor)); } catch { /* sin almacenamiento: solo esta vez */ }
  if (on) app._mrmFullHeight = app.position.height;
  applyCompact(app);
  if (on) fitCompact(app);
  else app.setPosition({height: app._mrmFullHeight ?? app.options.height});
}

const fixedLabels = {
  "Create Item": "Crear objeto", "Edit Item": "Editar objeto", "Delete Item": "Eliminar objeto", "Rotate Item": "Girar objeto",
  "Create Character": "Crear personaje", "Select Stat": "Elegir opción", "Item Type": "Tipo de objeto",
  "Create": "Crear", "Cancel": "Cancelar", "Description": "Descripción", "Item Description": "Descripción del objeto",
  "Clear:": "Retirada:", "Character Keeper": "Ficha de personaje", "Starting Items": "Equipo inicial"
};
function localizeUI(root) {
  if (!spanish()) return;
  root.querySelectorAll("[title]").forEach(el => { if (fixedLabels[el.title]) el.title = fixedLabels[el.title]; });
  for (const el of root.querySelectorAll(".window-title,h2,button,.description strong")) {
    for (const node of el.childNodes) {
      const original = node.nodeType === Node.TEXT_NODE && node.textContent.trim();
      if (original && fixedLabels[original]) node.textContent = node.textContent.replace(original, fixedLabels[original]);
    }
  }
  for (const select of root.querySelectorAll('select[name="type"]')) {
    for (const option of select.options) {
      const key = `TYPES.Item.${option.value}`;
      if (game.i18n.has(key)) option.textContent = game.i18n.localize(key);
    }
  }
}

function keyboard(root) {
  for (const control of root.querySelectorAll("a[title]:not([href]), .stat-roll, .item-roll")) {
    if (control.closest('[data-mrm-toolbar]') || control.dataset.mrmKeyboard) continue;
    control.dataset.mrmKeyboard = "true";
    control.setAttribute("tabindex", "0");
    control.setAttribute("role", "button");
    const name = control.getAttribute("title") || control.textContent.trim();
    if (name) control.setAttribute("aria-label", name);
    control.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      control.click();
    });
  }
}

function fieldLabels(root) {
  for (const input of root.querySelectorAll("input[name],textarea[name],select[name]")) {
    if (input.type === "hidden" || input.labels?.length || input.hasAttribute("aria-label")) continue;
    const name = input.name;
    const stat = /system\.stats\.(strength|dexterity|will)\.(value|max)/.exec(name);
    let label = input.closest(".statblock")?.querySelector("label")?.textContent.trim()
      || input.parentElement?.previousElementSibling?.textContent.trim() || input.placeholder;
    if (stat) label = game.i18n.localize(`Maus.${stat[1][0].toUpperCase()}${stat[1].slice(1)}`);
    if (label && /^(system\.health|system\.stats)\./.test(name))
      label += ` · ${game.i18n.localize(name.endsWith(".max") ? "Maus.Max" : "Maus.Current")}`;
    if (label) input.setAttribute("aria-label", label);
  }
}

function sheets(app, html, actor, item) {
  const root = rootOf(html);
  if (!root?.querySelector) return;
  const window = rootOf(app.element) ?? root;
  window.classList.add("mrm-native");
  for (const control of window.querySelectorAll(".window-header a.header-button")) {
    control.tabIndex = 0;
    const name = control.textContent.trim() || control.title || (control.classList.contains("close") ? tr("close") : "");
    if (name) { control.setAttribute("aria-label", name); control.dataset.tooltip ??= name; }
    // Solo icono: el nombre queda en la ayuda emergente y en aria-label (así cabe siempre el botón de cerrar).
    if (control.querySelector("i")) for (const node of [...control.childNodes]) if (node.nodeType === Node.TEXT_NODE) node.remove();
    if (control.dataset.mrmHeader) continue;
    control.dataset.mrmHeader = "true";
    control.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); control.click(); }
    });
  }
  root.classList.add("mrm-form");
  localizeUI(root);
  keyboard(root);
  fieldLabels(root);
  if (root.querySelector("[data-mrm-toolbar]")) return;
  // Las acciones del módulo van como iconos en la cabecera (getHeaderButtons); aquí solo queda el ancla de la ayuda.
  const bar = document.createElement("div");
  bar.className = "mrm-toolbar";
  bar.setAttribute("data-mrm-toolbar", "");
  if (item) bar.innerHTML = `<span class="mrm-facts">${esc(facts(item))}</span>`;
  else bar.classList.add("mrm-anchor");
  (root.matches("form") ? root : root.querySelector("form") ?? root).prepend(bar);
  if (!actor || !visible(actor)) return;
  const resources = new Map([
    [".stat-roll[data-key='strength']", "strengthHint"],
    [".stat-roll[data-key='dexterity']", "dexterityHint"],
    [".stat-roll[data-key='will']", "willHint"],
    ["input[name='system.health.value'], input[name='system.health.max']", "healthHint"],
    ["input[name='system.pips.value']", "pipsHint"]
  ]);
  function itemFor(target) { return actor.items.get(target.closest(".item-card[data-item-id]")?.dataset.itemId); }
  const pop = document.createElement("section");
  pop.className = "mrm-card-tip";
  pop.hidden = true;
  pop.setAttribute("role", "tooltip");
  bar.append(pop);
  const show = target => {
    const item = itemFor(target);
    const hint = [...resources].find(([selector]) => target.closest(selector))?.[1];
    if (!get("help") || (!item && !hint)) { pop.hidden = true; return; }
    pop.innerHTML = item ? `<strong>${esc(item.name)}</strong>${describe(item)}` : esc(tr(hint));
    pop.hidden = false;
  };
  root.addEventListener("pointerover", event => show(event.target));
  root.addEventListener("pointerout", event => {
    if (!event.relatedTarget?.closest?.(".item-card") || event.relatedTarget.closest(".item-card") !== event.target.closest(".item-card")) pop.hidden = true;
  });
  root.addEventListener("focusin", event => show(event.target));
  root.addEventListener("focusout", () => { pop.hidden = true; });
  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && !pop.hidden) { event.stopPropagation(); pop.hidden = true; }
  });
}

Hooks.once("init", () => {
  if (!isMaus()) return;
  registerCombatSettings();
  for (const [key, type, value] of settings) game.settings.register(ID, key, {
    name: `MRMAUS.${key}`, type, default: value, scope: "client", config: true, onChange: apply,
    ...(type === Boolean ? {hint: `MRMAUS.${key}Hint`} : {range: {min: 90, max: 160, step: 5}})
  });
});
Hooks.once("ready", () => {
  if (!isMaus()) return;
  apply();
  if (game.modules.get("mausritter-combat-carousel")?.active && game.user.isGM) {
    ui.notifications.info(tr("Combat.LegacyActive"));
  }
  game.modules.get(ID).api = {openCatalog, openInventory, preferences};
});
// Iconos de cabecera: las acciones a la izquierda y Accesibilidad justo antes de Cerrar.
function headerButtons(app, buttons, actor) {
  if (!isMaus()) return;
  const make = (key, onclick) => ({label: tr(key), class: `mrm-${key}`, icon: icon(key), onclick});
  if (actor && visible(actor)) buttons.unshift(...(actor.type === "character" ? [make("summary", () => toggleCompact(app))] : []),
    make("inventory", () => openInventory(actor)), make("catalog", () => openCatalog(actor)));
  const close = buttons.findIndex(b => b.class === "close");
  buttons.splice(close < 0 ? buttons.length : close, 0, make("preferences", preferences));
}
Hooks.on("getActorSheetHeaderButtons", (app, buttons) => headerButtons(app, buttons, app.actor));
Hooks.on("getItemSheetHeaderButtons", (app, buttons) => headerButtons(app, buttons));
Hooks.on("renderActorSheet", (app, html) => {
  if (!isMaus()) return;
  sheets(app, html, app.actor);
  applyCompact(app);
  fitCompact(app);
});
Hooks.on("renderItemSheet", (app, html) => { if (isMaus()) sheets(app, html, null, app.item); });
Hooks.on("renderChatMessageHTML", (_message, html) => {
  if (isMaus() && html.querySelector(".mausritter .rollcontainer")) {
    html.classList.add("mrm-chat");
    localizeUI(html);
  }
});
Hooks.on("renderDialog", (app, html) => {
  if (!isMaus()) return;
  const root = rootOf(html);
  if (!root?.querySelector('select[name="advantage"], select[name="enhanced"], select[name="stat"], input[name="power"], select[name="type"]')
      && !root?.querySelector(".mausritter")) return;
  (rootOf(app.element) ?? root).classList.add("mrm-native");
  localizeUI(root);
  fieldLabels(root);
});
Hooks.on("getSceneControlButtons", controls => {
  if (!isMaus() || !controls.tokens?.tools) return;
  controls.tokens.tools.mrMausritterCatalog = {
    name: "mrMausritterCatalog", title: tr("catalog"), icon: "fa-solid fa-box-open",
    button: true, order: 90, onChange: (_event, active) => { if (active) openCatalog(); }
  };
});

Hooks.once("babele.init", babele => {
  if (isMaus()) babele.register({module: ID, lang: "es", dir: "compendium"});
});

listenCombat();
