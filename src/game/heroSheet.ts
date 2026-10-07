import { RARITY_ORDER, heroDef } from "../data.js";
import { socket, suggestSlot, unequip, unsocket, wear } from "../player.js";
import { computeHeroStats, formatItem } from "../stats.js";
import type { EquipSlot, GemFamily, HeroInstance, Item, PlayerState, Rarity, WornSlot } from "../types.js";
import { gemCell, iconHtml, itemCell } from "./itemIcon.js";
import { armedLook } from "./manaSeed.js";
import { mountHeroPortrait } from "./heroPortrait.js";

const SLOTS: Array<{ id: WornSlot; label: string }> = [
  { id: "mainHand", label: "Weapon" },
  { id: "offHand", label: "Off hand" },
  { id: "helmet", label: "Helmet" },
  { id: "body", label: "Body" },
  { id: "gloves", label: "Gloves" },
  { id: "belt", label: "Belt" },
  { id: "boots", label: "Boots" },
  { id: "ring1", label: "Ring" },
  { id: "ring2", label: "Ring" },
  { id: "amulet", label: "Amulet" },
];

const WEAPON_NAME = { speed: "Sword", damager: "Axe", mage: "Mace" } as const;

const GEM_TINT: Record<GemFamily, string> = {
  attackSpeed: "#7cff7c",
  castSpeed: "#b56bff",
  critRate: "#ffd15a",
  critMulti: "#ff9a3c",
  moreDamage: "#ff5a5a",
  fire: "#ff4a32",
  cold: "#7ec8ff",
  lightning: "#ffe14a",
  toxic: "#3ddc6a",
  bleed: "#c41028",
};

const stops = new WeakMap<HTMLElement, () => void>();

export function renderHeroSheet(
  root: HTMLElement,
  player: PlayerState,
  heroId: string | null,
  onChange: () => void,
  options: { deployed?: boolean; onRecall?: () => void } = {},
): void {
  stops.get(root)?.();
  stops.delete(root);
  if (!heroId) {
    root.innerHTML = "";
    return;
  }
  const hero = player.heroes.find((h) => h.id === heroId);
  if (!hero) {
    root.innerHTML = "";
    return;
  }
  const def = heroDef(hero.defId);
  const stats = computeHeroStats(hero);
  const tab = root.dataset.tab === "gems" ? "gems" : "gear";
  const life = Math.round(stats.maxHp);

  root.innerHTML = `
    <section class="hero-card">
      <header class="hero-card-title">Details</header>
      <div class="hero-card-body">
        <dl class="hero-stats">
          ${statRow("Weapon", WEAPON_NAME[def.archetype])}
          ${statRow("Attack", stats.damage.toFixed(0))}
          ${statRow("Attack speed", `${stats.attackSpeed.toFixed(2)}/s`)}
          ${statRow("Cast speed", `${stats.castSpeed.toFixed(2)}/s`)}
          ${statRow("Range", `${stats.range.toFixed(0)} tiles`)}
          ${statRow("Crit", `${(stats.critChance * 100).toFixed(0)}%`)}
          ${statRow("Rank", hero.rarity)}
          ${statRow("Life", String(life))}
        </dl>
        <div class="hero-portrait-wrap">
          <canvas class="hero-portrait" width="148" height="156"></canvas>
          <div class="hero-nameplate">${escapeHtml(def.name)}</div>
        </div>
      </div>
      <div class="hero-life">
        <span>Life</span>
        <div class="hero-life-bar"><span style="width:100%"></span></div>
        <strong>${life}</strong>
        ${
          options.deployed
            ? `<button type="button" class="hero-recall" data-recall>Recall</button>`
            : ""
        }
      </div>
      <p class="hero-note">Worn gear and socketed gems belong to this hero. The bag on the bar is shared.</p>
      <div class="hero-tabs">
        <button type="button" data-tab="gear" class="${tab === "gear" ? "on" : ""}">Gear</button>
        <button type="button" data-tab="gems" class="${tab === "gems" ? "on" : ""}">Gems</button>
      </div>
      <div class="hero-panel" ${tab === "gear" ? "" : "hidden"}>
        <div class="slot-grid">${gearSlots(hero)}</div>
      </div>
      <div class="hero-panel" ${tab === "gems" ? "" : "hidden"}>
        <div class="slot-grid">${gemSlots(hero)}</div>
      </div>
      <p class="warn hero-warn" hidden></p>
    </section>
  `;

  const canvas = root.querySelector<HTMLCanvasElement>(".hero-portrait");
  if (canvas) {
    const look = armedLook(hero.defId, hero.gems);
    stops.set(root, mountHeroPortrait(canvas, look));
  }

  const panels = Array.from(root.querySelectorAll<HTMLElement>(".hero-panel"));
  root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.tab ?? "gear";
      root.dataset.tab = next;
      root.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((tabBtn) => {
        tabBtn.classList.toggle("on", tabBtn.dataset.tab === next);
      });
      panels.forEach((panel, index) => {
        const name = ["gear", "gems"][index];
        panel.toggleAttribute("hidden", name !== next);
      });
    });
  });
  root.querySelector<HTMLButtonElement>("[data-recall]")?.addEventListener("click", () => options.onRecall?.());
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
}

function statRow(label: string, value: string): string {
  return `<div class="stat-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function gearSlots(hero: HeroInstance): string {
  return SLOTS.map(({ id, label }) => {
    const item = hero.equipment[id];
    if (id === "offHand" && item && item === hero.equipment.mainHand) {
      return `<button type="button" class="equip-slot filled" disabled style="border-color:${RARITY_BORDER[item.rarity]}">${iconHtml(itemCell(item.baseId, item.rarity), 24)}<span class="slot-copy"><span>${label}</span><strong>Two-hand</strong></span></button>`;
    }
    if (!item) {
      return `<button type="button" class="equip-slot" disabled><span class="slot-copy"><span>${label}</span><strong>Empty</strong></span></button>`;
    }
    return `<button type="button" class="equip-slot filled" data-unequip="${id}" title="${escapeHtml(formatItem(item))}" style="border-color:${RARITY_BORDER[item.rarity]}">${iconHtml(itemCell(item.baseId, item.rarity), 24)}<span class="slot-copy"><span>${label}</span><strong>${escapeHtml(item.name)}</strong></span></button>`;
  }).join("");
}

function gemSlots(hero: HeroInstance): string {
  return hero.gems
    .map((gem, index) => {
      if (!gem) {
        return `<button type="button" class="equip-slot" disabled><span class="slot-copy"><span>Socket ${index + 1}</span><strong>Empty</strong></span></button>`;
      }
      return `<button type="button" class="equip-slot filled" data-unsocket="${index}" title="${escapeHtml(gem.name)} Lv.${gem.level}" style="border-color:${GEM_TINT[gem.family]}">${iconHtml(gemCell(gem.family, gem.level), 24)}<span class="slot-copy"><span>Lv.${gem.level}</span><strong>${escapeHtml(gem.name)}</strong></span></button>`;
    })
    .join("");
}

const RARITY_BORDER: Record<Rarity, string> = {
  normal: "#c8c8c8",
  magic: "#4aa3ff",
  rare: "#ffd15a",
  unique: "#ff9a3c",
  legendary: "#e24b4b",
  mythic: "#b56bff",
};

let bagSearch = "";
let bagType = "";
let bagRarity = "";

const BAG_TYPES: Array<{ id: EquipSlot | "gem" | ""; label: string }> = [
  { id: "", label: "Type" },
  { id: "weapon", label: "Weapon" },
  { id: "helmet", label: "Helmet" },
  { id: "body", label: "Body" },
  { id: "gloves", label: "Gloves" },
  { id: "belt", label: "Belt" },
  { id: "boots", label: "Boots" },
  { id: "ring", label: "Ring" },
  { id: "amulet", label: "Amulet" },
  { id: "gem", label: "Gem" },
];

function matchesQuery(query: string, text: string): boolean {
  if (!query) return true;
  return text.toLowerCase().includes(query);
}

/** Account stash. One copy of an item can be worn by only one hero. */
export function renderSharedBag(
  root: HTMLElement,
  player: PlayerState,
  heroId: string | null,
  onChange: () => void,
): void {
  const hero = heroId ? player.heroes.find((entry) => entry.id === heroId) : undefined;
  const field = root.querySelector<HTMLInputElement>("#bag-search");
  const typeEl = root.querySelector<HTMLSelectElement>("#bag-type");
  const rarityEl = root.querySelector<HTMLSelectElement>("#bag-rarity");
  if (field) bagSearch = field.value;
  if (typeEl) bagType = typeEl.value;
  if (rarityEl) bagRarity = rarityEl.value;
  const focused = document.activeElement === field;
  const caret = field?.selectionStart ?? bagSearch.length;
  const query = bagSearch.trim().toLowerCase();
  const typeOn = bagType !== "";
  const rarityOn = bagRarity !== "";
  const showItems = bagType !== "gem";
  const showGems = !rarityOn && (bagType === "" || bagType === "gem");
  const worn = new Set(
    player.heroes.flatMap((entry) => Object.values(entry.equipment).filter(Boolean).map((item) => item!.id)),
  );
  const items = showItems
    ? player.inventory
        .filter((item) => (bagType === "" || item.slot === bagType) && (bagRarity === "" || item.rarity === bagRarity))
        .filter((item) => matchesQuery(query, `${item.name} ${item.slot} ${item.rarity}`))
        .map((item) => itemFace(item, worn.has(item.id)))
        .join("")
    : "";
  const gems = showGems
    ? player.gems
        .filter((gem) => matchesQuery(query, `${gem.name} ${gem.family} ${gem.level}`))
        .map((gem) => {
          const tint = GEM_TINT[gem.family];
          return `<button type="button" class="item-face" data-socket="${gem.id}" title="${escapeHtml(gem.name)} Lv.${gem.level}" style="border-color:${tint}">${iconHtml(gemCell(gem.family, gem.level), 28)}<strong>Lv${gem.level}</strong></button>`;
        })
        .join("")
    : "";
  const who = hero ? heroDef(hero.defId).name : "no hero selected";
  root.title = `Shared bag. Gold ${player.gold}. Equip onto ${who}.`;
  const faces = `${items}${gems}`;
  const empty = query || typeOn || rarityOn ? "No matches" : "Empty";
  const typeOptions = BAG_TYPES.map(
    (entry) => `<option value="${entry.id}"${entry.id === bagType ? " selected" : ""}>${entry.label}</option>`,
  ).join("");
  const rarityOptions = [`<option value="">Rarity</option>`]
    .concat(
      RARITY_ORDER.map(
        (rarity) =>
          `<option value="${rarity}"${rarity === bagRarity ? " selected" : ""}>${rarity[0]!.toUpperCase()}${rarity.slice(1)}</option>`,
      ),
    )
    .join("");
  root.innerHTML = `
    <div class="bag-filters">
      <input id="bag-search" class="bag-search" type="search" placeholder="Search items" value="${escapeHtml(bagSearch)}" />
      <select id="bag-type" title="Item type">${typeOptions}</select>
      <select id="bag-rarity" title="Item rarity">${rarityOptions}</select>
    </div>
    <div class="bag-list">
      ${faces || `<p class="muted">${empty}</p>`}
    </div>
    <p class="warn bag-warn" hidden></p>
  `;
  const input = root.querySelector<HTMLInputElement>("#bag-search");
  const rerender = () => renderSharedBag(root, player, heroId, onChange);
  input?.addEventListener("input", () => {
    bagSearch = input.value;
    rerender();
  });
  root.querySelector("#bag-type")?.addEventListener("change", rerender);
  root.querySelector("#bag-rarity")?.addEventListener("change", rerender);
  if (focused && input) {
    input.focus();
    input.setSelectionRange(caret, caret);
  }
  const warn = root.querySelector<HTMLElement>(".bag-warn");
  const fail = (text: string) => {
    if (!warn) return;
    warn.hidden = false;
    warn.textContent = text;
  };
  root.querySelectorAll<HTMLButtonElement>("[data-equip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!hero) {
        fail("Select a hero before equipping.");
        return;
      }
      const item = player.inventory.find((entry) => entry.id === btn.dataset.equip);
      if (!item) return;
      const slot = suggestSlot(hero, item);
      if (!slot) {
        fail(`${item.name} does not fit ${heroDef(hero.defId).name}.`);
        return;
      }
      wear(player, hero.id, item.id, slot);
      onChange();
    });
  });
  root.querySelectorAll<HTMLButtonElement>("[data-socket]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!hero) {
        fail("Select a hero before socketing a gem.");
        return;
      }
      const empty = hero.gems.findIndex((gem) => gem == null);
      if (empty < 0) {
        fail("Every socket on this hero is full.");
        return;
      }
      socket(player, hero.id, btn.dataset.socket!, empty);
      onChange();
    });
  });
}

function itemFace(item: Item, worn: boolean): string {
  return `<button type="button" class="item-face${worn ? " worn" : ""}" data-equip="${item.id}" title="${escapeHtml(formatItem(item))}${worn ? " · worn" : ""}" style="border-color:${RARITY_BORDER[item.rarity]}">${iconHtml(itemCell(item.baseId, item.rarity), 32)}</button>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
