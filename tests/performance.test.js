"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const { setupEditor } = require("./helpers/editor.js");
const { createGameContext } = require("./helpers/game.js");
const SpriteMap = require("../map-format.js");

async function denseEditor() {
  const draws = [];
  const ui = setupEditor({ onDraw: (method, args) => draws.push({ method, args }) });
  const csv = SpriteMap.toCSV(Array.from({ length: 80 }, () => Array(120).fill(2)));
  await ui.import({ name: "dense.csv", size: csv.length, text: async () => csv });
  ui.flush(); draws.length = 0;
  return { ui, draws, canvas: ui.$("editor-canvas") };
}

test("large-map cursor movement restores both preview cells without redrawing untouched terrain", async () => {
  const { ui, draws, canvas } = await denseEditor();
  await canvas.emit("pointermove", { clientX: 16, clientY: 16 }); ui.flush(); draws.length = 0;
  await canvas.emit("pointermove", { clientX: 48, clientY: 16 }); ui.flush();
  const images = draws.filter(call => call.method === "drawImage");
  assert.deepEqual(images.map(call => call.args.slice(1, 3)), [[0, 0], [32, 0], [32, 0]]);
  assert.equal(draws.filter(call => call.method === "clip").length, 2);
  draws.length = 0;
  for (let i = 0; i < 20; i++) { await canvas.emit("pointermove", { clientX: 49, clientY: 16 }); ui.flush(); }
  assert.equal(draws.length, 0);
  await canvas.emit("pointerleave"); ui.flush();
  assert.equal(draws.filter(call => call.method === "drawImage").length, 1);
});

test("fill, undo, grid and zoom invalidate the complete map while ordinary brush strokes stay local", async () => {
  const { ui, draws, canvas } = await denseEditor();
  await ui.document.querySelectorAll("[data-tile]").find(button => button.dataset.tile === 3).click();
  await ui.paint(2, 2);
  assert.ok(draws.filter(call => call.method === "drawImage").length < 10);
  assert.equal((await ui.grid())[2][2], 3);
  await ui.tools.find(button => button.dataset.tool === "fill").click(); ui.flush(); draws.length = 0;
  await canvas.emit("pointerdown", { clientX: 16, clientY: 16 });
  await canvas.emit("pointerup"); ui.flush();
  assert.ok(draws.filter(call => call.method === "drawImage").length >= 9600);
  assert.equal((await ui.grid())[79][119], 3);
  draws.length = 0; await ui.$("editor-undo").click(); ui.flush();
  assert.ok(draws.filter(call => call.method === "drawImage").length >= 9600);
  assert.equal((await ui.grid())[79][119], 2);
  for (const id of ["show-grid", "editor-zoom"]) {
    draws.length = 0;
    if (id === "editor-zoom") ui.$(id).value = "40";
    else ui.$(id).checked = false;
    await ui.$(id).emit("change"); ui.flush();
    assert.ok(draws.filter(call => call.method === "drawImage").length >= 9600);
  }
});

test("placing a start on an existing marker still removes other starts in an imported draft", async () => {
  const ui = setupEditor();
  const grid = SpriteMap.createMap(8, 6); grid[1][1] = grid[1][2] = 10;
  const csv = SpriteMap.toCSV(grid);
  await ui.import({ name: "starts.csv", size: csv.length, text: async () => csv }); ui.flush();
  await ui.document.querySelectorAll("[data-tile]").find(button => button.dataset.tile === 10).click();
  await ui.paint(1, 1);
  assert.deepEqual(SpriteMap.positions(await ui.grid(), 10), [{ col: 1, row: 1 }]);
});

test("offscreen objects skip drawing but retain collision, movement and enemy simulation", () => {
  const context = createGameContext({ push() { throw new Error("Offscreen draw"); } });
  vm.runInContext(`
    state = GameState.PLAYING; world = new World(['0,0,6']);
    const coin = new Collectible(3000, 0, {}, 50, 'coin');
    coin.display();
    assert.equal(coin.collidesWith({x:3000,y:0,spriteWidth:50,spriteHeight:50}), true);
    const shot = new Projectile(3000, 0, 7); shot.display(); shot.update(); assert.equal(shot.x, 3007);
    const enemy = new Enemy(3000, 0); enemy.display(); enemy.takeDamage(1); assert.equal(enemy.health, enemy.maxHealth - 1);
    assert.equal(isInView(1499, 0, 20, 20), true);
    assert.equal(isInView(-50, 0, 50, 50), false);
    assert.equal(isInView(-50, 0, 50, 50, 16), true);
    viewX = 3000; assert.equal(isInView(3000, 0, 50, 50), true);
  `, context);
});
