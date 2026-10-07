import { ENERGY, HERO_MERGE, heroDef } from "../data.js";
import { gemMergeGroups } from "../gems.js";
import { mergeGroups } from "../items.js";
import { mergeHeroes, mergeItems, mergePlayerGems } from "../player.js";
import type { Rng } from "../rng.js";
import { formatItem } from "../stats.js";
import type { PlayerState } from "../types.js";
import { gemCell, iconHtml, itemCell } from "./itemIcon.js";

export function renderInventory(
  root: HTMLElement,
  player: PlayerState,
  rng: Rng,
  victory: boolean,
  onChange: () => void,
): void {
  const itemGroups = mergeGroups(player.inventory)
    .map((group) => {
      const sample = group[0]!;
      const ids = group.slice(0, 5).map((item) => item.id).join(",");
      return `<button type="button" data-merge-items="${ids}">Merge 5 ${escapeHtml(sample.name)} (${escapeHtml(sample.rarity)})</button>`;
    })
    .join("");
  const items = player.inventory
    .map(
      (item) =>
        `<li class="loot-row">${iconHtml(itemCell(item.baseId, item.rarity), 28)}<span>${escapeHtml(formatItem(item))}</span></li>`,
    )
    .join("");

  const gemGroups = gemMergeGroups(player.gems)
    .map((group) => {
      const sample = group[0]!;
      const ids = group.slice(0, 3).map((gem) => gem.id).join(",");
      return `<button type="button" data-merge-gems="${ids}">Merge 3 ${escapeHtml(sample.name)} Lv.${sample.level}</button>`;
    })
    .join("");
  const gems = player.gems
    .map(
      (gem) =>
        `<li class="loot-row">${iconHtml(gemCell(gem.family, gem.level), 28)}<span>${escapeHtml(gem.name)} Lv.${gem.level}</span></li>`,
    )
    .join("");

  const heroBuckets = new Map<string, typeof player.heroes>();
  for (const hero of player.heroes) {
    const key = `${hero.defId}:${hero.rarity}`;
    const list = heroBuckets.get(key) ?? [];
    list.push(hero);
    heroBuckets.set(key, list);
  }
  const heroGroups = [...heroBuckets.values()]
    .filter((group) => group.length >= HERO_MERGE.inputCount && group[0]!.rarity !== "mythic")
    .map((group) => {
      const sample = group[0]!;
      const ids = group.slice(0, HERO_MERGE.inputCount).map((hero) => hero.id).join(",");
      const name = heroDef(sample.defId).name;
      return `<button type="button" data-merge-heroes="${ids}">Merge 3 ${escapeHtml(name)} (${escapeHtml(sample.rarity)})</button>`;
    })
    .join("");
  const heroes = player.heroes
    .map((hero) => {
      const def = heroDef(hero.defId);
      const filled = hero.gems.filter(Boolean).length;
      return `<li>${escapeHtml(def.name)} · ${escapeHtml(hero.rarity)} · ${filled}/${hero.gems.length} gems</li>`;
    })
    .join("");

  root.innerHTML = `
    <p class="muted">${victory ? "Hulao Pass cleared. Merge what you brought home." : "The run ended. Merge the loot you kept."}</p>
    <p class="stats">Gold ${player.gold} · Energy ${player.energy}/${ENERGY.max}</p>
    <h3>Items</h3>
    <div class="merge">${itemGroups || `<p class="muted">Need 5 of the same item and rarity.</p>`}</div>
    <ul>${items || `<li class="muted">No items.</li>`}</ul>
    <h3>Gems</h3>
    <div class="merge">${gemGroups || `<p class="muted">Need 3 identical gems.</p>`}</div>
    <ul>${gems || `<li class="muted">No loose gems. Socketed gems stay on the hero.</li>`}</ul>
    <h3>Heroes</h3>
    <div class="merge">${heroGroups || `<p class="muted">Need 3 copies of the same hero below mythic.</p>`}</div>
    <ul>${heroes}</ul>
  `;

  root.querySelectorAll<HTMLButtonElement>("[data-merge-items]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mergeItems(player, btn.dataset.mergeItems!.split(","), rng);
      onChange();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-merge-gems]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mergePlayerGems(player, btn.dataset.mergeGems!.split(","));
      onChange();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-merge-heroes]").forEach((btn) => {
    btn.addEventListener("click", () => {
      mergeHeroes(player, btn.dataset.mergeHeroes!.split(","));
      onChange();
    });
  });
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
