import type { BotMark, EffectiveStatus } from "../../shared/office";
import { shade } from "./iso";

export function drawBot(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  color: string,
  status: EffectiveStatus,
  mark: BotMark | undefined,
  time: number,
  reduced: boolean,
  scale = 1,
): void {
  const hop = !reduced && status === "needs_you" ? Math.abs(Math.sin(time / 170)) * 3 : 0;
  const bob = !reduced && status !== "sleeping" && status !== "home_office" ? Math.sin(time / 280 + sx) * 0.8 : 0;
  const shake = !reduced && status === "error" && Math.floor(time / 120) % 2 === 0 ? 1 : 0;
  const feetY = sy + bob - hop;
  const bodyTop = feetY - 15 * scale;

  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(sx, sy + 1, 7 * scale, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  const dark = shade(color, -48);
  const light = shade(color, 48);
  ctx.save();
  ctx.translate(sx + shake, bodyTop);
  ctx.scale(scale, scale);
  for (let y = 0; y < 14; y++) {
    for (let x = -7; x <= 7; x++) {
      const nx = x / 7;
      const ny = (y - 6.2) / 7;
      const dist = nx * nx + ny * ny;
      if (dist > 1) continue;
      const edge = dist > 0.78;
      const highlight = nx < -0.2 && ny < -0.35 && dist < 0.5;
      ctx.fillStyle = edge ? dark : highlight ? light : color;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const blink = !reduced && Math.floor(time / 160) % 26 === 0;
  const sleep = status === "sleeping";
  ctx.fillStyle = "#241820";
  if (sleep || blink) {
    ctx.fillRect(-4, 6, 3, 1);
    ctx.fillRect(2, 6, 3, 1);
  } else {
    ctx.fillRect(-4, 5, 2, 2);
    ctx.fillRect(2, 5, 2, 2);
    ctx.fillStyle = "#fff8ee";
    ctx.fillRect(-4, 5, 1, 1);
    ctx.fillRect(2, 5, 1, 1);
  }

  if (status === "working" || status === "terminal") {
    const arm = !reduced && Math.floor(time / 140) % 2 === 0 ? 0 : 1;
    ctx.fillStyle = dark;
    ctx.fillRect(-8, 8, 2, 2);
    ctx.fillRect(6, 8 + arm, 2, 2);
  }

  drawMark(ctx, mark);
  ctx.restore();

  if (sleep) drawZzz(ctx, sx + 8 * scale, feetY - 20 * scale, time, reduced);
  if (status === "thinking") drawDots(ctx, sx, feetY - 24 * scale, time, reduced);
}

function drawMark(ctx: CanvasRenderingContext2D, mark: BotMark | undefined): void {
  if (!mark) return;
  if (mark === "crown") {
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(-4, -2, 9, 2);
    ctx.fillRect(-4, -4, 2, 2);
    ctx.fillRect(-1, -5, 2, 3);
    ctx.fillRect(3, -4, 2, 2);
  } else if (mark === "glass") {
    ctx.strokeStyle = "#f8fbff";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(8, 4, 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(13, 9);
    ctx.stroke();
  } else if (mark === "plane") {
    ctx.fillStyle = "#f4fffb";
    ctx.fillRect(7, 3, 5, 2);
    ctx.fillRect(8, 2, 2, 4);
  } else if (mark === "book") {
    ctx.fillStyle = "#f7f1e4";
    ctx.fillRect(-9, 4, 4, 5);
    ctx.fillStyle = "#8b7cf7";
    ctx.fillRect(-9, 4, 1, 5);
  } else if (mark === "headset") {
    ctx.fillStyle = "#163226";
    ctx.fillRect(-6, 3, 2, 4);
    ctx.fillRect(5, 3, 2, 4);
    ctx.fillRect(-6, 2, 12, 2);
  }
}

function drawZzz(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, reduced: boolean): void {
  for (let i = 0; i < 3; i++) {
    const phase = reduced ? i * 0.7 : ((time / 700) + i * 0.7) % 2.1;
    ctx.globalAlpha = 0.35 + (1 - phase / 2.1) * 0.65;
    ctx.fillStyle = "#d5def8";
    const zx = x + i * 3;
    const zy = y - phase * 7;
    ctx.fillRect(zx, zy, 4, 1);
    ctx.fillRect(zx + 2, zy + 1, 2, 1);
    ctx.fillRect(zx, zy + 2, 4, 1);
  }
  ctx.globalAlpha = 1;
}

function drawDots(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, reduced: boolean): void {
  for (let i = 0; i < 3; i++) {
    const on = reduced || Math.floor(time / 220 + i) % 3 === 0;
    ctx.fillStyle = on ? "#d7c8ff" : "#6d6294";
    ctx.fillRect(x - 4 + i * 3, y, 2, 2);
  }
}
