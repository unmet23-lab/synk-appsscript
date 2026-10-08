'use strict';
const { chromium } = require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const out = path.join(__dirname, 'engine-upgrade-20261006'); await fs.mkdir(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(process.env.CARE_TEST_BASE || 'http://127.0.0.1:4296/');
    const result = await page.evaluate(async () => {
      const { createMemoryCard } = await import('/memory-card.mjs');
      const input = { person: { id: 'p', name: '지민' }, title: '오래 기억하고 싶은 하루', message: '네 덕분에 평범한 하루가 특별해졌어. 다음에 만나면 그날 이야기를 또 하자.', memories: [{ id: 'm', personId: 'p', text: '비가 그친 뒤 같이 걸었던 바닷가. 무슨 이야기를 그렇게 많이 했는지, 돌아오는 길 내내 웃었던 기억이 나.' }] };
      const card = await createMemoryCard(input), bytes = [...new Uint8Array(await card.blob.arrayBuffer())];
      const image = await createImageBitmap(card.blob); const decoded = { width: image.width, height: image.height }; image.close();
      const longest = await createMemoryCard({ ...input, title: '가'.repeat(60), message: '나'.repeat(300), memories: [0, 1, 2].map(id => ({ id: `m${id}`, personId: 'p', text: '다'.repeat(240) })) });
      const photoCanvas = document.createElement('canvas'); photoCanvas.width = 400; photoCanvas.height = 300;
      const context = photoCanvas.getContext('2d'); context.fillStyle = '#315cba'; context.fillRect(0, 0, 400, 300);
      const photoFile = await new Promise(resolve => photoCanvas.toBlob(resolve, 'image/png'));
      const withPhoto = await createMemoryCard({ ...input, photoFile });
      let invalidPhoto = false;
      try { await createMemoryCard({ ...input, photoFile: new Blob(['not image'], { type: 'image/png' }) }); } catch { invalidPhoto = true; }
      return { bytes, filename: card.filename, width: card.width, height: card.height, decoded, longest: { width: longest.width, height: longest.height, size: longest.blob.size }, photoSize: withPhoto.blob.size, invalidPhoto, fontLoaded: document.fonts.check('500 40px SUIT') };
    });
    assert.deepEqual(result.decoded, { width: result.width, height: result.height });
    assert.equal(result.width, 1080); assert(result.height >= 1350); assert(result.longest.height <= 4400);
    assert(result.longest.size < 20 * 1024 * 1024); assert(result.photoSize > 0); assert(result.invalidPhoto); assert(result.fontLoaded);
    assert.equal(result.filename, 'synk-care-memory.png');
    await fs.writeFile(path.join(out, 'memory-card.png'), Buffer.from(result.bytes)); delete result.bytes;
    await fs.writeFile(path.join(out, 'memory-card-result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
