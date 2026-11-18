// Solmar City — the story: three missions for Dana Reyes, a newcomer
// trying to make a name on the Solmar streets, plus free-roam life
// after the last one. Each mission is a small state machine driven by
// where the player is and what they do.

import { distance } from './util.js';

export const MISSION_DEFS = [
  {
    id: 'wheels',
    name: 'Wheels of Fortune',
    intro: "Ray needs a driver with wheels. Steal any car — press E next to one — then bring it to Ray's Garage.",
    stages: [
      { id: 'steal', text: 'Steal a car (walk up to one and press E)', reward: 0 },
      { id: 'deliver', text: "Drive the car to Ray's Garage", reward: 300 },
    ],
  },
  {
    id: 'marina',
    name: 'The Marina Drop',
    intro: 'A package is waiting at the Marina. Pick it up and run it north — the PD will be watching.',
    stages: [
      { id: 'pickup', text: 'Pick up the package at the Marina', reward: 0 },
      { id: 'dropoff', text: 'Deliver the package to the Northside Drop — lose the heat if you can', reward: 600 },
    ],
  },
  {
    id: 'boardwalk',
    name: 'Boardwalk Payback',
    intro: 'The Boardwalk crew jumped your cousin. Settle it on the beach, then get back to the Safehouse.',
    stages: [
      { id: 'fight', text: 'Deal with the Boardwalk crew (4 rivals)', reward: 0 },
      { id: 'escape', text: 'Get back to the Safehouse', reward: 1000 },
    ],
  },
];

export class MissionManager {
  constructor(world) {
    this.world = world;
    this.index = 0; // which mission is current
    this.stage = 0; // which stage inside it
    this.active = false; // a mission is running
    this.finished = []; // completed mission ids
    this.storyDone = false;
    this.marker = null; // {x, y, label} current objective marker
    this.packageCarried = false;
    this.rivalsSpawned = false;
  }

  get current() {
    return MISSION_DEFS[this.index] || null;
  }

  get stageDef() {
    const m = this.current;
    return m ? m.stages[this.stage] : null;
  }

  get objectiveText() {
    if (this.storyDone) return 'Free roam — collect cash, explore Solmar, cause chaos';
    if (!this.active) {
      const m = this.current;
      return m ? 'Go to the marker and press E: ' + m.name : 'Free roam';
    }
    return this.stageDef ? this.stageDef.text : '';
  }

  // The marker the player walks to in order to start the next mission.
  startMarker() {
    const m = this.current;
    if (!m || this.active || this.storyDone) return null;
    const places = this.world.city.places;
    if (m.id === 'wheels') return { x: places.garage.x, y: places.garage.y, label: m.name };
    if (m.id === 'marina') return { x: places.marina.x, y: places.marina.y, label: m.name };
    if (m.id === 'boardwalk') return { x: places.boardwalk.x, y: places.boardwalk.y, label: m.name };
    return null;
  }

  tryStart() {
    const marker = this.startMarker();
    if (!marker) return false;
    const p = this.world.player;
    if (distance(p.x, p.y, marker.x, marker.y) > 110) return false;
    this.active = true;
    this.stage = 0;
    this.rivalsSpawned = false;
    this.packageCarried = false;
    const m = this.current;
    this.world.message('MISSION: ' + m.name, '#f1c40f');
    this.world.message(m.intro, '#ffffff');
    this.world.audio.missionStart();
    this.refreshMarker();
    return true;
  }

  refreshMarker() {
    const places = this.world.city.places;
    const m = this.current;
    if (!m || !this.active) {
      this.marker = this.startMarker();
      return;
    }
    const stage = this.stageDef.id;
    if (m.id === 'wheels') {
      this.marker = stage === 'deliver'
        ? { x: places.garage.x, y: places.garage.y, label: "Ray's Garage" }
        : null;
    } else if (m.id === 'marina') {
      this.marker = stage === 'pickup'
        ? { x: places.marina.x, y: places.marina.y, label: 'Package' }
        : { x: places.northDrop.x, y: places.northDrop.y, label: 'Drop-off' };
    } else if (m.id === 'boardwalk') {
      this.marker = stage === 'fight'
        ? { x: places.boardwalk.x, y: places.boardwalk.y, label: 'Boardwalk crew' }
        : { x: places.safehouse.x, y: places.safehouse.y, label: 'Safehouse' };
    }
  }

  completeStage() {
    const m = this.current;
    const stage = this.stageDef;
    if (stage.reward > 0) {
      this.world.player.cash += stage.reward;
      this.world.message('+$' + stage.reward + ' — ' + m.name + ' complete!', '#2ecc71');
      this.world.audio.missionComplete();
    }
    this.stage++;
    if (this.stage >= m.stages.length) {
      this.finished.push(m.id);
      this.active = false;
      this.index++;
      this.stage = 0;
      if (this.index >= MISSION_DEFS.length) {
        this.storyDone = true;
        this.world.message('STORY COMPLETE — Solmar City is yours, Dana.', '#f1c40f');
      } else {
        this.world.message('New mission available: ' + MISSION_DEFS[this.index].name, '#f1c40f');
      }
    }
    this.world.saveGame();
    this.refreshMarker();
  }

  update(dt) {
    const world = this.world;
    const player = world.player;
    const places = world.city.places;

    if (!this.active) {
      this.marker = this.startMarker();
      return;
    }
    const m = this.current;
    const stage = this.stageDef.id;

    if (m.id === 'wheels') {
      if (stage === 'steal' && player.inCar) {
        this.stage = 1;
        world.message("Nice wheels. Now bring it to Ray's Garage.", '#ffffff');
        this.refreshMarker();
      } else if (stage === 'deliver' && player.inCar &&
        distance(player.x, player.y, places.garage.x, places.garage.y) < 110) {
        this.completeStage();
      }
    } else if (m.id === 'marina') {
      if (stage === 'pickup' && !player.inCar &&
        distance(player.x, player.y, places.marina.x, places.marina.y) < 80) {
        this.packageCarried = true;
        this.stage = 1;
        world.message('Package secured. The PD is onto you — run it north!', '#ff7675');
        world.police.setWanted(2, 'spotted with the package');
        this.refreshMarker();
      } else if (stage === 'dropoff' &&
        distance(player.x, player.y, places.northDrop.x, places.northDrop.y) < 110) {
        this.packageCarried = false;
        this.completeStage();
      }
    } else if (m.id === 'boardwalk') {
      if (stage === 'fight') {
        if (!this.rivalsSpawned) {
          this.rivalsSpawned = true;
          world.combat.spawnRivals(places.boardwalk.x, places.boardwalk.y, 4);
          world.message('The Boardwalk crew is here — take them all down!', '#ff7675');
        } else if (world.combat.rivalsLeft() === 0) {
          this.stage = 1;
          world.message('Crew dealt with. Get back to the Safehouse!', '#ffffff');
          this.refreshMarker();
        }
      } else if (stage === 'escape' &&
        distance(player.x, player.y, places.safehouse.x, places.safehouse.y) < 110) {
        this.completeStage();
      }
    }
    void dt;
  }
}
