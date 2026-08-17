/* 엔진 소스 정본 — 테스트를 「파일이 몇 개인가」에서 떼어낸다.
 *
 * 왜: 이 저장소의 테스트 상당수가 엔진 소스를 문자열로 읽어
 *     `code.indexOf('시작 표식')` ~ `code.indexOf('끝 표식')`으로 구간을 잘라 검사한다(실측 195건).
 *     엔진이 여러 파일로 쪼개지면 그 표식들이 파일 경계를 넘어 갈라지고,
 *     테스트는 「표식을 못 찾음」으로 죽거나 — 더 나쁘게 — 엉뚱한 구간을 자른 채 조용히 통과한다.
 *     그래서 분할보다 **먼저** 테스트가 엔진 전체를 하나의 문자열로 보게 만든다.
 *
 * ── 분할 체크리스트 (2026-08-02 격리 worktree에서 실제로 2개로 쪼개 실증) ──
 *   1. ENGINE_FILES에 새 파일을 **실제 로드 순서대로** 추가.
 *   2. `.clasp.json`의 filePushOrder에 추가. Apps Script는 전역 스코프를 파일 순서대로
 *      초기화하므로, 순서가 어긋나면 **테스트는 통과하는데 라이브만 죽는다**
 *      (safety.test.js의 filePushOrder 검사가 정합을 잡는다).
 *   3. **`.claspignore`에 `!새파일.js` 한 줄 추가** ← 빠뜨리면 라이브에 아예 안 올라가
 *      앱이 반쪽으로 죽는다. 실험에서 `[v9.54] 루트의 모든 엔진 .js가 .claspignore
 *      허용목록에 있다` 테스트가 정확히 이걸 잡았다. .claspignore는 전부 제외한 뒤
 *      `!파일명`으로 하나씩 되살리는 허용목록 방식이라, 새 파일의 기본값이 「제외」다.
 *   4. `node tools/bump-version.js --desc "..."` — 엔진을 고쳤으므로 버전 범프가 필요하다
 *      (`[v9.95] SYNK_VERSION은 다른 세션이 이미 쓴 번호보다 커야 한다`가 잡는다).
 *   5. 전체 테스트. 표식 기반 195건은 이 헬퍼 덕에 그대로 산다 — 실험에서 전부 통과했고,
 *      실패한 2건은 위 3·4번뿐이었다(표식 관련 실패 0건).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** 엔진 파일 — 로드 순서대로. 분할 시 여기에 추가한다. (2026-08-02 2단계: 실제 5분할)
 *  [v9.138] 엔진_수집.js 편입 — 학습 데이터 수집층(퀴즈 로그·숙제 문항 연결·오류 태그·회화 로그).
 *  누락하면 sheetSkeleton_이 참조하는 QUIZ_LOG_HEADERS를 테스트가 못 찾아, 로드 순서 가드가 오탐으로 죽는다
 *  (조편성.test.js의 「시트 골격은 지연 평가 함수다」가 실제로 그렇게 잡아냈다 — 가드가 제 일을 한 사례).
 *  ⚠ 교재연동.js 는 여기 못 넣는다(시도 실측 08-15) — filePushOrder 는 contents_교안 이 8번째라
 *  「ENGINE_FILES = filePushOrder 선두」 가드(safety v9.57)와 충돌한다. 골격이 교재연동의 상수를
 *  쓰려면 상수를 엔진 쪽(엔진_셋업확장)으로 옮기는 쪽이 정본이다(VOICE_LOG_HEADERS 가 그 사례). */
const ENGINE_FILES = ['Code.js', '엔진_운영배치.js', '엔진_폼리포트.js', '엔진_콘텐츠AI.js', '엔진_셋업확장.js', '엔진_수집.js', '엔진_궤적.js'];

/** 줄끝 **표기**를 접는다 — 표식 검색이 「행동」을 재게 만든다. (F526 ㉠ 실측 · 2026-08-17)
 *
 * ■ 왜 여기인가 — 위 머리말이 이미 적어 둔 대로 이 통로를 지나는 표식 기반 검사가 **195건**이고,
 *   그것들은 전부 `code.indexOf('\n}\n')` 처럼 **줄 끝을 걸친 표식**으로 구간을 자른다. 그래서
 *   줄끝 표기가 한 글자만 달라져도 195건이 「섹션 끝 표식을 찾지 못함」으로 **한꺼번에** 죽는다 —
 *   코드는 한 글자도 안 갈렸는데.
 *
 * ■ 🔴 두 축이 있었고 한쪽만 막혀 있었다 (실측이다)
 *   ㉠ CRLF  — 2026-08-03 에 이미 터졌다(리베이스 직후 `수집.test.js` 9건 동시 사망). 처방은
 *      호출부 세 곳이 각자 `.replace(/\r\n/g,'\n')` 을 붙이는 것이었다. **축 하나만** 막혔다.
 *   ㉡ 줄끝 공백 — 안 막혀 있었다. 08-17 실측: 소스 전량에 줄 끝 공백 한 칸씩만 넣고 스위트를
 *      돌리니 **3895 중 40건**이 빨개졌고 그중 **28건이 이 표식 절단**이었다(수집 24·소급성 4).
 *      행동은 한 글자도 안 갈렸다. 같은 병의 세 번째 자리라(㉠ 08-03 · F518 · F526) 호출부마다
 *      고치는 대신 **이음매 하나가 진다** — 새로 쓰는 검사는 아무것도 안 해도 안전하다.
 *
 * ■ ⚠ 대가 — 접기는 「줄끝 표기 자체가 뜻인」 검사에는 못 쓴다.
 *   · 그래서 `engineParts()` 는 **안 접는다**(구문 검사·톱레벨 스코프는 원문이 뜻이다). 두 이음매가
 *     일부러 다르다 — 합치면 한쪽이 반드시 틀린다.
 *   · 지금 저장소에 「줄끝 공백 금지」류 검사는 0건이다(실측 08-17). 생기면 그 검사는 `engineParts()`
 *     쪽을 봐야 한다.
 *   · 닫는 것: 호출부 세 곳의 손 접기 `.replace(/\r\n/g,'\n')` — 같은 판정을 두 곳에 두면 갈라진다.
 */
const 표기접기 = (s) => String(s).replace(/[ \t]*\r?\n/g, '\n').replace(/[ \t]+$/, '');

/** 엔진 전체를 한 문자열로. 파일 사이는 개행으로만 잇는다(표식 검색에 영향 없게).
 *  줄끝 표기는 접어서 낸다 — 위 `표기접기` 주석. */
function engineSource() {
  return 표기접기(ENGINE_FILES
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n'));
}

/** 파일별 원문이 필요한 검사용(구문 검사·톱레벨 스코프 검사 등).
 *  ⚠ 여기는 **안 접는다** — 원문이 뜻인 자리다(위 `표기접기` 의 「대가」). */
function engineParts() {
  return ENGINE_FILES.map((f) => ({
    file: f,
    path: path.join(ROOT, f),
    src: fs.readFileSync(path.join(ROOT, f), 'utf8'),
  }));
}

/** profiles 공유 블록 전량 — `SHARED*_COL_START` 를 **소스에서 훑어** 낸다.
 *
 * 왜 손 목록이 아닌가 (F080): 같은 목록이 두 곳에 손으로 적혀 있었고, 이미 갈라져 있었다 —
 *   safety.test.js 의 선점열 레지스트리는 SHARED1~3 까지만 알고(4차 블록이 검사 밖),
 *   같은 파일의 상담 디테일 검사는 SHARED4 를 알았다. **한쪽만 갱신되는 것이 기본값**이고,
 *   갈라진 쪽은 언제나 「통과」로 샌다(CLAUDE.md 「목록은 하나에서 파생시킨다」).
 * 그래서 5차 블록이 생기면 아무도 손대지 않아도 두 검사가 동시에 그것을 본다.
 *
 * @returns {{name:string,start:number,len:number,end:number}[]} 시작 열 오름차순
 */
function sharedBlocks(code) {
  const out = [];
  const re = /const (SHARED(\d*)_COL_START) = (\d+)/g;
  let m;
  while ((m = re.exec(code))) {
    const heads = code.match(new RegExp('const SHARED' + m[2] + '_COL_HEADERS = \\[([\\s\\S]*?)\\];'));
    if (!heads) continue; // 시작만 있고 헤더가 없으면 블록이 아니다
    const len = heads[1].split(',').filter((x) => x.trim()).length;
    out.push({ name: m[1], start: Number(m[3]), len, end: Number(m[3]) + len - 1 });
  }
  return out.sort((a, b) => a.start - b.start);
}

/* `표기접기` 는 회귀가 **픽스처로** 탐지력을 못박으려고 내보낸다 — 실저장소만 보면
 * 「접혔다」와 「원래 깨끗했다」가 같은 모양이라 못 가른다. 검사 쪽은 `tests/엔진소스표기.test.js`. */
module.exports = { ROOT, ENGINE_FILES, engineSource, engineParts, sharedBlocks, 표기접기 };
