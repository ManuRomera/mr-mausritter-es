// Native 0.6.1 character grid positions. Width and height are kept in the system document.
import { button, dialog, esc, fold, icon, itemType, number, tr, visible, writable } from "./common.mjs";

const slots = [
  ["mainPaw", -270, -150], ["offPaw", -270, -20], ["body1", -140, -150], ["body2", -140, -20],
  ...[0, 1].flatMap(row => [0, 1, 2].map(col => [`pack${row * 3 + col + 1}`, 10 + 130 * col, -150 + 130 * row])),
  ["grit", -205, 150, 2], ["bank", 140, 150, 3]
];
const areas = [
  {points: slots.slice(0, 4), x: -270, y: -150, width: 2, height: 2},
  {points: slots.slice(4, 10), x: 10, y: -150, width: 3, height: 2},
  {points: slots.slice(10, 11), x: -270, y: 150, width: 2, height: 1},
  {points: slots.slice(11), x: 10, y: 150, width: 3, height: 1}
];
const step = 130;
const pitch = 126;
const rotation = item => number(item.system.sheet?.rotation) === -90;
const size = (item, rotated = false) => {
  const width = Math.max(1, number(item.system.size?.width, 1));
  const height = Math.max(1, number(item.system.size?.height, 1));
  return rotated ? [height, width] : [width, height];
};
const box = (x, y, w, h) => [x - (w * pitch) / 2, y - (h * pitch) / 2, x + (w * pitch) / 2, y + (h * pitch) / 2];
const overlaps = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function destinations(actor, item, turned = rotation(item)) {
  const [w, h] = size(item, turned);
  const other = actor.items.filter(entry => entry.id !== item.id).map(entry => {
    const { currentX = 0, currentY = 0 } = entry.system.sheet ?? {};
    return box(number(currentX), number(currentY), ...size(entry, rotation(entry)));
  });
  return areas.flatMap(area => area.points.flatMap(([id, px, y, span]) => {
    const x = span ? area.x : px;
    if (x + (w - 1) * step >= area.x + area.width * step
      || y + (h - 1) * step >= area.y + area.height * step
      || (id === "grit" && item.type !== "condition")) return [];
    const cx = x + (w - 1) * step / 2;
    const cy = y + (h - 1) * step / 2;
    return other.some(o => overlaps(o, box(cx, cy, w, h))) ? [] : [{id, x: cx, y: cy, w, h, turned}];
  }));
}

// Qué objeto ocupa cada hueco (patas, cuerpo y mochila), según su posición en la cuadrícula del sistema.
// Un objeto grande aparece en todos sus huecos; `first` marca el primero.
export function slotContents(actor) {
  const placed = actor.items.filter(item => item.system.sheet).map(item => {
    const {currentX = 0, currentY = 0} = item.system.sheet;
    return {item, area: box(number(currentX), number(currentY), ...size(item, rotation(item)))};
  });
  const seen = new Set();
  const inSlot = ([, x, y]) => placed.filter(({area}) => x > area[0] && x < area[2] && y > area[1] && y < area[3]);
  const rows = slots.slice(0, 10).map(slot => ({id: slot[0], here: inSlot(slot).map(({item}) => {
    const first = !seen.has(item.id);
    seen.add(item.id);
    return {item, first};
  })}));
  // Agallas y Banco no se listan; lo que no cae en ningún hueco (p. ej. recién añadido) va aparte para no perderlo.
  const grit = new Set(slots.slice(10).flatMap(slot => inSlot(slot).map(({item}) => item.id)));
  const loose = actor.items.filter(item => !seen.has(item.id) && !grit.has(item.id));
  if (loose.length) rows.push({id: "unplaced", here: loose.map(item => ({item, first: true}))});
  return rows;
}

export function positionPatch(dest) {
  const {x, y, w, h, turned} = dest;
  return {active: true, currentX: x, currentY: y, initialX: x, initialY: y,
    xOffset: x, yOffset: y, rotation: turned ? -90 : 0, curWidth: w, curHeight: h, zIndex: x + y + 1000};
}

export function facts(item) {
  const s = item.system;
  const [w, h] = size(item, rotation(item));
  const details = [itemType(item), `${w} × ${h}`];
  const pips = number(s.pips?.max);
  if (pips > 0) details.push(tr("spent", {value: number(s.pips.value), max: pips}));
  if (s.weapon?.dmg1) details.push(tr("damage", {value: [s.weapon.dmg1, s.weapon.dmg2].filter(Boolean).join(" / ")}));
  if (item.type === "armor") details.push(tr("armor", {value: number(s.armor?.value)}));
  if (number(s.cost) > 0) details.push(tr("cost", {value: s.cost}));
  return details.join(" · ");
}

const pending = new Set();
async function act(item, fn) {
  if (!writable(item) || pending.has(item.uuid)) return;
  pending.add(item.uuid);
  try { await fn(); }
  finally { pending.delete(item.uuid); }
}

export async function choosePosition(actor, item, placementOnly = false) {
  if (!writable(actor)) return;
  const choices = () => [...destinations(actor, item), ...destinations(actor, item, !rotation(item))];
  if (!choices().length) { ui.notifications.warn(tr("noRoom")); return; }
  const result = await foundry.applications.api.DialogV2.input({
    window: {title: tr("moveTitle", {name: item.name}), icon: icon("move")}, classes: ["mrm"],
    content: `<label>${esc(tr("slot"))}<select name="position">${choices().map(({id, turned}) =>
      `<option value="${id}:${Number(turned)}">${esc(tr(id))} · ${esc(tr(turned ? "rotated" : "upright"))}</option>`).join("")}</select></label>`,
    ok: {label: tr("confirm"), icon: icon("confirm")}, rejectClose: false
  });
  if (!result || !writable(actor)) return;
  const dest = choices().find(({id, turned}) => `${id}:${Number(turned)}` === result.position);
  if (!dest) { ui.notifications.warn(tr("noRoom")); return; }
  if (placementOnly) return dest;
  const live = actor.items.get(item.id);
  if (live) await act(live, () => live.update({"system.sheet": positionPatch(dest)}));
}

export function describe(item) {
  const condition = item.type === "condition";
  const source = String(item.system.description || (condition && item.system.desc) || "");
  const template = document.createElement("template");
  template.innerHTML = source.replace(/<\/p\s*>|<br\s*\/?\s*>/gi, "\n");
  const description = esc(template.content.textContent.trim()).replace(/\n/g, "<br>");
  return `<p class="mrm-facts">${esc(facts(item))}</p>${description ? `<p>${description}</p>` : ""}
    ${condition && item.system.clear ? `<p><strong>${esc(tr("clear"))}</strong> ${esc(item.system.clear)}</p>` : ""}`;
}

function itemRows(actor, key, query) {
  const items = actor.items.filter(item => visible(actor) && fold(`${item.name} ${itemType(item)}`).includes(fold(query)))
    .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, {sensitivity: "base"}));
  if (!items.length) return `<p>${esc(tr("noItems"))}</p>`;
  return items.map(item => {
    const pips = number(item.system.pips?.max);
    const edit = writable(item);
    const attr = action => `data-mrm-item="${esc(item.id)}" data-mrm-action="${action}"`;
    return `<article class="mrm-entry"><details ${key === item.id ? "open" : ""}><summary>${esc(item.name)}</summary>
      ${describe(item)}</details><div class="mrm-actions">
      ${button("sheet", attr("sheet"))}
      ${edit && typeof actor.rollItem === "function" ? button("use", attr("use")) : ""}
      ${edit && item.system.weapon?.dmg2 ? button("swap", attr("swap")) : ""}
      ${edit && pips > 0 ? button("spend", attr("spend")) + button("restore", attr("restore")) : ""}
      ${edit && actor.type === "character" ? button("move", attr("move")) : ""}</div></article>`;
  }).join("");
}

export function openInventory(actor) {
  if (!visible(actor)) return;
  const app = dialog(tr("inventoryTitle", {name: actor.name}), `<div class="mrm-panel">
    <label>${esc(tr("search"))}<input type="search" data-mrm-search></label>
    <div data-mrm-rows class="mrm-results"></div></div>`, undefined, 630, "inventory");
  let hook;
  app.addEventListener("render", () => {
    const root = app.element;
    const search = root.querySelector("[data-mrm-search]");
    const rows = root.querySelector("[data-mrm-rows]");
    const refresh = () => {
      const active = document.activeElement;
      const {mrmItem, mrmAction} = active?.dataset ?? {};
      rows.innerHTML = itemRows(actor, mrmItem, search.value);
      if (mrmItem && mrmAction) rows.querySelector(`[data-mrm-item="${CSS.escape(mrmItem)}"][data-mrm-action="${CSS.escape(mrmAction)}"]`)?.focus();
    };
    refresh();
    search.addEventListener("input", refresh);
    const callbacks = ["createItem", "updateItem", "deleteItem"].map(event =>
      [event, Hooks.on(event, item => { if (item.parent?.uuid === actor.uuid) refresh(); })]);
    hook = () => callbacks.forEach(([event, id]) => Hooks.off(event, id));
    rows.addEventListener("click", async event => {
      const control = event.target.closest("[data-mrm-action]");
      if (!control || !visible(actor)) return;
      const item = actor.items.get(control.dataset.mrmItem);
      if (!item) return;
      try {
        switch (control.dataset.mrmAction) {
          case "sheet": return item.sheet.render(true);
          case "use": if (writable(item)) actor.rollItem(item.id); return;
          case "move": return await choosePosition(actor, item);
          case "swap": return await act(item, async () => {
            const {dmg1, dmg2} = item.system.weapon ?? {};
            if (dmg2) await item.update({"system.weapon.dmg1": dmg2, "system.weapon.dmg2": dmg1});
          });
          case "spend":
          case "restore": {
            const delta = control.dataset.mrmAction === "spend" ? 1 : -1;
            return await act(item, async () => {
              const {value, max} = item.system.pips ?? {};
              const current = number(value);
              const next = Math.min(number(max), Math.max(0, current + delta));
              if (next !== current) await item.update({"system.pips.value": next});
            });
          }
        }
      } catch (error) { console.error(error); ui.notifications.error(tr("operationFailed")); }
    });
  }, {once: true});
  app.addEventListener("close", () => hook?.(), {once: true});
  return app.render({force: true});
}
