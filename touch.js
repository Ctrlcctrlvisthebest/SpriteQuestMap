"use strict";

const TouchUI = (() => {
  const $ = id => document.getElementById(id);
  const shell = $("game-shell"), controls = $("touch-controls"), launch = $("touch-launch");
  const header = shell.querySelector(".touch-header"), status = $("touch-status");
  const start = $("touch-start"), menu = $("touch-menu"), endless = $("touch-endless"), difficulty = $("touch-difficulty");
  const buttons = [...controls.querySelectorAll("[data-action]")];
  const pointers = new Map();
  const media = window.matchMedia(TOUCH_LAYOUT_QUERY);
  let lastState;

  function write(element, value, property = "textContent") { if (element[property] !== value) element[property] = value; }
  function release(pointer) {
    const button = pointers.get(pointer);
    pointers.delete(pointer);
    releaseTouchAction(pointer);
    if (!button) return;
    button.classList.toggle("is-held", [...pointers.values()].includes(button));
    if (typeof pointer === "number" && button.hasPointerCapture(pointer)) button.releasePointerCapture(pointer);
  }
  function clear() { [...pointers.keys()].forEach(release); }
  function press(button, pointer) {
    if (!touchLayout || !pressTouchAction(button.dataset.action, pointer)) return;
    pointers.set(pointer, button);
    button.classList.add("is-held");
    enableAudio();
  }
  for (const button of buttons) {
    button.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      press(button, event.pointerId);
      if (pointers.has(event.pointerId)) button.setPointerCapture(event.pointerId);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, event => release(event.pointerId));
    }
    // Native button keyboard activation also supports holding an action.
    button.addEventListener("keydown", event => {
      if (!["Space", "Enter"].includes(event.code)) return;
      event.preventDefault();
      if (!event.repeat) press(button, `key:${button.dataset.action}:${event.code}`);
    });
    button.addEventListener("keyup", event => {
      if (!["Space", "Enter"].includes(event.code)) return;
      event.preventDefault(); release(`key:${button.dataset.action}:${event.code}`);
    });
    button.addEventListener("blur", () => ["Space", "Enter"].forEach(code => release(`key:${button.dataset.action}:${code}`)));
    button.addEventListener("contextmenu", event => event.preventDefault());
    button.addEventListener("click", event => {
      // Assistive technology can activate a button without a preceding pointer/key event.
      if (event.detail === 0 && !pointers.size) {
        const pointer = Symbol("assistive");
        press(button, pointer);
        setTimeout(() => release(pointer), 100);
      }
    });
  }
  start.addEventListener("click", () => { startNewGame(); enableAudio(); sync(); });
  menu.addEventListener("click", () => { returnToMenu(); sync(); });
  endless.addEventListener("click", () => {
    startEndlessMode(); enableAudio(); sync();
  });
  difficulty.addEventListener("change", () => {
    if ([GameState.PLAYING, GameState.LOADING].includes(state) || !Object.values(Difficulty).includes(difficulty.value)) return;
    selectedDifficulty = difficulty.value;
    sync();
  });

  function measureChrome() {
    // Fullscreen's canvas uses the remaining height, including on browsers with a dynamic address bar.
    const chrome = [header, launch, controls].reduce((height, element) => {
      return height + (getComputedStyle(element).position === "absolute" ? 0 : element.getBoundingClientRect().height);
    }, 0);
    shell.style.setProperty("--touch-chrome", `${Math.ceil(chrome)}px`);
    shell.style.setProperty("--touch-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
  }
  function sync() {
    if (!touchLayout) return;
    const playing = gameReady && state === GameState.PLAYING;
    const loading = !gameReady || state === GameState.LOADING;
    if (state !== lastState) {
      if (!playing) clearInputState();
      lastState = state;
      if (playing && !editorActive && !shell.classList.contains("is-expanded")) {
        requestAnimationFrame(() => shell.scrollIntoView({ block: "nearest" }));
      }
    }
    write(controls, !playing, "hidden");
    write(launch, playing, "hidden");
    write(menu, !playing, "hidden");
    write(start, loading, "disabled");
    write(difficulty, loading, "disabled");
    write(difficulty, selectedDifficulty, "value");
    write(endless, state !== GameState.VICTORY || !!customMap, "hidden");
    write(start, I18n.t(loading ? "touch.loading" : state === GameState.START ? "touch.start" : "touch.again"));
    if (playing) {
      write(status, [I18n.t("hud.score", { value: coinScore }), endlessMode ? I18n.t("hud.endless") : customMap ? I18n.t("hud.custom") : I18n.t("hud.level", { value: mapNumber }), I18n.t("touch.level", { value: playerLevel }), I18n.t("hud.xp", { value: experience, next: getExperienceToNextLevel() })].join(" · "));
    } else {
      write(status, loading ? I18n.t("touch.loading") : state === GameState.VICTORY ? I18n.t("screen.win") + " · " + I18n.t("hud.score", { value: coinScore }) : state === GameState.LOSE ? I18n.t("screen.lose") : "SpriteQuest");
    }
    for (const button of buttons) {
      const action = button.dataset.action;
      if (!playing || !["shoot", "sprint"].includes(action)) continue;
      const progress = mage.cooldownProgress(action);
      const value = progress.toFixed(2);
      if (button.style.getPropertyValue("--ready") !== value) button.style.setProperty("--ready", value);
      const label = I18n.t(action === "shoot" ? "hud.shot" : "hud.sprint") + ": " + I18n.t(progress >= 1 ? "hud.ready" : "hud.recharging");
      if (button.getAttribute("aria-label") !== label) button.setAttribute("aria-label", label);
    }
  }
  function updateLayout() {
    touchLayout = media.matches;
    document.body.classList.toggle("touch-layout", touchLayout);
    clearInputState();
    sync();
    measureChrome();
  }
  media.addEventListener("change", updateLayout);
  window.addEventListener("resize", clearInputState);
  window.addEventListener("pagehide", clearInputState);
  window.addEventListener("spritequest-ready", sync);
  document.addEventListener("languagechange", sync);
  const observer = new ResizeObserver(measureChrome);
  [header, launch, controls].forEach(element => observer.observe(element));
  // Wait until the binding is initialized: clearInputState also calls TouchUI.clear().
  queueMicrotask(updateLayout);
  return { sync, clear };
})();
