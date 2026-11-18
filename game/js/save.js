// Solmar City — saving: cash, story progress, position and health go
// to localStorage so a session survives a closed tab.

const SAVE_KEY = 'solmar-city-save-v1';

export function saveGameState(world) {
  try {
    const data = {
      version: 1,
      cash: world.player.cash,
      health: world.player.health,
      x: world.player.x,
      y: world.player.y,
      missionIndex: world.missions.index,
      finished: world.missions.finished,
      storyDone: world.missions.storyDone,
      takenCash: world.city.cashSpots.filter((s) => s.taken).map((s) => s.id),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGameState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearGameState() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
}

export function applySave(world, data) {
  const player = world.player;
  player.cash = data.cash;
  player.health = data.health;
  player.x = data.x;
  player.y = data.y;
  world.missions.index = data.missionIndex;
  world.missions.finished = data.finished || [];
  world.missions.storyDone = !!data.storyDone;
  world.missions.active = false;
  world.missions.stage = 0;
  const taken = new Set(data.takenCash || []);
  for (const spot of world.city.cashSpots) {
    if (taken.has(spot.id)) spot.taken = true;
  }
  world.missions.refreshMarker();
}
