#!/usr/bin/env node
'use strict';
/* 훅발동 — 「`context-budget` 이 실제로 몇 번 울었나」를 재는 통로 (#Q98 · F500 의 짝)
 *
 * ■ 왜 있나 — 이 축은 **세 번 재고 세 번 다 거짓양성이었다**(F500).
 *   세 판 다 transcript 를 «문자열»로 뒤졌다: ①`🔴` 글자로 셌더니 메모리·보드의 표식이 통째로
 *   걸려 「96%」가 나왔고 ②정확 패턴으로 좁혔더니 13% 였고 ③그 477건마저 «내가 읽은 소스 코드»가
 *   섞였을 수 있었다 — 이 훅 파일을 연 세션은 패턴이 그냥 잡힌다. 첫 판을 그대로 냈으면
 *   **잘 도는 훅을 뜯어고칠 뻔했다**(CLAUDE.md 맹점 ④ 가 측정 도구 자신에게 적용된 자리).
 *
 * ■ 🔑 그래서 문자열을 안 본다 — **훅의 판정 함수를 그대로 되감는다.**
 *   발동은 ctx 수열의 순수 함수다(`발동판정`). 재료는 API 가 돌려준 `message.usage` 라
 *   구조가 없으면 자동 탈락한다 — 소스코드·전사 인용이 섞여도 안 걸린다.
 *   판정은 `.claude/hooks/lib/context-size.js` **한 곳**에서 온다(베껴 적으면 갈라진다 · 등록층 ④).
 *
 * ■ 두 층을 따로 낸다. 뜻이 다르기 때문이다 — 합치면 어느 쪽이 0인지 안 보인다.
 *   ㉠ **되감기(조건층)** = 훅이 «울어야 했던» 횟수. 정확하지만 「화면에 닿았나」는 아니다.
 *   ㉡ **장부(착지층)** = 발동이 repo 파일에 흔적을 남긴 횟수(인계문 머리말 `· 컨텍스트 NNNk`).
 *      실물 증거지만 **바닥값이다** — 인계문은 세션별 파일을 «덮어쓰므로» 마지막 쓰기만 남고,
 *      git 이 우연히 중간판을 커밋한 것만 이력에 산다. 안 잡힌 발동의 수는 이 층으론 못 센다.
 *   둘의 차이가 곧 「알림이 흔적을 안 남기는 폭」이고, 그게 이 도구가 새로 보이게 한 것이다.
 *
 * ■ ⚠ 되감기가 **안** 지는 것 (억지로 넓히지 않는다)
 *   · 훅이 실제로 실행됐는지는 모른다 — 등록층이 죽었거나 node 가 없으면 조건이 참이어도 침묵이다.
 *     그 축은 ㉡ 이 아래에서 받쳐 준다(장부에 남았다 = 그 판은 확실히 돌았다).
 *   · 훅은 `Stop` 에서 돈다 — 한 턴 안의 여러 API 호출 중 **마지막 것만** 본다. 그래서 기본은
 *     Stop 경계에서만 되감는다. `--턴마다` 는 API 호출마다 재는 상한값이고, 둘의 차이는
 *     「한 턴 안에서 임계를 여러 개 뛰어넘은 폭」이다(그 경우 훅은 한 번만 운다).
 *
 * 쓰는 법:
 *   node tools/훅발동.js                 # 최근 30일 · 두 층 다
 *   node tools/훅발동.js --days 13       # 장부 창에 맞춰 자른다
 *   node tools/훅발동.js --세션          # 발동한 세션을 한 줄씩
 *   node tools/훅발동.js --턴마다        # Stop 경계 대신 API 호출마다(상한값)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const { 발동판정 } = require(path.join(ROOT, '.claude', 'hooks', 'lib', 'context-size.js'));

function 인자(argv) {
  const a = { days: 30, dir: null, 세션: false, 턴마다: false, 되감기만: false, 장부만: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--days') a.days = Number(argv[i + 1]) || 30;
    else if (argv[i] === '--dir') a.dir = argv[i + 1];
    else if (argv[i] === '--세션') a.세션 = true;
    else if (argv[i] === '--턴마다') a.턴마다 = true;
    else if (argv[i] === '--되감기만') a.되감기만 = true;
    else if (argv[i] === '--장부만') a.장부만 = true;
  }
  return a;
}

const k = (n) => `${Math.round(n / 1000)}k`;

/**
 * 전사 한 벌을 되감는다.
 *
 * 🔑 `usage` 는 **구조로만** 읽는다(`o.message.usage`) — 문자열 패턴은 F500 이 세 번 속은 자리다.
 * 🔑 Stop 경계 = **도구를 더 안 부르는 assistant 턴**. 훅이 도는 자리가 거기다.
 */
async function 되감기(file, 턴마다) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  let prev = 0;
  let 최근 = null;          // 마지막으로 본 {ctx, model} — Stop 경계에서 이걸로 판정한다
  const 발동들 = [];
  let 최대 = 0;
  let 턴 = 0;
  let 평가 = 0;             // 몇 번 판정했나 — 0 이면 「안 울었다」가 아니라 「안 쟀다」다
  let 훅요약 = 0;           // ㉢ 분모 — Stop 훅 배치가 기록을 남긴 자리
  let 깨움 = 0;             // ㉢ — context-budget 이 AI 를 깨운 기록(🔴 첫 도달 · 세션당 1회)

  const 판정하기 = () => {
    if (!최근) return;
    평가 += 1;
    const r = 발동판정(최근.ctx, 최근.model, prev);
    if (r.발동) 발동들.push({ ctx: 최근.ctx, 단계: r.단계, 색: r.색 });
    prev = r.다음단계;
  };

  for await (const line of rl) {
    if (!line) continue;
    /* ㉢ 착지층 — **훅이 실제로 돌았다는 유일한 증거**. F500 이 「미확정」으로 남긴 자리를 여기서 닫는다:
     *   Stop 훅 출력은 전사에 남는다 — `type:"system" · subtype:"stop_hook_summary"` 레코드의
     *   `hookAdditionalContext` 다(2026-08-16 실측 101건). 문자열 grep 이 세 번 속은 까닭도 여기서 갈린다:
     *   **내가 읽은 소스 코드**는 tool_result 블록으로 들어와 이 레코드가 아니고, 본문에 `${k(ctx)}`
     *   템플릿이 그대로 있어 실수(`365k`)와 눈으로도 구분된다.
     * ⚠ 이 층이 보는 것은 `additionalContext` 뿐이라 **🔴 첫 도달(세션당 1회)** 만 남는다 —
     *   화면 문구만 낸 2회차 이후 발동은 여기 안 남는다(실측: addl 없는 레코드 0건). */
    if (line.indexOf('"stop_hook_summary"') !== -1) {
      let s; try { s = JSON.parse(line); } catch (_) { s = null; }
      if (s && s.type === 'system' && s.subtype === 'stop_hook_summary') {
        훅요약 += 1;
        if (JSON.stringify(s.hookAdditionalContext || []).indexOf('[context-budget]') !== -1) 깨움 += 1;
      }
      continue;
    }
    // `usage` 와 `content` 는 **같은 레코드**에 실린다 — 그래서 이 한 줄로 둘 다 본다.
    if (line.indexOf('"usage"') === -1) continue; // 파싱 비용 절약(훅과 같은 방식)
    let o;
    try { o = JSON.parse(line); } catch (_) { continue; }
    const m = o && o.message;
    const u = m && m.usage;
    if (u) {
      const ctx = (Number(u.input_tokens) || 0) + (Number(u.cache_read_input_tokens) || 0)
        + (Number(u.cache_creation_input_tokens) || 0);
      if (ctx > 0) {
        턴 += 1;
        if (ctx > 최대) 최대 = ctx;
        최근 = { ctx, model: String(m.model || '') };
        if (턴마다) { 판정하기(); continue; }
        // Stop 경계인가 — 이 assistant 턴이 도구를 더 안 부르면 여기서 훅이 돈다.
        const 내용 = Array.isArray(m.content) ? m.content : [];
        const 도구부름 = 내용.some((b) => b && b.type === 'tool_use');
        if (!도구부름) 판정하기();
      }
    }
  }
  return { 발동들, 최대, 턴, 평가, 훅요약, 깨움 };
}

async function 되감기층(dir, days, 턴마다) {
  if (!fs.existsSync(dir)) return { 없음: dir };
  const since = Date.now() - days * 86400000;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, abs: path.join(dir, f) }))
    .map((x) => { try { return { ...x, st: fs.statSync(x.abs) }; } catch (_) { return null; } })
    .filter(Boolean)
    .filter((x) => x.st.mtime.getTime() >= since)
    .sort((x, y) => x.st.mtime - y.st.mtime);

  const rows = [];
  for (const x of files) {
    let r;
    try { r = await 되감기(x.abs, 턴마다); } catch (e) { rows.push({ id: x.f.slice(0, 8), 실패: String(e.message) }); continue; }
    rows.push({ id: x.f.slice(0, 8), 날: x.st.mtime.toISOString().slice(0, 10), ...r });
  }
  return { rows, 전사수: files.length };
}

/** ㉡ 장부층 — 인계문 머리말에 남은 `· 컨텍스트 NNNk`. git 이력까지 판다. */
function 장부층(days) {
  const 머리 = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · 세션 ([0-9a-zA-Z?_-]+)(?: · (.+))?$/;
  const 본 = new Set();          // 중복 제거 — 같은 머리말이 커밋마다 다시 보인다
  const 발동 = [];
  const 세션전체 = new Set();
  let 읽은줄 = 0;
  let 못읽음 = 0;

  const 담기 = (raw) => {
    const s = raw.replace(/^\+?##\s*/, '').trim();
    if (!s || 본.has(s)) return;
    본.add(s);
    읽은줄 += 1;
    const m = s.match(머리);
    if (!m) { 못읽음 += 1; return; }
    const [, 날, , sid, 사유] = m;
    세션전체.add(sid);
    const km = String(사유 || '').match(/컨텍스트 (\d+)k/);
    if (km) 발동.push({ 날, sid, k: Number(km[1]) });
  };

  // ① 지금 디스크에 있는 것
  for (const p of ['docs/_ops/인계문.md']) {
    try { fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('## ')).forEach(담기); } catch (_) { /* 없으면 이력만 */ }
  }
  try {
    const d = path.join(ROOT, 'docs', '_ops', '인계문');
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.md')) continue;
      fs.readFileSync(path.join(d, f), 'utf8').split(/\r?\n/).filter((l) => l.startsWith('## ')).forEach(담기);
    }
  } catch (_) { /* 없으면 이력만 */ }

  // ② git 이력 — 덮어쓰기로 사라진 판이 여기 산다
  const g = spawnSync('git', ['log', '--all', '-p', '--format=', '--', 'docs/_ops/인계문.md', 'docs/_ops/인계문/'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
  let git가능 = false;
  if (g.status === 0 && g.stdout) {
    git가능 = true;
    for (const l of g.stdout.split(/\r?\n/)) if (l.startsWith('+## ')) 담기(l);
  }

  const 자름 = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const 창안 = 발동.filter((x) => x.날 >= 자름);
  return { 발동: 창안, 전체발동: 발동, 세션수: 세션전체.size, 읽은줄, 못읽음, git가능, 자름 };
}

function 밴드표(값들, 라벨) {
  const 밴드 = [[0, 299], [300, 399], [400, 499], [500, 599], [600, 799], [800, 999], [1000, 1e9]];
  console.log(라벨);
  for (const [a, b] of 밴드) {
    const n = 값들.filter((v) => v >= a && v <= b).length;
    const 이름 = `${a}k~${b >= 1e9 ? '∞' : `${b}k`}`;
    console.log(`    ${이름.padStart(10)} : ${String(n).padStart(4)}건`);
  }
}

async function main() {
  const a = 인자(process.argv);
  const dir = a.dir || require('./memory-graph.js').projectDir();

  console.log(`\n=== 훅 발동 실측 — context-budget · 최근 ${a.days}일 ===`);
  console.log('  두 층은 뜻이 다르다: ㉠ 되감기 = 울어야 했던 횟수 · ㉡ 장부 = 흔적이 남은 횟수(바닥값)\n');

  if (!a.장부만) {
    const r = await 되감기층(dir, a.days, a.턴마다);
    if (r.없음) {
      console.log(`㉠ 되감기 — 전사 폴더가 없다: ${r.없음}`);
      console.log('   (전사는 repo 밖에 산다 — 다른 기계·클라우드 세션에서는 못 잰다 · --dir 로 지정)');
    } else {
      const 산것 = r.rows.filter((x) => x.턴 > 0);
      const 빈것 = r.rows.filter((x) => !x.실패 && !x.턴);
      const 실패 = r.rows.filter((x) => x.실패);
      const 판정한것 = 산것.filter((x) => x.평가 > 0);
      console.log(`㉠ 되감기(조건층) — ${a.턴마다 ? 'API 호출마다(상한값)' : 'Stop 경계마다(훅과 같은 자리)'}`);
      console.log(`  전사 ${r.전사수} = 잰 것 ${산것.length} + 빈 전사 ${빈것.length} + 읽기실패 ${실패.length}`);
      if (판정한것.length !== 산것.length) {
        console.log(`  ⚠ 턴은 있는데 **판정 자리가 0**인 전사 ${산것.length - 판정한것.length}개 — 안 울린 게 아니라 «안 쟀다»`);
      }
      const 운것 = 판정한것.filter((x) => x.발동들.length);
      const 총발동 = 판정한것.reduce((t, x) => t + x.발동들.length, 0);
      console.log(`  발동 세션 ${운것.length} / 잰 것 ${판정한것.length}` + (판정한것.length ? ` (${Math.round((운것.length / 판정한것.length) * 100)}%)` : ''));
      console.log(`  발동 합계 ${총발동}회 · 세션당 최대 ${운것.length ? Math.max(...운것.map((x) => x.발동들.length)) : 0}회`);
      if (총발동) {
        const ks = 판정한것.flatMap((x) => x.발동들.map((f) => Math.round(f.ctx / 1000))).sort((p, q) => p - q);
        console.log(`  발동 지점: 최소 ${ks[0]}k · 중앙 ${ks[Math.floor(ks.length / 2)]}k · 최대 ${ks[ks.length - 1]}k`);
        밴드표(ks, '  발동 지점 분포:');
      }
      // 🔑 과녁 — 크게 간 세션에서 «침묵»이 있었나. 「없다」도 분모와 함께 쓴다.
      for (const 문턱 of [600, 800]) {
        const 큰것 = 판정한것.filter((x) => x.최대 >= 문턱 * 1000);
        if (!큰것.length) { console.log(`  ${문턱}k 이상 간 세션: 0개 (분모 ${판정한것.length})`); continue; }
        const 침묵 = 큰것.filter((x) => !x.발동들.length);
        console.log(`  ${문턱}k 이상 간 세션 ${큰것.length}개 = 울린 것 ${큰것.length - 침묵.length} + **침묵 ${침묵.length}**`);
        for (const x of 침묵) console.log(`     🔴 침묵: ${x.id} ${x.날} · 최대 ${k(x.최대)} · 턴 ${x.턴}`);
      }
      // ㉢ 착지층(전사) — 조건이 아니라 **훅이 실제로 돈 자국**이다. ㉠ 과 나란히 놔야 뜻이 산다.
      const 기록가능 = 판정한것.filter((x) => x.훅요약 > 0);
      const 깨운것 = 판정한것.filter((x) => x.깨움 > 0);
      console.log('\n㉢ 착지층(전사) — Stop 훅이 AI 를 깨운 기록 `stop_hook_summary.hookAdditionalContext`');
      console.log(`  분모: Stop 훅 기록이 **있는** 전사 ${기록가능.length} / 잰 것 ${판정한것.length} (없는 전사의 0 은 침묵이 아니라 미측정)`);
      console.log(`  깨움 ${깨운것.reduce((t, x) => t + x.깨움, 0)}건 · 전사 ${깨운것.length}개`);
      console.log(`  ⚠ 이 층은 **🔴 첫 도달(세션당 1회)** 만 본다 — 화면 문구만 낸 2회차 이후 발동은 안 남는다.`);
      for (const 문턱 of [600]) {
        const 큰것 = 판정한것.filter((x) => x.최대 >= 문턱 * 1000);
        const 자국 = 큰것.filter((x) => x.깨움 > 0);
        const 기록층죽음 = 큰것.filter((x) => !x.깨움 && !x.훅요약);
        console.log(`  ${문턱}k 이상 ${큰것.length}개 = 깨운 자국 ${자국.length} + 자국 없음 ${큰것.length - 자국.length}(그중 **기록층 자체가 없는 것 ${기록층죽음.length}**)`);
      }

      if (a.세션) {
        console.log('\n  세션별(발동한 것만) — id · 날짜 · 최대 · 발동 단계들:');
        for (const x of 운것.sort((p, q) => q.최대 - p.최대)) {
          console.log(`    ${x.id} ${x.날} · ${k(x.최대).padStart(5)} · 턴 ${String(x.턴).padStart(4)} · ${x.발동들.map((f) => `${f.색}${k(f.ctx)}`).join(' ')}`);
        }
      }
      console.log('');
    }
  }

  if (!a.되감기만) {
    const L = 장부층(a.days);
    console.log('㉡ 장부(착지층) — 인계문 머리말 `· 컨텍스트 NNNk`');
    if (!L.git가능) console.log('  ⚠ git 이력을 못 읽었다 — 지금 디스크에 있는 것만 셌다(덮어쓰기로 사라진 판은 빠졌다)');
    console.log(`  유일 머리말 ${L.읽은줄}줄(못 읽은 꼴 ${L.못읽음}) · 세션 ${L.세션수}개`);
    const 세션별 = new Map();
    for (const x of L.발동) 세션별.set(x.sid, [...(세션별.get(x.sid) || []), x.k]);
    console.log(`  창(${L.자름} 이후) 안의 발동 흔적 ${L.발동.length}건 · 세션 ${세션별.size}개 · 전 기간 ${L.전체발동.length}건`);
    if (L.전체발동.length) {
      const ks = L.전체발동.map((x) => x.k).sort((p, q) => p - q);
      console.log(`  흔적 지점: 최소 ${ks[0]}k · 중앙 ${ks[Math.floor(ks.length / 2)]}k · 최대 ${ks[ks.length - 1]}k`);
      밴드표(ks, '  흔적 지점 분포(전 기간):');
    }
    console.log('  ⚠ 이 층은 **바닥값이다** — 인계문은 세션별 파일을 덮어쓰므로 마지막 쓰기만 남고,');
    console.log('     커밋이 우연히 중간판을 잡은 것만 이력에 산다. 못 센 발동의 수는 이 층으론 모른다.');
    console.log('     그래서 ㉠ 과 ㉡ 의 차이를 「훅이 안 울었다」로 읽으면 안 된다(F348).');
  }
  console.log('');
}

if (require.main === module) {
  main().catch((e) => { console.error(`[훅발동] ${e && e.stack ? e.stack : e}`); process.exit(1); });
}

module.exports = { 되감기, 장부층, 되감기층 };
