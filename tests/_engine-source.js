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
const ENGINE_FILES = ['Code.js', '엔진_운영배치.js', '엔진_폼리포트.js', '엔진_콘텐츠AI.js', '엔진_셋업확장.js', '엔진_수집.js', '엔진_궤적.js',
  '엔진_진단.js', '엔진_자율일.js']; // [09-07] 진단·자율일 엔진 — 골격(sheetSkeleton_)이 두 파일의 헤더 상수를 읽으므로 로드 순서 정본에 든다

/** 줄끝 **표기** 접기 — 정의는 `tests/lib/소스검사.js` **한 곳**에 있다. 여기선 쓰기만 한다.
 *
 * 🔑 왜 옮겼나 (F526 ㉠ → #Q101 · 2026-08-17): 처음엔 이 파일이 정의를 들고 있었는데, 그러면
 *   **엔진 소스를 읽는 호출부만** 안전하다. 엔진 아닌 파일을 읽는 자리(`tools/test-ci.js` 등)는
 *   지날 문이 없어 저마다 손으로 접었고 29벌 전부 CRLF 축만 접은 반쪽이었다. 「소스를 검사 대상으로
 *   삼는 통로」는 원래 `lib/소스검사.js` 라 정의를 그리로 모았다 — 같은 판정이 두 곳이면 갈라진다.
 *   대가·두 축의 실측 근거는 그 파일의 `표기접기` 주석에 있다(여기 다시 적으면 그게 곧 사본이다). */
const { 표기접기 } = require('./lib/소스검사');

/** 엔진 전체를 한 문자열로. 파일 사이는 개행으로만 잇는다(표식 검색에 영향 없게).
 *  줄끝 표기는 접어서 낸다 — 위 `표기접기` 주석. */
function engineSource() {
  return 표기접기(ENGINE_FILES
    .map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8'))
    .join('\n'));
}

/** 파일별 원문이 필요한 검사용(구문 검사·톱레벨 스코프 검사 등).
 *  ⚠ 여기는 **안 접는다** — 원문이 뜻인 자리다(`lib/소스검사.js` 의 `표기접기` 「대가」 절). */
function engineParts() {
  return ENGINE_FILES.map((f) => ({
    file: f,
    path: path.join(ROOT, f),
    src: fs.readFileSync(path.join(ROOT, f), 'utf8'),
  }));
}

/** 라이브에 «실제로 올라가는» .js 전수 — `.claspignore` 허용목록에서 파생한다(손 목록 0).
 *
 * 왜 (심문 0822 G8 · 08-24): ENGINE_FILES 는 「엔진 표식 합본 + filePushOrder 선두」의 정본이라
 *   교재연동(8번째 뒤)·엔진_두뇌(마지막)를 «구조상» 못 담고, 그 결과 라이브 탑재 + AI 키 취급
 *   코드(엔진_두뇌 419줄)가 구문 검사조차 분모 밖이었다 — 「검사 대상」과 「합본 순서」는 다른
 *   개념인데 한 목록이 둘을 겸하다 생긴 구멍이다. 이 함수가 «검사 대상» 쪽 정본이다.
 * 선례: clasp-guard 회귀가 이미 「목록을 다시 베끼지 않는다 — .claspignore(배포 집합의 정본)에서
 *   읽는다」로 같은 파생을 한다. 새 파일이 허용목록에 오르면 아무도 안 고쳐도 여기 분모가 는다.
 * @returns {string[]} 존재하는 라이브 .js 파일명(ENGINE_FILES 순서 우선 · 나머지는 이름순)
 */
function liveFiles() {
  const 허용 = fs.readFileSync(path.join(ROOT, '.claspignore'), 'utf8')
    .split(/\r?\n/).filter((l) => l.startsWith('!')).map((l) => l.slice(1).trim())
    .filter((p) => p.endsWith('.js'));
  const 패턴들 = 허용.map((p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$'));
  const 실물 = fs.readdirSync(ROOT).filter((f) => f.endsWith('.js') && 패턴들.some((re) => re.test(f)));
  // 순서: 엔진 로드 순 먼저(사람이 읽는 실패 메시지의 안정성) · 나머지는 이름순
  const 뒤 = 실물.filter((f) => !ENGINE_FILES.includes(f)).sort();
  return [...ENGINE_FILES.filter((f) => 실물.includes(f)), ...뒤];
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
 * 「접혔다」와 「원래 깨끗했다」가 같은 모양이라 못 가른다.
 * 🔴 그 검사 `tests/엔진소스표기.test.js` 는 ⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다.
 *   즉 아래 `표기접기` 는 **부르는 검사를 잃은 export** 다(지우기 전에 다시 짓는 쪽부터 본다).
 * 검사 쪽은 `tests/엔진소스표기.test.js`. */
module.exports = { ROOT, ENGINE_FILES, engineSource, engineParts, liveFiles, sharedBlocks, 표기접기 };
