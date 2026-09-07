"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../i18n.js"), "utf8");
function locale(saved, blocked = false) {
  const store = new Map(saved ? [["spritequest-language", saved]] : []);
  const context = vm.createContext({ module: { exports: {} }, navigator: { language: "zh-CN" }, localStorage: {
    getItem(key) { if (blocked) throw new Error("Storage unavailable"); return store.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error("Storage unavailable"); store.set(key, value); }
  } });
  vm.runInContext(source, context);
  return { api: context.module.exports, store };
}
test("new visitors get English even if their browser language is Chinese", () => {
  const { api } = locale();
  assert.equal(api.getLanguage(), "en");
  assert.equal(api.t("nav.editor"), "Map editor");
});
test("explicit language choice persists and is restored", () => {
  const { api, store } = locale();
  api.setLanguage("zh");
  assert.equal(api.t("nav.editor"), "地图编辑器");
  assert.equal(store.get("spritequest-language"), "zh");
  assert.equal(locale(store.get("spritequest-language")).api.getLanguage(), "zh");
  api.setLanguage("en");
  assert.equal(store.get("spritequest-language"), "en");
});
test("invalid or inaccessible preferences fall back to English without disabling switching", () => {
  assert.equal(locale("fr").api.getLanguage(), "en");
  const { api } = locale("zh", true);
  assert.equal(api.getLanguage(), "en");
  assert.doesNotThrow(() => api.setLanguage("zh"));
  assert.equal(api.t("feedback"), "反馈");
  api.setLanguage("unsupported");
  assert.equal(api.getLanguage(), "zh");
});
test("existing validation errors can be rendered in the newly selected language", () => {
  const { api } = locale();
  const error = api.error("error.invalidCell", { row: 3, col: 7 });
  assert.match(error.message, /row 3, column 7/);
  api.setLanguage("zh");
  assert.match(api.errorText(error), /第 3 行、第 7 列/);
  assert.equal(api.t("game.custom", { name: "My 中文 map <test>" }), "自定义地图 · My 中文 map <test>");
});
test("all translations are complete and preserve their interpolation parameters", () => {
  const { api } = locale();
  for (const [key, values] of Object.entries(api.messages)) {
    assert.equal(values.length, 2, key);
    assert.ok(values.every(value => typeof value === "string" && value.length), key);
    const tokens = text => JSON.stringify((text.match(/\{\w+\}/g) || []).sort());
    assert.equal(tokens(values[0]), tokens(values[1]), key);
  }
  for (const file of ["index.html", "editor.js", "fullscreen.js", "sketch.js", "map-format.js", "touch.js"]) {
    const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    for (const match of text.matchAll(/(?:data-i18n(?:-title|-aria-label|-content)?="|(?:I18n|locale)\.(?:t|error)\(")([\w.]+)"/g)) {
      assert.ok(api.messages[match[1]], `${file}: ${match[1]}`);
    }
  }
});
test("tile labels and errors localize without changing exported map codes", () => {
  const api = require("../i18n.js"), map = require("../map-format.js");
  const grid = map.createMap(8, 6), csv = map.toCSV(grid);
  api.setLanguage("zh");
  assert.equal(map.byCode[10].name, "玩家起点");
  assert.throws(() => map.parseCSV("0,11"), /第 1 行、第 2 列/);
  api.setLanguage("en");
  assert.equal(map.byCode[10].name, "Player start");
  assert.throws(() => map.parseCSV("0,11"), /row 1, column 2/);
  assert.equal(map.toCSV(grid), csv);
});
