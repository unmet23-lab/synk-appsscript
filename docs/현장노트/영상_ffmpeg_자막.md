# 현장 노트 · 영상·소리(ffmpeg·자막·HyperFrames·TTS)

> 판: ffmpeg 9.0(gyan.dev full) · HyperFrames 0.8.x(10-13 코드 읽음) · GSAP · faster-whisper(small·medium·large-v3-turbo, 이 PC CPU) · Vertex Gemini TTS · Typecast API
> 마지막 확인: 2026-10-20(대부분 10-02~10-13 실측, Remotion 판 전환·경로 줄바꿈 10-18, 받아쓰기 말끝·CUDA 10-20)
> 쓴 AI: Claude Code(Claude Opus 5.5) — Claude 메모에서 옮김

영상 만드는 방법(장면을 한 번에 뽑기, 편집에서 덜어 내기, 톤)은 [만족 사례 장부](../마케팅/제작양식/만족사례_장부.md)가 정본이다. 편집 이음새는 S18, 모션그래픽은 S16·S17을 본다. 여기는 ffmpeg·렌더·목소리 도구가 오류 없이 틀린 결과를 낸 함정이다. 틀은 [README](README.md)를 따른다.

## 먼저 볼 것

> 도구를 쓰기 전에 여기와 목차만 읽고, 걸리는 절은 `rg -n "^###" docs/현장노트/영상_ffmpeg_자막.md`로 제목을 찾아 그 항목만 읽는다.

- xfade 시간선을 컨테이너 길이로 잡으면 영상만 중간에 끊긴다 → 클립 길이는 영상 스트림(`ffprobe … v:0`)으로 잰다 ([자세히](#xfade-사슬에서-소리는-끝까지-가는데-영상만-중간에-끊긴다))
- `-c copy`·`-shortest`로 자르면 끝 프레임이 빠지고 겹친다 → `trim`으로 다시 인코딩하고 길이는 `-t`로 준다 ([자세히](#-c-copy로-프레임-수를-맞춰-자르면-끝-몇-장이-빠지고-겹친다))
- `ffmpeg -ss`로 뽑은 확인 프레임은 한두 장 밀린다 → `select=eq(n\,<번호>)`로 프레임 번호로 뽑는다 ([자세히](#ffmpeg--ss로-뽑은-확인-프레임이-한두-프레임-밀린다))
- bt709 표시만 붙이면 붉은 기가 돌고, 다시 인코딩하며 붙이면 어두워진다 → 첫 인코딩부터 `scale=out_color_matrix=bt709` ([자세히](#다시-인코딩하며-bt709-표시를-붙이면-화면이-26단계-어두워지고-표시만-붙이면-붉은색이-뜬다))
- 효과음·킥이 말머리에 겹치면 첫 자음이 묻힌다 → 그 박의 효과음을 빼고 말하는 동안 BGM을 −16~−24dB로 낮춘다 ([자세히](#효과음킥이-말머리에-겹치면-첫-자음이-묻힌다))
- Typecast가 기호·낱말을 엉뚱하게 읽는다 → 받아쓰기로 확인하고 걸린 줄만 소리용 글을 따로 준다 ([자세히](#typecast가-기호낱말-하나를-엉뚱하게-읽는다))
- Remotion은 합친 소리가 0dBFS를 넘으면 그 자리에서 잘라 낸다 → 모든 `volume`에 같은 마스터 값(0.8)을 곱한다 ([자세히](#remotion은-소리를-16비트로-더해-0-dbfs-넘는-표본을-그-자리에서-자른다))
- 멈춘 렌더의 자식 프로세스가 살아남아 새 렌더와 겹친다 → 멈춘 뒤 `taskkill /PID <pid> /T /F`로 끝낸다 ([자세히](#멈춘-렌더-스크립트의-자식-프로세스가-살아남아-새-렌더와-겹친다))
- GPU 작업 전에 `nvidia-smi`를 안 보면 남의 작업과 부딪친다 → 먼저 보고, 오래 잡혀 있으면 ZeroGPU로 돌린다 ([자세히](#노트북-gpu가-다른-작업에-오래-잡혀-있으면-기다리지-말고-zerogpu로-돌린다))
- 남이 쓰는 ComfyUI 환경에 노드를 깔면 패키지 수십 개가 바뀐다 → `--no-deps --target`으로 따로 깔아 돌린다 ([자세히](#comfyui-노드-패키지를-남이-쓰는-comfyui-환경에-깔지-않고-따로-돌린다))

## 목차

[공용 도구 · 회차마다 복사하지 않는다(2026-10-19)](#공용-도구--회차마다-복사하지-않는다2026-10-19) · [ffmpeg 이음·자르기·음량](#ffmpeg-이음자르기음량) · [색 맞춤(LUT·bt709 표시)](#색-맞춤lutbt709-표시) · [렌더(HyperFrames·GSAP)](#렌더hyperframesgsap) · [렌더(Remotion·Playwright)](#렌더remotionplaywright) · [목소리·받아쓰기](#목소리받아쓰기) · [렌더 장비](#렌더-장비) · [블렌더 장면·회색 미리보기](#블렌더-장면회색-미리보기) · [로컬 AI 도구 깔기·돌리기](#로컬-ai-도구-깔기돌리기) · [영상 손보기(SAM 마스크·부분 보정·보간)](#영상-손보기sam-마스크부분-보정보간) · [지난 기록](지난기록/영상_ffmpeg_자막.md)

## 공용 도구 · 회차마다 복사하지 않는다(2026-10-19)

아래 항목의 고침 가운데 반복되는 것은 공용 도구 넷에 들어 있다. 새 회차는 스크립트를 복사하지 말고 이것을 부른다(옛 회차 폴더의 사본은 기록으로 둔다). 쓰는 법은 각 파일 머리말.
- `node tools/나레이션굽기.mjs <계획.json>` — Typecast 나레이션. 기본은 미리보기(글자·크레딧 어림, 키·네트워크 없음), `--굽기`로 캐시에 없는 줄만 산다. 캐시는 저장소 밖 `~/Documents/synk-vendor/typecast-cache/`(요청 해시, 옛 `lab-topik-narration`·`minigame-voice` 원본도 그대로 씀) — PC를 옮길 때 같이 옮긴다. 키 파일이 없으면 `--키파일-열기`. 줄 다듬기(앞뒤 무음·`speed`·`cut`), 낱말 시각, Remotion 목록(`ts`), 이어 붙인 듣기 판(`take`)까지 만든다. 귀로 듣고 고르기는 사람이 한다.
- `node tools/음량마감.mjs <렌더.mp4>` — 아래 「띄엄띄엄 효과음」「Remotion 나레이션 믹스」의 마감. 기본 −14.5 LUFS·리미터 0.84·AAC 384kbps 48kHz, 0.3 넘게 어긋나면 한 번 더 맞추고, 통과 범위(±0.5 LUFS·최대 −1.2 dBFS) 밖이면 종료 코드 1. `--휴대폰`으로 30MiB 아래 판. 완성본을 덮지 않는다(`--덮어쓰기`).
- `python -X utf8 tools/자막맞추기.py srt|정렬|대조` — 큐 표(초·박·원곡 시각·끝 화면)로 SRT, 한 번에 읽힌 테이크의 받아쓰기 정렬(옛 `한번에_맞추기.py`와 같은 셈), 완성본을 받아써서 큐마다 대조(걸린 큐만 medium·large-v3-turbo로 다시 듣기). 판정은 귀 확인을 대신하지 않는다.
- `node tools/유튜브이어올리기.cjs <계획.json>` — 하루 한도로 partial이 된 항목의 빠진 썸네일·자막·재생목록만 채운다([브라우저·게시 노트](브라우저_게시.md#하루-api-한도에-걸려-올리기가-중간에-멈춘다)).
- 다시 확인: 10-19 세션 공유 v14 확정본을 `음량마감.mjs --목표 -14 --다시맞춤 0 --통과 -15,-14 --소리 256k --표본율 원본`으로 다시 만들면 게시한 파일과 바이트까지 같다(`node --test tests/음량마감.test.mjs`). 관용구 퀴즈 #2 v5b 나레이션 31줄은 옛 캐시에서 `--다듬기`로 다시 만들어 소리 데이터·목록이 같았다.

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
- 10-19 다시(하린 색감 판): 영상은 `-c:v copy`, 소리만 새로 붙이며 `-shortest`를 쓰자 소리(20.52초)가 영상(20.54초)보다 짧아 엔드카드 정지 화면 끝 4프레임이 빠졌다(493 → 489장). 영상 길이(프레임 수 ÷ fps)로 `-t`를 주고 소리 끝은 `apad`로 무음을 채운다(`가편집/편집_색감.py`).

### 이미 AAC인 소리를 다시 AAC로 뽑으면 순간 최대가 올라간다
- 증상: 10-19 하린 최종본에 확정 판(AAC 256k)의 소리를 꺼내 AAC 384k로 다시 압축하자 순간 최대가 −1.1 dBTP로 기준(−1.5)을 넘었다. 믹스 단계의 표본 최대는 −2.0 dBFS였다.
- 원인: 손실 압축을 두 번 거치며 봉우리가 조금씩 더 솟는다.
- 고침: 믹스 원본 WAV(`효과음/믹스_<이름>.wav`)를 한 번만 압축하고, 압축 전에 `alimiter=limit=0.75:level=false`로 봉우리만 살짝 누른다 → −14.0 LUFS · −2.1 dBTP.
- 다시 확인: 완성본을 `ebur128=peak=true`로 재서 통합 음량 −14 안팎, 순간 최대 −1.5 dBTP 이하인지 본다.

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

### loudnorm을 맨 끝에 두면 소리가 96kHz로 나간다
- 증상: 10-20 화성 CM송 앨범아트 영상(mp4)의 소리가 96kHz였다(Fable 검수). 같은 필터 줄에 `aresample=48000`을 넣었는데도 그랬다.
- 원인: loudnorm은 192kHz로 올려 내보낸다. `aresample=48000`이 loudnorm **앞**에 있어 소용이 없었고, AAC가 192kHz를 못 받아 96kHz로 묶였다. 한 번만 돌린 loudnorm은 LRA도 2.5 LU로 눌러 놓았다.
- 고침: 두 번 돌린다 — 1차 `loudnorm=…:print_format=json`으로 재고, 2차에 `measured_*`·`offset`·`linear=true`를 넣은 뒤 **뒤에** `aresample=48000`(`가편집/음악넣기.py`·`만들기_CM송.py`).
- 다시 확인: `ffprobe -show_entries stream=sample_rate`가 48000, `ebur128`로 −14 LUFS 안팎인지 본다.

### 끝없는 `apad`를 섞은 인코딩이 출력 2MB쯤 쓰고 CPU만 쓰며 멈춘다
- 증상: 10-18 지유 이미지 콘티 가편집(`이미지콘티_가편집.py`, PNG 360장 + 내레이션 3개·음악을 `amix=…:duration=longest,apad,atrim=0:15` · `-t 15`로 인코딩)에서 ffmpeg가 3초 만에 mp4를 2~2.6MB 쓴 뒤 10분 넘게 파일이 자라지 않고 CPU 시간만 쌓였다. 오류도 끝도 없고, 남은 파일은 moov가 없어 열리지 않는다. 30분 전 같은 스크립트는 1분 반에 끝났고, 같은 명령을 셸에서 바로 돌리면 2~3초에 끝나 「표준 입력 탓」으로 잘못 짚었다(`-nostdin`·`stdin=DEVNULL`을 넣어도 또 멈췄다).
- 원인: `apad`가 길이 없이 무음을 끝없이 만든다. 파이썬에서 `capture_output=True`로 같은 명령을 돌리면 60초 시간 초과(2.6MB), 출력을 물려주면 2초 — 때에 따라 멈추는 ffmpeg 9 스레드 일정과의 경쟁으로 보인다.
- 고침: 무음 채우기는 늘 길이를 못 박는다: `apad=whole_dur=15,atrim=0:15`. 바꾼 뒤 `capture_output` 모드로 세 번 모두 2.2~2.6초에 끝났다. 멈췄으면 그 ffmpeg만 끄고(부모 파이썬은 따라 끝난다) 남은 임시 PNG로 다시 돌린다.
- 다시 확인: 출력 파일 크기가 몇 초마다 자라는지 본다. `ffprobe`가 「moov atom not found」면 덜 쓴 파일이다.

### 줄마다 자른 내레이션에 `afade=t=out:st=0`을 걸어 소리가 통째로 빠졌다
- 증상: 10-19 밤 화성 CF 가편집 1·2판을 「내레이션·자막만 들어 있다」며 보냈는데, 소리 트랙 최대값이 0.002(약 −90dB)로 사실상 무음이었다. 받아쓰기는 「한글자막 by …」, 「다음 영상에서 만나요」 같은 헛말만 냈다.
- 원인: 줄 끝을 다듬으려고 `atrim … ,afade=t=out:st=0:d=0.001`을 걸었다. 페이드 아웃은 st부터 끝까지 0으로 두므로 줄마다 첫 1ms만 남았다.
- 고침: 자른 줄의 길이를 재서 `afade=t=out:st=<길이-0.04>:d=0.04`로 끝만 줄인다(`hwaseong/가편집/만들기_CF.py`). 보내기 전에 소리 트랙을 두 가지로 확인한다 — 1초마다 RMS(내레이션 구간이 −20dB 안팎인지)와 faster-whisper `vad_filter=True` 받아쓰기. 받아쓰기가 「한글자막 by」류 헛말이면 목소리가 없는 것부터 의심한다.
- 다시 확인: 렌더한 mp4에서 내레이션 줄 시각의 RMS와 받아쓰기 글이 대본과 맞는지.

### 다빈치 리졸브 무료판(21.1)은 파이썬 스크립트로 조종할 수 없다
- 증상: 10-19 「편집·소리·색을 다빈치에서 끝낼지, 스크립트로 할지」를 따지려고 보니 이 PC의 리졸브는 무료판 21.1(`Resolve.exe` 제품 이름 「DaVinci Resolve」, Studio 아님)이고 스크립트 안내 파일(Developer/Scripting README)도 없었다.
- 원인: 블랙매직이 21.1 업데이트에서 「We have moved the ability to script in Python to the Studio version」으로 무료판의 파이썬 스크립트를 뺐다(Puget Systems 2026-09-10). 그 전에도 무료판은 바깥 프로그램에서 부르는 스크립트가 안 되고 프로그램 안 콘솔에서만 됐다(블랙매직 포럼 2018).
- 고침: 편집 · 소리 · 색은 파이썬 + ffmpeg 스크립트로 한다(하린 `편집_Wan.py` · `믹스.py` · `엔드카드.py`, 지유 `본편_편집.py`, PULSE `색감.py`). 다빈치에서 손으로 다듬어야 할 때는 색감을 `.cube`로 내보내 쓴다(`색감.py 큐브`). 다빈치를 스크립트로 몰려면 Studio(영구 295달러)가 필요하다.
- 다시 확인: `(Get-Item 'C:\Program Files\Blackmagic Design\DaVinci Resolve\Resolve.exe').VersionInfo.ProductName`이 「DaVinci Resolve Studio」면 스크립트 길이 열린다.

## 색 맞춤(LUT·bt709 표시)

### `-color_primaries bt709 -color_trc bt709`를 줘도 원색·감마가 unknown으로 남는다
- 증상: 10-19 지유 광고 v3b(파이썬에서 rgb24를 파이프로 넣고 `-vf noise=…` 뒤 libx264)에 `-colorspace bt709 -color_primaries bt709 -color_trc bt709`를 붙였는데, `ffprobe`가 `color_space=bt709`만 보여 주고 `color_primaries`·`color_transfer`는 unknown이었다.
- 원인: 필터를 지난 프레임에 그 값이 없으면 libx264가 프레임 쪽 값을 따라 VUI의 원색·감마 칸을 비운다(추정).
- 고침: 인코딩에는 `-x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709`를 함께 준다. 이미 뽑은 파일은 다시 인코딩하지 않고 `ffmpeg -i in.mp4 -map 0 -c copy -bsf:v "h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1" out.mp4`로 태그만 고친다(10-19 다섯 판, 몇 초).
- 다시 확인: `ffprobe -v error -select_streams v:0 -show_entries stream=color_space,color_primaries,color_transfer -of csv=p=0 <파일>`이 `bt709,bt709,bt709`인지.

### 다시 인코딩하며 bt709 표시를 붙이면 화면이 2~6단계 어두워지고, 표시만 붙이면 붉은색이 뜬다
- 증상: 10-19 지유 부분 보정 시험에서 `본편_편집.py`가 색감을 입힌 프레임과 최종 v3b 파일의 같은 프레임을 견주니 파일이 고르게 어두웠다(ffmpeg로 rgb24로 풀어 평균 −3.5, PSNR 35.6dB — 이 가운데 −1 안팎은 ffmpeg 풀기 몫이고, yuv420p 원본을 709 행렬로 직접 풀면 R −2.5 · G −1.6 · B −2.6, 10-19 Fable). 색 칸을 같은 두 단계 사슬(rgb24 파이프 → libx264 crf 14, 다시 `noise` → crf 18 + bt709 표시)에 통과시키면 피부 (226,180,160)이 (−6,−4,−5), 검정 머리 (25,22,22)가 (−4,−1,−6) 내려갔다. 입자(`noise`)는 원인이 아니었다(빼도 같음).
- 원인: 1단계는 표시 없이 ffmpeg 기본(BT.601) 행렬로 YUV를 만든다. 2단계에 출력 옵션 `-colorspace bt709`를 주면 ffmpeg 9.0이 표시 없는 입력을 bt709로 바꾸는 변환을 끼워 넣는데, 색상은 맞추면서 밝기가 내려간다(회색 경사 −2.3, 파일 Y 평면 평균 125.1 → 124.1). 반대로 변환 없이 표시만 붙이면(`-x264-params`만 · 입력 옵션 · `h264_metadata` bsf) 밝기는 그대로지만 601 데이터를 709로 읽어 입술 (200,110,110)이 (+6,+8,−1), 파랑이 (−6,+5,+4) 옮겨진다. 위 항목의 bsf로 표시만 고치는 길도 표시 없이 뽑은(601) 파일에 쓰면 이 경우다. v3b는 인코딩 때 `-colorspace bt709`를 준 쪽이라 색상은 맞고 어두워진 경우다(ffmpeg로 풀면 RGB 고르게 −3.5 · −3.0 · −3.5, 709 행렬로 직접 풀면 −2.5 · −1.6 · −2.6 — 위 숫자들도 ffmpeg로 푼 값이라 −1 안팎 풀기 몫이 섞여 있다).
- 고침: 1단계부터 709로 넣는다: `-vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`에 `-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -x264-params colorprim=bt709:transfer=bt709:colormatrix=bt709`. 그러면 2단계는 입력이 이미 bt709라 변환 없이 입자만 얹고, 색 칸 넷 모두 ±2 안(회색 경사 −0.46)이었다. 이미 뽑은 v3b 다섯 판은 유호님 확인을 기다리는 중이라 손대지 않았다(다음 판을 뽑을 때 반영할 일).
- 다시 확인: 색을 입힌 프레임 한 장과 최종 mp4의 같은 프레임을 견주고, 색 칸(피부 · 입술 · 검정 · 파랑)을 같은 사슬에 통과시켜 ±2 안인지 본다. 풀 때 ffmpeg `-pix_fmt rgb24` 변환은 그 자체로 RGB 평균 (−0.9, −1.4, −0.9)쯤을 더한다(반올림 · 크로마 보간, 10-19 지유 v3c에서 같은 프레임을 709 행렬로 직접 풀면 +0.02~+0.12). 그래서 ±1 안을 보려면 `-pix_fmt yuv420p` 원본을 받아 709 방송 범위 행렬로 직접 풀거나 그 몫을 빼고 본다.
- 다시 확인(10-19 하린 엔드카드): 하린 최종본은 「표시만 붙이면」 쪽이었다 — `synk-vendor/harin-iced-coffee-h3-20261017/엔드카드/엔드카드.py`의 apply가 rgb24로 풀어 표시 없이 다시 인코딩(BT.601 행렬)하고, `가편집/편집_색감.py` 마지막 합치기가 `h264_metadata` bsf로 bt709 표시만 붙였다. 색 견본 차 초록 (−7,−12,−5) · 노란 티 (0,−4,−6) · 입술 (+5,+7,−2) · 피부 (+3,+1,−2), 실제 최종본 일곱 장은 화면 평균 R +1.4~2.0 · G +0.9~1.5 · B −0.6~−0.9로 얼굴 · 티 · 커피가 따뜻하게 떴다. 엔드카드 인코딩에 위 고침(`scale=out_color_matrix=bt709:out_range=tv,format=yuv420p` + 표시 넷 + x264-params)을 넣자 견본 최대 ±3(평균 −1.3 — 처음엔 두 번 인코딩한 몫으로 봤지만, 지유 v3c에서 같은 크기의 −1 안팎이 ffmpeg rgb24 풀기 몫으로 확인됐다), 실제 프레임은 의도한 색과 평균 ±0.2. swscale `accurate_rnd` · `full_chroma_int` 플래그는 남은 −1~−3을 줄이지 못했다(같은 값). 최종본 · 폰 판은 같은 이름으로 다시 구웠고, 비교는 `harin-iced-coffee-h3-20261017/색감/비교/최종_색고침_전후.jpg`.
- 다시 확인(10-19 지유 v3c): `jiyu-skincare-20261018/본편_편집.py`에 같은 고침(1단계 `-vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p` + 표시 넷 + x264-params, 2단계는 같은 표시만 주어 변환 없이 입자만)을 넣어 다섯 판을 다시 뽑았다. v3c 파일을 ffmpeg로 풀어 인코딩 전 프레임과 견주니 다섯 판 · 여섯 순간 모두 평균 (−0.9, −1.4, −0.9), 64px 칸 최대 2.7, PSNR 39~43dB(v3b 같은 비교 (−3.5, −3.1, −3.6)). 색 견본 여덟 칸 모두 ±2. 남은 −1 안팎은 파일 몫이 아니었다 — Fable이 yuv420p 원본을 709 행렬로 직접 풀어 보니 다섯 판 × 여섯 프레임 평균 +0.03~+0.3, 칸 최대 0.6~1.4, 밝기 구간 · 자리별 ±0.2(내가 다시 풀어도 f24 · f168 · f312 +0.02~+0.12). 601로 풀면 살갗이 5~9 틀어지니 파일은 표시대로 709다. 파일은 v3b보다 15% 작아졌다(9:16 19.9 → 16.8MB, 2단계 색 변환이 없어진 몫으로 보임 — 추정). 확인 스크립트 `jiyu-skincare-20261018/색감/v3c_확인/v3c_확인.py`.

### 색 맞춤 LUT를 건 얼굴 컷만 피부가 수채화처럼 뭉개진다
- 증상: 한강 v33 「…아니요」 얼굴 컷의 볼·이마가 평평한 색 덩어리로 끊겨 「수채화처럼 변했다」(10-18 유호님). 같은 계열 LUT를 건 PATH 상담사 컷도 약하게 얼룩.
- 원인: `[새판]도구/색_맞추기_LUT.py --밝기분포 1`로 만든 LUT는 밝기 분위수까지 맞춰 곡선이 울퉁불퉁하다. 이걸 480p 8비트 압축 영상에 키우기 전에 걸면 피부 단계가 계단처럼 늘어난다. 16비트로 걸어도 표 자체의 울퉁불퉁함은 남는다. 생성 클립 탓이 아니다(원본 프레임은 멀쩡).
- 고침: 평균·폭만 맞춘 LUT를 쓰거나, 꼭 그 색 방향이 필요하면 표를 다듬는다(`[새판]도구/LUT_부드럽게.py`, 33격자 시그마 1.5). 어느 쪽이든 1080으로 키운 뒤 `format=gbrp16le,lut3d=…:interp=tetrahedral,format=yuv420p`로 건다(한강 조립 옵션 `lut_hq`).
- 다시 확인: 같은 프레임을 원본 · LUT 판으로 얼굴 부분만 크게 잘라 나란히 본다. 전체 화면 썸네일에선 안 보인다.

## 렌더(HyperFrames·GSAP)

아래 HyperFrames 항목은 기존 영상 수정·재현의 기술 참고다. 새 영상의 도구는 [제작 도구 선택](../마케팅/콘텐츠_제작방식_v2_20261002.md#video-tool-selection)을 따른다.

### 보이는 값에서 시작하는 `fromTo`가 0초부터 보인다
- 증상: 30.9초에 나올 클릭 리플이 장면 내내 버튼 둘레에 떠 있다(10-13, 스냅샷·렌더 모두).
- 원인: GSAP `tl.fromTo(el, {opacity:1, …}, {…}, 30.9)`의 from은 immediateRender라 타임라인을 만드는 순간 적용된다. from이 opacity 0인 등장 효과는 문제없다.
- 고침: 보이는 값에서 시작하는 효과(리플·번쩍임)는 `tl.set(el, {opacity:1, scale:0.6}, t); tl.to(el, {opacity:0, scale:3, …}, t)`로 쓴다. 같은 요소에 CSS `transform`과 GSAP 변형을 같이 쓰면 hyperframes check가 `gsap_css_transform_conflict`로 막으니, 처음 상태는 CSS 대신 `tl.set(…, 0)`으로 준다.
- 다시 확인: 효과 시각 전의 snapshot 프레임에 그 요소가 안 보인다.

### Windows에서 `render --variables '{"hook":"C"}'`를 node로 부르면 렌더가 실패한다
- 증상: `spawnSync('npx', [..., '--variables', JSON.stringify(vars)], { shell: true })`로 부른 C안 렌더가 바로 실패했다(10-17 yuhobuilds 노트북 이사 편, 0.8.167). 같은 렌더를 변수 없이 부르면 된다.
- 원인: Windows에서 npx(.cmd)를 쓰려고 `shell: true`를 주면 인자가 이스케이프 없이 이어 붙어 JSON 따옴표가 빠진다(node DEP0190 경고가 같이 뜬다).
- 고침: 변수를 파일로 써서 `--variables-file <json> --strict-variables`로 넘긴다. 보기 `docs/마케팅/yuhobuilds_노트북이사_20261017/렌더.cjs`.
- 다시 확인: `--strict-variables`를 준 렌더가 끝나고, 그 판의 0초 프레임에 변수 분기(훅 C 제목)가 보인다.

### snapshot·check·미리보기에서는 멀쩡한데 렌더에서만 그림이 404다
- 증상: 실땀 그림이 렌더에서만 빠진다(`[FileServer] 404`, 10-13 SNS 키트).
- 원인: snapshot·check·Studio 미리보기는 `bundleToSingleHtml`을 거쳐 링크 CSS를 `<style>`로 넣고 url()을 프로젝트 뿌리 기준으로 고친 뒤 그림을 data URL로 박는다(요청이 `GET /` 하나뿐). 렌더(compileForRender)는 로컬 CSS를 링크로 두어, 인라인 스타일 속 `var()`의 상대 url()을 Chrome이 문서 기준으로 풀다 404가 난다. Studio는 `/api/projects/<id>/preview/` 아래에서 열어 `/assets/…` 같은 루트 절대 경로가 어긋날 수 있다(코드만 읽음).
- 고침: 그림 경로를 건드린 수정은 `render --fps 10 --quality draft --format png-sequence -o <임시>`로 짧게 렌더해 프레임을 직접 본다. 404 수는 `NODE_OPTIONS=--require <훅.cjs>`로 센다(훅은 `http.Server.prototype.emit`을 감싸 'finish' 때 `statusCode url`을 파일에 적는다 — 렌더 파일 서버도 같은 프로세스라 잡힌다). snapshot의 `--describe`는 GEMINI_API_KEY가 있으면 유료 분석을 기본으로 돌리니 `--describe false`를 준다.
- 다시 확인: 짧은 png-sequence 렌더의 404 기록이 0줄이다.

### 멈춘 렌더 스크립트의 자식 프로세스가 살아남아 새 렌더와 겹친다
- 증상: 백그라운드 `bash render_v1.sh`를 멈추고 새로 돌렸더니 렌더가 두 벌 겹쳤다. 로그에 같은 판이 두 번 찍히고 출력 폴더에 `.<이름>.hf-transaction-*`가 남아, 어느 원고로 구운 mp4인지 알 수 없었다(10-11). 10-17 WORLD 측정에서는 멈춘 셸 돌림(`./final.sh`의 `for`)이 그대로 돌아 새로 띄운 돌림과 측정이 겹치고 같은 결과 파일을 서로 비웠다. 같은 날 블렌더 굽기도 백그라운드 작업을 멈춘 뒤 `blender.exe`가 남아 계속 GPU를 써, 그사이 잰 fps를 끌어내렸다.
- 원인: Windows Git Bash에서 백그라운드 작업을 멈추면 맨 위 셸만 끝나고 그 아래 스크립트 셸(`sh.exe ./final.sh`)과 스크립트가 띄운 npx·node 자식은 남는다.
- 고침: 멈춘 뒤 `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`에서 CommandLine에 `hyperframes`·`render`가 든 것을 찾아 `taskkill /PID <npx pid> /T /F`로 끝낸다(Git Bash에서는 `//PID … //T //F`). 내가 띄운 것만 시작 시각으로 가린다. 출력 폴더의 `.hf-transaction-*`와 그때 나온 mp4는 지우고 다시 굽는다. 6분 넘는 렌더는 check → snapshot 프레임 확인을 마친 뒤 시작한다. 셸 돌림은 `Get-CimInstance Win32_Process | ? CommandLine -match '<스크립트 이름>'`으로 sh.exe·bash.exe까지 찾아 끝낸다.
- 다시 확인: 다시 굽기 전에 렌더 node 프로세스가 0개다. 셸 돌림이면 그 스크립트 이름이 든 프로세스도 0개다.

### HyperFrames carve가 말 사이 음악까지 계속 누른다
- 증상: 짧은 대사 9줄인 22초 편에서 0.5초부터 끝까지 음악이 약 −13dB로 눌려, 말 사이 구간이 목소리 없는 판보다 5dB 작았다(10-03).
- 원인: carve의 전체 크기 맞춤 단계(fromCarve `gain`)가 일부러 천천히 돌아온다.
- 고침: carve의 목소리 대역 칸(말을 따라 바로 돌아옴)은 두고 크기 맞춤 단계만 빼고, 말할 때만 −8dB · 말끝 0.15초 뒤부터 0.45초에 걸쳐 원래대로 · 1초보다 짧은 틈은 낮춘 채 두는 duck 단계를 직접 쓴다. 대사는 `data-start = 첫 말소리 시각 − 파일 앞 무음`으로 놓는다(carve는 `data-media-start`를 무시한다). 앞뒤 파일이 겹치면 트랙을 번갈아 둔다(같은 트랙에서 겹치면 `duplicate_audio_track` 경고). `@hyperframes/core`는 저장소에 깔지 않고 임시 폴더에 깔아 `--core`로 준다. 한 번에 하는 보기 스크립트는 `docs/마케팅/LAB_한글날_내이름한글로_20261002/음성/넣기.cjs`.
- 다시 확인: 말 사이 구간의 크기를 목소리 없는 판과 구간별로 견준다(+0.5dB 안).

## 렌더(Remotion·Playwright)

### Remotion 박자표 같은 모듈 상수는 컴포지션 props로 못 바꾼다
- 증상: 10-18 관용구 퀴즈 #2를 100 BPM으로 늦추려는데 박 길이 `B`·`T`·`TOTAL`이 `timeline.ts`의 모듈 상수라 컴포지션마다 다른 값을 줄 수 없었다(같은 번들에 120 BPM 판도 있음).
- 원인: 모듈 상수는 번들 때 한 번 정해진다. defaultProps는 컴포넌트 안에서만 읽힌다.
- 고침: `REMOTION_` 접두 환경 변수는 번들 안 `process.env`로 들어간다 — `export const B = process.env.REMOTION_TEMPO === '100' ? 18 : 15`, 렌더는 `REMOTION_TEMPO=100 npx remotion render …`. `Root.tsx`가 템포에 맞는 컴포지션만 등록하게 해 다른 템포 판을 잘못 뽑지 않게 했다. 숫자로 박은 프레임(15·30·96 등)은 박 단위로 바꿔 둔다. 음악 재배치본은 rubberband(`tempo=0.8333:pitchq=quality:transients=crisp:detector=percussive`)로 늘리면 박 자리가 그대로 1.2배가 된다.
- 다시 확인: `REMOTION_TEMPO=100 npx remotion compositions src/index.ts`가 36.00초를, 변수 없이 30.00초를 보인다.

### Remotion Node API(bundle·renderStill)는 REMOTION_ 환경 변수를 넘기지 않는다
- 증상: 10-18 관용구 퀴즈 #2 나라별판에서 `@remotion/bundler`·`@remotion/renderer`로 번들을 한 번 만들어 정지컷을 찍자 `Could not find composition kids-quiz-v5b-th`가 났다. 목록에는 120 BPM 판만 있었다.
- 원인: CLI는 `REMOTION_`으로 시작하는 환경 변수를 번들 안 `process.env`로 넘겨 주지만 Node API는 넘기지 않는다. `REMOTION_TEMPO=100`이 비어 Root가 100 BPM 판을 등록하지 않았다. 스크립트에서 `process.env`에 넣어도 같다.
- 고침: `selectComposition`·`renderStill`·`renderMedia`에 `envVariables: { REMOTION_TEMPO: '100' }`를 직접 준다(`remotion/현지어_정지컷.mjs`·`현지어_렌더.mjs`). 한글 경로는 `fileURLToPath(import.meta.url)`로 바꿔야 `%EB…`로 남지 않는다.
- 다시 확인: 같은 스크립트로 26개 채널 정지컷·영상이 모두 나왔고, 뉴질랜드판은 게시된 영어판과 끝 계정만 달랐다.

### Remotion은 소리를 16비트로 더해 0 dBFS 넘는 표본을 그 자리에서 자른다
- 증상: 10-18 synkbrief 「AI 구독 계정판」에 나레이션(Typecast −17 LUFS, 1.0)을 얹고 배경음 0.16·효과음과 렌더했더니 잘린 표본이 47개(2.2·17.1·28.4초, 말 봉우리) 나왔다. 나레이션 없는 판은 0개였다. 렌더 뒤 리미터로 봉우리를 누르는 마감만으로는 이미 잘린 소리가 돌아오지 않는다.
- 원인: Remotion은 트랙을 `amix=…:dropout_transition=0:normalize=0`으로 더해 `pcm_s16le`로 쓴다(`node_modules/@remotion/renderer/dist/create-ffmpeg-merge-filter.js`·`merge-audio-track.js`). 합이 1.0을 넘는 표본은 16비트로 바뀌며 잘린다.
- 고침: 영상 안 모든 `volume`(배경음·나레이션·효과음)에 같은 MASTER 0.8(−1.9dB)을 곱했다 → 잘린 표본 0 · −16.9 LUFS · −1.5 dBFS. 크기는 마감에서 되올린다(+2.4dB, 리미터 0.89 → −14.6 LUFS · −1.0 dBFS). 휴대폰판(96k)은 마감본을 다시 누르면 봉우리가 −0.4까지 솟아 렌더 원본에서 리미터 0.84로 따로 뽑는다. 보기 `docs/마케팅/synkbrief_AI구독계정판_20261017/remotion/src/full/Film.tsx`(MASTER)·`scripts/finish.mjs`.
- 다시 확인: 마감 전 렌더 소리를 16비트로 풀어(`ffmpeg -i x.mp4 -vn -f s16le -`) 절댓값 32700 넘는 표본을 numpy로 센다. 0이어야 한다.

### Remotion 나레이션 믹스는 봉우리가 0dBFS를 넘는다
- 증상: 10-17 −15.9 LUFS 나레이션 + BGM 0.5(말할 때 −9dB) + 키트 효과음 30개를 Remotion으로 렌더했더니 −13.0 LUFS · 봉우리 +0.1 dBFS였다.
- 원인: Remotion은 트랙을 그대로 더하고 리미터가 없다. 효과음이 말과 겹치는 순간 넘친다.
- 고침: 렌더 뒤 영상은 복사하고 소리만 `-af "volume=-1.5dB,alimiter=limit=0.84:attack=3:release=60:level=false"`로 다시 인코딩했다 → −14.5 LUFS · −1.4 dBFS. 보기 `docs/마케팅/yuhobuilds_노트북이사_20261017/remotion/렌더.mjs`. 10-19부터는 `node tools/음량마감.mjs <렌더.mp4>`가 재고·올리고·다시 재서 맞춘다.
- 다시 확인: 최종 파일의 `ebur128=peak=true`가 −14.5±0.5 LUFS · −1 dBFS 아래.

### 앱 CSS를 Remotion에 그대로 넣으면 휴대폰 규칙과 vw가 영상 창 기준으로 풀린다
- 증상: 10-17 AI 구독 계정판 CSS(`desktop/renderer/subscriptions.css`)를 영상에 넣었더니 휴대폰 폭 배치(`@media (max-width:760px)`)가 걸리지 않고, `clamp(…vw…)` 글자는 앱보다 커졌다. 같은 날 앱 CSS가 세 번 바뀌어 손으로 고친 사본은 금방 낡았다.
- 원인: Remotion 페이지 창은 1080 폭이라 미디어 쿼리와 vw가 앱 창이 아니라 영상 창을 본다.
- 고침: `docs/마케팅/synkbrief_AI구독계정판_20261017/remotion/scripts/board-css.mjs`가 앱 CSS에서 영상용 CSS를 만든다. 휴대폰 규칙은 `.member-subs.ms-phone` 아래로 옮기고, vw·vh는 앱 창 크기 변수(휴대폰 `--ms-vw:5.4px`, PC `12.8px`)로 바꾼다. 앱 CSS가 바뀌면 다시 돌린다. 앱이 CSS 애니메이션으로 하는 움직임(고리 그리기·숫자 굴림)은 같은 곡선·길이를 `useCurrentFrame()`으로 옮겨 쓴다(`src/v5/gauge.tsx`).
- 다시 확인: `node scripts/board-css.mjs` 뒤 `grep -c "ms-phone" src/board.css`가 0보다 크고 `grep -nE "[0-9]v[wh]" src/board.css`가 빈다.

### inline-flex로 묶은 글줄은 낱말 사이 빈칸이 사라진다
- 증상: 10-18 영상용 한 줄 목록의 값 칸(`display:inline-flex` 안에 `주간 <b>62%</b> 남음`)이 「주간 62%남음」으로 찍혔다.
- 원인: flex 상자 안에서는 글 조각과 요소가 각각 flex 항목이 되고, 항목 끝의 빈칸은 접힌다.
- 고침: 값 칸은 보통 글줄(`white-space:nowrap`)로 두고, 작은 고리는 앱 CSS의 `vertical-align`으로 맞춘다.
- 다시 확인: 정지컷에서 「62% 남음」 사이가 띄어져 있는지 본다.

### 밝은 판이 어두운 창으로 바뀌는 몇 프레임에 회색 판이 비친다
- 증상: 10-18 세션 공유 편 Remotion 본편에서 종이 판 → 어두운 로그 창 전환 3~6프레임과 폴더 카드가 사라지는 프레임에 회색 판·회색 카드가 찍혔다(Fable 검수 「반투명 회색 유령 카드」). 30프레임 간격 시트에서는 안 보이고 2~3프레임 간격 띠에서만 보였다.
- 원인: 밝은 판을 opacity로 내리면 검정 무대가 비쳐 회색이 된다. 어두운 창을 clip으로 덮으면서 밝은 판도 같이 흐리면(`paper = 1 − dark`), 아직 안 덮인 부분이 회색이다. 밝은 판과 어두운 판을 서로 반대로 페이드해도 같다.
- 고침: 밝은 판은 다 덮일 때까지 1로 두고 덮인 뒤에 내린다(`paper = dark < 1 ? 1 : 0`). 사라질 카드는 흐리지 말고 다른 판 밑으로 모으거나 위·아래에서 덮는다. 같은 색 판에서 판으로 넘길 때(확대한 칸 → 사이드바)는 새 판 종이를 처음부터 1로 두고 내용만 바꾼다. 보기 `docs/마케팅/yuhobuilds_세션공유_20261017/remotion/src/full/kit.tsx`의 `Shell`.
- 다시 확인: 전환 구간을 `ffmpeg -i out/x.mp4 -vf "select='between(n\,A\,B)*not(mod(n-A\,3))',scale=270:-1,tile=10x1" -frames:v 1 strip.png`로 뽑아 회색 판이 없는지 본다.

### 경로에 ZWSP만 넣으면 하이픈에서도 줄이 바뀐다
- 증상: 10-18 로그 줄의 긴 경로를 `\` 뒤 ZWSP(U+200B)로 끊으려 했는데 「…\claude-」 / 「code-sessions\…」처럼 하이픈에서 끊겼다. 강조 낱말 「(symlink/file plant)」도 두 줄로 갈려 밑줄이 둘로 보였다.
- 원인: Chrome은 하이픈 뒤도 기본 줄바꿈 자리로 본다. ZWSP는 자리를 더할 뿐 다른 자리를 막지 않는다.
- 고침: 경로를 `\`로 나눠 빈칸 없는 마디마다 `white-space:nowrap` span으로 감싸고 마디 사이에만 ZWSP를 둔다. 강조 낱말 span도 nowrap. 창이 화면 오른쪽 밖으로 이어지는 배치라면 글 상자 폭은 화면(1080) 안까지만 준다. 보기 같은 폴더 `ActOne.tsx`의 `atSep`.
- 다시 확인: `npx remotion still src/index.ts full-a x.png --frame=640`에서 줄이 `\` 자리에서만 바뀌고 강조 밑줄이 한 줄이다.

### 새 Remotion 프로젝트는 S16 설정을 가져와 세우고, 시안 렌더 음량은 따로 올린다
- 증상: 10-17 S16(4.0.535)의 package.json·package-lock.json·remotion.config.ts·tsconfig.json·`src/lib/fonts.ts`·`anim.tsx`와 `public/fonts/`를 복사해 `npm ci --prefer-offline`으로 세웠더니 `npm warn install-scripts esbuild@0.28.1 (postinstall)`이 떴다. 나레이션 없이 BGM 0.32 + 띄엄띄엄 효과음으로 렌더한 시안은 −26.2 LUFS였다.
- 원인: 새 npm이 설치 스크립트를 기본으로 막는다(esbuild 바이너리는 선택 의존으로 이미 들어와 렌더는 됐다). 음량은 말이 없으니 낮게 나온 것.
- 고침: 경고는 두고 `npx remotion still`·`render`로 확인했다. 시안 음량은 `ffmpeg -c:v copy -af "volume=10dB,alimiter=limit=0.84:level=false"` 뒤 ebur128로 −16.4 LUFS·봉우리 −1.5 dBFS를 확인했다(loudnorm은 띄엄띄엄 소리에서 모자란다 — 위 항목). 본편은 나레이션 기준으로 섞는다.
- 다시 확인: `npx tsc --noEmit -p .`와 `npx remotion still src/index.ts <id> out/x.png --frame=10`이 오류 없이 끝나는지.

### SUIT 글꼴은 →를 꺾쇠로 그리고 ✂·—는 글자가 없다
- 증상: 프레임 시트 제목 「35→24mm」가 「35 > 24mm」처럼 나오고, 확인용 영상의 「✂ 나눔 지점」은 가위 자리가 빈칸이었다. 오류는 없다.
- 원인: `docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf`의 U+2192는 꺾쇠 모양이다. U+2702(✂)·U+2014(—)·U+203A(›)·U+25B8(▸)은 글자가 없다. ▶·↑·①~④·×·…·°는 있다.
- 고침: 「크다」로 읽힐 수 있는 곳은 「35mm에서 24mm로」처럼 글로 쓰고, 빠진 기호는 글자로 바꾼다(「[나눔 A]」).
- 다시 확인: `python -c "from fontTools.ttLib import TTFont; c=TTFont('docs/브랜드_폰트/SUIT/SUIT-SemiBold.otf').getBestCmap(); print([hex(x) for x in (0x2192,0x2702,0x2014) if x in c])"`가 `['0x2192']`.
- 10-20 Remotion(yuhobuilds 첫날 편): DM Mono에는 →가 없어 `'DM Mono', 'SUIT', monospace`에서 SUIT의 꺾쇠로 나왔다(「17:35 질문 > 17:53 답」). 실제 출력 줄처럼 화살표를 글자 그대로 보여야 할 때는 글꼴 목록에서 Inter Tight를 SUIT 앞에 둔다(`'DM Mono', 'Inter Tight', monospace` → 제대로 된 →). 정지컷으로 확인.

## 목소리·받아쓰기

### Gemini TTS가 영어 지시문을 소리로 읽거나 없는 말을 지어낸다
- 증상: 「Speak … as X. Say only the Korean words after the colon: 대사」 같은 한 줄 지시가 9줄 중 5줄에서 지시문까지 읽었고 1줄은 없는 말을 지어냈다(10-02). 연출 메모에 대본 문장을 인용하자(「'○○' is the key line」) 12개 중 7개가 그 문장으로 건너뛰거나 지어내거나 메모를 읽었다(10-04).
- 원인: 지시와 대본이 한 덩어리라 모델이 경계를 못 가른다.
- 고침: `### DIRECTOR'S NOTES (never read these notes aloud)` / `### TRANSCRIPT` 머리글로 가르고, 메모에는 대본 글을 넣지 않는다(18개 모두 정상). 숫자는 읽는 법이 갈리니(65살·3년·1층) 읽을 글을 따로 적는다. 10-04 Vertex에서 되는 모델: `gemini-3.8-flash-tts`(wav), `gemini-3.1-flash-tts-preview`, `gemini-2.5-pro-tts`, `gemini-2.5-flash-tts`(`gemini-3.8-pro-tts`는 없다).
- 다시 확인: 구운 뒤 받아쓰기로 확인한다(아래 받아쓰기 항목, 스크립트 보기 `experiences/entry-check/art-source/voice_check.py` — 로컬 faster-whisper, 0원). 길이가 글자 수에 비해 길면(초당 2.2자 미만) 지시문을 읽은 것이다.

### 몽골어·베트남어 같은 짧은 외국어 대사는 Gemini TTS가 원어민 발음으로 읽는다(타입캐스트는 한국어만)
- 증상: 10-19 한강 v41 2층 인사(몽골어·베트남어·아랍어·러시아어·중국어 한 마디씩)를 원어민 발음으로 넣어야 했다. 타입캐스트 목록엔 그 언어 목소리가 없고, edge-tts 6.x는 403(옛 판), ElevenLabs v3 언어 목록(74)엔 몽골어가 안 보였다.
- 원인: 엔진마다 지원 언어가 다르다. `gemini-3.8-flash-tts`는 130+ 언어(Halh Mongolian 포함)다.
- 고침: Vertex `gemini-3.8-flash-tts`에 `speechConfig.languageCode`(mn-MN·vi-VN·ar-EG·ru-RU)를 주고, 메모는 머리글로 가른다(위 항목). 16개 1,809토큰, 길이 0.6~1.2초로 지어내기 없음. 「외국인이 서툴게 말하는」 개그 대사는 대본을 로마자(「Nee how!」)로 주고 메모에 「a clear American accent」를 적으면 받아쓰기가 영어로 들을 만큼 억양이 났다. edge-tts는 `pip install -U edge-tts`(7.2.8)로 다시 됐다(임시용). 굽기 보기 `C:/Users/q1212/Videos/한강2126_새판_20261009/재촬영_v40/소리/오디션/인사_제미나이_굽기.cjs`.
- 다시 확인: faster-whisper small로 언어 감지·강제 받아쓰기. 몽골어는 small·large-v3-turbo 모두 못 읽으니(「Sem beno」「Сэмвэн о」) 귀로 판정한다.

### 목소리 후보를 같은 대본으로 읽히면 몇 목소리는 수십 초를 지어내거나 한 문장을 두 번 읽는다
- 증상: 10-17 45초 대본(머리글로 메모·대본을 가른 판)을 `gemini-3.8-flash-tts`로 9개 읽혔더니 Charon·Fenrir·Sadaltager·Zubenelgenubi가 107~126초로 나왔다. 둘째 문장 자리에 대본에 없는 이야기를 50초 넘게 지어냈다. 그 문장을 「파일 96만 개.」 → 「파일만 96만 개였어요.」로 다듬은 판은 다섯 목소리 중 넷이 그 문장을 두 번 읽었다.
- 원인: 모르겠다. 명사로 끝나는 짧은 문장과 숫자가 이어지는 자리에서만 일어났다(같은 메모로 Achird·Puck은 대본대로 읽었다).
- 고침: 길이부터 거른다(대본 음절 ÷ 6.5보다 1.3배 넘게 길면 버림). 남은 것만 받아쓰기로 재고 일치 0.95 아래는 버린다. 문장을 고치면 지어내기가 다른 모양(반복)으로 옮겨 갈 수 있으니, 잘 읽은 판이 있으면 대본을 그 판에 맞춰 되돌린다. 보기 `docs/마케팅/yuhobuilds_노트북이사_20261017/README.md` 「목소리」.
- 다시 확인: `한번에_맞추기.py`(공용 도구 `tools/자막맞추기.py 정렬`) 줄의 「말」 길이와 「일치」 값.

### 받아쓰기 정렬이 숫자가 많은 문장 경계를 0.3~0.7초 잘못 잡는다
- 증상: 10-17 범수 테이크(대사 14줄을 쉼 0.35~0.5초로 이은 판)를 `한번에_맞추기.py`(faster-whisper small)로 정렬했더니 p1→p2·f1→f2·f2→k1 경계가 앞 대사 끝 = 다음 대사 시작으로 붙었다. silencedetect로 본 실제 무음(예: 28.73~29.31초)과 0.3~0.7초 어긋나, 장면 전환·자막이 말을 앞질렀다.
- 원인: 「5기가」「2만 7천 개」「암호화」처럼 받아쓰기가 숫자·다른 글자로 적는 곳에서 글자 맞추기(difflib)가 빈 구간을 앞뒤로 메우며 경계를 끌어당긴다.
- 고침: Typecast는 `/v1/text-to-speech/with-timestamps` 응답에 낱말·글자 시각(`words`·`characters`)을 준다. 대사마다 구워 이었다면 이은 자리(앞 무음 + 대사 길이 + 쉼)를 계산하고, 낱말 시각을 대사 파일의 첫 소리(−40 dBFS)에 맞춰 옮긴다 → 경계가 실제 무음과 0.01~0.02초 안. 보기 `docs/마케팅/yuhobuilds_노트북이사_20261017/음성/범수_시각.py`. 10-19부터는 `tools/나레이션굽기.mjs`의 `take`가 같은 셈으로 take.json(줄마다 시작·끝·낱말 시각)을 만들고, `tools/자막맞추기.py srt --시각 take.json`이 그 시각으로 자막을 만든다. Typecast 낱말 수는 띄어쓰기 낱말 수와 같다(「5기가가」가 낱말 하나).
- 다시 확인: 만든 take.json의 대사 시작·끝을 `silencedetect=noise=-40dB:d=0.2` 무음 자리와 나란히 본다.

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
- 10-17 더한 경우(관용구 퀴즈 #2, 하나 happy 1.3): 「Laughs hard!」가 받아쓰기 small·medium 모두 「Really? Hard!」·「Whoey! Hard!」로 나왔고 1.86초로 늘어졌다 → 「Laughing so hard!」로 바꾸자 바로 맞았다. 짧은 영어 두 낱말에 감정 세기를 크게 주면 앞 낱말이 뭉개질 수 있다. 또 Typecast 줄 파일 끝에는 0.2~0.5초 숨·여운이 남아(−50dB 무음 걷기로 안 걷힘) 다음 줄과 겹치니, 받아쓰기로 잰 마지막 낱말 끝 + 0.12초에서 자르고 0.06초 페이드한다(같은 폴더 `나레이션.cjs`의 `cut`). 「Nope!」「Three!」 같은 한 낱말은 받아쓰기 시각이 짧게 나와 자르지 않는다.
- 10-18 더한 경우(같은 영상 100 BPM 판): 빨리 돌릴 때(1.1~1.25배) 맞던 줄이 원래 빠르기(1.0~1.05배)로 되돌리자 믹스에서 「Heavy mouth?」→「Happy Mouth」, 「Believes anything!」→「Please anything」으로 들렸다(깨끗한 원본은 맞음). 줄 머리 첫 자음이 약해서다. 앞에 짧은 말을 붙여 「A heavy mouth?」·「They believe anything!」로 다시 굽자 믹스에서도 맞았다(화면 글은 그대로).
- 10-17 더한 경우(synkbrief 「GPTs·젬」, 범수 1.12배): 짧은 외래어가 문장 머리에서 빨리 지나가면 묻힌다. 「그럼 젬은요?」는 받아쓰기(faster-whisper medium)에 「그럼 쟤는요?」, 「젬은 네.」는 「재문 내」로 나왔다. 앞에 맥락 낱말을 붙이고(「그럼, 제미나이 젬은요?」) 쉼표로 숨을 주면(「젬은, 네.」) 「재미나이잼은요」·「GEM은」으로 또렷해졌다. 「GPTs」는 「지피티즈」가 「GPTG」로 뭉개져 「지피티에스」로 읽혔다(받아쓰기 「GPTS」).

### 효과음·킥이 말머리에 겹치면 첫 자음이 묻힌다
- 증상: 받아쓰기에서 「발이」가 「다리·파리」로 들렸다. 효과음 없는 같은 말은 정확했다(10-13, 장부 S17).
- 원인: 효과음·음악 구간 첫 킥·베이스가 첫 자음을 가린다. BGM −12dB로는 부족했다.
- 고침: 말하는 동안 효과음을 낮추고, 관용구 제목처럼 중요한 줄은 0.3초 전부터 BGM을 −24dB로 내린다.
- 다시 확인: 최종 믹스에서 줄마다 잘라 받아쓴다.
- 10-17 다시(관용구 퀴즈 #2 v4, Claude): 영어 줄을 효과음과 같은 박에 놓자 깨끗한 원본은 맞는데 믹스에서만 「Heavy mouth?」→「Happy Mouse!」, 「Thin ears?」→「Then ears?」, 「Believes anything!」→「I don't believe anything!」로 들렸다. 효과음을 30%로 줄이는 것으로는 모자랐다. 나레이션판에서는 줄머리와 같은 박의 효과음(그림 「뽀잉」, 정답 뒤 반짝·몽글)을 아예 빼고, 오답·정답 줄의 BGM을 −8dB → 약 −16dB로 내리고, 정답 줄을 「딩」 뒤 0.2초로 늦추자 「Heavy mouth?」는 바로 들렸다. 남은 「Sold!→soul」 같은 한 낱말은 받아쓰기 쪽 한계로 보고 귀로 판단한다. 코드 `docs/마케팅/LAB_관용구퀴즈2_20261017/remotion/src/kids/KidsFilm.tsx`(voSkip·depth).

- 10-20 다시(관용구 퀴즈 #4, Claude): 해요체 줄 「간이 콩알만 해졌어요」가 최종 믹스 받아쓰기(medium)에서 「해줬어요」로 들렸다. 줄 파일만 따로 받아쓰면 「해졌어요」로 맞았다. 그때 BGM은 한국어 줄 기본값 −12dB였다. 배울 문장인 해요체 줄(`_say`)도 오답·정답 줄처럼 −16dB로 내렸다(`docs/마케팅/LAB_관용구퀴즈4_간_20261020/remotion/src/kids/KidsFilm.tsx` depth).

### 받아쓰기 낱말 끝이 한국어 해요체 말끝을 0.4초쯤 일찍 잡는다 (2026-10-20)
- 증상: 10-20 관용구 퀴즈 #4에서 나레이션 줄 자리를 맞추려고 faster-whisper medium의 마지막 낱말 끝(`word_timestamps`)을 쟀다. 「간 떨어질 뻔했어요」는 1.28초로 나왔지만 파일 소리는 1.68초까지 났다(최고점 −32dB 기준). 영어 줄도 0.05~0.17초 일찍 잡혔다.
- 원인: 받아쓰기 낱말 시각은 말끝의 늘어진 모음·숨을 낱말 밖으로 본다. 해요체 「~요」 끝이 길게 끌리면 차이가 더 커진다.
- 고침: 다음 줄과 겹치는지 볼 말끝은 소리 에너지로 잰다. 10ms 창 RMS가 그 줄 최고점 −32dB 위에 있는 마지막 시각을 쓰고, 자르기(`cut`)는 그 값 + 0.06초로 둔다. 빠르기를 바꾸면 말끝 × (잰 빠르기 ÷ 새 빠르기)로 다시 셈한다. 보기 `docs/마케팅/LAB_관용구퀴즈4_간_20261020/remotion/대본_q4.mjs`(IDIOMS.en의 Speed·Cut).
- 다시 확인: `node 나레이션.cjs --판 …`의 겹침 경고가 지난 승인판에도 있던 것만 남는다. 최종 믹스를 줄마다 잘라 받아쓴다.

### faster-whisper를 `device='cuda'`로 부르면 cublas64_12.dll이 없다며 멈춘다 (2026-10-20)
- 증상: 10-20 이 노트북(RTX 5090)에서 `WhisperModel('medium', device='cuda', compute_type='float16')`이 모델은 읽고, 첫 받아쓰기에서 `Library cublas64_12.dll is not found or cannot be loaded`로 멈췄다.
- 원인: pip로 깐 faster-whisper(ctranslate2)는 CUDA 12 cuBLAS·cuDNN을 따로 찾는데 이 PC에는 그 DLL이 없다.
- 고침: 지금은 `device='cpu', compute_type='int8'`로 돌린다. medium으로 짧은 줄 15개는 2분 남짓, 36초 믹스 한 편도 2분 안팎이다. GPU로 돌리려면 NVIDIA cuBLAS·cuDNN 12 휠을 깔아 경로를 잡아야 한다(아직 안 함).
- 다시 확인: CPU 판으로 같은 줄을 받아써 글이 나오는지 본다.

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

### Typecast 목소리 목록의 상당수는 한국어 목소리가 아니다
- 증상: 10-19 한강2126 v40 조연 오디션에서 목록(`docs/마케팅/SHIFT_과정1편_20260921/audio/voice-catalog.json`, 359명)을 성별·쓰임새·잰 음높이로만 거르자 후보 23명 가운데 대부분이 스탈링·에이버리·노무라 토모코처럼 영어·일본어권 목소리였다. 목록에는 언어 칸이 없고 나이도 모두 young_adult다.
- 원인: ssfm-v30이 여러 말을 하는 모델이라 목록에 나라가 섞여 있다. 한국어 이름 표기(voice_name.kor)는 모든 목소리에 붙어 있어 이름으로는 못 가린다.
- 고침: 공식 미리듣기(preview_url) 앞 12초를 faster-whisper small(CPU)의 `detect_language`로 가려 `ko` 0.7 이상만 남긴다. 그날 거른 99개 가운데 한국어는 22개 남짓(영어 37·일본어 7·독일어·중국어 1). 그다음 YIN 음높이·억양 폭·밝기로 배역 목표에 가까운 순으로 고르고, 마지막은 들어보기 페이지로 귀에 맡긴다. 도구 `C:\Users\q1212\Videos\한강2126_새판_20261009\재촬영_v40\소리\오디션\목소리_후보고르기.py`(언어 판정은 `언어.json`에 쌓여 다시 받지 않는다).
- 다시 확인: 고른 후보로 구운 줄을 받아쓰기해 대사가 한국어로 맞게 들리는지 본다(`받아쓰기_확인.py`).

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

### 노트북 GPU가 다른 작업에 오래 잡혀 있으면 기다리지 말고 ZeroGPU로 돌린다
- 증상: 10-18 MiniMax H3 로컬 6컷(2시간)과 LoRA 학습(4시간, 15GB)이 GPU를 차례로 잡는 동안, 다른 세션들은 「GPU 비었어요」 메시지만 기다렸다. 노트북이 바쁘면 ZeroGPU로 넘기는 장치는 없다.
- 원인: GPU 하나(24GB)를 여러 세션이 나눠 쓴다. 유호님 10-18: 넘기는 도구는 만들지 않고 규칙으로 한다(「가벼운게 낫겠다」).
- 고침: GPU 작업을 넣기 전에 `nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader`와 `nvidia-smi --query-compute-apps=pid,used_memory --format=csv`, 세션 메시지로 다른 작업이 잡고 있는지 본다. 남은 메모리가 이번 작업에 모자라고(FLUX 약 12GB, SeedVR2 영상 23GB) 그 작업이 30분 넘게 이어지면 기다리지 말고 되는 것은 ZeroGPU로 돌린다: 블렌더 `cpuai/blender-render-studio`(`render_zerogpu.py`), FLUX 3 Klein `black-forest-labs/flux-3-image-klein`, Qwen-Image `hugging-apps/qwen-qwen-image-2-1-turbo`(`zerogpu_image_bench.py`), SeedVR2 그림 `Upsampler/seedvr2-3b`(`zerogpu_seedvr2_alt.py`), MiniMax H3 복제본 `q121235/h3-conditioner`·`h3-generator`(5초 한 편 할당량 233초, 부르는 법은 아래 「둘로 나뉜 ZeroGPU Space」 항목). SeedVR2 영상과 LoRA 학습은 ZeroGPU로 안 되니 기다린다. 유호님 얼굴·고객 자료는 남의 Space에 올리지 않는다. 하루 2,400초를 넘기면 선불 잔액에서 빠지니 넘기 전에 멈추고, 결과 보고에 ZeroGPU로 돌렸다고 적는다.
- 다시 확인: 남은 할당량을 [결제 페이지 데이터](#zerogpu-남은-할당량은-결제-페이지-데이터에-초-단위로-있다)로 읽고, 돌린 뒤 줄어든 초가 GPU 초 × 크기 배수와 맞는지 본다.

### 「GPU가 비면」 기다리는 사슬이 밤샘 학습 사슬 전체를 기다리고, nvidia-smi 일시 오류 한 번에 죽는다
- 증상: 10-20 지유 손 장면 사슬(`synk-vendor/…/영상_H3/손_사슬.py` 첫 판)이 13:48에 「invalid literal for int() … NVIDIA-SMI has failed because you do not have sufficient permissions」로 죽어 있었다(그 전엔 15분마다 「GPU 기다림」). 또 기다리는 조건이 「`학습_사슬.py` · `run.py` 프로세스가 없을 것」이라, 남은 학습 넷(9시간 남짓)이 다 끝나야 출발하게 되어 있었다.
- 원인: nvidia-smi가 가끔 권한 오류 글을 내놓는데 첫 줄을 그대로 숫자로 읽었다. LoRA 학습 사슬은 학습 사이 검증 · 다음 학습 넣기를 몇 분 안에 하고 틈을 넘겨주는 장치가 없으며, 사슬 프로세스는 밤새 살아 있다.
- 고침: VRAM 읽기는 세 번까지 다시 해 보고 실패하면 「바쁨」으로 본다. 틈이 필요하면 유호님 허락을 받아 ai-toolkit API(`localhost:8675/api/jobs`의 running 작업 step/총 스텝)로 지금 학습이 끝나기 직전(남은 25스텝)에 `학습_사슬.py` 프로세스를 `NtSuspendProcess`로 멈추고(「끝나기를 기다림」 고리라 도는 학습엔 안 닿음), 학습이 끝나 GPU가 비면 일을 한 뒤 `NtResumeProcess`로 푼다 — `finally`와 감시 타이머로 꼭 푼다. 같은 묶음 세션이 보도록 공유 노트 폴더에 알림을 남긴다.
- 감시 타이머 길이: 틈 작업이 실제로 걸릴 시간보다 넉넉히 길게 잡는다. 10-20 15:40 노트북 GPU가 80W 상한(`nvidia-smi -q -d PERFORMANCE,POWER`의 SW Power Cap Active · Current Power Limit 80W, 전원 구성표 「균형 조정」)에 묶여 학습이 스텝당 3.7초 → 6.9초까지 느려졌다. 틈 작업(H3 14~18분 + 124장 업스케일 + 마스크)도 그만큼 길어진다. 타이머가 작업 도중에 학습 사슬을 풀면, 학습 사슬의 GPU 빔 확인(30초마다 VRAM 4000MiB 아래)이 업스케일 → 마스크 사이 몇십 초 빈틈에 걸려 검증 ComfyUI와 SAM이 겹칠 수 있다. 그래서 50분 → 80분으로 늘렸다(보통은 작업이 끝나면 `finally`가 바로 푼다). 대기 중에만 다시 띄우고, 멈춘 뒤에는 다시 띄우지 않는다.
- 다시 확인: 가짜 프로세스(0.2초마다 시각을 적는 파이썬)를 멈추면 기록이 멈추고 풀면 다시 늘어나는지 본다(10-20 8 → 8 → 16). 실제 틈에서는 `손_사슬.log`에 멈춤 · 풂 줄이 짝으로 있고, 학습 사슬 기록에 다음 학습이 이어 들어갔는지 본다.

### GPU만 보고 기다리는 대기는 학습 사슬이 다음 학습을 넣는 틈에 걸려 겹칠 수 있다
- 증상: 10-20 한강 업스케일 대기 첫 판(`한강2126_새판_20261009/재촬영_v40/도구/업스케일_GPU대기.py`)은 「빈 VRAM 21.5GB 넘고 계산 프로세스 없음」만 5분 간격으로 두 번 봤다. 민재 v2 뒤에 보류 학습이 셋 더 있어, 학습이 바뀌는 틈마다 그 조건이 맞을 수 있었다(겹치기 전에 고침).
- 원인: LoRA 학습 사슬(`C:\SYNK-LoRA\validation\_v2공통\학습_사슬.py`)은 학습이 끝나면 1분 안에 검증 ComfyUI(2~4분)를 띄우고 곧이어 다음 학습을 넣는다. 5분 간격 두 번이 검증 앞뒤 빈틈에 걸리면 SeedVR2(23GB)가 다음 학습(15GB)과 겹친다.
- 고침: 틈에 끼우지 않을 거면 사슬·작업 프로세스(명령줄에 `사슬.py` · `ai-toolkit\run.py` · `main.py --listen` · `inference_cli.py`)가 하나도 없을 때까지 기다린다. 명령줄 맞추기는 PowerShell 안에서 하고 pid와 번호만 받는다(한글 무늬를 출력으로 받으면 코드 페이지에서 깨진다). 그러면 보류 대기열이 다 끝나야 출발하니, 빨리 필요하면 유호님 허락을 받아 학습 사이 틈에 끼운다(학습이 끝나기 25스텝 전에 `학습_사슬.py`를 `NtSuspendProcess`로 멈추고 일을 한 뒤 꼭 푼다 — 10-20 지유 손 사슬 방식).
- 다시 확인: 학습 중에 그 함수를 불러 사슬·학습 pid가 잡히는지 본다(10-20 17:30 14380 · 7224 · 19860 · 35468).

### 피부손 마스크에 「다른 쪽 팔」이 프레임마다 들락날락하면 부분 보정이 깜빡이고 얼굴 테두리까지 어긋난다
- 증상: 10-20 지유 세트 2에서 `--자동 피부손` 마스크가 훅 C는 오른쪽 아래 팔뚝(4만 화소)을 31~44번 프레임에서 한 장씩 켰다 껐고(이웃 겹침 0.864), 컷 4는 프레임을 바꾼 뒤 다시 만들자 왼쪽 팔(5.8만 화소)을 14번부터 갑자기 넣었다(0.828). 「겹침_최저」만 기록에 남고 실행은 그대로 끝나, 첫 v4 훅 C에 그대로 들어갔다.
- 원인: 「피부손」은 SAM 3가 첫 프레임에서 「hand」로 찾은 것을 더해 따라가는데, 볼에 댄 손 말고 몸 옆 팔도 걸렸다 빠졌다 한다. 게다가 `부분보정.마스크()`는 이웃 프레임을 무게중심으로 맞춰 1:2:1로 섞으므로, 덩어리가 들락날락하면 무게중심이 수십 px 움직여 얼굴 마스크까지 어긋나게 섞인다.
- 고침: 지유 `마스크_다듬기.py` — 프레임마다 0.5 넘는 자리의 「있는 비율」을 재서 0.05~0.95인 자리 가운데 두께 40px · 2만 화소 넘는 덩어리만 골라(움직이는 얼굴 테두리의 가는 띠는 열림 연산으로 빠짐) 모든 프레임에서 뺀다. 원본은 `<컷>_피부손/마스크_원본/`. `마스크_준비`는 원본 프레임 지문 · 장수만 보므로 다듬은 마스크를 덮지 않는다 — 업스케일 프레임을 바꾸면 마스크를 새로 만든 뒤 다시 돌린다.
- 다시 확인: 마스크를 만든 뒤 프레임마다 넓이와 앞 프레임 겹침을 찍어 본다(0.95 아래가 있으면 그 두 프레임의 차 자리를 그림으로). 다듬은 뒤 지유 컷 4 0.975 · 훅 C 0.985, 다른 세 컷은 덩어리 없음.

### H3가 시작 그림에 없는 물건을 같은 자리에 지어내면 시드 · 지시문을 바꿔도 같다 — 고정 카메라면 그 자리만 덮는다
- 증상: 10-19 지유 세트 2 컷 4(솜을 볼에 댄 옆모습, 고정 카메라)에서 H3 시드 42가 0.75~2.0초에 화면 오른쪽 가장자리에 올리브 가지와 흰 꽃병을 자라나듯 그렸다. 「Nothing new appears … no plants, branches or objects enter or grow」를 더하고 시드 7로 다시 뽑아도 1.0~2.25초에 같은 자리에 같은 것이 생겼다.
- 원인(추정): 세트 지시문(GLOBAL2)에 「olive branch」가 있고 그 컷 시작 그림의 오른쪽 가장자리가 비어 있어, 장면을 채우려 한다.
- 고침: 카메라가 고정(밀림 0.5px 이하)이면 다 생긴 뒤 구간을 키우고, 시작 프레임과 차가 큰 자리(사람 쪽은 빼고)만 생기기 전 프레임(0번)으로 덮는다 — 지유 `컷4_가지지우기.py`(넓혀 흐린 마스크, 자리 둘레 띠로 프레임마다 색 맞춤, 원본은 따로 둠). 최종 입자를 얹은 뒤엔 멈춘 판 티가 안 났다(Fable 2차: 패치 안 이웃차 0.6 대 둘레 벽 0.9).
- 다시 확인: 구간 살펴보기 표에서 화면 가장자리에 새 물건이 생기는지 먼저 본다. 세트 지시문에 소품 이름을 넣을 때는 그 컷 시작 그림에 이미 보이는 것만 넣는다.

### 끝 프레임을 고정한 H3도 가운데 1~2초는 머리를 움직이고 입을 연다 — 가만한 끝부분 + 마지막 장 멈춤으로 쓴다
- 증상: 10-20 지유 손에 든 병 컷(`영상_H3.py 7hs2`, 시드 42, H3_LAST=1, 「lips stay closed … her hand and the bottle stay perfectly still」)이 0.75~2.75초에 머리를 움직이고 한쪽 눈을 감으며 이를 보이고 웃었다(배경 밀림 최대 10px). 72~77번은 손 · 병이 제자리로 돌아오는 중이었고(병 자리 앞뒤 차 1.5~3.7), 78번부터는 0.01~0.7로 가만했다. 처음 정한 0~71 구간을 그대로 옮겼다면 말하는 얼굴이 마지막 장면에 들어갈 뻔했다.
- 원인(추정): 끝 프레임을 시작 그림으로 묶으면 처음과 끝만 고정되고 가운데는 움직임을 지어낸다.
- 고침: GPU 틈 한 번에 124장을 모두 키워 두고, 구간 살펴보기 표와 프레임별 앞뒤 차(얼굴 · 병 상자)로 가만해지는 번호를 찾는다. 거기부터 끝까지 쓰고 모자란 장은 마지막 장(= 시작 그림)을 되풀이한다(지유는 76~123 48장 + 24장 → 14.0초부터 로고가 떠오를 때 멈춘 화면). 편집 · 부분 보정이 프레임 i ↔ 마스크 i로 정해진 장수를 읽으므로 폴더에 장수를 채워 둔다(`synk-vendor/…/영상_H3/손_사슬_이어.py`).
- 다시 확인: 옮긴 뒤 0번과 차 · 앞뒤 차를 재고, 되풀이로 멈춘 화면이 「영상이 멈췄다」로 읽히지 않는지 폰 크기로 본다.

### H3 → SeedVR2를 거친 제품의 작은 글자는 엉뚱한 글자 모양이 된다 — 시작 그림의 글자를 프레임마다 맞춰 얹는다
- 증상: 10-20 지유 손에 든 병 컷에서 「맑음」 밑 「malgeum」과 「약산성 무향 토너 / pH 5.5 · 150 ml」(1080 화면에서 글자 높이 8~12px)가 업스케일 뒤 읽을 수 없는 글자 모양으로 바뀌고 「맑음」 획도 겹선이 됐다. 그대로 첫 v5 렌더(9:16 세 판)에 들어갔다.
- 원인: H3가 768폭에서 작은 글자를 뭉개고, SeedVR2가 흐려진 자리를 글자처럼 보이는 무늬로 새로 그린다. 영상 모델로 다시 그려도 작은 글자는 또 깨진다.
- 고침: 끝 프레임이 시작 그림에 고정된 컷이면 그 키프레임을 프레임마다 병 둘레 ECC 아핀으로 맞추고(상관 0.997, 이동 0.8px 이하) 글자 덩어리 사각형만 부드럽게 덮는다. 색은 둘레 띠로 맞춘다(지유 `컷7손_글자얹기.py`, 원본 프레임은 따로 둔다). 피부손 마스크가 그 자리에서 한 장만 튀면 그 화소만 앞뒤 중앙값으로 바꾸고, 마스크 기록의 원본 지문을 새 프레임으로 고쳐 SAM을 다시 돌리지 않게 한다(글자 자리가 마스크 밖일 때만).
- 다시 확인: 업스케일이 끝나면 제품 글자부터 키프레임 · 업스케일 프레임 · 고친 프레임을 3배로 나란히 본다. 움직일 때 덮은 자리만 굳어 보이지 않는지는 최종 입자를 얹은 영상으로 본다.

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
- 10-19 한강 v40 시험 ⑧: 시작·끝 그림 둘(`last_image_path`)로 175프레임(7.3초)도 됐다. 조건 GPU 6.8초, 생성 164초(27.3초/스텝 × 6), 할당량은 둘 합쳐 341초. 첫 `encode`는 그림을 올리다 `httpx.WriteTimeout`으로 끊겼고, `Client(..., httpx_kwargs={'timeout': httpx.Timeout(600)})`로 다시 돌리자 됐다. 도구 `C:\Users\q1212\Videos\한강2126_새판_20261009\재촬영_v40\시험\8_영상모델\run_h3_G12.py`.

### ZeroGPU 남은 할당량은 결제 페이지 데이터에 초 단위로 있다
- 증상: 「남은 할당량은 API로 안 나온다」로 알고 있었다(10-14).
- 원인: 크롬 로그인 `huggingface.co/settings/billing` 화면은 분 단위(0/40분)지만, 페이지 `data-props` 안 `"zeroGpu":{"current":<남은 초>,"base":2400,"resetsAt":…}`는 초 단위다. 차감은 예약 시간이 아니라 실제 GPU 초 × 크기 배수(xlarge 2배)다: 10-17 조건 7.5초 → 14.8초, 생성 109초 → 218.1초. 다 쓰면 선불 잔액에서 자동으로 빠진다(10분 $1). `resetsAt`은 첫 사용 24시간 뒤.
- 고침: 돌리기 전후로 결제 페이지를 새로 열어 zeroGpu.current를 읽고 뺀다.
- 다시 확인: 같은 읽기를 한 번 더 해 current가 줄었는지 본다.

## 블렌더 장면·회색 미리보기

> 판: Blender 5.2.2 LTS(워크벤치·EEVEE·Cycles, `-b --python`) · 10-18 한강2126 드론 동선 미리보기(`~/Videos/한강2126_새판_20261009/재촬영_v40/시험/블렌더_미리보기/`), 10-18 지유 광고 병 장면(`docs/마케팅/PULSE_포트폴리오_제작준비_20261012/video/jiyu-skincare-20261018/블렌더/`, Cycles CPU 미리보기)에서 실측 · Claude Code(Claude Opus 5.5)

### 겹친 두 덩어리를 한 절단 물체로 묶으면 불리언이 오류 없이 구멍을 안 낸다
- 증상: 벽에 아치 문을 내려고 상자 + 원기둥(반원 머리)을 한 메시로 묶어 EXACT 불리언 빼기를 걸었더니, 아치가 막힌 채 렌더됐다. 오류·경고는 없었다.
- 원인: 절단 물체 안에서 상자와 원기둥이 겹친다(자기 교차). EXACT 해법은 기본값(`use_self` 끔)에서 절단 물체를 겹침 없는 닫힌 덩어리로 보고 안팎을 가르는데, 겹친 부분에서 안팎이 틀어진 것으로 보인다(추정).
- 고침: 겹치는 덩어리는 절단 물체를 따로 만들어 불리언을 하나씩 건다(`장면짓기.py`의 `arch_cutter_x`가 두 개를 돌려준다). `use_self=True`로 한 번에 자르는 길은 시험하지 않았다.
- 다시 확인: 아치를 낸 벽을 정면에서 렌더해 문 너머 공간이 보인다(동선1 0061·0070 프레임).

### 워크벤치를 세계 기준 조명·그림자로 두면 실내가 통째로 그늘이고 천장이 한 가지 진회색이다
- 증상: STUDIO 조명 `use_world_space_lighting=True`·그림자 0.32로 그리자 사무실·계단실·면접실이 모두 어둡고, 천장을 올려다보며 오르는 1.5초가 한 가지 진회색이라 「천장 → 바닥판 단면(검정) → 위층 천장」이 갈리지 않았다.
- 원인: 워크벤치 그림자는 해 방향 하나로 떨어져 지붕·바닥판이 실내 전체를 가린다. 스튜디오 조명은 면 방향만으로 밝기를 정해 아래를 보는 천장은 늘 어둡다. 반사광은 없다.
- 고침: 카메라 기준 조명(`use_world_space_lighting=False`) + `studio.sl` + 그림자 끔 + 노출 0.45. 다섯 조명을 같은 프레임으로 견줘 천장·실내가 가장 밝았고 무대 LED 벽 앞 실루엣도 남았다. 천장을 지나는 장면은 0.6m 격자를 넣어야 다가가는 속도가 보인다. 카메라가 돌면 면 밝기가 바뀌므로 빛 참고로는 쓰지 않는다.
- 다시 확인: `렌더.py … route=3 frames=62,90`(천장 올려다보기)이 밝은 회색에 격자가 보인다.

### 바닥판 구멍 옆면이 벽면과 같은 면이면 반투명 줄무늬 띠가 생긴다
- 증상: 계단 통로 오른쪽 벽에 유리처럼 보이는 흰 줄무늬 띠가 비스듬히 지나갔다(동선1 0006~0030). 맞닿게 쌓은 4층 바닥판 단면 상자와 마감판 사이에서도 같은 줄무늬가 났다.
- 원인: 불리언으로 뚫은 계단 구멍의 옆면이 계단 통로 벽 안쪽 면과 같은 좌표였다. 같은 면 두 개가 깊이를 다투고(z-fighting) 8배 앤티에일리어싱이 섞여 반투명 띠로 보인다.
- 고침: 구멍을 벽 두께 안쪽까지 5cm 넓히고, 맞닿는 판은 5mm 안쪽으로 줄인다. 깊이 패스는 두 면 깊이가 같아 다시 그리지 않아도 됐다.
- 다시 확인: 동선1 0018 프레임 오른쪽 벽에 띠가 없다.

### 햇빛(Sun)으로 잎 그림자를 넣었는데 그림자가 보이지 않는다
- 증상: 10-18 지유 광고 병 컷 6(Cycles)에서 창빛 면적광 300W에 햇빛 세기 2.2·4.5와 잎 가림판을 더했더니 병·세면대에 잎 그림자가 전혀 보이지 않았다. 오류는 없다.
- 원인: 햇빛 세기는 조도(W/㎡)이고 면적광은 전체 와트다. 1.1m 떨어진 300W 면적광은 병 자리에서 대략 300/(π·1.1²) ≈ 66W/㎡라, 햇빛 4.5는 15배 약해 그림자가 묻힌다.
- 고침: 햇빛을 면적광이 주는 조도와 비슷하게 올린다(10-18: 햇빛 50, 창빛 200W, 노출 -0.7). 그림자를 받을 면이 카메라를 보도록 해 방향을 왼쪽 옆이 아니라 왼쪽 앞 위로 둔다. 가림판 그림은 잎을 그림 전체에 고르게 퍼뜨린다(가운데에만 있으면 그림자가 대상 옆으로 떨어진다).
- 다시 확인: 같은 장면을 햇빛만 켜고 렌더해 그림자 무늬가 대상에 걸리는지 먼저 본다.

### 사진을 붙인 발광 배경판이 AgX에서 회색 벽으로 눌린다
- 증상: 같은 장면에서 욕실 사진(밝은 창·흰 벽)을 발광(Emission) 판으로 병 뒤에 세웠는데, 세기 0.95·1.7에서는 흐린 회색 벽으로 보였다.
- 원인: 창빛을 받은 병·세면대가 훨씬 밝고, AgX는 밝은 쪽을 부드럽게 눌러 선형값 1 안팎이 화면에서 0.8 정도가 된다.
- 고침: 밝고 하얀 배경이 필요하면 발광 세기를 3 안팎으로 올린다(10-18: 3.2). 사진 속 커튼 주름을 흔들 때는 판을 따로 세우지 말고(흰 기둥처럼 보였다) 배경판 UV를 4D 노이즈로 창 쪽만 조금 민다.
- 다시 확인: 렌더에서 배경 흰 벽의 화소값이 사람 컷 키프레임의 벽과 비슷한지(230 안팎) 본다.

### 서리 유리 병 속 액체가 렌즈처럼 배경을 또렷이 비춘다
- 증상: 서리 유리(거칠기 0.27) 병에 투명 토너(거칠기 0)를 채우자 병 가운데에 「ㅅ」자 모양 밝은 무늬가 또렷이 생겼다.
- 원인: 속 액체 원기둥이 렌즈가 되어 뒤 배경판·세면대 모서리를 뒤집어 비춘다. 유리 거칠기가 낮으면 그 상이 다 흐려지지 않는다.
- 고침: 서리 유리 거칠기를 0.5로 올린다. 흰 실크 인쇄는 서리 유리·흰 배경에 묻히니 라벨 글자는 짙은 회색으로 한다.
- 다시 확인: 미리보기(25%·24샘플)로 병 가운데에 모양 있는 무늬가 남는지 본다.

### 어두운 세트에 맞춰도 서리 유리 병 접사는 노출 · 채움빛으로 거의 안 어두워지고, 띠 무늬 대리석 결은 흐림에 묻힌다
- 증상: 10-20 지유 세트 2(그레이지 회벽 욕실)에서 병 컷이 사람 컷(L* 51~64)보다 훨씬 밝고(컷 2 L* 90 · 컷 6 80) 대리석이 「결 없는 흰 탁자」로 읽혔다(Fable). 노출 −1.0스톱에도 컷 2는 81, 채움빛 60 → 10W · 주변광 0.35 → 0.08로 줄여도 85 안팎이었다.
- 원인: 서리 유리 + 액체 병은 창빛이 몸통을 지나 고르게 빛나고 접사에선 화면을 병이 채워, AgX 밝은 쪽 어깨에서 노출이 덜 먹는다. 웨이브 띠(BANDS) 결은 가는 줄이라 심도 흐림 · 밝은 노출에 묻혔다.
- 고침: 세트 2만 배경판 빛 3.2 → 2.0 · 노출 −0.4(컷 6 L* 80 → 71, 컷 2는 제품 접사라 85로 둠), 대리석은 노이즈 값 0.5 등고선을 결로 쓰는 두 층(굵은 결 배율 1 · 잔결 3.6, `병_장면.py`의 `marble_s2`, 인자 `--s2_plate/--s2_expo/--s2_vein`). 한 축으로 늘이면 결이 넓고 흐려졌다.
- 다시 확인: 중간 품질(50%·48샘플, CPU로 한 장 10초 안팎)을 다음 사람 컷과 나란히 놓고 대리석 결과 밝기(L*)를 본다.
## 로컬 AI 도구 깔기·돌리기

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
- 10-19 지유 광고: 출력 폴더가 한글 경로(`synk-vendor/…/영상_H3/업/`)면 기록에는 저장했다고 나오는데 PNG가 0장이었다(노드가 `cv2.imwrite`로 쓰고 실패 값을 보지 않는다. [윈도우_셸](윈도우_셸.md)의 cv2 한글 경로와 같은 원인). 입력도 영문 이름으로 복사해 `C:\SYNK-LoRA\work\jiyu_up`에서 돌리고 결과를 옮긴다(광고 폴더 `영상_다듬기.py`). 그렇게 돌린 6구간은 48·72장이 모두 나왔다(구간당 4.6~6.9분). VRAM을 23GB 가까이 써 LoRA 학습과 같이 못 도니, 학습 사이 틈에 끼운다(`C:\SYNK-LoRA\validation\_v2공통\학습_사슬.py`).

### 목소리 따라 하기 TTS(CosyVoice3)가 말을 끝맺지 못하고 최대 길이까지 뭉개진 소리를 낸다
- 증상: 10-19 하린 숨·웃음을 굽으려고 `FunAudioLLM/Fun-CosyVoice3-0.5B-2512`(`C:/SYNK-LoRA/tools/cosyvoice/`)를 시스템 파이썬 3.14 + torch 2.14 venv에 깔았더니, 결과가 모두 글 길이 × 20토큰(0.04초씩)의 최대 길이에서 잘렸고 말도 숨도 아닌 딸깍거리는 소리였다. 평범한 한국어 한 문장이 3초 대신 10.4초, 중국어 예문이 5초 대신 25.6초로 나왔다.
- 원인: transformers 4.57에서는 CosyVoice의 Qwen2 한 걸음 생성(`forward_one_step`, KV 캐시)이 어긋나 끝 토큰이 나오지 않는다. 저장소 requirements의 판은 4.51.3이다.
- 고침: venv에 **`transformers==4.51.3`**(tokenizers 0.21)을 깐다. 그 뒤 같은 문장이 3.28초·5.44초로 정상이었다. 그 밖에 깔 때 막힌 것: Matcha-TTS 쪽이 `lightning`·`gdown`·`pyarrow`를 부른다. `pyworld`(학습용 음높이)는 3.14 휠이 없어 빈 모듈로 채운다. `modelscope`는 받기용이라 빈 모듈이다. torchaudio 2.11 CPU의 `load`는 torchcodec이 있어야 해서 soundfile로 바꿔 끼운다(`소리만들기.py`). 가중치는 `받기.sh`(잠금 폴더 + `par_dl.py`)로 받고, TensorRT용 onnx는 받지 않는다(약 7.4GB). 빠진 모듈은 `불러보기.py`가 설정 파일의 모듈을 모두 불러 한 번에 찍는다. GPU를 LoRA 학습이 쓰고 있으면 CPU로 돈다(짧은 소리 하나에 수 초).
- 다시 확인: 굽기 전에 평범한 문장 하나(`작업_진단.json`)로 길이가 말 빠르기에 맞는지 본다. `[sigh]`만 넣으면 글이 한 토큰이라 최대 0.8초에서 잘리니 짧은 말 앞에 표시를 넣고 숨 부분만 오린다. 같은 날 `fishaudio/s1-mini`는 허깅페이스 이용 동의가 필요한 저장소였다(q121235 계정 미동의). 지금 fish-speech 코드는 S2-Pro(11GB, 동의 불필요, GPU 24GB 권장)·Drama 3(48GB 이상)를 쓴다.

## 영상 손보기(SAM 마스크·부분 보정·보간)

### SAM으로 얼굴만 따라가는 마스크를 만들 때 처리기가 torchvision을 찾고, 점 입력 단수가 틀리면 멈춘다
- 증상: 10-19 하린 5b 「얼굴만 살짝 밝히기」 시험에서 transformers 5.20.1 `Sam2VideoProcessor`가 「Sam2ImageProcessor requires the Torchvision library」로 멈췄고, 고친 뒤에는 「Input points must be a nested list with 4 levels … Got 5」로 멈췄다.
- 원인: SAM 2 처리기가 torchvision을 부른다. 점은 `[영상, 대상, 점, 좌표]` 4단, 표시(양성 1 · 음성 0)는 `[영상, 대상, 점]` 3단이어야 한다.
- 고침: `C:/SYNK-LoRA/tools/sam/`에 시스템 torch를 공유하는 venv + `transformers==5.20.1`(SAM 2 · SAM 3 영상 모델이 다 들어 있음) + `torchvision==0.29.1+cu130`(pytorch cu130 색인, `--no-deps`). 가중치는 `받기.ps1`(잠금 폴더 + `par_dl.py`)로 `sam2.1-hiera-large/`(0.9GB, Apache-2.0). 첫 프레임에 얼굴 점 셋(양성)과 머리카락 · 포니테일 · 옷 점 셋(음성)을 찍어 `마스크_만들기.py`로 48프레임을 따라가니 26초(모델 읽기 포함), 그래픽 메모리 최대 2.4GB(LoRA 학습 15GB와 같이 돎), 이웃 프레임 겹침 평균 0.992 · 최저 0.966이었다. 마스크는 얼굴 · 귀 · 목 · 쇄골 피부만 잡았다. 마스크 안 보정은 공용 색감 폴더의 `부분보정.py`(선형 빛 +0.25스톱, 경계 18px 흐림, 움직임을 맞춘 이웃 프레임 1:2:1 평균)로 얼굴 평균 +9.3/255, 마스크 밖 최대 0.16/255, 경계 빛무리 없음. 전후 영상 `전후_영상.py`(이름표는 PIL — ffmpeg drawtext의 한글 · 경로 이스케이프 함정을 피함).
- 다시 확인: `잰값.json`의 「겹침_최저」가 낮으면 먼저 움직임 때문인지 본다(10-19 4a 잔은 0.48이었지만 한 프레임 12px 이동이었고, 움직임을 빼면 0.82~0.97). 움직임을 빼고도 0.8 아래면 점을 다시 찍거나 중간 프레임에 점을 더한다. SAM 3(`facebook/sam3`, 3.44GB)은 메타 수동 승인 저장소다. 10-19에 크롬(q121235 로그인)에서 신청했고, 양식의 직함은 고르는 칸이라 「Founder」가 없어 「Other」로 냈다. 승인 확인 · 받기는 `sam3_받기.ps1`(승인 전에는 HTTP 403만 찍음, 큰 파일은 인증이 필요해 `par_dl.py` 대신 `hf_hub_download`). 신청 당일(10-19 13:35) 승인돼 있었다. `hf_hub_download`는 Xet 방식이라 3.44GB를 파일이 아니라 프로세스 메모리에 쌓으며 받다가 끝에 한 번에 쓴다(`.incomplete`가 0MB로 보여도 멈춘 게 아니다 — 프로세스 메모리가 느는지 본다, 약 10분). SAM 3 영상은 `Sam3VideoProcessor.init_video_session(video=프레임, inference_device="cuda", processing_device="cpu", video_storage_device="cpu")` → `add_text_prompt(세션, "glass")` → `model.propagate_in_video_iterator(inference_session=세션)` → `postprocess_outputs(세션, 출력)["masks"]`(대상별 참거짓 마스크). 보정 영역으로 쓸 때의 한계는 색감 README 「부분 보정」. SAM 3로 찾고 SAM 2.1로 따라가는 자동 점(`--자동 잔|피부`)을 만들며 막힌 것 둘: ① 같은 글의 후보를 합치면 엉뚱한 것을 따라간다 — 4a 「glass」가 뒤 골목 분홍 간판(점수 0.54)까지 잡았고, 손가락을 뺀 잔보다 간판 안쪽이 더 깊어 양성 점이 간판에 찍혀 손 마스크와 겹침 0이었다 → 점수가 가장 높은 후보 하나만 쓴다(0.95, 겹침 0.979). ② SAM 3 사진 모드 마스크가 정수 배열로 와서 `~`가 비트 반전이 되어 「대상 밖 거리」가 어긋났고 음성 점이 화면 구석(0, 40)에 찍혔다 → `.astype(bool)`로 바꾼다.
- 10-19 지유 시험(프레임 폴더 입력)에서 찾은 것: 증상 — 업스케일 PNG 폴더(`영상_H3/업/<컷>/<컷>`)를 원본으로 넘기자 `잰값.json`엔 `"장수": 48`이 적히지만 실제로는 폴더의 PNG를 모두 썼고, 같은 폴더에 프레임을 다시 만들어도 `마스크_준비`가 예전 마스크를 그대로 돌려줄 수 있다(코드를 읽다 찾음, 이번 컷은 폴더 처음부터 끝까지 써서 틀린 마스크를 입히진 않았다). 원인 — `마스크_만들기.load_frames`는 폴더면 `--시작` · `--장수`를 무시하고, 「원본_크기 · 원본_시각」은 영상 파일일 때만 적으며, `마스크_준비`는 폴더면 원본이 같다고 보고 장수만 맞으면 끝낸다. 고침 — 컷이 처음부터 끝까지 들어 있는 폴더만 넣고(지유 업스케일 폴더가 그렇다), 업스케일을 다시 하면 그 컷의 보관 폴더를 비운 뒤 다시 만든다. 10-19 고침: `마스크_만들기.py`가 폴더도 「원본_지문」(PNG 크기 합 · 가장 늦은 시각 · 장수)을 적고, `부분보정.마스크_준비`가 그 지문을 견준다(지문 없는 예전 폴더 기록은 한 번 다시 만듦, 다시 만든 뒤 `_raw` 캐시를 비움 — 같은 프로세스에서 예전 값을 읽던 것도 막음). 다시 확인 — `synk-vendor/…/색감/부분보정_시험/폴더지문_전후.py`처럼 임시 폴더의 PNG를 바꿔 다시 부르면 「새로_만듦」이 찍히고(고치기 전 판은 0초 만에 예전 마스크), 바꾼 것 없이 부르면 바로 돌아온다. 폴더를 넣을 땐 「프레임」이 그 컷의 장수와 같은지도 본다.
### 대사 클립의 목소리만 떼기(Demucs 4.1) — CPU로 돌리면 크롬이 멈춘다
- 증상: 10-19 한강 v34 대사 클립 14개(4~11초)를 Demucs로 떼는 동안 크롬 확장의 스크린샷·확대가 「Script injection timed out」·「Page.captureScreenshot timed out」으로 연달아 실패했다(Gemini 작업이 멈춤).
- 원인: GPU를 다른 작업(LoRA 학습, 15.7GB·100%)이 쓰고 있어 Demucs를 CPU로 돌렸고, `htdemucs_ft`(모델 넷 묶음)·`shifts=2`가 코어를 다 썼다(4분에 CPU 1,300초). 클립 하나에 30~60초.
- 고침: 깔기는 `C:/SYNK-LoRA/tools/demucs/`에 `python -m venv --system-site-packages venv`(시스템 torch 공유) → `pip install demucs`(4.1.0, 파이썬 3.14 휠 있음 — lameenc·sphn, torchaudio를 안 씀). 가중치는 첫 실행에 허깅페이스 `adefossez/HTDemucs-ft`에서 받는다(심볼릭 링크 경고는 `HF_HUB_DISABLE_SYMLINKS_WARNING=1`). 실행 `venv/Scripts/python.exe -X utf8 목소리떼기.py <출력 폴더> <입력…> [--gpu]` — ffmpeg로 44.1kHz 스테레오를 읽고 `<이름>_목소리.wav`(vocals)·`_바탕.wav`(나머지 셋 합)를 쓴다. 브라우저 작업과 겹치면 시작 직후 `(Get-Process -Id <pid>).PriorityClass='Idle'`로 우선순위를 낮춘다 — 그러자 크롬이 바로 돌아왔고 떼기는 그대로 끝났다.
- 다시 확인: 원래 소리와 `_목소리.wav`를 같은 받아쓰기 모델로 받아써 대사가 같은지 본다.

### 타이포그래피 타이틀은 HTML + 시각 함수 + Playwright 프레임 찍기로 만든다
- 증상: 10-19 한강 오프닝 타이틀을 「훨씬 감각적으로 타이포그래피 활용해서」 만들어야 했다. 가편집의 ASS 자막(고정 글자)으로는 글자를 사람 몸 뒤로 넣거나, 숫자를 굴리거나, 선을 그려 나가는 움직임을 못 만든다. HyperFrames는 키트 문서상 기존 영상의 수정·재현용이다.
- 원인: 움직이는 글자·가림판·SVG 선이 한 화면에 겹쳐야 하는데, 프레임마다 같은 결과가 나와야 영상에 얹을 수 있다.
- 고침: `재촬영_v40/타이틀/` — SAM으로 사람 가림판(`--자동글 "person"`, 탑뷰 한 장 16초) → `준비.py`가 누끼 PNG·몸 윤곽선 SVG 경로·컵 자리를 만들고 브랜드 서체(정본 `docs/브랜드_폰트/`)와 승인 로고 파일을 복사 → `시안.html`은 CSS 전환 없이 `window.seek(t)`가 그 시각의 화면을 그린다(배경 → 몸 뒤 글자 → 누끼 → 앞 글자 순서로 겹침) → `렌더.js`가 저장소의 Playwright로 시스템 크롬(`channel: 'chrome'`)을 띄워 24fps로 찍고 ffmpeg로 묶는다(3.4초 82장에 약 50초). file:// 페이지에서는 `fetch`로 JSON을 못 읽으니 `page.addInitScript`로 넣는다. 밝은 바닥 위 흰 분필 선은 옅어 보여 선 아래에 흐린 검은 그림자 선을 한 겹 더 깔았다.
- 다시 확인: 시트(착지 전 · 직후 · 중간 · 끝)로 글자·로고가 폰 크기에서 읽히는지, 가림판 가장자리가 튀지 않는지 본다. 최종 영상에서는 가림판을 프레임마다 SAM으로 따라가 같은 페이지에 프레임 번호로 넣는다.

### AI 영상이 뚝뚝 끊겨 보여도 파일은 멀쩡할 수 있다 — RIFE 보간은 ComfyUI 밖에서 돌린다
- 증상: 10-18 Flow Omni·Veo 영상이 「프레임 단위로 뚝뚝 끊겨 보인다」. 재 보니 파일은 24fps 고른 간격(0.0417초)에 겹치거나 빠진 프레임이 없었다. Wan은 30fps로 나오고(5장마다 큰 차이 — 안에서 24→30으로 바꾼 흔적으로 보임), 힉스필드 H3는 4장마다 작은 튐이 있다. 편집에서 Wan 30fps를 24fps로 맞추면 5장 중 1장이 빠진다.
- 원인: 24fps라 한 장당 움직임이 30fps보다 25% 크고, 60Hz 화면에서는 24fps가 고르지 않게 나온다. 실제 카메라만큼 움직임이 번지지 않는 것도 원인일 수 있으나 선명도 측정으로는 모델 차이가 뚜렷하지 않았다(추정).
- 고침: RIFE 4.9(`C:/SYNK-LoRA/tools/rife/rife_보간.py`, 가중치 HF `Isi99999/Frame_Interpolation_Models/rife49.pth` 21MB, 코드 `Fannovel16/ComfyUI-Frame-Interpolation`의 `rife_arch.py`)를 시스템 파이썬 torch로 단독 실행한다. `comfy.model_management`만 가짜 모듈로 채우면 공용 ComfyUI 환경을 건드리지 않는다. 720p 4초 96장 → 10배(240fps) 41~51초, VRAM 4.8GB(LoRA 학습 15GB와 같이 돌림). 240fps에서 8장마다 1장 = 30fps, 4장마다 1장 = 60fps, 가운데 5장 평균(`tmix=frames=5` 후 `mod(n,10)=2`) = 셔터 1/48초 번짐 24fps. 나란히 볼 때는 24·30·60이 고르게 들어가는 120fps 틀로 묶는다(`synk-vendor/…/비교/보간비교.py`). 10-18 유호님 「필요할때만 쓰자」 — 제작 단계에 기본으로 넣지 않고, 슬로모션·겹친 프레임 메우기처럼 필요할 때만 꺼낸다.
- 다시 확인: 프레임 차이를 재는 스크립트로 PTS 간격·겹친 프레임·주기적 튐을 먼저 보고, 보간본은 빠른 곳(떨어지는 얼음·날리는 머리) 사이 프레임을 잘라 겹침·뭉개짐이 없는지 본다.
