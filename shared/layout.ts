import raw from "../data/layout.json";

export type LayoutItem = {
  id: string;
  kind: string;
  x: number;
  z: number;
  rot: number;
  scale?: number;
  /** Altura do piso do modelo. Livros e abajures usam isso para sentar na prateleira ou na mesa. */
  y?: number;
};

export type LayoutFile = { version: 1; items: LayoutItem[] };

type KindSpec = {
  label: string;
  w: number;
  d: number;
  solid: boolean;
  oz?: number;
};

export const GRID = 0.4;

export const KINDS: Record<string, KindSpec> = {
  desk: { label: "Mesa", w: 1.2, d: 1.45, oz: 0.32, solid: true },
  deskCorner: { label: "Mesa grande", w: 1.7, d: 1.7, solid: true },
  loungeSofaLong: { label: "Sofá", w: 1.57, d: 1.31, solid: true },
  loungeChair: { label: "Poltrona", w: 0.8, d: 0.68, solid: true },
  tableCoffee: { label: "Mesa de centro", w: 1.06, d: 0.64, solid: true },
  bookcaseOpen: { label: "Estante", w: 0.66, d: 0.42, solid: true },
  pottedPlant: { label: "Planta alta", w: 0.38, d: 0.4, solid: true },
  lampRoundFloor: { label: "Luminária", w: 0.34, d: 0.34, solid: true },
  sideTable: { label: "Mesa lateral", w: 0.86, d: 0.38, solid: true },
  kitchenCoffeeMachine: { label: "Cafeteira", w: 0.36, d: 0.42, solid: true },
  cardboardBoxClosed: { label: "Caixa", w: 0.38, d: 0.38, solid: true },
  cardboardBoxOpen: { label: "Caixa aberta", w: 0.62, d: 0.38, solid: true },
  whiteboard: { label: "Quadro branco", w: 1.02, d: 0.16, solid: true },
  frame: { label: "Quadro", w: 0.52, d: 0.12, solid: true },
  cooler: { label: "Bebedouro", w: 0.4, d: 0.36, solid: true },
  rugRounded: { label: "Tapete", w: 2.51, d: 1.47, solid: false },
  books: { label: "Livros", w: 0.26, d: 0.18, solid: false },
  plantSmall1: { label: "Planta pequena", w: 0.22, d: 0.22, solid: false },
  plantSmall2: { label: "Planta média", w: 0.22, d: 0.22, solid: false },
  plantSmall3: { label: "Vaso", w: 0.22, d: 0.2, solid: false },
  lampRoundTable: { label: "Abajur", w: 0.28, d: 0.28, solid: false },
  speakerSmall: { label: "Caixa de som", w: 0.26, d: 0.24, solid: false },
};

export const PALETTE = [
  "desk",
  "deskCorner",
  "loungeSofaLong",
  "loungeChair",
  "tableCoffee",
  "bookcaseOpen",
  "pottedPlant",
  "plantSmall1",
  "lampRoundFloor",
  "rugRounded",
  "kitchenCoffeeMachine",
  "cooler",
  "cardboardBoxClosed",
  "whiteboard",
  "frame",
  "sideTable",
] as const;

export const ROOMS = [
  { id: "prospeccao", x: 0, z: 0, w: 8, d: 6.4 },
  { id: "chief", x: 8.35, z: 0.45, w: 4.8, d: 4.8 },
];

export const BLOCKS = [
  { x: 2.4, z: 0.22, w: 1.28, d: 0.5 },
  { x: 5.6, z: 0.22, w: 1.28, d: 0.5 },
  { x: 10.75, z: 0.68, w: 1.28, d: 0.5 },
  { x: 13.15, z: 2.85, w: 0.5, d: 1.35 },
];

export type Rect = { x: number; z: number; w: number; d: number };

export const defaultLayout = raw as LayoutFile;

export function snap(value: number) {
  return Math.round(Math.round(value / GRID) * GRID * 100) / 100;
}

export function rectOf(item: LayoutItem): Rect {
  const spec = KINDS[item.kind] ?? { w: 0.4, d: 0.4, solid: true };
  const scale = item.scale ?? 1;
  let w = spec.w * scale;
  let d = spec.d * scale;
  const oz = (spec.oz ?? 0) * scale;
  const rad = (item.rot * Math.PI) / 180;
  const x = item.x - Math.sin(rad) * oz;
  const z = item.z + Math.cos(rad) * oz;
  if (Math.abs(item.rot % 180) === 90) [w, d] = [d, w];
  return { x: x - w / 2, z: z - d / 2, w, d };
}

export function intersects(a: Rect, b: Rect) {
  const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const iz = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
  return ix > 0.05 && iz > 0.05;
}

function solid(item: LayoutItem) {
  return KINDS[item.kind]?.solid !== false;
}

export function overlapPairs(items: LayoutItem[]) {
  const pairs: Array<[string, string]> = [];
  const solids = items.filter(solid);
  for (let i = 0; i < solids.length; i++) {
    const a = rectOf(solids[i]);
    for (let j = i + 1; j < solids.length; j++) {
      if (intersects(a, rectOf(solids[j]))) pairs.push([solids[i].id, solids[j].id]);
    }
    for (const block of BLOCKS) {
      if (intersects(a, { x: block.x - block.w / 2, z: block.z - block.d / 2, w: block.w, d: block.d })) {
        pairs.push([solids[i].id, "janela"]);
      }
    }
  }
  return pairs;
}

function blocked(items: LayoutItem[], ignore: Set<string>, item: LayoutItem) {
  if (!solid(item)) return false;
  const rect = rectOf(item);
  for (const other of items) {
    if (ignore.has(other.id) || !solid(other)) continue;
    if (intersects(rect, rectOf(other))) return true;
  }
  for (const block of BLOCKS) {
    if (intersects(rect, { x: block.x - block.w / 2, z: block.z - block.d / 2, w: block.w, d: block.d })) return true;
  }
  return false;
}

export function moveItem(items: LayoutItem[], id: string, x: number, z: number): LayoutItem[] | null {
  const current = items.find((item) => item.id === id);
  if (!current) return null;
  const dx = snap(x) - current.x;
  const dz = snap(z) - current.z;
  if (dx === 0 && dz === 0) return items;
  const next = items.map((item) => (item.id === id ? { ...item, x: snap(x), z: snap(z) } : item));
  const moved = next.find((item) => item.id === id)!;
  if (blocked(next, new Set([id]), moved)) return null;
  return next;
}

export function rotateItem(items: LayoutItem[], id: string): LayoutItem[] | null {
  const next = items.map((item) => (item.id === id ? { ...item, rot: (item.rot + 90) % 360 } : item));
  const moved = next.find((item) => item.id === id);
  if (!moved || blocked(next, new Set([id]), moved)) return null;
  return next;
}

export function removeItem(items: LayoutItem[], id: string) {
  return items.filter((item) => item.id !== id);
}

export function addItem(items: LayoutItem[], kind: string): LayoutItem[] | null {
  if (!KINDS[kind]) return null;
  const scale = kind === "rugRounded" ? 1.2 : kind === "loungeSofaLong" ? 0.85 : 1;
  for (let z = 1.2; z <= 5.6; z += GRID) {
    for (let x = 1.2; x <= 12.4; x += GRID) {
      const item: LayoutItem = { id: `novo-${kind}-${items.length}-${x}-${z}`, kind, x, z, rot: 0, scale };
      if (!blocked(items.concat(item), new Set([item.id]), item)) return items.concat(item);
    }
  }
  return null;
}

export function parseLayout(text: string): LayoutItem[] | null {
  try {
    const data = JSON.parse(text) as LayoutFile;
    if (!data || data.version !== 1 || !Array.isArray(data.items)) return null;
    const items = data.items.flatMap((item) => {
      if (!item || !KINDS[item.kind] || !Number.isFinite(item.x) || !Number.isFinite(item.z) || !Number.isFinite(item.rot)) return [];
      const next: LayoutItem = { id: String(item.id || item.kind), kind: item.kind, x: item.x, z: item.z, rot: item.rot };
      if (Number.isFinite(item.scale)) next.scale = item.scale;
      if (Number.isFinite(item.y)) next.y = item.y;
      return [next];
    });
    return items.length ? items : null;
  } catch {
    return null;
  }
}

export function roomOf(item: LayoutItem) {
  return ROOMS.find((room) => item.x >= room.x && item.x <= room.x + room.w && item.z >= room.z && item.z <= room.z + room.d)?.id;
}

export function desksIn(items: LayoutItem[], roomId: string) {
  return items
    .filter((item) => (item.kind === "desk" || item.kind === "deskCorner") && roomOf(item) === roomId)
    .sort((a, b) => a.z - b.z || a.x - b.x);
}
