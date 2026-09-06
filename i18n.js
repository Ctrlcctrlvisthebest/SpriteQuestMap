"use strict";

const I18n = (() => {
  // Each entry contains English first, then Simplified Chinese.
  const messages = {
    "page.title": ["SpriteQuest · Map Workshop", "SpriteQuest · 地图工坊"],
    "page.description": ["SpriteQuest — a pixel adventure and map editor. Paint terrain, import CSV maps, and play your own levels.", "SpriteQuest — 像素冒险与地图编辑器。绘制地形、导入 CSV，游玩自己的关卡。"],
    "home": ["SpriteQuest home", "SpriteQuest 首页"],
    "navigation": ["Main navigation", "主导航"],
    "nav.play": ["Play", "游玩"],
    "nav.editor": ["Map editor", "地图编辑器"],
    "nav.editorSite": ["Editor website ↗", "编辑器网站 ↗"],
    "nav.gameSite": ["Back to SpriteQuest ↗", "返回 SpriteQuest ↗"],
    "importPlay": ["Import CSV & play", "导入 CSV 游玩"],
    "game.region": ["Game", "游戏"],
    "game.canvas": ["SpriteQuest game canvas", "SpriteQuest 游戏画布"],
    "game.classic": ["Classic adventure · 4 levels", "经典冒险 · 4 个关卡"],
    "game.custom": ["Custom map · {name}", "自定义地图 · {name}"],
    "game.backEditor": ["Back to editor", "返回编辑"],
    "game.classicButton": ["Classic levels", "标准关卡"],
    "game.restart": ["Start / restart", "开始 / 重新开始"],
    "fullscreen.enter": ["⛶ Fullscreen", "⛶ 全屏"],
    "fullscreen.exit": ["Exit fullscreen · Esc", "退出全屏 · Esc"],
    "fullscreen.windowExit": ["Exit window fullscreen · Esc", "退出窗口全屏 · Esc"],
    "controls.label": ["Keyboard controls", "键盘操作"],
    "controls.space": ["Space", "空格"],
    "controls.moveLabel": ["Move", "移动"],
    "controls.jumpLabel": ["Jump", "跳跃"],
    "controls.shootLabel": ["Shoot water", "发射水弹"],
    "controls.sprintLabel": ["Sprint", "冲刺"],
    "controls.restartLabel": ["Restart", "重新开始"],
    "controls.menuLabel": ["Main menu", "主菜单"],
    "screen.tagline": ["A little magic. A big adventure.", "小小魔法师，大大的冒险。"],
    "screen.goal": ["Collect coins. Find the gem. Make it your world.", "收集金币，找到宝石，创造你的世界。"],
    "controls.move": ["← → Move", "← → 移动"],
    "controls.jump": ["↑ Jump", "↑ 跳跃"],
    "controls.shoot": ["X Shoot water", "X 发射水弹"],
    "controls.sprint": ["Z Sprint", "Z 冲刺"],
    "controls.restart": ["Space Restart", "空格 重新开始"],
    "controls.menu": ["R Main menu", "R 主菜单"],
    "editor.title": ["Map workshop", "地图工坊"],
    "editor.name": ["Map name", "地图名称"],
    "editor.import": ["Import CSV", "导入 CSV"],
    "editor.export": ["Export CSV", "导出 CSV"],
    "editor.play": ["Play map", "试玩地图"],
    "editor.palette": ["Terrain and objects", "地形和物件"],
    "editor.library": ["Tile palette", "素材库"],
    "editor.choose": ["Select to paint", "选择后绘制"],
    "editor.selection": ["Selected tile", "当前选择"],
    "editor.tools": ["Drawing tools", "绘制工具"],
    "tool.paint": ["Brush", "画笔"],
    "tool.erase": ["Eraser", "橡皮"],
    "tool.fill": ["Fill", "填充"],
    "tool.paintTip": ["Brush (B)", "画笔 (B)"],
    "tool.eraseTip": ["Eraser (E)", "橡皮 (E)"],
    "tool.fillTip": ["Fill (G)", "填充 (G)"],
    "tool.undo": ["Undo", "撤销"],
    "tool.redo": ["Redo", "重做"],
    "tool.undoTip": ["Undo (Ctrl / ⌘ Z)", "撤销 (Ctrl / ⌘ Z)"],
    "tool.redoTip": ["Redo (Ctrl / ⌘ Shift Z)", "重做 (Ctrl / ⌘ Shift Z)"],
    "editor.grid": ["Grid", "网格"],
    "editor.zoom": ["Zoom", "缩放"],
    "editor.fit": ["Fit map", "适应地图"],
    "editor.canvas": ["Map canvas: select a tile, then click or drag to paint. Use arrow keys to move the cursor and Space to place a tile.", "地图画布：选择左侧素材后，点击或拖动绘制。方向键移动光标，空格放置。"],
    "editor.size": ["{cols} × {rows} tiles", "{cols} × {rows} 格"],
    "editor.cursor": ["Column {col} · Row {row} · {tile}", "第 {col} 列 · 第 {row} 行 · {tile}"],
    "editor.paintHelp": ["Click or drag to paint · Right-click to erase · Scroll to explore", "点击或拖动绘制 · 右键擦除 · 滚动查看地图"],
    "editor.new": ["New map", "新地图"],
    "editor.width": ["Width", "宽"],
    "editor.height": ["Height", "高"],
    "editor.create": ["Create", "创建"],
    "editor.templates": ["Built-in maps", "内置地图"],
    "editor.template1": ["Built-in level 1", "内置关卡 1"],
    "editor.template2": ["Built-in level 2", "内置关卡 2"],
    "editor.template3": ["Built-in level 3", "内置关卡 3"],
    "editor.template4": ["Built-in level 4", "内置关卡 4"],
    "editor.load": ["Load map", "载入编辑"],
    "editor.help": ["Paint terrain, then add a player start and an exit gem. Play your map, return to edit, or export a CSV to share with friends.", "先铺地形，再放起点和终点宝石。试玩后可返回继续编辑，也可以导出 CSV 分享给朋友。"],
    "editor.shortcuts": ["Arrow keys: move cursor · Space: paint · B: brush · E: eraser · G: fill · Ctrl / ⌘ Z: undo", "方向键移动光标，空格绘制；B 画笔 · E 橡皮 · G 填充 · ⌘ / Ctrl Z 撤销"],
    "map.defaultName": ["My adventure", "我的冒险"],
    "map.templateName": ["Level {number} · My remix", "关卡 {number} · 我的改编"],
    "draft.local": ["Local draft", "本地草稿"],
    "draft.saved": ["Draft saved on this device", "草稿已保存到本机"],
    "draft.unavailable": ["Cannot save draft. Export a CSV.", "无法保存草稿，请导出 CSV"],
    "draft.restored": ["Local draft restored", "已恢复本机草稿"],
    "draft.export": ["Export a CSV to save your map", "请导出 CSV 保存地图"],
    "feedback": ["Feedback", "反馈"],
    "feedback.tip": ["Found a bug or have an idea?", "发现问题，或有新的想法？"],
    "closeMessage": ["Dismiss message", "关闭提示"],
    "message.created": ["New map created. Undo to return to the previous map.", "新地图已创建；可以撤销回到上一张地图。"],
    "message.template": ["Built-in map loaded. You can now edit it.", "内置地图已载入，可以直接修改。"],
    "message.imported": ["Map imported. Keep editing or select “Play map”.", "地图已导入。可继续编辑，或点击「试玩地图」。"],
    "message.exported": ["CSV exported. Use “Import CSV & play” to load it.", "CSV 已导出，可通过「导入 CSV 游玩」载入。"],
    "error.loading": ["Game assets are loading. Please try playing again in a moment.", "游戏素材正在加载，请稍候再试玩。"],
    "error.texture": ["Could not load this tile image. Please refresh the page.", "无法加载贴图，请刷新页面。"],
    "error.template": ["Could not load the built-in map. Please try again.", "无法载入内置地图，请稍后再试。"],
    "error.generic": ["Could not complete this action. Please try again.", "操作未完成，请重试。"],
    "error.fileSize": ["CSV files must not exceed 1 MB.", "CSV 文件不能超过 1 MB。"],
    "error.emptyFile": ["This CSV is empty. Please choose a map file.", "CSV 文件是空的，请选择一张地图。"],
    "error.maxRows": ["Maps can have at most {max} rows.", "地图最多支持 {max} 行。"],
    "error.emptyRow": ["Row {row} is empty. Use 0 for empty tiles.", "第 {row} 行为空。请用 0 表示空白格。"],
    "error.maxCols": ["Maps can have at most {max} columns (row {row} exceeds this limit).", "地图最多支持 {max} 列（第 {row} 行超出）。"],
    "error.invalidCell": ["Invalid tile at row {row}, column {col}. Use values from 0 to 10.", "第 {row} 行、第 {col} 列不是有效地图格（允许 0–10）。"],
    "error.multipleStarts": ["There are multiple player starts. Keep only one.", "地图里有多个玩家起点，请只保留一个。"],
    "error.noSpawn": ["There is no safe spawn location. Place a player start.", "地图没有安全的出生位置，请放置一个玩家起点。"],
    "error.noExit": ["An exit gem is missing. Place one before playing.", "还缺少终点宝石。请在地图上放置宝石后再试玩。"],
    "error.dimensions": ["New maps must be 8–{cols} tiles wide and 6–{rows} tiles tall.", "新地图宽度需为 8–{cols} 格，高度需为 6–{rows} 格。"],
    "group.terrain": ["Terrain", "地形"],
    "group.objects": ["Objects", "物件"],
    "group.characters": ["Characters", "角色"],
    "tile.0.name": ["Empty", "空白"],
    "tile.0.description": ["Remove the terrain or object in this tile.", "清除这一格的地形或物件。"],
    "tile.1.name": ["Red brick", "红砖"],
    "tile.1.description": ["A solid red-brick platform you can stand on.", "可以站立的红砖平台。"],
    "tile.2.name": ["Snow", "雪地"],
    "tile.2.description": ["Solid ground covered in snow.", "可以站立的积雪地面。"],
    "tile.3.name": ["Dirt", "土砖"],
    "tile.3.description": ["Solid dirt blocks you can stand on.", "可以站立的泥土砖块。"],
    "tile.4.name": ["Crate", "木箱"],
    "tile.4.description": ["A solid wooden crate for building raised platforms.", "可以站立或用来垫高的木箱。"],
    "tile.8.name": ["Water", "水块"],
    "tile.8.description": ["Like the original game, water tiles are solid platforms.", "沿用游戏规则：水块是可以站立的平台。"],
    "tile.5.name": ["Coin", "金币"],
    "tile.5.description": ["Collect to earn one coin.", "拾取后获得 1 枚金币。"],
    "tile.6.name": ["Exit gem", "终点宝石"],
    "tile.6.description": ["Touch the gem to complete your custom level.", "碰到宝石即可完成自定义关卡。"],
    "tile.7.name": ["Lava", "岩浆"],
    "tile.7.description": ["Touching lava costs 10 coins and returns you to the start.", "碰到会扣除 10 枚金币并返回出生点。"],
    "tile.10.name": ["Player start", "玩家起点"],
    "tile.10.description": ["Place a spawn point. Placing another moves the existing start.", "点击放置出生点；再次放置会移动原来的起点。"],
    "tile.9.name": ["Wizard", "敌方法师"],
    "tile.9.description": ["Each marker spawns one enemy in a custom map.", "自定义地图中，每个标记生成一名敌人。"],
    "difficulty.easy": ["Easy", "简单"],
    "difficulty.normal": ["Normal", "普通"],
    "difficulty.hard": ["Hard", "困难"],
    "hud.score": ["Score: {value}", "金币：{value}"],
    "hud.rank": ["Rank: {value}", "评级：{value}"],
    "hud.difficulty": ["Difficulty: {value}", "难度：{value}"],
    "hud.level": ["Level: {value}", "关卡：{value}"],
    "hud.custom": ["Level: Custom", "关卡：自定义"],
    "hud.playerLevel": ["Player level: {value}", "角色等级：{value}"],
    "hud.xp": ["XP: {value}/{next}", "经验：{value}/{next}"],
    "hud.endless": ["Mode: Endless", "模式：无尽"],
    "hud.shot": ["Water", "水弹"],
    "hud.ready": ["Ready", "就绪"],
    "hud.recharging": ["Recharging", "冷却中"],
    "hud.sprint": ["Sprint", "冲刺"],
    "screen.customTitle": ["Custom quest", "自定义冒险"],
    "screen.controls": ["Arrows to move, X to shoot, Space to restart, Z to sprint, R for menu", "方向键移动，X 发射水弹，空格重开，Z 冲刺，R 返回菜单"],
    "screen.difficulty": ["Press 1 for Easy, 2 for Normal, 3 for Hard", "按 1 选择简单，2 选择普通，3 选择困难"],
    "screen.selected": ["Selected difficulty: {value}", "当前难度：{value}"],
    "screen.start": ["Press [SPACE] to play", "按 [空格] 开始游戏"],
    "screen.loadingCustom": ["Custom map", "自定义地图"],
    "screen.loadingLevel": ["Level {value}", "第 {value} 关"],
    "screen.win": ["You win!", "你赢了！"],
    "screen.earned": ["You earned {value} coins", "你获得了 {value} 枚金币"],
    "screen.restart": ["Press [SPACE] to play again", "按 [空格] 再玩一次"],
    "screen.endless": ["Press [E] for Endless Mode", "按 [E] 进入无尽模式"],
    "screen.mapComplete": ["Map complete! Return to the editor to keep building.", "地图通关！返回编辑器继续创作。"],
    "screen.lose": ["You lose!", "挑战失败！"],
    "screen.noCoins": ["You lost all your coins", "你的金币已全部耗尽"],
    "screen.chooseDifficulty": ["Choose difficulty: 1 Easy, 2 Normal, 3 Hard", "选择难度：1 简单，2 普通，3 困难"]
  };
  const STORAGE_KEY = "spritequest-language";
  let language = "en";
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh") language = saved;
  } catch { /* English remains the default when storage is unavailable. */ }

  function t(key, values = {}) {
    const text = messages[key]?.[language === "zh" ? 1 : 0] ?? key;
    return text.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
  }
  function error(key, values = {}) {
    const result = new Error(t(key, values));
    result.i18nKey = key; result.i18nValues = values;
    return result;
  }
  function errorText(value) { return value?.i18nKey ? t(value.i18nKey, value.i18nValues) : value?.message || t("error.generic"); }
  function apply(root = document) {
    for (const [attribute, target] of [["data-i18n", null], ["data-i18n-title", "title"], ["data-i18n-aria-label", "aria-label"], ["data-i18n-content", "content"]]) {
      root.querySelectorAll(`[${attribute}]`).forEach(element => {
        const value = t(element.getAttribute(attribute));
        if (target) element.setAttribute(target, value); else element.textContent = value;
      });
    }
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    const selector = document.getElementById("language-select");
    if (selector) selector.value = language;
  }
  function setLanguage(value, persist = true) {
    if (value !== "en" && value !== "zh") return;
    language = value;
    if (persist) { try { localStorage.setItem(STORAGE_KEY, value); } catch { /* Keep the choice in memory. */ } }
    if (typeof document !== "undefined") {
      apply();
      document.dispatchEvent(new Event("languagechange"));
    }
  }
  if (typeof document !== "undefined") {
    apply();
    document.getElementById("language-select")?.addEventListener("change", event => setLanguage(event.target.value));
    window.addEventListener("storage", event => { if (event.key === STORAGE_KEY) setLanguage(event.newValue, false); });
  }
  return { t, error, errorText, apply, setLanguage, getLanguage: () => language, messages };
})();
if (typeof module !== "undefined") module.exports = I18n;
