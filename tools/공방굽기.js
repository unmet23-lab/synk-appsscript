#!/usr/bin/env node
/**
 * 공방굽기 — `docs/공방/계획.json` 의 «아직»인 것을 묶음 단위로 굽는다 (2026-09-05).
 *
 * 왜 있나 (유호 판정 09-05):
 *   시험 굽기 여섯을 보시고 처음엔 「명품화 느낌이 아니다」 하셨다가, 블렌더 판과 나란히
 *   놓고 다시 보신 뒤 「제미나이로 한번 해보자 · 내가 잘못 판단한 것 같아 · 확실히
 *   어딘가에는 쓰일 것 같아」로 뒤집으셨다. 그래서 나머지 23장을 굽는 통로가 필요해졌다.
 *
 * 🔑 **지시문은 계획.json 이 들고, 이 도구는 «공통 규격»만 든다.** 계획이 늘어도 이 파일을
 *   안 고친다(`공방지면.js` 와 같은 규율). 계획의 `지시` 는 «물건 설명» 한 문장이고,
 *   촬영 규격(정면 부감·확산광·흰 바닥·섬유 해상)은 아래 `공통` 이 붙인다.
 *
 * ⚠ 돈이 든다 — 2K 한 장 ≈ 190원 · 4K ≈ 336원. `배치게이트` 가 굽기 «전»에 총액을 찍는다.
 * ⚠ 분당 한도(429)가 있다 — 09-05 실측으로 넷째 장부터 걸렸다. 그래서 장 사이에 40초를 둔다.
 * ⚠ 흰 배경이 붙어 나온다 — 굽고 나서 `python tools/흰배경걷기.py <파일>` 로 걷는다.
 *   (이 도구가 자동으로 부르지 않는다: 원본을 남겨 두어야 다른 임계로 다시 걷을 수 있다.)
 *
 * 사용:
 *   node tools/공방굽기.js --묶음 "손 도구"            # 그 묶음의 «아직»을 전부
 *   node tools/공방굽기.js --묶음 "손 도구" --것 가위    # 그중 하나만
 *   node tools/공방굽기.js --묶음 "손 도구" --크기 4K
 *   node tools/공방굽기.js --목록                       # 무엇이 남았나만 본다(0원)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 루트 = path.resolve(__dirname, '..');
const 계획경로 = path.join(루트, 'docs/공방/계획.json');
const 저장방 = path.join(루트, 'docs/Loom_자산/구움');

/* 촬영 규격 — 시험 굽기 여섯이 통과한 그 규격 그대로다(유호 판정 09-05).
 * 바꾸면 이미 구운 것과 결이 갈리므로, 고칠 때는 «전량 재굽기»를 각오하고 고친다. */
const 공통 =
  'Macro product photograph of a single handmade object, shot straight down from directly above. ' +
  'Studio lighting: broad soft diffused light with one gentle key from the upper left, ' +
  'a soft contact shadow directly beneath the object, nothing else in frame. ' +
  'Isolated on a plain seamless pure white surface. The object sits exactly in the centre ' +
  'with generous empty margin on all four sides. ' +
  'Every wool fibre is resolved — you can count the strands and see how the nap catches light. ' +
  'No text, no watermark, no props, no hands, no background pattern. ' +
  'Tack sharp, medium format macro, photorealistic craft object.';

const 인자 = (() => {
  const a = {}; const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) {
    if (!v[i].startsWith('--')) continue;
    const k = v[i].slice(2);
    a[k] = (v[i + 1] && !v[i + 1].startsWith('--')) ? v[++i] : true;
  }
  return a;
})();

const 계획 = JSON.parse(fs.readFileSync(계획경로, 'utf8'));

/** 계획을 훑어 굽을 것을 고른다. 지시가 없는 것은 «아직 문장을 안 쓴 것»이라 건너뛴다. */
function 고른다() {
  const 담을것 = [];
  for (const [통로, 묶음들] of Object.entries(계획)) {
    if (통로.startsWith('_') || !묶음들.묶음) continue;
    for (const 묶 of 묶음들.묶음) {
      if (인자.묶음 && 묶.이름 !== 인자.묶음) continue;
      for (const 것 of 묶.것들 || []) {
        if (것.상태 !== '아직') continue;
        if (인자.것 && !String(인자.것).split(',').some((s) => 것.이름.includes(s.trim()))) continue;
        담을것.push({ 통로, 묶음: 묶, 것, 지시있나: !!것.지시 });
      }
    }
  }
  return 담을것;
}

/** 계획.json 의 그 줄만 고쳐 쓴다 — 굽고 나서 상태를 옮기는 자리. */
function 상태옮김(묶, 것, 파일) {
  것.상태 = '구웠다';
  것.파일 = 파일;
  const 센다 = (묶.것들 || []).filter((x) => x.상태 === '구웠다').length;
  묶.상태 = `${센다}/${(묶.것들 || []).length}`;
  fs.writeFileSync(계획경로, JSON.stringify(계획, null, 2) + '\n', 'utf8');
}

(async () => {
  const 고름 = 고른다();
  const 굽을것 = 고름.filter((x) => x.지시있나);
  const 문장없음 = 고름.filter((x) => !x.지시있나);

  if (인자.목록 || 굽을것.length === 0) {
    console.log(`■ 아직인 것 ${고름.length}개 — 지시문 있음 ${굽을것.length} · 없음 ${문장없음.length}`);
    for (const x of 고름) console.log(`   ${x.지시있나 ? '·' : '✎'} [${x.묶음.이름}] ${x.것.이름}`);
    if (문장없음.length) console.log('   ✎ = 지시문을 아직 안 썼다 — 계획.json 의 그 항목에 `지시`·`쇠` 를 넣는다.');
    if (인자.목록) return;
    if (굽을것.length === 0) { console.log('🚫 구울 것이 없다(0원).'); return; }
  }

  const 크기 = String(인자.크기 || '2K');
  const 굽기 = require('./lib/이미지굽기.js');
  const ok = await 굽기.배치게이트(굽을것.length, 크기);
  if (!ok) { console.log('🚫 게이트가 막았다 — 한 장도 안 구웠다.'); process.exit(1); }

  let 성공 = 0; let 실패 = 0;
  for (let i = 0; i < 굽을것.length; i++) {
    const { 묶음, 것 } = 굽을것[i];
    const 쇠 = 것.쇠 || ('공방_' + 것.이름.replace(/\s+/g, ''));
    const 저장 = path.join(저장방, 쇠 + '.png');
    process.stdout.write(`■ ${i + 1}/${굽을것.length} ${것.이름} … `);
    try {
      await 굽기.한컷({
        이름: 것.이름,
        지시: 것.지시 + ' ' + 공통,
        비율: 것.비율 || '1:1',
        크기,
        저장경로: 저장,
      });
      상태옮김(묶음, 것, 쇠 + '.png');
      console.log('✅', path.basename(저장));
      성공++;
    } catch (e) {
      console.log('🔴', String(e.message).slice(0, 140));
      실패++;
      if (e.돈벽) { console.log('   돈 벽이 섰다 — 남은 장은 안 던진다.'); break; }
    }
    /* 분당 한도 회피 — 마지막 장 뒤에는 안 쉰다. */
    if (i < 굽을것.length - 1) await new Promise((r) => setTimeout(r, 40000));
  }
  console.log(`■ 합계 ${성공 + 실패}장 = 성공 ${성공} + 실패 ${실패}`);
  if (성공) console.log(`   다음: python tools/흰배경걷기.py "${저장방}/공방_*.png" · node tools/공방지면.js`);
})();
