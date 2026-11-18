// Solmar City — screenshot staging: when the page is opened with
// ?shot=<scene>, the game jumps straight into a lively moment of that
// scene so screenshots show the city at its best. Normal play never
// passes ?shot=, so this changes nothing for players.

import { distance } from './util.js';
import { Car, CAR_MODELS, CAR_COLORS } from './vehicles.js';

// Drop a few traffic cars on the same road near a point, so a staged
// driving shot shows a busy street instead of an empty one.
function stageTrafficNear(world, x, y, angle, count) {
  for (let i = 0; i < count; i++) {
    const ahead = 260 + i * 170;
    const lane = (i % 2 === 0 ? -24 : 24);
    const cx = x + Math.cos(angle) * ahead - Math.sin(angle) * lane;
    const cy = y + Math.sin(angle) * ahead + Math.cos(angle) * lane;
    const model = CAR_MODELS[i % CAR_MODELS.length];
    const color = CAR_COLORS[(i * 3 + 1) % CAR_COLORS.length];
    const car = new Car(cx, cy, angle, model, color, { traffic: true });
    car.driver = 'traffic';
    car.speed = 120 + i * 12;
    world.traffic.cars.push(car);
    world.traffic.pickRoute(car);
  }
}

// Each scene sets up the world, then returns true when the game should
// start already playing (no title screen) for that shot.
export function applyShotScene(world, scene) {
  const p = world.player;
  const places = world.city.places;

  if (scene === 'start') {
    // Title screen: keep the menu, camera over downtown.
    world.state = 'title';
    p.x = 1400;
    p.y = 1200;
    return false;
  }

  world.state = 'playing';
  if (scene === 'street') {
    // On foot downtown, traffic and pedestrians all around.
    p.x = 1400;
    p.y = 1150;
    p.angle = 0;
    world.traffic.spawnTraffic(10);
    world.peds.spawnNear(p.x, p.y, 14);
    return true;
  }

  if (scene === 'drive') {
    // Behind the wheel, cruising an avenue.
    const car = world.traffic.cars.find((c) => c.parked) || world.traffic.cars[0];
    world.enterCar(car, true);
    car.x = 850;
    car.y = 500;
    car.angle = Math.PI / 2;
    car.speed = 300;
    stageTrafficNear(world, 850, 500, Math.PI / 2, 4);
    world.traffic.spawnTraffic(8);
    world.peds.spawnNear(p.x, p.y, 8);
    return true;
  }

  if (scene === 'chase') {
    // The cover shot: a police chase with wanted stars, the minimap,
    // and a mission objective on the HUD.
    const car = world.traffic.cars.find((c) => c.parked) || world.traffic.cars[0];
    world.enterCar(car, true);
    car.x = 2100;
    car.y = 1200;
    car.angle = Math.PI;
    car.speed = 380;
    world.police.setWanted(3, 'stolen car, evading police');
    world.police.spawnCopCar();
    world.police.spawnCopCar();
    world.police.cars.forEach((cop, i) => {
      cop.x = car.x + 260 + i * 90;
      cop.y = car.y - 40 + i * 80;
      cop.angle = Math.PI;
      cop.speed = 380;
    });
    world.traffic.spawnTraffic(8);
    stageTrafficNear(world, car.x, car.y, Math.PI, 3);
    world.peds.spawnNear(p.x, p.y, 8);
    world.missions.index = 0;
    world.missions.active = true;
    world.missions.stage = 1;
    world.missions.refreshMarker();
    return true;
  }

  if (scene === 'mission') {
    // The boardwalk fight: rivals shooting, player on foot aiming.
    p.x = places.boardwalk.x - 220;
    p.y = places.boardwalk.y;
    p.angle = 0;
    world.missions.index = 2;
    world.missions.active = true;
    world.missions.stage = 0;
    world.missions.rivalsSpawned = false;
    world.missions.refreshMarker();
    world.traffic.spawnTraffic(4);
    world.peds.spawnNear(p.x, p.y, 6);
    return true;
  }

  return false;
}

// For a staged chase, keep the police glued near the player so the
// screenshot always catches the pursuit.
export function keepChaseStaged(world) {
  const p = world.player;
  for (const cop of world.police.cars) {
    if (distance(cop.x, cop.y, p.x, p.y) > 600) {
      cop.x = p.x + 300;
      cop.y = p.y - 60;
      cop.speed = 380;
    }
  }
}
