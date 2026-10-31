// 드라마 말하기 talk 사본(2026-10-31) — tools/build-world-speaking-talk.mjs가 SYNK-talk world-speaking에 싣는 두 생성물.
// 판정 사본이 정본(tools/lib/드라마판정.mjs)과 같은 답을 내는지, 대사 은행이 대본 그대로인지, 옮기지 못하는 꼴에서 멈추는지 본다.
// SYNK_TALK_ROOT를 주면 그 talk 작업본의 사본이 지금 원본에서 만든 것과 바이트까지 같은지도 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {judgeModule,dramaLines,readEpisodes,linesModule,linesHash,answerSecOf,TALK_FILES,JUDGE_FILE} from '../tools/build-world-speaking-talk.mjs';
import * as judge from '../tools/lib/드라마판정.mjs';
import {syllables} from '../tools/lib/말하기피드백.mjs';

// 생성된 CommonJS를 정본 피드백 핵심의 syllables로 불러 본다(talk에서는 world-speaking-feedback.js 사본이 준다).
const load=source=>{
 const module={exports:{}};
 vm.runInNewContext(source,{module,exports:module.exports,require:name=>{assert.equal(name,'./world-speaking-feedback.js');return {syllables};}},{filename:'world-drama-judge.js'});
 return module.exports;
};

test('판정 사본: CommonJS로 옮겨 정본의 이름을 모두 내보내고, 같은 글에 정본과 같은 판정을 낸다', async()=>{
 const source=judgeModule();
 assert.doesNotMatch(source,/^\s*(import|export)\b/m);
 const copy=load(source);
 assert.deepEqual(Object.keys(copy).sort(),Object.keys(judge).sort());
 const lines=dramaLines(await readEpisodes());
 const heard=['아직 낯설지만 조금씩 익숙해지고 있어.','안녕하세요.','네, 선배님! 그런데 혹시 화장실이 어디에 있는지 아세요?','','I am a new student'];
 // vm 안에서 만든 객체는 원형이 달라 JSON으로 견준다.
 const plain=value=>JSON.parse(JSON.stringify(value));
 for(const line of lines)for(const transcript of [line.line,...heard])
  assert.deepEqual(plain(copy.judgeLine(line.spec,{transcript,seconds:6})),plain(judge.judgeLine(line.spec,{transcript,seconds:6})),`${line.id} ${transcript}`);
 assert.deepEqual(plain(copy.nextTake({result:copy.judgeLine(lines[0].spec,{transcript:'',seconds:3}),attempt:0,unheard:3})),plain(judge.nextTake({result:judge.judgeLine(lines[0].spec,{transcript:'',seconds:3}),attempt:0,unheard:3})));
});

test('판정 사본은 옮길 수 없는 꼴에서 멈춘다 — 다른 import, 이름 없는 export', ()=>{
 const text=fs.readFileSync(JUDGE_FILE,'utf8');
 assert.throws(()=>judgeModule(`import {x} from './다른.mjs';\n${text}`),/syllables 하나만/);
 assert.throws(()=>judgeModule(`${text}\nexport default 1;\n`),/옮기지 못하는/);
});

test('대사 은행: 대본의 학생 줄 9(scene) + 처음 보는 대사 8(unseen), 판정 명세는 대본 그대로 · 모두 검수 전(draft) · 녹음 상한 8~30초', async()=>{
 const lines=dramaLines(await readEpisodes());
 assert.deepEqual([lines.filter(l=>l.kind==='scene').length,lines.filter(l=>l.kind==='unseen').length],[9,8]);
 for(const line of lines){
  assert.deepEqual(judge.checkSpec(line.spec),[],line.id);
  assert.equal(line.review.status,'draft',line.id);
  assert.equal(line.answerSec,answerSecOf(line.line));
  assert.ok(line.answerSec>=8&&line.answerSec<=30,line.id);
 }
 assert.equal(answerSecOf('네'),8);assert.equal(answerSecOf('가'.repeat(80)),30);
 assert.match(linesHash(lines),/^[0-9a-f]{16}$/);
 assert.match(linesModule(lines),new RegExp(`LINES_HASH = "${linesHash(lines)}"`));
});

test('칸 명세를 통과하지 못하는 대사가 하나라도 있으면 사본을 만들지 않는다(조용히 빼지 않는다)', async()=>{
 const [ep]=await readEpisodes();
 const broken={...ep,처음보는대사:[...ep.처음보는대사,{id:'s1e01-bad',말:'괜찮아요.',명세:{to:'staff',keys:[{word:'없는 말'}]}}]};
 assert.throws(()=>dramaLines([broken]),/s1e01-bad 칸 명세 문제/);
 assert.throws(()=>dramaLines([ep,ep]),/겹친다/);
});

test('talk 작업본을 주면(SYNK_TALK_ROOT) 드라마 두 사본이 지금 원본에서 만든 것과 바이트까지 같다', async()=>{
 const talk=process.env.SYNK_TALK_ROOT;
 if(!talk)return;
 const want={[TALK_FILES.judge]:judgeModule(),[TALK_FILES.lines]:linesModule(dramaLines(await readEpisodes()))};
 for(const [rel,content] of Object.entries(want))assert.equal(fs.readFileSync(path.join(talk,rel),'utf8').replace(/\r\n/g,'\n'),content,`${rel} — node tools/build-world-speaking-talk.mjs --talk ${talk}`);
});
