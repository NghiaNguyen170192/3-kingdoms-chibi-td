/** Seeded mulberry32 — loot and combat stay deterministic in tests. */
export class Rng {
  private state: number;

  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  float(min = 0, max = 1): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)]!;
  }

  pickN<T>(items: readonly T[], n: number): T[] {
    const copy = [...items];
    const out: T[] = [];
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = this.int(0, copy.length - 1);
      out.push(copy.splice(idx, 1)[0]!);
    }
    return out;
  }
}

let seq = 0;

export function createId(prefix: string): string {
  seq += 1;
  const salt = Math.floor(Math.random() * 0xffffffff).toString(36);
  return `${prefix}-${seq.toString(36)}-${salt}`;
}

export function resetIds(): void {
  seq = 0;
}
