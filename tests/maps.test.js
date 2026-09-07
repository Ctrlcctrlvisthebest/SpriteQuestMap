"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const M = require("../map-format.js");
const { createGameContext: gameContext } = require("./helpers/game.js");
const root = path.resolve(__dirname, "..");

test("every original CSV imports and round-trips without losing tile positions", () => {
  const expected = [[41, 13], [49, 27], [41, 13], [35, 22]];
  for (let i = 1; i <= 4; i++) {
    const grid = M.parseCSV(fs.readFileSync(path.join(root, `assets/map${i}.csv`), "utf8"));
    assert.deepEqual([grid[0].length, grid.length], expected[i - 1]);
    assert.deepEqual(M.parseCSV(M.toCSV(grid)), grid);
    assert.doesNotThrow(() => M.validatePlayable(grid));
  }
});
test("spreadsheet BOM, CRLF, quoted values, empty cells, ragged rows, and final newline", () => {
  assert.deepEqual(M.parseCSV('\uFEFF"10",,6\r\n2,2\r\n\r\n'), [[10, 0, 6], [2, 2, 0]]);
});
test("malformed and excessive CSV files fail with a useful error", () => {
  for (const text of ["", " \n", "0,wat,6", "0,-1", "0,11", "0,1.5", "0,Infinity", "0,1\n\n2,2", "0,".repeat(M.MAX_COLS), "0\n".repeat(M.MAX_ROWS + 1)]) {
    assert.throws(() => M.parseCSV(text));
  }
  assert.throws(() => M.parseCSV(" ".repeat(M.MAX_FILE_BYTES + 1)), /1 MB/);
});
test("new map is playable and includes one start, an exit and a solid floor", () => {
  const grid = M.createMap(8, 6);
  assert.deepEqual(M.validatePlayable(grid), { col: 2, row: 3 });
  assert.equal(M.positions(grid, 10).length, 1);
  assert.equal(M.positions(grid, 6).length, 1);
  assert.ok(grid.at(-2).every(code => M.byCode[code].solid));
  for (const [w, h] of [[7, 6], [8, 5], [121, 8], [8, 81], [8.5, 6], [NaN, 6]]) assert.throws(() => M.createMap(w, h));
});
test("play validation catches missing exits, ambiguous starts and fully blocked maps", () => {
  assert.throws(() => M.validatePlayable([[10, 0], [2, 2]]), /gem/);
  assert.throws(() => M.validatePlayable([[10, 10, 6]]), /multiple/);
  assert.throws(() => M.validatePlayable([[1, 6], [2, 2]]), /spawn/);
  assert.deepEqual(M.validatePlayable([[0, 6], [2, 2]]), { col: 0, row: 0 });
});
test("flood fill respects boundaries and handles maximum map size without recursion", () => {
  const grid = [[0, 1, 0], [0, 1, 0], [1, 1, 0]];
  M.fill(grid, 0, 0, 3);
  assert.deepEqual(grid, [[3, 1, 0], [3, 1, 0], [1, 1, 0]]);
  const large = Array.from({ length: M.MAX_ROWS }, () => Array(M.MAX_COLS).fill(0));
  M.fill(large, 0, 0, 2); M.fill(large, 0, 0, 2);
  assert.ok(large.every(row => row.every(code => code === 2)));
});

test("custom play uses exact player/enemy positions, completes once, and restarts the same map", () => {
  vm.runInContext(`
    const grid = SpriteMap.createMap(12, 6);
    grid[3][4] = 9; grid[2][7] = 9;
    customMap = { lines: SpriteMap.toCSV(grid).trim().split("\\n"), spawn: SpriteMap.validatePlayable(grid), name: "test" };
    startNewGame();
    assert.equal(mage.x, 100); assert.equal(mage.y, 150);
    assert.equal(enemies.length, 2);
    assert.equal(enemies[0].x, 350); assert.equal(enemies[0].y, 100);
    assert.equal(enemies[1].x, 200); assert.equal(enemies[1].y, 150);
    assert.equal(world.isSolidAt(0, 200), true);
    assert.equal(world.isSolidAt(100, 150), false);
    const gem = collectibles.find(item => item.type === "gem");
    mage.x = gem.x; mage.y = gem.y; state = GameState.PLAYING;
    checkCollectibleCollisions(mage);
    assert.equal(state, GameState.VICTORY); assert.equal(mapNumber, 1);
    startNewGame();
    assert.equal(mage.x, 100); assert.equal(mage.y, 150);
    assert.equal(collectibles.filter(item => item.type === "gem").length, 1);
    assert.equal(state, GameState.LOADING);
    assert.equal(coinScore, 0);
    enemies[0].x = 0; resetEnemies(); assert.equal(enemies[0].x, 350);
    startEndlessMode(); assert.equal(endlessMode, false);
    customMap = null; startNewGame();
    assert.equal(mage.x, 250); assert.equal(mage.y, 400);
    assert.equal(enemies.length, 2);
  `, gameContext());
});
test("custom maps without enemy markers stay peaceful, even on Hard", () => {
  vm.runInContext(`
    const grid = SpriteMap.createMap(8, 6);
    customMap = { lines: SpriteMap.toCSV(grid).trim().split("\\n"), spawn: SpriteMap.validatePlayable(grid) };
    selectedDifficulty = Difficulty.HARD; startNewGame();
    assert.equal(enemies.length, 0);
  `, gameContext());
});
test("editor and form keyboard events do not trigger gameplay", () => {
  vm.runInContext(`
    state = GameState.START;
    const event = { code: "Space", target: { closest: () => null } };
    editorActive = true; handleKeyDown(event);
    assert.equal(state, GameState.START); assert.equal(heldKeys.size, 0);
    editorActive = false; event.target.closest = () => ({}); handleKeyDown(event);
    assert.equal(state, GameState.START); assert.equal(heldKeys.size, 0);
  `, gameContext());
});
test("Space preserves the original standard-game respawn behavior", () => {
  vm.runInContext(`
    state = GameState.PLAYING; coinScore = 25; playerLevel = 3;
    handleKeyDown({ code: "Space", repeat: false, target: { closest: () => null }, preventDefault() {} });
    assert.equal(resetMageRequested, true);
    assert.equal(coinScore, 25); assert.equal(playerLevel, 3);
    assert.equal(state, GameState.PLAYING);
  `, gameContext());
});

test("terrain drawing culls distant tiles without changing the collision grid", () => {
  const context = gameContext();
  vm.runInContext(`
    width = 1500; height = 800;
    const grid = Array.from({ length: 80 }, () => Array(120).fill(2));
    world = new World(grid.map(row => row.join(',')));
    const drawn = [];
    for (const column of world.tileGrid) for (const tile of column) tile.display = () => drawn.push([tile.x, tile.y]);
    viewX = 125; viewY = 75; world.drawTiles();
    assert.equal(drawn.length, 31 * 17);
    assert.ok(drawn.some(([x, y]) => x === 100 && y === 50));
    assert.ok(drawn.some(([x, y]) => x === 1600 && y === 850));
    assert.ok(!drawn.some(([x]) => x === 0 || x === 5900));
    assert.equal(world.isSolidAt(5900, 3900), true);
    drawn.length = 0; viewX = 4500; viewY = 3200; world.drawTiles();
    assert.equal(drawn.length, 30 * 16);
    assert.ok(drawn.some(([x, y]) => x === 5950 && y === 3950));
  `, context);
});

test("frost edges follow exposed ground and leave platform and hazard bounds unchanged", () => {
  vm.runInContext(`
    world = new World(['1,2,8,7,6', '3,4,0,0,0']);
    assert.equal(world.tileGrid[0][0].edges.top, true);
    assert.equal(world.tileGrid[0][0].edges.bottom, false);
    assert.equal(world.tileGrid[0][1].edges.top, false);
    assert.equal(world.tileGrid[0][1].edges.bottom, true);
    assert.equal(world.tileGrid[2][0].size, 50);
    assert.equal(world.isSolidAt(125, 25), true);
    assert.equal(world.isSolidAt(175, 25), false);
    const lava = collectibles.find(item => item.type === 'magma');
    assert.equal(lava.x, 150); assert.equal(lava.size, 50);
    assert.equal(lava.collidesWith({x: 150, y: 0, spriteWidth: 50, spriteHeight: 50}), true);
    assert.equal(lava.collidesWith({x: 200, y: 0, spriteWidth: 50, spriteHeight: 50}), false);
  `, gameContext());
});

test("CSV limit applies to UTF-8 bytes, not just JavaScript string length", () => {
  assert.throws(() => M.parseCSV('\u3000'.repeat(350000) + '0,6'), /1 MB/);
});

test("deterministic malformed-cell and round-trip checks cover varied map dimensions", () => {
  let seed = 12345;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  for (let iteration = 0; iteration < 100; iteration++) {
    const rows = 1 + random(80), cols = 1 + random(120);
    const grid = Array.from({length:rows}, () => Array.from({length:cols}, () => random(11)));
    assert.deepEqual(M.parseCSV(M.toCSV(grid)), grid);
    const row = random(rows), col = random(cols); grid[row][col] = 'invalid';
    assert.throws(() => M.parseCSV(M.toCSV(grid)), new RegExp('row '+(row+1)+', column '+(col+1)));
  }
});
