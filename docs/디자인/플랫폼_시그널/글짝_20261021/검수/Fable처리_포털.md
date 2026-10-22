# 포털 Fable 최종 검수 처리 (2026-10-22)

입력: `fable\portal.md`(P1 1 · P2 8 · P3 5)와 같은 파일에 걸린 `fable\pc.md`의 P2 두 개.
맵: `maps\portal\13-fable.json` · `13b-fable-detail.json` · `13c-library-identity.json`.
캡처: `shots\portal\after4\` (1440·390, 재현 도구 `portal-shots4.mjs`: Fable의 `shots.mjs`를 바탕으로 한 가짜 설정·가짜 계정 서버). 넘침·페이지 오류 0.
platform-library-view.mjs의 summary()·nextStep()(총괄 P1 고침)은 손대지 않았다.

| 지적 | 처리 |
|---|---|
| [P1] 계정 라이브러리 설명이 로그인한 사람에게도 「로그인하면…」 | 총괄이 반영(summary()·nextStep()). 덧붙임: 플랫폼이 로그인 상태를 늦게 받으면 summary()가 다시 안 돌아 그대로 남던 것을 `platform.mjs` showBrowserAccount에서 계정 라이브러리를 다시 그리게 맞춤(13c) — after4 A1·A8(1440·390)에서 「「계정 라이브러리 연결」을 누르면…」 확인 |
| [P2] ① 연결 직후 「계정에 저장했어요」 칩·제목 vs 「계정 저장 켜기」 | 반영 — 공용 `account-notebook.mjs`에 statusLabel·detailLabel 선택지를 더하고(기본값은 그대로라 PATH 여행·PATH VR 화면은 글이 같음) 계정 라이브러리만 저장을 켜기 전에 상태 「계정 저장 꺼짐」, 안내 「아직 이 계정에는 저장하지 않았어요. 아래에서 「계정 저장 켜기」를 누르면 저장해요.」로. 머리 띠와 안쪽 상태 줄이 같은 글을 두 번 보이던 것은 안쪽 줄을 숨기고 머리 띠를 알림 자리(role=status)로 — after4 A3 |
| [P2] ② 펼친 상자 제목 「내 계정으로 이어가기」 | 반영 — 「계정 저장」(공용 기본값이라 PATH 여행·VR 수첩도 같은 제목) |
| [P2] ③ 설정 읽기 실패: 토스트 「화면 설정」 vs 상자 「로그인 설정」 | 반영 — 토스트도 「연결이 불안정해 로그인 설정을 못 불러왔어요. 잠시 뒤 다시 시도해 주세요.」 (after4 A5) |
| [P2] ④ 회원 혜택 카드 「내 성향 확인하기」 vs 「내 성향」 | 반영 — `desktop/renderer/benefits.mjs` name 한 줄만 「내 성향」으로(총괄의 플레저 availability 줄은 그대로). PC 앱 카드·검색도 같이 바뀜, PC 시험 통과 |
| [P2] ⑤ Workspace 부제와 설명 첫 문장이 같음 | 반영 — 설명 「채널 대화와 회사 자료, 작업실이 한 앱에 있어요. 교사는 「내 수업」에서 맡은 반을 챙겨요.」 |
| [P2] ⑥ 홈 WORLD 카드 「한국어 미니게임」 | 반영 — 「한국어 게임과 TOPIK 연습」(소개 부제와 같음) |
| [P2] ⑦ 다운로드에 같은 설치 안내 다섯 번 | 반영 — 포스터는 「SYNK 앱과 회원 혜택을 여는 PC 앱이에요.」만, 줄 상태는 웹에서 「웹에서도 열려요」(WORLD)·「회사 초대 필요」(Workspace), 모든 화면 바닥글은 「같은 SYNK ID로 웹과 PC 앱에서 써요」. 남은 것은 머리의 설치 순서 한 번과 소제목 「PC 앱 안에서 설치하는 앱」 |
| [P2] ⑧ client.html 탭 제목 「SYNK · 계정 연결」 | 반영 — 「SYNK ID 로그인」. 공개 준비 도구(`prepare-world-play-public.cjs`)는 제목 줄을 찾지 않고(learning-hub 주소·index.html·atlas-learning.js만 바꿈) 시험도 이 글을 잡지 않음을 확인 |
| [P3] 합성 예시 「로그인 방법: email · 합성」 | 안 함 — 이번 요청 범위 밖. preview.html은 공개 주소에 없는 개발 예시 |
| [P3] 합성 WORLD 예시의 예시 안내 세 번 | 안 함 — 이번 요청 범위 밖(예시 화면 전용) |
| [P3] 설정이 없을 때 「계정 라이브러리 연결」을 「다시 눌러」 | 안 함 — 이번 요청 범위 밖, 공개 config에 platform 설정이 있어 라이브에서는 안 나옴. 고친다면 `platform-library-view.mjs:293`에서 `identity().configured`가 거짓이면 「이 화면에는 로그인 설정이 없어요.」 |
| [P3] 내 성향 오류 글 「계정 연결을 확인하거나」 | 반영 — `member-insight.mjs` 「인터넷 연결을 보고 「다시 불러오기」를 눌러 주세요. 계속 안 되면 로그아웃했다가 다시 로그인해 주세요.」, `member-insight-view.mjs` 눈썹 「다시 확인」→「불러오기 실패」, 기본 글도 「잠시 뒤 「다시 불러오기」를 눌러 주세요. …」(PC 검수의 같은 지적 포함, after4 A8 갈래) |
| [P3] 새 WORLD 입구에서 미니게임 확인 못 함 | 안 함 — 총괄 확인 몫(synk.im/world 「놀이」 탭에 레이싱·말의 리듬·주문 폭주가 있는지 본 뒤, 없으면 applications.mjs·도움말 글을 있는 게임으로) |
| [PC P2] 계정 라이브러리 ① 로그인됐는데 서버 오류면 「로그인하면…」 | 일부 — 로그인 확인이 늦을 때 다시 그리기는 반영(13c). 서버 오류일 때 어느 갈래를 보일지는 nextStep() 쪽이라 총괄 몫 |
| [PC P2] 계정 라이브러리 ② 「연결을 기다리고 있어요」 두 번 | 반영 — ①과 같은 고침(안쪽 상태 줄 숨김, 머리 띠가 알림 자리) |
| [PC P2] 계정 라이브러리 ③ 「초안 복구」·「보관한 초안 버리기」·「기기의 초안 복구 상태…」 | 반영 — PC 앱 말 「쓰던 메모 되살리기」·「임시 저장본」으로(단추·버리기·확인 창·되살린 뒤 알림, `platform-library-recovery.mjs` 오류 셋) |

합계(포털 14 + PC 덧붙임 3): 반영 11 · 일부 1 · 안 함 4 · 총괄이 반영 1 (내 성향 오류 글은 포털 P3와 PC P2가 같은 자리라 하나로 셈).

시험(전 → 후): 계정 영역 556 중 555 → 556 중 555(바탕부터의 world-memory 하나) · 뿌리+공개 준비 도구 459 중 459 → 459 중 459(13b·13c 뒤 관련 파일 66·15개 다시 통과) · PC 앱 335 중 334 → 335 중 334(혜택·내 성향 시험 126개 포함, 바탕부터의 설치 경로 하나). PATH VR 패키지 시험 7개 실패는 이 작업본에 큰 영상이 없어서(ENOENT)·다른 세션의 PATH 변경 때문이며 수첩 변경과 무관. tap: `reports\portal-r4*-tap.txt`.

다시 묶을 것(총괄): `desktop/renderer/platform-continuity.mjs`(account-notebook·platform-library-view·platform-library-recovery 글이 들어감) — `check-account-bundles --build`.
