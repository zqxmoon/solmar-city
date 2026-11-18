// Solmar City — cars: the player's ride, parked cars to steal, and
// the traffic that fills the avenues. Arcade physics: accelerate,
// brake, steer, drift a little, bump into things.

import { clamp, angleDelta, distance, pick, range } from './util.js';
import { AVENUES, STREETS, onRoad, nearestAvenue, nearestStreet } from './city.js';

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22',
  '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d', '#c2185b',
];

export const CAR_MODELS = [
  { name: 'Solmar Comet', topSpeed: 430, accel: 300, grip: 2.6 },
  { name: 'Bayview Sedan', topSpeed: 360, accel: 250, grip: 2.2 },
  { name: 'Palmetto Pickup', topSpeed: 330, accel: 230, grip: 2.0 },
  { name: 'Neon Coupe', topSpeed: 470, accel: 330, grip: 2.9 },
  { name: 'Harbor Van', topSpeed: 300, accel: 200, grip: 1.8 },
];

export class Car {
  constructor(x, y, angle, model, color, opts) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.model = model;
    this.color = color;
    this.speed = 0; // signed, px/s along facing
    this.length = 46;
    this.width = 22;
    this.parked = !!(opts && opts.parked);
    this.traffic = !!(opts && opts.traffic);
    this.police = !!(opts && opts.police);
    this.driver = null; // 'player' | 'traffic' | 'police' | null
    this.health = 100;
    this.smoking = false;
    // Traffic AI state.
    this.route = null;
    this.targetX = x;
    this.targetY = y;
    this.wait = 0;
  }

  get moving() {
    return Math.abs(this.speed) > 5;
  }

  // Arcade drive step: throttle -1..1, steer -1..1.
  drive(dt, throttle, steer, world) {
    const top = this.model.topSpeed;
    this.speed += throttle * this.model.accel * dt;
    if (throttle === 0) this.speed -= this.speed * 1.2 * dt;
    this.speed -= this.speed * 0.25 * dt; // rolling drag
    this.speed = clamp(this.speed, -top * 0.45, top);
    const steerAmount = steer * this.model.grip * dt * clamp(Math.abs(this.speed) / 120, 0, 1);
    this.angle += (this.speed >= 0 ? steerAmount : -steerAmount) * Math.sign(this.speed || 1);
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    this.x = nx;
    this.y = ny;
    this.collideBuildings(world);
    this.x = clamp(this.x, 30, world.cityWidth - 30);
    this.y = clamp(this.y, 30, world.cityHeight - 30);
    if (Math.abs(this.speed) > top * 0.75 && Math.random() < dt * 6) {
      world.particles.push({
        x: this.x - Math.cos(this.angle) * 20, y: this.y - Math.sin(this.angle) * 20,
        vx: 0, vy: 0, life: 0.4, maxLife: 0.4, size: 7, color: 'rgba(200,200,200,0.5)',
      });
    }
    if (this.health < 35 && !this.smoking) {
      this.smoking = true;
    }
    if (this.smoking && Math.random() < dt * 8) {
      world.particles.push({
        x: this.x + (Math.random() - 0.5) * 20, y: this.y + (Math.random() - 0.5) * 12,
        vx: (Math.random() - 0.5) * 20, vy: -30, life: 0.9, maxLife: 0.9, size: 9, color: 'rgba(90,90,90,0.55)',
      });
    }
  }

  collideBuildings(world) {
    const halfL = this.length / 2;
    const halfW = this.width / 2;
    for (const box of world.city.colliders) {
      // Treat the car as a circle at its centre for a cheap, stable test.
      const cx = clamp(this.x, box.x, box.x + box.w);
      const cy = clamp(this.y, box.y, box.y + box.h);
      const dx = this.x - cx;
      const dy = this.y - cy;
      const d2 = dx * dx + dy * dy;
      const r = halfL * 0.8;
      if (d2 < r * r) {
        // Bounce back and lose speed.
        this.x -= Math.cos(this.angle) * this.speed * 0.05;
        this.y -= Math.sin(this.angle) * this.speed * 0.05;
        if (Math.abs(this.speed) > 120) {
          world.audio.crash();
          this.health = Math.max(0, this.health - 8);
          world.particles.push({
            x: this.x, y: this.y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 12, color: '#f39c12',
          });
        }
        this.speed *= -0.25;
      }
    }
    void halfW;
  }
}

export class TrafficManager {
  constructor(world) {
    this.world = world;
    this.cars = [];
  }

  spawnParked() {
    const rng = this.world.rng;
    for (const spot of this.world.city.parkedSpots) {
      const model = pick(CAR_MODELS, rng);
      const car = new Car(spot.x, spot.y, spot.angle, model, pick(CAR_COLORS, rng), { parked: true });
      this.cars.push(car);
    }
  }

  spawnTraffic(count) {
    const rng = this.world.rng;
    for (let i = 0; i < count; i++) {
      const vertical = rng() < 0.5;
      let x, y, angle;
      if (vertical) {
        const avenue = pick(AVENUES, rng);
        x = avenue + (rng() < 0.5 ? -24 : 24);
        y = range(rng, 100, this.world.cityHeight - 100);
        angle = x < avenue ? -Math.PI / 2 : Math.PI / 2;
      } else {
        const street = pick(STREETS, rng);
        y = street + (rng() < 0.5 ? -24 : 24);
        x = range(rng, 100, this.world.cityWidth - 100);
        angle = y < street ? 0 : Math.PI;
      }
      const car = new Car(x, y, angle, pick(CAR_MODELS, rng), pick(CAR_COLORS, rng), { traffic: true });
      car.driver = 'traffic';
      car.speed = range(rng, 90, 150);
      this.pickRoute(car);
      this.cars.push(car);
    }
  }

  // Give a traffic car its next intersection to drive to: usually the
  // next cross street ahead, sometimes a turn onto the cross road.
  pickRoute(car) {
    const rng = this.world.rng;
    const vertical = Math.abs(Math.sin(car.angle)) > 0.7;
    const turn = rng() < 0.3;
    if (vertical && !turn) {
      // Keep going down this avenue to the next street ahead.
      const ahead = STREETS.filter((s) => (car.angle > 0 ? s > car.y + 30 : s < car.y - 30));
      const street = ahead.length ? pick(ahead, rng) : pick(STREETS, rng);
      car.targetX = car.x;
      car.targetY = street;
      car.route = 'avenue';
    } else if (!vertical && !turn) {
      const ahead = AVENUES.filter((a) => (Math.cos(car.angle) > 0 ? a > car.x + 30 : a < car.x - 30));
      const avenue = ahead.length ? pick(ahead, rng) : pick(AVENUES, rng);
      car.targetX = avenue;
      car.targetY = car.y;
      car.route = 'street';
    } else {
      // Turn: aim for the nearest intersection, then the cross road.
      const avenue = nearestAvenue(car.x);
      const street = nearestStreet(car.y);
      car.targetX = avenue;
      car.targetY = street;
      car.route = 'turn';
    }
  }

  update(dt) {
    const world = this.world;
    const player = world.player;
    for (const car of this.cars) {
      if (!car.traffic || car.driver !== 'traffic') continue;
      const distToTarget = distance(car.x, car.y, car.targetX, car.targetY);
      if (distToTarget < 40 || car.wait > 0) {
        if (car.wait <= 0) {
          car.wait = 0.4 + Math.random() * 1.2;
          this.pickRoute(car);
        }
        car.wait -= dt;
        car.speed = Math.max(0, car.speed - 300 * dt);
        continue;
      }
      // Steer gently towards the target point.
      const want = Math.atan2(car.targetY - car.y, car.targetX - car.x);
      const turn = clamp(angleDelta(car.angle, want), -1, 1);
      car.angle += turn * 1.6 * dt;
      const targetSpeed = 130;
      car.speed += (targetSpeed - car.speed) * dt * 0.8;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Keep traffic on the roads: nudge back if it drifted off.
      if (!onRoad(world.city, car.x, car.y)) {
        car.angle += angleDelta(car.angle, want) * 0.5;
      }
    }
    // Despawn far-away traffic and keep the streets busy near the player.
    const near = this.cars.filter((c) => c.traffic && distance(c.x, c.y, player.x, player.y) < 1400).length;
    if (near < 7 && Math.random() < dt * 0.5) {
      this.spawnTraffic(1);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.traffic && distance(car.x, car.y, player.x, player.y) > 2200) {
        this.cars.splice(i, 1);
      }
    }
  }

  // The closest stealable car to a point (parked or slow traffic).
  nearestStealable(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.police || car.driver === 'player') continue;
      const d = distance(x, y, car.x, car.y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  // All cars the renderer and collisions need, police included.
  allCars() {
    return this.cars.concat(this.world.police.cars);
  }
}
