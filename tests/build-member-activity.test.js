'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildMemberActivity } = require('../tools/build-member-activity');
const { summarizeMemberActivity } = require('../atlas/member-activity');
test('browser generation matches canonical Atlas behavior and check mode refuses stale content without overwriting', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-member-build-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('synk-member-build-'));fs.rmSync(directory, { recursive: true, force: true }); });
  const outputFile = path.join(directory, 'member-activity.mjs');
  assert.throws(() => buildMemberActivity({ outputFile, check: true }), /Stale member activity/);
  buildMemberActivity({ outputFile });
  assert.equal(buildMemberActivity({ outputFile, check: true }).checked, true);
  const manifestFile = outputFile.replace(/\.mjs$/, '.manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  assert.ok(manifest.sources['atlas/member-activity.js']);assert.ok(manifest.sources['atlas/trail-periods.js']);assert.ok(manifest.sources['atlas/vellum.js']);
  const browser = (await import(pathToFileURL(outputFile).href)).default;
  const schemaFile = path.join(directory, 'member-activity-data.mjs'), schema = await import(pathToFileURL(schemaFile).href);
  const canonicalSchema = await import('../experiences/synk-account/src/member-activity-data.mjs');
  assert.deepEqual(schema.emptyMemberActivity(), canonicalSchema.emptyMemberActivity());
  assert.deepEqual(schema.MEMBER_ACTIVITY_LIMITS, canonicalSchema.MEMBER_ACTIVITY_LIMITS);
  const input = { document: { version: 1, consent: true, enabledAt: '2026-08-01T00:00:00.000Z', events: [], favorites: ['path'] }, asOf: '2026-10-14T00:00:00.000Z' };
  assert.deepEqual(browser.summarizeMemberActivity(input), summarizeMemberActivity(input));
  const stale = '// altered browser artifact\n';fs.writeFileSync(outputFile, stale);
  assert.throws(() => buildMemberActivity({ outputFile, check: true }), /Stale member activity/);
  assert.equal(fs.readFileSync(outputFile, 'utf8'), stale);
});

test('a frozen desktop-only package validates its bundled receipt without depending on the repository builder', t => {
  const { verifyMemberActivity } = require('../desktop/tools/package.cjs');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-member-build-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('synk-member-build-'));fs.rmSync(directory, { recursive: true, force: true }); });
  const desktopRoot = path.join(directory, 'desktop'), outputFile = path.join(desktopRoot, 'renderer/generated/member-activity.mjs');
  buildMemberActivity({ outputFile });
  assert.doesNotThrow(() => verifyMemberActivity(desktopRoot));
  const schemaFile=path.join(path.dirname(outputFile),'member-activity-data.mjs'),schemaSource=fs.readFileSync(schemaFile,'utf8');
  fs.appendFileSync(schemaFile,'// changed schema\n');
  assert.throws(() => verifyMemberActivity(desktopRoot), /differs from its build manifest/);
  fs.writeFileSync(schemaFile,schemaSource);
  assert.doesNotThrow(() => verifyMemberActivity(desktopRoot));
  fs.appendFileSync(outputFile, '// changed\n');
  assert.throws(() => verifyMemberActivity(desktopRoot), /differs from its build manifest/);
});

test('shared statement code preserves the canonical API and document validation', async t => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-member-build-'));
  t.after(()=>{assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('synk-member-build-'));fs.rmSync(directory,{recursive:true,force:true});});
  const result=buildMemberActivity({outputFile:path.join(directory,'member-activity.mjs')});
  const generated=await import(pathToFileURL(path.join(directory,'member-understanding.mjs')).href);
  const schema=await import(pathToFileURL(path.join(directory,'member-understanding-data.mjs')).href);
  const canonical=require('../atlas/member-understanding.js'),canonicalSchema=await import('../experiences/synk-account/src/member-understanding-data.mjs');
  assert.deepEqual(Object.keys(generated.default).sort(),Object.keys(canonical).sort());
  assert.deepEqual(generated.default.summarizeMemberUnderstanding({asOf:'2026-10-28T00:00:00.000Z'}),canonical.summarizeMemberUnderstanding({asOf:'2026-10-28T00:00:00.000Z'}));
  assert.deepEqual(Object.keys(schema).sort(),Object.keys(canonicalSchema).sort());
  const outcome=fn=>{try{return {ok:true,value:fn()};}catch(error){return {ok:false,name:error.name,code:error.code,message:error.message};}};
  const cases=[schema.emptyMemberUnderstanding(),null,{version:1,reviews:[],overrides:[],unexpected:true},...Array.from({length:13},(_,i)=>({version:i+2,reviews:[],overrides:[],statements:[]})),{version:15,reviews:[],overrides:[],statements:[]}];
  for(const value of cases)assert.deepEqual(outcome(()=>schema.validateMemberUnderstanding(value)),outcome(()=>canonicalSchema.validateMemberUnderstanding(value)));
  // Check the receipt against emitted imports, independently of esbuild's
  // metadata: the native package must contain every module the browser asks for.
  for(const [file,receipt]of Object.entries(result.files)){
    const emitted=fs.readFileSync(path.join(directory,file),'utf8');
    const imports=require('acorn').parse(emitted,{ecmaVersion:'latest',sourceType:'module'}).body
      .filter(node=>['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type)&&node.source)
      .map(node=>path.posix.normalize(path.posix.join(path.posix.dirname(file),node.source.value))).sort();
    assert.deepEqual(receipt.imports,imports,'receipt traces emitted imports in '+file);
  }
  const receipt=JSON.parse(fs.readFileSync(path.join(directory,'member-understanding.manifest.json'),'utf8'));
  for(let version=1;version<=12;version++){
    const file='experiences/synk-account/src/member-statement-v'+version+'.cjs';assert.ok(receipt.sources[file],'compatibility source '+version+' is retained');
    const legacy=require('../'+file),text='예시가 좋아요',parsed=legacy.parseMemberStatement(text);assert.ok(parsed.meanings.length);
    const row={id:'00000000-0000-4000-8000-000000000001',parserVersion:legacy.PARSER_VERSION,text,at:'2026-10-29T00:00:00.000Z',confirmedAt:'2026-10-29T00:00:00.000Z',meanings:parsed.meanings,...(version>=2?{clarifications:[]}: {})};
    const value={version:version+1,reviews:[],overrides:[],statements:[row]},actual=outcome(()=>schema.validateMemberUnderstanding(value));
    assert.equal(actual.ok,true,'legacy parser '+version+' remains readable');assert.deepEqual(actual,outcome(()=>canonicalSchema.validateMemberUnderstanding(value)));
  }
  const current=require('../experiences/synk-account/src/member-statement-contract.cjs'),text='예시가 좋아요';
  const row={id:'00000000-0000-4000-8000-000000000002',parserVersion:current.PARSER_VERSION,text,at:'2026-10-29T00:00:00.000Z',confirmedAt:'2026-10-29T00:00:00.000Z',meanings:current.parseMemberStatement(text).meanings,clarifications:[]};
  const currentDocument={version:14,reviews:[],overrides:[],statements:[row]};
  assert.equal(row.parserVersion,'member-statement-ko-13');assert.ok(row.meanings.length);
  assert.equal(outcome(()=>schema.validateMemberUnderstanding(currentDocument)).ok,true);
  assert.deepEqual(outcome(()=>schema.validateMemberUnderstanding(currentDocument)),outcome(()=>canonicalSchema.validateMemberUnderstanding(currentDocument)));
  assert.equal(outcome(()=>schema.validateMemberUnderstanding({version:15,reviews:[],overrides:[],statements:[]})).ok,false,'unknown future documents remain rejected');
  // ko13 preserves the exact deployed ko12 source. Bound that compatibility
  // cost and compare the same four public entries without sharing.
  const esbuild=require(require.resolve('esbuild',{paths:[path.resolve(__dirname,'../experiences/synk-account')]}));
  const unshared=esbuild.buildSync({absWorkingDir:path.resolve(__dirname,'..'),
    entryPoints:['atlas/member-activity.js','experiences/synk-account/src/member-activity-data.mjs','atlas/member-understanding.js','experiences/synk-account/src/member-understanding-data.mjs'],
    outdir:path.join(directory,'unshared'),bundle:true,splitting:false,write:false,
    minifySyntax:true,minifyIdentifiers:true,minifyWhitespace:true,keepNames:true,
    platform:'browser',format:'esm',target:['es2022'],charset:'utf8',
    banner:{js:'// Generated by tools/build-member-activity.js from canonical source. Do not edit.'}});
  const unsharedBytes=unshared.outputFiles.reduce((sum,file)=>sum+file.contents.length,0);
  assert.ok(result.totalBytes<1450000,'document14 includes the exact deployed ko12 parser for backward replay within a bounded shared byte budget');
  assert.ok(result.totalBytes<unsharedBytes*.7,'sharing saves at least 30 percent against equivalent separately bundled entries');
});

test('frozen packages reject missing, modified, extra and redirected shared chunks', t => {
  const {verifyMemberActivity}=require('../desktop/tools/package.cjs');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-member-build-'));
  t.after(()=>{assert.equal(path.dirname(directory),os.tmpdir());assert.ok(path.basename(directory).startsWith('synk-member-build-'));fs.rmSync(directory,{recursive:true,force:true});});
  const desktopRoot=path.join(directory,'desktop'),generated=path.join(desktopRoot,'renderer/generated');
  const outputFile=path.join(generated,'member-activity.mjs'),result=buildMemberActivity({outputFile});
  const chunk=Object.keys(result.files).find(name=>name.startsWith('member-shared/')),file=path.join(generated,chunk),original=fs.readFileSync(file);
  fs.unlinkSync(file);assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/);fs.writeFileSync(file,original);
  fs.appendFileSync(file,'// tampered\n');assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/);fs.writeFileSync(file,original);
  const extra=path.join(generated,'member-shared/chunk-AAAAAAAA.mjs');fs.writeFileSync(extra,'export const extra=true;');
  assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/);
  assert.throws(()=>buildMemberActivity({outputFile,check:true}),/Stale member activity/);
  buildMemberActivity({outputFile});assert.equal(fs.existsSync(extra),false);assert.doesNotThrow(()=>verifyMemberActivity(desktopRoot));
  const receipts=result.artifacts.map(({manifestFile})=>[manifestFile,fs.readFileSync(manifestFile,'utf8')]);
  for(const redirected of ['../escaped.mjs','/absolute.mjs','https://example.invalid/chunk.mjs','member-shared/../escaped.mjs']){
    for(const [manifestFile,raw]of receipts){const manifest=JSON.parse(raw);manifest.files[redirected]=manifest.files[chunk];delete manifest.files[chunk];fs.writeFileSync(manifestFile,JSON.stringify(manifest));}
    assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/,redirected);
    for(const [manifestFile,raw]of receipts)fs.writeFileSync(manifestFile,raw);
  }
  for(const [manifestFile,raw]of receipts){const manifest=JSON.parse(raw);for(const record of Object.values(manifest.files))record.imports=[];fs.writeFileSync(manifestFile,JSON.stringify(manifest));}
  assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/,'receipts cannot leave emitted shared modules unreachable');
  for(const [manifestFile,raw]of receipts)fs.writeFileSync(manifestFile,raw);
  // A missing chunk must not become invisible by also removing its receipt
  // and graph edges while leaving the real JavaScript imports unchanged.
  fs.unlinkSync(file);
  for(const [manifestFile,raw]of receipts){const manifest=JSON.parse(raw);delete manifest.files[chunk];for(const record of Object.values(manifest.files))record.imports=record.imports.filter(name=>name!==chunk);fs.writeFileSync(manifestFile,JSON.stringify(manifest));}
  assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/,'actual imports cannot be erased from the receipt');
  fs.writeFileSync(file,original);for(const [manifestFile,raw]of receipts)fs.writeFileSync(manifestFile,raw);
  const shared=path.join(generated,'member-shared'),held=path.join(directory,'held-shared');fs.renameSync(shared,held);
  try{
    fs.symlinkSync(held,shared,process.platform==='win32'?'junction':'dir');
    assert.throws(()=>verifyMemberActivity(desktopRoot),/build manifest/);
    assert.throws(()=>buildMemberActivity({outputFile}),/Unsafe member activity directory/);
  }finally{if(fs.existsSync(shared))fs.unlinkSync(shared);fs.renameSync(held,shared);}
  const foreign=path.join(shared,'preserve.txt');fs.writeFileSync(foreign,'not a generated artifact');
  assert.throws(()=>buildMemberActivity({outputFile}),/Unexpected member activity chunk/);
  assert.equal(fs.readFileSync(foreign,'utf8'),'not a generated artifact');fs.unlinkSync(foreign);
  assert.doesNotThrow(()=>verifyMemberActivity(desktopRoot));
});
