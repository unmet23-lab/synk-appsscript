// 계정 포털 첫 화면의 「한국어 공부」 입구(README §1). node --test experiences/korean-study/qa/portal.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync(new URL('../../synk-account/src/platform.mjs',import.meta.url),'utf8');
const dist=fs.readFileSync(new URL('../../synk-account/dist/platform.js',import.meta.url),'utf8');
const lib=fs.readFileSync(new URL('../../synk-account/src/platform-library-data.mjs',import.meta.url),'utf8');
test('포털 첫 화면: 한국어 공부 칸이 환영 칸 바로 다음, 계정·최근·즐겨찾기·WORLD 줄보다 먼저', ()=>{
 const home=src.slice(src.indexOf('function homePage()'));
 assert.ok(home.includes('</section>`+studyEntry()+accountPanel()+recentSection()'));
 assert.ok(home.indexOf('studyEntry()')<home.indexOf("['world','path','care']"));
});
test('링크는 synk.im/study/ 절대 주소 하나, 계정 문서 계약(앱 ID 목록)은 그대로', ()=>{
 assert.match(src,/const STUDY_URL='https:\/\/synk\.im\/study\/';/);
 assert.ok(dist.includes('https://synk.im/study/'),'묶음을 다시 만들었는가(check-account-bundles --build)');
 assert.ok(!/'study'/.test(lib));
});
