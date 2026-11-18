// Solmar City — small math and random helpers shared by every system.
// Written for this game; nothing here is borrowed from any other project.

export function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Shortest signed turn from angle a towards angle b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

// Deterministic seeded generator (mulberry32) so the city and the
// screenshot scenes are identical on every load for a given seed.
export function makeRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, low, high) {
  return low + rng() * (high - low);
}

export function rangeInt(rng, low, high) {
  return low + Math.floor(rng() * (high - low + 1));
}

// Axis-aligned box overlap test, used for buildings, cars and pickups.
export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleHitsBox(cx, cy, r, box) {
  const nx = clamp(cx, box.x, box.x + box.w);
  const ny = clamp(cy, box.y, box.y + box.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// Push a circle out of a solid box; returns true when a collision happened.
export function pushCircleOutOfBox(circle, box) {
  const nx = clamp(circle.x, box.x, box.x + box.w);
  const ny = clamp(circle.y, box.y, box.y + box.h);
  let dx = circle.x - nx;
  let dy = circle.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= circle.r * circle.r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    const push = circle.r - d;
    circle.x += (dx / d) * push;
    circle.y += (dy / d) * push;
  } else {
    // Centre is inside the box: shove it out along the shallowest side.
    const left = circle.x - box.x;
    const right = box.x + box.w - circle.x;
    const top = circle.y - box.y;
    const bottom = box.y + box.h - circle.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) circle.x = box.x - circle.r;
    else if (m === right) circle.x = box.x + box.w + circle.r;
    else if (m === top) circle.y = box.y - circle.r;
    else circle.y = box.y + box.h + circle.r;
  }
  return true;
}
