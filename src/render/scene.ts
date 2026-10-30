import {
  catalog,
  gridFor,
  type Area,
  type BotView,
  type EffectiveStatus,
  type OfficeView,
  type TimeOfDay,
} from "../../shared/office";
import { drawBot } from "./actors";
import {
  bbox,
  drawBox,
  project,
  shade,
  strokePoly,
  tilePoints,
  withClip,
  poly,
  type BoxColors,
  type Pt,
} from "./iso";

export type Hit = { id: string; x: number; y: number; w: number; h: number };
export type Anchor = { id: string; x: number; y: number };
export type Label = { id: string; text: string; x: number; y: number };

export type Frame = {
  hits: Hit[];
  anchors: Anchor[];
  labels: Label[];
};

type Item = { key: number; draw: (ctx: CanvasRenderingContext2D) => void };
type Light = { x: number; y: number; r: number; color: string };
type BufBox = { id: string; x: number; y: number; w: number; h: number };
type BufPoint = { id: string; text?: string; x: number; y: number };

type Palette = {
  wood: BoxColors;
  chiefWood: BoxColors;
  wall: BoxColors;
  chiefWall: BoxColors;
  floor: [string, string, string];
  chiefFloor: [string, string];
  grass: [string, string];
  rug: [string, string];
  chiefRug: string;
  sky: string;
  frame: string;
  lampOn: boolean;
  screenGlow: string;
  lampGlow: string;
  monitor: BoxColors;
};

const buffer = document.createElement("canvas");
const bufferCtx = buffer.getContext("2d");

export function paint(
  canvas: HTMLCanvasElement,
  view: OfficeView,
  light: TimeOfDay,
  time: number,
  selected: string | null,
  portrait: boolean,
  reduced: boolean,
): Frame {
  const dest = canvas.getContext("2d");
  if (!dest || !bufferCtx) return { hits: [], anchors: [], labels: [] };

  const palette = makePalette(light);
  const areas = catalog.areas.map((area) => ({ area, grid: gridFor(area, portrait) }));
  const layout = layoutAreas(areas, portrait);
  const { bw, bh } = layout;
  if (buffer.width !== bw || buffer.height !== bh) {
    buffer.width = bw;
    buffer.height = bh;
  }

  const ctx = bufferCtx;
  ctx.clearRect(0, 0, bw, bh);
  ctx.fillStyle = "#12141f";
  ctx.fillRect(0, 0, bw, bh);
  drawStars(ctx, bw, bh, light);

  const lights: Light[] = [];
  const hitBuf: BufBox[] = [];
  const anchorBuf: BufPoint[] = [];
  const labelBuf: BufPoint[] = [];
  const byId = new Map(view.bots.map((bot) => [bot.id, bot]));
  const chunks = layout.placed.map((placed) =>
    buildArea(placed, palette, byId, lights, hitBuf, anchorBuf, labelBuf, time, reduced, selected, light),
  );

  if (portrait) {
    for (const chunk of chunks) {
      chunk.floors.sort((a, b) => a.key - b.key);
      chunk.items.sort((a, b) => a.key - b.key);
      for (const floor of chunk.floors) floor.draw(ctx);
      for (const item of chunk.items) item.draw(ctx);
    }
  } else {
    const floors = chunks.flatMap((chunk) => chunk.floors).sort((a, b) => a.key - b.key);
    const items = chunks.flatMap((chunk) => chunk.items).sort((a, b) => a.key - b.key);
    for (const floor of floors) floor.draw(ctx);
    for (const item of items) item.draw(ctx);
  }
  paintLights(ctx, lights);

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = Math.max(1, canvas.clientWidth);
  const cssH = Math.max(1, canvas.clientHeight);
  const destW = Math.max(1, Math.floor(cssW * dpr));
  const destH = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== destW || canvas.height !== destH) {
    canvas.width = destW;
    canvas.height = destH;
  }
  const fit = Math.min(destW / bw, destH / bh);
  const scale = fit >= 2 ? Math.floor(fit) : fit;
  const dw = bw * scale;
  const dh = bh * scale;
  const dx = Math.floor((destW - dw) / 2);
  const dy = Math.floor((destH - dh) / 2);
  dest.imageSmoothingEnabled = false;
  dest.fillStyle = "#12141f";
  dest.fillRect(0, 0, destW, destH);
  dest.drawImage(buffer, dx, dy, dw, dh);

  const toCss = (x: number, y: number) => ({ x: (dx + x * scale) / dpr, y: (dy + y * scale) / dpr });
  return {
    hits: hitBuf.map((hit) => {
      const pos = toCss(hit.x, hit.y);
      const size = toCss(hit.x + hit.w, hit.y + hit.h);
      return { id: hit.id, x: pos.x, y: pos.y, w: size.x - pos.x, h: size.y - pos.y };
    }),
    anchors: anchorBuf.map((anchor) => ({ id: anchor.id, ...toCss(anchor.x, anchor.y) })),
    labels: labelBuf.map((label) => ({ id: label.id, text: label.text ?? "", ...toCss(label.x, label.y) })),
  };
}

type Placed = { area: Area; grid: { x: number; y: number; w: number; d: number }; ox: number; oy: number };

function layoutAreas(
  areas: Array<{ area: Area; grid: { x: number; y: number; w: number; d: number } }>,
  portrait: boolean,
): { placed: Placed[]; bw: number; bh: number } {
  const pad = 18;
  if (!portrait) {
    const bounds = measure(areas.map((entry) => ({ ...entry.grid, lift: entry.area.kind === "home" ? 24 : 64 })));
    const ox = pad - bounds.minX;
    const oy = pad - bounds.minY;
    return {
      placed: areas.map((entry) => ({ ...entry, ox, oy })),
      bw: Math.ceil(bounds.maxX - bounds.minX + pad * 2),
      bh: Math.ceil(bounds.maxY - bounds.minY + pad * 2),
    };
  }
  const measured = areas.map((entry) => ({
    entry,
    bounds: measure([{ ...entry.grid, lift: entry.area.kind === "home" ? 24 : 64 }]),
  }));
  const maxW = Math.max(...measured.map((item) => item.bounds.maxX - item.bounds.minX));
  const placed: Placed[] = [];
  let cursor = pad;
  for (const item of measured) {
    const width = item.bounds.maxX - item.bounds.minX;
    const height = item.bounds.maxY - item.bounds.minY;
    placed.push({
      ...item.entry,
      ox: pad + (maxW - width) / 2 - item.bounds.minX,
      oy: cursor - item.bounds.minY,
    });
    cursor += height + 28;
  }
  return { placed, bw: Math.ceil(maxW + pad * 2), bh: Math.ceil(cursor + pad) };
}

function buildArea(
  placed: Placed,
  palette: Palette,
  byId: Map<string, BotView>,
  lights: Light[],
  hits: BufBox[],
  anchors: BufPoint[],
  labels: BufPoint[],
  time: number,
  reduced: boolean,
  selected: string | null,
  light: TimeOfDay,
): { floors: Item[]; items: Item[] } {
  const { area, grid, ox, oy } = placed;
  const floors: Item[] = [];
  const items: Item[] = [];
  const colors = area.kind === "home" ? palette.grass : area.kind === "office" ? palette.chiefFloor : palette.floor;
  for (let tx = 0; tx < grid.w; tx++) {
    for (let ty = 0; ty < grid.d; ty++) {
      const color = colors[(tx + ty) % colors.length];
      floors.push({
        key: grid.x + tx + grid.y + ty,
        draw: (context) => {
          poly(context, tilePoints(grid.x + tx, grid.y + ty, 0, ox, oy + 5), "rgba(0,0,0,0.28)");
          poly(context, tilePoints(grid.x + tx, grid.y + ty, 0, ox, oy), color);
        },
      });
    }
  }
  const labelX = area.kind === "home" ? grid.x + grid.w * 0.5 : grid.x + grid.w / 2;
  const labelZ = area.kind === "home" ? 20 : 62;
  const [labelSx, labelSy] = project(labelX, grid.y, labelZ);
  labels.push({ id: area.id, text: area.name, x: labelSx + ox, y: labelSy + oy });
  if (area.kind === "home") enqueueHouses(items, hits, anchors, lights, area, grid, byId, palette, ox, oy, time, reduced, selected);
  else enqueueRoom(items, lights, hits, anchors, area, grid, byId, palette, ox, oy, time, reduced, selected, light);
  return { floors, items };
}

function measure(grids: Array<{ x: number; y: number; w: number; d: number; lift?: number }>): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const take = (x: number, y: number, z = 0) => {
    const [sx, sy] = project(x, y, z);
    minX = Math.min(minX, sx);
    minY = Math.min(minY, sy);
    maxX = Math.max(maxX, sx);
    maxY = Math.max(maxY, sy);
  };
  for (const grid of grids) {
    const lift = grid.lift ?? 64;
    take(grid.x - 0.4, grid.y - 0.4, lift);
    take(grid.x + grid.w + 0.4, grid.y - 0.4, lift);
    take(grid.x - 0.4, grid.y + grid.d + 0.6, 0);
    take(grid.x + grid.w + 0.4, grid.y + grid.d + 0.6, 0);
    take(grid.x + grid.w / 2, grid.y + grid.d / 2, 36);
  }
  return { minX, minY, maxX, maxY };
}

function enqueueRoom(
  items: Item[],
  lights: Light[],
  hits: BufBox[],
  anchors: BufPoint[],
  area: Area,
  grid: { x: number; y: number; w: number; d: number },
  byId: Map<string, BotView>,
  palette: Palette,
  ox: number,
  oy: number,
  time: number,
  reduced: boolean,
  selected: string | null,
  light: TimeOfDay,
): void {
  const interior = area.kind === "office" ? palette.chiefWall.y : palette.wall.y;
  const edge = shade(interior, -28);
  const trim = shade(interior, 36);
  for (let tx = 0; tx < grid.w; tx++) {
    const x = grid.x + tx;
    const y = grid.y - 0.26;
    const windowed = area.windows?.includes(tx) ?? false;
    items.push({
      key: x + grid.y - 0.8,
      draw: (ctx) => {
        const faces = drawBox(ctx, x, y, 0, 1, 0.26, 46, { top: trim, x: edge, y: interior }, ox, oy);
        if (windowed) drawWindow(ctx, faces.faceY, palette, light);
      },
    });
  }
  for (let ty = 0; ty < grid.d; ty++) {
    items.push({
      key: grid.x + grid.y + ty + 0.2,
      draw: (ctx) => {
        drawBox(ctx, grid.x - 0.26, grid.y + ty, 0, 0.26, 1, 46, { top: trim, x: interior, y: edge }, ox, oy);
      },
    });
  }

  const rug = area.kind === "office" ? [palette.chiefRug, shade(palette.chiefRug, -18)] : palette.rug;
  const rugRect = area.kind === "office" ? { x: 1, y: 1, w: 4, h: 4 } : { x: 3, y: 1, w: 5, h: 5 };
  for (let tx = 0; tx < rugRect.w; tx++) {
    for (let ty = 0; ty < rugRect.h; ty++) {
      const x = grid.x + rugRect.x + tx;
      const y = grid.y + rugRect.y + ty;
      const color = rug[(tx + ty) % rug.length];
      items.push({
        key: x + y + 0.01,
        draw: (ctx) => poly(ctx, tilePoints(x, y, 2, ox, oy), color),
      });
    }
  }
  if (area.kind === "floor") {
    for (let tx = 0; tx < 2; tx++) {
      for (let ty = 3; ty < 6; ty++) {
        const x = grid.x + tx;
        const y = grid.y + ty;
        items.push({
          key: x + y + 0.02,
          draw: (ctx) => poly(ctx, tilePoints(x, y, 2, ox, oy), (tx + ty) % 2 ? "#6a4e96" : "#5a4084"),
        });
      }
    }
  }

  enqueueShelf(items, grid.x + 0.28, grid.y + 0.35, ox, oy);
  if (area.kind === "floor") {
    enqueueSofa(items, grid.x + 0.28, grid.y + 3.2, ox, oy);
    enqueueTable(items, grid.x + 0.5, grid.y + 4.45, ox, oy);
    enqueuePlant(items, grid.x + 0.32, grid.y + 5.75, ox, oy);
    enqueueBoard(items, grid.x + 3.7, grid.y + 0.12, ox, oy);
  } else {
    enqueuePlant(items, grid.x + 4.35, grid.y + 0.45, ox, oy);
    enqueuePlant(items, grid.x + 0.35, grid.y + 4.35, ox, oy);
    enqueueLamp(items, lights, grid.x + 4.5, grid.y + 3.7, palette, ox, oy);
    enqueuePicture(items, grid.x + 2.15, grid.y + 0.05, ox, oy);
  }

  const assigned = catalog.bots.filter((bot) => bot.area === area.id);
  const capacity = Math.max(area.capacity ?? assigned.length, assigned.length);
  const slots = area.kind === "office"
    ? [{ x: Math.max(0.9, (grid.w - 2.7) / 2), y: Math.max(1.15, grid.d * 0.28), big: true }, ...deskSlots(Math.max(0, capacity - 1), grid.w, grid.d)]
    : deskSlots(capacity, grid.w, grid.d);

  slots.forEach((slot, index) => {
    const bot = assigned[index];
    const viewBot = bot ? byId.get(bot.id) : undefined;
    const screen = viewBot?.status ?? "empty";
    const feet = enqueueDesk(items, lights, grid.x + slot.x, grid.y + slot.y, Boolean(slot.big), screen, palette, ox, oy, time, reduced);
    if (!viewBot) return;
    placeActor(items, hits, anchors, viewBot, feet.x, feet.y, ox, oy, time, reduced, selected === viewBot.id, 1);
  });
}

function deskSlots(capacity: number, w: number, d: number): Array<{ x: number; y: number; big: boolean }> {
  const cols = capacity <= 2 ? Math.max(1, capacity) : 3;
  const rows = Math.ceil(capacity / cols);
  const left = Math.min(3.05, w * 0.34);
  const usable = Math.max(1.4, w - left - 0.45);
  const yStep = rows === 1 ? 0 : Math.min(2.35, (d - 2.3) / (rows - 1));
  const slots = [];
  for (let i = 0; i < capacity; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cols === 1 ? left + usable * 0.15 : left + (col / (cols - 1)) * (usable - 1.45);
    slots.push({ x, y: 1.05 + row * yStep, big: false });
  }
  return slots;
}

function enqueueHouses(
  items: Item[],
  hits: BufBox[],
  anchors: BufPoint[],
  lights: Light[],
  area: Area,
  grid: { x: number; y: number; w: number; d: number },
  byId: Map<string, BotView>,
  palette: Palette,
  ox: number,
  oy: number,
  time: number,
  reduced: boolean,
  selected: string | null,
): void {
  const bots = catalog.bots.filter((bot) => bot.area === area.id);
  const gapX = 2.2;
  const gapY = 2.15;
  const cols = Math.max(1, Math.floor((grid.w - 0.2) / gapX));
  bots.forEach((bot, index) => {
    const viewBot = byId.get(bot.id);
    if (!viewBot) return;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = grid.x + 0.28 + col * gapX;
    const y = grid.y + 0.28 + row * gapY;
    const wall = shade(bot.color, 70);
    const roof = bot.color;
    items.push({
      key: x + y + 1.05,
      draw: (ctx) => {
        const faces = drawBox(ctx, x, y, 0, 1.05, 1.0, 10, { top: shade(wall, 20), x: shade(wall, -18), y: shade(wall, -34) }, ox, oy);
        drawRoof(ctx, x, y, 1.05, 1.0, 10, 9, shade(roof, -20), shade(roof, 10), ox, oy);
        withClip(ctx, inset(faces.faceY, 0.42), () => {
          const box = bbox(faces.faceY);
          ctx.fillStyle = "#3a2a22";
          ctx.fillRect(box.x + box.w * 0.38, box.y + box.h * 0.45, box.w * 0.28, box.h * 0.55);
        });
        withClip(ctx, inset(faces.faceX, 0.45), () => {
          const box = bbox(faces.faceX);
          ctx.fillStyle = palette.lampOn ? "#ffd27a" : "#9ec8ea";
          ctx.fillRect(box.x + box.w * 0.3, box.y + box.h * 0.28, Math.max(2, box.w * 0.4), Math.max(2, box.h * 0.28));
        });
        if (palette.lampOn) {
          const [lx, ly] = project(x + 1.05, y + 0.35, 7);
          lights.push({ x: lx + ox, y: ly + oy, r: 12, color: "rgba(255,196,110,0.35)" });
        }
      },
    });
    placeActor(items, hits, anchors, viewBot, x + 0.15, y + 1.22, ox, oy, time, reduced, selected === viewBot.id, 0.78);
  });
}

function placeActor(
  items: Item[],
  hits: BufBox[],
  anchors: BufPoint[],
  bot: BotView,
  x: number,
  y: number,
  ox: number,
  oy: number,
  time: number,
  reduced: boolean,
  selected: boolean,
  scale: number,
): void {
  const [sx, sy] = project(x, y, 0);
  const px = sx + ox;
  const py = sy + oy;
  hits.push({ id: bot.id, x: px - 12 * scale, y: py - 24 * scale, w: 24 * scale, h: 28 * scale });
  if (bot.status === "needs_you") anchors.push({ id: bot.id, x: px, y: py - 28 * scale });
  if (selected || bot.status === "needs_you") {
    items.push({
      key: x + y - 0.05,
      draw: (ctx) => {
        const pts = [project(x - 0.15, y - 0.15), project(x + 0.7, y - 0.15), project(x + 0.7, y + 0.55), project(x - 0.15, y + 0.55)].map(
          ([qx, qy]) => [qx + ox, qy + oy] as Pt,
        );
        strokePoly(ctx, pts, selected ? "#ffe08a" : "#ffb020");
      },
    });
  }
  items.push({
    key: x + y + 0.2,
    draw: (ctx) => drawBot(ctx, px, py, bot.color, bot.status, bot.mark, time, reduced, scale),
  });
}

function enqueueDesk(
  items: Item[],
  lights: Light[],
  x: number,
  y: number,
  big: boolean,
  screen: EffectiveStatus | "empty",
  palette: Palette,
  ox: number,
  oy: number,
  time: number,
  reduced: boolean,
): { x: number; y: number } {
  const w = big ? 2.65 : 1.42;
  const d = big ? 1.38 : 0.78;
  const h = big ? 12 : 8;
  items.push({
    key: x + y + d + w * 0.01,
    draw: (ctx) => {
      const wood = big ? palette.chiefWood : palette.wood;
      const faces = drawBox(ctx, x, y, 0, w, d, h, wood, ox, oy);
      withClip(ctx, inset(faces.top, 0.18), () => {
        const box = bbox(faces.top);
        ctx.fillStyle = "rgba(30,24,20,0.45)";
        ctx.fillRect(box.x + box.w * 0.08, box.y + box.h * 0.55, box.w * 0.5, Math.max(2, box.h * 0.22));
      });
      const monW = big ? 0.95 : 0.58;
      const monH = big ? 18 : 12;
      const mx = x + w * 0.46;
      const my = y + 0.08;
      const monitor = drawBox(ctx, mx, my, h, monW, 0.14, monH, palette.monitor, ox, oy);
      drawScreen(ctx, monitor.faceY, screen, time, reduced);
      if (big) {
        const side = drawBox(ctx, x + 0.18, y + 0.12, h, 0.62, 0.14, 14, palette.monitor, ox, oy);
        drawScreen(ctx, side.faceY, screen, time, reduced);
      }
      const laptop = drawBox(ctx, x + (big ? 1.35 : 0.16), y + d * 0.46, h, big ? 0.72 : 0.5, 0.34, 3, {
        top: "#d7deea",
        x: "#8d98ab",
        y: "#6e7888",
      }, ox, oy);
      drawScreen(ctx, laptop.top, screen, time, reduced);
      drawBox(ctx, x + w - 0.38, y + d * 0.55, h, 0.2, 0.2, 4, { top: "#f7f1e8", x: "#d9c3ae", y: "#c3aa92" }, ox, oy);
      if (screen !== "empty" && screen !== "sleeping") {
        const [lx, ly] = project(mx + monW / 2, my + 0.14, h + monH * 0.45);
        lights.push({ x: lx + ox, y: ly + oy, r: big ? 42 : 28, color: palette.screenGlow });
      }
    },
  });
  return { x: x + w * 0.38, y: y + d + 0.22 };
}

function enqueueShelf(items: Item[], x: number, y: number, ox: number, oy: number): void {
  items.push({
    key: x + y + 1.6,
    draw: (ctx) => {
      const faces = drawBox(ctx, x, y, 0, 0.52, 1.65, 30, { top: "#6b4630", x: "#543624", y: "#3e281c" }, ox, oy);
      withClip(ctx, faces.faceY, () => {
        const box = bbox(faces.faceY);
        const books = ["#d4534a", "#e2b657", "#3d7ec9", "#5bba6f", "#8b7cf7", "#f2efe6", "#2a9d8f", "#ff7a59"];
        books.forEach((color, index) => {
          const width = box.w / books.length;
          const height = box.h * (0.45 + (index % 3) * 0.16);
          ctx.fillStyle = color;
          ctx.fillRect(box.x + index * width + 0.4, box.y + box.h - height, Math.max(1, width - 0.8), height);
        });
      });
    },
  });
}

function enqueueSofa(items: Item[], x: number, y: number, ox: number, oy: number): void {
  items.push({
    key: x + y + 1.5,
    draw: (ctx) => {
      drawBox(ctx, x, y + 0.28, 0, 1.55, 0.72, 7, { top: "#7d62b0", x: "#62498e", y: "#4e3874" }, ox, oy);
      drawBox(ctx, x, y, 0, 1.55, 0.28, 14, { top: "#6a4f99", x: "#563f80", y: "#463468" }, ox, oy);
    },
  });
}

function enqueueTable(items: Item[], x: number, y: number, ox: number, oy: number): void {
  items.push({
    key: x + y + 0.8,
    draw: (ctx) => {
      drawBox(ctx, x, y, 0, 0.85, 0.55, 4, { top: "#e6d3b0", x: "#b89468", y: "#8d6d48" }, ox, oy);
    },
  });
}

function enqueuePicture(items: Item[], x: number, y: number, ox: number, oy: number): void {
  items.push({
    key: x + y + 0.3,
    draw: (ctx) => {
      const faces = drawBox(ctx, x, y, 16, 1.15, 0.08, 12, { top: "#e7d7b8", x: "#b89a6a", y: "#f3e6c8" }, ox, oy);
      withClip(ctx, inset(faces.faceY, 0.16), () => {
        const box = bbox(faces.faceY);
        ctx.fillStyle = "#1d4e89";
        ctx.fillRect(box.x, box.y, box.w, box.h * 0.62);
        ctx.fillStyle = "#e2b657";
        ctx.fillRect(box.x, box.y + box.h * 0.62, box.w, box.h * 0.38);
      });
    },
  });
}

function enqueueBoard(items: Item[], x: number, y: number, ox: number, oy: number): void {
  items.push({
    key: x + y + 0.4,
    draw: (ctx) => {
      const faces = drawBox(ctx, x, y, 14, 1.7, 0.1, 14, { top: "#f7f4ea", x: "#d9d3c4", y: "#f7f4ea" }, ox, oy);
      withClip(ctx, inset(faces.faceY, 0.12), () => {
        const box = bbox(faces.faceY);
        const notes = ["#ffd27a", "#9ad7ff", "#f5a3b5", "#b6f3c8"];
        notes.forEach((color, index) => {
          ctx.fillStyle = color;
          ctx.fillRect(box.x + 2 + (index % 2) * box.w * 0.42, box.y + 2 + Math.floor(index / 2) * box.h * 0.4, box.w * 0.28, box.h * 0.28);
        });
      });
    },
  });
}

function enqueuePlant(items: Item[], x: number, y: number, ox: number, oy: number): void {
  items.push({
    key: x + y + 0.7,
    draw: (ctx) => {
      drawBox(ctx, x, y, 0, 0.36, 0.36, 5, { top: "#d0894e", x: "#a86432", y: "#8a4e28" }, ox, oy);
      const [sx, sy] = project(x + 0.18, y + 0.18, 6);
      const blobs = [
        { dx: 0, dy: 0, r: 5, c: "#2f8a45" },
        { dx: -4, dy: 2, r: 3.5, c: "#3eaa58" },
        { dx: 4, dy: 1, r: 3.5, c: "#26753b" },
        { dx: 1, dy: -4, r: 3, c: "#8ee08a" },
      ];
      for (const blob of blobs) {
        ctx.fillStyle = blob.c;
        ctx.beginPath();
        ctx.arc(sx + ox + blob.dx, sy + oy + blob.dy, blob.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });
}

function enqueueLamp(items: Item[], lights: Light[], x: number, y: number, palette: Palette, ox: number, oy: number): void {
  items.push({
    key: x + y + 0.5,
    draw: (ctx) => {
      drawBox(ctx, x, y, 0, 0.22, 0.22, 22, { top: "#d7c09a", x: "#8d7350", y: "#6e5840" }, ox, oy);
      const shadeColor = palette.lampOn ? "#ffe08a" : "#d9d0c2";
      drawBox(ctx, x - 0.12, y - 0.12, 20, 0.46, 0.46, 5, { top: shadeColor, x: shade(shadeColor, -30), y: shade(shadeColor, -48) }, ox, oy);
      if (palette.lampOn) {
        const [lx, ly] = project(x + 0.11, y + 0.11, 24);
        lights.push({ x: lx + ox, y: ly + oy, r: 46, color: palette.lampGlow });
      }
    },
  });
}

function drawRoof(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  d: number,
  z: number,
  rise: number,
  left: string,
  right: string,
  ox: number,
  oy: number,
): void {
  const p = (dx: number, dy: number, dz: number): Pt => {
    const [sx, sy] = project(x + dx, y + dy, z + dz);
    return [sx + ox, sy + oy];
  };
  const apex = p(w / 2, d / 2, rise);
  poly(ctx, [apex, p(w, 0, 0), p(w, d, 0)], right);
  poly(ctx, [apex, p(0, d, 0), p(w, d, 0)], left);
}

function drawWindow(ctx: CanvasRenderingContext2D, face: Pt[], palette: Palette, light: TimeOfDay): void {
  const opening = inset(face, 0.22);
  withClip(ctx, opening, () => {
    const box = bbox(opening);
    ctx.fillStyle = palette.sky;
    ctx.fillRect(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
    ctx.fillStyle = palette.frame;
    ctx.fillRect(box.x + box.w / 2 - 0.6, box.y, 1.2, box.h);
    ctx.fillRect(box.x, box.y + box.h / 2 - 0.6, box.w, 1.2);
    if (light === "night") {
      ctx.fillStyle = "#f4e7b0";
      ctx.fillRect(box.x + box.w * 0.62, box.y + box.h * 0.22, 4, 4);
      ctx.fillStyle = "#d5def8";
      ctx.fillRect(box.x + box.w * 0.2, box.y + box.h * 0.3, 1, 1);
    } else if (light === "evening") {
      ctx.fillStyle = "#ffd27a";
      ctx.fillRect(box.x + box.w * 0.28, box.y + box.h * 0.48, 5, 5);
    } else {
      ctx.fillStyle = "#fff1a8";
      ctx.fillRect(box.x + box.w * 0.18, box.y + box.h * 0.18, 5, 5);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(box.x + box.w * 0.55, box.y + box.h * 0.35, 6, 3);
    }
  });
}

function drawScreen(
  ctx: CanvasRenderingContext2D,
  face: Pt[],
  kind: EffectiveStatus | "empty",
  time: number,
  reduced: boolean,
): void {
  const base =
    kind === "empty" || kind === "sleeping"
      ? "#161a24"
      : kind === "terminal"
        ? "#0c1a12"
        : kind === "error"
          ? "#3a141c"
          : kind === "needs_you"
            ? "#3d2c12"
            : kind === "browsing"
              ? "#f6f8fb"
              : kind === "thinking"
                ? "#241c3a"
                : kind === "done"
                  ? "#10281c"
                  : kind === "idle" || kind === "home_office"
                    ? "#1c2130"
                    : "#10192a";
  withClip(ctx, inset(face, 0.12), () => {
    const box = bbox(face);
    ctx.fillStyle = base;
    ctx.fillRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
    const tick = reduced ? 1 : Math.floor(time / 180);
    if (kind === "working") {
      const colors = ["#9ad7ff", "#d7c4ff", "#b6f3c8", "#ffe0a3"];
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = colors[(i + tick) % colors.length];
        ctx.fillRect(box.x + 1, box.y + 2 + i * 2.2, Math.max(3, box.w * (0.35 + ((i * 3 + tick) % 4) * 0.12)), 1);
      }
    } else if (kind === "terminal") {
      ctx.fillStyle = "#3dd68c";
      for (let i = 0; i < 4; i++) ctx.fillRect(box.x + 1, box.y + 2 + i * 2.4, box.w * (0.3 + ((i + tick) % 3) * 0.18), 1);
    } else if (kind === "browsing") {
      ctx.fillStyle = "#3d7ec9";
      ctx.fillRect(box.x, box.y, box.w, Math.max(2, box.h * 0.22));
      ctx.fillStyle = "#d5deea";
      ctx.fillRect(box.x + 1, box.y + box.h * 0.4, box.w * 0.7, Math.max(2, box.h * 0.18));
      ctx.fillStyle = "#ffb020";
      ctx.fillRect(box.x + 1, box.y + box.h * 0.68, box.w * 0.4, Math.max(2, box.h * 0.16));
    } else if (kind === "thinking") {
      const on = (tick + 1) % 3;
      ctx.fillStyle = "#d7c8ff";
      for (let i = 0; i < 3; i++) ctx.fillRect(box.x + box.w * 0.2 + i * 4, box.y + box.h * 0.45, 2, on === i ? 2 : 1);
    } else if (kind === "needs_you") {
      ctx.fillStyle = tick % 2 === 0 ? "#ffb020" : "#ffe08a";
      ctx.fillRect(box.x + box.w * 0.42, box.y + 2, 2, box.h * 0.55);
      ctx.fillRect(box.x + box.w * 0.42, box.y + box.h * 0.75, 2, 2);
    } else if (kind === "error") {
      ctx.fillStyle = "#ff5d5d";
      ctx.fillRect(box.x + 2, box.y + box.h * 0.35, box.w * 0.7, 2);
    } else if (kind === "done") {
      ctx.fillStyle = "#7dcea0";
      ctx.fillRect(box.x + 2, box.y + box.h * 0.45, box.w * 0.25, 2);
      ctx.fillRect(box.x + box.w * 0.3, box.y + box.h * 0.6, box.w * 0.4, 2);
    } else if (kind === "idle") {
      ctx.fillStyle = "#8ea0c8";
      ctx.fillRect(box.x + box.w * 0.45, box.y + box.h * 0.4, 2, 2);
    }
  });
}

function paintLights(ctx: CanvasRenderingContext2D, lights: Light[]): void {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const light of lights) {
    const gradient = ctx.createRadialGradient(light.x, light.y, 1, light.x, light.y, light.r);
    gradient.addColorStop(0, light.color);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(light.x, light.y, light.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, light: TimeOfDay): void {
  if (light === "day") return;
  const count = light === "night" ? 48 : 16;
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  ctx.fillStyle = light === "night" ? "rgba(232,236,255,0.85)" : "rgba(255,220,180,0.45)";
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h * 0.42);
    ctx.fillRect(x, y, 1, 1);
  }
}

function inset(pts: Pt[], amount: number): Pt[] {
  const cx = pts.reduce((sum, point) => sum + point[0], 0) / pts.length;
  const cy = pts.reduce((sum, point) => sum + point[1], 0) / pts.length;
  return pts.map(([x, y]) => [cx + (x - cx) * (1 - amount), cy + (y - cy) * (1 - amount)]);
}

function makePalette(light: TimeOfDay): Palette {
  if (light === "night") {
    return {
      wood: { top: "#8a5a34", x: "#6a4328", y: "#4e311c" },
      chiefWood: { top: "#a56b3c", x: "#7a4c2a", y: "#5c381e" },
      wall: { top: "#3d4768", x: "#2a3148", y: "#343c58" },
      chiefWall: { top: "#6a4634", x: "#4a3028", y: "#5c3a2e" },
      floor: ["#6e4a2c", "#7a5432", "#654428"],
      chiefFloor: ["#5c3a24", "#6a442c"],
      grass: ["#24301c", "#2c3a22"],
      rug: ["#2c4f86", "#345a98"],
      chiefRug: "#7a3038",
      sky: "#141b33",
      frame: "#c8b48a",
      lampOn: true,
      screenGlow: "rgba(120,190,255,0.55)",
      lampGlow: "rgba(255,176,80,0.7)",
      monitor: { top: "#2a2e38", x: "#1b1e28", y: "#12141c" },
    };
  }
  if (light === "evening") {
    return {
      wood: { top: "#c48448", x: "#a06838", y: "#7d4e2a" },
      chiefWood: { top: "#d49255", x: "#b07240", y: "#8a5430" },
      wall: { top: "#8a7088", x: "#5c4d6e", y: "#6a5878" },
      chiefWall: { top: "#c48a62", x: "#8a5a42", y: "#a06850" },
      floor: ["#b88448", "#c49252", "#a8743c"],
      chiefFloor: ["#a87440", "#b8844c"],
      grass: ["#4d6a32", "#58783a"],
      rug: ["#3d62a8", "#4a70b4"],
      chiefRug: "#a84850",
      sky: "#ff8a4a",
      frame: "#f0d2b0",
      lampOn: true,
      screenGlow: "rgba(140,190,255,0.35)",
      lampGlow: "rgba(255,186,96,0.55)",
      monitor: { top: "#343846", x: "#232733", y: "#1a1e28" },
    };
  }
  return {
    wood: { top: "#e0b072", x: "#c48a4c", y: "#a56e38" },
    chiefWood: { top: "#efc48a", x: "#d4a15e", y: "#b88448" },
    wall: { top: "#d5e2fb", x: "#7f96c9", y: "#93aad6" },
    chiefWall: { top: "#f0d2b4", x: "#c48b66", y: "#d7a484" },
    floor: ["#e2b56e", "#efc27e", "#d4a45e"],
    chiefFloor: ["#d7a868", "#e2b478"],
    grass: ["#6ea35a", "#7cb568"],
    rug: ["#4d86d6", "#5b94e0"],
    chiefRug: "#d46068",
    sky: "#8ecbff",
    frame: "#f7f1e6",
    lampOn: false,
    screenGlow: "rgba(150,200,255,0.18)",
    lampGlow: "rgba(0,0,0,0)",
    monitor: { top: "#3a3e4a", x: "#2a2e38", y: "#1e222c" },
  };
}
