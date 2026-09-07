"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../fullscreen.js"), "utf8");

function setup(mode = "native") {
  function element() {
    const classes = new Set();
    return { listeners: {}, attributes: {}, hidden: false, inert: false,
      classList: { toggle(name, on) { on ? classes.add(name) : classes.delete(name); }, contains(name) { return classes.has(name); } },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { this.focused = true; document.activeElement = this; },
      getClientRects() { return this.hidden ? [] : [{}]; },
      addEventListener(name, handler) { this.listeners[name] = handler; }
    };
  }
  const shell = element(), enter = element(), exit = element();
  exit.hidden = true;
  const action = element(), hiddenAction = element();
  hiddenAction.hidden = true;
  shell.querySelectorAll = () => [exit, hiddenAction, action];
  const background = [element(), element()];
  background[1].inert = true;
  const document = { ...element(), fullscreenElement: null,
    getElementById: id => ({ "game-shell": shell, "game-fullscreen": enter, "exit-fullscreen": exit })[id],
    querySelectorAll: () => background
  };
  let requests = 0;
  if (mode !== "unsupported") shell.requestFullscreen = async () => {
    requests++;
    if (mode === "rejected") throw new Error("Fullscreen not allowed");
    document.fullscreenElement = shell;
    document.listeners.fullscreenchange();
  };
  document.exitFullscreen = async () => {
    document.fullscreenElement = null;
    document.listeners.fullscreenchange();
  };
  vm.runInNewContext(source, { document, I18n: require("../i18n.js"), clearInputState() {} });
  return { shell, enter, exit, action, background, document, requests: () => requests };
}

test("native fullscreen enters and exits, restoring background accessibility", async () => {
  const ui = setup();
  await ui.enter.listeners.click();
  assert.equal(ui.document.fullscreenElement, ui.shell);
  assert.equal(ui.shell.classList.contains("is-expanded"), true);
  assert.equal(ui.exit.hidden, false);
  assert.equal(ui.enter.attributes["aria-pressed"], "true");
  assert.equal(ui.background[0].inert, true);
  await ui.exit.listeners.click();
  assert.equal(ui.shell.classList.contains("is-expanded"), false);
  assert.equal(ui.exit.hidden, true);
  assert.equal(ui.background[0].inert, false);
  assert.equal(ui.background[1].inert, true);
});
test("browser Escape/fullscreenchange restores ordinary mode", async () => {
  const ui = setup();
  await ui.enter.listeners.click();
  ui.document.fullscreenElement = null;
  ui.document.listeners.fullscreenchange();
  assert.equal(ui.exit.hidden, true);
  assert.equal(ui.enter.attributes["aria-pressed"], "false");
  assert.equal(ui.background[0].inert, false);
});
for (const mode of ["unsupported", "rejected"]) test(`${mode} native fullscreen falls back to an escapable window view`, async () => {
  const ui = setup(mode);
  await ui.enter.listeners.click();
  assert.equal(ui.shell.classList.contains("is-expanded"), true);
  assert.match(ui.exit.textContent, /window fullscreen/);
  let prevented = false;
  ui.document.listeners.keydown({ key: "Escape", preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(ui.shell.classList.contains("is-expanded"), false);
  assert.equal(ui.exit.hidden, true);
});
test("repeated entry clicks do not request fullscreen twice", async () => {
  const ui = setup();
  await Promise.all([ui.enter.listeners.click(), ui.enter.listeners.click()]);
  assert.equal(ui.requests(), 1);
  assert.equal(ui.enter.disabled, false);
});
test("failed native exit retains the visible exit control", async () => {
  const ui = setup();
  await ui.enter.listeners.click();
  ui.document.exitFullscreen = async () => { throw new Error("Exit denied"); };
  await ui.exit.listeners.click();
  assert.equal(ui.exit.hidden, false);
  assert.equal(ui.shell.classList.contains("is-expanded"), true);
});


test("fallback fullscreen cycles focus through visible touch controls and skips hidden buttons", async () => {
  const ui = setup("unsupported");
  await ui.enter.listeners.click();
  const tab = shiftKey => ui.document.listeners.keydown({ key: "Tab", shiftKey, preventDefault() {} });
  tab(true); assert.equal(ui.document.activeElement, ui.action);
  tab(false); assert.equal(ui.document.activeElement, ui.exit);
  tab(false); assert.equal(ui.document.activeElement, ui.action);
  tab(false); assert.equal(ui.document.activeElement, ui.exit);
  tab(true); assert.equal(ui.document.activeElement, ui.action);
});
