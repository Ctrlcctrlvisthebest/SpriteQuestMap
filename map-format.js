"use strict";

// Shared map format. Codes 0–9 are compatible with the original CSV files.
const SpriteMap = (() => {
  const MAX_COLS = 120, MAX_ROWS = 80, MAX_FILE_BYTES = 1024 * 1024;
  const tiles = [
    { code: 0, name: "空白", group: "地形", image: null, description: "清除这一格的地形或物件。" },
    { code: 1, name: "红砖", group: "地形", image: "red_brick", solid: true, description: "可以站立的红砖平台。" },
    { code: 2, name: "雪地", group: "地形", image: "snow", solid: true, description: "可以站立的积雪地面。" },
    { code: 3, name: "土砖", group: "地形", image: "brown_brick", solid: true, description: "可以站立的泥土砖块。" },
    { code: 4, name: "木箱", group: "地形", image: "crate", solid: true, description: "可以站立或用来垫高的木箱。" },
    { code: 8, name: "水块", group: "地形", image: "water", solid: true, description: "沿用游戏规则：水块是可以站立的平台。" },
    { code: 5, name: "金币", group: "物件", image: "gold1", description: "拾取后获得 1 枚金币。" },
    { code: 6, name: "终点宝石", group: "物件", image: "gem1", description: "碰到宝石即可完成自定义关卡。" },
    { code: 7, name: "岩浆", group: "物件", image: "magma", description: "碰到会扣除 10 枚金币并返回出生点。" },
    { code: 10, name: "玩家起点", group: "角色", image: "mageR", description: "点击放置出生点；再次放置会移动原来的起点。" },
    { code: 9, name: "敌方法师", group: "角色", image: "wizardR", description: "自定义地图中，每个标记生成一名敌人。" }
  ];
  const byCode = Object.fromEntries(tiles.map(tile => [tile.code, tile]));
  function parseCSV(text) {
    if (typeof text !== "string" || text.length > MAX_FILE_BYTES) throw new Error("CSV 文件不能超过 1 MB。");
    const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    if (!lines.length) throw new Error("CSV 文件是空的，请选择一张地图。");
    if (lines.length > MAX_ROWS) throw new Error(`地图最多支持 ${MAX_ROWS} 行。`);
    const grid = lines.map((line, row) => {
      if (!line.trim()) throw new Error(`第 ${row + 1} 行为空。请用 0 表示空白格。`);
      const cells = line.split(",");
      if (cells.length > MAX_COLS) throw new Error(`地图最多支持 ${MAX_COLS} 列（第 ${row + 1} 行超出）。`);
      return cells.map((cell, col) => {
        let value = cell.trim();
        if (/^"\s*\d*\s*"$/.test(value)) value = value.slice(1, -1).trim();
        if (value === "") return 0;
        if (!/^\d+$/.test(value) || !byCode[Number(value)]) throw new Error(`第 ${row + 1} 行、第 ${col + 1} 列不是有效地图格（允许 0–10）。`);
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
    if (explicit.length > 1) throw new Error("地图里有多个玩家起点，请只保留一个。");
    if (explicit.length) return explicit[0];
    if (grid[8]?.[5] === 0) return { col: 5, row: 8 };
    for (let row = grid.length - 2; row >= 0; row--) {
      for (let col = 0; col < grid[0].length; col++) {
        if (grid[row][col] === 0 && byCode[grid[row + 1][col]].solid) return { col, row };
      }
    }
    const empty = positions(grid, 0)[0];
    if (!empty) throw new Error("地图没有安全的出生位置，请放置一个玩家起点。");
    return empty;
  }
  function validatePlayable(grid) {
    if (!positions(grid, 6).length) throw new Error("还缺少终点宝石。请在地图上放置宝石后再试玩。");
    return playerSpawn(grid);
  }
  function createMap(cols = 40, rows = 18) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 8 || rows < 6 || cols > MAX_COLS || rows > MAX_ROWS) throw new Error(`新地图宽度需为 8–${MAX_COLS} 格，高度需为 6–${MAX_ROWS} 格。`);
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
