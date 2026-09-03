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
 *   종료 0=시험 끝 · 3=게이트가 막음(«실패»가 아니라 «안 던졌다») · 2=시험이 도중에 죽음
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

async function main() {
  const 픽 = 정책.제미나이설정();
  console.log('■ 몽골어 검문 시험지 — 게이트 셋을 지나야 던진다');
  console.log(`  정본 픽: ${픽.model} / 생각 깊이 ${픽.thinking_level}\n`);

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

  console.log(`\n✅ 시험 끝. 사람이 볼 줄만: node evals/의심줄.js ${결과}`);
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error('🔴 실행기가 죽었다:', (e && e.message) || e);
  process.exit(2);
});
