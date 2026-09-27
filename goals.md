# 3 Kingdom Chibi

## 1. Project Overview

**Game Title:** 3 Kingdom Chibi  
**Genre:** 2D Hero-Collection Tower Defense RPG  
**Platforms:** Web, PC  
**Engine:** Phaser.js  
**Target Audience:** 15+  
**Visual Style:** Chibi fantasy inspired by the Three Kingdoms era

### Core Concept / Elevator Pitch

3 Kingdom Chibi is a 2D tower-defense RPG focused on hero collection,
deep itemization, loot hunting, and character build customization.

Players act as commanders defending castles and strategic locations against
increasingly difficult waves of enemies.

Each map contains one to three enemy routes leading toward one or more
objectives. Players deploy collectible Three Kingdoms-inspired heroes along
these routes and use their different attack patterns and abilities to prevent
enemies from reaching the destination.

Heroes provide the base combat archetype, while equipment and gems allow
players to substantially customize how each hero performs.

Defeating enemies and bosses rewards equipment, gems, hero fragments,
upgrade materials, and rare items.

The core progression loop is:

Defend
→ Defeat Boss
→ Collect Loot
→ Evaluate Items
→ Equip / Merge / Customize
→ Strengthen Heroes
→ Push Harder Maps
→ Find Better Loot

The intended experience combines the hero collection and tower-defense
gameplay of Tam Quốc Mini with deep ARPG-style itemization.

---

# 2. Map Structure

Each map contains:

- 1–3 enemy starting routes
- 1–2 destinations
- Hero deployment positions
- Multiple waves
- Elite enemies
- Final boss wave

Enemies follow predefined routes toward the destination.

Enemies reaching the destination damage the player's castle.

The stage ends when:

- All waves and bosses are defeated, OR
- Castle HP reaches zero.

---

# 3. Enemy Types

## Troop

Standard enemy.

- Normal HP
- Normal movement speed
- Little or no special resistance

## Scout

Fast enemy.

- Low HP
- High movement speed
- Punishes insufficient coverage

## Brute

Heavy enemy.

- High HP
- Slow movement
- High physical resistance

## Elite

Enhanced enemies with one or more modifiers.

Examples:

- Armoured
- Fast
- Regenerating
- Fire Resistant
- Cold Resistant
- Lightning Resistant
- Toxic Resistant
- Critical Resistant

## Boss

Appears during major/final waves.

Bosses have:

- Very high HP
- Unique abilities
- Special resistances
- Multiple phases where appropriate
- Improved loot tables

Bosses are the primary source of valuable loot.

---

# 4. Hero System

Heroes are collectible characters inspired by Three Kingdoms characters.

Examples:

- Guan Yu
- Zhao Yun
- Lü Bu
- Zhuge Liang
- Cao Cao
- Diao Chan

Each hero defines a base combat archetype.

Equipment and gems determine the player's actual build.

---

# 5. Hero Archetypes

## Speed

Characteristics:

- Low base damage
- Very high attack speed
- Short attack range
- High critical chance
- High critical multiplier

Possible builds:

Fast Critical
Fast Bleed
Fast Toxic
Lightning Proc
On-Hit

---

## Damager

Characteristics:

- High physical damage
- Medium attack range
- Slow attack speed
- Cleave
- Can strike multiple nearby enemies

Possible builds:

Heavy Critical
Bleed
Fire
Large Cleave
Boss Killer

---

## Mage

Characteristics:

- Spell caster
- Large attack range
- AoE
- Naturally capable of hitting multiple enemies
- Usually relies on cast speed rather than attack speed

Possible abilities:

- Tornado
- Chain Lightning
- Toxic Puddle
- Cascading Ice
- Meteor
- Fire Wall

Possible builds:

Fast Caster
Critical Spell
Cold Control
Lightning Chain
Fire AoE
Toxic DoT

---

# 6. Equipment System

Equipment should be one of the game's primary progression systems.

Heroes can equip:

- Helmet
- Body Armour
- Gloves
- Belt
- Boots
- Ring ×2
- Amulet

Weapon configuration:

### Dual Wield

- Main Hand
- Off Hand

OR

### Two-Handed

- One two-handed weapon occupying both weapon slots

Equipment should meaningfully affect hero builds rather than simply
increasing character level.

---

# 7. Item Rarity

Items can have the following rarity:

Normal
→ Magic
→ Rare
→ Unique
→ Legendary
→ Mythic

Higher rarity generally allows additional modifiers.

Initial concept:

| Rarity | Additional Modifiers |
|---|---:|
| Normal | 0 |
| Magic | 1 |
| Rare | 2 |
| Unique | 3 |
| Legendary | 4 |
| Mythic | 5 |

Exact modifier counts should remain configurable during development.

---

# 8. Equipment Modifiers

Equipment modifiers will be selected from modifier pools.

Examples:

### Offensive

- +Flat Damage
- +% Damage
- +Attack Speed
- +Cast Speed
- +Critical Chance
- +Critical Multiplier
- +Area of Effect
- +Attack Range
- +Skill Damage
- +Boss Damage

### Defensive

- +Maximum HP
- +Armour
- +Damage Reduction
- +Regeneration
- +Elemental Resistance

### Utility

- +Energy Generation
- +Skill Cooldown Recovery
- +Item Find
- +Gold Find

The complete modifier pool will be designed and balanced later.

---

# 9. Equipment Merging

Equipment can be merged into higher-rarity equipment.

Initial rule:

5 items
→
1 item of the next rarity

Example:

5 Normal Swords
→
1 Magic Sword

5 Magic Swords
→
1 Rare Sword

The exact merge requirements must remain data-driven so they can be changed
during balancing.

---

# 10. Gem System

Gems are primarily OFFENSIVE BUILD MODIFIERS.

Their purpose is not simply to provide additional character stats.

Gems modify:

- How frequently a hero attacks
- How frequently a hero casts
- How hard attacks hit
- How critical strikes behave
- What additional damage effects attacks can inflict

This allows two copies of the same hero to behave differently depending on
their gem configuration.

---

# 11. Base Gem Types

Initial MVP gem types:

## Attack Speed Gem

Increases attack speed.

Example:

+10% Attack Speed

---

## Cast Speed Gem

Increases spell casting speed.

Example:

+10% Cast Speed

---

## Critical Rate Gem

Increases critical strike chance.

Example:

+5% Critical Chance

---

## Critical Multiplier Gem

Increases critical strike damage.

Example:

+20% Critical Multiplier

---

## More Damage Gem

Multiplicatively increases damage.

Example:

10% More Damage

This should remain distinct from normal additive increased damage.

---

# 12. Imbued Gems

Imbued gems add additional damage types or effects to attacks.

Initial effects:

## Lightning

Possible effects:

- Added Lightning Damage
- Chain
- Shock
- Additional Targets

## Cold

Possible effects:

- Added Cold Damage
- Slow
- Chill
- Freeze

## Fire

Possible effects:

- Added Fire Damage
- Ignite
- Burn
- Explosion

## Toxic

Possible effects:

- Poison
- Damage Over Time
- Toxic Puddle
- Poison Spread

## Bleed

Possible effects:

- Bleeding Damage
- Increased damage against moving enemies
- Bleed stacking
- Bleed explosion

Additional effects can be introduced later without changing the fundamental
gem system.

---

# 13. Gem Progression

Gems can be upgraded by merging identical gems.

Example:

3 × Attack Speed Gem Lv.1
→
Attack Speed Gem Lv.2

3 × Attack Speed Gem Lv.2
→
Attack Speed Gem Lv.3

Higher-level gems provide:

1. A stronger primary modifier
2. Additional modifiers at defined milestones

Example:

### Attack Speed Gem Lv.1

+5% Attack Speed

### Attack Speed Gem Lv.2

+8% Attack Speed

### Attack Speed Gem Lv.3

+12% Attack Speed
+3% Critical Chance

### Attack Speed Gem Lv.4

+16% Attack Speed
+5% Critical Chance
+10% Critical Multiplier

Exact values and additional modifier pools will be determined later.

---

# 14. Gem Modifier System

Each gem always retains its identity through its PRIMARY modifier.

Example:

Attack Speed Gem

Primary:
+Attack Speed

Cold Gem

Primary:
Adds Cold Effect

Critical Gem

Primary:
+Critical Chance

Higher gem levels can roll or acquire secondary modifiers.

Therefore:

Attack Speed Gem Lv.5

might become:

+22% Attack Speed
+8% Critical Chance
+15% Critical Multiplier
+10% More Damage

while another Attack Speed Gem Lv.5 could become:

+22% Attack Speed
+12% Cast Speed
+Lightning Damage
+Chance to Shock

This creates valuable loot variation without requiring hundreds of different
gem types.

---

# 15. Build Customization

The combination of:

Hero
+
Weapon
+
Equipment
+
Equipment Modifiers
+
Gems

defines the final build.

For example:

## Zhao Yun — Critical Speed Build

Speed Hero

Dual Wield

Attack Speed Gems
Critical Rate Gems
Critical Multiplier Gems
Bleed Gem

Result:

Extremely fast attacks producing frequent critical strikes and rapidly
stacking Bleed.

---

## Guan Yu — Heavy Fire Cleave

Damager Hero

Two-Handed Weapon

More Damage Gem
Critical Multiplier Gem
Fire Imbued Gem

Result:

Slow attacks with enormous cleave damage that Ignite groups of enemies.

---

## Zhuge Liang — Lightning Caster

Mage

Staff

Cast Speed Gems
Lightning Imbued Gem
Critical Rate Gem

Result:

Rapid Chain Lightning casts capable of jumping through large enemy groups.

---

# 16. Loot System

Enemies can drop:

- Equipment
- Gems
- Gold
- Hero fragments
- Item fragments
- Upgrade materials
- Energy / stamina items

Bosses have significantly improved drop tables.

Rare drops should be one of the primary reasons to replay maps.

---

# 17. Core Gameplay Loop

Select Map
↓
Select Heroes
↓
Deploy Heroes
↓
Defend Waves
↓
Defeat Boss
↓
Loot Drops
↓
Inspect Equipment
↓
Compare Modifiers
↓
Equip / Merge / Socket Gems
↓
Experiment With Builds
↓
Challenge Harder Map

---

# 18. MVP / Vertical Slice

The MVP should prove three things:

1. Tower defense combat is fun.
2. Loot changes how heroes perform.
3. Finding and upgrading items makes players want another run.

## MVP Content

### Map

- 1 map
- 2 routes
- 1 destination
- 10 waves
- 1 boss

### Heroes

3–6 heroes.

At minimum:

- Speed Hero
- Damager
- Mage

### Enemies

- Troop
- Scout
- Brute
- Elite
- Boss

### Equipment

Implement:

- Weapon
- Helmet
- Body Armour
- Gloves
- Belt
- Boots
- Ring
- Amulet

Support dual-wield and two-handed weapons.

### Gems

MVP gem types:

- Attack Speed
- Cast Speed
- Critical Rate
- Critical Multiplier
- More Damage
- Fire
- Cold
- Lightning
- Toxic
- Bleed

### Systems

Implement:

- Hero placement
- Enemy pathing
- Target selection
- Attack range
- Attack speed
- Cast speed
- Critical hits
- Cleave
- AoE
- Damage-over-time
- Status effects
- Boss combat
- Loot generation
- Equipment
- Item modifiers
- Gem socketing
- Equipment merging
- Gem merging

---

# 19. Out of Scope for MVP

- Multiplayer
- PvP
- Guilds
- Trading
- Leaderboards
- Gacha
- Account system
- Hundreds of heroes
- Daily quests
- Events
- Monetization
- Complex crafting
- Full modifier pool
- Endgame systems

---

# 20. Design Principle

Heroes define the starting point.

Items define the build.

Gems modify how damage behaves.

Loot gives the player a reason to play again.

The desired player thought is:

"That weapon could completely change my Guan Yu build."

or:

"If I get one more Attack Speed gem, I can merge it and try a
Bleed/Crit Zhao Yun build."

The objective is not simply to make numbers larger.

The objective is to make loot create new build possibilities.