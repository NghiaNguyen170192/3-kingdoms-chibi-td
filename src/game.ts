import { defaultSlots, simulateBattle } from "./battle.js";
import { heroDef } from "./data.js";
import { playMap } from "./map/tiles.js";
import { autoEquipBest, autoMergeAll, autoSocketGems, collectLoot, createNewPlayer } from "./player.js";
import { Rng } from "./rng.js";
import { computeHeroStats, formatItem, formatStats } from "./stats.js";
import type { BattleDeployment, BattleResult, PlayerState } from "./types.js";

export interface RunReport {
  result: BattleResult;
  summary: string[];
}

export function deployAll(player: PlayerState): BattleDeployment[] {
  const map = playMap();
  const slots = defaultSlots(player.heroes.length, map);
  return player.heroes.map((hero, i) => ({
    hero,
    slotId: slots[i] ?? map.slots[i % map.slots.length]!.id,
  }));
}

export function runBattle(player: PlayerState, seed: number): RunReport {
  const result = simulateBattle(deployAll(player), { seed, map: playMap() });
  collectLoot(player, result.loot);
  return { result, summary: describeResult(player, result) };
}

export function describeResult(player: PlayerState, result: BattleResult): string[] {
  const lines: string[] = [];
  lines.push(
    result.victory
      ? "VICTORY — Hulao Pass held."
      : result.events.some((e) => e.type === "end" && e.reason === "bossReached")
        ? "DEFEAT — the boss reached the castle."
        : result.castleHp <= 0
          ? "DEFEAT — the castle fell."
          : "DEFEAT — the boss escaped.",
  );
  lines.push(
    `Time ${result.time.toFixed(1)}s | Castle ${result.castleHp}/${result.castleMaxHp} | Leaks ${result.leaks}`,
  );
  lines.push(
    `Kills  troop ${result.kills.troop}  scout ${result.kills.scout}  brute ${result.kills.brute}  elite ${result.kills.elite}  boss ${result.kills.boss}`,
  );
  lines.push(
    `Loot   gold +${result.loot.gold}  items ${result.loot.items.length}  gems ${result.loot.gems.length}`,
  );
  for (const item of result.loot.items) lines.push(`  item  ${formatItem(item)}`);
  for (const gem of result.loot.gems) lines.push(`  gem   ${gem.name} Lv.${gem.level}`);
  for (const hero of player.heroes) {
    const dmg = result.damageByHero[hero.id] ?? 0;
    lines.push(`  ${heroDef(hero.defId).name} dealt ${dmg.toFixed(0)}  (${formatStats(computeHeroStats(hero))})`);
  }
  return lines;
}

export function gearUp(player: PlayerState, rng: Rng): { equipped: number; socketed: number; merged: { items: number; gems: number } } {
  const merged = autoMergeAll(player, rng);
  const equipped = autoEquipBest(player);
  const socketed = autoSocketGems(player);
  return { equipped, socketed, merged };
}

export function bootstrapPlayer(): { player: PlayerState; rng: Rng } {
  return { player: createNewPlayer(), rng: new Rng(7) };
}
