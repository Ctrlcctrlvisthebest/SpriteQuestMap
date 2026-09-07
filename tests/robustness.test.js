"use strict";
const test = require("node:test");
const vm = require("node:vm");
const { createGameContext } = require("./helpers/game.js");

function check(source) { vm.runInContext(source, createGameContext()); }

test("browser shortcuts and menu keys cannot prime sprint or add unrelated held keys", () => check(`
  state = GameState.PLAYING;
  handleKeyDown({ code: 'KeyZ', ctrlKey: true, target: { closest: () => null }, preventDefault() {} });
  assert.equal(mage.isSprinting(), false);
  assert.equal(heldKeys.size, 0);
  state = GameState.START;
  handleKeyDown({ code: 'KeyZ', target: { closest: () => null }, preventDefault() {} });
  assert.equal(mage.isSprinting(), false);
`));

test("one damage event per frame cannot turn a defeat into a gem victory", () => check(`
  state = GameState.PLAYING; coinScore = 0;
  customMap = { spawn: { col: 0, row: 0 } };
  collectibles = [new Collectible(250,400,{},50,'gem'), new Collectible(250,400,{},50,'magma')];
  checkCollectibleCollisions(mage);
  assert.equal(state, GameState.LOSE);
  assert.equal(coinScore, -10);
  assert.equal(collectibles.filter(item => item.type === 'gem').length, 1);
`));

test("overlapping hazards cause one penalty rather than repeated penalties on the same hit", () => check(`
  state = GameState.PLAYING; coinScore = 30;
  collectibles = [new Collectible(250,400,{},50,'magma'), new Collectible(250,400,{},50,'magma')];
  checkCollectibleCollisions(mage);
  assert.equal(coinScore, 20);
`));

test("fast falls still land on the first crossed platform", () => check(`
  const grid = Array.from({length:20}, () => [0,0,0,0,0,0]);
  grid[5].fill(2); grid[19].fill(2);
  world = new World(grid.map(row => row.join(',')));
  mage.x = 100; mage.y = 100; mage.yVelocity = 180;
  mage.applyGravity(world.getNearByTiles(mage));
  assert.equal(mage.y, 200); assert.equal(mage.onGround, true);
`));

test("projectiles touching a platform corner cannot pass through it", () => check(`
  world = new World(['0,1,0', '0,0,0', '0,0,6']);
  const ember = new Projectile(45, 49, 7);
  const water = new WaterProjectile(45, 49, 10);
  assert.equal(ember.hitsWall(), true);
  assert.equal(water.hitsWall(), true);
`));

test("vertical collisions choose the closest surface across staggered columns", () => check(`
  const grid = Array.from({length:20}, () => [0,0,0,0]);
  grid[5][1] = 2; grid[4][2] = 2;
  world = new World(grid.map(row => row.join(',')));
  mage.x = 75; mage.y = 80; mage.yVelocity = 200;
  mage.applyGravity(world.getNearByTiles(mage));
  assert.equal(mage.y, 150); assert.equal(mage.onGround, true);
  mage.y = 350; mage.yVelocity = -220;
  mage.applyGravity(world.getNearByTiles(mage));
  assert.equal(mage.y, 300); assert.equal(mage.yVelocity, 0);
`));

test("Endless mode only starts after a completed classic run", () => check(`
  state = GameState.START;
  startEndlessMode();
  assert.equal(state, GameState.START); assert.equal(endlessMode, false);
  state = GameState.VICTORY; coinScore = 80; playerLevel = 4; experience = 9;
  startEndlessMode();
  assert.equal(state, GameState.LOADING); assert.equal(endlessMode, true);
  assert.equal(coinScore, 80); assert.equal(playerLevel, 4); assert.equal(experience, 9);
  assert.equal(collectibles.some(item => item.type === 'gem'), false);
`));

test("editor and background pauses preserve cooldowns, sprint duration and simulation timers", () => check(`
  state = GameState.PLAYING;
  advanceGameClock(1000); advanceGameClock(1020);
  mage.triggerSprint(); mage.shootWater();
  const beforeTime = gameTime, beforeFrame = gameFrame;
  setEditorActive(true);
  advanceGameClock(2000); advanceGameClock(90000); frameCount += 900;
  assert.equal(gameTime, beforeTime); assert.equal(gameFrame, beforeFrame);
  assert.equal(mage.cooldownProgress('shoot'), 0); assert.equal(mage.isSprinting(), true);
  setGameHidden(true); setEditorActive(false); advanceGameClock(120000);
  assert.equal(gameTime, beforeTime); assert.equal(gameFrame, beforeFrame);
  setGameHidden(false); advanceGameClock(180000);
  assert.equal(gameTime, beforeTime); assert.equal(gameFrame, beforeFrame + 1);
  assert.ok(mage.cooldownProgress('shoot') < 1); assert.equal(mage.isSprinting(), true);
  advanceGameClock(180020); assert.equal(gameTime, beforeTime + 20);
`));

test("loading counts only visible game time, and a new level resets abilities relative to the game clock", () => check(`
  startNewGame(); advanceGameClock(1000); advanceGameClock(1250);
  assert.equal(gameTime - timerStart, 250);
  setEditorActive(true); advanceGameClock(50000);
  setEditorActive(false); advanceGameClock(80000); advanceGameClock(80750);
  assert.equal(gameTime - timerStart, 1000);
  state = GameState.PLAYING; gameFrame = 4000; resetMage();
  assert.equal(mage.cooldownProgress('shoot'), 1); assert.equal(mage.cooldownProgress('sprint'), 1);
  assert.equal(mage.isSprinting(), false);
`));

test("water can cancel an enemy shot before player damage is resolved", () => check(`
  state = GameState.PLAYING; coinScore = 10;
  world = new World(['0,0,0,0,0,0,0,6']); worldWidth = 400; worldHeight = 50;
  mage.x = 150; mage.y = 0;
  projectiles = [new Projectile(150, 0, 0)];
  waterProjectiles = [new WaterProjectile(150, 0, 0)];
  updateProjectiles(projectiles); updateProjectiles(waterProjectiles); resolveProjectileHits();
  assert.equal(projectiles.length, 0); assert.equal(waterProjectiles.length, 0); assert.equal(coinScore, 10);
`));

test("tile collision checks treat adjacent edges as non-overlapping and keep both projectile sizes", () => check(`
  world = new World(['0,1,0','0,0,6']);
  assert.equal(new Projectile(26,0,1).hitsWall(), false);
  assert.equal(new Projectile(27,0,1).hitsWall(), true);
  assert.equal(new WaterProjectile(30,0,1).hitsWall(), false);
  assert.equal(new WaterProjectile(31,0,1).hitsWall(), true);
  const enemy = new Projectile(0,0,1), water = new WaterProjectile(23,0,-1);
  assert.equal(water.collidesWith(enemy), true); water.x=24; assert.equal(water.collidesWith(enemy), false);
`));

test("rejected audio activation does not stop gameplay input", async () => {
  const context = createGameContext({ userStartAudio: () => Promise.reject(new Error("Audio denied")) });
  vm.runInContext(`state=GameState.PLAYING; handleKeyDown({code:'ArrowRight',target:{closest:()=>null},preventDefault(){}}); mage.setVelocity(); assert.equal(mage.xVelocity,7)`, context);
  await new Promise(resolve => setImmediate(resolve));
});
