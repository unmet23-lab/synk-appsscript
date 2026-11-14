// 계정 포털 첫 화면에 「한국어 공부」 칸이 없다(README §1). node --test experiences/korean-study/qa/portal.test.mjs
// 2026-11-14 유호님 「이대로 절대 공개하면 안될것같아」 → 「오늘 내리기」: synk.im/study를 계정 홈으로 넘기고 포털 칸을 뺐다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../../synk-account/src/platform.mjs',import.meta.url),'utf8');
const dist=fs.readFileSync(new URL('../../synk-account/dist/platform.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../synk-account/platform.css',import.meta.url),'utf8');
const lib=fs.readFileSync(new URL('../../synk-account/src/platform-library-data.mjs',import.meta.url),'utf8');
test('포털 첫 화면: 한국어 공부 칸을 그리지 않는다 — 환영 칸 다음은 바로 계정 칸', ()=>{
 const home=src.slice(src.indexOf('function homePage()'));
 assert.ok(home.includes('</section>`+accountPanel()'));
 assert.ok(!/studyEntry|STUDY_URL|data-study-entry/.test(src));
 assert.ok(!/\.study-entry/.test(css));
});
test('묶음에도 synk.im/study/ 링크가 없고, 계정 문서 계약(앱 ID 목록)은 그대로', ()=>{
 assert.ok(!dist.includes('synk.im/study/')&&!dist.includes('data-study-entry'),'묶음을 다시 만들었는가(check-account-bundles --build)');
 assert.ok(!/'study'/.test(lib));
});
