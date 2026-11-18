// Solmar City — the city itself: road grid, blocks, buildings, parks,
// the beach and the marina. Generated once per seed; every system reads
// the same structure (roads for traffic, colliders for physics, zones
// for missions and the minimap).

import { makeRng, pick, range, rangeInt } from './util.js';

export const WORLD_W = 3600;
export const WORLD_H = 2500;
export const ROAD_W = 96;

// Vertical and horizontal road centre lines.
export const AVENUES = [300, 850, 1400, 1950, 2500, 3050];
export const STREETS = [300, 750, 1200, 1650, 2100];

const BUILDING_PALETTES = [
  ['#e8b48a', '#d99a68', '#c98a5e'],
  ['#9db8c9', '#7fa3b8', '#6b93a8'],
  ['#c9a3a3', '#b58a8a', '#a87a7a'],
  ['#b5c49a', '#9db384', '#8aa372'],
  ['#d9c48f', '#c9b078', '#b89e66'],
  ['#a89ec9', '#9387b8', '#8378a8'],
];

const NEON_SIGNS = ['HOTEL', 'CASINO', 'DINER', 'BAR', 'MOTEL', 'CLUB', 'PIER', 'MART'];

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const parks = [];
  const colliders = [];
  const trees = [];
  const cashSpots = [];
  const parkedSpots = [];

  // Blocks sit between neighbouring roads; the outer rim is the city edge.
  const xs = [0, ...AVENUES, WORLD_W];
  const ys = [0, ...STREETS, WORLD_H];

  let blockId = 0;
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const bx = xs[bi] + (bi === 0 ? 40 : ROAD_W / 2 + 14);
      const by = ys[bj] + (bj === 0 ? 40 : ROAD_W / 2 + 14);
      let bw = xs[bi + 1] - (bi === xs.length - 2 ? 40 : ROAD_W / 2 + 14) - bx;
      const bh = ys[bj + 1] - (bj === ys.length - 2 ? 40 : ROAD_W / 2 + 14) - by;
      if (bw < 120 || bh < 120) continue;
      blockId++;

      // The eastern strip is the beach, not a city block.
      if (bx > 3250) continue;
      // Keep the last city block clear of the sand.
      const blockRight = Math.min(bx + bw, 3300);
      const blockW = blockRight - bx;
      if (blockW < 120) continue;
      bw = blockW;

      const roll = rng();
      if (roll < 0.14) {
        // Park block: grass, trees, benches, no buildings.
        const park = { x: bx, y: by, w: bw, h: bh, id: blockId };
        parks.push(park);
        const treeCount = rangeInt(rng, 6, 11);
        for (let t = 0; t < treeCount; t++) {
          trees.push({
            x: range(rng, bx + 30, bx + bw - 30),
            y: range(rng, by + 30, by + bh - 30),
            r: range(rng, 10, 16),
          });
        }
        continue;
      }
      if (roll < 0.2) {
        // Open plaza with a fountain in the middle.
        parks.push({ x: bx, y: by, w: bw, h: bh, id: blockId, plaza: true });
        continue;
      }

      // Built block: 1-4 buildings with alleys between them.
      const palette = pick(BUILDING_PALETTES, rng);
      const cols = bw > 380 ? 2 : 1;
      const rows = bh > 300 ? 2 : 1;
      const cellW = bw / cols;
      const cellH = bh / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.12) continue; // empty lot
          const pad = 12;
          const b = {
            x: bx + c * cellW + pad,
            y: by + r * cellH + pad,
            w: cellW - pad * 2,
            h: cellH - pad * 2,
            color: pick(palette, rng),
            roof: pick(['#5a4a3a', '#3f4a55', '#6b5a4a', '#44503f'], rng),
            floors: rangeInt(rng, 1, 4),
            sign: rng() < 0.3 ? pick(NEON_SIGNS, rng) : null,
            id: blockId * 10 + c * 2 + r,
          };
          buildings.push(b);
          colliders.push(b);
        }
      }
    }
  }

  // Beach: sand strip on the east edge, then the sea.
  const beach = { x: 3300, y: 0, w: 300, h: WORLD_H };
  const sea = { x: 3520, y: 0, w: 80, h: WORLD_H };
  // Palm trees along the boardwalk.
  for (let y = 120; y < WORLD_H - 100; y += 170) {
    trees.push({ x: 3335 + rng() * 60, y, r: 12, palm: true });
  }

  // Cash bundles hidden around the city: sidewalks, parks, the beach.
  const cashPlaces = [];
  for (let i = 0; i < 26; i++) {
    const avenue = pick(AVENUES, rng);
    const street = pick(STREETS, rng);
    const side = rng() < 0.5;
    cashPlaces.push({
      x: side ? avenue + range(rng, -70, 70) : range(rng, 150, WORLD_W - 250),
      y: side ? range(rng, 150, WORLD_H - 150) : street + range(rng, -70, 70),
    });
  }
  cashPlaces.forEach((p, i) => {
    cashSpots.push({ id: 'cash' + i, x: p.x, y: p.y, taken: false, amount: 50 });
  });
  // Never leave a cash bundle inside a building where nobody can reach it.
  for (const spot of cashSpots) {
    for (const box of colliders) {
      if (spot.x > box.x && spot.x < box.x + box.w && spot.y > box.y && spot.y < box.y + box.h) {
        spot.x = box.x - 24;
        spot.y = box.y + box.h / 2;
      }
    }
  }
  // A few on the beach.
  for (let i = 0; i < 4; i++) {
    cashSpots.push({
      id: 'beach' + i,
      x: range(rng, 3340, 3480),
      y: range(rng, 200, WORLD_H - 200),
      taken: false,
      amount: 75,
    });
  }

  // Parked cars line the avenues, just off the driving lane.
  for (const avenue of AVENUES) {
    for (const street of STREETS) {
      if (rng() < 0.45) {
        parkedSpots.push({
          x: avenue + (rng() < 0.5 ? -ROAD_W / 2 + 16 : ROAD_W / 2 - 16),
          y: street + range(rng, -160, 160),
          angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2, // parallel to the avenue
          vertical: true,
        });
      }
    }
  }

  // Named places the story and the HUD refer to.
  const places = {
    garage: { x: 1400, y: 1200, name: "Ray's Garage" },
    marina: { x: 1950, y: 2250, name: 'Marina Pickup' },
    northDrop: { x: 1950, y: 180, name: 'Northside Drop' },
    boardwalk: { x: 3420, y: 1200, name: 'Boardwalk' },
    safehouse: { x: 850, y: 750, name: 'Safehouse' },
    hospital: { x: 850, y: 300, name: 'Solmar General' },
    pier: { x: 3400, y: 2100, name: 'Sunset Pier' },
  };

  return {
    seed,
    buildings,
    parks,
    trees,
    colliders,
    cashSpots,
    parkedSpots,
    beach,
    sea,
    places,
    spawn: { x: 850, y: 700, angle: -Math.PI / 2 },
  };
}

// Is a point on a road (drivable surface)?
export function onRoad(city, x, y) {
  for (const a of AVENUES) if (Math.abs(x - a) < ROAD_W / 2) return true;
  for (const s of STREETS) if (Math.abs(y - s) < ROAD_W / 2) return true;
  return false;
}

// Nearest road centre line, used by traffic cars to snap to a lane.
export function nearestAvenue(x) {
  let best = AVENUES[0];
  for (const a of AVENUES) if (Math.abs(x - a) < Math.abs(x - best)) best = a;
  return best;
}

export function nearestStreet(y) {
  let best = STREETS[0];
  for (const s of STREETS) if (Math.abs(y - s) < Math.abs(y - best)) best = s;
  return best;
}
