/* 엔진 이름 — 회사명 결합이 «지면»에 실제로 닿았는가 (유호 지시 2026-08-18).
 *
 * 왜 있나 (실측):
 *   규약은 새것이 아니었다 — `docs/엔진/SYNK_엔진_지도.html` v2.1(08-15)이 이미
 *   「대외 표기는 SYNK Trail 꼴 회사명 결합」이라 적어 두었다. 그런데 3일 뒤 유호님이
 *   직접 「우리 엔진 폴더에 모든 엔진 이름 앞에 synk 붙이자」고 말할 때까지 **지면엔 안 닿아
 *   있었다**: 소개서 6벌 중 회사명이 붙은 것은 2벌(Core·Vellum), 파일 이름은 6 중 1벌뿐.
 *   규약이 문서 «안»에만 살아 있고 그것을 지면에 물리는 기계가 0이면, 안 도는 것과 같다.
 *
 * 무엇을 재나 — **이름 칸만** 좁게 잰다:
 *   ①소개서의 `<title>` ②`<h1>` ③레일 꼭지 ④파일 이름(원고·산출 둘 다).
 *   ④가 급소다 — 유호님이 실제로 보는 것은 바탕화면 바로가기의 **파일 이름**이다.
 *
 * 🚫 본문 산문은 기계로 재지 않는다. 어원·몽골어 대사전 실측·점유 grep·탈락 이력은
 *   재는 대상이 «낱말»이라 맨몸이 맞고(지도 「작명 규약」의 접두 안 다는 셋 ③),
 *   그것까지 잡으면 따를 수 없는 처방이 되어 우회가 정상 통로가 된다(F103).
 *
 * 대가 — 틀릴 때의 모습:
 *   이름 칸만 보므로 **본문이 통째로 옛 이름이어도 초록**이다. 그 층은 사람이 본다.
 *   여기서 닫는 것은 「제목·파일명이 조용히 옛 이름으로 되돌아가는 것」 하나다.
 *   그리고 탐지력은 픽스처가 지고, 실저장소에는 **거짓양성만** 검사한다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const 루트 = path.join(__dirname, '..');
const 산출방 = path.join(루트, 'docs', '엔진');
const 원고방 = path.join(산출방, '_원고');

/** 소개서 한 벌의 이름 칸 흠. 순수 함수 — 픽스처와 실저장소가 **같은 자**를 쓴다. */
function 이름칸흠(이름, 원문) {
  const 흠 = [];
  if (!/^SYNK_/.test(이름)) 흠.push(`파일 이름이 SYNK_ 접두가 아니다: ${이름}`);
  const 칸 = [
    ['title', (원문.match(/<title>([^<]*)<\/title>/) || [])[1]],
    ['h1', (원문.match(/<h1>([^<]*)<\/h1>/) || [])[1]],
    ['레일 꼭지', (원문.match(/<p class="꼭지">([^<]*)<\/p>/) || [])[1]],
  ];
  for (const [자리, 값] of 칸) {
    if (값 === undefined) continue;              // 지도엔 꼭지가 없다 — 없는 칸은 안 센다
    if (!/^SYNK[ _]/.test(값.trim())) 흠.push(`${자리}에 회사명이 없다: 「${값.trim()}」`);
  }
  return 흠;
}

/** 그 방의 소개서·지도 전량(분모). 0벌이면 그 자체가 실패다 — 0 은 통과와 같은 모양이다. */
function 지면들(방) {
  return fs.readdirSync(방).filter((f) => f.endsWith('.html')).sort();
}

test('픽스처 — 맨몸 이름을 잡는다(탐지력)', () => {
  const 맨몸 = '<title>Loom 소개서 — 그래픽 엔진</title>\n<p class="꼭지">Loom</p>\n<h1>Loom</h1>';
  const 흠 = 이름칸흠('Loom_소개서.html', 맨몸);
  assert.strictEqual(흠.length, 4, `잡은 흠 ${흠.length}건 — 파일명·title·h1·꼭지 넷이 다 잡혀야 한다: ${흠.join(' / ')}`);
});

test('픽스처 — 회사명이 붙은 것은 안 잡는다(거짓양성 0)', () => {
  const 결합 = '<title>SYNK Loom 소개서 — 그래픽 엔진</title>\n<p class="꼭지">SYNK Loom</p>\n<h1>SYNK Loom</h1>';
  assert.deepStrictEqual(이름칸흠('SYNK_Loom_소개서.html', 결합), []);
});

test('픽스처 — 「SYNKLoom」처럼 붙여 쓴 것은 결합이 아니다', () => {
  const 흠 = 이름칸흠('SYNK_Loom_소개서.html', '<h1>SYNKLoom</h1>');
  assert.strictEqual(흠.length, 1, `붙여 쓴 표기를 통과시켰다 — ${JSON.stringify(흠)}`);
});

test('실저장소 — 엔진 갈래 지면 전량이 이름 칸에 회사명을 달고 있다', () => {
  const 지면 = 지면들(산출방);
  assert.ok(지면.length >= 8, `엔진 갈래 지면 ${지면.length}벌 — 소개서 7 + 지도 1 아래로 떨어졌다(분모를 먼저 본다)`);
  const 흠 = 지면.flatMap((f) => 이름칸흠(f, fs.readFileSync(path.join(산출방, f), 'utf8')).map((h) => `${f}: ${h}`));
  assert.deepStrictEqual(흠, [], `${지면.length}벌 중 ${흠.length}건 — 규약 = SYNK_엔진_지도.html 「작명 규약」(유호 지시 08-18)`);
});

test('실저장소 — 원고 전량도 같은 이름을 쓴다(원고가 정본이라 여기서 갈리면 다음 굽기가 되돌린다)', () => {
  const 원고 = 지면들(원고방);
  assert.strictEqual(원고.length, 7, `원고 ${원고.length}벌 — 소개서 7벌이 분모다(Reed 편입 09-01)`);
  const 흠 = 원고.flatMap((f) => 이름칸흠(f, fs.readFileSync(path.join(원고방, f), 'utf8')).map((h) => `${f}: ${h}`));
  assert.deepStrictEqual(흠, [], `원고 ${원고.length}벌 중 ${흠.length}건`);
});
