// Solmar City — the game itself: state machine (title / playing /
// paused / wasted / busted), camera, stealing and driving, pickups,
// toasts, autosave, and the frame loop that ties every system together.

import { buildCity, WORLD_W, WORLD_H, AVENUES, STREETS } from './city.js';
import { makeRng, clamp, distance } from './util.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { TrafficManager } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { PoliceManager } from './police.js';
import { Combat } from './combat.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Renderer } from './render.js';
import { saveGameState, loadGameState, applySave, clearGameState } from './save.js';
import { applyShotScene, keepChaseStaged } from './staging.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewW = canvas.width;
    this.viewH = canvas.height;

    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed')) || 7;
    this.rng = makeRng(seed);
    this.city = buildCity(seed);
    this.cityWidth = WORLD_W;
    this.cityHeight = WORLD_H;
    this.cityAvenues = AVENUES;
    this.cityStreets = STREETS;

    this.input = new Input(canvas);
    this.audio = new SoundEngine();
    this.player = new Player(this.city.spawn.x, this.city.spawn.y);
    this.traffic = new TrafficManager(this);
    this.peds = new PedestrianManager(this);
    this.police = new PoliceManager(this);
    this.combat = new Combat(this);
    this.missions = new MissionManager(this);
    this.hud = new Hud(this);
    this.renderer = new Renderer(this);

    this.camera = { x: 0, y: 0 };
    this.particles = [];
    this.toasts = [];
    this.prompt = '';
    this.state = 'title'; // title | playing | paused | wasted | busted
    this.time = 0;
    this.autosaveTimer = 0;
    this.hasSave = !!loadGameState();
    this.shotScene = params.get('shot') || '';

    this.traffic.spawnParked();
    this.traffic.spawnTraffic(12);
    this.peds.spawn(26);
    this.missions.refreshMarker();

    if (this.shotScene) {
      applyShotScene(this, this.shotScene);
    }
    this.updateCamera(1);
  }

  message(text, color) {
    this.toasts.push({ text, color: color || '#ffffff', life: 4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  saveGame() {
    saveGameState(this);
  }

  // --- Cars -----------------------------------------------------------

  enterCar(car, silent) {
    if (!car) return;
    const player = this.player;
    if (player.car) this.exitCar(false);
    car.parked = false;
    car.traffic = false;
    car.driver = 'player';
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    if (!silent) {
      if (!car.stolenByPlayer) {
        car.stolenByPlayer = true;
        this.police.addWanted(1, 'stole a car');
      }
      this.message('Driving: ' + car.model.name, '#74b9ff');
      this.audio.blip(660, 0.08, 'square', 0.1);
    }
  }

  exitCar(wrecked) {
    const player = this.player;
    const car = player.car;
    if (!car) return;
    car.driver = null;
    if (wrecked) {
      car.parked = false;
      car.speed = 0;
    } else {
      car.parked = true;
    }
    player.car = null;
    // Step out on the driver's side.
    player.x = car.x - Math.sin(car.angle) * 34;
    player.y = car.y + Math.cos(car.angle) * 34;
    player.angle = car.angle;
    player.x = clamp(player.x, 20, this.cityWidth - 20);
    player.y = clamp(player.y, 20, this.cityHeight - 20);
  }

  // --- Endings ----------------------------------------------------------

  wasted() {
    if (this.state === 'wasted') return;
    this.state = 'wasted';
    this.audio.wasted();
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
  }

  busted() {
    if (this.state === 'busted') return;
    this.state = 'busted';
    this.audio.setSiren(false);
    this.audio.setEngine(0, false);
    this.audio.wasted();
  }

  respawn() {
    const player = this.player;
    const fine = this.state === 'busted' ? 300 : 200;
    player.cash = Math.max(0, player.cash - fine);
    player.reset(this.city.places.hospital.x, this.city.places.hospital.y);
    this.police.clearWanted();
    this.combat.clearRivals();
    this.missions.active = false;
    this.missions.rivalsSpawned = false;
    this.missions.refreshMarker();
    this.state = 'playing';
    this.message('Released from Solmar General. -$' + fine, '#ff7675');
  }

  // --- Frame update -----------------------------------------------------

  update(dt) {
    this.time += dt;
    for (const toast of this.toasts) toast.life -= dt;
    this.toasts = this.toasts.filter((t) => t.life > 0);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.state === 'title') {
      if (this.input.justPressed('enter') || this.input.mouseClicked) {
        this.audio.unlock();
        this.startPlaying();
      }
      this.input.endFrame();
      return;
    }
    if (this.state === 'wasted' || this.state === 'busted') {
      if (this.input.justPressed('r', 'enter')) this.respawn();
      this.input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      if (this.input.justPressed('escape', 'p')) this.state = 'playing';
      this.input.endFrame();
      return;
    }

    // Playing.
    if (this.input.justPressed('escape', 'p')) {
      this.state = 'paused';
      this.input.endFrame();
      return;
    }
    if (this.input.justPressed('m')) {
      const muted = this.audio.toggleMute();
      this.message(muted ? 'Sound off' : 'Sound on', '#ffffff');
    }

    this.updatePromptAndActions(dt);

    const player = this.player;
    if (player.inCar) {
      const throttle = this.input.down('w', 'arrowup') ? 1 : this.input.down('s', 'arrowdown') ? -1 : 0;
      const steer = this.input.down('a', 'arrowleft') ? -1 : this.input.down('d', 'arrowright') ? 1 : 0;
      player.car.drive(dt, throttle, steer, this);
      this.audio.setEngine(Math.abs(player.car.speed) / player.car.model.topSpeed, true);
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
    } else {
      player.update(dt, this);
      this.audio.setEngine(0, false);
      // Slow health recovery while the heat is off.
      if (this.police.wanted === 0 && player.health > 0 && player.health < player.maxHealth) {
        player.heal(2 * dt);
      }
    }

    this.traffic.update(dt);
    this.peds.update(dt);
    this.police.update(dt);
    this.combat.update(dt);
    this.missions.update(dt);
    this.collectCash();

    if (this.shotScene === 'chase') keepChaseStaged(this);

    this.autosaveTimer += dt;
    if (this.autosaveTimer > 10) {
      this.autosaveTimer = 0;
      this.saveGame();
    }

    this.updateCamera(dt);
    this.input.endFrame();
  }

  updatePromptAndActions(dt) {
    const player = this.player;
    const input = this.input;
    this.prompt = '';

    if (!player.inCar) {
      const car = this.traffic.nearestStealable(player.x, player.y, 70);
      const marker = this.missions.startMarker();
      const nearMarker = marker && distance(player.x, player.y, marker.x, marker.y) < 120;
      if (car) {
        this.prompt = 'Press E to steal the ' + car.model.name;
        if (input.justPressed('e')) this.enterCar(car, false);
      } else if (nearMarker) {
        this.prompt = 'Press E to start: ' + marker.label;
        if (input.justPressed('e')) this.missions.tryStart();
      } else if (this.missions.active && this.missions.current && this.missions.current.id === 'marina') {
        this.prompt = 'WASD move • Shift run • Click / Space shoot • E enter car';
      } else {
        this.prompt = 'WASD move • Shift run • Click / Space shoot • E enter car';
      }
    } else {
      this.prompt = 'WASD drive • S brake/reverse • E exit car';
      if (input.justPressed('e')) this.exitCar(false);
    }
    void dt;
  }

  collectCash() {
    const player = this.player;
    if (player.inCar) return;
    for (const spot of this.city.cashSpots) {
      if (!spot.taken && distance(player.x, player.y, spot.x, spot.y) < 26) {
        spot.taken = true;
        player.cash += spot.amount;
        this.audio.cash();
        this.message('+$' + spot.amount + ' cash found', '#2ecc71');
        this.particles.push({
          x: spot.x, y: spot.y, vx: 0, vy: -40, life: 0.6, maxLife: 0.6, size: 10, color: '#2ecc71',
        });
      }
    }
  }

  updateCamera(dt) {
    const player = this.player;
    const tx = clamp(player.x - this.viewW / 2, 0, Math.max(0, this.cityWidth - this.viewW));
    const ty = clamp(player.y - this.viewH / 2, 0, Math.max(0, this.cityHeight - this.viewH));
    const k = dt >= 1 ? 1 : 1 - Math.pow(0.001, dt);
    this.camera.x += (tx - this.camera.x) * k;
    this.camera.y += (ty - this.camera.y) * k;
  }

  // --- Starting ---------------------------------------------------------

  startPlaying() {
    if (this.hasSave && !this.shotScene) {
      const data = loadGameState();
      if (data) {
        applySave(this, data);
        this.message('Welcome back, Dana. Save loaded.', '#74b9ff');
      }
    }
    this.state = 'playing';
    if (!this.missions.active && !this.missions.storyDone) {
      this.message('New mission: ' + this.missions.current.name + ' — follow the gold marker', '#f1c40f');
    }
  }

  newGame() {
    clearGameState();
    this.hasSave = false;
    this.player.reset(this.city.spawn.x, this.city.spawn.y);
    this.player.cash = 120;
    this.missions.index = 0;
    this.missions.stage = 0;
    this.missions.active = false;
    this.missions.finished = [];
    this.missions.storyDone = false;
    for (const spot of this.city.cashSpots) spot.taken = false;
    this.police.clearWanted();
    this.combat.clearRivals();
    this.missions.refreshMarker();
    this.state = 'playing';
  }

  // --- Frame render -----------------------------------------------------

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    this.renderer.draw(ctx);
    if (this.state === 'playing' || this.state === 'paused') {
      this.hud.draw(ctx);
    }
    if (this.state === 'title') this.drawTitle(ctx);
    if (this.state === 'paused') this.drawPaused(ctx);
    if (this.state === 'wasted') this.drawEndScreen(ctx, 'WASTED', 'The streets of Solmar got the better of you.', '#e74c3c');
    if (this.state === 'busted') this.drawEndScreen(ctx, 'BUSTED', 'Solmar PD took you in. Bail was not cheap.', '#e67e22');
  }

  drawTitle(ctx) {
    const w = this.viewW;
    const h = this.viewH;
    ctx.save();
    ctx.fillStyle = 'rgba(10,20,40,0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('SOLMAR CITY', w / 2, h / 2 - 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in the sun', w / 2, h / 2 - 52);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#dfe6e9';
    ctx.fillText('Explore the city on foot or by car — steal rides, dodge the PD, run three story missions,', w / 2, h / 2 - 8);
    ctx.fillText('collect cash, and make a name for Dana Reyes on the Solmar streets.', w / 2, h / 2 + 16);
    const blink = Math.sin(this.time * 4) > -0.2;
    if (blink) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(this.hasSave ? 'Press ENTER to continue your story' : 'Press ENTER to start', w / 2, h / 2 + 70);
    }
    ctx.fillStyle = '#b2bec3';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('WASD move / drive  •  E steal & enter cars  •  Mouse / Space shoot  •  Shift run  •  Esc pause  •  M mute', w / 2, h / 2 + 110);
    ctx.fillText('Progress saves automatically. An original game — no part of any existing crime game is used.', w / 2, h - 24);
    ctx.restore();
  }

  drawPaused(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', this.viewW / 2, this.viewH / 2 - 10);
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('Esc to resume  •  M mute  •  progress is saved automatically', this.viewW / 2, this.viewH / 2 + 30);
    ctx.restore();
  }

  drawEndScreen(ctx, title, line, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(20,0,0,0.66)';
    ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(title, this.viewW / 2, this.viewH / 2 - 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText(line, this.viewW / 2, this.viewH / 2 + 4);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('Press R to get back on the streets', this.viewW / 2, this.viewH / 2 + 52);
    ctx.restore();
  }

  // --- Loop ---------------------------------------------------------------

  run() {
    let last = performance.now();
    const step = (now) => {
      const dt = clamp((now - last) / 1000, 0.001, 0.05);
      last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}
