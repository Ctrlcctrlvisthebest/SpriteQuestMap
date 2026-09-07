"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const SpriteMap = require("../../map-format.js");
const root = path.resolve(__dirname, "../..");

function createGameContext(overrides = {}) {
  const context = vm.createContext({
    assert, SpriteMap, I18n: require("../../i18n.js"),
    floor: Math.floor, round: Math.round, min: Math.min, max: Math.max, abs: Math.abs,
    constrain: (n, low, high) => Math.max(low, Math.min(high, n)), millis: () => 5000,
    frameCount: 100, width: 1500, height: 800,
    userStartAudio() {}, getAudioContext: () => ({ state: "suspended" }), ...overrides
  });
  vm.runInContext(fs.readFileSync(path.join(root, "sketch.js"), "utf8"), context);
  vm.runInContext(`
    gameReady = true;
    mage = new Mage(250, 400);
    for (const tile of SpriteMap.tiles) if (tile.image) images[tile.image] = {};
    for (let i = 1; i <= MAP_COUNT; i++) mapLines[i] = ["0,0,0,0,0,0,0,0,0,6", "2,2,2,2,2,2,2,2,2,2"];
  `, context);
  return context;
}
module.exports = { createGameContext, root };
