import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {WARDROBE_ITEMS} from '../../synk-world-home/wardrobe-catalog.mjs';

test('every selectable garment has a complete 256px catalog render matching the published provenance',()=>{
  const source=JSON.parse(fs.readFileSync(new URL('../../../docs/_ops/qa/platform-performance-20261012/wardrobe/catalog-thumbnail-source.json',import.meta.url),'utf8'));
  assert.equal(source.images.length,WARDROBE_ITEMS.length);
  assert.equal(new Set(source.images.map(x=>x.id)).size,WARDROBE_ITEMS.length);
  for(const item of WARDROBE_ITEMS){
    const entry=source.images.find(x=>x.id===item.id);assert.ok(entry,item.id);
    const image=fs.readFileSync(new URL('../../synk-world-home/'+entry.path,import.meta.url));
    assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a',item.id);
    assert.equal(image.readUInt32BE(16),256);assert.equal(image.readUInt32BE(20),256);
    assert.equal(image.length,entry.bytes);assert.ok(image.length>10000);
    assert.equal(crypto.createHash('sha256').update(image).digest('hex'),entry.sha256);
  }
});
