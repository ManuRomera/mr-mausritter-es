// Shared settings, document permissions and safe text markup.
export const ID = "mr-mausritter-es";
export const tr = (key, values) => values
  ? game.i18n.format(`MRMAUS.${key}`, values) : game.i18n.localize(`MRMAUS.${key}`);
export const esc = value => foundry.utils.escapeHTML(String(value ?? ""));
export const rootOf = html => html?.[0] ?? html;
export const writable = doc => Boolean(doc?.canUserModify(game.user, "update"));
export const visible = doc => Boolean(doc?.testUserPermission(game.user, "OBSERVER"));
export const itemType = item => game.i18n.localize(`TYPES.Item.${item.type}`);
export const fold = value => String(value).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export const settings = [
  ["dark", Boolean, false], ["contrast", Boolean, false], ["readable", Boolean, false],
  ["motion", Boolean, false], ["help", Boolean, true], ["header", Boolean, false],
  ["scale", Number, 100]
];
export const get = key => game.settings.get(ID, key);
export const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export function button(key, attributes = "") {
  return `<button type="button" ${attributes}>${esc(tr(key))}</button>`;
}

export function dialog(title, content, buttons, width = 630) {
  const app = new foundry.applications.api.DialogV2({
    window: {title}, classes: ["mrm", "mrm-window"], position: {width}, content,
    buttons: buttons ?? [{action: "close", label: tr("close"), default: true}]
  });
  return app;
}
