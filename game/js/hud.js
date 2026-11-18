// Solmar City — the HUD: health and cash, wanted stars, the mission
// objective, toasts, prompts, and the minimap in the corner.

import { clamp } from './util.js';
import { WORLD_W, WORLD_H } from './city.js';

export class Hud {
  constructor(world) {
    this.world = world;
  }

  draw(ctx) {
    const world = this.world;
    const player = world.player;
    const w = world.viewW;
    const h = world.viewH;

    // --- Top-left: health bar and cash.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, 12, 12, 230, 64, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('DANA REYES', 24, 34);
    ctx.fillStyle = '#2d3436';
    ctx.fillRect(24, 42, 150, 12);
    ctx.fillStyle = player.health > 50 ? '#2ecc71' : player.health > 25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(24, 42, 150 * clamp(player.health / 100, 0, 1), 12);
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('$' + player.cash.toLocaleString('en-US'), 24, 70);
    ctx.restore();
    // Car chip below the health box while driving.
    if (player.inCar) {
      ctx.save();
      const label = player.car.model.name + '  •  ' + Math.round(Math.abs(player.car.speed) * 0.12) + ' mph';
      ctx.font = '13px system-ui, sans-serif';
      const lw = ctx.measureText(label).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, 12, 82, lw, 28, 8);
      ctx.fill();
      ctx.fillStyle = '#74b9ff';
      ctx.textAlign = 'left';
      ctx.fillText(label, 24, 101);
      ctx.restore();
    }

    // --- Top-right: wanted stars.
    const wanted = world.police.wanted;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, w - 190, 12, 178, 44, 8);
    ctx.fill();
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < wanted ? '#f1c40f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', w - 168 + i * 34, 42);
    }
    ctx.restore();

    // --- Top-centre: current objective.
    ctx.save();
    ctx.font = 'bold 15px system-ui, sans-serif';
    const objective = world.missions.objectiveText;
    const ow = ctx.measureText(objective).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, (w - ow) / 2, 12, ow, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.textAlign = 'center';
    ctx.fillText(objective, w / 2, 34);
    ctx.restore();

    // --- Bottom-left: context prompt (enter car / start mission).
    if (world.prompt) {
      ctx.save();
      ctx.font = 'bold 15px system-ui, sans-serif';
      const pw = ctx.measureText(world.prompt).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, 12, h - 52, pw, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(world.prompt, 26, h - 30);
      ctx.restore();
    }

    // --- Toasts.
    ctx.save();
    ctx.textAlign = 'center';
    let ty = 120;
    for (const toast of world.toasts) {
      const alpha = clamp(toast.life / 1.2, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px system-ui, sans-serif';
      const tw = ctx.measureText(toast.text).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      roundRect(ctx, (w - tw) / 2, ty, tw, 30, 8);
      ctx.fill();
      ctx.fillStyle = toast.color;
      ctx.fillText(toast.text, w / 2, ty + 20);
      ty += 38;
    }
    ctx.restore();

    // --- Minimap, bottom-right.
    this.drawMinimap(ctx, w - 212, h - 172, 200, 160);

    // --- Hurt vignette.
    if (player.hurtFlash > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(231,76,60,' + (player.hurtFlash * 0.5) + ')';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  drawMinimap(ctx, x, y, mw, mh) {
    const world = this.world;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, x - 6, y - 6, mw + 12, mh + 12, 8);
    ctx.fill();
    // Water and sand.
    ctx.fillStyle = '#0984e3';
    ctx.fillRect(x + 3520 * sx, y, 80 * sx, mh);
    ctx.fillStyle = '#f6e58d';
    ctx.fillRect(x + 3300 * sx, y, 220 * sx, mh);
    // Roads.
    ctx.fillStyle = '#636e72';
    for (const a of world.cityAvenues) ctx.fillRect(x + (a - 48) * sx, y, 96 * sx, mh);
    for (const s of world.cityStreets) ctx.fillRect(x, y + (s - 48) * sy, mw, 96 * sy);
    // Buildings.
    ctx.fillStyle = 'rgba(178,190,195,0.8)';
    for (const b of world.city.buildings) {
      ctx.fillRect(x + b.x * sx, y + b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
    }
    // Parks.
    ctx.fillStyle = 'rgba(46,204,113,0.7)';
    for (const p of world.city.parks) {
      ctx.fillRect(x + p.x * sx, y + p.y * sy, p.w * sx, p.h * sy);
    }
    // Mission marker (pulsing).
    const marker = world.missions.marker;
    if (marker) {
      const pulse = 3 + Math.sin(world.time * 5) * 1.5;
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x + marker.x * sx, y + marker.y * sy, pulse + 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x + marker.x * sx, y + marker.y * sy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police (red) and traffic (white) dots.
    ctx.fillStyle = '#e74c3c';
    for (const car of world.police.cars) {
      ctx.fillRect(x + car.x * sx - 2, y + car.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const car of world.traffic.cars) {
      if (car.traffic) ctx.fillRect(x + car.x * sx - 1.5, y + car.y * sy - 1.5, 3, 3);
    }
    // Player arrow.
    const p = world.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#00cec9';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North label.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', x + 2, y + 12);
    ctx.restore();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
