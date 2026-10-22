# 웹 플랫폼·SYNK ID 마지막 고침(옛 글 8곳) 배포 뒤 검수 — 2026-10-22 Fable

대상: synk-policy 318a90b 위에 문자열 값만 얹은 후보(`scratchpad/portal-patch/candidate/` 넷) = **지금 라이브**(synk-policy 7f62c9c). 라이브 네 파일을 내려받아 후보와 sha256 대조 — 전부 같다(`/account/dist/platform.js?v=bf5a12c06ad8` bf5a12c0…, `/id/dist/app.js?v=a6fd1588b784` a6fd1588…, `platform.html` c7bb98a5…, `/id/` 59d624d8…). 그래서 아래는 라이브 기준이다.

본 방법: ① `patch.cjs`의 edits 8곳과 바탕·후보 묶음의 주변 코드(이웃 글·④의 조건문·⑤의 쓰임) ② master 원천(`applications.mjs`·`core.mjs`·`platform.mjs`·`platform-library-view.mjs`·`platform-library-data.mjs`) ③ 사실 확인용 코드 — 라이브 WORLD 모듈 56개 크롤(`/world/app-shell.mjs?v=626ca44cd60b` 등), `experiences/synk-world-app/app-shell.mjs`, `desktop/renderer/state.mjs·launcher.mjs`, `experiences/teacher-world/README.md`, `experiences/synk-account/src/teacher-session.mjs·teacher-workspace.mjs·messenger-teacher.mjs`, `tools/synk-id/registry.cjs`, SYNK-talk `supabase/functions/teach/index.ts` ④ 라이브를 크롬(Playwright)으로 직접 열어 1440·390에서 `#app/world`·`#app/messenger`·`#library`·`#downloads`·`#home`·검색·`/id/` 확인 — 새 글 전부 있음, 옛 글(사내 메신저·놀면서 배우는·이어가세요·별도 안내·레이싱, 말의 리듬·팀의 하루) 0, 콘솔 오류 0, 가로 넘침 0. 부모 세션의 `compare-candidate.json`(라이브↔후보 줄 차이가 의도한 글뿐)과도 맞다. 로그인 뒤 화면은 코드로만 봤다(로그인 필요).

## 판정

- **배포한 8곳(①~⑤): 그대로 둠.** 되돌릴 것 없음. 사실·말투·번짐 모두 문제 없음(P0·P1 0건). 각 바꾼 문자열은 묶음 안에 정확히 1회였고(`patch.cjs`가 횟수를 검사) 다른 자리로 번지지 않았다.
- **같은 화면의 이웃 글: 고칠 것 있음 — P2 3건.** 셋 다 이번 고침이 틀린 게 아니라, 새 글이 드러낸 옛 이웃이다. 둘(P2-1·P2-3)은 master 원천에도 같은 글이라 master에서 고치고 공개본은 같은 방식(문자열 값)으로 얹으면 되고, 하나(P2-2)는 공개본 라이브러리 모듈에 남은 옛 이름표다.

## 지적

### P2-1 Workspace 소개의 이웃 글이 「회사 문」만 말한다 — 새 글의 「교사 문」과 어긋남
- 자리: 라이브 `platform.js`(= master `experiences/synk-account/src/platform.mjs`)
  - 139행 launch-bar: 「회사에서 초대받은 계정으로 써요」
  - 140행 「설치 안내」 탭 로그인 칸: 「회사 초대를 받은 계정으로 로그인해요. SYNK ID만으로는 들어갈 수 없어요.」, 웹 칸: 「회사에서 안내받은 Workspace 주소로 열어요.」
  - 110행 라이브러리·홈 카드 상태 칩과 148행 다운로드 표: 「회사 초대 필요」(공개본에도 각각 들어 있음, 「회사 초대 필요」 2회)
- 어긋남: 이번에 올린 `available` 「회사 일은 회사 초대를 받아야, **내 수업은 반을 맡은 교사로 등록돼야** 열려요」·`audience` 「SYNK 회사 구성원과 **담당 교사**」·설명 「교사는 「내 수업」에서 맡은 반을 챙겨요」는 문이 둘이라고 말하는데, 같은 화면의 launch-bar·설치 안내·칩은 회사 초대 하나만 말한다. 교사 독자는 설치 안내를 읽고 회사 초대가 필요하다고 받아들인다.
- 실제 규칙(코드): 회사 구성원이 아닌 교사도 Workspace의 수업 공간만 쓸 수 있다 — `experiences/teacher-world/README.md` 33행(「회사 구성원이 아닌 교사는 수업 공간만 사용하며 회사 메뉴·회사 API·대화 권한을 얻지 않는다」)·35행(교사 전용 WORLD OAuth 클라이언트, 회사 로그인으로 대체하지 않음), `tools/synk-id/registry.cjs` 45행(`teacher-workspace-public-browser` → `https://workspace.synk.im/api/teaching/callback`), `experiences/synk-account/src/messenger-teacher.mjs`(`/api/teaching/*`, `getEnvironment → clientId:'teacher', authProduct:'world'`), `desktop/renderer/launcher.mjs` 152행(「「내 수업」에 SYNK ID로 로그인하면 담당 반이 열려요.」). 「반을 맡은 교사로 등록」은 SYNK-talk `teach/index.ts` 382행(`NOT_STAFF` 403)·734~752행(`engine.staff_classes` 조인으로 담당 밖은 NOT_FOUND)·1388행(`no_classes_assigned`), `teacher-workspace.mjs`(서버가 준 담당 반만, 없으면 「담당 반이 없어요」)와 맞다. 즉 새 글이 맞고 이웃이 낡았다.
- 재현: `https://synk.im/account/platform.html#app/messenger`(로그인 전, 1440·390 라이브에서 봄) → 소개 탭 launch-bar 둘째 줄, 「설치 안내」 탭 로그인 칸. `#library`·`#downloads`의 Workspace 줄 칩.
- 고칠 방향(master 먼저, 공개본은 같은 문자열 치환 — 공개본에서 각 글의 등장 횟수를 `patch.cjs`처럼 검사): launch-bar 「회사 초대를 받은 계정이나 반을 맡은 교사 계정으로 써요」, 설치 안내 로그인 칸 「회사 일은 회사 초대를 받은 계정으로, 내 수업은 반을 맡은 교사의 SYNK ID로 로그인해요. SYNK ID만으로는 들어갈 수 없어요.」, 웹 칸 「회사에서 안내받은 Workspace 주소로 열어요. 교사는 같은 주소의 「내 수업」으로 들어가요.」, 칩 「회사 초대·교사 등록 필요」. 문구는 제안이고 뜻만 맞추면 된다.

### P2-2 공개본 계정 라이브러리 모듈의 앱 이름표가 아직 「메신저」·「교사」 — 같은 화면의 「SYNK Workspace」·「내 수업」과 다른 이름
- 자리: 라이브 `platform.js` @1546769 `names={world:"WORLD",messenger:"메신저",teacher:"교사",path:"PATH",pulse:"PULSE",partners:"파트너스",…}`. master `platform-library-view.mjs` 7행은 `messenger:"Workspace", teacher:"Workspace 내 수업", partners:"PULSE의 옛 메모"`. 이번 ④ 고침과 같은 모듈이지만 ④에는 들어 있지 않았다.
- 보이는 곳(모두 로그인 → 「계정 라이브러리 연결」 → 「계정 저장 켜기」 뒤): 즐겨찾기 단추 줄 「☆ 메신저」·「☆ 교사」(render2의 `PLATFORM_APP_IDS.filter(...).map(... names[id2])`), 「이어 쓸 앱」 선택 상자의 항목, 메모 카드의 앱 이름, 머리글 「최근에 연 메신저」·「메신저 · 남겨 둔 다음 할 일」(summary()). 같은 화면의 사이드바·둘러보기·새소식은 「SYNK Workspace」다.
- 재현: 코드로 확인(렌더 문자열이 그대로 들어간다). 브라우저 재현은 SYNK ID 로그인과 계정 라이브러리 연결이 필요해 하지 않았다.
- 고칠 방향: 이번과 같은 문자열 치환 — 공개본에 `messenger:"메신저"` 1회, `teacher:"교사"` 1회만 있다(세었음) → `messenger:"Workspace"`, `teacher:"Workspace 내 수업"`, 그리고 `platform.html`의 `?v=` 갱신. `partners:"파트너스"`는 공개본의 PULSE·파트너스 처리가 master와 다르므로 손대지 않는 편이 안전하다(아래 P3-4).

### P2-3 WORLD 소개: 머리글은 「TOPIK 진단부터 쓰기 연습」인데 「WORLD에서 할 수 있는 것」 목록에 TOPIK 줄이 없다
- 자리: 라이브 `platform.js` appPage(= master `platform.mjs` 140행) — 「WORLD에서 할 수 있는 것」 = `available`(「미니게임은 설치 없이 웹에서 바로 할 수 있어요.」) + 목록 미니게임·SYNK TOWN·과제와 학습 기록. 새 부제 「한국어 게임과 TOPIK 연습」·설명 「TOPIK 진단부터 쓰기 연습, 한국어 게임까지 들어 있어요」가 앞세운 TOPIK이 아래 「할 수 있는 것」에는 한 줄도 없다.
- 사실은 맞다: 라이브 WORLD `app-shell.mjs`에 「짧은 진단」 2회·「쓰기 연습」 4회·「TOPIK II 쓰기」·「이번 주 계획」 8회, `world-writing-practice.mjs`(TOPIK II 51~54)·`world-learning-ui.mjs`·`world-position-ui.mjs`(내 위치 판)가 실려 있다. PC 앱 `desktop/renderer/state.mjs` 4행 features도 「TOPIK 준비 — TOPIK I 짧은 진단으로 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.」로 시작한다. 빠진 것은 이 화면의 목록뿐이다.
- 재현: `https://synk.im/account/platform.html#app/world` 소개 탭(1440·390 라이브에서 봄).
- 고칠 방향: 목록 첫 줄에 PC 앱과 같은 문장을 더한다 — `<li><strong>TOPIK 연습</strong><span>짧은 진단으로 TOPIK I 내 위치를 보고, 듣기·읽기 연습과 TOPIK II 쓰기 연습을 해요.</span></li>`. 공개본은 `<ul class="feature-list"><li><strong>미니게임</strong>` 바로 앞에 끼우면 된다(그 문자열 1회).

### P3-1 SYNK TOWN 줄에 입장 조건이 없다
- 자리: 같은 목록 「SYNK TOWN — 마을 생활 속에서 배운 말을 써 봐요.」(master 140행, 공개본 동일). 옛 `available`이 지우며 사라진 「Town·숙제·AI 코칭의 데스크톱 제공 시점은 별도 안내」 자리에 아무 조건도 남지 않았다.
- 코드: `experiences/synk-world-app/app-shell.mjs` 444행 — `town/entry`가 허락하지 않으면 「입장 확인 필요 · TOPIK 1급 이상 확인과 타운 이용권이 필요해요」. TOWN_LEAD(443행)는 「내 차림 그대로 동네를 걸어요. 찻집·공방·온실에 들러 이웃과 이야기해요.」라 「배운 말을 써 봐요」 자체는 과장이 아니다.
- 재현 못 함(TOWN 입장은 로그인+조건 필요). 고칠 방향은 제품 판단: 「TOPIK 1급 확인과 타운 이용권이 있으면 열려요」 한 토막을 붙일지, 지금처럼 둘지.

### P3-2 교사를 부르는 말이 한 화면에 셋
- 자리: Workspace 소개 — 태그 「교사」·누가 쓰나요 「담당 교사」·`available` 「반을 맡은 교사」·옆칸 「**학원** 교사 권한과 회사 직원 권한은 따로 받아요」(master 140행, 공개본 동일). 「학원」은 TOWN 공유의 `binding.kind==='academy'`에서 온 말이지만 PC 앱의 교사 대상은 「한국어 교사·교육기관 운영자」(`state.mjs` 6행)라 학원만이 아니다.
- 고칠 방향: 옆칸을 「교사 권한과 회사 직원 권한은 따로 받아요」로.

### P3-3 검색 키워드가 낡았다(둘 다 master 원천 `applications.mjs` 6·7행과 같음)
- 라이브에서 확인: 둘러보기 검색 「메신저」 → 앱 0개(새소식은 「사내 메신저가 SYNK Workspace가 됐어요」라고 하는데 옛 이름으로는 못 찾는다), 「레이싱」 → SYNK WORLD(끝난 게임 키워드 `['레이싱','리듬','주문 폭주','바람길','싱크 타운']`). 라이브 WORLD에서 「한국어 레이싱」·「주문 폭주」는 내 위치 판의 옛 기록 출처 이름(`world-strings.mjs` 465~466행)으로만 남아 있다.
- 고칠 방향: messenger에 `keywords:['메신저','사내 메신저','Workspace']` 추가, world 키워드에서 레이싱·주문 폭주를 빼고 「한글 만나기」·「TOPIK」을 넣는다. 화면에 보이지 않는 값이라 P3.

### P3-4 (참고) 공개본 라이브러리의 즐겨찾기 줄은 master보다 한 판 전이다
- 공개본은 즐겨찾기 단추·「이어 쓸 앱」을 `PLATFORM_APP_IDS`(world·messenger·teacher·path·pulse·partners·care·fortune) 전부로 그리고, master는 `displayIds()`(`platform-library-data.mjs` 9행 `platformDisplayAppIds`, 활성 앱만)로 거른다. 그래서 공개본은 웹 플랫폼에 없는 「☆ 교사」·「☆ PULSE」·「☆ 파트너스」 단추를 보일 것이다. 이번 고침 범위 밖(모듈 단위 교체가 필요)이고 로그인 뒤라 재현하지 않았다. 다음에 계정 묶음을 모듈로 옮길 때 같이 간다.

### P3-5 (참고) ⑤와 이웃한 SYNK ID 동의 화면의 이름
- ⑤는 SYNK ID에서 세 자리에 보인다 — 동의 제목 `<span id="consent-name"></span>에 연결할까요?`(`id/index.html` 65행, 회사 직원 로그인은 registry 48행 `messenger-browser`, product `messenger` → 「SYNK Workspace에 연결할까요?」, 조사 「에」 자연스러움), 「이용 권한」 목록의 제품명, 「로그인한 곳」의 `session.label||PRODUCTS[product]`. 다만 교사의 「내 수업」 로그인은 클라이언트 product가 `world`라(registry 45행) 동의 제목이 「SYNK WORLD에 연결할까요?」로 나온다 — Workspace 내 수업에 연결하면서 WORLD 이름이 뜨는 셈. 설계상 그런 것이고 이번 ⑤와 무관하며 재현 못 함(교사 로그인 필요). 기록만.

### P3-6 (참고) 사소한 이름 겹침
- Workspace 머리의 큰 제목 「워크스페이스」 바로 아래 첫 태그도 「워크스페이스」(master `applications.mjs` 7행과 같음). WORLD는 태그 「TOWN」·목록 「SYNK TOWN」·WORLD 앱 안 「싱크타운」 셋. 화면을 해치진 않아 P3.

## 확인한 것(문제 없음)

- **①~③ 사실**: 라이브 WORLD `app-shell.mjs` 28~29행 — 손님에게 한글 만나기, 바람길·말의 리듬은 한 판 체험(기록·코인은 로그인 뒤) → 「미니게임은 설치 없이 웹에서 바로 할 수 있어요」·「바람길·말의 리듬·한글 만나기 같은 게임을 웹에서 바로 해요」 맞음. TOPIK 진단·쓰기 연습·「내 연습 기록에 맞춰 다음 연습」(이번 주 계획)은 라이브 모듈에 있음(위 P2-3). Workspace 「내 수업」: 회사 워크스페이스 `/?tab=teaching`(README 31행, 10-10 운영 반영), PC 앱 0.4.39 카드(`state.mjs` 6행 teacher, `launcher.mjs` 221행 teacher-preview). 접근 규칙 문장은 코드와 맞음(P2-1의 근거와 같음).
- **④ 세 상태**(공개본 `mountPlatformLibrary`): 처음 HTML은 「로그인하면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.」(master 44행과 같음)인데 첫 render2()→summary()가 바로 덮어 `available`(=notebook 활성·편집 가능·동의)이 아니면 모두 이번 글 「즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.」가 된다 — 로그인 전(단추 「계정 라이브러리 연결」, 누르면 로그인 안내 「로그인하면 계정 라이브러리를 켤 수 있어요…」), 로그인 뒤 연결 전(같은 단추), 연결했지만 저장 꺼짐(노트북 상태 줄이 「아직 이 계정에는 저장하지 않았어요. 아래에서 「계정 저장 켜기」를 누르면 저장해요.」를 따로 보여 줌) 세 상태 모두 말이 된다. 연결 뒤에는 「다음에 할 일을 메모로 남기면 여기서 바로 이어 가요.」·메모·최근 줄로 바뀐다. master가 nextStep()으로 가르는 「로그인하면」·「「계정 라이브러리 연결」을 누르면」 단서만 없어지는데 글로는 자연스럽고 코드 없이 되살릴 수 없다 — 그대로 둔다. `#home`·`#library`·`#settings`에 같은 줄이 나오는 것도 의도대로.
- **⑤ 번짐**: `platform.js`의 `PRODUCTS`는 설정 검사 한 곳에서만 쓰여 보이는 변화가 없다. SYNK ID 쪽은 위 P3-5의 세 자리뿐이고 모두 이름표 자리라 문장이 깨지지 않는다. 공개본에 「사내 메신저」는 새소식 제목·본문(의도한 역사 서술)과 `messengerDestination`의 설정 오류 문구 3개(「사내 메신저 주소를 확인해 주세요」 등, master는 「Workspace 주소 형식이 맞지 않아요」)만 남는다 — 오류 문구는 운영 설정이 틀릴 때만 던져지므로 지적하지 않는다.
- **말투**: 새 글 전부 해요체, 「별도 안내」·뜻 없는 「연결해요」 없음, 내부 이름 없음(「작업실」은 Workspace의 기능 이름으로 새소식·PC 앱과 같음).
- **화면**: 1440·390 캡처와 라이브에서 태그 7개 줄바꿈·머리 제목·launch-bar 정상, 가로 넘침 0, 콘솔 오류 0. 둘러보기 카드·사이드바·다운로드 표·새소식 라벨이 모두 「SYNK Workspace」로 같다.

## 읽지 못한 범위

- 로그인 뒤 화면(계정 라이브러리 연결·즐겨찾기 줄·SYNK ID 동의·로그인한 곳)은 코드로만 봤다(P2-2·P3-4·P3-5). PC 앱 실행 화면은 보지 않았다(`desktop/renderer` 원천만). 라이브↔master 전체 대조(`experiences/synk-account/qa/copy-audit-live-20261022/compare-live.cjs`)는 master 빌드가 필요해 다시 돌리지 않았고, 코디네이터가 말한 남은 차이(이 PC 주소·다운로드 표·라이브러리 한 줄)는 이번 범위 밖이다.

## 요약

라이브 네 파일이 후보와 바이트까지 같고, 1440·390 라이브에서 새 글 8곳이 다 보이며 옛 글·콘솔 오류·가로 넘침은 0이라 **배포한 고침은 그대로 두면 된다**(P0·P1 0건, 사실·말투·번짐 이상 없음, ④는 세 상태 모두 자연스럽고 ⑤는 SYNK ID의 이름표 세 자리에만 들어간다). 다만 새 글이 드러낸 같은 화면의 옛 이웃이 셋 남는다 — Workspace 소개의 launch-bar·설치 안내·「회사 초대 필요」 칩이 교사 문을 모른 채 회사 초대만 말하고(P2-1, 교사가 회사 초대 없이 SYNK ID로 「내 수업」에 들어가는 규칙은 README·registry·SYNK-talk `staff_classes`로 확인), 공개본 라이브러리 모듈의 앱 이름표가 아직 「메신저」·「교사」라 연결 뒤 즐겨찾기·「이어 쓸 앱」에 옛 이름이 뜨며(P2-2, `messenger:"메신저"`·`teacher:"교사"` 각 1회라 같은 문자열 방식으로 고칠 수 있음), WORLD 소개 「할 수 있는 것」 목록에 머리글이 앞세운 TOPIK 줄이 없다(P2-3). P3로는 TOWN 입장 조건 미표기, 「학원 교사」 표현, 낡은 검색 키워드(「메신저」 0개·「레이싱」→WORLD), 공개본 즐겨찾기 줄의 비활성 앱 단추, 교사 로그인 동의 화면의 WORLD 이름을 적었다.
