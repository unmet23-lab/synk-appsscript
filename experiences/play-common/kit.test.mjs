// SYNK LAB PLAY 키트: 게임마다 둔 사본이 원본과 바이트까지 같은지, 키트 CSS가 부르는 그림·글꼴이 키트 안에 있는지.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { KIT_SRC, KIT_GAMES, JOSA_ONLY_GAMES, JOSA_FILE, kitFiles } from './build-kit.mjs';
import { josa, finalOf } from './kit/josa.mjs';

test('키트 CSS가 부르는 파일이 모두 키트 안에 있다', () => {
  const css = fs.readFileSync(path.join(KIT_SRC, 'lab.css'), 'utf8');
  const refs = [...css.matchAll(/url\((?!["']?data:)["']?([^)"']+)["']?\)/g)].map((m) => m[1]);
  assert.ok(refs.length > 10);
  for (const r of refs) assert.ok(fs.existsSync(path.join(KIT_SRC, r)), r);
});

for (const game of KIT_GAMES) {
  test(`${game}/kit 사본이 원본과 같다(node experiences/play-common/build-kit.mjs)`, () => {
    const dst = path.join(KIT_SRC, '..', '..', game, 'kit');
    assert.deepEqual(kitFiles(dst), kitFiles());
    for (const rel of kitFiles()) assert.ok(fs.readFileSync(path.join(dst, rel)).equals(fs.readFileSync(path.join(KIT_SRC, rel))), rel);
  });
}
for (const game of JOSA_ONLY_GAMES) {
  test(`${game}/kit에는 받침 조사 사본 한 파일만 있고 원본과 같다`, () => {
    const dst = path.join(KIT_SRC, '..', '..', game, 'kit');
    assert.deepEqual(kitFiles(dst), [JOSA_FILE]);
    assert.ok(fs.readFileSync(path.join(dst, JOSA_FILE)).equals(fs.readFileSync(path.join(KIT_SRC, JOSA_FILE))));
  });
}

test('받침 조사: 한글 음절은 받침을, ‘으로/로’는 ㄹ 받침도 ‘로’를 쓴다', () => {
  for (const [word, a, b, want] of [['병원', '이에요', '예요', '이에요'], ['우유', '이에요', '예요', '예요'], ['코랄', '을', '를', '을'], ['민트', '을', '를', '를'],
    ['해안선', '을', '를', '을'], ['네 시', '을', '를', '를'], ['목', '으로', '로', '으로'], ['화', '으로', '로', '로'], ['물', '으로', '로', '로'], ['라켓', '으로', '로', '으로'],
    ['공', '으로', '로', '으로'], ['연필', '으로서', '로서', '로서'], ['빈칸', '으로', '로', '으로'], ['갑', '은', '는', '은'], ['무', '은', '는', '는']]) assert.equal(josa(word, a, b), want, word + a);
});
test('받침 조사: 낱자는 이름(기역·리을·아)으로, 숫자는 한국어 소리로 읽는다', () => {
  for (const [word, a, b, want] of [['ㄱ', '은', '는', '은'], ['ㅍ', '은', '는', '은'], ['ㄹ', '으로', '로', '로'], ['ㅂ', '으로', '로', '으로'], ['ㅏ', '은', '는', '는'], ['ㅢ', '이', '가', '가'],
    ['1', '이에요', '예요', '이에요'], ['2', '이에요', '예요', '예요'], ['3', '을', '를', '을'], ['7', '으로', '로', '로'], ['10', '으로', '로', '으로'], ['4번', '이', '가', '이']]) assert.equal(josa(word, a, b), want, word + a);
});
test('받침 조사: 끝의 문장부호·따옴표·로마자는 건너뛰고, 읽을 글자가 없으면 받침 없음', () => {
  assert.equal(josa('무엇을 먹어요?', '을', '를'), '를');
  assert.equal(josa('“병원”', '이에요', '예요'), '이에요');
  assert.equal(josa('코스트 GT', '을', '를'), '를');
  assert.equal(josa('Epic Games Launcher', '을', '를'), '를');
  assert.equal(josa('', '이', '가'), '가');
  assert.equal(josa(null, '이', '가'), '가');
  assert.equal(finalOf('산'), 4); assert.equal(finalOf('물'), 8); assert.equal(finalOf('나'), 0);
});
