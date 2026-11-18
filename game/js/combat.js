// Solmar City — combat: the player's pistol, rival gang shooters, and
// the bullets that fly between them. On foot only; driving is for
// ramming, not shooting.

import { distance, angleTo, clamp } from './util.js';

export class Bullet {
  constructor(x, y, angle, speed, from, damage) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.from = from; // 'player' | 'rival' | 'cop'
    this.damage = damage;
    this.life = 1.1;
    this.dead = false;
  }

  update(dt, world) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    for (const box of world.city.colliders) {
      if (this.x > box.x && this.x < box.x + box.w && this.y > box.y && this.y < box.y + box.h) {
        this.dead = true;
        world.particles.push({
          x: this.x, y: this.y, vx: 0, vy: 0, life: 0.25, maxLife: 0.25, size: 6, color: '#f1c40f',
        });
        return;
      }
    }
  }
}

// A rival gang member: stands their ground, shoots at the player.
export class Rival {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 12;
    this.health = 60;
    this.angle = 0;
    this.shootTimer = 1 + Math.random();
    this.moveTimer = 0;
    this.targetX = x;
    this.targetY = y;
    this.dead = false;
    this.walkPhase = 0;
  }
}

export class Combat {
  constructor(world) {
    this.world = world;
    this.bullets = [];
    this.rivals = [];
    this.aiming = false; // true while the mouse is over the canvas
    this.shotsFired = 0;
  }

  playerShoot() {
    const world = this.world;
    const player = world.player;
    if (player.inCar || player.shootCooldown > 0 || player.health <= 0) return;
    player.shootCooldown = 0.28;
    const gx = player.x + Math.cos(player.angle) * 20;
    const gy = player.y + Math.sin(player.angle) * 20;
    this.bullets.push(new Bullet(gx, gy, player.angle, 780, 'player', 34));
    this.shotsFired++;
    world.audio.shot();
    world.particles.push({
      x: gx, y: gy, vx: 0, vy: 0, life: 0.12, maxLife: 0.12, size: 14, color: '#f9ca24',
    });
    world.peds.scare(player.x, player.y, 420);
    if (this.shotsFired % 3 === 1) {
      world.police.addWanted(1, 'fired a weapon in public');
    }
  }

  spawnRivals(x, y, count) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      this.rivals.push(new Rival(x + Math.cos(angle) * 130, y + Math.sin(angle) * 130));
    }
  }

  rivalsLeft() {
    return this.rivals.filter((r) => !r.dead).length;
  }

  clearRivals() {
    this.rivals = [];
    this.bullets = [];
  }

  update(dt) {
    const world = this.world;
    const player = world.player;

    // Player shooting: hold mouse or Space, aimed with the mouse.
    this.aiming = world.input.mouseDown || world.input.down(' ');
    if (this.aiming && (world.input.mouseDown || world.input.down(' '))) {
      this.playerShoot();
    }

    // Rival AI: strafe a little, shoot at the player when close.
    for (const rival of this.rivals) {
      if (rival.dead) continue;
      const d = distance(rival.x, rival.y, player.x, player.y);
      rival.walkPhase += dt * 7;
      rival.angle = angleTo(rival.x, rival.y, player.x, player.y);
      rival.moveTimer -= dt;
      if (rival.moveTimer <= 0) {
        rival.moveTimer = 1.2 + Math.random() * 1.5;
        rival.targetX = rival.x + (Math.random() - 0.5) * 160;
        rival.targetY = rival.y + (Math.random() - 0.5) * 160;
      }
      if (d > 90 && d < 520) {
        rival.x += Math.cos(angleTo(rival.x, rival.y, rival.targetX, rival.targetY)) * 55 * dt;
        rival.y += Math.sin(angleTo(rival.x, rival.y, rival.targetX, rival.targetY)) * 55 * dt;
      }
      rival.shootTimer -= dt;
      if (d < 560 && rival.shootTimer <= 0 && player.health > 0) {
        rival.shootTimer = 1.1 + Math.random() * 0.9;
        const spread = (Math.random() - 0.5) * 0.22;
        this.bullets.push(new Bullet(
          rival.x + Math.cos(rival.angle) * 18, rival.y + Math.sin(rival.angle) * 18,
          rival.angle + spread, 620, 'rival', 9,
        ));
        world.audio.enemyShot();
      }
    }

    // Bullets: move, hit buildings, rivals, cops, the player.
    for (const bullet of this.bullets) {
      bullet.update(dt, world);
      if (bullet.dead) continue;
      if (bullet.from === 'player') {
        for (const rival of this.rivals) {
          if (!rival.dead && distance(bullet.x, bullet.y, rival.x, rival.y) < rival.r + 6) {
            rival.health -= bullet.damage;
            bullet.dead = true;
            world.particles.push({
              x: bullet.x, y: bullet.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, size: 9, color: '#e74c3c',
            });
            if (rival.health <= 0) {
              rival.dead = true;
              world.message('Rival down!', '#f1c40f');
              world.audio.pickup();
            }
            break;
          }
        }
        if (bullet.dead) continue;
        for (const cop of world.police.officers) {
          if (distance(bullet.x, bullet.y, cop.x, cop.y) < cop.r + 6) {
            bullet.dead = true;
            world.police.officers.splice(world.police.officers.indexOf(cop), 1);
            world.police.addWanted(2, 'shot an officer');
            world.message('Officer down — the whole PD is coming!', '#ff7675');
            break;
          }
        }
        if (bullet.dead) continue;
        for (const ped of world.peds.peds) {
          if (ped.knocked <= 0 && distance(bullet.x, bullet.y, ped.x, ped.y) < ped.r + 5) {
            ped.knocked = 3;
            bullet.dead = true;
            world.police.addWanted(1, 'shot a bystander');
            world.peds.scare(ped.x, ped.y, 380);
            break;
          }
        }
      } else {
        // Enemy bullets only hurt the player (on foot or in a car).
        if (player.health > 0 && distance(bullet.x, bullet.y, player.x, player.y) < player.r + 6) {
          bullet.dead = true;
          player.damage(bullet.damage, world);
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.rivals = this.rivals.filter((r) => !r.dead);
  }
}
