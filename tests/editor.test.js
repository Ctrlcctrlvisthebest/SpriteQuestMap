"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const M=require('../map-format.js');
const {setupEditor,deferred}=require('./helpers/editor.js');
const mapFile=(csv,name='loaded.csv')=>({size:csv.length,name,text:async()=>csv});

test('failed import and invalid dimensions preserve the current map and undo history',async()=>{
  const ui=setupEditor(); await ui.paint(4,3); const before=await ui.csv();
  await ui.import(mapFile('0,invalid,6'));
  assert.equal(await ui.csv(),before); assert.equal(ui.$('editor-undo').disabled,false);
  ui.$('map-cols').value='NaN'; await ui.$('new-map').click();
  assert.equal(await ui.csv(),before);
});

test('a slow import cannot overwrite a newer brush stroke',async()=>{
  const ui=setupEditor(), load=deferred();
  const pending=ui.import({size:40,name:'slow.csv',text:()=>load.promise});
  await ui.paint(4,3); const before=await ui.csv();
  load.resolve(M.toCSV(M.createMap(8,6))); await pending;
  assert.equal(await ui.csv(),before);
});

test('a template response cannot overwrite a newly created map',async()=>{
  const load=deferred(),ui=setupEditor({fetch:()=>load.promise});
  const pending=ui.$('load-template').click();
  ui.$('map-cols').value='14';ui.$('map-rows').value='8';await ui.$('new-map').click();
  const before=await ui.csv();
  load.resolve({ok:true,text:async()=>M.toCSV(M.createMap(8,6))}); await pending;
  assert.equal(await ui.csv(),before); assert.equal(ui.$('load-template').disabled,false);
});

test('the most recent import wins even when responses finish out of order',async()=>{
  const ui=setupEditor(),old=deferred();
  const pending=ui.import({size:40,name:'old.csv',text:()=>old.promise});
  await ui.import(mapFile(M.toCSV(M.createMap(12,8)),'new.csv'));
  old.resolve(M.toCSV(M.createMap(8,6)));await pending;
  assert.equal((await ui.grid())[0].length,12);assert.equal(ui.$('map-name').value,'new');
});

test('an import finishing during a held brush stroke preserves and commits that stroke',async()=>{
  const ui=setupEditor(),load=deferred(),canvas=ui.$('editor-canvas');
  const pending=ui.import({size:40,name:'slow.csv',text:()=>load.promise});
  await canvas.emit('pointerdown',{pointerId:1,clientX:144,clientY:112});
  load.resolve(M.toCSV(M.createMap(8,6)));await pending;
  assert.equal(canvas.hasPointerCapture(1),false);
  const grid=await ui.grid();assert.equal(grid[0].length,40);assert.equal(grid[3][4],2);
  await ui.$('editor-undo').click();assert.equal((await ui.grid())[3][4],0);
});

test('leaving the editor cancels a pending load without navigating back on completion',async()=>{
  const ui=setupEditor(),load=deferred();await ui.$('nav-editor').click();
  const pending=ui.import({size:40,name:'slow.csv',text:()=>load.promise});
  await ui.$('nav-game').click();
  load.resolve(M.toCSV(M.createMap(8,6)));await pending;
  assert.equal(ui.$('editor-view').hidden,true);assert.equal(ui.$('game-view').hidden,false);
  assert.equal((await ui.grid())[0].length,40);
});

test('an obsolete import error cannot replace a newer successful result',async()=>{
  const ui=setupEditor(),load=deferred();
  const pending=ui.import({size:40,name:'slow.csv',text:()=>load.promise});
  await ui.import(mapFile(M.toCSV(M.createMap(12,8)),'new.csv'));
  const message=ui.$('app-message').querySelector('span').textContent;
  load.reject(new Error('Stale read failed'));await pending;
  assert.equal(ui.$('app-message').querySelector('span').textContent,message);
  assert.equal(ui.$('map-name').value,'new');
});

test('a pointer cancellation from a second finger does not finish the active stroke',async()=>{
  const ui=setupEditor(),canvas=ui.$('editor-canvas');
  await canvas.emit('pointerdown',{pointerId:1,clientX:80,clientY:80});
  await canvas.emit('pointercancel',{pointerId:2});
  assert.equal(canvas.hasPointerCapture(1),true);
  await canvas.emit('pointermove',{pointerId:1,clientX:144,clientY:80});
  await canvas.emit('pointerup',{pointerId:1});
  const grid=await ui.grid();assert.deepEqual(grid[2].slice(2,5),[2,2,2]);
  await ui.$('editor-undo').click();assert.deepEqual((await ui.grid())[2].slice(2,5),[0,0,0]);
});

test('renaming a map forms its own undo step instead of being lost with a terrain undo',async()=>{
  const ui=setupEditor();await ui.paint(4,3);
  const input=ui.$('map-name');input.focus();input.value='Renamed';await input.emit('input');await input.emit('change');input.blur();
  await ui.$('editor-undo').click();
  assert.equal(ui.$('map-name').value,'My adventure');assert.equal((await ui.grid())[3][4],2);
  await ui.$('editor-redo').click();assert.equal(ui.$('map-name').value,'Renamed');
});

test('storage failures leave editing, export and undo available',async()=>{
  const ui=setupEditor({storageBlocked:true});await ui.paint(4,3);
  assert.equal((await ui.grid())[3][4],2);await ui.$('editor-undo').click();assert.equal((await ui.grid())[3][4],0);
  assert.match(ui.$('draft-status').textContent,/Cannot save/);
});

test('name edits enable Undo immediately and cannot offer stale Redo history',async()=>{
  const ui=setupEditor(),input=ui.$('map-name');
  input.focus();input.value='Renamed';await input.emit('input');
  assert.equal(ui.$('editor-undo').disabled,false);
  await ui.$('editor-undo').click();assert.equal(input.value,'My adventure');
  assert.equal(ui.$('editor-redo').disabled,false);
  input.value='Another name';await input.emit('input');
  assert.equal(ui.$('editor-redo').disabled,true);
  await ui.$('editor-undo').click();assert.equal(input.value,'My adventure');
  await ui.$('editor-redo').click();assert.equal(input.value,'Another name');
});
