/* 외부 사실 잠금 — 「고쳤는데 원문은 그대로 살아 있는」 정정을 막는다. (F092)
 *
 * 왜 이 파일이 필요한가 (실사건):
 *   08-04, Manus/Meta 인수 해제 날짜가 틀린 걸 발견하고 고쳤다. 그런데 고친 방식이
 *   **원문 교체가 아니라 아래에 「날짜 정정」 각주 덧붙이기**였다. 결과: 같은 파일 안에서
 *   먼저 읽히는 문장은 틀린 채로 남고, 뒤쪽 각주만 맞았다 — `docs/AI_스택_가이드.md`와
 *   `memory/ai-stack-decision.md` 양쪽에서 똑같이. 정정 커밋(4aef3b3)이 있었는데도
 *   **틀린 사실이 6주 넘게 계속 읽히는 자리에 있었다.**
 *
 *   🔑 일반화: 외부 사실은 낡는데, 낡은 값이 여러 곳에 복제돼 있으면 한 곳만 고쳐진다.
 *   그래서 처방 둘을 **동시에** 검사한다 — 한쪽만으로는 조용히 샌다:
 *     ① 낡은 표기가 어디에도 없다        (없어야 할 것이 없나)
 *     ② 정본 표기가 지정된 곳에 있다      (있어야 할 것이 있나)
 *   ①만 있으면 그 문단을 통째로 지워도 초록이다(memory `guard-must-check-result`).
 *
 * 설계에서 실제로 물린 함정 — **정정문 자신이 틀린 표기를 인용한다.**
 *   「2026-04에 원상복구됐다는 틀린 요약이다」처럼, 경고하려면 그 문구를 적어야 한다.
 *   단순 문자열 금지로 짜면 이 가드는 **자기가 지키는 문서를 잡는다** → 다음 사람은
 *   규칙을 지키는 게 아니라 검사를 끈다(memory `guard-detection-layers-2026-08-04`).
 *   → 낫표 「…」 안은 **인용으로 보고 검사에서 뺀다.** 이 예외 자체를 양방향으로 못박는다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

/* ── 등록부 ──────────────────────────────────────────────────────────────────
 * 새 외부 사실을 잠글 때 여기에만 추가한다. 검사·픽스처·오류 문구가 전부 여기서 파생된다
 * (손 목록을 둘로 두면 갈라진다 — F080 이 그 실사건). */
const 외부사실 = [
  {
    이름: 'Meta–Manus 인수 해제',
    // 사람이 실제로 쓴 표기 그대로. 「2026-04 규제로 인수가 원상복구됐다」·
    // 「Meta 인수는 2026-04 원상복구됐고」 둘 다 실제 저장소에 있던 문장이다.
    낡은표기: /2026-04(?!-\d)[^\n]{0,24}원상복구/,
    낡은예: 'Meta 인수는 2026-04 원상복구됐다',
    정본예: 'NDRC 해제 명령 2026-04-27 → 정식 해제 완료 2026-06-11',
    // 정본 표기가 살아 있어야 하는 곳 + 그 안에 반드시 있어야 할 조각
    정본파일: path.join('docs', 'AI_스택_가이드.md'),
    정본조각: ['2026-04-27', '2026-06-11'],
    왜: '04-27은 NDRC 「명령일」이고 실제 분리 완료는 6주 뒤인 06-11이다. 둘을 뭉개면 '
      + '「지배구조가 언제까지 Meta였나」가 틀려지고, 커넥터 의존 판정의 근거가 바뀐다.',
    근거: '알자지라 2026-04-27 보도 · O\'Melveny/Lexology 로펌 해설',
  },
  {
    이름: 'Sora 종료(2단계)',
    // 「2026-04 종료」는 앱과 API 를 한 날짜로 뭉갠 요약이다 — Manus 건과 똑같은 형태.
    // Sora 근처의 2026-04 만 본다(같은 문서에 NDRC 2026-04-27 이 따로 있어 무조건 잡으면 오탐).
    낡은표기: /Sora[^\n]{0,30}2026-04(?!-)/,
    낡은예: 'Sora 소비자 서비스 2026-04 종료',
    정본예: 'Sora 앱 종료 2026-04-26 · API 종료 2026-09-24',
    정본파일: path.join('docs', 'AI_스택_가이드.md'),
    정본조각: ['2026-04-26', '2026-09-24'],
    왜: '앱은 이미 죽었지만 API 는 2026-09-24 까지 산다. 한 날짜로 뭉개면 「Sora 는 이미 '
      + '전부 없다」고 답하게 되고, 남은 창을 쓸지 말지를 판단할 재료가 사라진다.',
    근거: 'OpenAI 헬프센터 「Sora discontinuation」 · the-decoder 2026-03 보도(2단계 종료)',
  },
];

/* ── 인용 제거 ───────────────────────────────────────────────────────────────
 * 낫표 「…」 안은 "이 문구가 틀렸다"고 가리키는 인용이다. 길이를 보존해서 지운다
 * (자리를 무너뜨리면 앞뒤 문장이 붙어 없던 매치가 생긴다 — doc-graph maskCode 와 같은 처방). */
function 인용제거(text) {
  return text.replace(/「[^」\n]*」/g, (m) => ' '.repeat(m.length));
}

function 낡은표기찾기(text, 사실) {
  return 사실.낡은표기.test(인용제거(text));
}

/* ── 검사 대상 ───────────────────────────────────────────────────────────────
 * 이력·아카이브는 **뺀다.** 지난 사건을 적은 글은 틀린 표기를 그대로 인용하는 게 제 일이고,
 * 거기까지 고치라고 하면 그건 기록 위조다. 뺀 자리는 여기 한 곳에만 적는다. */
const 이력파일 = [
  path.join('docs', '_archive'),
  path.join('docs', '_ops', '마찰신호.md'),
  path.join('docs', '지침_이력.md'),
  path.join('docs', '세션보드_아카이브.md'),
];
const 이력인가 = (rel) => 이력파일.some((p) => rel === p || rel.startsWith(p + path.sep));

function md파일들(dir, base = dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) md파일들(abs, base, out);
    else if (e.name.endsWith('.md')) out.push(abs);
  }
  return out;
}

/* memory 정본은 repo 밖(~/.claude/projects/<슬러그>/memory)에 산다 — tools/memory-graph.js 와
 * 같은 규칙으로 찾는다. CI 엔 홈이 없어 **통과가 아니라 skip 으로 드러낸다**(F095). */
function memoryDir() {
  if (process.env.SYNK_MEMORY_DIR) return process.env.SYNK_MEMORY_DIR;
  const slug = ROOT.replace(/:/g, '-').replace(/[\\/]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', slug, 'memory');
}

function 위반목록(files, base) {
  const 위반 = [];
  for (const abs of files) {
    const rel = path.relative(base, abs);
    if (이력인가(rel)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const 사실 of 외부사실) {
      if (낡은표기찾기(text, 사실)) 위반.push(`${rel} — ${사실.이름}: ${사실.정본예}`);
    }
  }
  return 위반;
}

/* ── ① 탐지력을 픽스처로 못박는다 ────────────────────────────────────────────
 * 실저장소가 지금 깨끗하다는 것만으로는 이 검사가 도는지 알 수 없다(0건은 「검사가 죽었다」와
 * 같은 모양이다). 그래서 탐지력은 임시 파일이 지고, 실저장소엔 거짓양성만 묻는다. */
test('[탐지] 낡은 표기를 그대로 쓰면 잡는다', () => {
  for (const 사실 of 외부사실) {
    assert.ok(낡은표기찾기(`문서 본문. ${사실.낡은예} 그래서 어쩌고.`, 사실),
      `${사실.이름}: 낡은 표기를 못 잡는다 — 검사가 죽어 있다`);
  }
});

test('[탐지] 정본 표기는 안 잡는다 (거짓양성이면 다음 사람이 검사를 끈다)', () => {
  for (const 사실 of 외부사실) {
    assert.ok(!낡은표기찾기(`문서 본문. ${사실.정본예} 그래서 어쩌고.`, 사실),
      `${사실.이름}: 정본 표기를 오탐한다`);
  }
});

/* 이 두 건이 이 파일에서 가장 중요하다 — 예외를 넣은 이상 예외가 구멍이 아닌지도 검사해야 한다. */
test('[핵심·양방향] 낫표 인용은 통과, 같은 문구가 낫표 밖이면 차단', () => {
  for (const 사실 of 외부사실) {
    assert.ok(!낡은표기찾기(`⚠「${사실.낡은예}」는 틀린 요약이다.`, 사실),
      `${사실.이름}: 인용까지 잡으면 정정문 자신이 걸린다`);
    assert.ok(낡은표기찾기(`⚠${사실.낡은예}는 사실이다.`, 사실),
      `${사실.이름}: 낫표를 벗기면 잡혀야 한다 — 예외가 구멍이 됐다`);
  }
});

test('[탐지] 실제 파일 트리에서 잡는다 — 이력 폴더는 빼고', () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'extfact-'));
  const 사실 = 외부사실[0];
  fs.mkdirSync(path.join(TMP, 'docs', '_archive'), { recursive: true });
  fs.writeFileSync(path.join(TMP, 'docs', '살아있는문서.md'), `본문 ${사실.낡은예} 끝`, 'utf8');
  fs.writeFileSync(path.join(TMP, 'docs', '_archive', '옛기록.md'), `본문 ${사실.낡은예} 끝`, 'utf8');

  const 위반 = 위반목록(md파일들(TMP), TMP);
  assert.equal(위반.length, 1, `이력 제외가 안 듣거나 과하게 든다:\n${위반.join('\n')}`);
  assert.match(위반[0], /살아있는문서\.md/);
});

/* ── ② 실저장소 — 거짓양성만 본다 ──────────────────────────────────────────── */
test('[실저장소] docs 에 낡은 외부 사실이 남아 있지 않다', () => {
  const 위반 = 위반목록(md파일들(path.join(ROOT, 'docs')), ROOT);
  assert.deepEqual(위반, [],
    '낡은 외부 사실이 살아 있다. **각주를 덧붙이지 말고 원문을 교체하라** — '
    + '먼저 읽히는 문장이 틀리면 각주는 안 읽힌다(F092):\n' + 위반.join('\n'));
});

const MEM = memoryDir();
const 메모리없음 = !fs.existsSync(MEM)
  && `memory 정본이 없다(${MEM}) — repo 밖이라 CI·다른 기계엔 없다. 통과가 아니라 skip 이다.`;

test('[실저장소] memory 정본에도 낡은 외부 사실이 없다', { skip: 메모리없음 }, () => {
  const 위반 = 위반목록(md파일들(MEM), MEM);
  assert.deepEqual(위반, [], '메모리 정본에 낡은 외부 사실이 살아 있다:\n' + 위반.join('\n'));
});

/* ── ③ 정본이 실재하는지 (①만으로는 문단째 지워도 초록이다) ─────────────────── */
test('[결과 검사] 정본 표기가 지정한 파일에 살아 있다', () => {
  for (const 사실 of 외부사실) {
    const abs = path.join(ROOT, 사실.정본파일);
    assert.ok(fs.existsSync(abs), `${사실.이름}: 정본 파일이 없다 — ${사실.정본파일}`);
    const text = fs.readFileSync(abs, 'utf8');
    for (const 조각 of 사실.정본조각) {
      assert.ok(text.includes(조각),
        `${사실.이름}: 정본 조각 「${조각}」이 ${사실.정본파일} 에서 사라졌다.\n`
        + `  왜 중요한가: ${사실.왜}\n  근거: ${사실.근거}`);
    }
  }
});
