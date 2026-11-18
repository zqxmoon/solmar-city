// Solmar City — the renderer: draws the whole sun-soaked city top-down
// on the canvas — roads and lane paint, buildings with windows and neon
// signs, parks, the beach and the sea, cars, pedestrians, officers,
// rivals, bullets, particles, and the mission marker.

import { AVENUES, STREETS, ROAD_W, WORLD_W, WORLD_H } from './city.js';
import { clamp } from './util.js';

export class Renderer {
  constructor(world) {
    this.world = world;
  }

  draw(ctx) {
    const world = this.world;
    const cam = world.camera;
    ctx.save();
    // Warm sunset sky tone as the ground base.
    ctx.fillStyle = '#dfe6b8';
    ctx.fillRect(0, 0, world.viewW, world.viewH);
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    const vx0 = cam.x - 60;
    const vy0 = cam.y - 60;
    const vx1 = cam.x + world.viewW + 60;
    const vy1 = cam.y + world.viewH + 60;

    this.drawGround(ctx, vx0, vy0, vx1, vy1);
    this.drawRoads(ctx, vx0, vy0, vx1, vy1);
    this.drawParks(ctx, vx0, vy0, vx1, vy1);
    this.drawBuildings(ctx, vx0, vy0, vx1, vy1);
    this.drawBeach(ctx, vx0, vy0, vx1, vy1);
    this.drawCash(ctx, vx0, vy0, vx1, vy1);
    this.drawMissionMarker(ctx);
    this.drawCars(ctx, vx0, vy0, vx1, vy1);
    this.drawPeds(ctx, vx0, vy0, vx1, vy1);
    this.drawOfficers(ctx, vx0, vy0, vx1, vy1);
    this.drawRivals(ctx, vx0, vy0, vx1, vy1);
    this.drawPlayer(ctx);
    this.drawBullets(ctx);
    this.drawParticles(ctx);
    ctx.restore();
  }

  drawGround(ctx, x0, y0, x1, y1) {
    // City ground: pale warm pavement blocks.
    ctx.fillStyle = '#e6ddc3';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  drawRoads(ctx, x0, y0, x1, y1) {
    const city = this.world.city;
    void city;
    ctx.fillStyle = '#4a4a52';
    for (const a of AVENUES) {
      if (a > x0 - ROAD_W && a < x1 + ROAD_W) ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    }
    for (const s of STREETS) {
      if (s > y0 - ROAD_W && s < y1 + ROAD_W) ctx.fillRect(0, s - ROAD_W / 2, WORLD_W, ROAD_W);
    }
    // Sidewalk edges.
    ctx.fillStyle = '#b8b2a0';
    for (const a of AVENUES) {
      if (a > x0 - ROAD_W && a < x1 + ROAD_W) {
        ctx.fillRect(a - ROAD_W / 2 - 10, 0, 10, WORLD_H);
        ctx.fillRect(a + ROAD_W / 2, 0, 10, WORLD_H);
      }
    }
    for (const s of STREETS) {
      if (s > y0 - ROAD_W && s < y1 + ROAD_W) {
        ctx.fillRect(0, s - ROAD_W / 2 - 10, WORLD_W, 10);
        ctx.fillRect(0, s + ROAD_W / 2, WORLD_W, 10);
      }
    }
    // Centre dashes.
    ctx.fillStyle = '#f5d76e';
    for (const a of AVENUES) {
      if (a < x0 - ROAD_W || a > x1 + ROAD_W) continue;
      for (let y = 0; y < WORLD_H; y += 56) {
        if (y < y0 - 60 || y > y1 + 60) continue;
        ctx.fillRect(a - 3, y, 6, 28);
      }
    }
    for (const s of STREETS) {
      if (s < y0 - ROAD_W || s > y1 + ROAD_W) continue;
      for (let x = 0; x < WORLD_W; x += 56) {
        if (x < x0 - 60 || x > x1 + 60) continue;
        ctx.fillRect(x, s - 3, 28, 6);
      }
    }
  }

  drawParks(ctx, x0, y0, x1, y1) {
    for (const park of this.world.city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = park.plaza ? '#d5c9a8' : '#7ec850';
      ctx.fillRect(park.x, park.y, park.w, park.h);
      if (park.plaza) {
        ctx.fillStyle = '#74b9ff';
        ctx.beginPath();
        ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#dfe6e9';
        ctx.beginPath();
        ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Trees (round canopies with a trunk dot).
    for (const tree of this.world.city.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      ctx.fillStyle = tree.palm ? '#27ae60' : '#2e8b57';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b4a2f';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawBuildings(ctx, x0, y0, x1, y1) {
    for (const b of this.world.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Soft shadow, then the body, then a darker roof edge.
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = b.roof;
      ctx.lineWidth = 5;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
      // Windows: a grid of lit and dark panes.
      const cols = Math.max(2, Math.floor(b.w / 26));
      const rows = Math.max(2, Math.floor(b.h / 26));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const lit = ((b.id * 7 + c * 3 + r * 5) % 4) === 0;
          ctx.fillStyle = lit ? '#ffeaa7' : '#34495e';
          ctx.fillRect(b.x + 8 + c * ((b.w - 16) / cols), b.y + 8 + r * ((b.h - 16) / rows), 9, 11);
        }
      }
      if (b.sign) {
        ctx.fillStyle = '#e84393';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.sign, b.x + b.w / 2, b.y + b.h / 2 + 5);
      }
    }
  }

  drawBeach(ctx, x0, y0, x1, y1) {
    const beach = this.world.city.beach;
    const sea = this.world.city.sea;
    if (beach.x < x1) {
      ctx.fillStyle = '#f6e58d';
      ctx.fillRect(Math.max(beach.x, x0), 0, beach.w, WORLD_H);
      // Boardwalk planks along the sand's west edge.
      ctx.fillStyle = '#b07d4f';
      ctx.fillRect(3300, 0, 26, WORLD_H);
      ctx.fillStyle = '#8d6238';
      for (let y = 0; y < WORLD_H; y += 44) ctx.fillRect(3300, y, 26, 3);
      // Umbrellas dotted on the sand.
      ctx.fillStyle = '#e74c3c';
      for (let y = 200; y < WORLD_H; y += 420) {
        ctx.beginPath();
        ctx.arc(3400, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (sea.x < x1) {
      // The sea, with a couple of animated wave lines.
      ctx.fillStyle = '#0984e3';
      ctx.fillRect(Math.max(sea.x, x0), 0, sea.w, WORLD_H);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      const t = this.world.time;
      for (let i = 0; i < 4; i++) {
        const wy = ((i * 600 + t * 40) % WORLD_H);
        ctx.beginPath();
        ctx.moveTo(sea.x + 8, wy);
        ctx.quadraticCurveTo(sea.x + 40, wy + 18, sea.x + 72, wy);
        ctx.stroke();
      }
    }
  }

  drawCash(ctx, x0, y0, x1, y1) {
    for (const spot of this.world.city.cashSpots) {
      if (spot.taken) continue;
      if (spot.x < x0 || spot.x > x1 || spot.y < y0 || spot.y > y1) continue;
      const bob = Math.sin(this.world.time * 3 + spot.x) * 2;
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(spot.x - 9, spot.y - 6 + bob, 18, 12);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', spot.x, spot.y + 4 + bob);
    }
  }

  drawMissionMarker(ctx) {
    const marker = this.world.missions.marker;
    if (!marker) return;
    const pulse = 1 + Math.sin(this.world.time * 5) * 0.12;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.scale(pulse, pulse);
    // A tall beacon column so the marker reads from far away.
    ctx.fillStyle = 'rgba(241,196,15,0.18)';
    ctx.fillRect(-14, -220, 28, 220);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.lineTo(-16, -14);
    ctx.lineTo(16, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.arc(0, -6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Label under the marker.
    ctx.save();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = ctx.measureText(marker.label).width + 16;
    ctx.fillRect(marker.x - w / 2, marker.y + 24, w, 22);
    ctx.fillStyle = '#f1c40f';
    ctx.fillText(marker.label, marker.x, marker.y + 39);
    ctx.restore();
  }

  drawCars(ctx, x0, y0, x1, y1) {
    for (const car of this.world.traffic.allCars()) {
      if (car.x < x0 || car.x > x1 || car.y < y0 || car.y > y1) continue;
      this.drawCar(ctx, car);
    }
  }

  drawCar(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 7);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(30,39,46,0.85)';
    ctx.fillRect(-6, -car.width / 2 + 3, 14, car.width - 6);
    ctx.fillStyle = '#dfe6e9';
    ctx.fillRect(car.length / 2 - 10, -car.width / 2 + 3, 4, car.width - 6);
    // Headlights.
    ctx.fillStyle = '#ffeaa7';
    ctx.fillRect(car.length / 2 - 2, -car.width / 2 + 1, 3, 4);
    ctx.fillRect(car.length / 2 - 2, car.width / 2 - 5, 3, 4);
    // Police livery: white doors, light bar, SPD on the roof.
    if (car.police) {
      ctx.fillStyle = '#ecf0f1';
      ctx.fillRect(-8, -car.width / 2, 16, car.width);
      const flash = Math.sin(this.world.time * 12) > 0;
      ctx.fillStyle = flash ? '#e74c3c' : '#0984e3';
      ctx.fillRect(-4, -car.width / 2 - 2, 8, 5);
      ctx.fillStyle = flash ? '#0984e3' : '#e74c3c';
      ctx.fillRect(-4, car.width / 2 - 3, 8, 5);
      ctx.fillStyle = '#2d3436';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SPD', 0, 3);
    }
    if (car.smoking) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(-car.length / 2 + 4, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPeds(ctx, x0, y0, x1, y1) {
    for (const ped of this.world.peds.peds) {
      if (ped.x < x0 || ped.x > x1 || ped.y < y0 || ped.y > y1) continue;
      this.drawWalker(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.skin, ped.walkPhase, ped.knocked > 0);
    }
  }

  drawOfficers(ctx, x0, y0, x1, y1) {
    for (const cop of this.world.police.officers) {
      if (cop.x < x0 || cop.x > x1 || cop.y < y0 || cop.y > y1) continue;
      this.drawWalker(ctx, cop.x, cop.y, cop.angle, '#1a2a4a', '#1a2a4a', '#e0ac69', cop.walkPhase, false, true);
    }
  }

  drawRivals(ctx, x0, y0, x1, y1) {
    for (const rival of this.world.combat.rivals) {
      if (rival.x < x0 || rival.x > x1 || rival.y < y0 || rival.y > y1) continue;
      this.drawWalker(ctx, rival.x, rival.y, rival.angle, '#8e1f1f', '#2d3436', '#c68642', rival.walkPhase, false, false, true);
      // Health bar above a rival.
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(rival.x - 16, rival.y - 24, 32, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(rival.x - 16, rival.y - 24, 32 * clamp(rival.health / 60, 0, 1), 5);
    }
  }

  drawWalker(ctx, x, y, angle, shirt, pants, skin, phase, knocked, isCop, isRival) {
    ctx.save();
    ctx.translate(x, y);
    if (knocked) {
      // Lying flat on the ground.
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const swing = Math.sin(phase) * 4;
    // Legs (two little feet that alternate).
    ctx.fillStyle = pants;
    ctx.beginPath();
    ctx.arc(-Math.sin(angle) * swing * 0.4 - Math.cos(angle) * 2, Math.cos(angle) * swing * 0.4 - Math.sin(angle) * 2, 4, 0, Math.PI * 2);
    ctx.arc(Math.sin(angle) * swing * 0.4 + Math.cos(angle) * 2, -Math.cos(angle) * swing * 0.4 + Math.sin(angle) * 2, 4, 0, Math.PI * 2);
    ctx.fill();
    // Body.
    ctx.rotate(angle);
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(4, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#1a2a4a';
      ctx.fillRect(-2, -6, 8, 12);
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(2, -2, 3, 4);
    }
    if (isRival) {
      // A rival holds a pistol out in front.
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(8, -2, 9, 4);
    }
    ctx.restore();
  }

  drawPlayer(ctx) {
    const player = this.world.player;
    if (player.inCar) return; // the car drawing shows the player
    const hurt = player.hurtFlash > 0;
    this.drawWalker(ctx, player.x, player.y, player.angle, hurt ? '#e74c3c' : '#00b894', '#2d3436', '#f1c27d', this.world.time * 9, false, false, false);
    // A white ring so the player is always findable in a crowd.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Pistol in hand while aiming.
    if (this.world.combat.aiming) {
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      ctx.fillStyle = '#2d3436';
      ctx.fillRect(8, -2, 10, 4);
      ctx.restore();
    }
  }

  drawBullets(ctx) {
    ctx.fillStyle = '#f9ca24';
    for (const b of this.world.combat.bullets) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.fillRect(-5, -1.5, 10, 3);
      ctx.restore();
    }
  }

  drawParticles(ctx) {
    for (const p of this.world.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a + 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
