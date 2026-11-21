import {listenCombat, registerCombatSettings} from "./combat.mjs";
// Hooks add opt-in presentation and controls to the installed system's own documents.
import {button, dialog, esc, get, ID, rootOf, settings, tr, visible, writable} from "./common.mjs";
import {describe, facts, openInventory} from "./inventory.mjs";
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
    window: {title: tr("preferences")}, classes: ["mrm", "mrm-window"],
    content: `<div class="mrm-panel"><label>${esc(tr("scale"))}
      <input name="scale" type="number" min="90" max="160" step="5" value="${get("scale")}"></label>
      ${settings.filter(([, type]) => type === Boolean).map(([key]) => `<label class="mrm-switch">
        <input type="checkbox" name="${key}" ${get(key) ? "checked" : ""}>
        <span>${esc(tr(key))}<small>${esc(tr(`${key}Hint`))}</small></span></label>`).join("")}</div>`,
    ok: {label: tr("save")}, rejectClose: false
  });
  if (!result) return;
  for (const [key, type] of settings) await game.settings.set(ID, key,
    type === Boolean ? result[key] === true || result[key] === "on" : Math.min(160, Math.max(90, Number(result[key]) || 100)));
}

function summary(actor) {
  if (!visible(actor)) return;
  const stat = ["strength", "dexterity", "will"];
  const labels = ["Strength", "Dexterity", "Will"];
  const health = actor.system.health;
  const field = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const app = dialog(tr("summaryTitle", {name: actor.name}), `<div class="mrm-panel">
    <dl class="mrm-stat-grid">
    ${stat.map((key, index) => {
      const value = actor.system.stats?.[key];
      return value ? field(game.i18n.localize(`Maus.${labels[index]}`), `${value.value} / ${value.max}`) : "";
    }).join("")}
    ${health ? field(game.i18n.localize("Maus.ActorHP"), `${health.value} / ${health.max}`) : ""}
    ${field(tr("armorLabel"), actor.system.armor ?? 0)}
    ${actor.system.pips ? field(game.i18n.localize("Maus.Pips"), actor.system.pips.value) : ""}</dl>
    <div class="mrm-actions">${writable(actor) && typeof actor.rollStat === "function" ? stat.map((key, index) =>
      actor.system.stats?.[key] ? `<button type="button" data-mrm-stat="${key}">${esc(tr("saveStat", {
        stat: game.i18n.localize(`Maus.${labels[index]}`)
      }))}</button>` : "").join("") : ""}${button("inventory", "data-mrm-open-inv")}</div></div>`);
  app.addEventListener("render", () => app.element.addEventListener("click", event => {
    if (event.target.closest("[data-mrm-open-inv]")) return openInventory(actor);
    const key = event.target.closest("[data-mrm-stat]")?.dataset.mrmStat;
    if (stat.includes(key) && writable(actor)) actor.rollStat(actor.system.stats[key]);
  }), {once: true});
  return app.render({force: true});
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
    if (name) control.setAttribute("aria-label", name);
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
  const bar = document.createElement("div");
  bar.className = "mrm-toolbar";
  bar.setAttribute("data-mrm-toolbar", "");
  bar.innerHTML = button("preferences", 'data-mrm-do="preferences"');
  if (actor) bar.innerHTML += button("summary", 'data-mrm-do="summary"')
    + button("inventory", 'data-mrm-do="inventory"') + button("catalog", 'data-mrm-do="catalog"');
  if (item) bar.innerHTML += `<span class="mrm-facts">${esc(facts(item))}</span>`;
  (root.matches("form") ? root : root.querySelector("form") ?? root).prepend(bar);
  bar.addEventListener("click", event => {
    const action = event.target.closest("[data-mrm-do]")?.dataset.mrmDo;
    if (action === "preferences") return preferences();
    if (action === "summary") return summary(actor);
    if (action === "inventory") return openInventory(actor);
    if (action === "catalog") return openCatalog(actor);
  });
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
Hooks.on("renderActorSheet", (app, html) => { if (isMaus()) sheets(app, html, app.actor); });
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
