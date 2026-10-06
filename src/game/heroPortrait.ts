import { characterSheetUrl } from "./manaSeedLoad.js";
import { FRAME, animFrames, weaponInFront, type HeroLook, type Layer, type Page } from "./manaSeed.js";

const images = new Map<string, Promise<HTMLImageElement>>();
const scratch = document.createElement("canvas");
scratch.width = FRAME;
scratch.height = FRAME;

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = images.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(url));
    image.src = url;
  });
  images.set(url, pending);
  return pending;
}

/** Combat idle, facing down, on a canvas. Returns a stop function for the next render. */
export function mountHeroPortrait(canvas: HTMLCanvasElement, look: HeroLook): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  ctx.imageSmoothingEnabled = false;
  let alive = true;
  let raf = 0;
  const frames = animFrames("idle", 0);
  const tint = look.weaponTint ?? 0xffffff;
  const layers: Array<{ page: Page; layer: Layer; code: string; image: HTMLImageElement }> = [];

  const draw = (now: number) => {
    if (!alive) return;
    step(now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cell = frames[frame]!;
    const sx = cell.col * FRAME;
    const sy = cell.row * FRAME;
    const scale = 2;
    const dw = FRAME * scale;
    const dh = FRAME * scale;
    const dx = Math.round((canvas.width - dw) / 2);
    const dy = 8;
    const weapon = layers.find((layer) => layer.layer === "6tla");
    const front = weaponInFront("pONE2", cell.col, cell.row);
    const order = front
      ? layers.filter((layer) => layer.layer !== "6tla").concat(weapon ? [weapon] : [])
      : weapon
        ? [weapon, ...layers.filter((layer) => layer.layer !== "6tla")]
        : layers;
    for (const layer of order) {
      if (layer.layer === "6tla" && tint !== 0xffffff) {
        drawTinted(ctx, layer.image, sx, sy, dx, dy, dw, dh, tint);
      } else {
        ctx.drawImage(layer.image, sx, sy, FRAME, FRAME, dx, dy, dw, dh);
      }
    }
    raf = requestAnimationFrame(draw);
  };

  let frame = 0;
  let elapsed = 0;
  let last = 0;
  const step = (now: number) => {
    if (!last) last = now;
    elapsed += now - last;
    last = now;
    const current = frames[frame]!;
    if (elapsed < current.ms) return;
    elapsed -= current.ms;
    frame = (frame + 1) % frames.length;
  };

  const specs: Array<{ page: Page; layer: Layer; code: string }> = [
    { page: "pONE2", layer: "0bas", code: look.body },
    { page: "pONE2", layer: "1out", code: look.outfit },
    { page: "pONE2", layer: "4har", code: look.hair },
    { page: "pONE2", layer: "6tla", code: look.weapon },
  ];
  void Promise.all(
    specs.map(async (spec) => ({
      ...spec,
      image: await loadImage(characterSheetUrl(spec.page, spec.layer, spec.code)),
    })),
  ).then((loaded) => {
    if (!alive) return;
    layers.push(...loaded);
    raf = requestAnimationFrame(draw);
  });

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
  };
}

function drawTinted(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  sx: number,
  sy: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  tint: number,
): void {
  const tintCtx = scratch.getContext("2d");
  if (!tintCtx) return;
  tintCtx.clearRect(0, 0, FRAME, FRAME);
  tintCtx.globalCompositeOperation = "source-over";
  tintCtx.drawImage(image, sx, sy, FRAME, FRAME, 0, 0, FRAME, FRAME);
  tintCtx.globalCompositeOperation = "multiply";
  tintCtx.fillStyle = `#${tint.toString(16).padStart(6, "0")}`;
  tintCtx.fillRect(0, 0, FRAME, FRAME);
  tintCtx.globalCompositeOperation = "destination-in";
  tintCtx.drawImage(image, sx, sy, FRAME, FRAME, 0, 0, FRAME, FRAME);
  tintCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(scratch, 0, 0, FRAME, FRAME, dx, dy, dw, dh);
}
