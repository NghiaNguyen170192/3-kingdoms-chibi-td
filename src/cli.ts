import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { EQUIPMENT_MERGE, GEM_MERGE, MVP_MAP, heroDef } from "./data.js";
import {
  autoEquipBest,
  autoMergeAll,
  autoSocketGems,
  createNewPlayer,
  mergeItems,
  mergePlayerGems,
  socket,
  wear,
} from "./player.js";
import { deployAll, describeResult, runBattle } from "./game.js";
import { queryRoster, type RosterSort } from "./roster.js";
import { Rng } from "./rng.js";
import { computeHeroStats, estimatedDps, formatGem, formatItem, formatStats } from "./stats.js";
import { gemMergeGroups } from "./gems.js";
import { mergeGroups } from "./items.js";
import type { PlayerState, WornSlot } from "./types.js";

const WORN: WornSlot[] = [
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

function print(lines: string[]): void {
  for (const line of lines) console.log(line);
}

function showRoster(player: PlayerState, args: string[] = []): void {
  const search = args.find((a) => !a.startsWith("--")) ?? "";
  const typeArg = args.find((a) => a.startsWith("--type="))?.slice("--type=".length);
  const sort = (args.find((a) => a.startsWith("--sort="))?.slice("--sort=".length) ?? "dps-desc") as RosterSort;
  const type = typeArg === "speed" || typeArg === "damager" || typeArg === "mage" ? typeArg : "";
  const listed = queryRoster(player.heroes, { search, type, sort });
  console.log("\n-- Heroes --");
  listed.forEach((hero) => {
    const def = heroDef(hero.defId);
    const i = player.heroes.indexOf(hero);
    const star = hero.favorite ? "★" : "☆";
    console.log(
      `${i + 1}. ${star} ${def.name} (${def.archetype}, ${def.rarity})  DPS ${estimatedDps(hero).toFixed(1)}  ${formatStats(computeHeroStats(hero))}`,
    );
    for (const slot of WORN) {
      const item = hero.equipment[slot];
      if (item && !(slot === "offHand" && item === hero.equipment.mainHand)) {
        console.log(`    ${slot.padEnd(8)} ${formatItem(item)}`);
      }
    }
    hero.gems.forEach((gem, gi) => {
      console.log(`    gem ${gi + 1}    ${gem ? formatGem(gem) : "(empty)"}`);
    });
  });
  console.log(`Gold ${player.gold} | Energy ${player.energy} | Inventory ${player.inventory.length} | Gems ${player.gems.length}`);
}

function showInventory(player: PlayerState): void {
  console.log("\n-- Inventory --");
  if (player.inventory.length === 0) console.log("  (empty)");
  player.inventory.forEach((item, i) => console.log(`  ${i + 1}. ${formatItem(item)}  [${item.id}]`));
  console.log("\n-- Gem stash --");
  if (player.gems.length === 0) console.log("  (empty)");
  player.gems.forEach((gem, i) => console.log(`  ${i + 1}. ${formatGem(gem)}  [${gem.id}]`));
}

function help(): void {
  print([
    "",
    "3 Kingdom Chibi — headless MVP",
    "Combat, loot, equipment, and gems. No map/sprite/UI layer yet.",
    "",
    "Commands:",
    "  fight [seed]     run Hulao Pass (20 waves + boss)",
    "  roster [text] [--type=speed|damager|mage] [--sort=dps-desc|dps-asc|rarity|favorite]",
    "  inv              inventory and gem stash",
    "  equip <hero#> <item#> <slot>",
    "  socket <hero#> <gem#> <socket#>",
    "  merge items      merge 5 same-base/same-rarity items",
    "  merge gems       merge 3 identical gems",
    "  autogear         merge + equip + socket automatically",
    "  slots            list deployment slots",
    "  help",
    "  quit",
  ]);
}

async function interactive(): Promise<void> {
  const rl = readline.createInterface({ input, output });
  const player = createNewPlayer();
  const rng = new Rng(11);
  let fights = 0;
  help();
  showRoster(player);

  while (true) {
    const raw = (await rl.question("\n> ")).trim();
    if (!raw) continue;
    const [cmd, ...args] = raw.split(/\s+/);
    try {
      if (cmd === "quit" || cmd === "exit") break;
      if (cmd === "help") {
        help();
        continue;
      }
      if (cmd === "roster") {
        showRoster(player, args);
        continue;
      }
      if (cmd === "inv") {
        showInventory(player);
        continue;
      }
      if (cmd === "slots") {
        for (const s of MVP_MAP.slots) console.log(`  ${s.id}  (${s.x},${s.y})`);
        continue;
      }
      if (cmd === "fight") {
        fights += 1;
        const seed = args[0] ? Number(args[0]) : 100 + fights;
        const { result } = runBattle(player, seed);
        print(describeResult(player, result));
        continue;
      }
      if (cmd === "equip") {
        const hero = player.heroes[Number(args[0]) - 1];
        const item = player.inventory[Number(args[1]) - 1];
        const slot = args[2] as WornSlot;
        if (!hero || !item || !slot) {
          console.log("Usage: equip <hero#> <item#> <slot>");
          continue;
        }
        console.log(wear(player, hero.id, item.id, slot));
        continue;
      }
      if (cmd === "socket") {
        const hero = player.heroes[Number(args[0]) - 1];
        const gem = player.gems[Number(args[1]) - 1];
        const sock = Number(args[2]) - 1;
        if (!hero || !gem || Number.isNaN(sock)) {
          console.log("Usage: socket <hero#> <gem#> <socket#>");
          continue;
        }
        console.log(socket(player, hero.id, gem.id, sock));
        continue;
      }
      if (cmd === "merge" && args[0] === "items") {
        const groups = mergeGroups(player.inventory);
        if (groups.length === 0) {
          console.log(`Need ${EQUIPMENT_MERGE.inputCount} items of the same base and rarity.`);
          continue;
        }
        const group = groups[0]!.slice(0, EQUIPMENT_MERGE.inputCount);
        const out = mergeItems(
          player,
          group.map((i) => i.id),
          rng,
        );
        console.log(`Merged into ${formatItem(out)}`);
        continue;
      }
      if (cmd === "merge" && args[0] === "gems") {
        const groups = gemMergeGroups(player.gems);
        if (groups.length === 0) {
          console.log(`Need ${GEM_MERGE.inputCount} identical gems.`);
          continue;
        }
        const group = groups[0]!.slice(0, GEM_MERGE.inputCount);
        const out = mergePlayerGems(
          player,
          group.map((g) => g.id),
        );
        console.log(`Merged into ${formatGem(out)}`);
        continue;
      }
      if (cmd === "autogear") {
        const merged = autoMergeAll(player, rng);
        const equipped = autoEquipBest(player);
        const socketed = autoSocketGems(player);
        console.log(
          `Merged ${merged.items} items / ${merged.gems} gems. Equipped ${equipped}. Socketed ${socketed}.`,
        );
        showRoster(player);
        continue;
      }
      console.log("Unknown command. Type help.");
    } catch (err) {
      console.log(err instanceof Error ? err.message : String(err));
    }
  }

  rl.close();
}

function sim(): void {
  const player = createNewPlayer();
  const rng = new Rng(3);
  console.log("=== Run 1: starter gear ===");
  for (const h of player.heroes) {
    console.log(`${heroDef(h.defId).name}: ${formatStats(computeHeroStats(h))}`);
  }
  const first = runBattle(player, 42);
  print(first.summary);

  const gear = {
    merged: autoMergeAll(player, rng),
    equipped: autoEquipBest(player),
    socketed: autoSocketGems(player),
  };
  console.log(
    `\n=== Gear up: merged ${gear.merged.items} items / ${gear.merged.gems} gems, equipped ${gear.equipped}, socketed ${gear.socketed} ===`,
  );
  for (const h of player.heroes) {
    console.log(`${heroDef(h.defId).name}: ${formatStats(computeHeroStats(h))}`);
  }

  console.log("\n=== Run 2: after loot ===");
  const second = runBattle(player, 42);
  print(second.summary);

  const dps1 = Object.values(first.result.damageByHero).reduce((a, b) => a + b, 0) / first.result.time;
  const dps2 = Object.values(second.result.damageByHero).reduce((a, b) => a + b, 0) / second.result.time;
  console.log(`\nParty DPS  run1 ${dps1.toFixed(1)}  run2 ${dps2.toFixed(1)}`);
  console.log(`Deployed to ${deployAll(player).map((d) => d.slotId).join(", ")}`);
}

if (process.argv.includes("--sim")) {
  sim();
} else {
  await interactive();
}
