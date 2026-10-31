import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {해시청크이름짝,후보내용대조} from '../tools/검수묶음.mjs';
const prefix='.github/desktop-preview/unified/source/renderer/generated/member-shared/',old=prefix+'chunk-ABCDEFG1.mjs',next=prefix+'chunk-ABCDEFG2.mjs',sha=b=>crypto.createHash('sha256').update(b).digest('hex'),entry=(p,b,mode='100644')=>({경로:p,종류:'새',모드:mode,sha256:sha(b)});
test('a unique content-hashed generated chunk pair retains both paths and all actual edits',()=>{
  const before=Buffer.from('const values="'+'same '.repeat(300)+'";const owner=1;'),after=Buffer.from('const values="'+'same '.repeat(300)+'";const owner=2;'),a=entry(old,before),b=entry(next,after),pairs=해시청크이름짝([old,next],new Map([[old,a]]),new Map([[next,b]]));
  assert.equal(pairs.get(next),old);
  const body=후보내용대조(next,a,b,before,after,{옛경로:old});assert.ok(body.글.includes(old)&&body.글.includes(next));assert.ok(body.글.includes(a.sha256)&&body.글.includes(b.sha256));assert.ok(body.글.includes('[-1-]{+2+}'));
  const note=후보내용대조(old,a,null,before,null,{새경로:next,새항목:b});assert.ok(note.글.includes(next));assert.ok(note.글.includes(a.sha256)&&note.글.includes(b.sha256));
});
test('ambiguous pairs, another directory, ordinary filenames and mode changes stay separate',()=>{
  const b=Buffer.from('export const value=1;'),third=prefix+'chunk-ABCDEFG3.mjs',a=entry(old,b),n=entry(next,b);
  assert.equal(해시청크이름짝([old,next,third],new Map([[old,a]]),new Map([[next,n],[third,entry(third,b)]])).size,0);
  assert.equal(해시청크이름짝([old,next],new Map([[old,a]]),new Map([[next,entry(next,b,'100755')]])).size,0);
  assert.equal(해시청크이름짝(['a.mjs','b.mjs'],new Map([['a.mjs',entry('a.mjs',b)]]),new Map([['b.mjs',entry('b.mjs',b)]])).size,0);
  const other='other/renderer/generated/member-shared/chunk-ABCDEFG2.mjs';assert.equal(해시청크이름짝([old,other],new Map([[old,a]]),new Map([[other,entry(other,b)]])).size,0);
});
test('a paired comparison rejects changed before or after bytes instead of repinning them',()=>{
  const a=Buffer.from('export const a=1;'),b=Buffer.from('export const a=2;'),before=entry(old,a),after=entry(next,b);
  assert.throws(()=>후보내용대조(next,before,after,Buffer.from('bad'),b,{옛경로:old}),/앞 후보 내용/);
  assert.throws(()=>후보내용대조(next,before,after,a,Buffer.from('bad'),{옛경로:old}),/지금 후보 내용/);
});
test('ordinary candidate updates and true deletions still show their complete changes',()=>{
  const a=Buffer.from('export const value=1;\n'),b=Buffer.from('export const value=2;\n'),before=entry('plain.mjs',a),after=entry('plain.mjs',b);
  const changed=후보내용대조('plain.mjs',before,after,a,b);assert.ok(changed.글.includes('-export const value=1;')&&changed.글.includes('+export const value=2;'));
  assert.ok(후보내용대조('plain.mjs',before,null,a,null).글.includes('-export const value=1;'));
});
