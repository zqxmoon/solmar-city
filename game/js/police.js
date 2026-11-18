// Solmar City — the wanted system: stars for crimes, Solmar PD cars
// that chase and ram, and foot officers who try to bring the player in.

import { clamp, distance, angleTo, angleDelta, pick } from './util.js';
import { Car } from './vehicles.js';

const COP_MODEL = { name: 'Solmar PD Interceptor', topSpeed: 460, accel: 330, grip: 3.0 };

export class PoliceManager {
  constructor(world) {
    this.world = world;
    this.cars = []; // police Car objects
    this.officers = []; // foot cops {x, y, r, angle, grabTimer}
    this.wanted = 0; // 0..5 stars
    this.crimeTimer = 0; // time since the last crime
    this.calmTimer = 0; // time with no cop in sight
    this.lastCrime = '';
    this.spawnTimer = 0;
  }

  addWanted(stars, crime) {
    if (this.wanted >= 5) return;
    this.wanted = clamp(this.wanted + stars, 0, 5);
    this.crimeTimer = 0;
    this.lastCrime = crime;
    if (this.wanted > 0) {
      this.world.message('WANTED: ' + crime, '#ff7675');
      this.world.audio.setSiren(true);
    }
  }

  setWanted(level, crime) {
    this.wanted = clamp(level, 0, 5);
    this.crimeTimer = 0;
    if (crime) this.lastCrime = crime;
    this.world.audio.setSiren(this.wanted > 0);
  }

  clearWanted() {
    this.wanted = 0;
    this.cars = [];
    this.officers = [];
    this.world.audio.setSiren(false);
  }

  spawnCopCar() {
    const world = this.world;
    const p = world.player;
    // Appear on a road a little way off, so the chase feels fair.
    const angle = Math.random() * Math.PI * 2;
    const dist = 700 + Math.random() * 300;
    let x = clamp(p.x + Math.cos(angle) * dist, 80, world.cityWidth - 80);
    let y = clamp(p.y + Math.sin(angle) * dist, 80, world.cityHeight - 80);
    const car = new Car(x, y, angleTo(x, y, p.x, p.y), COP_MODEL, '#2c3e50', { police: true });
    car.driver = 'police';
    car.speed = 200;
    this.cars.push(car);
  }

  spawnOfficer() {
    const world = this.world;
    const p = world.player;
    const angle = Math.random() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(angle) * 500, 60, world.cityWidth - 60);
    const y = clamp(p.y + Math.sin(angle) * 500, 60, world.cityHeight - 60);
    this.officers.push({ x, y, r: 12, angle: 0, grabTimer: 0, walkPhase: 0 });
  }

  update(dt) {
    const world = this.world;
    const player = world.player;
    this.crimeTimer += dt;

    // Wanted slowly cools off when the player stays clean and unseen.
    if (this.wanted > 0 && this.crimeTimer > 18) {
      const nearestCop = this.nearestCopDistance();
      if (nearestCop > 550) {
        this.calmTimer += dt;
        if (this.calmTimer > 7) {
          this.wanted -= 1;
          this.calmTimer = 0;
          this.crimeTimer = 0;
          world.message('Heat dying down… ' + this.wanted + ' star' + (this.wanted === 1 ? '' : 's') + ' left', '#74b9ff');
          if (this.wanted === 0) world.audio.setSiren(false);
        }
      } else {
        this.calmTimer = 0;
      }
    }

    // Keep pressure proportional to the wanted level.
    const wantCars = this.wanted >= 3 ? 3 : this.wanted >= 1 ? 2 : 0;
    const wantOfficers = player.inCar ? 0 : this.wanted >= 2 ? 3 : this.wanted === 1 ? 1 : 0;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 2.5;
      if (this.cars.length < wantCars && this.wanted > 0) this.spawnCopCar();
      if (this.officers.length < wantOfficers && this.wanted > 0) this.spawnOfficer();
    }

    // Cop cars: pursue and ram.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (this.wanted === 0) {
        this.cars.splice(i, 1);
        continue;
      }
      const want = angleTo(car.x, car.y, player.x, player.y);
      const turn = clamp(angleDelta(car.angle, want), -1, 1);
      const targetSpeed = 400 + this.wanted * 18;
      car.speed += (targetSpeed - car.speed) * dt * 0.7;
      car.angle += turn * 2.4 * dt * clamp(Math.abs(car.speed) / 150, 0, 1);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.collideBuildings(world);
      // Ram the player's car, or the player on foot.
      if (distance(car.x, car.y, player.x, player.y) < 42) {
        if (player.inCar) {
          player.car.health = Math.max(0, player.car.health - 14 * dt * 4);
          player.car.speed *= 0.96;
          if (Math.random() < dt * 4) world.audio.crash();
          if (player.car.health <= 0) {
            world.message('Your car is wrecked!', '#ff7675');
            world.exitCar(true);
          }
        } else {
          player.damage(22 * dt, world);
        }
      }
      if (distance(car.x, car.y, player.x, player.y) > 2400) this.cars.splice(i, 1);
    }

    // Foot officers: run the player down and grab them.
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const cop = this.officers[i];
      if (this.wanted === 0 || player.inCar) {
        this.officers.splice(i, 1);
        continue;
      }
      cop.walkPhase += dt * 9;
      const d = distance(cop.x, cop.y, player.x, player.y);
      cop.angle = angleTo(cop.x, cop.y, player.x, player.y);
      const speed = 195;
      cop.x += Math.cos(cop.angle) * speed * dt;
      cop.y += Math.sin(cop.angle) * speed * dt;
      if (d < 26) {
        cop.grabTimer += dt;
        player.damage(14 * dt, world);
        if (cop.grabTimer > 1.4) {
          world.busted();
          return;
        }
      } else {
        cop.grabTimer = Math.max(0, cop.grabTimer - dt * 2);
      }
      if (d > 2200) this.officers.splice(i, 1);
    }
  }

  nearestCopDistance() {
    const p = this.world.player;
    let best = Infinity;
    for (const car of this.cars) best = Math.min(best, distance(car.x, car.y, p.x, p.y));
    for (const cop of this.officers) best = Math.min(best, distance(cop.x, cop.y, p.x, p.y));
    return best;
  }
}
