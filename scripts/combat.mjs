// Adapted from Manu Romera's Mausritter Damage Helper. See LICENSE-DAMAGE-HELPER.txt.
import {esc, ID, number, tr, writable} from "./common.mjs";

const LEGACY = "mausritter-combat-carousel";
const actorTypes = new Set(["character", "hireling", "creature"]);
const options = [
  ["combatEnabled", "Enabled", true],
  ["applyArmor", "ApplyArmor", true],
  ["promptStrengthSave", "PromptStrengthSave", true],
  ["autoCritical", "AutoCritical", true],
  ["useGrit", "UseGrit", false],
  ["autoUsage", "AutoUsage", true]
];
const queues = new Map();
const applying = new Set();
const text = (key, values) => tr(`Combat.${key}`, values);
const setting = key => game.settings.get(ID, key);
const flag = (doc, key) => doc.flags?.[ID]?.[key] ?? doc.flags?.[LEGACY]?.[key];

export function registerCombatSettings() {
  const legacySettings = game.settings.storage?.get("world");
  for (const [key, label, initial] of options) {
    const stored = legacySettings?.getSetting(`${LEGACY}.${key}`)?.value;
    const previous = stored === "true" ? true : stored === "false" ? false : stored;
    const prefix = key === "combatEnabled" ? label : `Settings_${label}`;
    const fields = key === "combatEnabled" ? [prefix, prefix + "Hint"] : [prefix + "_Name", prefix + "_Hint"];
    game.settings.register(ID, key, {
      name: `MRMAUS.Combat.${fields[0]}`, hint: `MRMAUS.Combat.${fields[1]}`,
      scope: "world", config: true, type: Boolean, default: typeof previous === "boolean" ? previous : initial
    });
  }
}

function enabled() {
  return game.system.id === "mausritter" && !game.modules.get(LEGACY)?.active && setting("combatEnabled");
}

function inOrder(key, task) {
  const next = (queues.get(key) ?? Promise.resolve()).then(task);
  const tail = next.catch(() => {});
  queues.set(key, tail);
  return next.finally(() => { if (queues.get(key) === tail) queues.delete(key); });
}

const norm = value => String(value ?? "").trim().toLowerCase();
const nonNegative = value => Math.max(0, number(value));

function parseCard(message) {
  if (!message.content?.includes("data-actor-id")) return null;
  const template = document.createElement("template");
  template.innerHTML = message.content ?? "";
  return template.content.querySelector(".mausritter[data-actor-id]");
}

export function weaponDamage(card) {
  const title = norm(card?.querySelector(".roll-damage")?.textContent);
  const labels = ["damage", "daño", norm(game.i18n.localize("Maus.RollDamage"))];
  const result = card?.querySelector(".roll-damagebox .value")?.textContent.trim();
  return labels.includes(title) && /^\d+$/.test(result ?? "") ? Number(result) : null;
}

function sourceActor(card, speaker = {}) {
  // Unlinked tokens have a synthetic actor. Never update their base world actor.
  const tokenId = card.dataset.tokenId || speaker.token?.id || speaker.token;
  if (tokenId) {
    const scene = game.scenes.get(speaker.scene || canvas.scene?.id);
    const direct = scene?.tokens.get(tokenId)?.actor;
    if (direct) return direct;
    // Some native cards stringify the TokenDocument instead of storing its ID.
    if (typeof tokenId !== "string" || !/^\w{16}$/.test(tokenId)) {
      const actorId = card.dataset.actorId || speaker.actor;
      const candidates = scene?.tokens.filter(token => !token.actorLink && token.actor?.id === actorId) ?? [];
      if (candidates.length === 1) return candidates[0].actor;
    }
    return null;
  }
  return game.actors.get(card.dataset.actorId || speaker.actor);
}

function sourceItem(actor, card) {
  if (card.dataset.itemId) return actor.items.get(card.dataset.itemId);
  const name = card.querySelector(".rollweaponh1")?.textContent.trim();
  if (!name) return null;
  const candidates = actor.items.filter(item => item.name === name);
  return candidates.length === 1 ? candidates[0] : null;
}

async function recordUse(message, authorId) {
  if (!enabled() || !setting("autoUsage") || game.user.id !== authorId || flag(message, "usage")) return;
  const card = parseCard(message);
  const actor = card && sourceActor(card, message.speaker);
  const item = actor && sourceItem(actor, card);
  if (!writable(item)) return;
  await inOrder(actor.uuid, async () => {
    if (flag(message, "usage") || !writable(item)) return;
    const maximum = nonNegative(item.system.pips?.max);
    if (!maximum) return;
    const saved = item.getFlag(ID, "lastCombatUse");
    const previous = Math.min(maximum, nonNegative(item.system.pips?.value));
    const usage = saved?.messageId === message.id ? saved.usage : {
      name: item.name, previous, current: Math.min(maximum, previous + 1), maximum, exhausted: previous >= maximum
    };
    if (saved?.messageId !== message.id && !usage.exhausted) {
      await item.update({"system.pips.value": usage.current, [`flags.${ID}.lastCombatUse`]: {messageId: message.id, usage}});
    }
    await message.setFlag(ID, "usage", usage);
    const status = usageKey(usage);
    (status === "UsageSpent" ? ui.notifications.info : ui.notifications.warn).call(ui.notifications, text(status, usage));
  });
}

function usageKey(usage) {
  if (usage.exhausted) return "UsageAlreadyExhausted";
  return usage.current >= usage.maximum ? "UsageExhausted" : "UsageSpent";
}

function authorizes(message) {
  const gm = game.users.activeGM;
  const author = message.author?.id;
  const whispers = message.whisper ?? [];
  const gmSees = gm && (!whispers.length || whispers.includes(gm.id) || (author === gm.id && !message.blind));
  return message.isContentVisible && writable(message) && (gmSees ? gm.id === game.user.id : author === game.user.id);
}

function armorValue(actor) {
  const equipped = actor.items.filter(item => item.type === "armor" && item.system.equipped)
    .reduce((sum, item) => sum + nonNegative(item.system.armor?.value), 0);
  return Math.max(equipped, nonNegative(actor.system.armor));
}

export function damageBreakdown(actor, damage, {applyArmor, useGrit}) {
  const armor = applyArmor ? Math.min(damage, armorValue(actor)) : 0;
  const grit = useGrit ? Math.min(nonNegative(actor.system.grit?.value), damage - armor) : 0;
  const hp = Math.min(nonNegative(actor.system.health?.value), damage - armor - grit);
  const strength = Math.min(nonNegative(actor.system.stats?.strength?.value), damage - armor - grit - hp);
  return {damage, armor, grit, hp, strength};
}

const receiptPath = id => `flags.${ID}.combatReceipts.${id}`;

async function damageActor(actor, message, damage) {
  return inOrder(actor.uuid, async () => {
    if (!writable(actor)) return;
    const existing = actor.getFlag(ID, "combatReceipts")?.[message.id];
    if (existing) return existing;
    const result = damageBreakdown(actor, damage, {applyArmor: setting("applyArmor"), useGrit: setting("useGrit")});
    const strength = nonNegative(actor.system.stats?.strength?.value) - result.strength;
    const dead = result.strength > 0 && strength === 0;
    const pending = result.strength > 0 && !dead && (setting("autoCritical") || setting("promptStrengthSave"));
    const receipt = {...result, name: actor.name, actorUuid: actor.uuid, strengthAfter: strength, dead, pending};
    const updates = {[receiptPath(message.id)]: receipt};
    if (result.grit) updates["system.grit.value"] = nonNegative(actor.system.grit.value) - result.grit;
    if (result.hp) updates["system.health.value"] = nonNegative(actor.system.health.value) - result.hp;
    if (result.strength) updates["system.stats.strength.value"] = strength;
    await actor.update(updates);
    return receipt;
  });
}

function audience(message) {
  if (!message.whisper?.length) return {};
  const whisper = [...message.whisper];
  if (!message.blind && message.author?.id) whisper.push(message.author.id);
  return {whisper: [...new Set(whisper)], blind: message.blind};
}

async function applyDamage(message, damage) {
  if (!enabled() || !authorizes(message) || flag(message, "applied") || applying.has(message.id)) return;
  applying.add(message.id);
  try {
    let plan = message.getFlag(ID, "combatPlan");
    if (!plan) {
      const targets = [...game.user.targets];
      if (!targets.length) return ui.notifications.warn(text("NoTargets"));
      const actors = new Map();
      for (const token of targets) {
        const {actor} = token;
        if (actor && actorTypes.has(actor.type) && writable(actor)) actors.set(actor.uuid, actor);
      }
      if (!actors.size) return ui.notifications.warn(text("NoEditable"));
      plan = [...actors.keys()];
      await message.setFlag(ID, "combatPlan", plan);
    }

    const results = [];
    for (const uuid of plan) {
      const actor = await fromUuid(uuid);
      if (!actor) continue;
      const receipt = await damageActor(actor, message, damage);
      if (receipt) results.push(receipt);
    }
    if (!results.length) return ui.notifications.warn(text("NoEditable"));
    const rows = results.map(result => {
      const details = esc(text("Breakdown", result));
      const note = result.dead ? text("Death", result) :
        result.strength > 0 && (result.pending || setting("promptStrengthSave")) ? text("CriticalPending", result) : "";
      return `<li>${details}${note ? `<br><strong>${esc(note)}</strong>` : ""}</li>`;
    }).join("");
    const checks = results.filter(result => result.pending).map(({actorUuid, name}) => ({actorUuid, name}));
    await message.update({[`flags.${ID}.applied`]: true,
      [`flags.${ID}.criticalChecks`]: {source: message.id, checks}});
    await ChatMessage.create({
      speaker: message.speaker, ...audience(message),
      content: `<div class="mausritter"><div class="rollcontainer mrm-combat"><strong>${esc(text("Applied"))}</strong><ul>${rows}</ul></div></div>`
    });
    await Promise.allSettled(results.filter(result => !result.pending).map(async result => {
      const actor = await fromUuid(result.actorUuid);
      if (writable(actor)) await actor.unsetFlag(ID, `combatReceipts.${message.id}`);
    }));
  } finally { applying.delete(message.id); }
}

async function resolveCritical(message, source, actorUuid, control) {
  if (!enabled() || !authorizes(message)) return false;
  return inOrder(actorUuid, async () => {
    const actor = await fromUuid(actorUuid);
    const receipt = actor?.getFlag(ID, "combatReceipts")?.[source];
    if (!writable(actor) || !receipt?.pending) return true;
    // Persist a rolled result before further document changes so a retry uses the same roll.
    const roll = receipt.save ? Roll.fromJSON(receipt.save) : await rollCritical(actor);
    if (!roll) return false;
    if (!receipt.save) await actor.update({[`${receiptPath(source)}.save`]: JSON.stringify(roll)});
    const success = roll.total <= receipt.strengthAfter;
    if (!success && setting("autoCritical")) await ensureInjured(actor);
    const name = actor.name;
    const result = text(success ? "CriticalSuccess" : setting("autoCritical") ? "CriticalFailure" : "CriticalManual", {name});
    const recap = `${esc(text("CriticalRoll", {name, value: receipt.strengthAfter}))}<br>${esc(result)}`;
    await actor.unsetFlag(ID, `combatReceipts.${source}`);
    control.textContent = text("CriticalResolved", {name});
    control.dataset.done = "true";
    await roll.toMessage({speaker: ChatMessage.getSpeaker({actor}), flavor: recap, ...audience(message)});
    return true;
  });
}

function isInjured(actor) {
  const names = new Set(["injured", "herido", norm(text("Injured"))]);
  return actor.items.some(item => item.type === "condition" && names.has(norm(item.name)));
}

async function rollCritical(actor) {
  const labels = [["1d20", "Maus.RollNormal"], ["2d20kl", "Maus.RollAdvantage"], ["2d20kh", "Maus.RollDisadvantage"]];
  const dialog = await foundry.applications.api.DialogV2.input({
    window: {title: text("ResolveCritical", {name: actor.name})},
    classes: ["mrm", "mrm-window"],
    content: `<label>${esc(game.i18n.localize("Maus.RollSelectType"))}<select name="formula">${labels.map(([formula, label]) =>
      `<option value="${formula}" ${formula === "2d20kh" && isInjured(actor) ? "selected" : ""}>${esc(game.i18n.localize(label))}</option>`).join("")}</select></label>`,
    ok: {label: game.i18n.localize("Maus.Roll")}, rejectClose: false
  });
  return labels.some(([formula]) => formula === dialog?.formula) ? new Roll(dialog.formula).evaluate() : null;
}

async function ensureInjured(actor) {
  if (isInjured(actor)) return;
  await actor.createEmbeddedDocuments("Item", [{
    name: text("Injured"), type: "condition", img: "icons/svg/blood.svg",
    system: {desc: text("InjuredDesc"), clear: text("InjuredClear")}
  }]);
}

function action(anchor, label, execute, errorKey) {
  const control = document.createElement("button");
  control.type = "button";
  control.className = "mrm-combat-action";
  control.textContent = label;
  control.addEventListener("click", async () => {
    control.disabled = true;
    try { await execute(control); }
    catch (error) { console.error(ID, error); ui.notifications.error(text(errorKey)); }
    finally { if (!control.dataset.done) control.disabled = false; }
  });
  anchor.append(control);
  return control;
}

function renderCombat(message, html) {
  if (!enabled() || !message.isContentVisible) return;
  const anchor = html.querySelector(".mausritter .rollcontainer");
  if (!anchor) return;
  const usage = flag(message, "usage");
  if (usage && !anchor.querySelector(".mrm-usage")) {
    const status = document.createElement("p");
    status.className = "mrm-usage";
    status.textContent = text(usageKey(usage), usage);
    anchor.append(status);
  }
  if (!authorizes(message) || anchor.querySelector(".mrm-combat-action")) return;
  const damage = weaponDamage(html.querySelector(".mausritter"));
  if (damage !== null && damage > 0) {
    const control = action(anchor, text(flag(message, "applied") ? "Applied" : "ApplyDamage"), async button => {
      await applyDamage(message, damage);
      if (flag(message, "applied")) {
        button.dataset.done = "true";
        button.textContent = text("Applied");
      }
    }, "DamageError");
    if (flag(message, "applied")) control.disabled = true;
  }
  const critical = message.getFlag(ID, "criticalChecks");
  for (const check of critical?.checks ?? []) {
    const actor = fromUuidSync(check.actorUuid);
    const pending = actor?.getFlag(ID, "combatReceipts")?.[critical.source]?.pending;
    const control = action(anchor, text(pending ? "ResolveCritical" : "CriticalResolved", check),
      async button => {
        if (await resolveCritical(message, critical.source, check.actorUuid, button)) button.dataset.done = "true";
      }, "CriticalError");
    control.disabled = !pending;
  }
}

export function listenCombat() {
  Hooks.on("createChatMessage", (message, _options, userId) => {
    void recordUse(message, userId).catch(error => {
      console.error(ID, error);
      ui.notifications.error(text("UsageError", {name: message.speaker?.alias ?? ""}));
    });
  });
  Hooks.on("renderChatMessageHTML", renderCombat);
}
