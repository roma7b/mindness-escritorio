export const HW = 16;
export const HH = 8;

export type Pt = [number, number];

export function project(x: number, y: number, z = 0): Pt {
  return [(x - y) * HW, (x + y) * HH - z];
}

export function shade(hex: string, amount: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
  const num = Number.parseInt(full, 16);
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const r = clamp(((num >> 16) & 255) + amount);
  const g = clamp(((num >> 8) & 255) + amount);
  const b = clamp((num & 255) + amount);
  return `rgb(${r} ${g} ${b})`;
}

export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokePoly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

export type BoxColors = { top: string; x: string; y: string };

export function shift(pts: Pt[], ox: number, oy: number): Pt[] {
  return pts.map(([x, y]) => [x + ox, y + oy]);
}

export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  colors: BoxColors,
  ox: number,
  oy: number,
): { top: Pt[]; faceX: Pt[]; faceY: Pt[] } {
  const p = (dx: number, dy: number, dz: number): Pt => {
    const [sx, sy] = project(x + dx, y + dy, z + dz);
    return [sx + ox, sy + oy];
  };
  const top = [p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)];
  const faceX = [p(w, 0, h), p(w, 0, 0), p(w, d, 0), p(w, d, h)];
  const faceY = [p(0, d, h), p(w, d, h), p(w, d, 0), p(0, d, 0)];
  poly(ctx, top, colors.top);
  poly(ctx, faceX, colors.x);
  poly(ctx, faceY, colors.y);
  return { top, faceX, faceY };
}

export function tilePoints(x: number, y: number, z: number, ox: number, oy: number): Pt[] {
  return shift([project(x, y, z), project(x + 1, y, z), project(x + 1, y + 1, z), project(x, y + 1, z)], ox, oy);
}

export function bbox(pts: Pt[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map((point) => point[0]);
  const ys = pts.map((point) => point[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function withClip(ctx: CanvasRenderingContext2D, pts: Pt[], draw: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.clip();
  draw();
  ctx.restore();
}
