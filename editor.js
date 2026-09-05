"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("editor-canvas"), ctx = canvas.getContext("2d");
  const viewport = $("map-viewport"), nameInput = $("map-name");
  const DRAFT_KEY = "spritequest-map-draft-v1";
  let grid = SpriteMap.createMap(), selected = 2, tool = "paint", tileSize = 32;
  let hover = null, stroke = null, lastCell = null, drawingPointer = null, strokeCode = null, strokeIsFill = false;
  let undo = [], redo = [], importMode = "edit", renderPending = false, messageTimer, pausedAt = null;
  const sprites = {};

  function message(text, error = false) {
    const element = $("app-message");
    element.querySelector("span").textContent = text;
    element.classList.toggle("error", error);
    element.hidden = false;
    clearTimeout(messageTimer);
    if (!error) messageTimer = setTimeout(() => { element.hidden = true; }, 4500);
  }
  $("app-message").querySelector("button").onclick = () => { $("app-message").hidden = true; };

  function snapshot() { return { grid: SpriteMap.clone(grid), name: nameInput.value }; }
  function persist() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ csv: SpriteMap.toCSV(grid), name: nameInput.value }));
      $("draft-status").textContent = "草稿已保存到本机";
    } catch {
      $("draft-status").textContent = "无法保存草稿，请导出 CSV";
    }
  }
  function updateControls() {
    $("editor-undo").disabled = !undo.length;
    $("editor-redo").disabled = !redo.length;
    $("map-size").textContent = `${grid[0].length} × ${grid.length} 格`;
  }
  function commit(before) {
    if (before.name === nameInput.value && SpriteMap.toCSV(before.grid) === SpriteMap.toCSV(grid)) return;
    undo.push(before);
    if (undo.length > 60) undo.shift();
    redo = [];
    persist(); updateControls(); requestRender();
  }
  function restore(saved) {
    grid = SpriteMap.clone(saved.grid);
    nameInput.value = saved.name;
    hover = null;
    $("map-cols").value = grid[0].length;
    $("map-rows").value = grid.length;
    updateControls(); persist(); requestRender();
  }
  function undoEdit() {
    finishStroke();
    if (!undo.length) return;
    redo.push(snapshot()); restore(undo.pop());
  }
  function redoEdit() {
    finishStroke();
    if (!redo.length) return;
    undo.push(snapshot()); restore(redo.pop());
  }
  function replaceMap(next, name) {
    finishStroke();
    const before = snapshot();
    grid = SpriteMap.clone(next); nameInput.value = name;
    hover = null;
    $("map-cols").value = grid[0].length; $("map-rows").value = grid.length;
    $("editor-zoom").value = "fit";
    viewport.scrollTo(0, 0);
    commit(before); requestRender(); updateControls();
  }
  function setTool(next) {
    tool = next;
    document.querySelectorAll("[data-tool]").forEach(button => {
      button.classList.toggle("active", button.dataset.tool === tool);
      button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
    });
    requestRender();
  }
  function selectTile(code) {
    selected = code;
    document.querySelectorAll("[data-tile]").forEach(button => {
      button.classList.toggle("active", Number(button.dataset.tile) === code);
      button.setAttribute("aria-pressed", String(Number(button.dataset.tile) === code));
    });
    $("selected-name").textContent = SpriteMap.byCode[code].name;
    $("selected-description").textContent = SpriteMap.byCode[code].description;
    if (tool === "erase" || code === 10) setTool("paint");
    requestRender();
  }
  for (const group of ["地形", "物件", "角色"]) {
    const wrapper = document.createElement("div");
    const label = document.createElement("div"); label.className = "palette-label"; label.textContent = group;
    const palette = document.createElement("div"); palette.className = "palette-grid";
    for (const tile of SpriteMap.tiles.filter(item => item.group === group)) {
      const button = document.createElement("button");
      button.className = "tile-button"; button.dataset.tile = tile.code;
      button.title = tile.description; button.setAttribute("aria-label", tile.name);
      if (tile.image) {
        const img = new Image(); img.src = `assets/${tile.image}.png`; img.alt = "";
        img.onload = requestRender;
        img.onerror = () => message(`无法加载${tile.name}贴图，请刷新页面。`, true);
        sprites[tile.code] = img; button.append(img);
      } else {
        const empty = document.createElement("span"); empty.className = "empty-tile"; button.append(empty);
      }
      const text = document.createElement("span"); text.textContent = tile.name; button.append(text);
      button.onclick = () => selectTile(tile.code);
      palette.append(button);
    }
    wrapper.append(label, palette); $("tile-palette").append(wrapper);
  }

  function requestRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => { renderPending = false; render(); });
  }
  function render() {
    if ($("editor-zoom").value === "fit" && viewport.clientWidth && viewport.clientHeight) {
      tileSize = Math.max(4, Math.min(40, Math.floor(Math.min((viewport.clientWidth - 2) / grid[0].length, (viewport.clientHeight - 2) / grid.length))));
    }
    const w = grid[0].length * tileSize, h = grid.length * tileSize;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#64c8ff"; ctx.fillRect(0, 0, w, h);
    grid.forEach((row, y) => row.forEach((value, x) => drawTile(value, x, y)));
    if ($("show-grid").checked) {
      ctx.beginPath(); ctx.strokeStyle = "rgba(18, 71, 99, .18)"; ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += tileSize) { ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, h); }
      for (let y = 0; y <= h; y += tileSize) { ctx.moveTo(0, y + .5); ctx.lineTo(w, y + .5); }
      ctx.stroke();
    }
    if (hover) {
      const code = tool === "erase" ? 0 : selected;
      ctx.globalAlpha = .55;
      if (code) drawTile(code, hover.col, hover.row);
      else { ctx.fillStyle = "#ff9b9b"; ctx.fillRect(hover.col * tileSize, hover.row * tileSize, tileSize, tileSize); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = code ? "#f2ffdb" : "#ff6464"; ctx.lineWidth = 2;
      ctx.strokeRect(hover.col * tileSize + 1, hover.row * tileSize + 1, tileSize - 2, tileSize - 2);
    }
  }
  function drawTile(code, col, row) {
    const sprite = sprites[code];
    if (sprite?.complete && sprite.naturalWidth) ctx.drawImage(sprite, col * tileSize, row * tileSize, tileSize, tileSize);
    if (code === 10 || code === 9) {
      ctx.strokeStyle = code === 10 ? "#dafdaf" : "#f57778"; ctx.lineWidth = 2;
      ctx.strokeRect(col * tileSize + 1, row * tileSize + 1, tileSize - 2, tileSize - 2);
    }
  }
  function cellAt(event) {
    const rect = canvas.getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / tileSize), row = Math.floor((event.clientY - rect.top) / tileSize);
    return col >= 0 && row >= 0 && row < grid.length && col < grid[0].length ? { col, row } : null;
  }
  function setHover(cell) {
    hover = cell;
    $("cursor-position").textContent = cell ? `第 ${cell.col + 1} 列 · 第 ${cell.row + 1} 行 · ${SpriteMap.byCode[grid[cell.row][cell.col]].name}` : "点击或拖动绘制 · 右键擦除 · 滚动查看地图";
    requestRender();
  }
  function put(cell, code) {
    if (code === 10) SpriteMap.positions(grid, 10).forEach(pos => { grid[pos.row][pos.col] = 0; });
    grid[cell.row][cell.col] = code;
  }
  function paintLine(from, to, code) {
    const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
    for (let i = 0; i <= steps; i++) {
      const fraction = steps ? i / steps : 0;
      put({ col: Math.round(from.col + (to.col - from.col) * fraction), row: Math.round(from.row + (to.row - from.row) * fraction) }, code);
    }
  }
  function finishStroke() {
    if (!stroke) return;
    const before = stroke, pointer = drawingPointer;
    stroke = null; drawingPointer = null; lastCell = null;
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    commit(before);
  }
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  canvas.addEventListener("pointerdown", event => {
    if (drawingPointer !== null || ![0, 2].includes(event.button)) return;
    const cell = cellAt(event); if (!cell) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    stroke = snapshot(); drawingPointer = event.pointerId;
    strokeCode = event.button === 2 || tool === "erase" ? 0 : selected;
    canvas.setPointerCapture(event.pointerId);
    strokeIsFill = tool === "fill" && event.button !== 2 && strokeCode !== 10;
    if (strokeIsFill) SpriteMap.fill(grid, cell.col, cell.row, strokeCode);
    else put(cell, strokeCode);
    lastCell = cell; setHover(cell);
  });
  canvas.addEventListener("pointermove", event => {
    if (drawingPointer !== null && event.pointerId !== drawingPointer) return;
    const cell = cellAt(event);
    if (stroke && cell && !strokeIsFill) {
      paintLine(lastCell || cell, cell, strokeCode); lastCell = cell;
    }
    if (!cell) lastCell = null;
    setHover(cell);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, finishStroke);
  canvas.addEventListener("pointerleave", () => { if (!stroke) setHover(null); });
  window.addEventListener("blur", finishStroke);
  document.querySelectorAll("[data-tool]").forEach(button => { button.onclick = () => setTool(button.dataset.tool); });
  $("editor-undo").onclick = undoEdit; $("editor-redo").onclick = redoEdit;
  $("show-grid").onchange = requestRender;
  $("editor-zoom").onchange = () => {
    if ($("editor-zoom").value === "fit") { render(); viewport.scrollTo(0, 0); return; }
    const ratio = Number($("editor-zoom").value) / tileSize;
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) * ratio;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) * ratio;
    tileSize = Number($("editor-zoom").value); render();
    viewport.scrollTo(centerX - viewport.clientWidth / 2, centerY - viewport.clientHeight / 2);
  };
  new ResizeObserver(requestRender).observe(viewport);
  nameInput.addEventListener("input", persist);
  $("new-map").onclick = () => {
    try { replaceMap(SpriteMap.createMap(Number($("map-cols").value), Number($("map-rows").value)), "我的冒险"); message("新地图已创建；可以撤销回到上一张地图。"); }
    catch (error) { message(error.message, true); }
  };
  $("load-template").onclick = async () => {
    const button = $("load-template"), number = $("map-template").value;
    button.disabled = true;
    try {
      const response = await fetch(`assets/map${number}.csv`);
      if (!response.ok) throw new Error("无法载入内置地图，请稍后再试。");
      replaceMap(SpriteMap.parseCSV(await response.text()), `关卡 ${number} · 我的改编`);
      message("内置地图已载入，可以直接修改。");
    } catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  };

  function showView(editing) {
    finishStroke(); clearInputState();
    if (editing && !editorActive && gameReady) pausedAt = millis();
    if (!editing && editorActive && gameReady && pausedAt !== null) { timerStart += millis() - pausedAt; pausedAt = null; }
    editorActive = editing;
    $("editor-view").hidden = !editing; $("game-view").hidden = editing;
    for (const [id, active] of [["nav-editor", editing], ["nav-game", !editing]]) {
      $(id).classList.toggle("active", active);
      if (active) $(id).setAttribute("aria-current", "page"); else $(id).removeAttribute("aria-current");
    }
    document.activeElement?.blur();
    if (editing) requestRender();
  }
  function updateGameBar() {
    $("game-map-name").textContent = customMap ? `自定义地图 · ${customMap.name}` : "经典冒险 · 4 个关卡";
    $("classic-game").hidden = !customMap; $("back-editor").hidden = !customMap;
  }
  function playMap() {
    finishStroke();
    if (!gameReady) { message("游戏素材正在加载，请稍候再试玩。", true); return; }
    try {
      const spawn = SpriteMap.validatePlayable(grid);
      showView(false);
      customMap = { lines: SpriteMap.toCSV(grid).trimEnd().split("\n"), spawn, name: nameInput.value.trim() || "我的冒险" };
      updateGameBar(); startNewGame();
      userStartAudio();
    } catch (error) { message(error.message, true); }
  }
  $("nav-editor").onclick = () => showView(true);
  $("nav-game").onclick = () => showView(false);
  $("back-editor").onclick = () => showView(true);
  $("editor-play").onclick = playMap;
  $("restart-game").onclick = () => { document.activeElement?.blur(); startNewGame(); userStartAudio(); };
  $("classic-game").onclick = () => { customMap = null; updateGameBar(); document.activeElement?.blur(); startNewGame(); };
  function ready() { $("editor-play").disabled = false; $("restart-game").disabled = false; }
  window.addEventListener("spritequest-ready", ready);
  if (gameReady) ready();

  function chooseCSV(mode) { importMode = mode; $("csv-file").value = ""; $("csv-file").click(); }
  $("editor-import").onclick = () => chooseCSV("edit");
  $("import-play").onclick = () => chooseCSV("play");
  $("csv-file").addEventListener("change", async event => {
    const file = event.target.files[0], mode = importMode;
    if (!file) return;
    try {
      if (file.size > SpriteMap.MAX_FILE_BYTES) throw new Error("CSV 文件不能超过 1 MB。");
      const next = SpriteMap.parseCSV(await file.text());
      // Validate before replacing the current draft, so failed imports leave it intact.
      if (mode === "play") SpriteMap.validatePlayable(next);
      replaceMap(next, file.name.replace(/\.csv$/i, "").slice(0, 60));
      if (mode === "play" && gameReady) playMap();
      else { showView(true); message("地图已导入。可继续编辑，或点击「试玩地图」。"); }
    } catch (error) { message(error.message, true); }
    finally { event.target.value = ""; }
  });
  function exportCSV() {
    finishStroke();
    const filename = (nameInput.value.trim() || "我的冒险").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.csv$/i, "");
    const url = URL.createObjectURL(new Blob([SpriteMap.toCSV(grid)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${filename}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    persist(); message("CSV 已导出，可通过「导入 CSV 游玩」载入。");
  }
  $("editor-export").onclick = exportCSV;

  window.addEventListener("keydown", event => {
    if (!editorActive || event.target.closest?.("input, select, textarea, [contenteditable='true']")) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.code === "KeyZ") { event.preventDefault(); event.shiftKey ? redoEdit() : undoEdit(); }
      else if (event.code === "KeyY") { event.preventDefault(); redoEdit(); }
      else if (event.code === "KeyS") { event.preventDefault(); exportCSV(); }
      return;
    }
    if (event.code === "KeyB") setTool("paint");
    if (event.code === "KeyE") setTool("erase");
    if (event.code === "KeyG") setTool("fill");
    if (event.target !== canvas) return;
    const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.code];
    if (delta) {
      event.preventDefault();
      const cell = hover || { col: Math.floor(viewport.scrollLeft / tileSize), row: Math.floor(viewport.scrollTop / tileSize) };
      setHover({ col: Math.max(0, Math.min(grid[0].length - 1, cell.col + delta[0])), row: Math.max(0, Math.min(grid.length - 1, cell.row + delta[1])) });
      const x = hover.col * tileSize, y = hover.row * tileSize;
      if (x < viewport.scrollLeft) viewport.scrollLeft = x;
      if (x + tileSize > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = x + tileSize - viewport.clientWidth;
      if (y < viewport.scrollTop) viewport.scrollTop = y;
      if (y + tileSize > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = y + tileSize - viewport.clientHeight;
    }
    if (["Space", "Enter", "Backspace", "Delete"].includes(event.code)) {
      event.preventDefault(); if (event.repeat) return;
      const cell = hover || { col: 0, row: 0 }, before = snapshot();
      const code = ["Backspace", "Delete"].includes(event.code) || tool === "erase" ? 0 : selected;
      if (tool === "fill" && code !== 10) SpriteMap.fill(grid, cell.col, cell.row, code); else put(cell, code);
      commit(before); setHover(cell);
    }
  }, { passive: false });

  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (draft && typeof draft.csv === "string") {
      grid = SpriteMap.parseCSV(draft.csv); nameInput.value = String(draft.name || "我的冒险").slice(0, 60);
      $("map-cols").value = grid[0].length; $("map-rows").value = grid.length;
      $("draft-status").textContent = "已恢复本机草稿";
    }
  } catch { $("draft-status").textContent = "请导出 CSV 保存地图"; }
  selectTile(selected); updateControls(); requestRender();
  if (document.body.dataset.startView === "editor") showView(true);
})();
