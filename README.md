# SpriteQuestMap

SpriteQuest 的贴图地图编辑器。直接点击或拖动绘制地形，导入 / 导出 CSV，并在内置游戏中试玩。

- [在线地图编辑器](https://ctrlcctrlvisthebest.github.io/SpriteQuestMap/)
- [SpriteQuest 游戏](https://ctrlcctrlvisthebest.github.io/SpriteQuest/)

## Play locally

Browsers do not load game assets correctly from a `file://` URL. Start a small local server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- Left / Right arrows: move
- Up arrow: jump
- X: shoot water
- Z: sprint
- 1 / 2 / 3: select difficulty on a menu screen
- Space: start or restart
- R: return to the main menu

Enemy magma projectiles travel at speed 5 on Easy, 7 on Normal, and 9 on Hard.

## Progression

- Defeated wizards drop bones that grant coins and experience.
- Bone coin rewards are 2 on Easy, 3 on Normal, and 5 on Hard.
- Bone experience rewards are 5 on Easy, 7 on Normal, and 10 on Hard.
- Each level increases movement speed by 0.5 and reduces shot and sprint cooldowns by 8%.
- Movement speed is capped at 14, and cooldowns cannot fall below 50% of their base values.
- The first level requires 20 XP; each later level requires 10 more XP than the previous one.

## Endless mode

After completing level 4, press **E** on the victory screen to enter Endless mode. Endless mode keeps the level 4 map, removes its exit gem, and adds two wizards beyond the selected difficulty's normal count (3 on Easy, 4 on Normal, and 5 on Hard). Each defeated wizard respawns after three seconds. Your score, player level, and experience carry over from the completed run.

## Publish with GitHub Pages

1. Create a public GitHub repository named `SpriteQuestMap`.
2. Push this folder to the repository's `main` branch.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select **main**, **/ (root)**, then **Save**.

The game will be available at `https://ctrlcctrlvisthebest.github.io/SpriteQuestMap/` after deployment finishes.

## Credits

Original Processing project by the repository owner. The unused `mario-theme.mp3` file from the source project is intentionally excluded from this web release.

## 地图编辑器与自定义关卡

打开网站，点击顶部的 **地图编辑器**：

1. 在左侧素材库选择地形、金币、岩浆、终点宝石或角色，直接在地图上点击或拖动绘制。
2. 放置 **玩家起点** 和 **终点宝石**。再次放置玩家起点会移动旧起点；每个敌方法师标记生成一名敌人。
3. 点击 **试玩地图** 进入关卡，点击 **返回编辑** 继续修改。碰到终点宝石即可通关，空格会重新开始当前地图。
4. 点击 **导出 CSV** 保存地图。其他玩家可以在网站顶部点击 **导入 CSV 游玩**，选择这个文件直接游玩；编辑器内的 **导入 CSV** 可载入文件继续修改。

支持画笔、橡皮、连通区域填充、撤销 / 重做、网格开关、缩放、内置关卡改编和自定义尺寸。桌面默认显示完整地图；手机默认使用 100% 缩放，便于准确绘制，也可以选择「适应地图」查看全图。新建或导入地图后可撤销回到前一张地图。草稿自动保存在当前浏览器，建议导出 CSV 长期保存或分享。CSV 只在浏览器中读取，不会上传到服务器。

快捷键：**B** 画笔、**E** 橡皮、**G** 填充、**H** 移动画布、**Ctrl / ⌘ Z** 撤销、**Ctrl / ⌘ Shift Z** 重做、**Ctrl / ⌘ S** 导出。右键可临时擦除。聚焦画布后，可用方向键移动光标、空格或 Enter 放置、Delete 擦除。触屏支持拖动绘制；选择「移动」后拖动画布可以移动视野，选择素材后会返回画笔。

CSV 无表头，每行对应地图的一行，每个单元格对应一格。编码仅用于文件保存，编辑器直接显示游戏贴图：

| 编码 | 内容 |
| --- | --- |
| 0 或空白 | 空格 |
| 1 | 红砖（实体平台） |
| 2 | 雪地（实体平台） |
| 3 | 土砖（实体平台） |
| 4 | 木箱（实体平台） |
| 5 | 金币 |
| 6 | 终点宝石 |
| 7 | 岩浆 |
| 8 | 水块（沿用原游戏规则，为实体平台） |
| 9 | 敌方法师 |
| 10 | 玩家起点（新增，最多一个） |

原有四张 CSV 地图仍可直接导入。没有玩家起点的旧地图会自动选择空白出生位置；自定义地图只生成显式放置的敌人。标准四关和无尽模式保留原有敌人生成规则。导入允许 UTF-8 BOM、CRLF、数字引号和空单元格，较短的行自动补空；无效编码会指出具体行列。最多支持 120 × 80 格、1 MB 文件。新建地图最小为 8 × 6 格。

运行地图格式及游戏接入检查：

```bash
node --test tests/*.test.js
```

## Feedback

右下角的 Feedback 按钮在新标签页打开反馈表单。按钮采用原生链接和 CSS，不需要后端或额外依赖。

## 全屏游玩

点击游戏上方的 **⛶ 全屏**，按原来的 **1500:800** 比例放大到整个屏幕。全屏模式隐藏外围导航、工具栏和反馈栏，保留右上角的 **退出全屏** 按钮；也可按 **Esc** 退出。切换不会重新开始关卡或清空进度。普通模式也恢复较大的画布显示，不再按工具栏高度缩小。

不支持或未允许系统全屏的浏览器会使用窗口全屏，按钮显示 **退出窗口全屏**。竖屏和横屏都保持比例；触屏模式用浅蓝色留白容纳操作按钮。

## Languages / 语言

The interface defaults to **English**. Use the **English / 中文** selector in the bottom-left corner to switch instantly. The choice is saved on this browser and shared between the two GitHub Pages sites. Menus, the map editor, validation messages, game HUD, end screens, and fullscreen controls follow the selected language. Changing language preserves the map, undo history, and current game. Map names and CSV tile codes are never translated.

界面默认英文，可通过左下角 **English / 中文** 切换并记住选择。切换不会重置地图或游戏进度；地图名称和 CSV 编码保持不变。


## Mobile / 手机操作

Touch controls appear on small screens and devices with a coarse pointer. Hold Left or Right to move, tap Jump or Sprint, and hold Water to fire at the normal cooldown. Multiple fingers can move and use a skill together. Choose difficulty and start/replay from the touch menu; the classic victory screen also offers Endless mode.

Rotate to landscape and select **Fullscreen** for a larger playfield. Controls sit beside the canvas in landscape fullscreen and below it in portrait. The game keeps its 1500 × 800 proportions and preserves progress when rotating or leaving fullscreen. Unsupported native fullscreen falls back to filling the browser window.

手机可同时按住移动键和跳跃 / 水弹 / 冲刺，长按水弹会按原有冷却连续发射。横屏全屏时，按键位于画面两侧；竖屏时按键在画面下方。金币、等级、经验与技能冷却以适合手机的尺寸显示。编辑器支持横向选择素材、拖动绘制、「移动」工具拖动画布、缩放、撤销，以及原有的 CSV 导入导出。

## Reliability checks / 防呆检查

Run `node --test tests/*.test.js` to check CSV limits and malformed input, import races, undo/redo, collision boundaries, paused game timers, mobile input, fullscreen fallbacks, and both languages. The suite also round-trips 100 deterministically generated maps and checks invalid cells at their exact row and column. Tests use Node's built-in runner and require no extra dependencies.

Delayed CSV or template loads preserve edits made while loading; the latest import takes precedence. Renaming has its own undo step. Game timers pause in the editor and hidden tabs. Simultaneous hazards apply one damage penalty before pickups, and collision checks account for fast falls and projectile corners.

导入或载入期间的新编辑会保留，旧请求不能覆盖新地图。重命名可独立撤销；进入编辑器或切到后台会暂停游戏计时。测试还覆盖无效尺寸、超大文件、草稿存储失败、多指取消、重复全屏操作与双语切换。
