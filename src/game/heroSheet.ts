import { heroDef } from "../data.js";
import { socket, suggestSlot, unequip, unsocket, wear } from "../player.js";
import { computeHeroStats, formatItem } from "../stats.js";
import type { GemFamily, HeroInstance, PlayerState, WornSlot } from "../types.js";
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
    root.innerHTML = `<p class="muted">Select a hero to see stats, gear, and gems.</p>`;
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
      return `<button type="button" class="equip-slot filled" disabled><span>${label}</span><strong>Two-hand</strong></button>`;
    }
    if (!item) {
      return `<button type="button" class="equip-slot" disabled><span>${label}</span><strong>Empty</strong></button>`;
    }
    return `<button type="button" class="equip-slot filled" data-unequip="${id}" title="${escapeHtml(formatItem(item))}"><span>${label}</span><strong>${escapeHtml(item.name)}</strong></button>`;
  }).join("");
}

function gemSlots(hero: HeroInstance): string {
  return hero.gems
    .map((gem, index) => {
      if (!gem) {
        return `<button type="button" class="equip-slot" disabled><span>Socket ${index + 1}</span><strong>Empty</strong></button>`;
      }
      const tint = GEM_TINT[gem.family];
      return `<button type="button" class="equip-slot filled" data-unsocket="${index}" title="${escapeHtml(gem.name)} Lv.${gem.level}"><i style="background:${tint}"></i><span>Socket ${index + 1}</span><strong>${escapeHtml(gem.name)}</strong></button>`;
    })
    .join("");
}

/** Account stash. One copy of an item can be worn by only one hero. */
export function renderSharedBag(
  root: HTMLElement,
  player: PlayerState,
  heroId: string | null,
  onChange: () => void,
): void {
  const hero = heroId ? player.heroes.find((entry) => entry.id === heroId) : undefined;
  const worn = new Set(
    player.heroes.flatMap((entry) => Object.values(entry.equipment).filter(Boolean).map((item) => item!.id)),
  );
  const items = player.inventory
    .map((item) => {
      const taken = worn.has(item.id) ? " · worn" : "";
      return `<button type="button" class="bag-row" data-equip="${item.id}">${escapeHtml(formatItem(item))}${taken}</button>`;
    })
    .join("");
  const gems = player.gems
    .map(
      (gem) =>
        `<button type="button" class="bag-row" data-socket="${gem.id}"><i style="background:${GEM_TINT[gem.family]}"></i>${escapeHtml(gem.name)} Lv.${gem.level}</button>`,
    )
    .join("");
  const who = hero ? heroDef(hero.defId).name : "no hero selected";
  root.innerHTML = `
    <h2>Bag</h2>
    <p class="muted">Shared by every hero. Equip onto ${escapeHtml(who)}. Gold ${player.gold}.</p>
    <h3>Equipment</h3>
    ${items || `<p class="muted">No spare items.</p>`}
    <h3>Gems</h3>
    ${gems || `<p class="muted">No loose gems.</p>`}
    <p class="warn bag-warn" hidden></p>
  `;
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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
