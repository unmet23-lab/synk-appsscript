'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {stagePayloadFile}=require('../installer/tests/measure.cjs');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-installer-stage-'));
  t.after(()=>{
    const resolved=fs.realpathSync(root);
    assert.equal(path.dirname(resolved).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());
    assert.match(path.basename(resolved),/^synk-installer-stage-/);
    fs.rmSync(resolved,{recursive:true,force:true});
  });
  const original=path.join(root,'original.bin'),target=path.join(root,'target.bin'),contents=Buffer.from('original payload');
  fs.writeFileSync(original,contents);
  return {original,target,contents,expected:{bytes:contents.length,sha256:digest(contents)}};
}
test('payload staging links a local file and verifies the saved manifest',t=>{
  const f=fixture(t);
  assert.equal(stagePayloadFile(f.original,f.target,f.expected),'hardlink');
  assert.deepEqual(fs.readFileSync(f.original),f.contents);
  assert.deepEqual(fs.readFileSync(f.target),f.contents);
});
test('cross-volume EXDEV copies the payload without moving or changing the original',t=>{
  const f=fixture(t);
  const io={...fs,linkSync(){throw Object.assign(new Error('cross-volume'),{code:'EXDEV'});}};
  assert.equal(stagePayloadFile(f.original,f.target,f.expected,io),'copy');
  assert.deepEqual(fs.readFileSync(f.original),f.contents);
  assert.deepEqual(fs.readFileSync(f.target),f.contents);
  fs.writeFileSync(f.target,'changed fixture target');
  assert.deepEqual(fs.readFileSync(f.original),f.contents,'fallback must make an independent copy');
});
test('staging never falls back on another link error or overwrites an existing target',t=>{
  const f=fixture(t);
  const denied=Object.assign(new Error('denied'),{code:'EACCES'});
  assert.throws(()=>stagePayloadFile(f.original,f.target,f.expected,{...fs,linkSync(){throw denied;}}),e=>e===denied);
  assert.equal(fs.existsSync(f.target),false);
  fs.writeFileSync(f.target,'preserve previous evidence');
  assert.throws(()=>stagePayloadFile(f.original,f.target,f.expected,{...fs,linkSync(){throw Object.assign(new Error('cross-volume'),{code:'EXDEV'});}}),{code:'EEXIST'});
  assert.equal(fs.readFileSync(f.target,'utf8'),'preserve previous evidence');
  assert.deepEqual(fs.readFileSync(f.original),f.contents);
});
test('copied bytes must match the captured source manifest',t=>{
  const f=fixture(t);
  assert.throws(()=>stagePayloadFile(f.original,f.target,{...f.expected,sha256:digest('another payload')},{...fs,linkSync(){throw Object.assign(new Error('cross-volume'),{code:'EXDEV'});}}),/Staged payload differs/);
  assert.deepEqual(fs.readFileSync(f.original),f.contents);
});
