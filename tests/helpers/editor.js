"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createGameContext, root } = require("./game.js");
const SpriteMap = require("../../map-format.js");

function setupEditor(options = {}) {
  const elements = new Map(), created = [], raf = [], saved = new Map();
  let document, exported;
  class Element {
    constructor(id = "") {
      this.id = id; this.dataset = {}; this.children = []; this.listeners = {};
      this.value = ""; this.checked = true; this.hidden = false; this.disabled = false;
      this.width = 1280; this.height = 576; this.clientWidth = 640; this.clientHeight = 320;
      this.clientLeft = this.clientTop = this.scrollLeft = this.scrollTop = 0;
      this.captures = new Set(); this.attributes = {}; this.classes = new Set();
      this.classList = { add: n => this.classes.add(n), remove: n => this.classes.delete(n),
        toggle: (n, on) => on ? this.classes.add(n) : this.classes.delete(n), contains: n => this.classes.has(n) };
      created.push(this);
    }
    setAttribute(k, v) { this.attributes[k] = v; }
    removeAttribute(k) { delete this.attributes[k]; }
    append(...nodes) { this.children.push(...nodes); }
    remove() {}
    querySelector(tag) { return this.children.find(c => c.tag === tag) || this.children[0]; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type, args = {}) {
      const event = { target: this, button: 0, pointerId: 1, preventDefault() {}, ...args };
      return Promise.all([...(this.listeners[type] || []), ...(this['on' + type] ? [this['on' + type]] : [])].map(fn => fn(event)));
    }
    focus() { document.activeElement?.blur(); document.activeElement = this; this.emit('focus'); }
    blur() { if (document.activeElement === this) document.activeElement = null; this.emit('blur'); }
    click() { return this.emit('click'); }
    closest() { return null; }
    getContext() { return new Proxy({}, { get: (_target, method) => (...args) => options.onDraw?.(method, args) }); }
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); this.emit('lostpointercapture', { pointerId: id }); }
    scrollTo(x, y) { this.scrollLeft = Math.max(0,x); this.scrollTop = Math.max(0,y); }
  }
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) elements.set(match[1],new Element(match[1]));
  const tools = ['paint','erase','fill','pan'].map(tool => { const e=new Element(); e.dataset.tool=tool; return e; });
  document = new Element(); document.body = new Element(); document.activeElement = null;
  document.getElementById = id => elements.get(id);
  document.createElement = tag => { const e=new Element(); e.tag=tag; return e; };
  document.querySelectorAll = selector => selector === '[data-tool]' ? tools : selector === '[data-tile]' ? created.filter(e=>e.dataset.tile !== undefined) : [];
  for (const tag of ['span','button']) elements.get('app-message').append(document.createElement(tag));
  elements.get('editor-zoom').value='32'; elements.get('map-template').value='1';
  elements.get('map-cols').value='40'; elements.get('map-rows').value='18';
  const window = new Element(); window.matchMedia = () => ({ matches:true, addEventListener() {} });
  const context = createGameContext({ document, window, Blob,
    localStorage: { getItem: k => saved.get(k) ?? null, setItem(k,v) { if(options.storageBlocked) throw new Error('quota'); saved.set(k,v); } },
    Image: class extends Element { constructor() { super(); this.complete=true; this.naturalWidth=32; } },
    ResizeObserver: class { observe() {} }, requestAnimationFrame: fn => raf.push(fn),
    setTimeout: () => 0, clearTimeout() {}, fetch: (...args) => options.fetch(...args),
    URL: { createObjectURL(blob) { exported=blob; return 'blob:test'; }, revokeObjectURL() {} }
  });
  vm.runInContext(options.source ?? fs.readFileSync(path.join(root,'editor.js'),'utf8'),context);
  function flush() { for(let limit=0; raf.length && limit<10; limit++) raf.splice(0).forEach(fn=>fn()); }
  flush();
  const ui={ elements, context, window, document, tools, saved, flush, $: id=>elements.get(id),
    run: source=>vm.runInContext(source,context),
    async csv() { await elements.get('editor-export').click(); return exported.text(); },
    async grid() { return SpriteMap.parseCSV(await this.csv()); },
    async paint(col,row,pointerId=1) { const canvas=elements.get('editor-canvas'); await canvas.emit('pointerdown',{pointerId,clientX:col*32+16,clientY:row*32+16}); await canvas.emit('pointerup',{pointerId}); flush(); },
    import(file) { const input=elements.get('csv-file'); input.files=[file]; return input.emit('change'); }
  };
  return ui;
}
function deferred() { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;}); return {promise,resolve,reject}; }
module.exports={setupEditor,deferred};
