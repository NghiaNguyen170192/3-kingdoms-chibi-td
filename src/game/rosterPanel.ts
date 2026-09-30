import { heroDef } from "../data.js";
import { queryRoster, type RosterQuery, type RosterSort } from "../roster.js";
import { estimatedDps } from "../stats.js";
import type { HeroArchetype, HeroInstance, PlayerState } from "../types.js";

export function bindRosterPanel(
  root: HTMLElement,
  player: PlayerState,
  getSelected: () => string | null,
  onSelect: (heroId: string) => void,
  onFavorite: (heroId: string) => void,
  isDeployed: (heroId: string) => boolean,
): { refresh: () => void } {
  root.innerHTML = `
    <h2>Roster</h2>
    <input id="roster-search" type="search" placeholder="Search name, type, rarity" />
    <div class="roster-filters">
      <select id="roster-type">
        <option value="">All types</option>
        <option value="speed">Speed</option>
        <option value="damager">Damager</option>
        <option value="mage">Mage</option>
      </select>
      <select id="roster-sort">
        <option value="dps-desc">DPS high to low</option>
        <option value="dps-asc">DPS low to high</option>
        <option value="rarity">Rarity</option>
        <option value="favorite">Favorite</option>
      </select>
    </div>
    <div id="roster-list" class="roster-list"></div>
  `;

  const searchEl = root.querySelector<HTMLInputElement>("#roster-search")!;
  const typeEl = root.querySelector<HTMLSelectElement>("#roster-type")!;
  const sortEl = root.querySelector<HTMLSelectElement>("#roster-sort")!;
  const listEl = root.querySelector<HTMLElement>("#roster-list")!;

  const refresh = () => {
    const query: RosterQuery = {
      search: searchEl.value,
      type: typeEl.value as HeroArchetype | "",
      sort: sortEl.value as RosterSort,
    };
    const selected = getSelected();
    listEl.innerHTML = queryRoster(player.heroes, query)
      .map((hero) => cardHtml(hero, selected === hero.id, isDeployed(hero.id)))
      .join("");
    listEl.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((btn) => {
      btn.addEventListener("click", () => onSelect(btn.dataset.select!));
    });
    listEl.querySelectorAll<HTMLButtonElement>("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onFavorite(btn.dataset.fav!);
      });
    });
  };

  searchEl.addEventListener("input", refresh);
  typeEl.addEventListener("change", refresh);
  sortEl.addEventListener("change", refresh);
  refresh();
  return { refresh };
}

function cardHtml(hero: HeroInstance, selected: boolean, deployed: boolean): string {
  const def = heroDef(hero.defId);
  const dps = estimatedDps(hero).toFixed(1);
  const star = hero.favorite ? "★" : "☆";
  return `
    <div class="roster-card ${selected ? "selected" : ""} ${deployed ? "deployed" : ""} type-${escapeHtml(def.archetype)}">
      <button type="button" class="pick" data-select="${hero.id}">
        <strong>${escapeHtml(def.name)}</strong>
        <span>${escapeHtml(def.archetype)} · ${escapeHtml(hero.rarity)}</span>
        <span>DPS ${dps}${deployed ? " · on map" : ""}</span>
      </button>
      <button type="button" class="fav" data-fav="${hero.id}" title="Favorite">${star}</button>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
