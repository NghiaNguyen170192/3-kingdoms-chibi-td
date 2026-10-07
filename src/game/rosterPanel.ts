import { heroDef } from "../data.js";
import { queryRoster, type RosterQuery, type RosterSort } from "../roster.js";
import type { HeroArchetype, HeroInstance, PlayerState } from "../types.js";
import { armedLook } from "./manaSeed.js";
import { mountHeroPortrait } from "./heroPortrait.js";

const TYPE_BORDER: Record<HeroArchetype, string> = {
  speed: "#4aa3ff",
  damager: "#e24b4b",
  mage: "#b56bff",
};

export function bindRosterPanel(
  root: HTMLElement,
  player: PlayerState,
  getSelected: () => string | null,
  onSelect: (heroId: string) => void,
  onFavorite: (heroId: string) => void,
  isDeployed: (heroId: string) => boolean,
): { refresh: () => void } {
  let stops: Array<() => void> = [];
  root.innerHTML = `
    <div class="roster-filters">
      <select id="roster-type" title="Type">
        <option value="">All</option>
        <option value="speed">Speed</option>
        <option value="damager">Damager</option>
        <option value="mage">Mage</option>
      </select>
      <select id="roster-sort" title="Sort">
        <option value="dps-desc">DPS</option>
        <option value="rarity">Rarity</option>
        <option value="favorite">Favorite</option>
      </select>
    </div>
    <div id="roster-list" class="roster-list"></div>
  `;

  const typeEl = root.querySelector<HTMLSelectElement>("#roster-type")!;
  const sortEl = root.querySelector<HTMLSelectElement>("#roster-sort")!;
  const listEl = root.querySelector<HTMLElement>("#roster-list")!;

  const refresh = () => {
    for (const stop of stops) stop();
    stops = [];
    const query: RosterQuery = {
      type: typeEl.value as HeroArchetype | "",
      sort: sortEl.value as RosterSort,
    };
    const selected = getSelected();
    const waiting = queryRoster(player.heroes, query).filter((hero) => !isDeployed(hero.id));
    listEl.innerHTML = waiting.length
      ? waiting.map((hero) => cardHtml(hero, selected === hero.id)).join("")
      : `<p class="muted">All deployed</p>`;
    listEl.querySelectorAll<HTMLButtonElement>("[data-select]").forEach((btn) => {
      btn.addEventListener("click", () => onSelect(btn.dataset.select!));
      const hero = player.heroes.find((entry) => entry.id === btn.dataset.select);
      const canvas = btn.querySelector("canvas");
      if (!hero || !canvas) return;
      stops.push(mountHeroPortrait(canvas, armedLook(hero.defId, hero.gems), 1.24));
    });
    listEl.querySelectorAll<HTMLButtonElement>("[data-fav]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onFavorite(btn.dataset.fav!);
      });
    });
  };

  typeEl.addEventListener("change", refresh);
  sortEl.addEventListener("change", refresh);
  refresh();
  return { refresh };
}

function cardHtml(hero: HeroInstance, selected: boolean): string {
  const def = heroDef(hero.defId);
  const star = hero.favorite ? "★" : "☆";
  return `
    <div class="roster-card ${selected ? "selected" : ""}">
      <button type="button" class="roster-face type-${escapeHtml(def.archetype)}" data-select="${hero.id}" title="${escapeHtml(def.name)}" style="border-color:${TYPE_BORDER[def.archetype]}">
        <canvas width="80" height="88"></canvas>
      </button>
      <button type="button" class="fav" data-fav="${hero.id}" title="Favorite">${star}</button>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
