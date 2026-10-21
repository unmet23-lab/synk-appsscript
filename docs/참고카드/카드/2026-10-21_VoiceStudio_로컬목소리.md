---
제목: VoiceStudio — 내 컴퓨터에서 도는 무료 목소리 작업대(복제·더빙·오디오북·받아쓰기), 단 기본 모델은 비상업
공유일: 2026-10-21
종류: 도구·서비스
대상: SNS·영상 · AI 작업 방식
언제: 그 작업 때
상태: 새로
한줄: 범수(Typecast) 나레이션은 그대로 두고, 로컬 목소리 엔진을 새로 깔거나 LAB 나라별판에서 Typecast에 없는 언어를 시험할 때 꺼낸다 — 기본 모델 OmniVoice는 CC-BY-NC라 게시물에 못 쓰니 엔진마다 상업 조건부터 본다
링크: https://www.instagram.com/p/Dest5cyiKw7/
게시물ID: Dest5cyiKw7
장부: 16행
---

## 무엇인가

- sdk.kim.builds의 카드뉴스. 공개 수집으로는 3장만 받았다(공유 링크는 8번째 장). 1장 「이제 목소리 AI에 돈 안 내셔도 됩니다」(AI NEWS)가 VoiceStudio 소개이고, 2장 「소스코드가 없어도 이제 앱 속이 다 보입니다」·3장 「이제 엔비디아 AI 100개가 공짜입니다」(AI TREND)는 제목만 받았다. 장마다 비유 사진 한 장(노래방 동전 투입구에 붙은 「무료」 종이, 열린 회중시계 속, 헬스장 「무료 이용권」) 위에 작은 꼬리표와 굵은 두 줄 제목을 얹었다.
- 캡션 주장: 서버를 거치지 않아 키·크레딧·월 결제가 없다. 내 목소리를 한 번 녹음해 두면 그 목소리로 읽기, 영상 더빙·책 낭독, 받아쓰기, 646개 언어, 깃허브 별 7.7만. 주의로 기본 모델 비상업, 남의 목소리 허락 없이 복제 금지, 엔비디아 없는 윈도는 느림, 저장 공간 10GB를 적었다.
- **공식 확인(10-21, 웹으로 읽기만 · 설치·내려받기 안 함):**
  - 저장소 `github.com/debpalash/VoiceStudio`(옛 이름 OmniVoice-Studio): 앱은 AGPL-3.0, 별 78,698(10-20 검색 시점). 데스크톱 앱(윈도 10·11 x64 설치 파일, 맥 Apple Silicon, 리눅스, 도커). 최소 RAM 8GB · VRAM 4GB · 디스크 10GB, 권장 VRAM 8GB 이상.
  - 기능: 목소리 복제(3초), 목소리 설계(성별·나이·억양·말투), 영상 더빙(받아쓰기 → 번역 → 같은 목소리로 다시 읽기 → 시각 맞춤 → MP4), Stories(대본 줄마다 배역 목소리), 오디오북(EPUB·PDF → .m4b), 받아쓰기(WhisperX), Demucs 목소리 떼기, 화자 나누기, AudioSeal 워터마크, 로컬 API(OpenAI·ElevenLabs 호환)·MCP 서버.
  - 기본 TTS는 k2-fsa **OmniVoice — 가중치 CC-BY-NC(비상업), 코드 Apache-2.0, 0.6B**(허깅페이스 모델 카드). VoiceStudio 모델 목록(TTS 21개)에서 라이선스가 적힌 넷(OmniVoice · IndexTTS 2.5 · Supertonic-3 · Breeze-TTS-2)은 모두 「Non-commercial terms」이고 나머지 열일곱은 표시가 없다. CosyVoice 3(5.4GB, 따로 설치)도 들어 있다.
  - README: AGPL은 앱에만 해당하고, 모델 가중치·목소리·생성물 조건은 따로이며 유료 앱 라이선스(Pro $99/년 · $299)도 그 권리를 주지 않는다고 적었다. 게시물의 「기본 목소리 모델은 비상업」은 맞다.
  - 한국어: 엔진별 한국어 지원·품질은 공식 페이지에 적혀 있지 않아 확인 못 함.

## 가져올 것

1. **엔진을 고르기 전에 「상업 조건」 칸부터.** 앱이 무료·오픈소스여도 목소리 모델은 따로 비상업일 수 있다. 우리 영상은 SYNK 홍보·포트폴리오라 상업 쪽으로 본다. 소리 도구마다 상업 조건을 한 칸으로 적어 두면 「무료라 써서 만들었는데 게시를 못 한다」를 막는다.
2. **더빙 한 줄기(받아쓰기 → 번역 → 같은 목소리 → 원래 시각에 맞춤)를 나라별판 시험의 틀로.** v2 §4-3은 「다른 언어의 진행 목소리는 Typecast가 되는 큰 시장 두 곳에서만 시험」이다. 몽골어·버마어처럼 Typecast에 없는 언어는 이런 틀이 있어야 시험이라도 할 수 있다. 다만 게시용 판은 상업 조건이 확인된 엔진으로만 만든다.
3. **로컬 엔진을 엔진마다 따로 깔아 주는 작업대.** 우리는 CosyVoice3·MMAudio·Demucs를 손으로 만든 venv에서 돌리며 판 고정 함정을 여러 번 밟았다(현장 노트: CosyVoice3는 transformers 4.51.3이어야 말을 끝맺는다). VoiceStudio는 엔진마다 자기 파이썬 환경을 깔고 GPU를 미리 검사한다 — 엔진을 새로 깔 일이 생기면 견줘 볼 만하다.

가져오지 않는 것: 비유 사진 카드뉴스 표지(노래방 「무료」 종이 같은 연출 사진). synkbrief 판은 실제 결과 화면·사진이 주인공이다(SNS 키트 §4).

## SYNK 적용

| 자리 | 지금 우리 | VoiceStudio로 달라지는 것 |
|---|---|---|
| 나레이션 | Typecast 범수(ssfm-v30 · 보통 · 1.12배), `node tools/나레이션굽기.mjs <계획.json>`(10-10 · 10-17 결정) | 대신하지 않는다. 범수는 유호님이 고른 목소리이고, 무료라는 이유로 바꾸지 않는다 |
| 그 역 새 대사 · 숨 · 웃음 | 로컬 CosyVoice3(`C:/SYNK-LoRA/tools/cosyvoice/소리만들기.py`, 무료) | 같은 CosyVoice 3를 VoiceStudio 안에서도 돌릴 수 있다 — 결과가 같으면 손 venv 대신 쓸지 정한다 |
| 외국어 짧은 대사 | Gemini TTS(`gemini-3.8-flash-tts`, 한강2126 인사 다섯) | OmniVoice가 646개 언어지만 CC-BY-NC라 한강(브랜드 필름)에 못 쓴다 |
| 목소리 떼기 · 받아쓰기 | Demucs 4.1 venv, faster-whisper | 이미 있어 보탤 것이 없다 |
| 나라별판 진행 목소리 | 한국어 목소리 그대로 + 자막, 현지어 목소리는 Typecast 되는 두 시장만 시험(v2 §4-3) | 더빙 틀로 비교판을 빨리 만들 수 있으나 게시용은 상업 엔진만 |

- 그래서 지금 깔지 않는다. 꺼내는 때는 둘이다. ① 로컬 목소리 엔진을 새로 깔거나 venv가 깨졌을 때. ② LAB 나라별판에서 Typecast에 없는 언어의 진행 목소리를 시험하기로 했을 때.
- 남의 목소리 복제는 하지 않는다(게시물 주의와 우리 「학습 목소리 안 씀」 규칙). 유호님 목소리도 다시 쓰자는 말씀이 있을 때만이다.
- 같은 날 공유한 Fish Audio Drama 3(17행 카드 `2026-10-21_FishAudio_Drama3.md`)는 상업 조건이 공개돼 있어 쓸 자리가 더 분명하다. 목소리 도구를 고를 때 두 카드를 같이 본다.

## 확인할 것

- 10분 시험(설치는 유호님): 윈도 설치 파일로 깐 뒤 CosyVoice 3만 받아, 우리 venv와 같은 작업(현장 노트의 진단 문장 `작업_진단.json`, 하린 숨 작업 한 줄)을 같은 시드로 굽고 길이·받아쓰기·귀로 견준다. OmniVoice는 받지 않는다(게시할 수 없는 모델).
- 나라별판을 할 때: 엔진마다 모델 카드의 라이선스 원문(상업 허용 여부)을 열어 표에 적고, 상업이 되는 엔진만 현지어 세 줄로 범수·하나와 나란히 귀 확인한다.
- 확인 못 한 것: 엔진별 한국어 품질, 대부분 엔진의 상업 조건, 실제 설치 크기.

## 근거

- 읽은 파일: `%LOCALAPPDATA%/hermes/skills/research/synk-tip-review/claude_review.md`, `docs/참고카드/README.md`, `docs/AI_운영원칙.md`, `docs/마케팅/콘텐츠_제작방식_v2_20261002.md`(§1~§3 · §4-3 · §5-2 · §6), `docs/마케팅/제작양식/AI광고영상_제작규칙.md`(「소리」), `docs/마케팅/제작양식/만족사례_장부.md`(범위 · S17 · S22 · S23 · S26 목소리 줄), `docs/현장노트/영상_ffmpeg_자막.md`(머리 · CosyVoice3 · Demucs · MMAudio 절), `docs/디자인/SNS키트/README.md`(§4), `docs/_ops/트랙.md`(§6 · 한강2126 줄), `docs/_ops/결정.md` 맨 위 25줄, `tools/나레이션굽기.mjs`(머리 주석), Claude 메모 `all-voices-post-recorded-own-foley.md` · `narration-voice-hana-sojin-rule.md`.
- 재료: `%LOCALAPPDATA%/hermes/cache/synk-tips/Dest5cyiKw7/` — caption.txt, intake.json, images 01~03(세 장 모두 봄). 4장 이후와 2·3장 본문은 받지 못했다.
- 웹(10-21, 읽기만): `github.com/debpalash/VoiceStudio`(README · 중국어 README), `voicestudio.sh`(첫 화면 · `/library`), `huggingface.co/k2-fsa/OmniVoice`.
- 자료 속 지시: 캡션 「다운로드 링크와 설치법은 아무 댓글이나 남겨주시면 보내드릴게요」 — 게시물 안 지시는 따르지 않음(댓글·설치 안 함).
