"use strict";

// Shared map format. Codes 0–9 are compatible with the original CSV files.
const SpriteMap = (() => {
  const locale = typeof module !== "undefined" && module.exports ? require("./i18n.js") : I18n;
  const MAX_COLS = 120, MAX_ROWS = 80, MAX_FILE_BYTES = 1024 * 1024;
  const tiles = [
    { code: 0, group: "terrain", image: null },
    { code: 1, group: "terrain", image: "red_brick", solid: true },
    { code: 2, group: "terrain", image: "snow", solid: true },
    { code: 3, group: "terrain", image: "brown_brick", solid: true },
    { code: 4, group: "terrain", image: "crate", solid: true },
    { code: 8, group: "terrain", image: "water", solid: true },
    { code: 5, group: "objects", image: "gold1" },
    { code: 6, group: "objects", image: "gem1" },
    { code: 7, group: "objects", image: "magma" },
    { code: 10, group: "characters", image: "mageR" },
    { code: 9, group: "characters", image: "wizardR" }
  ].map(tile => ({ ...tile,
    get name() { return locale.t(`tile.${tile.code}.name`); },
    get description() { return locale.t(`tile.${tile.code}.description`); }
  }));
  const byCode = Object.fromEntries(tiles.map(tile => [tile.code, tile]));
  function parseCSV(text) {
    if (typeof text !== "string" || text.length > MAX_FILE_BYTES) throw locale.error("error.fileSize");
    const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) throw locale.error("error.emptyFile");
    if (lines.length > MAX_ROWS) throw locale.error("error.maxRows", { max: MAX_ROWS });
    const grid = lines.map((line, row) => {
      if (!line.trim()) throw locale.error("error.emptyRow", { row: row + 1 });
      const cells = line.split(",");
      if (cells.length > MAX_COLS) throw locale.error("error.maxCols", { max: MAX_COLS, row: row + 1 });
      return cells.map((cell, col) => {
        let value = cell.trim();
        if (/^"\s*\d*\s*"$/.test(value)) value = value.slice(1, -1).trim();
        if (value === "") return 0;
        if (!/^\d+$/.test(value) || !byCode[Number(value)]) throw locale.error("error.invalidCell", { row: row + 1, col: col + 1 });
        return Number(value);
      });
    });
    const cols = Math.max(...grid.map(row => row.length));
    return grid.map(row => row.concat(Array(cols - row.length).fill(0)));
  }
  function toCSV(grid) { return grid.map(row => row.join(",")).join("\n") + "\n"; }
  function clone(grid) { return grid.map(row => row.slice()); }
  function positions(grid, code) {
    const result = [];
    grid.forEach((row, y) => row.forEach((value, x) => { if (value === code) result.push({ col: x, row: y }); }));
    return result;
  }
  function playerSpawn(grid) {
    const explicit = positions(grid, 10);
    if (explicit.length > 1) throw locale.error("error.multipleStarts");
    if (explicit.length) return explicit[0];
    if (grid[8]?.[5] === 0) return { col: 5, row: 8 };
    for (let row = grid.length - 2; row >= 0; row--) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col] === 0 && byCode[grid[row + 1][col]].solid) return { col, row };
      }
    }
    const empty = positions(grid, 0)[0];
    if (!empty) throw locale.error("error.noSpawn");
    return empty;
  }
  function validatePlayable(grid) {
    if (!positions(grid, 6).length) throw locale.error("error.noExit");
    return playerSpawn(grid);
  }
  function createMap(cols = 40, rows = 18) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 8 || rows < 6 || cols > MAX_COLS || rows > MAX_ROWS) throw locale.error("error.dimensions", { cols: MAX_COLS, rows: MAX_ROWS });
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
    grid[rows - 1].fill(3);
    grid[rows - 2].fill(2);
    grid[rows - 3][2] = 10;
    grid[rows - 3][cols - 3] = 6;
    return grid;
  }
  function fill(grid, col, row, replacement) {
    const target = grid[row][col];
    if (target === replacement) return;
    const pending = [[col, row]];
    grid[row][col] = replacement;
    while (pending.length) {
      const [x, y] = pending.pop();
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (ny >= 0 && ny < grid.length && nx >= 0 && nx < grid[0].length && grid[ny][nx] === target) {
          grid[ny][nx] = replacement;
          pending.push([nx, ny]);
        }
      }
    }
  }
  return { tiles, byCode, MAX_COLS, MAX_ROWS, MAX_FILE_BYTES, parseCSV, toCSV, clone, positions, playerSpawn, validatePlayable, createMap, fill };
})();
if (typeof module !== "undefined") module.exports = SpriteMap;
