"use strict";

// Count actual canvas image commands through editor pointer events, using the same map and path.
// This isolates rendering work; it is not a browser FPS or page-load benchmark.
const { execFileSync } = require("node:child_process");
const { setupEditor } = require("../tests/helpers/editor.js");
const SpriteMap = require("../map-format.js");

async function measure(source) {
  let images = 0;
  const ui = setupEditor({ source, onDraw: method => { if (method === "drawImage") images++; } });
  const csv = SpriteMap.toCSV(Array.from({ length: 80 }, () => Array(120).fill(2)));
  await ui.import({ name: "benchmark.csv", size: csv.length, text: async () => csv }); ui.flush();
  const canvas = ui.$("editor-canvas");
  await canvas.emit("pointermove", { clientX: 16, clientY: 16 }); ui.flush(); images = 0;
  for (let col = 1; col <= 100; col++) {
    await canvas.emit("pointermove", { clientX: col * 32 + 16, clientY: 16 }); ui.flush();
  }
  const moving = images; images = 0;
  for (let i = 0; i < 100; i++) {
    await canvas.emit("pointermove", { clientX: 3217, clientY: 16 }); ui.flush();
  }
  return { movingAcross100Cells: moving, movingWithinOneCell100Times: images };
}

(async () => {
  if (process.argv[2]) {
    const source = execFileSync("git", ["show", `${process.argv[2]}:editor.js`], { cwd: require("node:path").resolve(__dirname, ".."), encoding: "utf8" });
    console.log("Before:", await measure(source));
  }
  console.log("Current:", await measure());
})().catch(error => { console.error(error); process.exitCode = 1; });
