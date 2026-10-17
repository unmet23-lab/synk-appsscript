'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {htmlServiceClientHtml}=require('../receiver/build.cjs');
const {CI에없는로컬자료}=require('../../../../tests/_git밖.js');
const 루트=path.resolve(__dirname,'../../../..');
const getScript=html=>{const found=/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i.exec(html);assert(found);return found[1];};
const decode=bootstrap=>{const found=/atob\("([A-Za-z0-9_-]+)"/.exec(bootstrap);assert(found);return Buffer.from(found[1],'base64url').toString('utf8');};

test('online HTML protects the real client source and preserves its exact UTF-8 bytes',t=>{
  const file=path.join(__dirname,'../dist/SYNK_영상제작_발주서.html');
  // dist는 build.cjs가 만드는 산출물이라 깨끗한 체크아웃(CI)에는 없다. CI에서는 이 시험만 건너뛴다(tests/_git밖.js).
  const 없음=CI에없는로컬자료(path.relative(루트,file).split(path.sep).join('/'),'발주서 dist는 build.cjs 산출물');
  if(없음)return t.skip(없음);
  const original=fs.readFileSync(file,'utf8'),source=getScript(original);
  const online=htmlServiceClientHtml(original),bootstrap=getScript(online);
  assert.equal(decode(bootstrap),source);
  assert(Buffer.from(decode(bootstrap),'utf8').equals(Buffer.from(source,'utf8')));
  assert(source.includes("text('productUrl','브랜드나 제품을 볼 수 있는 링크','https://')+"));
  assert.doesNotMatch(bootstrap,/text\('productUrl'|SynkBriefCore|\/\/|`|\beval\s*\(|new\s+Function\s*\(/);
  assert.doesNotThrow(()=>new vm.Script(bootstrap));
  assert.doesNotThrow(()=>new vm.Script(decode(bootstrap)));
  assert.equal(online.replace(/<script\s[^>]*>[\s\S]*?<\/script>/i,'SCRIPT'),original.replace(/<script>[\s\S]*?<\/script>/i,'SCRIPT'));
  assert.equal(fs.readFileSync(file,'utf8'),original,'building online HTML must not modify the offline artifact');
});

test('the bootstrap executes decoded Korean, emoji, URLs and nested templates in source order',()=>{
  const source='window.result={name:"제품 🧵",url:"https://example.com/a?q=1",nested:`밖 ${`안 ${"값"}`}`,invite:window.SYNK_INTAKE.invite};';
  const html=htmlServiceClientHtml('<html><body><script>'+source+'</script></body></html>');
  const inserted=[],anchor={};
  const context=vm.createContext({Uint8Array,TextDecoder,atob:value=>Buffer.from(value,'base64').toString('binary'),SYNK_INTAKE:{invite:'existing-configuration'}});
  context.window=context;
  anchor.parentNode={insertBefore(script,before){assert.equal(before,anchor);inserted.push(script.textContent);vm.runInContext(script.textContent,context);}};
  context.document={currentScript:anchor,createElement(tag){assert.equal(tag,'script');return {textContent:''};}};
  vm.runInContext(getScript(html),context);
  assert.deepEqual(inserted,[source]);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)),{name:'제품 🧵',url:'https://example.com/a?q=1',nested:'밖 안 값',invite:'existing-configuration'});
});

test('comment stripping cannot truncate URL literals inside the protected payload',()=>{
  const source='window.value=`outer ${"nested"}`;\nwindow.url="https://example.com";\n';
  const bootstrap=getScript(htmlServiceClientHtml('<script>'+source+'</script>'));
  const stripped=bootstrap.replace(/\/\/[^\r\n]*/g,'');
  assert.equal(stripped,bootstrap);
  assert.equal(decode(stripped),source);
  assert.doesNotThrow(()=>new vm.Script(stripped));
});

test('build rejects missing, duplicate or already broken inline client scripts',()=>{
  assert.throws(()=>htmlServiceClientHtml('<html></html>'),/Expected one inline client script/);
  assert.throws(()=>htmlServiceClientHtml('<script>1</script><script>2</script>'),/Expected one inline client script/);
  assert.throws(()=>htmlServiceClientHtml('<script>window.url="https:\n</script>'),/Invalid or unexpected token/);
});
