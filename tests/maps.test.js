"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const M = require("../map-format.js");
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

function gameContext() {
  const context = vm.createContext({
    assert, SpriteMap: M, I18n: require("../i18n.js"), floor: Math.floor, round: Math.round, min: Math.min, max: Math.max,
    constrain: (n, low, high) => Math.max(low, Math.min(high, n)), millis: () => 5000,
    frameCount: 100, sounds: {}, userStartAudio: () => {}, getAudioContext: () => ({ state: "suspended" })
  });
  vm.runInContext(fs.readFileSync(path.join(root, "sketch.js"), "utf8"), context);
  vm.runInContext(`
    gameReady = true;
    mage = new Mage(250, 400);
    for (const tile of SpriteMap.tiles) if (tile.image) images[tile.image] = {};
    mapLines[1] = ["0,0,0,0,0,0,0,0,0,6", "2,2,2,2,2,2,2,2,2,2"];
  `, context);
  return context;
}
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
