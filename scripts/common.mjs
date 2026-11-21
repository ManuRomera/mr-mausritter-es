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
  ["motion", Boolean, false], ["help", Boolean, true], ["header", Boolean, true],
  ["scale", Number, 100]
];
export const get = key => game.settings.get(ID, key);
export const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const ICONS = {
  preferences: "fa-universal-access", summary: "fa-id-card", inventory: "fa-list", catalog: "fa-box-open",
  sheet: "fa-file-lines", use: "fa-dice-d20", swap: "fa-right-left", spend: "fa-circle-minus",
  restore: "fa-circle-plus", move: "fa-arrows-up-down-left-right", add: "fa-plus", close: "fa-xmark",
  save: "fa-check", confirm: "fa-check"
};
export const icon = key => ICONS[key] ? `fa-solid ${ICONS[key]}` : undefined;
export function button(key, attributes = "") {
  const i = icon(key) ? `<i class="${icon(key)}" inert></i> ` : "";
  return `<button type="button" ${attributes}>${i}${esc(tr(key))}</button>`;
}

export function dialog(title, content, buttons, width = 630, key) {
  const app = new foundry.applications.api.DialogV2({
    window: {title, icon: icon(key)}, classes: ["mrm", "mrm-window"], position: {width}, content,
    buttons: buttons ?? [{action: "close", label: tr("close"), icon: icon("close"), default: true}]
  });
  return app;
}
