"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const SpriteMap = require("../map-format.js");

function setup() {
  function element(action) {
    const classes = new Set(), captures = new Set(), listeners = {};
    return {
      dataset: { action }, hidden: false, textContent: "", value: "NORMAL", style: { setProperty() {} },
      classList: { add: n => classes.add(n), remove: n => classes.delete(n), contains: n => classes.has(n), toggle(n, on) { on ? classes.add(n) : classes.delete(n); } },
      setAttribute() {}, scrollIntoView() {}, getBoundingClientRect: () => ({ height: 52 }),
      setPointerCapture: id => captures.add(id), hasPointerCapture: id => captures.has(id),
      releasePointerCapture(id) { captures.delete(id); this.emit("lostpointercapture", { pointerId: id }); },
      addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
      emit(type, args = {}) { for (const fn of listeners[type] || []) fn({ button: 0, preventDefault() {}, ...args }); }
    };
  }
  const ids = Object.fromEntries(["game-shell", "touch-controls", "touch-launch", "touch-status", "touch-start", "touch-menu", "touch-endless", "touch-difficulty"].map(id => [id, element()]));
  const buttons = Object.fromEntries(["left", "right", "jump", "shoot", "sprint"].map(action => [action, element(action)]));
  ids["touch-controls"].querySelectorAll = () => Object.values(buttons);
  ids["game-shell"].querySelector = () => element();
  const media = { ...element(), matches: true };
  const window = { ...element(), matchMedia: () => media };
  const document = { ...element(), body: element(), getElementById: id => ids[id] };
  const pending = [];
  const context = vm.createContext({ assert, SpriteMap, I18n: require("../i18n.js"), window, document,
    floor: Math.floor, round: Math.round, min: Math.min, max: Math.max,
    constrain: (n, lo, hi) => Math.max(lo, Math.min(hi, n)), millis: () => 5000, frameCount: 100,
    userStartAudio() {}, getAudioContext: () => ({ state: "suspended" }),
    getComputedStyle: () => ({ position: "static" }), ResizeObserver: class { observe() {} },
    requestAnimationFrame: fn => pending.push(fn), queueMicrotask: fn => pending.push(fn), setTimeout: fn => pending.push(fn)
  });
  for (const file of ["sketch.js", "touch.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context);
  pending.splice(0).forEach(fn => fn());
  vm.runInContext(`
    gameReady = true; mage = new Mage(250, 400);
    for (const tile of SpriteMap.tiles) if (tile.image) images[tile.image] = {};
    mapLines[1] = ["0,0,0,0,0,0,0,0,0,6", "2,2,2,2,2,2,2,2,2,2"];
    state = GameState.PLAYING; TouchUI.sync();
  `, context);
  return { context, buttons, ids, window, document, media, run: source => vm.runInContext(source, context) };
}

test("multiple fingers can move, jump and shoot; cancelling one does not cancel the others", () => {
  const ui = setup();
  ui.run("mage.onGround = true");
  ui.buttons.left.emit("pointerdown", { pointerId: 1 });
  ui.buttons.jump.emit("pointerdown", { pointerId: 2 });
  ui.buttons.shoot.emit("pointerdown", { pointerId: 3 });
  ui.run("mage.setVelocity(); assert.equal(mage.xVelocity, -7); assert.equal(mage.yVelocity, -13); assert.equal(waterProjectiles.length, 1)");
  ui.buttons.jump.emit("pointerup", { pointerId: 2 });
  ui.buttons.shoot.emit("pointercancel", { pointerId: 3 });
  ui.run("assert.equal(hasTouchAction('shoot'), false); mage.setVelocity(); assert.equal(mage.xVelocity, -7)");
  ui.buttons.left.emit("lostpointercapture", { pointerId: 1 });
  ui.run("mage.setVelocity(); assert.equal(mage.xVelocity, 0); assert.equal(touchActions.size, 0)");
  assert.equal(ui.buttons.left.classList.contains("is-held"), false);
});

test("two pointers on the same direction and a physical key release independently", () => {
  const ui = setup();
  ui.buttons.right.emit("pointerdown", { pointerId: 1 });
  ui.buttons.right.emit("pointerdown", { pointerId: 2 });
  ui.buttons.right.emit("pointerup", { pointerId: 1 });
  assert.equal(ui.buttons.right.classList.contains("is-held"), true);
  ui.run("mage.setVelocity(); assert.equal(mage.xVelocity, 7); heldKeys.add('ArrowRight')");
  ui.buttons.right.emit("pointerup", { pointerId: 2 });
  ui.run("mage.setVelocity(); assert.equal(mage.xVelocity, 7); heldKeys.clear(); mage.setVelocity(); assert.equal(mage.xVelocity, 0)");
});

test("hold-to-fire respects the original cooldown, and sprint follows touch direction", () => {
  const ui = setup();
  ui.buttons.shoot.emit("pointerdown", { pointerId: 1 });
  ui.run("mage.shootWater(); assert.equal(waterProjectiles.length, 1); frameCount += BASE_SHOT_COOLDOWN; if (hasTouchAction('shoot')) mage.shootWater(); assert.equal(waterProjectiles.length, 2)");
  ui.buttons.left.emit("pointerdown", { pointerId: 2 });
  ui.buttons.sprint.emit("pointerdown", { pointerId: 3 });
  ui.run("mage.setVelocity(); assert.equal(mage.xVelocity, -16); assert.equal(mage.isSprinting(), true)");
});

for (const event of ["resize", "pagehide"]) test(`${event} releases every held pointer and visual state`, () => {
  const ui = setup();
  ui.buttons.right.emit("pointerdown", { pointerId: 5 });
  ui.window.emit(event);
  ui.run("assert.equal(touchActions.size, 0); mage.setVelocity(); assert.equal(mage.xVelocity, 0)");
  assert.equal(ui.buttons.right.hasPointerCapture(5), false);
  assert.equal(ui.buttons.right.classList.contains("is-held"), false);
});

test("menu and restart clear touch input; difficulty and controls follow the game state", () => {
  const ui = setup();
  ui.buttons.right.emit("pointerdown", { pointerId: 9 });
  ui.ids["touch-menu"].emit("click");
  ui.run("assert.equal(state, GameState.START); assert.equal(touchActions.size, 0)");
  assert.equal(ui.ids["touch-controls"].hidden, true);
  assert.equal(ui.ids["touch-launch"].hidden, false);
  ui.ids["touch-difficulty"].value = "HARD";
  ui.ids["touch-difficulty"].emit("change");
  ui.ids["touch-start"].emit("click");
  ui.run("assert.equal(selectedDifficulty, Difficulty.HARD); assert.equal(state, GameState.LOADING); assert.equal(coinScore, 0); assert.equal(pressTouchAction('jump', 3), false)");
  assert.equal(ui.ids["touch-start"].disabled, true);
  ui.run("state = GameState.PLAYING; TouchUI.sync(); editorActive = true; assert.equal(pressTouchAction('shoot', 7), false)");
  assert.equal(ui.ids["touch-controls"].hidden, false);
});

test("classic victory exposes Endless mode but a custom map victory does not", () => {
  const ui = setup();
  ui.run("state = GameState.VICTORY; TouchUI.sync()");
  assert.equal(ui.ids["touch-endless"].hidden, false);
  ui.run("customMap = {}; TouchUI.sync()");
  assert.equal(ui.ids["touch-endless"].hidden, true);
  ui.ids["touch-endless"].emit("click");
  ui.run("assert.equal(endlessMode, false)");
});
