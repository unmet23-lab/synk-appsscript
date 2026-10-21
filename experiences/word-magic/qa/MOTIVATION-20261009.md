# 소품·목표·복습 보상 QA · 2026-10-09

## 구현

- 무료 기본 실험실과 20코인 **곰의 소풍 실험 세트**. 이미 승인된 곰·튜브·간식·상자를 실제 자유 실험실 물체로 사용한다. 배운 표현만 사용하며 본편 18개 사건과 6개 표현은 무료로 유지한다.
- 각 세트의 변형을 따로 저장한다. 기존 단일 `lab` 저장을 기본 세트로 옮기며 물체 ID·자산·위치는 정본에서만 복원한다.
- 상품 목표는 사용자가 선택·교체·해제한다. 완료/실험실/상점에 차액·구매 가능·달성 상태를 보여 주고 구매 뒤 실제 사용으로 이어진다.
- 첫 방문 구매자는 두 표현을 먼저 배우고 **내 소품으로 놀기**로 구매 세트에 진입한다. 튜토리얼 중 새로고침에도 진입 의도를 보존한다.
- 실제 한국어 MP3 완료 후 서로 다른 표현-물건 3쌍 변경, 최소 2표현·2물건이면 하루 5코인. 소리 완료/실제 변화가 없는 조작, 그림 체험, 튜토리얼은 제외. 일일 중복과 공통 10회 한도는 공통 지갑이 판정한다. 새로고침 시 소리 증거를 복원하지 않고 서울 날짜가 바뀌면 세션 증거도 비운다.
- 이 코인은 복습 참여 보상이며 언어 정답률이나 숙달 판단이 아니다. 자유 실험실 조작은 Atlas 평가 이벤트로 올리지 않는다.

## 실행 결과

- `node --test experiences/word-magic/core.test.mjs experiences/word-magic/audio.test.mjs experiences/word-magic/practice.test.mjs`: 17/17 PASS.
- `node experiences/word-magic/qa/shop.cjs`: 1280/320px, 각 12흐름 PASS. 8상품·기본무료·잔액부족·한영·키보드/초점·구입/장착·재입장·무료재장착·미리보기 격리·PNG 실제 사진틀·저장거부 복구·가로 넘침 확인.
- `node experiences/word-magic/qa/motivation.cjs`: 390/320px PASS. 명시한 fixture(15코인, 크기 두 표현 소개 완료) 이후 실제 MP3와 조작으로 3쌍→+5→20코인 상품 구입→잔액0→새 소품 사용. 무변화 제외, 구매 실패 복구, 세트간 무료 이동과 별도 상태 복원, 하루 중복 미지급, 목표 달성 유지/해제, Atlas 이벤트0. 최초 소품의 4개 터치 영역 모두 44px 이상·서로 비겹침. 오류·404·가로 넘침0. 별도 맥락에서 보상 저장 실패→실제 증거 유지→재시도5코인 PASS. 같은 탭의 날짜를 다음 서울 날짜로 이동한 검증에서 증거 초기화→새 실제 MP3 3쌍→다음 날5코인 추가(총10)도 PASS.
- `node experiences/word-magic/qa/motivation-edges.cjs`: 공통 보상10회 fixture 후 실제 MP3 복습의 추가 지급0, 18개 그림 체험 완료 후 실험실 조작 지급0. 첫 방문 타 게임 코인 구매→두 표현→소풍 세트 직접 진입 EN/KO PASS, 중간 새로고침 복원 및 튜토리얼 코인0.
- `$env:MAGIC_URL='http://127.0.0.1:4340/word-magic/'; node experiences/word-magic/qa/play.cjs small`: 320px 실제 18개 사건+6개 MP3 확인 PASS. 45 완주 코인+실험실 실제 복습5=50, 듣기 정답 단서 숨김·반대쌍 Canvas 동일·첫 오답/도움 별도·Atlas v2 6개·PNG 960×612·재입장·미리보기 격리 유지.

## 증거

- [신규 제품/목표 실제 브라우저 결과](motivation/results.json), [첫 구매/일일 한도/그림 체험 결과](motivation/edges.json)
- [새 소품 실험실 390px](motivation/picnic-390.png), [320px](motivation/picnic-320.png)
- [20코인 목표 도달](motivation/practice-goal-ready-390.png)
- [한국어 소풍 상품 320px](motivation/toy-products-ko-320.png)
- [첫 구매 두 표현 안내](motivation/first-purchase-tutorial-ko.png)
- [기존 상점 결과](shop-results.json), [실제 전체 완주 결과](play-small.json)

Chrome 로컬 검증이다. 실제 학습자의 장기 재방문·학습효과 향상을 측정한 결과나 배포 증거는 아니다. QA 코인/소개 상태 fixture는 검증 준비에만 쓰고 실제 플레이 성취로 표시하지 않는다. 신규 이미지·음성 생성 및 유료 호출은 없었다.


## 보유품 허브에서 실험실로 이어가기

`?play=lab&item=magic-toys-picnic`은 준비 카드를 열며 실제 버튼을 누르기 전 음성 준비·장착·구매를 하지 않는다. 8개 마법 상품 ID만 정본 카탈로그로 확인한다. 보유 배경/사진틀도 사용할 수 있고, item 생략은 현재 장착 세트를 유지한다. 미보유나 다른 게임/잘못된 ID는 무료 기본과 상점 선택을 보여 준다. `shop=1`은 `play=lab`보다 우선한다.

- 미완료 본편은 `adventureResume`에 정본 상태로 별도 보관한다. 실험실의 '하던 모험으로 돌아가기'와 처음 화면의 이어 하기로 이전 물체 조작을 복원한다. 듣기 소리 완료 증거를 복원하지 않으며 이미 남긴 첫 응답은 유지한다.
- `node --test .../core.test.mjs .../audio.test.mjs .../practice.test.mjs`: 확장 후 **18/18 PASS**. 본편/실험실 저장 분리·정본 물체 복원·첫 응답 상태 유지·듣기 완료 비복원 포함.
- `node experiences/word-magic/qa/deeplink.cjs`: **390/320px PASS**. URL 진입 시 음성 요청0·장착 변경0, 실제 버튼 이후 보유 소풍/사진틀, item 없는 현재 세트, 미완료 퍼즐 물체 상태 즉시 복귀/재로드 복귀 확인.
- 미보유/잘못된 상품은 무료 기본으로 이동하고 fixture100코인 그대로, 소풍 미보유와 완료 사건0 유지. 첫 방문은 실제 두 MP3 후 소풍 진입. manifest503은 원래 진행 JSON·코인·장착 그대로, 차단을 해제하고 같은 버튼 재클릭으로 복구.
- 기존 회귀 `qa/polish.cjs` 단독 실행 5흐름 PASS(실제 음성·키보드·부분 장면·도움 중단·history/BFCache·첫 오답 보존). 첫 병렬 실행에서는 첫 MP3가 완료되지 않아 학습 진도를 올리지 않고 재시도 문구를 표시했고, 단독 재실행은 통과했다. 완료되지 않은 음성을 학습 완료로 처리하지 않았다. `qa/motivation-edges.cjs`의 첫 구매 한영·하루 한도·그림 체험도 다시 PASS.
- `shop=1` 우선·그림 체험 후 원래 진행/장착 격리 PASS. 기대한 503 외 앱 오류 없음. 준비/안내/실패 화면을 실제 320/390px에서 확인.
- [딥링크 결과](deeplink/results.json), [보유품 준비 320px](deeplink/owned-ready-320.png), [미보유 안내](deeplink/unowned-320.png), [음성 실패 재시도](deeplink/audio-failure-390.png).

허브 자체의 링크 선택/외부 배포 검증은 루트 담당 범위이며 이 기록은 말의 마법사 로컬 URL 수신과 사용 흐름의 증거다.
