"use strict";

const GameState = Object.freeze({ START: "START", LOADING: "LOADING", PLAYING: "PLAYING", VICTORY: "VICTORY", LOSE: "LOSE" });
const Difficulty = Object.freeze({ EASY: "EASY", NORMAL: "NORMAL", HARD: "HARD" });
const TILE_SIZE = 50;
const SPRITE_WIDTH = 50;
const SPRITE_HEIGHT = 50;
const MAP_COUNT = 4;
const GAME_WIDTH = 1500;
const GAME_HEIGHT = 800;
const ENEMY_SPAWN_OFFSETS = [0, 250, -250, 500, -500];
const BASE_MOVE_SPEED = 7;
const BASE_SHOT_COOLDOWN = 18;
const BASE_SPRINT_COOLDOWN = 90;
const ENDLESS_RESPAWN_DELAY = 3000;

let state = GameState.START;
let selectedDifficulty = Difficulty.NORMAL;
let timerStart = 0;
const waitTime = 1000;
let world, mage, enemies = [], collectibles = [], projectiles = [], waterProjectiles = [];
const heldKeys = new Set();
let jumpQueued = false;
let resetMageRequested = false;
let worldWidth = 0, worldHeight = 0;
let viewX = 0, viewY = 0, coinScore = 0, mapNumber = 1;
let playerLevel = 1, experience = 0;
let endlessMode = false;
let customMap = null;
let editorActive = false;
let gameReady = false;
const images = {}, sounds = {}, mapLines = {};

function preload() {
  const imageFiles = ["mageL", "mageR", "mageSprintL", "mageSprintR", "wizardL", "wizardR", "red_brick", "snow", "brown_brick", "crate", "gold1", "gem1", "magma", "water", "bone"];
  for (const name of imageFiles) images[name] = loadImage(`assets/${name}.png`);
  for (let i = 1; i <= MAP_COUNT; i++) mapLines[i] = loadStrings(`assets/map${i}.csv`);
  soundFormats("mp3");
  sounds.coin = loadSound("assets/coin-sound.mp3");
  sounds.jump = loadSound("assets/jump-sound.mp3");
}

function setup() {
  const canvas = createCanvas(GAME_WIDTH, GAME_HEIGHT);
  canvas.parent("game-shell");
  pixelDensity(1);
  imageMode(CORNER);
  textFont("system-ui");
  mage = new Mage(250, 400);
  loadLevel(1);
  gameReady = true;
  window.dispatchEvent(new Event("spritequest-ready"));
  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp, { passive: false });
  window.addEventListener("blur", clearInputState);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearInputState();
  });
}

function draw() {
  if (editorActive) return;
  background(0);
  if (state === GameState.START) drawIntroScreen();
  else if (state === GameState.LOADING) drawLevelScreen();
  else if (state === GameState.PLAYING) drawPlaying();
  else if (state === GameState.VICTORY) drawVictoryScreen();
  else drawLoseScreen();
}

function drawPlaying() {
  background(100, 200, 255);
  push();
  translate(-viewX, -viewY);
  world.drawTiles();
  const nearby = world.getNearByTiles(mage);
  drawNearbyTiles(nearby);
  mage.setVelocity();
  mage.handleHorizontalMovement(nearby);
  mage.applyGravity(nearby);
  updateEndlessRespawns();
  for (const enemy of enemies) {
    if (!enemy.isAlive()) continue;
    const enemyNearby = world.getNearByTiles(enemy);
    enemy.setVelocity();
    enemy.handleHorizontalMovement(enemyNearby);
    enemy.applyGravity(enemyNearby);
    enemy.tryShootAt(mage);
  }
  updateProjectiles();
  updateWaterProjectiles();
  resolveProjectileHits();
  mage.display();
  enemies.forEach(enemy => enemy.display());
  checkCollectibleCollisions(mage);
  collectibles.forEach(item => item.display());
  if (resetMageRequested) resetMage();
  updateCamera();
  pop();
  drawScore();
}

function getRank() {
  if (coinScore >= 80) return "S";
  if (coinScore >= 65) return "A";
  if (coinScore >= 40) return "B";
  if (coinScore >= 20) return "C";
  return "D";
}

function getDifficultyName() {
  return I18n.t(`difficulty.${selectedDifficulty.toLowerCase()}`);
}

function getEnemyCount() {
  return selectedDifficulty === Difficulty.EASY ? 1 : selectedDifficulty === Difficulty.HARD ? 3 : 2;
}

function getEnemyProjectileSpeed() {
  return selectedDifficulty === Difficulty.EASY ? 5 : selectedDifficulty === Difficulty.HARD ? 9 : 7;
}

function getSpawnEnemyCount() {
  return min(ENEMY_SPAWN_OFFSETS.length, getEnemyCount() + (endlessMode ? 2 : 0));
}

function getBoneExperienceValue() {
  return selectedDifficulty === Difficulty.HARD ? 10 : selectedDifficulty === Difficulty.NORMAL ? 7 : 5;
}

function getBoneCoinValue() {
  return floor(getBoneExperienceValue() / 2);
}

function getExperienceToNextLevel() {
  return 20 + (playerLevel - 1) * 10;
}

function addExperience(amount) {
  experience += amount;
  while (experience >= getExperienceToNextLevel()) {
    experience -= getExperienceToNextLevel();
    playerLevel++;
  }
}

function getPlayerMoveSpeed() {
  return min(14, BASE_MOVE_SPEED + (playerLevel - 1) * .5);
}

function getPlayerCooldown(baseCooldown) {
  const multiplier = max(.5, 1 - (playerLevel - 1) * .08);
  return max(1, round(baseCooldown * multiplier));
}

function drawScore() {
  push();
  noStroke(); fill(255, 255, 255, 235); rect(16, 16, 660, 84, 10);
  textFont("Trebuchet MS"); textAlign(LEFT, BASELINE);
  image(images.gold1, 32, 33, 24, 24);
  fill("#233747"); textSize(22);
  text(I18n.t("hud.score", { value: coinScore }), 66, 53);
  text(I18n.t("hud.rank", { value: getRank() }), 232, 53);
  text(customMap ? I18n.t("hud.custom") : I18n.t("hud.level", { value: mapNumber }), 420, 53);
  fill("#526d7d"); textSize(17);
  text(I18n.t("hud.difficulty", { value: getDifficultyName() }), 32, 81);
  text(I18n.t("hud.playerLevel", { value: playerLevel }), 232, 81);
  text(I18n.t("hud.xp", { value: experience, next: getExperienceToNextLevel() }), 420, 81);
  if (endlessMode) {
    fill(255, 255, 255, 235); rect(686, 16, 200, 40, 7);
    fill("#305be8"); text(I18n.t("hud.endless"), 702, 43);
  }
  mage.drawCooldownTime();
  pop();
}

function drawNearbyTiles(nearby) {
  rectMode(CORNER);
  for (const platform of nearby) {
    stroke(0);
    strokeWeight(4);
    noFill();
    rect(platform.x, platform.y, platform.size, platform.size);
  }
}

function updateCamera() {
  const targetX = constrain(mage.x - width / 2, 0, max(0, worldWidth - width));
  const targetY = constrain(mage.y - height / 2, 0, max(0, worldHeight - height));
  viewX += .2 * (targetX - viewX);
  viewY += .2 * (targetY - viewY);
}

function updateProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i];
    shot.update();
    if (shot.hitsWall() || shot.isOffWorld()) { projectiles.splice(i, 1); continue; }
    shot.display();
    if (!mage.isSprinting() && shot.collidesWith(mage)) {
      projectiles.splice(i, 1);
      coinScore -= 10;
      state = coinScore < 0 ? GameState.LOSE : state;
      resetMageRequested = true;
    }
  }
}

function updateWaterProjectiles() {
  for (let i = waterProjectiles.length - 1; i >= 0; i--) {
    const shot = waterProjectiles[i];
    shot.update();
    if (shot.hitsWall() || shot.isOffWorld()) waterProjectiles.splice(i, 1);
    else shot.display();
  }
}

function resolveProjectileHits() {
  for (let i = waterProjectiles.length - 1; i >= 0; i--) {
    const water = waterProjectiles[i];
    const enemy = enemies.find(item => item.isAlive() && water.collidesWith(item));
    if (enemy) {
      enemy.takeDamage(1);
      waterProjectiles.splice(i, 1);
      continue;
    }
    const magmaIndex = projectiles.findIndex(item => water.collidesWith(item));
    if (magmaIndex !== -1) {
      waterProjectiles.splice(i, 1);
      projectiles.splice(magmaIndex, 1);
    }
  }
}

function checkCollectibleCollisions(character) {
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const item = collectibles[i];
    if (!item.collidesWith(character)) continue;
    if (item.type === "coin" || item.type === "bone") {
      collectibles.splice(i, 1);
      coinScore += item.type === "coin" ? 1 : item.scoreValue;
      if (item.type === "bone") addExperience(item.experienceValue);
      playSound(sounds.coin);
    } else if (item.type === "gem") {
      collectibles.splice(i, 1);
      if (customMap) { state = GameState.VICTORY; break; }
      mapNumber++;
      if (mapNumber > MAP_COUNT) state = GameState.VICTORY;
      else {
        state = GameState.LOADING;
        timerStart = millis();
        loadLevel(mapNumber);
      }
      break;
    } else {
      coinScore -= 10;
      if (coinScore < 0) state = GameState.LOSE;
      resetMageRequested = true;
    }
  }
}

function playSound(sound) {
  if (sound && sound.isLoaded() && getAudioContext().state === "running") sound.play();
}

// A quiet snow landscape built from the same tiles the player can paint.
function drawMenuLandscape() {
  background("#e3f0f7");
  noStroke();
  fill("#c7dfe9");
  rect(810, 320, 160, 400); rect(870, 245, 100, 100);
  rect(1060, 235, 190, 500); rect(1130, 170, 120, 100);
  rect(1340, 310, 160, 440);
  fill("#d3e8ed");
  rect(740, 470, 210, 280); rect(980, 390, 180, 340); rect(1240, 440, 260, 300);
  fill("#f8fcff");
  rect(850, 130, 180, 27); rect(884, 103, 100, 27);
  rect(1270, 95, 150, 25); rect(1300, 70, 70, 25);
  // Stepped islands echo the editor's grid without introducing new game art.
  noSmooth();
  for (let x = 0; x < width; x += 64) image(images.snow, x, 710, 64, 64);
  fill("#a4c7ce"); rect(0, 774, width, 26);
  for (let x = 850; x < 1110; x += 64) image(images.snow, x, 560, 64, 64);
  for (let x = 1180; x < 1440; x += 64) image(images.snow, x, 420, 64, 64);
  image(images.mageR, 915, 432, 128, 128);
  image(images.crate, 1280, 646, 64, 64);
  image(images.crate, 1344, 646, 64, 64);
  image(images.crate, 1344, 582, 64, 64);
  image(images.gold1, 1090, 464, 44, 44);
  image(images.gold1, 1150, 402, 44, 44);
  image(images.gem1, 1300, 324, 76, 76);
}

function drawIntroScreen() {
  push();
  drawMenuLandscape();
  textAlign(LEFT, BASELINE);
  fill("#233747"); textFont("Trebuchet MS"); textSize(28);
  text(I18n.t("screen.tagline"), 86, 145);
  textFont("Courier New"); textStyle(BOLD); textSize(112);
  fill("#305be8");
  if (customMap) {
    textFont("Trebuchet MS"); textSize(64);
    text(I18n.t("screen.customTitle"), 86, 285);
  } else {
    text("Sprite", 78, 278);
    text("Quest", 78, 386);
  }
  textFont("Trebuchet MS"); textStyle(NORMAL); fill("#526d7d"); textSize(23);
  text(I18n.t("screen.goal"), 86, 435);
  for (const [index, difficulty] of [Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD].entries()) {
    const x = 86 + index * 195, active = selectedDifficulty === difficulty;
    fill(active ? "#305be8" : "#c7dbe8"); rect(x, 489, 42, 44, 5);
    fill(active ? "#fff" : "#233747"); textSize(23); text(String(index + 1), x + 14, 519);
    fill(active ? "#305be8" : "#526d7d");
    text(I18n.t(`difficulty.${difficulty.toLowerCase()}`), x + 54, 519);
  }
  fill("#233747"); textSize(29);
  text(I18n.t("screen.start"), 86, 599);
  fill("#526d7d"); textSize(21);
  text(I18n.t("screen.difficulty"), 86, 640);
  pop();
  timerStart = millis();
  if (resetMageRequested) startNewGame();
}

function drawLevelScreen() {
  push();
  background("#e3f0f7");
  textAlign(CENTER, BASELINE); textFont("Trebuchet MS");
  noStroke(); noSmooth(); image(images.mageR, width / 2 - 45, 220, 90, 90);
  const percent = constrain((millis() - timerStart) / waitTime, 0, 1);
  fill("#233747"); textSize(46);
  text(customMap ? I18n.t("screen.loadingCustom") : I18n.t("screen.loadingLevel", { value: mapNumber }), width / 2, 380);
  fill("#c7dbe8"); rect(500, 425, 500, 12, 6);
  fill("#305be8"); rect(500, 425, 500 * percent, 12, 6);
  textSize(24); text(`${floor(percent * 100)}%`, width / 2, 490);
  pop();
  if (percent >= 1) state = GameState.PLAYING;
}

function drawVictoryScreen() {
  drawEndScreen(I18n.t("screen.win"), I18n.t("screen.earned", { value: coinScore }), I18n.t("screen.restart"));
  push(); textAlign(LEFT, BASELINE); textFont("Trebuchet MS"); fill("#526d7d"); textSize(23);
  text(I18n.t(customMap ? "screen.mapComplete" : "screen.endless"), 86, 623, 640, 70);
  pop();
}

function drawLoseScreen() {
  drawEndScreen(I18n.t("screen.lose"), I18n.t("screen.noCoins"), I18n.t("screen.restart"));
}

function drawEndScreen(title, subtitle, prompt) {
  push();
  drawMenuLandscape();
  textAlign(LEFT, BASELINE); textFont("Trebuchet MS");
  fill("#233747"); textStyle(BOLD); textSize(78); text(title, 86, 255);
  textStyle(NORMAL); fill("#526d7d"); textSize(30); text(subtitle, 86, 322);
  textSize(24); text(I18n.t("screen.chooseDifficulty"), 86, 418);
  text(I18n.t("screen.selected", { value: getDifficultyName() }), 86, 465);
  fill("#305be8"); textSize(34); text(prompt, 86, 565);
  pop();
  if (resetMageRequested) startNewGame();
}

function startNewGame() {
  if (!gameReady) return;
  clearInputState();
  endlessMode = false;
  mapNumber = 1;
  coinScore = 0;
  playerLevel = 1;
  experience = 0;
  timerStart = millis();
  state = GameState.LOADING;
  loadLevel(mapNumber);
  resetMageRequested = false;
}

function startEndlessMode() {
  if (customMap) return;
  endlessMode = true;
  mapNumber = MAP_COUNT;
  timerStart = millis();
  state = GameState.LOADING;
  loadLevel(mapNumber);
  collectibles = collectibles.filter(item => item.type !== "gem");
  resetMageRequested = false;
}

function loadLevel(number) {
  collectibles = [];
  projectiles = [];
  waterProjectiles = [];
  enemies = [];
  const lines = customMap ? customMap.lines : mapLines[number];
  world = new World(lines);
  worldWidth = world.cols * TILE_SIZE;
  worldHeight = world.rows * TILE_SIZE;
  enemies = createEnemiesForMap();
  viewX = viewY = 0;
  resetMage();
  if (customMap) {
    viewX = constrain(mage.x - GAME_WIDTH / 2, 0, max(0, worldWidth - GAME_WIDTH));
    viewY = constrain(mage.y - GAME_HEIGHT / 2, 0, max(0, worldHeight - GAME_HEIGHT));
  }
}

function resetMage() {
  mage.x = customMap ? customMap.spawn.col * TILE_SIZE : 250;
  mage.y = customMap ? customMap.spawn.row * TILE_SIZE : 400;
  mage.xVelocity = 0; mage.yVelocity = 0; mage.onGround = false;
  mage.resetSprintState();
  mage.lastShotFrame = -BASE_SHOT_COOLDOWN;
  projectiles = []; waterProjectiles = [];
  if (selectedDifficulty !== Difficulty.EASY) resetEnemies();
  resetMageRequested = false;
}

function createEnemiesForMap() {
  if (customMap) return world.enemySpawns.map(spawn => new Enemy(spawn.x, spawn.y, getBoneCoinValue(), getBoneExperienceValue()));
  const result = [];
  const spawnX = world.getEnemySpawnX();
  for (let i = 0; i < getSpawnEnemyCount(); i++) {
    const x = constrain(spawnX + ENEMY_SPAWN_OFFSETS[i], 0, max(0, worldWidth - SPRITE_WIDTH));
    result.push(new Enemy(x, world.findGroundY(x), getBoneCoinValue(), getBoneExperienceValue()));
  }
  return result;
}

function resetEnemies() {
  enemies.forEach((enemy, index) => respawnEnemy(enemy, index));
}

function respawnEnemy(enemy, index) {
  if (customMap) {
    Object.assign(enemy, world.enemySpawns[index]);
    enemy.resetState();
    return;
  }
  const spawnX = world.getEnemySpawnX();
  enemy.x = constrain(spawnX + ENEMY_SPAWN_OFFSETS[index], 0, max(0, worldWidth - SPRITE_WIDTH));
  enemy.y = world.findGroundY(enemy.x);
  enemy.resetState();
}

function updateEndlessRespawns() {
  if (!endlessMode) return;
  enemies.forEach((enemy, index) => {
    if (!enemy.isAlive() && enemy.deathTime !== null && millis() - enemy.deathTime >= ENDLESS_RESPAWN_DELAY) {
      respawnEnemy(enemy, index);
    }
  });
}

function clearInputState() {
  heldKeys.clear();
  jumpQueued = false;
  if (mage) mage.xVelocity = 0;
}

function handleKeyDown(event) {
  if (editorActive || !gameReady || event.target.closest?.("input, select, textarea, button, a, [contenteditable='true']")) return;
  const code = event.code;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(code)) event.preventDefault();
  userStartAudio();
  const wasHeld = heldKeys.has(code);
  heldKeys.add(code);

  if (code === "ArrowUp" && !wasHeld) jumpQueued = true;
  else if (code === "KeyZ" && !event.repeat) mage.triggerSprint();
  else if (code === "KeyR" && !event.repeat && state === GameState.PLAYING) {
    state = GameState.START;
    resetMageRequested = false;
    clearInputState();
  }
  else if (code === "KeyE" && !event.repeat && state === GameState.VICTORY) startEndlessMode();
  else if (code === "Digit1" && ![GameState.PLAYING, GameState.LOADING].includes(state)) selectedDifficulty = Difficulty.EASY;
  else if (code === "Digit2" && ![GameState.PLAYING, GameState.LOADING].includes(state)) selectedDifficulty = Difficulty.NORMAL;
  else if (code === "Digit3" && ![GameState.PLAYING, GameState.LOADING].includes(state)) selectedDifficulty = Difficulty.HARD;
  else if (code === "KeyX") mage.shootWater();
  else if (code === "Space" && !event.repeat) {
    if (customMap) startNewGame();
    else resetMageRequested = true;
  }
}

function handleKeyUp(event) {
  const code = event.code;
  if (!editorActive && !event.target.closest?.("input, select, textarea, button, a") && ["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(code)) event.preventDefault();
  heldKeys.delete(code);
}

class Character {
  constructor(x, y) {
    this.x = x; this.y = y; this.xVelocity = 0; this.yVelocity = 0;
    this.gravity = .5; this.onGround = false; this.spriteWidth = 50; this.spriteHeight = 50;
  }
  applyGravity(nearby) {
    this.onGround = false;
    this.yVelocity += this.gravity;
    let nextY = this.y + this.yVelocity;
    for (const p of nearby) {
      const overlapX = this.x + this.spriteWidth > p.x && this.x < p.x + p.size;
      if (this.yVelocity > 0 && overlapX && this.y + this.spriteHeight <= p.y && nextY + this.spriteHeight >= p.y) {
        nextY = p.y - this.spriteHeight; this.yVelocity = 0; this.onGround = true;
      }
      if (this.yVelocity < 0 && overlapX && this.y >= p.y + p.size && nextY <= p.y + p.size) {
        nextY = p.y + p.size; this.yVelocity = 0;
      }
    }
    this.y = nextY;
    const bottom = world.rows * TILE_SIZE - this.spriteHeight;
    if (this.y > bottom) { this.y = bottom; this.yVelocity = 0; this.onGround = true; }
    if (this.y < 0) { this.y = 0; this.yVelocity = max(0, this.yVelocity); }
  }
  jump() {
    if (this.onGround) { this.yVelocity = -13; playSound(sounds.jump); }
  }
  handleHorizontalMovement(nearby) {
    this.x = constrain(this.x, 0, world.cols * TILE_SIZE);
    this.x += this.xVelocity;
    for (const p of nearby) {
      const overlap = this.x < p.x + p.size && this.x + this.spriteWidth > p.x && this.y < p.y + p.size && this.y + this.spriteHeight > p.y;
      if (!overlap) continue;
      if (this.xVelocity > 0) this.x = p.x - this.spriteWidth;
      else if (this.xVelocity < 0) this.x = p.x + p.size;
      this.xVelocity = 0;
    }
    this.x = constrain(this.x, 0, world.cols * TILE_SIZE - SPRITE_WIDTH);
  }
}

class Mage extends Character {
  constructor(x, y) {
    super(x, y);
    this.facingRight = true;
    this.lastShotFrame = -BASE_SHOT_COOLDOWN;
    this.sprintDurationFrames = 10;
    this.lastSprintFrame = -BASE_SPRINT_COOLDOWN; this.sprintStartFrame = -10; this.sprintSpeed = 16;
  }
  setVelocity() {
    const shouldJump = jumpQueued;
    jumpQueued = false;
    if (this.isSprinting()) { this.xVelocity = this.facingRight ? this.sprintSpeed : -this.sprintSpeed; return; }
    this.xVelocity = 0;
    const moveSpeed = getPlayerMoveSpeed();
    if (heldKeys.has("ArrowLeft")) { this.xVelocity -= moveSpeed; this.facingRight = false; }
    if (heldKeys.has("ArrowRight")) { this.xVelocity += moveSpeed; this.facingRight = true; }
    if (shouldJump) this.jump();
  }
  display() {
    const sprite = this.isSprinting()
      ? images[this.facingRight ? "mageSprintR" : "mageSprintL"]
      : images[this.facingRight ? "mageR" : "mageL"];
    const offset = this.onGround && !this.isSprinting() ? sin(frameCount * .1) * 5 : 0;
    image(sprite, this.x, this.y + offset, 50, 50);
  }
  isSprinting() { return frameCount - this.sprintStartFrame < this.sprintDurationFrames; }
  triggerSprint() {
    if (this.isSprinting() || frameCount - this.lastSprintFrame < getPlayerCooldown(BASE_SPRINT_COOLDOWN)) return;
    if (heldKeys.has("ArrowLeft")) this.facingRight = false;
    else if (heldKeys.has("ArrowRight")) this.facingRight = true;
    this.sprintStartFrame = this.lastSprintFrame = frameCount;
  }
  resetSprintState() { this.sprintStartFrame = -this.sprintDurationFrames; this.lastSprintFrame = -getPlayerCooldown(BASE_SPRINT_COOLDOWN); }
  shootWater() {
    if (state !== GameState.PLAYING || frameCount - this.lastShotFrame < getPlayerCooldown(BASE_SHOT_COOLDOWN)) return;
    const direction = this.facingRight ? 1 : -1;
    waterProjectiles.push(new WaterProjectile(direction > 0 ? this.x + 50 : this.x - 20, this.y + 20, direction * 10));
    this.lastShotFrame = frameCount;
  }
  drawCooldownTime() {
    const shotCooldown = getPlayerCooldown(BASE_SHOT_COOLDOWN);
    const sprintCooldown = getPlayerCooldown(BASE_SPRINT_COOLDOWN);
    const items = [
      { x: width - 110, label: "X", name: I18n.t("hud.shot"), color: [40, 120, 255], percent: constrain((frameCount - this.lastShotFrame) / shotCooldown, 0, 1) },
      { x: width - 50, label: "Z", name: I18n.t("hud.sprint"), color: [255, 150, 40], percent: constrain((frameCount - this.lastSprintFrame) / sprintCooldown, 0, 1) }
    ];
    for (const item of items) {
      stroke(210); strokeWeight(3); fill(235); circle(item.x, height - 50, 42);
      stroke(...item.color); noFill(); arc(item.x, height - 50, 42, 42, -HALF_PI, -HALF_PI + TWO_PI * item.percent);
      noStroke(); fill(...item.color); textAlign(CENTER, CENTER); textSize(12); text(item.label, item.x, height - 50);
      fill(255); textSize(10); text(item.name, item.x, height - 18);
    }
  }
}

class Enemy extends Character {
  constructor(x, y, boneCoinValue, boneExperienceValue) {
    super(x, y);
    this.enemyfacingRight = true; this.direction = 1; this.patrolSpeed = 3;
    this.turnAroundSpeed = 3000 / getEnemyCount() / getEnemyCount();
    this.waitTurnAround = 0; this.waitingToTurn = false;
    this.shootCooldownFrames = 100; this.lastShotFrame = -100;
    this.maxHealth = 5; this.health = this.maxHealth; this.droppedBone = null;
    this.boneCoinValue = boneCoinValue; this.boneExperienceValue = boneExperienceValue;
    this.deathTime = null;
  }
  isAlive() { return this.health > 0; }
  setVelocity() {
    if (!this.isAlive()) { this.xVelocity = 0; return; }
    if (this.waitingToTurn) {
      this.xVelocity = 0;
      if (millis() - this.waitTurnAround >= this.turnAroundSpeed) { this.direction *= -1; this.waitingToTurn = false; }
      this.enemyfacingRight = this.direction > 0; return;
    }
    if (this.shouldTurnAround()) { this.waitTurnAround = millis(); this.waitingToTurn = true; this.xVelocity = 0; return; }
    this.xVelocity = this.patrolSpeed * this.direction;
    this.enemyfacingRight = this.direction > 0;
  }
  shouldTurnAround() {
    const frontX = this.direction > 0 ? this.x + 52 : this.x - 2;
    if (world.isSolidAt(frontX, this.y + 6) || world.isSolidAt(frontX, this.y + 44)) return true;
    if (this.onGround) {
      const groundX = this.direction > 0 ? this.x + 54 : this.x - 4;
      if (!world.isSolidAt(groundX, this.y + 54)) return true;
    }
    return false;
  }
  tryShootAt(target) {
    if (!this.isAlive() || frameCount - this.lastShotFrame < this.shootCooldownFrames) return;
    if (abs((target.y + 25) - (this.y + 25)) > 200) return;
    const direction = this.enemyfacingRight ? 1 : -1;
    const projectileSpeed = getEnemyProjectileSpeed();
    projectiles.push(new Projectile(direction > 0 ? this.x + 50 : this.x - 24, this.y + 17.5, direction * projectileSpeed));
    this.enemyfacingRight = direction > 0; this.lastShotFrame = frameCount;
  }
  takeDamage(amount) {
    if (!this.isAlive()) return;
    this.health = max(0, this.health - amount);
    if (this.health === 0) {
      this.deathTime = millis();
      this.dropBone();
    }
  }
  dropBone() {
    this.droppedBone = new Collectible(this.x + 2.5, this.y + 5, images.bone, 45, "bone", this.boneCoinValue, this.boneExperienceValue);
    collectibles.push(this.droppedBone);
  }
  resetState() {
    if (this.droppedBone) collectibles = collectibles.filter(item => item !== this.droppedBone);
    this.health = this.maxHealth; this.xVelocity = this.yVelocity = 0; this.direction = 1;
    this.enemyfacingRight = true; this.waitTurnAround = 0; this.waitingToTurn = false;
    this.lastShotFrame = -this.shootCooldownFrames; this.droppedBone = null; this.deathTime = null;
  }
  display() {
    if (!this.isAlive()) return;
    image(images[this.enemyfacingRight ? "wizardR" : "wizardL"], this.x, this.y + (this.onGround ? sin(frameCount * .1) * 5 : 0), 50, 50);
    noStroke(); fill(60); rect(this.x, this.y - 14, 50, 8);
    fill(70, 220, 90); rect(this.x, this.y - 14, 50 * this.health / this.maxHealth, 8);
  }
}

class Platform {
  constructor(x, y, img, size) { this.x = x; this.y = y; this.img = img; this.size = size; }
  display() { image(this.img, this.x, this.y, this.size, this.size); }
}

class Collectible {
  constructor(x, y, img, size, type, scoreValue = 0, experienceValue = 0) {
    Object.assign(this, { x, y, img, size, type, scoreValue, experienceValue });
  }
  display() { image(this.img, this.x, this.y, this.size, this.size); }
  collidesWith(c) { return rectanglesOverlap(this.x, this.y, this.size, this.size, c.x, c.y, c.spriteWidth, c.spriteHeight); }
}

class Projectile {
  static SIZE = 24;
  constructor(x, y, xVelocity) { Object.assign(this, { x, y, xVelocity }); }
  update() { this.x += this.xVelocity; }
  display() { image(images.magma, this.x, this.y, Projectile.SIZE, Projectile.SIZE); }
  hitsWall() { return world.isSolidAt(this.xVelocity > 0 ? this.x + Projectile.SIZE : this.x, this.y + Projectile.SIZE / 2); }
  isOffWorld() { return this.x + Projectile.SIZE < 0 || this.x > worldWidth || this.y + Projectile.SIZE < 0 || this.y > worldHeight; }
  collidesWith(c) { return rectanglesOverlap(this.x, this.y, Projectile.SIZE, Projectile.SIZE, c.x, c.y, c.spriteWidth, c.spriteHeight); }
}

class WaterProjectile {
  static SIZE = 20;
  constructor(x, y, xVelocity) { Object.assign(this, { x, y, xVelocity }); }
  update() { this.x += this.xVelocity; }
  display() { image(images.water, this.x, this.y, WaterProjectile.SIZE, WaterProjectile.SIZE); }
  hitsWall() { return world.isSolidAt(this.xVelocity > 0 ? this.x + WaterProjectile.SIZE : this.x, this.y + WaterProjectile.SIZE / 2); }
  isOffWorld() { return this.x + WaterProjectile.SIZE < 0 || this.x > worldWidth || this.y + WaterProjectile.SIZE < 0 || this.y > worldHeight; }
  collidesWith(target) {
    const size = target instanceof Projectile ? Projectile.SIZE : target.spriteWidth;
    const height = target instanceof Projectile ? Projectile.SIZE : target.spriteHeight;
    return rectanglesOverlap(this.x, this.y, WaterProjectile.SIZE, WaterProjectile.SIZE, target.x, target.y, size, height);
  }
}

function rectanglesOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax + aw > bx && ax < bx + bw && ay + ah > by && ay < by + bh;
}

class World {
  constructor(lines) {
    this.grid = SpriteMap.parseCSV(lines.join("\n"));
    this.rows = this.grid.length; this.cols = this.grid[0].length;
    this.tileGrid = Array.from({ length: this.cols }, () => Array(this.rows).fill(null));
    this.enemySpawnX = null;
    this.enemySpawns = [];
    this.createPlatforms();
  }
  createPlatforms() {
    const tileImages = Object.fromEntries(SpriteMap.tiles.filter(tile => tile.solid).map(tile => [tile.code, images[tile.image]]));
    const collectiblesByCode = { "5": [images.gold1, "coin"], "6": [images.gem1, "gem"], "7": [images.magma, "magma"] };
    this.grid.forEach((line, row) => line.forEach((value, col) => {
      if (tileImages[value]) this.tileGrid[col][row] = new Platform(col * TILE_SIZE, row * TILE_SIZE, tileImages[value], TILE_SIZE);
      else if (collectiblesByCode[value]) {
        const [img, type] = collectiblesByCode[value];
        collectibles.push(new Collectible(col * TILE_SIZE, row * TILE_SIZE, img, TILE_SIZE, type));
      } else if (value === 9) {
        this.enemySpawnX = col * TILE_SIZE;
        this.enemySpawns.push({ x: col * TILE_SIZE, y: row * TILE_SIZE });
      }
    }));
  }
  drawTiles() { for (const column of this.tileGrid) for (const tile of column) if (tile) tile.display(); }
  getNearByTiles(c) {
    const result = [];
    const left = max(0, floor(c.x / TILE_SIZE) - 1), right = min(this.cols - 1, floor((c.x + c.spriteWidth) / TILE_SIZE) + 1);
    const top = max(0, floor(c.y / TILE_SIZE) - 1), bottom = min(this.rows - 1, floor((c.y + c.spriteHeight) / TILE_SIZE) + 1);
    for (let col = left; col <= right; col++) for (let row = top; row <= bottom; row++) if (this.tileGrid[col][row]) result.push(this.tileGrid[col][row]);
    return result;
  }
  isSolidAt(x, y) {
    const col = floor(x / TILE_SIZE), row = floor(y / TILE_SIZE);
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows && this.tileGrid[col][row] !== null;
  }
  findGroundY(x) {
    const col = constrain(floor((x + SPRITE_WIDTH / 2) / TILE_SIZE), 0, this.cols - 1);
    for (let row = 0; row < this.rows; row++) if (this.tileGrid[col][row]) return this.tileGrid[col][row].y - SPRITE_HEIGHT;
    return this.rows * TILE_SIZE - SPRITE_HEIGHT;
  }
  getEnemySpawnX() { return this.enemySpawnX ?? 600; }
}
