# WORLD 코스튬 스튜디오 · 2026-10-09

> 10월 9일 8종·24조합 로컬 스튜디오 최초 구현의 원본 검증이다. 이후 의상 확장과 운영 적용은 [코스튬 공개 완료 기록](../costume-release-20261010/README.md)에서 이어 본다. 아래 C17 적용·서버 패키징 필요와 로컬 주소는 당시 후보 범위이며 현재 재적용 지시가 아니다.


사용자의 「코스튬 화면이랑 기능을 제대로 업그레이드」 요청에 따른 로컬 구현이다. 기존 테라스 캡처와 두 아이템 선택 화면을 실제 3D 피팅룸·나의 룩북·촬영실로 발전시켰다. 몽글의 기존 몸·펠트 섬유·눈과 반짝임 원문은 동일하며, 최종 마스터 승인이나 네이티브 출시를 뜻하지 않는다.

[연결 개발판 옷장](http://127.0.0.1:4296/desktop.html?wardrobe=1&opening=off) · [휴대폰 배치](http://127.0.0.1:4296/mobile.html?wardrobe=1&opening=off) · [계정 없는 브라우저 미리보기](http://127.0.0.1:4295/desktop.html?wardrobe=1)

4296은 사용자가 고른 합성 테스트 계정의 서버 저장을 사용한다. 4295는 브라우저 미리보기이며 저장이 불가능하면 현재 화면에서만 유지한다고 표시한다. 기존 운영 `synk-wardrobe`의 완성 차림 이미지·실계정 기록과 아이템 ID를 자동 변환하지 않는다.

## 구현

- **피팅룸:** 하나의 실제 WebGL 캔버스를 유지한다. 옷/목도리 독립 선택, 종류·옷감 검색·보유 필터, 현재 차림과 비교, 드래그·화살표 키 회전, 정면·옆·뒤·옷감 가까이, 확정 전 미리보기를 제공한다. 휴대폰은 의상 가로 목록과 고정 행동 영역을 쓰며 320px에서도 의상 카드 전체를 볼 수 있다.
- **8개 의상·소품:** 기존 코튼 앞치마와 첫 산책 목도리, 새 니트 조끼·데님 공방 앞치마·빗방울 케이프·배자·청금석 머플러·삼각 스카프. 앞뒤/옆 두께, 케이블·골지, 능직, 겹친 주머니와 리벳, 칼라·동정·고름을 메시와 재료별 표면으로 구성한다. 옷 5벌 × 목도리·스카프 3개에 미착용 선택까지 **24조합**이다.
- **룩북:** 이름을 붙인 조합 최대 12개. 서버가 확인한 소유품만 저장하며 다시 입기 전 미리보기, 이름·조합 수정, 조합 삭제를 지원한다. 그림 파일을 DB에 저장하지 않고 ID·이름·슬롯·서버 날짜만 보관한다.
- **촬영실:** 실제 3D 각도와 오전·노을·사진관 조명, 1200×1500 세로/1200×1200 정사각 PNG. 확정 차림과 미리 입은 차림을 사진에 구분한다. 사진 교체/닫기 때 이전 Blob URL을 해제하고 차림이 달라지면 이전 사진이라고 안내한다.
- **계정/타운:** 기존 body/neck 슬롯과 서버 소유권·revision·동일 요청 재전송을 사용한다. 옷장을 열 때 최신 상태를 먼저 읽고, 열린 뒤 다른 기기에서 바뀐 차림은 충돌로 처리한다. 홈과 타운은 같은 새 실제 의상 메시를 사용한다.
- **선물:** 로컬 WORLD v1의 무료 첫 옷장 컬렉션 7개, 기존 첫 문장 놀이의 목도리 1개. 이전 저장에 첫 컬렉션을 한 번 보충하며 착용·보상 날짜·놀이·요청 기록을 보존한다. 잠긴 목도리는 기존 3문항 놀이→서버 보상→착용으로 연결된다. 운영 구매·동전·다른 게임 보상은 변경하지 않았다.

학습은 기존 초급 한국어 짧은 문장 읽기 시제품의 재사용이다. 보상은 참여 선물이며 TOPIK 점수·학생 학습 효과를 새로 검증한 것은 아니다.

## 소스

| 위치 | 역할 |
| --- | --- |
| `../../app-shell.mjs`, `../../world-client.mjs` | 연결 개발판 진입, 최신 조회, 장착/룩북 저장과 재전송 |
| `../../../synk-world-home/wardrobe-studio.mjs`, `wardrobe-studio.css` | 세 화면과 피팅/사진/키보드 UI |
| `../../../synk-world-home/wardrobe-stage.mjs` | 3D 촬영실, 조명·회전·캡처·복구·자원 해제 |
| `../../../synk-world-home/wardrobe-catalog.mjs`, `avatar-wardrobe.mjs` | 의상 미술 정보와 독립 의상 메시 |
| `../../../synk-world-home/avatar-v3.mjs` | 기존 몽글 보존과 새 의상 연결 |
| `SYNK-talk/lib/world-v1-{catalog,domain,server}.js` | 실제 소유권·무료 컬렉션·룩북·중복/충돌 방어 |
| `SYNK-talk/supabase/migrations/20261009210000_synk_world_wardrobe_c17.sql` | 기존 비공개 요청 테이블의 `looks` 작업 허용; 원격 미적용 |

기존 봉인 C16 SQL은 보존했다. C17은 체크섬·중복 적용·RLS/권한/삭제 연결을 실제 로컬 PostgreSQL 호환 DB에서 확인했고 로컬 실행기가 함께 적용한다. 공개 릴리스에는 별도의 C17 적용·서버 함수 패키징·검수가 필요하다.

## 검증 근거

- [Node 기록](node-result.json): 실제 DB/서버 25, 브라우저 클라이언트 17, 타운 계약 13 통과. 실제 브라우저 옵션이 없는 기존 클라이언트 시험 1개는 건너뛰었으며 두 브라우저 세션의 실제 저장/복원/충돌을 아래에서 별도로 확인했다.
- [브라우저 기록](browser-result.json): 연속된 격리 실행에서 79조건 확인. 첫 전체 실행은 마지막 타운 검사에서 멈췄다. 잘못된 검사 필드와 타운 주민의 루트 절대 재료 import를 진단하고 상대 경로로 수정했다. 후속에서 동일 새 의상의 실제 타운 메시, 선물 받기, 작은 화면 등을 확인했다. **한 번에 녹색인 전체 CI 실행으로 합산하지 않는다.** 이전 실패/응답은 `browser-failure-r1.json`, `browser-failure-r2.json`, `town-probe.json`에 보존한다. 후속 `finish-failure.json`은 브라우저 21조건을 모두 통과한 뒤 옛 실패 기록의 집계 assert에서 멈춘 원본이다.
- [생명주기/원본 보존](lifecycle-result.json): 10조건 통과. 로딩 중 닫으면 즉시 GPU 해제, 늦은 준비 무시, 정상 재입장·실제 context loss 복구, 기존 몸 형상/펠트 섬유/눈 원문 동일.
- [최종 화면](final-screen-result.json): 직접 링크 로그인 뒤 피팅룸 상태와 적용 단추 유지, PC/390/320px 넘침 없음, 두 휴대폰 크기에서 카드 전체가 행동 영역 위에 표시되는 것을 확인했다. 이전 로그인 close 이벤트가 새 피팅룸 상태를 지우는 문제도 수정했다.
- [정사각 PNG 최종 다운로드](square-final-result.json): 최종 촬영실에서 실제 1200×1200 PNG와 파일명을 확인했다. [현재 제공 원문](served-result.json)은 실행 중인 4296의 11개 응답과 소스 SHA-256이 일치한다.

휴대폰은 브라우저 뷰포트 검사다. Galaxy S25/iPhone 15의 지속 성능·발열·터치, 운영 SYNK ID 왕복, 실제 학생 반응, Unity 리깅/새 의상 GLB·네이티브 설치·공개 배포는 미검증이다. 정지 시 프레임 반복을 하지 않고, 조작 화면의 캔버스 버퍼 1.2MP·DPR 휴대폰 1.5/PC 1.75로 제한한다. PNG 촬영 시에는 지정한 사진 해상도로 잠시 렌더한 뒤 원래 버퍼로 복원한다. 3D 품질·기기 FPS의 최종 승인을 주장하지 않는다.

## 실제 화면

[기존 PC](before-desktop.png) · [현재 PC](final-desktop.png) · [390px](final-390.png) · [320px](final-320.png) · [룩북](lookbook-desktop.png) · [촬영실](photo-desktop.png) · [실제 PNG](portrait-confirmed.png) · [타운](new-costume-town.png)

![현재 코스튬 스튜디오](final-desktop.png)

## 재검사

`browser.cjs`는 새로운 합성 A/B DB를 전제로 한다. 이전 시도 DB를 지우거나 운영 계정을 초기화하지 않는다. 독립 터미널에서 새 경로로 서버를 실행한 뒤 검사한다.

```powershell
$env:SYNK_WORLD_PORT='4298'
$env:SYNK_WORLD_DATA_DIR=Join-Path (Get-Location) ('experiences/synk-world-app/.local/wardrobe-qa-' + [Guid]::NewGuid())
node experiences/synk-world-app/server.mjs
```

```powershell
node experiences/synk-world-app/qa/costume-studio-20261009/browser.cjs
node experiences/synk-world-app/qa/costume-studio-20261009/lifecycle.cjs
node --test experiences/synk-world-app/qa/client.test.mjs experiences/synk-world-app/qa/wardrobe-client.test.mjs experiences/synk-world-app/qa/town-bridge.test.mjs experiences/synk-world-app/qa/town-host.test.mjs
```
