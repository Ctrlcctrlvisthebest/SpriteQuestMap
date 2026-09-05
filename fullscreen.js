"use strict";

(() => {
  const shell = document.getElementById("game-shell");
  const enterButton = document.getElementById("game-fullscreen");
  const exitButton = document.getElementById("exit-fullscreen");
  const surroundingUI = [...document.querySelectorAll(".app-header, .game-bar, .game-help, .feedback-dock, #app-message")];
  const originalInert = surroundingUI.map(element => element.inert);
  let windowFullscreen = false;
  let changing = false;

  function isNativeFullscreen() {
    return (document.fullscreenElement || document.webkitFullscreenElement) === shell;
  }

  function syncFullscreen() {
    const active = isNativeFullscreen() || windowFullscreen;
    shell.classList.toggle("is-expanded", active);
    exitButton.hidden = !active;
    exitButton.textContent = I18n.t(windowFullscreen ? "fullscreen.windowExit" : "fullscreen.exit");
    enterButton.setAttribute("aria-pressed", String(active));
    surroundingUI.forEach((element, index) => { element.inert = active || originalInert[index]; });
    // Resizing the existing canvas preserves the level, score, and character position.
    if (typeof clearInputState === "function") clearInputState();
    shell.focus({ preventScroll: true });
  }

  async function enterFullscreen() {
    if (changing || isNativeFullscreen() || windowFullscreen) return;
    changing = true;
    enterButton.disabled = true;
    try {
      const request = shell.requestFullscreen || shell.webkitRequestFullscreen;
      if (!request) windowFullscreen = true;
      else {
        try { await request.call(shell); }
        catch { windowFullscreen = true; }
      }
      syncFullscreen();
    } finally {
      changing = false;
      enterButton.disabled = false;
    }
  }

  async function exitFullscreen() {
    if (changing) return;
    changing = true;
    try {
      if (isNativeFullscreen()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) await exit.call(document);
      }
      windowFullscreen = false;
    } catch {
      // Keep the exit control visible if the browser refuses; Escape can still exit.
    } finally {
      changing = false;
      syncFullscreen();
    }
  }

  document.addEventListener("languagechange", () => { exitButton.textContent = I18n.t(windowFullscreen ? "fullscreen.windowExit" : "fullscreen.exit"); });
  enterButton.addEventListener("click", enterFullscreen);
  exitButton.addEventListener("click", exitFullscreen);
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("webkitfullscreenchange", syncFullscreen);
  document.addEventListener("keydown", event => {
    if (windowFullscreen && event.key === "Escape") {
      event.preventDefault();
      exitFullscreen();
    }
    if (windowFullscreen && event.key === "Tab") {
      event.preventDefault();
      exitButton.focus();
    }
  });
})();
