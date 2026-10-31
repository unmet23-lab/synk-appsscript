'use strict';
// Restore only reversible runtime memo changes. Historical hashes and
// labelled fixtures remain unchanged; repaired source has a distinct hash.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),crypto=require('node:crypto'),acorn=require('acorn');
const pins=require('./fixtures/member-parser-compatibility-20261029.json');
const runtimePins=require('./fixtures/member-parser-runtime-history-20261031.json');
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(value&&typeof value==='object')for(const child of Array.isArray(value)?value:[value])walk(child,visit);}
function beforeRuntimeMemo(source,version){
 const compPrefix='// Performance-only repair: keep ko-'+version+' compositional replay unchanged.\n';
 if(source.includes(compPrefix)){
  const wrapper=compPrefix+'function compositional(quote, cache = new Map()) {\n  if (cache.has(quote)) { const result = cache.get(quote); return result == null ? result : copy(result); }\n  const result = compositionalUncached(quote, cache);\n  cache.set(quote, result == null ? result : copy(result));\n  return result;\n}\n';assert.equal(source.split(wrapper).length,2);
  const nodes=[];walk(acorn.parse(source,{ecmaVersion:'latest'}),n=>{if(n.type==='FunctionDeclaration'&&n.id?.name==='compositionalUncached')nodes.push(n);});assert.equal(nodes.length,1);const edits=[];
  walk(nodes[0].body,n=>{if(n.type==='CallExpression'&&n.callee?.name==='compositional'){assert.equal(n.arguments.length,2);assert.equal(n.arguments[1].name,'cache');assert.equal(source.slice(n.arguments[0].end,n.arguments[1].end),', cache');edits.push({start:n.arguments[0].end,end:n.arguments[1].end});}});assert.equal(edits.length,version===6?6:5);
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+source.slice(e.end);source=source.replace(wrapper,'').replace('function compositionalUncached(quote, cache) {','function compositional(quote) {');
 }
 const prefix='// Performance-only repair: keep ko-'+version+' interpretation/replay semantics; the original bytes remain in git 2a3a74e85.\n',wrapper=prefix+'function natural(quote, cache = new Map()) {\n  if (cache.has(quote)) { const result = cache.get(quote); return result == null ? result : copy(result); }\n  const result = naturalUncached(quote, cache);\n  cache.set(quote, result == null ? result : copy(result));\n  return result;\n}\n';
 if(!source.includes(prefix))return source;
 assert.equal(source.split(wrapper).length,2);const nodes=[];walk(acorn.parse(source,{ecmaVersion:'latest',sourceType:'script'}),n=>{if(n.type==='FunctionDeclaration'&&n.id?.name==='naturalUncached')nodes.push(n);});assert.equal(nodes.length,1);
 const edits=[];const uncache=n=>{assert.equal(n.arguments.length,2);const argument=n.arguments[1];assert.equal(argument.name,'cache');assert.equal(source.slice(n.arguments[0].end,argument.end),', cache');edits.push({start:n.arguments[0].end,end:argument.end});};
 let naturalCalls=0;walk(nodes[0].body,n=>{if(n.type==='CallExpression'&&n.callee?.name==='natural'){uncache(n);naturalCalls++;}});assert.equal(naturalCalls,7);
 const comparisons=[];walk(acorn.parse(source,{ecmaVersion:'latest',sourceType:'script'}),n=>{if(n.type==='FunctionDeclaration'&&n.id?.name==='comparative')comparisons.push(n);});assert.equal(comparisons.length,1);
 const comparison=comparisons[0];if(comparison.params.length===2){assert.equal(comparison.params[1].name,'cache');edits.push({start:comparison.params[0].end,end:comparison.params[1].end});let calls=0;walk(comparison.body,n=>{if(n.type==='CallExpression'&&n.callee?.name==='natural'){uncache(n);calls++;}});assert.equal(calls,2);let links=0;walk(nodes[0].body,n=>{if(n.type==='CallExpression'&&n.callee?.name==='comparative'){uncache(n);links++;}});assert.equal(links,1);}else assert.equal(comparison.params.length,1);
 for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+source.slice(edit.end);
 return source.replace(wrapper,'').replace('function naturalUncached(quote, cache) {','function natural(quote) {');
}
function historicalParsers(){const loaded=new Map();function load(version){if(loaded.has(version))return loaded.get(version);assert.ok([4,5,6,7,8,9,10,11].includes(version));const filename=require.resolve('../experiences/synk-account/src/member-statement-v'+version+'.cjs'),source=beforeRuntimeMemo(fs.readFileSync(filename,'utf8'),version),pin=[...pins.rows,...runtimePins.rows].find(row=>row.version===version);assert.equal(crypto.createHash('sha256').update(source).digest('hex'),pin.sha256);const legacy=new Module(filename,module);legacy.filename=filename;legacy.paths=Module._nodeModulePaths(path.dirname(filename));const normal=legacy.require.bind(legacy);legacy.require=id=>{const match=/^\.\/member-statement-v(\d+)\.cjs$/.exec(id);return match&&Number(match[1])>=4?load(Number(match[1])):normal(id);};legacy._compile(source,filename);loaded.set(version,legacy.exports);return legacy.exports;}return{load};}
module.exports={beforeRuntimeMemo,historicalParsers};
