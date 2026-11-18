// Solmar City — pedestrians: sunny-street walkers who stroll the
// sidewalks, cross at intersections, and run away from gunfire and
// speeding cars.

import { clamp, distance, pick, range, angleTo } from './util.js';
import { AVENUES, STREETS, ROAD_W } from './city.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f39c12', '#2ecc71', '#9b59b6', '#1abc9c', '#fd79a8', '#636e72'];
const PANTS = ['#2c3e50', '#636e72', '#6c5ce7', '#2d3436', '#b2bec3'];

export class Pedestrian {
  constructor(x, y, rng) {
    this.x = x;
    this.y = y;
    this.r = 11;
    this.angle = rng() * Math.PI * 2;
    this.shirt = pick(SHIRTS, rng);
    this.pants = pick(PANTS, rng);
    this.skin = pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'], rng);
    this.speed = range(rng, 45, 75);
    this.fleeing = false;
    this.fleeTimer = 0;
    this.targetX = x;
    this.targetY = y;
    this.wait = 0;
    this.walkPhase = rng() * 10;
    this.knocked = 0; // seconds spent on the ground after a car hit
  }

  // Pick a new sidewalk waypoint near the current position.
  pickStroll(rng, world) {
    const vertical = rng() < 0.5;
    if (vertical) {
      const avenue = pick(AVENUES, rng);
      this.targetX = avenue + (rng() < 0.5 ? -ROAD_W / 2 - 12 : ROAD_W / 2 + 12);
      this.targetY = clamp(this.y + range(rng, -350, 350), 60, world.cityHeight - 60);
    } else {
      const street = pick(STREETS, rng);
      this.targetY = street + (rng() < 0.5 ? -ROAD_W / 2 - 12 : ROAD_W / 2 + 12);
      this.targetX = clamp(this.x + range(rng, -350, 350), 60, world.cityWidth - 60);
    }
  }
}

export class PedestrianManager {
  constructor(world) {
    this.world = world;
    this.peds = [];
  }

  spawn(count) {
    const rng = this.world.rng;
    for (let i = 0; i < count; i++) {
      const ped = new Pedestrian(range(rng, 120, this.world.cityWidth - 120), range(rng, 120, this.world.cityHeight - 120), rng);
      ped.pickStroll(rng, this.world);
      this.peds.push(ped);
    }
  }

  spawnNear(x, y, count) {
    const rng = this.world.rng;
    for (let i = 0; i < count; i++) {
      const ped = new Pedestrian(x + range(rng, -260, 260), y + range(rng, -260, 260), rng);
      ped.pickStroll(rng, this.world);
      this.peds.push(ped);
    }
  }

  // Everyone within earshot runs from a scare point (gunshot, crash).
  scare(x, y, radius) {
    for (const ped of this.peds) {
      if (distance(ped.x, ped.y, x, y) < radius) {
        ped.fleeing = true;
        ped.fleeTimer = 2.5 + Math.random() * 2;
        ped.targetX = ped.x + (ped.x - x);
        ped.targetY = ped.y + (ped.y - y);
      }
    }
  }

  update(dt) {
    const world = this.world;
    const player = world.player;
    for (const ped of this.peds) {
      if (ped.knocked > 0) {
        ped.knocked -= dt;
        continue;
      }
      ped.walkPhase += dt * 8;
      ped.fleeTimer = Math.max(0, ped.fleeTimer - dt);
      if (ped.fleeTimer <= 0) ped.fleeing = false;
      const speed = ped.fleeing ? ped.speed * 2.6 : ped.speed;
      const d = distance(ped.x, ped.y, ped.targetX, ped.targetY);
      if (d < 24) {
        if (ped.wait > 0) {
          ped.wait -= dt;
          continue;
        }
        if (Math.random() < 0.3) ped.wait = 1 + Math.random() * 3;
        ped.pickStroll(world.rng, world);
        continue;
      }
      ped.angle = angleTo(ped.x, ped.y, ped.targetX, ped.targetY);
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      ped.x = clamp(ped.x, 40, world.cityWidth - 40);
      ped.y = clamp(ped.y, 40, world.cityHeight - 40);
      // A fast car hitting a pedestrian knocks them down: a crime.
      for (const car of world.traffic.allCars()) {
        if (car.driver === 'player' && Math.abs(car.speed) > 60) {
          if (distance(ped.x, ped.y, car.x, car.y) < 26) {
            ped.knocked = 2.5;
            ped.x += Math.cos(car.angle) * 40;
            ped.y += Math.sin(car.angle) * 40;
            world.police.addWanted(1, 'hit a pedestrian');
            world.audio.hit();
            this.scare(ped.x, ped.y, 320);
          }
        }
      }
      void player;
    }
    // Keep the crowd dense near the player, thin far away.
    const near = this.peds.filter((p) => distance(p.x, p.y, player.x, player.y) < 1200).length;
    if (near < 12 && Math.random() < dt * 0.8) {
      this.spawnNear(player.x + (Math.random() < 0.5 ? -700 : 700), player.y + (Math.random() < 0.5 ? -500 : 500), 2);
    }
    for (let i = this.peds.length - 1; i >= 0; i--) {
      if (distance(this.peds[i].x, this.peds[i].y, player.x, player.y) > 2000) {
        this.peds.splice(i, 1);
      }
    }
  }
}
