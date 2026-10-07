import { RARITY_ORDER } from "../data.js";
import type { GemFamily, Rarity } from "../types.js";

const sheetUrls = import.meta.glob("../../assets/sprites/64x64.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** Vite URL for the 16×137 inventory sheet. Each cell is 64×64. */
export const ITEM_SHEET_URL = Object.values(sheetUrls)[0] ?? "";

const COLS = 16;
const ROWS = 137;

export interface SheetCell {
  col: number;
  row: number;
}

function cells(pairs: readonly number[]): SheetCell[] {
  const out: SheetCell[] = [];
  for (let i = 0; i < pairs.length; i += 2) out.push({ col: pairs[i]!, row: pairs[i + 1]! });
  return out;
}

/**
 * Six cells, index = rarity order (normal → mythic).
 * Weapon families use the sheet's grey, blue, then gold recolors of the same shape.
 * Armor and jewelry use a plain icon, then stronger colors of that slot.
 */
const ITEM_CELLS: Record<string, SheetCell[]> = {
  dagger: cells([2, 90, 2, 100, 3, 100, 2, 111, 2, 95, 3, 95]),
  blade: cells([6, 90, 6, 100, 2, 108, 9, 108, 6, 104, 6, 95]),
  polearm: cells([9, 91, 9, 101, 8, 101, 10, 101, 9, 96, 10, 96]),
  staff: cells([9, 105, 15, 105, 14, 110, 15, 110, 15, 106, 15, 107]),
  helmet: cells([0, 119, 2, 119, 7, 119, 4, 119, 6, 119, 12, 119]),
  body: cells([4, 130, 2, 130, 8, 130, 3, 130, 12, 130, 13, 130]),
  gloves: cells([10, 127, 13, 127, 11, 127, 9, 127, 8, 127, 12, 127]),
  // The armor rows only draw two sashes, so higher rarities reuse them.
  belt: cells([3, 129, 4, 129, 3, 129, 4, 129, 3, 129, 4, 129]),
  boots: cells([5, 135, 0, 135, 1, 135, 4, 135, 6, 135, 9, 135]),
  ring: cells([2, 115, 9, 136, 4, 115, 10, 136, 11, 136, 12, 136]),
  amulet: cells([11, 115, 9, 115, 10, 115, 7, 115, 3, 136, 6, 136]),
};

/** Five cells, index = gem level 1–5. Color follows the gem family. */
const GEM_CELLS: Record<GemFamily, SheetCell[]> = {
  attackSpeed: cells([3, 133, 14, 133, 13, 133, 15, 133, 7, 132]),
  castSpeed: cells([8, 132, 4, 133, 10, 133, 12, 132, 4, 133]),
  critRate: cells([2, 132, 3, 132, 5, 133, 9, 132, 5, 133]),
  critMulti: cells([5, 132, 0, 133, 7, 133, 8, 133, 0, 132]),
  moreDamage: cells([4, 132, 1, 133, 11, 133, 12, 133, 1, 132]),
  fire: cells([0, 132, 1, 133, 11, 133, 12, 133, 0, 133]),
  cold: cells([6, 132, 2, 133, 9, 133, 11, 132, 2, 133]),
  lightning: cells([5, 132, 7, 133, 8, 133, 14, 132, 0, 133]),
  toxic: cells([7, 132, 6, 133, 3, 133, 13, 133, 15, 133]),
  bleed: cells([10, 132, 11, 133, 12, 133, 1, 132, 1, 133]),
};

export function itemCell(baseId: string, rarity: Rarity): SheetCell {
  const row = ITEM_CELLS[baseId] ?? ITEM_CELLS.blade!;
  return row[RARITY_ORDER.indexOf(rarity)] ?? row[0]!;
}

export function gemCell(family: GemFamily, level: number): SheetCell {
  const row = GEM_CELLS[family];
  const index = Math.min(Math.max(level, 1), row.length) - 1;
  return row[index]!;
}

export function iconHtml(cell: SheetCell, size: number): string {
  const sheetW = COLS * size;
  const sheetH = ROWS * size;
  const style = [
    `width:${size}px`,
    `height:${size}px`,
    `background-image:url('${ITEM_SHEET_URL}')`,
    `background-size:${sheetW}px ${sheetH}px`,
    `background-position:${-cell.col * size}px ${-cell.row * size}px`,
  ].join(";");
  return `<i class="sprite-icon" style="${style}"></i>`;
}
