import { heroDef } from "../data.js";
import { socket, suggestSlot, unequip, unsocket, wear } from "../player.js";
import { computeHeroStats, formatItem, formatStats } from "../stats.js";
import type { HeroInstance, PlayerState, WornSlot } from "../types.js";

const SLOTS: WornSlot[] = [
  "mainHand",
  "offHand",
  "helmet",
  "body",
  "gloves",
  "belt",
  "boots",
  "ring1",
  "ring2",
  "amulet",
];

export function renderHeroSheet(
  root: HTMLElement,
  player: PlayerState,
  heroId: string | null,
  onChange: () => void,
): void {
  if (!heroId) {
    root.innerHTML = `<p class="muted">Click a placed hero to inspect items.</p>`;
    return;
  }
  const hero = player.heroes.find((h) => h.id === heroId);
  if (!hero) {
    root.innerHTML = "";
    return;
  }
  const def = heroDef(hero.defId);
  const worn = new Set(Object.values(hero.equipment).filter(Boolean).map((i) => i!.id));
  const equippedRows = SLOTS.map((slot) => {
    const item = hero.equipment[slot];
    if (slot === "offHand" && item && item === hero.equipment.mainHand) return "";
    const body = item
      ? `<button data-unequip="${slot}">Unequip</button><div>${escapeHtml(formatItem(item))}</div>`
      : `<span class="muted">empty</span>`;
    return `<div class="row"><strong>${slot}</strong>${body}</div>`;
  }).join("");

  const inv = player.inventory
    .map((item) => {
      const taken = worn.has(item.id) ? " (equipped)" : "";
      return `<button class="inv" data-equip="${item.id}">${escapeHtml(formatItem(item))}${taken}</button>`;
    })
    .join("");

  const sockets = hero.gems
    .map((gem, index) => {
      const body = gem
        ? `<button data-unsocket="${index}">Remove</button><div>${escapeHtml(gem.name)} Lv.${gem.level}</div>`
        : `<span class="muted">empty</span>`;
      return `<div class="row"><strong>socket ${index + 1}</strong>${body}</div>`;
    })
    .join("");
  const stash = player.gems
    .map((gem) => `<button class="inv" data-socket="${gem.id}">${escapeHtml(gem.name)} Lv.${gem.level}</button>`)
    .join("");

  root.innerHTML = `
    <h2>${escapeHtml(def.name)} <small>${escapeHtml(def.archetype)} · ${escapeHtml(hero.rarity)}</small></h2>
    <p class="stats">${escapeHtml(formatStats(computeHeroStats(hero)))}</p>
    <h3>Gems <small>${hero.gems.length} sockets</small></h3>
    <div class="list">${sockets}</div>
    <div class="inv-list">${stash || `<p class="muted">No loose gems.</p>`}</div>
    <h3>Worn</h3>
    <div class="list">${equippedRows || `<p class="muted">Nothing equipped.</p>`}</div>
    <h3>Inventory <small>one item, one hero</small></h3>
    <div class="inv-list">${inv || `<p class="muted">No spare items. Win a wave for loot.</p>`}</div>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-unequip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      unequip(player, hero.id, btn.dataset.unequip as WornSlot);
      onChange();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-unsocket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      unsocket(player, hero.id, Number(btn.dataset.unsocket));
      onChange();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-socket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const empty = hero.gems.findIndex((gem) => gem == null);
      if (empty < 0) return;
      socket(player, hero.id, btn.dataset.socket!, empty);
      onChange();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = player.inventory.find((i) => i.id === btn.dataset.equip);
      if (!item) return;
      const slot = suggestSlot(hero, item);
      if (!slot) {
        root.querySelector(".inv-list")?.insertAdjacentHTML(
          "beforebegin",
          `<p class="warn">${escapeHtml(item.name)} does not fit this hero.</p>`,
        );
        return;
      }
      wear(player, hero.id, item.id, slot);
      onChange();
    });
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
