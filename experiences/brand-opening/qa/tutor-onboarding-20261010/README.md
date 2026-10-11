# AI 튜터 첫 만남 · 로컬 검수

2026-10-10. [원문·현재 범위](../../HOME.md#첫-시작--함께할-ai-튜터-고르기). 첫 스타트에서 세 친구를 만나고, 앞으로 함께할 AI 튜터라는 역할을 이해하고 고르는 화면이다.

- [선택 화면](http://127.0.0.1:4314/mobile.html?opening=off&tutor=choose) · [오프닝부터](http://127.0.0.1:4314/mobile.html?opening=replay)
- [브라우저 결과](browser-result.json): **62개 통과**, JavaScript 오류·자료 누락·외부/유료 요청 0. `verify-tutors.cjs`를 실제 버튼으로 실행했다.
- `node --test experiences/brand-opening/qa/tutor-choice.test.mjs experiences/synk-world-app/qa/document.test.mjs`: **9개 통과**. 승인 카드 일치, 계정별 분리, 손상/미완료 기록, 저장 불가, 앱 경로/문서 계약을 확인했다.

검사한 흐름은 처음 스타트, 기본 선택 없음, 세 자기소개·응원·재도전 대사, 고정 몸/얼굴 반응, 반응 소리 켜기·닫기 정지, 두 단계의 미완료 상태, 완료 저장, 재진입 생략, 설정 변경 취소, 화면 회전 중 선택 유지, 키보드 초점 복귀, 원래 학습·독립 게임·첫 문장 놀이로 이어지기다. 로컬 합성 계정에 실제 로그인/로그아웃하여 비회원 선택이 계정으로 복사되지 않고 계정 선택이 로그아웃 뒤 노출되지 않는 것도 확인했다. 튜터 선택의 저장 위치는 이 기기이며 서버 보상·학습 진도와 합치지 않았다.

화면 크기는 390×844, 320×740, 322×704, 430×932, 가로 740×320·844×390, PC 1440×1000이다. 세로의 선택 버튼은 아래에서 유지하고, 작은 가로는 왼쪽의 세 친구·선택 버튼과 오른쪽의 소개 영역을 나눠 조작부가 가려지지 않게 했다. 44px 이상의 조작부, 가로 넘침 없음, 움직임 감소와 실제 이미지/서체 로딩을 확인했다.

대표 화면: [처음 만남](phone390-first-meeting.png), [마린](phone390-marin.png), [까몽](phone390-kkamong.png), [몽글](phone390-mongle.png), [두 번째 단계](phone390-welcome.png), [320px](phone320-marin.png), [작은 가로](landscape740-marin.png), [PC](desktop-marin.png). 캡처의 표정은 순간 반응/복귀 시점에 따라 달라진다. 승인 4K 자산에서 공통 영역을 잘라 480px WebP로 만들고 기존 WAV를 그대로 복사했다. 새 이미지·목소리 생성은 없다.

전용 로컬 확인 서버는 4314, DB는 `experiences/synk-world-app/.local/tutor-onboarding-20261010`이다. 기존 DB와 다른 작업의 서버를 덮어쓰지 않았다. 검수 중 이미 실행 중이던 4312 서버는 동시에 추가된 카페 모듈을 제공하지 못해 초기 확인이 중단됐다. 최신 서버 원본으로 분리 실행한 최종 62개 결과와 구분한다.

```powershell
$env:SYNK_WORLD_PORT='4314'
$env:SYNK_WORLD_MODE='rehearsal'
$env:SYNK_WORLD_DATA_DIR='C:/Users/q1212/Documents/SYNK-appsscript/experiences/synk-world-app/.local/tutor-onboarding-20261010'
node experiences/synk-world-app/server.mjs
# 다른 터미널
$env:SYNK_TUTOR_QA_URL='http://127.0.0.1:4314'
node experiences/brand-opening/qa/verify-tutors.cjs
```

실제 휴대폰, 운영 계정 두 기기 동기화, 유료 AI 대화·교정, 지속적인 튜터 행동의 개인화, 공개 배포는 이번 검수 범위에 포함하지 않는다. 비언어 소리의 브라우저 재생/정지는 확인했으며 새 청취 감수로 보고하지 않는다.
