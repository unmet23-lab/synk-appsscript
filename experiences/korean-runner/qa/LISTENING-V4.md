# 바람길 v4 · 듣기 전용 액션 검증

2026-10-02 · 로컬 http://127.0.0.1:4273/ · Codex in-app browser. v3 검증/ZIP은 보존한다.

## 반영한 사용자 요청

타이밍이 중요한 달리기 중에는 글 읽기를 요구하지 않는다. 짧은 한국어 목소리를 듣고 방향·점프·숙이기·하지 않기·순서를 몸으로 수행한다. 큰 지시문 패널/뜻/보기/인게임 다시 듣기와 guide/read 선택을 제거했다. 작은 중립 스피커·순서 번호·접근 막대 및 아이콘/효과음 피드백만 둔다. 글·뜻·동작 안내는 시작 전 선택 연습과 종료 후 복습에 있다.

## 확인 결과

- `node --test core.test.mjs controls.test.mjs audio.test.mjs` **19개 통과**. 기존 물리·방향·부정·순서·표시선 타이밍·100seed 접근 구간·10seed 전체 시연·가운데 복귀 16검사와 전체 음성 준비/누락 재시도·소스/위치 보존·다음 음성 교체 3검사.
- 브라우저 16개 MP3 모두 decode·재생 준비. 시작 전 left/jump 표현의 소리 ID와 재생 위치, 종료 후 left 다시 듣기 확인. 직접 청취로 발음/음질을 평가한 증거는 아니다.
- 실제 90초 자동 시연: elapsed90.0006초,1392.8038m,부탁10/10,표시선13,보호3/바람막1. 부정과 두 동작 순서 포함. 모든 기록 learning=listen. 시연 best=0 유지. 봇은 정답과 동작을 알고 움직이므로 학생의 언어 이해/학습 효과나 사람의 직접 완주 증거가 아니다.
- 음성 중간 일시정지: slide0.669333초에서 AudioContext=suspended, 게임 elapsed28.2188초. 다음 관측에도 두 값이 정확히 같음. 재개 후 같은 slide ID가0.829333초로 이어지고 모델 시간도 진행. 지시를 처음부터 반복하지 않음.
- 설정 중 일시정지: left0.312초와 게임 시간이 그대로 유지, 설정 닫은 뒤 같은 left0.52초로 이어짐.
- 실행 중 음소거: sound=false,paused=true,AudioContext=suspended. 지시문을 표시하지 않음. ‘소리 켜고 계속 달리기’ 뒤 sound=true와 게임/음성 재개.
- CDP Network로 MP3만 일시 차단해 실패 재현: clips0,running=false,learning=listen,재시도 패널. 차단 해제 후 재시도로 clips16,running=true,left 음성 재생. 테스트 차단은 해제했다.
- 직접 터치: 좌→우→우→좌에서 lane0→1→2→1, jump y1.40639,slide0.67. 직접 키보드 ArrowLeft→ArrowRight→ArrowRight→ArrowLeft도0→1→2→1. 테스트 회차는 종료 결과 전에 홈으로 돌아가 개인 기록을 만들지 않음.
- 1280×720,390×844,320×668,844×390에서 시작/실행 또는 연습/복습 확인. 좁은 화면 터치 버튼·작은 음성 표시가 길을 가리지 않음. 가로 연습 화면을 2열로 보완해 다시 듣기/이전·다음/돌아가기 모두 보임. 실제 휴대폰의 터치·성능 검증은 아니다.
- 최종 DOM: `question` 없음,`data-learning` 선택0개,HUD에 지시문/해설 없음. 최종 브라우저 콘솔 오류·경고0. 뷰포트 임시 설정은 복원하고 사용자 화면은 v4 시작 화면으로 남김.
- 런타임 HTTP 자산은 `v4-runtime-assets.json`에 상태·크기·SHA와 로컬 바이트 일치를 기록. MP316개 MIME=audio/mpeg.

## 증거 파일

- `v4-full-run.json`: 전체 시연 수행 기록.
- `v4-pause-resume.json`,`v4-settings-resume.json`,`v4-mute.json`: 시간/음성 상태.
- `v4-audio-retry.json`,`v4-audio-failure.jpg`: 실패 시 중지와 재시도.
- `v4-key-controls.json`,`v4-touch-controls.json`,`v4-ui-audit.json`: 직접 입력과 지시문 제거.
- `v4-play-desktop.jpg`,`v4-play-390.jpg`,`v4-play-320.jpg`,`v4-play-landscape.jpg`: 실제 플레이 화면.
- `v4-practice-desktop.jpg`,`v4-practice-320.jpg`,`v4-practice-landscape.jpg`: 시작 전 표현 연습.
- `v4-result-390.jpg`,`v4-result-320.jpg`: 종료 후 복습.

## 전달과 학습 설명

`../korean-runner-play-20261002-v4.zip`은 새 파일로 생성하며 CRC와 모든 포함 파일의 바이트를 대조한다. 결과는 `v4-package.json`에 기록한다. 이전 v1~v3 전달물과 다른 저장소 변경은 보존한다.

홍보 정본은 `../README.md`. TOPIK I 짧은 지시 **듣기**의 방향·위치·동작·부정·순서 이해를 보조하는 연습이다. 읽기는 사전/사후 문장 뜻 확인 단계다. 쓰기·말하기·장문 읽기·대화 전체 듣기를 직접 연습하지 않으며 수행 점수는 이해도/공식 급수/합격 점수가 아니다. 교원 검수·학생 효과·장기 기억·TOPIK 점수 변화·Atlas 계정 연결·공개 배포·실기기 성능은 검증하지 않았다.
