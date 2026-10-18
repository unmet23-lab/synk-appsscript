# 현장 노트 · 영상·소리(ffmpeg·자막·HyperFrames·TTS)

> 판: ffmpeg 9.0(gyan.dev full) · HyperFrames 0.8.x(10-13 코드 읽음) · GSAP · faster-whisper(small·medium·large-v3-turbo, 이 PC CPU) · Vertex Gemini TTS · Typecast API
> 마지막 확인: 2026-10-17(대부분 10-02~10-13 실측)
> 쓴 AI: Claude Code(Claude Opus 5.5) — Claude 메모에서 옮김

영상 만드는 방법(장면을 한 번에 뽑기, 편집에서 덜어 내기, 톤)은 [만족 사례 장부](../마케팅/제작양식/만족사례_장부.md)가 정본이다. 편집 이음새는 S18, 모션그래픽은 S16·S17을 본다. 여기는 ffmpeg·렌더·목소리 도구가 오류 없이 틀린 결과를 낸 함정이다. 틀은 [README](README.md)를 따른다.

## ffmpeg 이음·자르기·음량

### xfade 사슬에서 소리는 끝까지 가는데 영상만 중간에 끊긴다
- 증상: 조립한 러프컷이 36.5초에서 영상만 끊기고 소리는 끝까지 간다. 종료 코드 0, 오류 없음(10-11).
- 원인: 클립 길이를 `ffprobe format=duration`(컨테이너, 소리가 더 길면 소리 길이)으로 재서 xfade offset을 잡았더니 첫 입력의 마지막 영상 프레임 뒤가 됐다. xfade는 첫 입력이 offset 전에 끝나면 둘째 입력을 받지 않고 그대로 끝난다.
- 고침: xfade·acrossfade 시간선의 클립 길이는 `ffprobe -select_streams v:0 -show_entries stream=duration`(영상 스트림)으로 잰다. 중간 파일을 만들 때도 `-t`를 영상 길이로 준다. 화면 글자(대사·자막·끝 카드)는 클립마다 overlay하지 말고 시간선을 만든 뒤 ASS 한 파일로 `subtitles=filename=…:fontsdir=…`에 마지막에 한 번 굽는다(글꼴 otf를 fontsdir에 복사, 한글 경로도 된다).
- 다시 확인: 조립 결과의 `ffprobe -count_packets -select_streams v:0 -show_entries stream=nb_read_packets`가 길이×fps와 같다. 길이만 보지 않는다 — `-ss` 탐색은 끊긴 파일에서도 마지막 프레임을 돌려줘 멈춘 것처럼 보인다.

### `-c copy`로 프레임 수를 맞춰 자르면 끝 몇 장이 빠지고 겹친다
- 증상: 361프레임 컷을 `-c copy -frames:v 358`로 잘랐더니 디코드하면 360장이고 356·358이 빠지고 357·359가 두 번씩이었다. 그 조각 때문에 완성본이 2프레임 짧은 VFR이 되고 자막이 컷보다 2프레임 먼저 떴다(10-12).
- 원인: x264 결과에는 B프레임이 있어 저장 순서와 화면 순서가 다르다. 패킷 N개에서 끊으면 화면 순서로는 중간이 빠진다. `-shortest`도 같다.
- 고침: 프레임 수를 맞춰 자를 땐 `-vf trim=start_frame=0:end_frame=N,setpts=PTS-STARTPTS -frames:v N`으로 다시 인코딩하고 소리는 따로 복사해 붙인다.
- 다시 확인: 완성본 `ffprobe -show_entries packet=pts_time`에서 1/fps가 아닌 간격이 0곳이고 프레임 수가 기준 판과 같다.

### `ffmpeg -ss`로 뽑은 확인 프레임이 한두 프레임 밀린다
- 증상: 이음새 확인 프레임이 실제 컷 자리와 달라 이음새를 잘못 봤다(10-14, 장부 S18 깨졌던 경우).
- 원인: `-ss` 시각 탐색은 키프레임·반올림 때문에 정확한 프레임을 보장하지 않는다.
- 고침: 확인 프레임은 프레임 번호로 뽑는다(`-vf "select=eq(n\,<번호>)" -fps_mode passthrough -frames:v 1`). ffmpeg 9에는 `-vsync`가 없다(「Unrecognized option 'vsync'」, 10-17). 같은 컷 안에서 자를 자리는 앞뒤 프레임의 회색 평균 차가 가장 작은 곳(1 이하)을 고른다(S18).
- 다시 확인: 같은 번호를 `select`와 `-ss`로 뽑아 견준다.

### 효과음·짧은 목소리만 띄엄띄엄 있는 믹스가 목표보다 작게 나온다
- 증상: 음악 없는 믹스가 `loudnorm … linear=true` 2패스 뒤 −15.4~−16.7 LUFS로 나온다(목표 −14). 같은 스크립트인데 편마다 2dB씩 달랐다(10-13).
- 원인: 크레스트가 커서 linear 모드가 목표 최대치를 못 지키고 조용히 dynamic으로 넘어간다.
- 고침: 1패스로 input_i를 잰 뒤 `volume=<-14 - input_i>dB,alimiter=limit=0.84:attack=1:release=60:level=false`(필요하면 limit 0.75)로 올린다. 음악이 깔린 믹스는 loudnorm 선형이 잘 된다. amix는 가장 긴 입력에서 끝나니 영상 길이만큼 `anullsrc`를 한 줄 더 섞어 길이를 채운다.
- 다시 확인: 최종 파일을 `ebur128=peak=true`로 다시 재서 −14.5±0.3 LUFS · 최대 −1.2 dBFS 안인지 본다.

## 렌더(HyperFrames·GSAP)

아래 HyperFrames 항목은 기존 영상 수정·재현의 기술 참고다. 새 영상의 도구는 [제작 도구 선택](../마케팅/콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 따른다.

### 보이는 값에서 시작하는 `fromTo`가 0초부터 보인다
- 증상: 30.9초에 나올 클릭 리플이 장면 내내 버튼 둘레에 떠 있다(10-13, 스냅샷·렌더 모두).
- 원인: GSAP `tl.fromTo(el, {opacity:1, …}, {…}, 30.9)`의 from은 immediateRender라 타임라인을 만드는 순간 적용된다. from이 opacity 0인 등장 효과는 문제없다.
- 고침: 보이는 값에서 시작하는 효과(리플·번쩍임)는 `tl.set(el, {opacity:1, scale:0.6}, t); tl.to(el, {opacity:0, scale:3, …}, t)`로 쓴다. 같은 요소에 CSS `transform`과 GSAP 변형을 같이 쓰면 hyperframes check가 `gsap_css_transform_conflict`로 막으니, 처음 상태는 CSS 대신 `tl.set(…, 0)`으로 준다.
- 다시 확인: 효과 시각 전의 snapshot 프레임에 그 요소가 안 보인다.

### snapshot·check·미리보기에서는 멀쩡한데 렌더에서만 그림이 404다
- 증상: 실땀 그림이 렌더에서만 빠진다(`[FileServer] 404`, 10-13 SNS 키트).
- 원인: snapshot·check·Studio 미리보기는 `bundleToSingleHtml`을 거쳐 링크 CSS를 `<style>`로 넣고 url()을 프로젝트 뿌리 기준으로 고친 뒤 그림을 data URL로 박는다(요청이 `GET /` 하나뿐). 렌더(compileForRender)는 로컬 CSS를 링크로 두어, 인라인 스타일 속 `var()`의 상대 url()을 Chrome이 문서 기준으로 풀다 404가 난다. Studio는 `/api/projects/<id>/preview/` 아래에서 열어 `/assets/…` 같은 루트 절대 경로가 어긋날 수 있다(코드만 읽음).
- 고침: 그림 경로를 건드린 수정은 `render --fps 10 --quality draft --format png-sequence -o <임시>`로 짧게 렌더해 프레임을 직접 본다. 404 수는 `NODE_OPTIONS=--require <훅.cjs>`로 센다(훅은 `http.Server.prototype.emit`을 감싸 'finish' 때 `statusCode url`을 파일에 적는다 — 렌더 파일 서버도 같은 프로세스라 잡힌다). snapshot의 `--describe`는 GEMINI_API_KEY가 있으면 유료 분석을 기본으로 돌리니 `--describe false`를 준다.
- 다시 확인: 짧은 png-sequence 렌더의 404 기록이 0줄이다.

### 멈춘 렌더 스크립트의 자식 프로세스가 살아남아 새 렌더와 겹친다
- 증상: 백그라운드 `bash render_v1.sh`를 멈추고 새로 돌렸더니 렌더가 두 벌 겹쳤다. 로그에 같은 판이 두 번 찍히고 출력 폴더에 `.<이름>.hf-transaction-*`가 남아, 어느 원고로 구운 mp4인지 알 수 없었다(10-11). 10-17 WORLD 측정에서는 멈춘 셸 돌림(`./final.sh`의 `for`)이 그대로 돌아 새로 띄운 돌림과 측정이 겹치고 같은 결과 파일을 서로 비웠다.
- 원인: Windows Git Bash에서 백그라운드 작업을 멈추면 맨 위 셸만 끝나고 그 아래 스크립트 셸(`sh.exe ./final.sh`)과 스크립트가 띄운 npx·node 자식은 남는다.
- 고침: 멈춘 뒤 `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`에서 CommandLine에 `hyperframes`·`render`가 든 것을 찾아 `taskkill /PID <npx pid> /T /F`로 끝낸다(Git Bash에서는 `//PID … //T //F`). 내가 띄운 것만 시작 시각으로 가린다. 출력 폴더의 `.hf-transaction-*`와 그때 나온 mp4는 지우고 다시 굽는다. 6분 넘는 렌더는 check → snapshot 프레임 확인을 마친 뒤 시작한다. 셸 돌림은 `Get-CimInstance Win32_Process | ? CommandLine -match '<스크립트 이름>'`으로 sh.exe·bash.exe까지 찾아 끝낸다.
- 다시 확인: 다시 굽기 전에 렌더 node 프로세스가 0개다. 셸 돌림이면 그 스크립트 이름이 든 프로세스도 0개다.

## 목소리·받아쓰기

### Gemini TTS가 영어 지시문을 소리로 읽거나 없는 말을 지어낸다
- 증상: 「Speak … as X. Say only the Korean words after the colon: 대사」 같은 한 줄 지시가 9줄 중 5줄에서 지시문까지 읽었고 1줄은 없는 말을 지어냈다(10-02). 연출 메모에 대본 문장을 인용하자(「'○○' is the key line」) 12개 중 7개가 그 문장으로 건너뛰거나 지어내거나 메모를 읽었다(10-04).
- 원인: 지시와 대본이 한 덩어리라 모델이 경계를 못 가른다.
- 고침: `### DIRECTOR'S NOTES (never read these notes aloud)` / `### TRANSCRIPT` 머리글로 가르고, 메모에는 대본 글을 넣지 않는다(18개 모두 정상). 숫자는 읽는 법이 갈리니(65살·3년·1층) 읽을 글을 따로 적는다. 10-04 Vertex에서 되는 모델: `gemini-3.8-flash-tts`(wav), `gemini-3.1-flash-tts-preview`, `gemini-2.5-pro-tts`, `gemini-2.5-flash-tts`(`gemini-3.8-pro-tts`는 없다).
- 다시 확인: 구운 뒤 받아쓰기로 확인한다(아래 받아쓰기 항목, 스크립트 보기 `experiences/entry-check/art-source/voice_check.py` — 로컬 faster-whisper, 0원). 길이가 글자 수에 비해 길면(초당 2.2자 미만) 지시문을 읽은 것이다.

### 대사를 줄마다 따로 구워 이으면 뚝뚝 끊긴다
- 증상: 한 줄씩 만들어 쉼을 넣어 이은 45초 나레이션을 유호님이 「흐름이 뚝뚝 끊기는 느낌」이라고 했다(10-04).
- 원인: 줄마다 억양이 새로 시작하고 「~했고,」 뒤에도 쉼이 들어간다.
- 고침: 대본 전체를 한 번에 읽힌 테이크 하나를 쓰고, 장면·자막은 받아쓰기 정렬로 찾은 낱말 시각에 붙인다. Gemini 테이크는 큰 소리 꼭대기가 잘려 나오니 `adeclip`으로 되살리고, 꼭대기가 평균보다 18dB 높아 그냥 키우면 넘치니 리미터로 눌러 크기를 맞춘다.
- 다시 확인: 받아쓰기 낱말 시각이 자막 시각과 맞는다.

### Typecast가 기호·낱말 하나를 엉뚱하게 읽는다
- 증상: 「/」를 「슬래시」로, 「화~일」을 「화일」로 읽는다. 낱말 하나 「년」·「년대」는 목소리를 바꿔도 「연」으로 읽는다(10-07 미니게임 2,856줄). 굽기 직후 잔량 변화는 글자당 0.47크레딧처럼 보였다.
- 원인: 기호를 글자 그대로 읽고, 낱말 하나짜리는 문맥이 없다. 잔량은 늦게 반영된다(실제는 1글자 1크레딧, 23,409자 → 23,409).
- 고침: 걸린 줄만 소리로 읽을 글을 따로 준다(화면 글자는 그대로). 낱말 끝에 마침표를 붙여 다시 구우면 흐린 낱말 19개 중 13개가 또렷해졌다. 굽기 비용은 글자 수로 미리 셈해 알린다. 도구는 `tools/미니게임_목소리.cjs`(키는 유호님이 이 PC에서 넣는다 — 키를 채팅으로 받지 않는다). 실제 길이는 어림보다 길다(「Nope!」 0.8초, 「Say it!」 1.0초) — 굽고 나서 길이를 재 배치·`atempo`(1.3배까지)로 맞춘다.
- 다시 확인: 받아쓰기로 걸린 줄을 다시 본다. 비용은 Typecast 잔량을 한참 뒤에 다시 읽는다.

### 효과음·킥이 말머리에 겹치면 첫 자음이 묻힌다
- 증상: 받아쓰기에서 「발이」가 「다리·파리」로 들렸다. 효과음 없는 같은 말은 정확했다(10-13, 장부 S17).
- 원인: 효과음·음악 구간 첫 킥·베이스가 첫 자음을 가린다. BGM −12dB로는 부족했다.
- 고침: 말하는 동안 효과음을 낮추고, 관용구 제목처럼 중요한 줄은 0.3초 전부터 BGM을 −24dB로 내린다.
- 다시 확인: 최종 믹스에서 줄마다 잘라 받아쓴다.

### 받아쓰기 small 판정이 자르는 자리마다 흔들린다
- 증상: 같은 믹스에서 faster-whisper small이 5번 중 2~3번만 맞다고 한다. 낱말 하나짜리는 받아쓰기 자체가 자주 틀린다(「코→cool」, 「너머/넘어」).
- 원인: small 모델이 짧은 구간·자르는 자리에 민감하다.
- 고침: small로 전부 훑고 걸린 줄만 자르는 자리 다섯 곳 × medium·large-v3-turbo로 다시 본다(둘 다 이 PC에 받아져 있다, CPU라 147줄에 20분 남짓). 옛 녹음과 나란히 받아써서 새 것만 크게 틀린 줄을 고른다. 숫자는 원문·받아쓰기 모두 읽기로 바꿔 견준다. 영어 줄은 `language: 'eng'`로 받아쓴다.
- 다시 확인: 판정을 바꾼 줄은 medium·large-v3-turbo 두 모델이 같은 결과다.

### 새로 만든 TTS 대사가 너무 작아 바탕에 묻힌다
- 증상: elevenlabs_v4의 한 목소리가 −37.6·−30.6 LUFS로 나왔다(다른 목소리는 −15~−18, 10-12).
- 원인: 목소리마다 출력 크기가 크게 다르다.
- 고침: 얹기 전에 LUFS를 재서 인사 −16, 대화 −23처럼 맞춘 사본을 쓴다. 원어민 대사는 `elevenlabs_v4`가 러·태·베트남어를 받아쓰기로 정확히 냈고, `qwen_audio_tts`는 일부 프리셋만 되며 태국어 남성에 여성 어미를 붙였다. 언어마다 whisper medium으로 언어 지정·자동 두 번 받아써 고른다.
- 다시 확인: 얹은 사본의 `ebur128` 값.

### HyperFrames carve가 말 사이 음악까지 계속 누른다
- 증상: 짧은 대사 9줄인 22초 편에서 0.5초부터 끝까지 음악이 약 −13dB로 눌려, 말 사이 구간이 목소리 없는 판보다 5dB 작았다(10-03).
- 원인: carve의 전체 크기 맞춤 단계(fromCarve `gain`)가 일부러 천천히 돌아온다.
- 고침: carve의 목소리 대역 칸(말을 따라 바로 돌아옴)은 두고 크기 맞춤 단계만 빼고, 말할 때만 −8dB · 말끝 0.15초 뒤부터 0.45초에 걸쳐 원래대로 · 1초보다 짧은 틈은 낮춘 채 두는 duck 단계를 직접 쓴다. 대사는 `data-start = 첫 말소리 시각 − 파일 앞 무음`으로 놓는다(carve는 `data-media-start`를 무시한다). 앞뒤 파일이 겹치면 트랙을 번갈아 둔다(같은 트랙에서 겹치면 `duplicate_audio_track` 경고). `@hyperframes/core`는 저장소에 깔지 않고 임시 폴더에 깔아 `--core`로 준다. 한 번에 하는 보기 스크립트는 `docs/마케팅/LAB_한글날_내이름한글로_20261002/음성/넣기.cjs`.
- 다시 확인: 말 사이 구간의 크기를 목소리 없는 판과 구간별로 견준다(+0.5dB 안).

## 렌더 장비

### 무거운 렌더를 이 PC에서 몇 시간 돌리기 전에 빌려 쓰는 길이 있다
- 증상: 블렌더 450장을 이 PC에서 3시간 25분 돌려 PC가 렉이 났다(10-08). 허깅페이스 Jobs는 「Pre-paid credit balance is insufficient」 402로 거절됐다(10-08·10-14, 잔액 0).
- 원인: Jobs는 선불 잔액에서 분 단위로 빠진다(10-11 공식 요금표: CPU Upgrade $0.03/h, T4 $0.40, L4 $0.80, RTX PRO 6000 $2.75, 시작·받기 4~6분도 값에 든다). 잔액 충전은 결제라 유호님 몫이다. 거절돼도 `-v` 폴더는 먼저 버킷에 올라간다.
- 고침: 한 시간 넘는 렌더 전에 장비별 어림값을 보여 주고 잔액이 있는지 묻는다. 잔액이 0이면 유호님이 말하는 「구독 무료 GPU(30~40분)」인 ZeroGPU 길이 기본이다: Blender 짓기·내보내기는 이 PC에서 `render=0`으로(10초 안팎) → 카메라별 .blend → `docs/마케팅/한강2126_포트폴리오_20260930/blender/render_zerogpu.py`(결과 폴더가 고정이라 `--out`을 붙인 사본으로)로 장당 GPU 5초·왕복 30~40초. 남은 할당량 읽기는 [아래 항목](#zerogpu-남은-할당량은-결제-페이지-데이터에-초-단위로-있다). 남의 Space라 얼굴·고객 자료는 올리지 않는다. Jobs를 Git Bash에서 띄우면 `-v` 경로가 깨지니 PowerShell로 띄운다([윈도우 셸 노트](윈도우_셸.md#로-시작하는-인자가-윈도우-경로로-바뀐다)).
- 다시 확인: Jobs는 L4 10장 시험으로 장당 시간을 먼저 잰다(장당 GPU 시간은 아직 어림값이다).
