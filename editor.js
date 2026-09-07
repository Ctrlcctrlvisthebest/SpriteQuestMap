"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("editor-canvas"), ctx = canvas.getContext("2d");
  const viewport = $("map-viewport"), nameInput = $("map-name");
  nameInput.value = I18n.t("map.defaultName");
  let draftStatus = "draft.local", activeMessage = null;
  const DRAFT_KEY = "spritequest-map-draft-v1";
  let grid = SpriteMap.createMap(), selected = 2, tool = "paint", tileSize = 32;
  let hover = null, stroke = null, lastCell = null, drawingPointer = null, strokeCode = null, strokeIsFill = false;
  let undo = [], redo = [], importMode = "edit", renderPending = false, messageTimer;
  const sprites = {};
  let fullRender = true;
  const dirtyCells = new Map();
  let revision = 0, loadRequest = 0, nameBefore = null, committedName = nameInput.value;
  let pan = null, focusSpawnPending = false;
  const touchEditor = window.matchMedia(TOUCH_LAYOUT_QUERY);
  function resetZoom() {
    $("editor-zoom").value = touchEditor.matches ? "32" : "fit";
    tileSize = 32;
    focusSpawnPending = touchEditor.matches;
    viewport.scrollTo(0, 0);
  }
  resetZoom();

  function renderMessage() {
    if (activeMessage) $("app-message").querySelector("span").textContent = typeof activeMessage === "string" ? I18n.t(activeMessage) : I18n.errorText(activeMessage);
  }
  function setDraftStatus(key) { draftStatus = key; $("draft-status").textContent = I18n.t(key); }
  function message(text, error = false) {
    const element = $("app-message");
    activeMessage = text;
    renderMessage();
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
      setDraftStatus("draft.saved");
    } catch {
      setDraftStatus("draft.unavailable");
    }
  }
  function updateControls() {
    const pendingNameEdit = nameBefore && nameBefore.name !== nameInput.value;
    $("editor-undo").disabled = !undo.length && !pendingNameEdit;
    $("editor-redo").disabled = !redo.length || !!pendingNameEdit;
    $("map-size").textContent = I18n.t("editor.size", { cols: grid[0].length, rows: grid.length });
  }
  function commit(before) {
    if (before.name === nameInput.value && SpriteMap.toCSV(before.grid) === SpriteMap.toCSV(grid)) return;
    revision++;
    committedName = nameInput.value;
    undo.push(before);
    if (undo.length > 60) undo.shift();
    redo = [];
    persist(); updateControls(); requestRender(false);
  }
  function applyMap(next, name) {
    dirtyCells.clear();
    grid = SpriteMap.clone(next);
    nameInput.value = committedName = name;
    nameBefore = null;
    $("map-cols").value = grid[0].length;
    $("map-rows").value = grid.length;
    setHover(null); updateControls(); requestRender();
  }
  function restore(saved) {
    applyMap(saved.grid, saved.name);
    revision++;
    persist();
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
    applyMap(next, name);
    resetZoom();
    commit(before);
  }
  function setTool(next) {
    finishStroke();
    tool = next;
    viewport.classList.toggle("is-panning", tool === "pan");
    setHover(null);
    document.querySelectorAll("[data-tool]").forEach(button => {
      button.classList.toggle("active", button.dataset.tool === tool);
      button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
    });
  }
  function selectTile(code) {
    selected = code;
    document.querySelectorAll("[data-tile]").forEach(button => {
      button.classList.toggle("active", Number(button.dataset.tile) === code);
      button.setAttribute("aria-pressed", String(Number(button.dataset.tile) === code));
    });
    $("selected-name").removeAttribute("data-i18n");
    $("selected-description").removeAttribute("data-i18n");
    $("selected-name").textContent = SpriteMap.byCode[code].name;
    $("selected-description").textContent = SpriteMap.byCode[code].description;
    if (tool === "erase" || tool === "pan" || code === 10) setTool("paint");
    markCell(hover); requestRender(false);
  }
  for (const group of ["terrain", "objects", "characters"]) {
    const wrapper = document.createElement("div");
    const label = document.createElement("div"); label.className = "palette-label"; label.dataset.i18n = `group.${group}`; label.textContent = I18n.t(`group.${group}`);
    const palette = document.createElement("div"); palette.className = "palette-grid";
    for (const tile of SpriteMap.tiles.filter(item => item.group === group)) {
      const button = document.createElement("button");
      button.className = "tile-button"; button.dataset.tile = tile.code;
      button.dataset.i18nTitle = `tile.${tile.code}.description`; button.dataset.i18nAriaLabel = `tile.${tile.code}.name`;
      button.title = tile.description; button.setAttribute("aria-label", tile.name);
      if (tile.image) {
        const img = new Image(); img.src = `assets/${tile.image}.png`; img.alt = "";
        img.onload = requestRender;
        img.onerror = () => message("error.texture", true);
        sprites[tile.code] = img; button.append(img);
      } else {
        const empty = document.createElement("span"); empty.className = "empty-tile"; button.append(empty);
      }
      const text = document.createElement("span"); text.dataset.i18n = `tile.${tile.code}.name`; text.textContent = tile.name; button.append(text);
      button.onclick = () => selectTile(tile.code);
      palette.append(button);
    }
    wrapper.append(label, palette); $("tile-palette").append(wrapper);
  }

  function markCell(cell) {
    if (cell) dirtyCells.set(`${cell.col},${cell.row}`, cell);
  }
  function requestRender(full = true) {
    if (full !== false) fullRender = true;
    if (renderPending || (!fullRender && !dirtyCells.size)) return;
    renderPending = true;
    requestAnimationFrame(() => { renderPending = false; render(); });
  }
  function render() {
    if ($("editor-zoom").value === "fit" && viewport.clientWidth && viewport.clientHeight) {
      tileSize = Math.max(4, Math.min(40, Math.floor(Math.min((viewport.clientWidth - 2) / grid[0].length, (viewport.clientHeight - 2) / grid.length))));
    }
    const w = grid[0].length * tileSize, h = grid.length * tileSize;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; fullRender = true; }
    if (!fullRender && !dirtyCells.size) return;
    if (focusSpawnPending && viewport.clientWidth && viewport.clientHeight) {
      const spawn = SpriteMap.positions(grid, 10)[0] || { col: 2, row: Math.max(0, grid.length - 4) };
      focusSpawnPending = false;
      // Wait for canvas dimensions and scrollbars to settle before centering the spawn.
      requestAnimationFrame(() => viewport.scrollTo((spawn.col + .5) * tileSize - viewport.clientWidth / 2, (spawn.row + .5) * tileSize - viewport.clientHeight / 2));
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#64c8ff";
    if (fullRender) {
      ctx.fillRect(0, 0, w, h);
      grid.forEach((row, y) => row.forEach((value, x) => drawTile(value, x, y)));
      drawGrid(0, 0, grid[0].length, grid.length);
    } else {
      // Repaint the old/new preview cells and edited terrain; leave the rest of the canvas intact.
      for (const { col, row } of dirtyCells.values()) {
        ctx.save(); ctx.beginPath(); ctx.rect(col * tileSize, row * tileSize, tileSize, tileSize); ctx.clip();
        ctx.fillStyle = "#64c8ff";
        ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
        drawTile(grid[row][col], col, row);
        drawGrid(col, row, col + 1, row + 1);
        ctx.restore();
      }
    }
    fullRender = false;
    dirtyCells.clear();
    if (hover && tool !== "pan") {
      const code = tool === "erase" ? 0 : selected;
      ctx.globalAlpha = .55;
      if (code) drawTile(code, hover.col, hover.row);
      else { ctx.fillStyle = "#ff9b9b"; ctx.fillRect(hover.col * tileSize, hover.row * tileSize, tileSize, tileSize); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = code ? "#f2ffdb" : "#ff6464"; ctx.lineWidth = 2;
      ctx.strokeRect(hover.col * tileSize + 1, hover.row * tileSize + 1, tileSize - 2, tileSize - 2);
    }
  }
  function drawGrid(left, top, right, bottom) {
    if (!$("show-grid").checked) return;
    ctx.beginPath(); ctx.strokeStyle = "rgba(18, 71, 99, .18)"; ctx.lineWidth = 1;
    for (let col = left; col <= right; col++) { ctx.moveTo(col * tileSize + .5, top * tileSize); ctx.lineTo(col * tileSize + .5, bottom * tileSize); }
    for (let row = top; row <= bottom; row++) { ctx.moveTo(left * tileSize, row * tileSize + .5); ctx.lineTo(right * tileSize, row * tileSize + .5); }
    ctx.stroke();
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
    if (hover?.col !== cell?.col || hover?.row !== cell?.row) { markCell(hover); markCell(cell); }
    hover = cell;
    const label = cell ? I18n.t("editor.cursor", { col: cell.col + 1, row: cell.row + 1, tile: SpriteMap.byCode[grid[cell.row][cell.col]].name }) : I18n.t(tool === "pan" ? "editor.panHelp" : touchEditor.matches ? "editor.touchHelp" : "editor.paintHelp");
    if ($("cursor-position").textContent !== label) $("cursor-position").textContent = label;
    if (dirtyCells.size) requestRender(false);
  }
  function put(cell, code) {
    if (grid[cell.row][cell.col] === code && code !== 10) return;
    if (code === 10) SpriteMap.positions(grid, 10).forEach(pos => { grid[pos.row][pos.col] = 0; markCell(pos); });
    grid[cell.row][cell.col] = code;
    markCell(cell);
  }
  function paintLine(from, to, code) {
    const steps = Math.max(Math.abs(to.col - from.col), Math.abs(to.row - from.row));
    for (let i = 0; i <= steps; i++) {
      const fraction = steps ? i / steps : 0;
      put({ col: Math.round(from.col + (to.col - from.col) * fraction), row: Math.round(from.row + (to.row - from.row) * fraction) }, code);
    }
  }
  function finishPan() {
    if (!pan) return;
    const pointer = pan.pointer;
    pan = null;
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture(pointer)) viewport.releasePointerCapture(pointer);
  }
  viewport.addEventListener("pointerdown", event => {
    if (tool !== "pan" || event.button !== 0 || pan) return;
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    pan = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", event => {
    if (!pan || event.pointerId !== pan.pointer) return;
    event.preventDefault();
    viewport.scrollTo(pan.left + pan.x - event.clientX, pan.top + pan.y - event.clientY);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    viewport.addEventListener(type, event => { if (pan?.pointer === event.pointerId) finishPan(); });
  }
  function finishNameEdit() {
    if (!nameBefore) return;
    const before = nameBefore;
    nameBefore = null;
    commit(before);
  }
  function finishStroke() {
    finishNameEdit();
    finishPan();
    if (!stroke) return;
    const before = stroke, pointer = drawingPointer;
    stroke = null; drawingPointer = null; lastCell = null;
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    commit(before);
  }
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  canvas.addEventListener("pointerdown", event => {
    if (tool === "pan" || drawingPointer !== null || ![0, 2].includes(event.button)) return;
    const cell = cellAt(event); if (!cell) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    stroke = snapshot(); drawingPointer = event.pointerId;
    strokeCode = event.button === 2 || tool === "erase" ? 0 : selected;
    canvas.setPointerCapture(event.pointerId);
    strokeIsFill = tool === "fill" && event.button !== 2 && strokeCode !== 10;
    if (strokeIsFill) { SpriteMap.fill(grid, cell.col, cell.row, strokeCode); requestRender(); }
    else put(cell, strokeCode);
    lastCell = cell; setHover(cell);
  });
  canvas.addEventListener("pointermove", event => {
    if (tool === "pan" || (drawingPointer !== null && event.pointerId !== drawingPointer)) return;
    const cell = cellAt(event);
    if (stroke && cell && !strokeIsFill) {
      paintLine(lastCell || cell, cell, strokeCode); lastCell = cell;
    }
    if (!cell) lastCell = null;
    setHover(cell);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(type, event => { if (event.pointerId === drawingPointer) finishStroke(); });
  canvas.addEventListener("pointerleave", () => { if (!stroke) setHover(null); });
  window.addEventListener("blur", finishStroke);
  window.addEventListener("resize", finishStroke);
  document.addEventListener("visibilitychange", () => { if (document.hidden) finishStroke(); });
  document.querySelectorAll("[data-tool]").forEach(button => { button.onclick = () => setTool(button.dataset.tool); });
  $("editor-undo").onclick = undoEdit; $("editor-redo").onclick = redoEdit;
  $("show-grid").onchange = requestRender;
  $("editor-zoom").onchange = () => {
    finishStroke();
    focusSpawnPending = false;
    if ($("editor-zoom").value === "fit") { render(); viewport.scrollTo(0, 0); return; }
    const ratio = Number($("editor-zoom").value) / tileSize;
    const canvasBounds = canvas.getBoundingClientRect(), viewBounds = viewport.getBoundingClientRect();
    const centerX = (viewBounds.left + viewport.clientLeft + viewport.clientWidth / 2 - canvasBounds.left) * ratio;
    const centerY = (viewBounds.top + viewport.clientTop + viewport.clientHeight / 2 - canvasBounds.top) * ratio;
    tileSize = Number($("editor-zoom").value); render();
    viewport.scrollTo(Math.max(0, (viewport.clientWidth - canvas.width) / 2) + centerX - viewport.clientWidth / 2, centerY - viewport.clientHeight / 2);
  };
  new ResizeObserver(requestRender).observe(viewport);
  nameInput.addEventListener("input", () => {
    if (!nameBefore) nameBefore = { ...snapshot(), name: committedName };
    revision++;
    persist(); updateControls();
  });
  nameInput.addEventListener("change", finishNameEdit);
  nameInput.addEventListener("blur", finishNameEdit);
  $("new-map").onclick = () => {
    try { replaceMap(SpriteMap.createMap(Number($("map-cols").value), Number($("map-rows").value)), I18n.t("map.defaultName")); message("message.created"); }
    catch (error) { message(error, true); }
  };
  // CSV and built-in maps share one commit path. A delayed read must never replace newer work.
  async function loadMap(read, mode, successMessage) {
    finishStroke();
    const request = ++loadRequest, startRevision = revision;
    try {
      const { text, name } = await read();
      if (request !== loadRequest) return;
      const next = SpriteMap.parseCSV(text);
      if (mode === "play") SpriteMap.validatePlayable(next);
      finishStroke();
      if (startRevision !== revision) { message("message.loadDiscarded"); return; }
      replaceMap(next, name);
      if (mode === "play" && gameReady) playMap();
      else { showView(true); message(successMessage); }
    } catch (error) {
      if (request === loadRequest) message(error, true);
    }
  }
  $("load-template").onclick = async () => {
    const button = $("load-template"), number = $("map-template").value;
    button.disabled = true;
    try {
      await loadMap(async () => {
        const response = await fetch(`assets/map${number}.csv`);
        if (!response.ok) throw I18n.error("error.template");
        return { text: await response.text(), name: I18n.t("map.templateName", { number }) };
      }, "edit", "message.template");
    } finally { button.disabled = false; }
  };

  function showView(editing) {
    loadRequest++;
    finishStroke(); clearInputState();
    setEditorActive(editing);
    $("editor-view").hidden = !editing; $("game-view").hidden = editing;
    for (const [id, active] of [["nav-editor", editing], ["nav-game", !editing]]) {
      $(id).classList.toggle("active", active);
      if (active) $(id).setAttribute("aria-current", "page"); else $(id).removeAttribute("aria-current");
    }
    document.activeElement?.blur();
    if (editing) requestRender();
    if (typeof TouchUI !== "undefined") TouchUI.sync();
  }
  function updateGameBar() {
    $("game-map-name").textContent = customMap ? I18n.t("game.custom", { name: customMap.name }) : I18n.t("game.classic");
    $("classic-game").hidden = !customMap; $("back-editor").hidden = !customMap;
  }
  function playMap() {
    finishStroke();
    if (!gameReady) { message("error.loading", true); return; }
    try {
      const spawn = SpriteMap.validatePlayable(grid);
      showView(false);
      customMap = { lines: SpriteMap.toCSV(grid).trimEnd().split("\n"), spawn, name: nameInput.value.trim() || I18n.t("map.defaultName") };
      updateGameBar(); startNewGame();
      enableAudio();
    } catch (error) { message(error, true); }
  }
  $("nav-editor").onclick = () => showView(true);
  $("nav-game").onclick = () => showView(false);
  $("back-editor").onclick = () => showView(true);
  $("editor-play").onclick = playMap;
  $("restart-game").onclick = () => { loadRequest++; document.activeElement?.blur(); startNewGame(); enableAudio(); };
  $("classic-game").onclick = () => { loadRequest++; customMap = null; updateGameBar(); document.activeElement?.blur(); startNewGame(); };
  function ready() { $("editor-play").disabled = false; $("restart-game").disabled = false; }
  window.addEventListener("spritequest-ready", ready);
  if (gameReady) ready();

  function chooseCSV(mode) { importMode = mode; $("csv-file").value = ""; $("csv-file").click(); }
  $("editor-import").onclick = () => chooseCSV("edit");
  $("import-play").onclick = () => chooseCSV("play");
  $("csv-file").addEventListener("change", async event => {
    const file = event.target.files[0], mode = importMode;
    event.target.value = "";
    if (!file) return;
    await loadMap(async () => {
      if (file.size > SpriteMap.MAX_FILE_BYTES) throw I18n.error("error.fileSize");
      return { text: await file.text(), name: file.name.replace(/\.csv$/i, "").slice(0, 60) || I18n.t("map.defaultName") };
    }, mode, "message.imported");
  });
  function exportCSV() {
    finishStroke();
    const filename = (nameInput.value.trim() || I18n.t("map.defaultName")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\.csv$/i, "");
    const url = URL.createObjectURL(new Blob([SpriteMap.toCSV(grid)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${filename}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    persist(); message("message.exported");
  }
  $("editor-export").onclick = exportCSV;

  window.addEventListener("keydown", event => {
    if (!editorActive || event.isComposing || event.altKey || event.target.closest?.("input, select, textarea, [contenteditable='true']")) return;
    if (event.ctrlKey || event.metaKey) {
      if (event.code === "KeyZ") { event.preventDefault(); event.shiftKey ? redoEdit() : undoEdit(); }
      else if (event.code === "KeyY") { event.preventDefault(); redoEdit(); }
      else if (event.code === "KeyS") { event.preventDefault(); exportCSV(); }
      return;
    }
    if (event.code === "KeyB") setTool("paint");
    if (event.code === "KeyE") setTool("erase");
    if (event.code === "KeyG") setTool("fill");
    if (event.code === "KeyH") setTool("pan");
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
    if (tool === "pan") return;
    if (["Space", "Enter", "Backspace", "Delete"].includes(event.code)) {
      event.preventDefault(); if (event.repeat) return;
      const cell = hover || { col: 0, row: 0 }, before = snapshot();
      const code = ["Backspace", "Delete"].includes(event.code) || tool === "erase" ? 0 : selected;
      if (tool === "fill" && code !== 10) { SpriteMap.fill(grid, cell.col, cell.row, code); requestRender(); } else put(cell, code);
      commit(before); setHover(cell);
    }
  }, { passive: false });

  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (draft && typeof draft.csv === "string") {
      applyMap(SpriteMap.parseCSV(draft.csv), String(draft.name || I18n.t("map.defaultName")).slice(0, 60));
      setDraftStatus("draft.restored");
    }
  } catch { setDraftStatus("draft.export"); }
  document.addEventListener("languagechange", () => {
    // Update labels only: keep the draft, selection, undo history and current run.
    $("selected-name").textContent = SpriteMap.byCode[selected].name;
    $("selected-description").textContent = SpriteMap.byCode[selected].description;
    updateControls(); updateGameBar(); setHover(hover); setDraftStatus(draftStatus); renderMessage();
  });
  selectTile(selected); updateControls(); setHover(null);
  if (document.body.dataset.startView === "editor") showView(true);
})();
