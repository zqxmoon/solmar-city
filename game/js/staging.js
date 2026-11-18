// Solmar City — screenshot staging: when the page is opened with
// ?shot=<scene>, the game jumps straight into a lively moment of that
// scene so screenshots show the city at its best. Normal play never
// passes ?shot=, so this changes nothing for players.

import { distance } from './util.js';

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
    world.traffic.spawnTraffic(8);
    world.peds.spawnNear(p.x, p.y, 8);
    return true;
  }

  if (scene === 'chase') {
    // The cover shot: a police chase with wanted stars, the minimap,
    // and a mission objective on the HUD.
    const car = world.traffic.cars.find((c) => c.parked) || world.traffic.cars[0];
    world.enterCar(car, true);
    car.x = 1950;
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
