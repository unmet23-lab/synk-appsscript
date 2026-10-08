import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,stat,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {Store} from './store.mjs';

const prefix='synk-store-recovery-key-';
const digest=value=>createHash('sha256').update(value).digest('hex');
function safeTemporary(root){
  const base=resolve(tmpdir()),actual=resolve(root);
  assert.ok(actual.startsWith(base+sep)&&actual.split(sep).at(-1).startsWith(prefix),'cleanup must stay inside this test temporary directory');
  return actual;
}
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),prefix));
  t.after(()=>rm(safeTemporary(root),{recursive:true,force:true}));
  return root;
}
async function fileSnapshot(directory){
  const result=[];
  for(const name of (await readdir(directory)).sort()){
    const path=join(directory,name),info=await stat(path);
    if(info.isFile())result.push({name,size:info.size,modified:info.mtimeMs,sha256:digest(await readFile(path))});
  }
  return result;
}
function missingKeyError(error,directory){
  assert.equal(error.code,'SYNK_ENCRYPTION_KEY_MISSING');
  assert.match(error.message,/원래 키.*복구/);
  assert.equal(error.message.includes(directory),false,'startup error must not expose a private data path');
  assert.equal(error.message.includes('synthetic-private-work'),false,'startup error must not expose stored content');
  return true;
}
async function seed(directory){
  const store=new Store(directory);
  try{
    store.put('testDocuments','private',{draft:'synthetic-private-work'});
    store.setSecret('test-secret',{draft:'synthetic-private-work'});
  }finally{store.close();}
  return readFile(join(directory,'encryption.key'));
}

for(const existingEmptyDirectory of [false,true])test(`new company storage initializes normally with ${existingEmptyDirectory?'an existing empty':'a new nested'} directory`,async t=>{
  const root=await fixture(t),directory=join(root,'new','company');
  if(existingEmptyDirectory)await mkdir(directory,{recursive:true});
  let store=new Store(directory);
  try{
    store.setSecret('test-secret',{marker:'synthetic-initialization'});
    assert.equal(store.secret('test-secret').marker,'synthetic-initialization');
  }finally{store.close();}
  const key=await readFile(join(directory,'encryption.key'));
  assert.equal(key.length,32);await access(join(directory,'company.sqlite'));
  store=new Store(directory);
  try{assert.equal(store.secret('test-secret').marker,'synthetic-initialization');}finally{store.close();}
  assert.ok(digest(await readFile(join(directory,'encryption.key')))===digest(key),'normal reopening must retain its original key');
});

test('an existing company DB without its key refuses repeated starts without recreating a key or changing any DB files',async t=>{
  const root=await fixture(t),directory=join(root,'company');await seed(directory);
  const keyPath=join(directory,'encryption.key');await rm(keyPath);
  const before=await fileSnapshot(directory);
  for(let attempt=0;attempt<3;attempt++){
    assert.throws(()=>new Store(directory),error=>missingKeyError(error,directory));
    await assert.rejects(access(keyPath),error=>error.code==='ENOENT','a refusal must not generate a replacement key');
    assert.deepEqual(await fileSnapshot(directory),before,'a refusal must not open, migrate, update or create DB/WAL files');
  }
});

test('restoring the original key after a refused start preserves and decrypts the existing company data',async t=>{
  const root=await fixture(t),directory=join(root,'company'),key=await seed(directory),keyPath=join(directory,'encryption.key');
  await rm(keyPath);const dbHash=digest(await readFile(join(directory,'company.sqlite')));
  assert.throws(()=>new Store(directory),error=>missingKeyError(error,directory));
  assert.ok(digest(await readFile(join(directory,'company.sqlite')))===dbHash,'failed start must preserve the restorable DB');
  await writeFile(keyPath,key,{flag:'wx',mode:0o600});
  const restored=new Store(directory);
  try{
    assert.equal(restored.get('testDocuments','private').draft,'synthetic-private-work');
    assert.equal(restored.secret('test-secret').draft,'synthetic-private-work');
  }finally{restored.close();}
  assert.ok(digest(await readFile(keyPath))===digest(key),'successful recovery must use the supplied original key');
});

test('even an empty existing company DB file requires its original key before SQLite can initialize it',async t=>{
  const root=await fixture(t),directory=join(root,'company');await mkdir(directory);
  await writeFile(join(directory,'company.sqlite'),Buffer.alloc(0));const before=await fileSnapshot(directory);
  assert.throws(()=>new Store(directory),error=>missingKeyError(error,directory));
  await assert.rejects(access(join(directory,'encryption.key')),error=>error.code==='ENOENT');
  assert.deepEqual(await fileSnapshot(directory),before,'an existing DB must never be treated as fresh storage merely because it is empty');
});
