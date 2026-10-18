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

### 앱 CSS를 Remotion에 그대로 넣으면 휴대폰 규칙과 vw가 영상 창 기준으로 풀린다
- 증상: 10-17 AI 구독 계정판 CSS(`desktop/renderer/subscriptions.css`)를 영상에 넣었더니 휴대폰 폭 배치(`@media (max-width:760px)`)가 걸리지 않고, `clamp(…vw…)` 글자는 앱보다 커졌다. 같은 날 앱 CSS가 세 번 바뀌어 손으로 고친 사본은 금방 낡았다.
- 원인: Remotion 페이지 창은 1080 폭이라 미디어 쿼리와 vw가 앱 창이 아니라 영상 창을 본다.
- 고침: `docs/마케팅/synkbrief_AI구독계정판_20261017/remotion/scripts/board-css.mjs`가 앱 CSS에서 영상용 CSS를 만든다. 휴대폰 규칙은 `.member-subs.ms-phone` 아래로 옮기고, vw·vh는 앱 창 크기 변수(휴대폰 `--ms-vw:5.4px`, PC `12.8px`)로 바꾼다. 앱 CSS가 바뀌면 다시 돌린다. 앱이 CSS 애니메이션으로 하는 움직임(고리 그리기·숫자 굴림)은 같은 곡선·길이를 `useCurrentFrame()`으로 옮겨 쓴다(`src/v5/gauge.tsx`).
- 다시 확인: `node scripts/board-css.mjs` 뒤 `grep -c "ms-phone" src/board.css`가 0보다 크고 `grep -nE "[0-9]v[wh]" src/board.css`가 빈다.

### Remotion은 소리를 16비트로 더해 0 dBFS 넘는 표본을 그 자리에서 자른다
- 증상: 10-18 synkbrief 「AI 구독 계정판」에 나레이션(Typecast −17 LUFS, 1.0)을 얹고 배경음 0.16·효과음과 렌더했더니 잘린 표본이 47개(2.2·17.1·28.4초, 말 봉우리) 나왔다. 나레이션 없는 판은 0개였다. 렌더 뒤 리미터로 봉우리를 누르는 마감만으로는 이미 잘린 소리가 돌아오지 않는다.
- 원인: Remotion은 트랙을 `amix=…:dropout_transition=0:normalize=0`으로 더해 `pcm_s16le`로 쓴다(`node_modules/@remotion/renderer/dist/create-ffmpeg-merge-filter.js`·`merge-audio-track.js`). 합이 1.0을 넘는 표본은 16비트로 바뀌며 잘린다.
- 고침: 영상 안 모든 `volume`(배경음·나레이션·효과음)에 같은 MASTER 0.8(−1.9dB)을 곱했다 → 잘린 표본 0 · −16.9 LUFS · −1.5 dBFS. 크기는 마감에서 되올린다(+2.4dB, 리미터 0.89 → −14.6 LUFS · −1.0 dBFS). 휴대폰판(96k)은 마감본을 다시 누르면 봉우리가 −0.4까지 솟아 렌더 원본에서 리미터 0.84로 따로 뽑는다. 보기 `docs/마케팅/synkbrief_AI구독계정판_20261017/remotion/src/full/Film.tsx`(MASTER)·`scripts/finish.mjs`.
- 다시 확인: 마감 전 렌더 소리를 16비트로 풀어(`ffmpeg -i x.mp4 -vn -f s16le -`) 절댓값 32700 넘는 표본을 numpy로 센다. 0이어야 한다.

### inline-flex로 묶은 글줄은 낱말 사이 빈칸이 사라진다
- 증상: 10-18 영상용 한 줄 목록의 값 칸(`display:inline-flex` 안에 `주간 <b>62%</b> 남음`)이 「주간 62%남음」으로 찍혔다.
- 원인: flex 상자 안에서는 글 조각과 요소가 각각 flex 항목이 되고, 항목 끝의 빈칸은 접힌다.
- 고침: 값 칸은 보통 글줄(`white-space:nowrap`)로 두고, 작은 고리는 앱 CSS의 `vertical-align`으로 맞춘다.
- 다시 확인: 정지컷에서 「62% 남음」 사이가 띄어져 있는지 본다.

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
- 10-17 더한 경우(synkbrief 「GPTs·젬」, 범수 1.12배): 짧은 외래어가 문장 머리에서 빨리 지나가면 묻힌다. 「그럼 젬은요?」는 받아쓰기(faster-whisper medium)에 「그럼 쟤는요?」, 「젬은 네.」는 「재문 내」로 나왔다. 앞에 맥락 낱말을 붙이고(「그럼, 제미나이 젬은요?」) 쉼표로 숨을 주면(「젬은, 네.」) 「재미나이잼은요」·「GEM은」으로 또렷해졌다. 「GPTs」는 「지피티즈」가 「GPTG」로 뭉개져 「지피티에스」로 읽혔다(받아쓰기 「GPTS」).

### 새 노트북에는 Typecast 키 파일이 없다
- 증상: 10-17 `docs/마케팅/synkbrief_GPTs젬_스킬전환_20261017/소리/나레이션.mjs`가 `~/SYNK_보안/타입캐스트.txt`를 못 찾았다(같은 경로를 `tools/미니게임_목소리.cjs`·`tools/한글단계_목소리.cjs`도 쓴다).
- 원인: 노트북 옮기기(10-17)에서 `SYNK_보안` 폴더가 넘어오지 않았다.
- 고침: 막다른 길 — 키는 비밀값이라 AI가 옛 노트북에서 찾아 옮기지 않는다. 유호님이 `C:/Users/q1212/SYNK_보안/타입캐스트.txt`에 넣으면 된다(옛 노트북은 10-31까지). 10-17 15:51에 키 파일이 들어와 지금은 된다(같은 날 16시 yuhobuilds 세션 공유 편 범수 굽기 성공). 10-17에는 PowerShell로 폴더와 빈 파일을 만들고(`New-Item`은 파일이 없을 때만) `Start-Process notepad.exe <파일>`로 메모장을 띄워 드렸더니, 유호님이 붙여 넣고 저장해서 바로 풀렸다(키 값은 읽지 않는다).
- 다시 확인: PowerShell `Test-Path "$env:USERPROFILE\SYNK_보안\타입캐스트.txt"`, 그다음 `--시험`처럼 짧은 굽기가 지나가는지 본다.
- 10-17 더한 것: LAB 관용구 퀴즈 `나레이션.cjs`의 원본 캐시(`Documents/synk-vendor/lab-topik-narration/raw/`)도 새 PC에 없어서, 첫 편에서 산 「Three!」「Nope!」 같은 줄도 다시 샀다(관용구 퀴즈 #2 v4 두 판 277자). 캐시 폴더는 굽기 때 새로 생긴다.

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

### 새 노트북(RTX 5090 24GB)은 블렌더 한 장이 ZeroGPU보다 빠르다
- 증상: 10-08·10-14의 「로컬은 느리니 ZeroGPU로」 판단은 옛 노트북 기준이었다(10-08 450장 3시간 25분 렉).
- 원인: 10-16 리전 프로 7(RTX 5090 Laptop 24GB, OptiX)로 옮겼다. 10-18 같은 장면·같은 설정으로 다시 잼(펠트 찻집 `.tmp/argon-blender-20261017/scene_v3.blend`, 물체 211·면 8.9만, Cycles). 1024² 샘플 72: 로컬 렌더 5.3~5.6초(블렌더 띄우기 포함 7초) 대 ZeroGPU 9.8초(올리고 받기 포함 왕복 35초). 1080×1920 샘플 512: 로컬 16~22초(18~25초) 대 ZeroGPU 19.3초(49초). 결과 그림은 같다(평균 화소 차이 0.52/255). ZeroGPU Space는 반쪽 RTX Pro 6000에서 CUDA로 그린다.
- 고침: 블렌더 렌더는 로컬이 기본이다. ZeroGPU(`cpuai/blender-render-studio`)는 노트북을 다른 일에 비워 둬야 할 때, 로컬과 나눠 동시에 돌릴 때만 쓴다(하루 40분이면 무거운 컷 약 120장). 재는 도구 `.tmp/bench-5090-local/cafe/render_local.py`·`render_zerogpu.py`.
- 다시 확인: 같은 .blend를 `render_local.py`와 `render_zerogpu.py`로 한 번씩 돌려 렌더 초를 견준다.

### 남의 이미지·업스케일 Space는 GPU 몇 초에 왕복 몇 분이고, 공식 SeedVR2 Space는 깨져 있다
- 증상: 10-18 같은 긴 캡션·시드 42·1024²로 잼. FLUX 3 Klein 공식 Space(`black-forest-labs/flux-3-image-klein`) 세 장이 할당량 22.9초(장당 GPU 6~8초)인데 왕복은 141~251초였다. Qwen-Image 2.1 Turbo(`hugging-apps/qwen-qwen-image-2-1-turbo`) 세 장은 11.2초(장당 3.7초)에 왕복 126~193초였다. SeedVR2 공식 Space(`ByteDance-Seed/SeedVR2-3B`)와 `Lennox9898/SeedVR2-3B`는 영상·그림 모두 `AppError RuntimeError`, 그림은 `Upsampler/seedvr2-3b`만 됐다(480×854 → 1072×1920, 왕복 61초). 실패한 호출도 할당량을 썼다(SeedVR2 넷에 21.6초).
- 원인: 왕복의 대부분은 인기 Space 대기열과 우리 망(다른 세션 내려받기와 나눠 씀)이다. 공식 SeedVR2 Space는 2025-08판으로 flash-attn·apex 리눅스 바퀴를 실행 중에 깔아 쓰는데, ZeroGPU가 RTX Pro 6000 Blackwell(sm120)로 바뀐 뒤 맞지 않는 것으로 보인다(추정).
- 고침: 남의 Space는 「GPU 몇 초 + 대기열」로 어림하고, 많이 돌릴 일은 복제하거나 로컬로. Qwen-Image Space의 `resolution`은 글자가 아니라 숫자(1024)다. 망이 붐빌 때는 `httpx_kwargs={"timeout": httpx.Timeout(600)}`을 준다. SeedVR2 영상은 지금 ZeroGPU 공개 Space로는 안 되니 로컬 ComfyUI 노드로 한다. 도구 `.tmp/bench-5090-local/image/zerogpu_image_bench.py`·`upscale/zerogpu_seedvr2_alt.py`.
- 다시 확인: `HfApi().get_space_runtime("ByteDance-Seed/SeedVR2-3B")`가 RUNNING이어도 그림 한 장을 넣어 RuntimeError인지 본다.

### FLUX 3 Klein·SeedVR2도 새 노트북 로컬이 기본이고, FLUX 공식 Space는 지시문을 늘 늘린다
- 증상: 10-18 ZeroGPU FLUX 그림과 로컬 그림을 같은 지시문으로 견주려 했는데, Space가 돌려준 세 번째 값(모델이 본 캡션)이 우리 지시문이 아니라 230~260단어로 늘린 글이었다. `prompt_upsampling=False`를 줬는데도 그랬다.
- 원인: 공식 Space(`black-forest-labs/flux-3-image-klein`) `app.py`가 10-17부터 지시문 확장기(PUP, temperature 0)를 늘 돌리고 `prompt_upsampling`은 무시한다. 확장은 GPU 밖이라 할당량은 안 쓴다. 같은 시드면 그림이 화소까지 같다(두 번 돌려 차이 0).
- 고침: 로컬 비교는 Space가 돌려준 캡션 전문으로 한다(`.tmp/bench-5090-local/image/zerogpu_flux_caption.py` → `captions_flux.json`). 10-18 로컬 RTX 5090 수치: FLUX 3 Klein nvfp4 + qwen3vl int8(ComfyUI API, `local_flux_comfy.py`) 1024²·16단계 한 장 6.7~7.6초, 처음 적재 18초, VRAM 최대 11.9GB. 같은 캡션이면 구도·질감이 ZeroGPU판과 거의 같다(평균 화소 차이 10~13/255, nvfp4 탓). ZeroGPU는 같은 장이 왕복 66~83초. SeedVR2-3B fp16(노드 CLI, `upscale/run_local_seedvr2.sh`): 그림 480×854 → 1072 한 장 전체 37초(파이썬 띄우기·적재 포함, 계산 약 8초, 9.4GB). 영상 4초 97프레임 → 720p 131초, → 1080p(`--vae_encode_tiled --vae_decode_tiled`) 312초, 둘 다 batch 33에 VRAM 23GB 가까이 차고 VAE 디코딩이 시간의 절반을 넘는다. Upsampler Space 그림은 로컬보다 또렷하지만 주근깨·눈매를 더 지어낸다.
- 다시 확인: ComfyUI를 남의 8188과 겹치지 않게 `--port 8190`으로 띄워 `local_flux_comfy.py captions_flux.json <폴더>`를 돌리고, 끝나면 그 프로세스를 끄고 GPU를 쓰는 세션에 알린다.

### 큰 모델 내려받기가 0바이트에서 멈추거나 끊기면 조각이 지워진다
- 증상: 10-18 다른 세션이 `hf download`·병렬 내려받기로 큰 모델을 받는 동안, 이쪽 `hf_hub_download`·`hf download`가 몇 분째 0바이트였다(xet). xet를 끄자 초당 6MB로 받았지만, 잠깐 주소를 못 찾자(`getaddrinfo failed`) 받던 5.5GB 조각이 사라졌다. 세 세션이 함께 받을 때 회선 전체가 초당 10MB 안팎이었다.
- 원인: xet 내려받기가 같은 PC의 다른 xet·병렬 내려받기에 밀려 시작하지 못한 것으로 보인다(추정). 조각이 지워진 까닭은 모른다.
- 고침: `HF_HUB_DISABLE_XET=1 hf download …`로 받고, 끊겨도 다시 시도하는 반복으로 감싼다(`C:/SYNK-LoRA/models/get_flux.sh`). 큰 내려받기 전에 `ListAgents`와 `Get-NetTCPConnection`으로 같은 시각에 받는 세션이 있는지 보고, 있으면 순서를 맞춘다.
- 다시 확인: `find <local-dir>/.cache -name "*.incomplete" -printf "%s\n"`을 20초 간격으로 두 번 재서 늘어나는지 본다.

### ComfyUI 노드 패키지를 남이 쓰는 ComfyUI 환경에 깔지 않고 따로 돌린다
- 증상: SeedVR2 노드(`ComfyUI-SeedVR2_VideoUpscaler`)를 ComfyUI 가상환경에 깔면 huggingface_hub·diffusers·peft 등 20개가 바뀐다(10-18 미리 보기). 그 ComfyUI는 다른 세션이 띄워 쓰고 있었다. 노드의 `inference_cli.py`는 한국어 콘솔에서 `UnicodeEncodeError: 'cp949'`로 멈췄다.
- 원인: 노드 requirements가 그 판들을 요구한다. 노드가 이모지를 찍는다.
- 고침: 모자란 패키지만 `pip install --no-deps --target C:/SYNK-LoRA/tools/seedvr2-extra <패키지==판…>`으로 따로 깔고, `PYTHONPATH`로 그 폴더를 붙여 `PYTHONIOENCODING=utf-8 venv/Scripts/python.exe -X utf8 custom_nodes/ComfyUI-SeedVR2_VideoUpscaler/inference_cli.py`로 돌린다. ComfyUI 서버를 다시 켤 필요가 없다. 가중치는 `ComfyUI/models/SEEDVR2/`(numz/SeedVR2_comfyUI의 fp16·fp8).
- 다시 확인: `--help`가 뜨는지, 뜰 때 「SageAttention ❌ | Flash Attention ❌」 줄(윈도우는 sdpa로 돈다)을 본다.

### 무거운 렌더를 이 PC에서 몇 시간 돌리기 전에 빌려 쓰는 길이 있다
- 증상: 블렌더 450장을 옛 노트북에서 3시간 25분 돌려 PC가 렉이 났다(10-08, 새 노트북 수치는 위 항목). 허깅페이스 Jobs는 「Pre-paid credit balance is insufficient」 402로 거절됐다(10-08·10-14, 잔액 0).
- 원인: Jobs는 선불 잔액에서 분 단위로 빠진다(10-11 공식 요금표: CPU Upgrade $0.03/h, T4 $0.40, L4 $0.80, RTX PRO 6000 $2.75, 시작·받기 4~6분도 값에 든다). 잔액 충전은 결제라 유호님 몫이다. 거절돼도 `-v` 폴더는 먼저 버킷에 올라간다.
- 고침: 한 시간 넘는 렌더 전에 장비별 어림값을 보여 주고 잔액이 있는지 묻는다. 잔액이 0이면 유호님이 말하는 「구독 무료 GPU(30~40분)」인 ZeroGPU 길이 기본이다: Blender 짓기·내보내기는 이 PC에서 `render=0`으로(10초 안팎) → 카메라별 .blend → `docs/마케팅/한강2126_포트폴리오_20260930/blender/render_zerogpu.py`(결과 폴더가 고정이라 `--out`을 붙인 사본으로)로 장당 GPU 5초·왕복 30~40초. 남은 할당량 읽기는 [아래 항목](#zerogpu-남은-할당량은-결제-페이지-데이터에-초-단위로-있다). 남의 Space라 얼굴·고객 자료는 올리지 않는다. Jobs를 Git Bash에서 띄우면 `-v` 경로가 깨지니 PowerShell로 띄운다([윈도우 셸 노트](윈도우_셸.md#로-시작하는-인자가-윈도우-경로로-바뀐다)).
- 다시 확인: Jobs는 L4 10장 시험으로 장당 시간을 먼저 잰다(장당 GPU 시간은 아직 어림값이다).

### 남의 ZeroGPU Space를 복제하면 빌드가 spaces 판 충돌로 실패한다
- 증상: 10-17 `Pepe104/MiniMax-H3-Turbo-Lora-UNCENSORED`·`multimodalart/qwen3vl-conditioner`를 비공개로 복제하자 둘 다 BUILD_ERROR, 「Cannot install spaces==0.51.1 and spaces==0.51.3」.
- 원인: 빌더가 pip 줄에 자기 판 `spaces==0.51.3`을 덧붙이는데 원본 requirements.txt가 `spaces==0.51.1`로 묶여 있다. 원본은 예전에 빌드한 이미지로 돌아서 멀쩡하다.
- 고침: 복제본 requirements.txt에서 `spaces==` 줄을 빼고 다시 올린다. 빌드·실행 기록은 `GET https://huggingface.co/api/spaces/<id>/logs/build`(실행은 `/logs/run`, 토큰 헤더, SSE).
- 다시 확인: `HfApi().get_space_runtime(id).stage`가 RUNNING.

### 둘로 나뉜 ZeroGPU Space를 둘 다 비공개로 두면 앞쪽이 뒤쪽을 못 부른다
- 증상: MiniMax-H3 생성 Space는 조건 Space를 `gradio_client.Client(id, headers={"x-ip-token": …})`로 토큰 없이 부른다. 둘 다 비공개면 막힌다.
- 원인: Space 안에는 토큰이 없다(Secrets에 HF_TOKEN을 넣어야 하고, 토큰 입력은 유호님 몫).
- 고침: 생성 Space 복제본에 조건값 파일을 직접 받는 `generate_from_embeds` 입구를 더하고, 이 PC에서 조건 `/encode` → 생성 `/generate_from_embeds`를 차례로 부른다(`.tmp/h3-rehearsal-20261017/run_h3.py`). 로컬 로그인 토큰으로 부른 두 호출 모두 유호님 할당량에서 빠진다(조건 Space 기록 「the caller's own quota」).
- 다시 확인: 조건 Space 실행 기록의 `[cond] /encode on …` 줄.

### ZeroGPU 남은 할당량은 결제 페이지 데이터에 초 단위로 있다
- 증상: 「남은 할당량은 API로 안 나온다」로 알고 있었다(10-14).
- 원인: 크롬 로그인 `huggingface.co/settings/billing` 화면은 분 단위(0/40분)지만, 페이지 `data-props` 안 `"zeroGpu":{"current":<남은 초>,"base":2400,"resetsAt":…}`는 초 단위다. 차감은 예약 시간이 아니라 실제 GPU 초 × 크기 배수(xlarge 2배)다: 10-17 조건 7.5초 → 14.8초, 생성 109초 → 218.1초. 다 쓰면 선불 잔액에서 자동으로 빠진다(10분 $1). `resetsAt`은 첫 사용 24시간 뒤.
- 고침: 돌리기 전후로 결제 페이지를 새로 열어 zeroGpu.current를 읽고 뺀다.
- 다시 확인: 같은 읽기를 한 번 더 해 current가 줄었는지 본다.
