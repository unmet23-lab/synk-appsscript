#!/usr/bin/env node
'use strict';
/**
 * 시험지 실행기 — **던지기 «전»에 재는 게이트**를 세운 한 통로 (2026-09-03 · 유호 지시 「대책이 필요해」).
 *
 * ■ 왜 있나 — 09-03 에 실물로 64분을 벽에 던졌다
 *   3.7 대 3.8 을 재려고 promptfoo 를 두 번 돌렸는데, 공짜 몫이 이미 바닥이라 **28칸 중 답이 2칸**이었다.
 *   나쁜 것은 「몫이 없었다」가 아니라 **「없는 줄 모르고 28발을 던졌다」**이다. 재는 도구
 *   (`모델정책.제미나이생존()`)는 그 전부터 있었는데 **실행 통로에 세워져 있지 않았다** —
 *   손 명령이 promptfoo 를 곧장 불렀기 때문이다. 이 파일이 그 자리다.
 *
 * ■ 날린 것의 정체 = **재시도**
 *   promptfoo 는 429 를 만나면 칸마다 4~5번 다시 던진다. 몫이 바닥인 상태에서 그 재시도는
 *   **100% 낭비이고, 오히려 남은 몫을 먹는다.** 09-03 실측: 하루 몫 20발이 «두 칸» 만에 사라졌다.
 *   그래서 여기서는 ①시작 «전»에 한 발로 재고 ②도중에 몫 벽이 나오면 **즉시 통째로 멈춘다.**
 *
 * ■ 게이트 셋 (호출 수를 괄호에 적는다 — 게이트가 몫을 먹으면 안 된다)
 *   ① 정본 대조   (0발) — YAML 의 모델·사고 수준이 `tools/모델정책.js` 와 같은가
 *   ② 몫 프로브   (1발) — 지금 던져도 되나. 죽었으면 **시작조차 안 한다** + 언제 다시 되는지 말한다
 *   ③ 발 수 셈    (0발) — 이 시험에 몇 발이 드는가 · 상한을 넘으면 «돌리기 전에» 말한다
 *
 * ■ 쓰기
 *   node evals/돌리기.js                     게이트 셋 뒤 시험 실행
 *   node evals/돌리기.js --재보기            몫 프로브만 (시험은 안 돌린다 · 1발)
 *   node evals/돌리기.js --문항 4            앞에서 N 문항만 (몫이 적은 날 나눠 돌리기)
 *   node evals/돌리기.js --그냥              게이트를 무시하고 강행(몫을 알고도 태울 때만)
 *   node evals/돌리기.js --예약              예약 작업이 부르는 꼴 (아래)
 *   node evals/돌리기.js --알림              결과가 나왔으면 한 번만 알린다 (0발 · 세션 첫머리 훅이 부른다)
 *   종료 0=시험 끝 · 3=게이트가 막음(«실패»가 아니라 «안 던졌다») · 2=시험이 도중에 죽음
 *
 * ■ `--예약` — 스스로 조용해지는 되풀이 (2026-09-03 · 유호 지시 「자동으로 되게」)
 *   예약 작업 `SYNK_검문시험` 이 **매일** 부른다. 매일 도는데도 몫을 안 태우는 까닭:
 *     · **도장이 있으면 0발로 끝난다.** 도장 = `_결과/도장_<모델>.json` — «어느 모델을 언제 쟀나».
 *       한 번 재고 나면 그 뒤로는 네트워크를 아예 안 탄다.
 *     · **모델 이름이 도장에 박힌다.** 그래서 다음에 픽을 갈아타면(3.9 …) 도장이 안 맞아
 *       **스스로 다시 잰다** — 「갈아탔는데 안 재봤다」가 다시 생기지 않는다.
 *     · 몫이 아직 안 찼으면 게이트가 0발로 세우고, **다음 날 같은 시각에 또 시도한다.**
 *   🔑 왜 「매일」인가 — 「내일 오후 한 번」으로 걸면 그날 몫이 모자랐을 때 그걸로 끝이고,
 *      다시 거는 것은 사람 몫이 된다. 09-03 에 배운 것이 정확히 그 자리다(보류를 깨우는 것이 없었다).
 *
 * 🔑 이 파일은 **모델 이름도 사고 수준도 안 적는다** — 정본은 `tools/모델정책.js` 하나다.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const 여기 = __dirname;
const 루트 = path.join(여기, '..');
const YAML = path.join(여기, '몽골어검문.yaml');
const 정책 = require(path.join(루트, 'tools', '모델정책.js'));

/* promptfoo 판을 박는다 — `의심줄.js` 가 0.122.x 결과 모양을 전제한다(README 머리말). */
const PROMPTFOO = 'promptfoo@0.122.2';

/* 🔴 무료 등급 상한 — 09-03 실측(429 원문 `limit: 20`).
 * ⚠ **창의 길이는 안 재봤다.** 「분당」은 **아니다** — 1분에 1~3발만 던지며 38분을 기다려도
 *   계속 429였다. 하루치일 가능성이 가장 크지만 구글 응답이 그걸 말해 주지 않는다.
 *   그래서 이 수는 «넘으면 경고»에만 쓰고, 진짜 판정은 언제나 ②프로브(실물 1발)가 한다. */
const 무료몫상한 = 20;

const 인자 = process.argv.slice(2);
const 있나 = (f) => 인자.includes(f);
const 값 = (f) => { const i = 인자.indexOf(f); return i < 0 ? null : 인자[i + 1]; };

/* ── ① 정본 대조 (0발) ─────────────────────────────────────────────
 * 검문자.js 가 이미 이 자를 쥐고 있다 — 여기서 다시 적지 않는다(두 곳이 알면 갈린다). */
function 정본대조() {
  const r = spawnSync(process.execPath, [path.join(여기, '검문자.js'), '--자체점검'], {
    cwd: 루트, encoding: 'utf8', windowsHide: true,
  });
  const 글 = `${r.stdout || ''}${r.stderr || ''}`;
  if (r.status !== 0) return { ok: false, 말: (글.trim().split('\n').pop() || '자체점검이 죽었다') };
  const 줄 = 글.split('\n').find((l) => l.includes('모델 정본')) || '';
  return { ok: true, 말: 줄.trim() || '정본과 같다' };
}

/* ── ③ 발 수 셈 (0발) ─────────────────────────────────────────────
 * YAML 을 파서 없이 «셈»만 한다 — 들여쓰기 0칸의 `tests:` 아래, 들여쓰기 2칸의 `- ` 만 센다. */
function 시험규모() {
  const 원문 = fs.readFileSync(YAML, 'utf8');
  const 줄들 = 원문.split(/\r?\n/);
  let 모델 = 0, 문항 = 0, 어디 = null;
  for (const l of 줄들) {
    if (/^providers:/.test(l)) { 어디 = 'p'; continue; }
    if (/^tests:/.test(l)) { 어디 = 't'; continue; }
    if (/^[a-zA-Z_]/.test(l)) { 어디 = null; continue; }
    if (어디 === 'p' && /^ {2}- /.test(l)) 모델 += 1;
    if (어디 === 't' && /^ {2}- /.test(l)) 문항 += 1;
  }
  return { 모델, 문항, 발: 모델 * 문항 };
}

const 초읽기 = (s) => (s == null ? '(안 알려줬다)' : s < 90 ? `${Math.round(s)}초 뒤` : `${Math.round(s / 60)}분 뒤`);

/* 도장 = 「이 모델은 이미 쟀다」. 모델 이름이 박혀 있어서 픽을 갈아타면 저절로 안 맞는다.
 * `_결과/` 는 커밋하지 않는다(evals/.gitignore — 결과에 몽골어 본문과 모델 답이 그대로 들어가는데
 * 이 저장소는 PUBLIC 이다). 그래서 도장은 **이 기계에만** 산다. */
const 도장경로 = (model) => path.join(여기, '_결과', `도장_${model}.json`);

/* 판정 = **숫자만**. 몽골어도 문항 이름도 안 담는다 — 그래서 커밋해도 되고, 그 덕에
 * «두 기계가 같은 시험을 두 번 돌리는 것»을 막는다(하루 몫은 하나뿐이다).
 * 남의 기계(GitHub Actions)가 먼저 재면 이 파일이 커밋돼 오고, 그러면 이 기계는 안 던진다. */
const 판정경로 = (model) => path.join(여기, '_판정', `${model}.json`);

/* 「알렸나」는 **이 기계의 사정**이라 커밋하지 않는다 — 도장으로 재든 판정으로 재든 한 번만 뜬다. */
const 알림표시경로 = (model) => path.join(여기, '_결과', `알렸다_${model}.txt`);

const 읽기 = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };

/* ── `--알림` (0발 · 네트워크 0) ─────────────────────────────────────
 * 예약은 사람이 없는 시각에 돈다. 그래서 **결과가 유호님을 찾아와야** 한다 — 세션 첫머리 훅이
 * 이걸 부른다. 규칙 둘:
 *   ① **결과가 있을 때만 말한다.** 아직 못 쟀으면 아무것도 안 찍는다(훅 열한 개 사이에서
 *      조용한 줄은 소음이 아니지만, 매번 「아직이다」를 짖으면 진짜 신호가 묻힌다).
 *   ② **한 번 말하면 조용해진다.** 도장에 「알렸나」를 적어 다음 세션부터는 입을 다문다.
 * 못 쟀다는 사실 자체는 트랙.md 가 쥔다 — 두 곳이 같은 것을 짖지 않는다. */
function 알림() {
  let 픽; try { 픽 = 정책.제미나이설정(); } catch { return 0; }
  if (fs.existsSync(알림표시경로(픽.model))) return 0;     // 이미 알렸다 — 조용
  const 도장 = 읽기(도장경로(픽.model));
  const 판정 = 읽기(판정경로(픽.model));
  if (!(도장 && 도장.끝났나) && !판정) return 0;            // 아직 안 쟀다 — 조용

  const 때 = (도장 && 도장.때) || (판정 && 판정.때);
  console.log(`📋 **몽골어 검문 시험 결과가 나왔다** — ${픽.model} / 생각 깊이 ${픽.thinking_level}`
    + ` · 잰 때 ${new Date(때).toLocaleString('ko-KR')}${판정 && 판정.어디서 ? ` · 잰 곳 ${판정.어디서}` : ''}`);

  /* 숫자는 «합계 = 갈래 + 갈래»로 — 못 잰 칸을 틀린 칸과 섞으면 0 의 뜻이 흐려진다. */
  if (판정 && 판정.점수) {
    for (const [라벨, s] of Object.entries(판정.점수)) {
      console.log(`   ${라벨}: 칸 ${s.맞음 + s.틀림 + s.못잼} = 맞음 ${s.맞음} + 틀림 ${s.틀림} + 못잼 ${s.못잼}`
        + (s.근거흠 ? ` (그중 근거가 떨어진 칸 ${s.근거흠})` : ''));
    }
  }

  /* 요약(의심 줄)은 «이 기계에서 잰 것»에만 있다 — 남의 기계는 몽골어를 안 내보낸다. */
  let 요약 = '';
  if (도장 && 도장.요약파일) { try { 요약 = fs.readFileSync(path.join(루트, 도장.요약파일), 'utf8').trim(); } catch { /* 없으면 없는 대로 */ } }
  if (요약) {
    console.log('   ─ 사람이 볼 줄(맞은 줄은 안 올라온다) ─');
    for (const l of 요약.split(/\r?\n/).slice(0, 40)) console.log(`   ${l}`);
  } else if (판정) {
    console.log(`   의심 줄은 여기 없다 — 남의 기계는 숫자만 내보낸다(몽골어 본문은 안 나간다).`);
    console.log(`   줄까지 보려면 이 기계에서 한 번 더: node evals/돌리기.js --그냥`);
  } else {
    console.log(`   요약 파일을 못 읽었다 — 「결함 0건」이 아니라 «확인 불가»다.`);
  }
  console.log(`   이 알림은 **한 번만** 뜬다.`);

  try {
    fs.mkdirSync(path.join(여기, '_결과'), { recursive: true });
    fs.writeFileSync(알림표시경로(픽.model), new Date().toISOString(), 'utf8');
  } catch { /* 못 적으면 한 번 더 뜬다 — 조용해지는 것보다 낫다 */ }
  return 0;
}

async function main() {
  if (있나('--알림')) return 알림();
  const 픽 = 정책.제미나이설정();
  const 예약 = 있나('--예약');
  console.log(`■ 몽골어 검문 시험지 — 게이트 셋을 지나야 던진다${예약 ? ' (예약 실행)' : ''}`);
  console.log(`  정본 픽: ${픽.model} / 생각 깊이 ${픽.thinking_level}`);
  console.log(`  때: ${new Date().toLocaleString('ko-KR')}\n`);

  /* 🔑 예약이 매일 도는데도 몫을 안 태우는 자리 — 이미 쟀으면 **여기서 끝난다**(호출 0).
   * 둘 중 «어느 쪽»이라도 있으면 잰 것이다: 도장(이 기계가 쟀다) · 판정(남의 기계가 재서 커밋해 왔다).
   * 하루 몫은 기계마다가 아니라 «열쇠마다» 하나라, 두 기계가 같은 시험을 두 번 돌리면 그냥 낭비다. */
  if (예약) {
    const 도장 = 읽기(도장경로(픽.model));
    const 판정 = 읽기(판정경로(픽.model));
    const 잰것 = (도장 && 도장.끝났나 && { 때: 도장.때, 곳: '이 기계' }) || (판정 && { 때: 판정.때, 곳: 판정.어디서 || '남의 기계' });
    if (잰것) {
      console.log(`⏭ 이미 쟀다 — ${픽.model} · ${잰것.때} · ${잰것.곳}. **한 발도 안 던진다.**`);
      console.log(`   다시 재려면 지운다: ${path.relative(루트, 도장경로(픽.model))} · ${path.relative(루트, 판정경로(픽.model))}`);
      return 0;
    }
  }

  // ① 정본 대조
  const a = 정본대조();
  console.log(`① 정본 대조 (0발)  ${a.ok ? '✅' : '🔴'} ${a.말}`);
  if (!a.ok) { console.error('\n🔴 시험지가 정본과 어긋난다 — 고치기 «전»에는 한 발도 안 던진다.'); return 3; }

  // ③ 발 수 셈 (프로브보다 먼저 — 0발짜리를 앞에 둔다)
  const 규모 = 시험규모();
  const 문항한도 = Number(값('--문항')) || null;
  const 실제문항 = 문항한도 ? Math.min(문항한도, 규모.문항) : 규모.문항;
  const 실제발 = 규모.모델 * 실제문항;
  console.log(`③ 발 수 셈 (0발)   문항 ${실제문항}개 × 모델 ${규모.모델}판 = **${실제발}발** 필요 · 알려진 상한 ${무료몫상한}`);
  if (실제발 > 무료몫상한) {
    console.log(`   🔴 **필요한 발이 상한을 넘는다**(${실제발} > ${무료몫상한}). 이건 몫이 가득 차 있어도 못 끝낸다 —`);
    console.log(`      「돌려 보고 안다」가 아니라 «돌리기 전에» 아는 자리다. 길 셋:`);
    console.log(`        · 나눠 돌린다: node evals/돌리기.js --문항 ${Math.max(1, Math.floor(무료몫상한 / Math.max(1, 규모.모델)))}`);
    console.log(`        · 대조군을 빼고 현행 한 판만 잰다(시험지 providers 를 하나로)`);
    console.log(`        · 유료 열쇠로 한 번에 끝낸다 — **돈이 든다. 유호님 판정 자리다.**`);
    if (!있나('--그냥')) { console.log('\n   던지지 않았다. 위 셋 중 하나를 고르거나 --그냥 으로 강행한다.'); return 3; }
    console.log('   ⚠ --그냥 이라 강행한다.');
  }

  // ② 몫 프로브 (1발) — 실물이 최종 판정자다
  const 생존 = await 정책.제미나이생존({ 용도: '글', timeoutMs: 30000 });
  if (생존.살았나 === true) {
    console.log(`② 몫 프로브 (1발)  ✅ 살아 있다 — ${생존.모델} 이 답했다(생각 토큰 ${생존.사고토큰 ?? '미보고'})`);
  } else if (생존.살았나 === null) {
    console.log(`② 몫 프로브 (1발)  🟠 **못 물어봤다**(${생존.종류}) — 「살았다」가 아니다.`);
    console.log(`   ${String(생존.사유 || '').slice(0, 160)}`);
    if (!있나('--그냥')) return 3;
  } else {
    console.log(`② 몫 프로브 (1발)  🔴 막혀 있다 — ${생존.상태} ${생존.종류}`);
    if (생존.몫상한 != null) console.log(`   구글이 말한 상한: ${생존.몫상한}`);
    console.log(`   다시 던져도 되는 때: ${초읽기(생존.다시초)}`);
    console.log(`   ${String(생존.사유 || '').slice(0, 200)}`);
    if (!있나('--그냥')) {
      console.log('\n   🔑 **한 발도 더 안 던졌다.** 여기서 강행하면 재시도가 남은 몫을 마저 먹는다(09-03 실측).');
      return 3;
    }
    console.log('   ⚠ --그냥 이라 강행한다.');
  }

  if (있나('--재보기')) { console.log('\n(--재보기 라 시험은 안 돌린다)'); return 0; }

  // ── 시험 실행 ──
  const 키 = 정책.제미나이키('글');
  if (!키) { console.error('🔴 공짜 몫 열쇠를 못 읽었다.\n' + 정책.제미나이키안내('글')); return 3; }
  const 낸날 = new Date().toISOString().slice(0, 10);
  const 결과 = path.join('evals', '_결과', `결과_${낸날}.json`);
  fs.mkdirSync(path.join(여기, '_결과'), { recursive: true });

  /* 🔑 「1분에 몇 발」은 상한 문제가 아니라 **예의** 문제로만 남긴다 — 09-03 실측에서
   * 느리게 던져도 429 는 안 풀렸다. 그러니 속도로 벽을 넘으려 하지 않는다. */
  const 인자들 = ['-y', PROMPTFOO, 'eval', '-c', path.relative(루트, YAML),
    '-j', '1', '--delay', '4000', '--no-table', '--no-share', '-o', 결과];
  if (문항한도) 인자들.push('--filter-first-n', String(실제문항));

  console.log(`\n■ 시험 시작 — ${실제발}발 예정 · 결과 → ${결과}`);
  console.log('   (몫 벽이 나오면 재시도를 기다리지 않고 통째로 멈춘다)\n');

  const r = spawnSync('npx', 인자들, {
    cwd: 루트, encoding: 'utf8', shell: true, windowsHide: true,
    env: { ...process.env, GEMINI_API_KEY: 키 },
  });
  const 글 = `${r.stdout || ''}${r.stderr || ''}`;
  process.stdout.write(글);

  const 벽 = /RateLimitExhausted|429|Too Many Requests|quota/i.test(글);
  if (벽) {
    console.error('\n🔴 도중에 **몫 벽**을 만났다 — 이 결과는 「통과」가 아니라 «확인 불가»다.');
    console.error('   남은 칸은 다시 던지지 않았다. 몫이 차면 같은 명령을 다시 돌린다(받은 답은 쟁여 둔 것을 쓴다).');
    return 2;
  }
  if (r.status !== 0) { console.error(`\n🔴 시험이 죽었다(종료 ${r.status}) — «확인 불가»다.`); return 2; }

  /* 사람이 볼 줄만 뽑아 «파일로» 남긴다 — 예약이 새벽에 돌면 화면을 보는 사람이 없다.
   * 맞은 줄은 안 올라온다(의심줄.js 의 규약). */
  const 요약파일 = path.join(여기, '_결과', `요약_${픽.model}_${낸날}.txt`);
  let 요약글 = '';
  const s = spawnSync(process.execPath, [path.join(여기, '의심줄.js'), 결과], {
    cwd: 루트, encoding: 'utf8', windowsHide: true,
  });
  요약글 = `${s.stdout || ''}${s.stderr || ''}`.trim() || '(의심줄이 아무것도 안 냈다)';
  fs.writeFileSync(요약파일, 요약글, 'utf8');

  /* 도장 — 「이 모델은 쟀다」. `--예약` 은 다음 날부터 여기서 0발로 끝난다.
   * 모델 이름이 박혀 있어 픽을 갈아타면 저절로 안 맞고, 그러면 스스로 다시 잰다. */
  fs.writeFileSync(도장경로(픽.model), JSON.stringify({
    끝났나: true, 모델: 픽.model, 사고: 픽.thinking_level,
    때: new Date().toISOString(), 문항: 실제문항, 발: 실제발,
    결과파일: path.relative(루트, 결과), 요약파일: path.relative(루트, 요약파일),
  }, null, 1), 'utf8');

  /* 판정 — **숫자만**. 몽골어도 문항 이름도 안 담아서 PUBLIC 저장소에 커밋할 수 있고,
   * 그 덕에 다른 기계가 같은 시험을 다시 돌리지 않는다. 셈은 `의심줄.js` 가 한다(자는 하나다). */
  try {
    const { 의심줄추출 } = require(path.join(여기, '의심줄.js'));
    const 뽑음 = 의심줄추출(JSON.parse(fs.readFileSync(결과, 'utf8')));
    fs.mkdirSync(path.join(여기, '_판정'), { recursive: true });
    fs.writeFileSync(판정경로(픽.model), JSON.stringify({
      모델: 픽.model, 사고: 픽.thinking_level, 때: new Date().toISOString(),
      어디서: process.env.GITHUB_ACTIONS ? '남의 기계(GitHub)' : '이 기계',
      칸수: 뽑음.칸수, 의심줄수: (뽑음.올릴것 || []).length,
      점수: Object.fromEntries([...뽑음.점수.entries()]),
    }, null, 1), 'utf8');
    console.log(`   판정(숫자만) = ${path.relative(루트, 판정경로(픽.model))} — 커밋해도 되는 파일이다.`);
  } catch (e) {
    console.error(`   ⚠ 판정 숫자를 못 뽑았다: ${e.message} — 결과 자체는 위 파일에 있다.`);
  }

  console.log(`\n✅ 시험 끝 — ${픽.model} 도장을 찍었다(다음 예약은 0발로 끝난다).`);
  console.log(`\n${요약글.slice(0, 4000)}`);
  console.log(`\n   결과 = ${path.relative(루트, 결과)}`);
  console.log(`   요약 = ${path.relative(루트, 요약파일)}`);
  return 0;
}

/* `--예약` 은 사람이 안 보는 시각에 돈다 — 그래서 «무슨 일이 있었나»를 한 줄로 남긴다.
 * 🔑 예약 작업은 **cmd 를 거치지 않고 node.exe 를 직접** 부른다. `.cmd` 래퍼를 쓰면 cmd.exe 가
 *   배치 파일을 OEM 코드페이지(CP949)로 파싱하는데 이 저장소 경로엔 한글이 있어 깨진다
 *   (실측 사고: `rem` 주석 안의 한글 한 낱말이 조각을 «명령»으로 실행하게 만들었다).
 *   그래서 리다이렉트를 못 쓰고, 로그를 이 파일이 스스로 적는다. */
function 예약로그(종료) {
  const 말 = { 0: '끝났다(또는 이미 쟀다 · 0발)', 2: '도중에 죽었다 — 확인 불가', 3: '게이트가 막았다(0발 · 내일 또 시도)' };
  try {
    fs.mkdirSync(path.join(여기, '_결과'), { recursive: true });
    fs.appendFileSync(path.join(여기, '_결과', '예약로그.txt'),
      `${new Date().toISOString()}\t종료 ${종료}\t${말[종료] || '(모르는 종료값)'}\n`, 'utf8');
  } catch { /* 로그를 못 적는 것이 시험을 죽이지는 않는다 */ }
}

/* 종료 코드는 «세우고» 자연히 끝낸다 — `process.exit()` 을 async 안에서 부르면 windows libuv 가
 * 닫히는 중인 핸들을 만나 `Assertion failed: UV_HANDLE_CLOSING` 을 뱉는다(09-03 실물). 그 줄은
 * 무해하지만 사람 눈엔 «죽었다»로 읽혀서, 진짜 사고와 구분이 안 되는 잡음이 된다. */
main().then((c) => {
  if (있나('--예약')) 예약로그(c);
  process.exitCode = c;
}).catch((e) => {
  console.error('🔴 실행기가 죽었다:', (e && e.message) || e);
  if (있나('--예약')) 예약로그(2);
  process.exitCode = 2;
});
