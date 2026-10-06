---
name: 3-kingdom-chibi
description: Work on the 3 Kingdom Chibi Phaser tower-defense project — tile map, hero placement, battle, loot, equipment, gems, and Mana Seed sprites. Use when the user invokes the 3-kingdom-chibi skill or asks to follow this project's game-loop conventions.
disable-model-invocation: true
---

# 3 Kingdom Chibi

Design intent lives in `goals.md`. Heroes are the archetype. Items and gems are the build. Loot is why the player runs the map again.

## Layout

| Area | Files |
|---|---|
| Content | `src/data.ts` — heroes, enemies, map, waves, item and gem tables |
| Rules | `src/combat.ts`, `src/battle.ts`, `src/stats.ts`, `src/loot.ts`, `src/items.ts`, `src/gems.ts`, `src/player.ts` |
| Headless run | `src/game.ts`, `npm run sim` |
| Map | `src/map/tiles.ts` — 40px cells from the Gentle Forest sheet, 10 world units per tile, placeable band is 3 tiles off the road |
| Play screen | `src/game/PlayScene.ts`, `src/game/main.ts` — Phaser 3.90 |
| Sprites | `src/game/manaSeed.ts`, `manaSeedLoad.ts`, `heroActor.ts`, `enemyActor.ts` |
| DOM panels | `src/game/rosterPanel.ts`, `src/game/heroSheet.ts` |

Keep combat numbers in `data.ts` and the rule modules. The scene only places actors, plays animations, and shows loot. A new hero, enemy, wave, or modifier is data first. Add a sprite look only when the actor needs a new sheet.

## Phaser

The engine is Phaser **3.90**. Do not migrate to Phaser 4 unless asked. Load sheets in `preload`, build objects in `create`, and reset run state in `init` because `scene.restart()` reuses the scene instance.

Do not add Arcade Physics. `BattleRuntime` owns positions, range, and attacks. The scene copies those positions onto sprites.

## Battle flow

One map, two routes, one castle, 20 waves. The dirt road is one tile wide, painted from each route's waypoints. Tiles beside it, including placeable ones, stay grass. NPCs do not search the grid. They walk that waypoint list from the first point to the last, so a different map runs from start to destination when its routes say so. The player picks heroes from the roster and places them on green-border tiles. The attack-range box is hidden once a hero is placed. Fight runs waves. Each wave spends 1 energy. A new account has 100, and that is the cap. Between waves the battle pauses so the player can move heroes, change gear, or double-click a hero to take them off the map. Castle HP at 0, or the boss reaching the castle, ends the run. Clearing wave 20 opens the spoils inventory: merge 5 matching items, 3 identical gems, or 3 copies of the same hero below mythic. A clear has a 5% chance to drop an energy battery of 1, 2, or 5. Items, gems, and fragments also drop at 5%.

Gem sockets belong to the hero. Count follows rarity: normal 1, magic 2, rare 3, unique 4, legendary 5, mythic 6. The testing roster starts every hero at mythic with the five imbued gems socketed.

`BattleRuntime` emits events. The scene reacts to `attack` (hero slash) and `hit` (floating damage, plus the imbued-gem burst). Do not drive attacks from the scene clock.

## Sprites

Everyone uses the Mana Seed demo in `assets/characters/`. One human body. Do not add a new model per character. The kept pages are `p1` (stand, walk, run), `pONE2` (combat idle), and `pONE3` (slash). Draw, parry, hurt, hats, and shields are not in the tree.

Sheets are 512×512, frames are 64×64. Feet are on row 44 of the cell. Logical facing is `0` down, `1` left, `2` right, `3` up.

Row order is not the same on every page. Use the helpers in `manaSeed.ts`. Do not pass a facing number straight in as a row.

| Page | Use | Rows |
|---|---|---|
| `p1` | Unarmed stand; walk and run | Stand is rows 0–3. Walk and run are rows 4–7. Both are down, up, right, left. `sheetRow`, `walkRow` |
| `pONE2` | Combat idle | Rows are down, up, right, left. `sheetRow` |
| `pONE3` | Slash | Same row order as combat idle |

Paper-doll layers, bottom to top: `0bas` body, `1out` outfit, `4har` hair, `6tla` weapon. Weapon depth flips per frame (`weaponInFront`). There is no staff in this demo. Speed uses a sword, damagers an axe, mages a mace.

One socketed imbued gem recolors the weapon: lightning uses the gold sheet, cold the blue sheet, and fire, toxic, and bleed tint the silver sheet because those blade colors are not in the pack. Two or more imbued gems use the brightest weapon sheet, silver `v01`, with no tint.

Heroes idle and stand facing down. On `attack`, face the enemy, play slash, then return to down. Do not face the nearest road tile.

Enemies walk or run along their movement. Scouts run and are smaller. Brutes and the boss are larger. Tint is what separates troop, scout, brute, elite, and boss (`ENEMY_LOOKS`). New sheets go through `requiredSheets` so `manaSeedLoad.ts` queues them.

Imbued gem hits play a burst from `assets/effects/` (`imbuedEffect.ts`). Cold, toxic, fire, and bleed use the blue, green, and red rows. Lightning tints the white row yellow. Fire is a flame burst and bleed is a blood spurt, both on the red row. A normal hit and a damage-over-time tick play at half size. A critical hit keeps the full size.

## Checks

```bash
npm test
npm run typecheck
```

`npm run dev` serves the map at `http://localhost:5173/`. `?demo` places Zhao Yun, Guan Yu, and Zhuge Liang and starts the fight. After a sprite or layout change, play that path in the browser and confirm facing, not only that the canvas drew.
