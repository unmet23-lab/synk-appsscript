#!/usr/bin/env node
/**
 * 4D 깊이 격자 — 릴이 쓸 몫을 굽는다.
 *
 * 🔑 **수식은 여기 없다.** `tools/lib/깊이격자.js` 가 유일한 주인이다(09-02 에 올렸다).
 *   까닭: 같은 z 를 이제 셋이 쓴다 — 판정 지면(브라우저)·릴(여기)·**앱**(talk `contents/깊이.json`).
 *   수식이 둘이면 학생 손의 앱과 릴이 다른 각도로 고개를 돌리고, 그건 아무도 못 잰다.
 *   ⇒ 이 파일은 «어느 그림을 어디에 놓나»만 진다.
 *
 * 🔑 왜 «미리» 뽑나: 깊이는 그림이 안 바뀌면 안 바뀐다. 900프레임마다 256×256 픽셀을 다시 읽는 것은
 *   낭비이고, 무엇보다 Remotion 렌더는 프레임마다 브라우저를 새로 그린다 — 매번 다시 재게 된다.
 *   격자(29×29)는 3KB 남짓이라 통째로 실어도 가볍다.
 *
 * 🔴 산출물은 `public/깊이/` 로 간다 = git 밖이다. 그림이 바뀌면 다시 뽑으면 되므로
 *   「없는 것은 낡을 수 없다」 쪽이다(자산모으기가 굽기마다 부른다).
 *
 * 쓰기: node 영상/깊이뽑기.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 방 = __dirname;
const { 기본N: N, 뽑기 } = require(path.join(방, '..', 'tools', 'lib', '깊이격자.js'));

const 나갈방 = path.join(방, 'public', '깊이');
fs.mkdirSync(나갈방, { recursive: true });

const 결과 = [];
for (const 가이드 of ['몽글', '까몽']) {
  const 원 = path.join(방, 'public', 가이드, '본체.png');
  if (!fs.existsSync(원)) {
    console.error(`🔴 ${원} 이 없다 — 먼저 node 영상/자산모으기.js`);
    process.exit(1);
  }
  /* z 가 전부 0 이면 뽑기() 가 그 자리에서 던진다(08-26 에 실제로 죽어 있던 층이다). */
  const { z, 몸색, 통계 } = 뽑기(원);
  fs.writeFileSync(path.join(나갈방, `${가이드}.json`), JSON.stringify({ N, z }), 'utf8');
  결과.push({ 가이드, ...통계, 몸색 });
}

console.log(`4D 깊이 격자 — ${N + 1}×${N + 1} 칸`);
for (const r of 결과) {
  console.log(
    `  ${r.가이드}  z 최대 ${r.최대.toFixed(2)} · 몸 안 평균 ${r.평균.toFixed(2)}`
    + ` · 몸이 있는 칸 ${r.산것}/${r.칸} · 몸색 rgb(${r.몸색.join(',')})`,
  );
}
