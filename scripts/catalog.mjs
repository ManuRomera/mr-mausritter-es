// The catalogue only reads documents available to the current user.
import {button, dialog, esc, fold, itemType, tr, visible, writable} from "./common.mjs";
import {choosePosition, describe, positionPatch} from "./inventory.mjs";

export async function openCatalog(actor) {
  const packs = game.packs.filter(pack => pack.documentName === "Item" && pack.visible)
    .sort((a, b) => a.metadata.label.localeCompare(b.metadata.label, game.i18n.lang));
  const app = dialog(tr("catalog"), `<div class="mrm-panel">
    <div class="mrm-filters">
      <label>${esc(tr("source"))}<select data-mrm-source>
        <option value="">${esc(tr("world"))}</option>
        ${packs.map(pack => `<option value="${esc(pack.collection)}">${esc(pack.metadata.label)}</option>`).join("")}
      </select></label>
      <label>${esc(tr("search"))}<input type="search" data-mrm-search></label>
      <label>${esc(tr("type"))}<select data-mrm-type><option value="">${esc(tr("all"))}</option>
        ${["item", "weapon", "armor", "condition", "spell", "storage"].map(type =>
          `<option value="${type}">${esc(itemType({type}))}</option>`).join("")}</select></label>
    </div>
    <p aria-live="polite" data-mrm-status></p><div class="mrm-results" data-mrm-results></div></div>`);
  app.addEventListener("render", () => {
    const root = app.element;
    const source = root.querySelector("[data-mrm-source]");
    const search = root.querySelector("[data-mrm-search]");
    const type = root.querySelector("[data-mrm-type]");
    const results = root.querySelector("[data-mrm-results]");
    const status = root.querySelector("[data-mrm-status]");
    let generation = 0;
    let entries = [];
    let busy = false;
    const selectedActor = actor ?? game.user.character;
    const render = () => {
      const filtered = entries.filter(item => (!type.value || item.type === type.value)
        && fold(item.name).includes(fold(search.value)));
      status.textContent = tr("results", {count: filtered.length});
      results.innerHTML = filtered.map(item => `<article class="mrm-entry"><details>
        <summary>${esc(item.name)}</summary><img class="mrm-item-image" src="${esc(item.img)}" alt="">
        ${describe(item)}</details><div class="mrm-actions">
        ${button("sheet", `data-mrm-catalog="sheet" data-uuid="${esc(item.uuid)}"`)}
        ${writable(selectedActor) ? button("add", `data-mrm-catalog="give" data-uuid="${esc(item.uuid)}"`) : ""}
        </div></article>`).join("");
    };
    const load = async () => {
      const request = ++generation;
      status.textContent = tr("loading");
      results.replaceChildren();
      entries = [];
      try {
        const pack = packs.find(value => value.collection === source.value);
        const documents = pack ? (pack.visible ? await pack.getDocuments() : []) : game.items.filter(visible);
        if (request !== generation || !root.isConnected) return;
        entries = documents.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang, {sensitivity: "base"}));
        render();
      } catch (error) {
        if (request !== generation) return;
        status.textContent = tr("operationFailed");
        console.error(error);
      }
    };
    source.addEventListener("change", load);
    search.addEventListener("input", render);
    type.addEventListener("change", render);
    results.addEventListener("click", async event => {
      const control = event.target.closest("[data-mrm-catalog]");
      if (!control || busy) return;
      const item = entries.find(entry => entry.uuid === control.dataset.uuid);
      if (!item || !(item.pack ? game.packs.get(item.pack)?.visible : visible(item))) return;
      if (control.dataset.mrmCatalog === "sheet") return item.sheet.render(true);
      if (!writable(selectedActor)) return;
      busy = true;
      try {
        const data = item.toObject();
        delete data._id;
        delete data.folder;
        delete data.ownership;
        delete data.sort;
        delete data._stats;
        if (selectedActor.type === "character") {
          const dest = await choosePosition(selectedActor, item, true);
          if (!dest || !writable(selectedActor)) return;
          data.system.sheet = positionPatch(dest);
        }
        await selectedActor.createEmbeddedDocuments("Item", [data]);
        ui.notifications.info(tr("added", {name: item.name, actor: selectedActor.name}));
      } catch (error) { console.error(error); ui.notifications.error(tr("operationFailed")); }
      finally { busy = false; }
    });
    load();
  }, {once: true});
  return app.render({force: true});
}
