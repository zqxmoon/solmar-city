// Solmar City — the player on foot: movement, health, cash, and the
// car they are currently driving (null when on foot).

import { clamp, pushCircleOutOfBox } from './util.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 13;
    this.angle = -Math.PI / 2; // facing
    this.health = 100;
    this.maxHealth = 100;
    this.cash = 120; // starting pocket money
    this.car = null; // the Car being driven, or null
    this.speed = 0;
    this.moving = false;
    this.hurtFlash = 0;
    this.shootCooldown = 0;
    this.name = 'Dana Reyes';
  }

  get inCar() {
    return this.car !== null;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.health = this.maxHealth;
    this.car = null;
    this.hurtFlash = 0;
  }

  damage(amount, world) {
    if (this.health <= 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtFlash = 0.35;
    world.audio.hit();
    if (this.health <= 0) world.wasted();
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  update(dt, world) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.inCar) {
      // Position follows the driven car.
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
      return;
    }
    const input = world.input;
    let mx = 0;
    let my = 0;
    if (input.down('w', 'arrowup')) my -= 1;
    if (input.down('s', 'arrowdown')) my += 1;
    if (input.down('a', 'arrowleft')) mx -= 1;
    if (input.down('d', 'arrowright')) mx += 1;
    this.moving = mx !== 0 || my !== 0;
    if (this.moving) {
      const len = Math.hypot(mx, my);
      const run = input.down('shift') ? 1.55 : 1;
      const speed = 175 * run;
      this.x += (mx / len) * speed * dt;
      this.y += (my / len) * speed * dt;
      this.angle = Math.atan2(my, mx);
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    // Aim with the mouse when the player wants to shoot.
    if (world.combat && world.combat.aiming) {
      const cam = world.camera;
      const wx = world.input.mouseX + cam.x;
      const wy = world.input.mouseY + cam.y;
      this.angle = Math.atan2(wy - this.y, wx - this.x);
    }
    // Collide with buildings and stay inside the world.
    for (const box of world.city.colliders) {
      pushCircleOutOfBox(this, box);
    }
    this.x = clamp(this.x, 20, world.cityWidth - 20);
    this.y = clamp(this.y, 20, world.cityHeight - 20);
  }
}
