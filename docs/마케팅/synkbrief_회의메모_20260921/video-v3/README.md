# synkbrief 회의 메모 편 · 15초 도입 샘플

**2026-09-22 후속 피드백:** 사용자는 도입이 부자연스럽고 실제 입력·실행 과정과 이유·엔딩 제공 자료가 부족하다고 평가했다. 이 샘플은 재작업 대상이다. 최신 [수정 원고](../원고.md)와 [따라 하기 키트](../follow-along/README.md)를 따른다. 아래 검사는 기술 검증 이력이며 사용자 승인이나 이해도 검증을 뜻하지 않는다.

2026-09-22 · HyperFrames + Impeccable으로 새 도입 샘플을 제작하고 렌더했다. **15초 도입 검토본이며, 전체 사용법 영상의 완성·사용자 승인·SNS 발행은 아직 아니다.**

- [영상 미리보기](preview.html) · [실행 중인 미리보기](http://127.0.0.1:5197/video-v3/preview.html?revision=3)
- [MP4 원본](synkbrief-opening-v3.mp4): 1080×1920, 30fps, 15초, H.264 + AAC 스테레오.
- [공식 자료 조사와 장면 반영](research.md) · [스토리보드](STORYBOARD.md) · [제작 원본](build.mjs)
- [이전 회차 자료](../README.md) · [도구 조사](../디자인_영상도구_조사_20260922.md) · [유형별 양식](../../제작양식/AI_활용법.md)

## 이번에 만든 구간

| 구간 | 전달할 내용과 연출 |
|---|---|
| 0–3.8초 | “회의는 끝났는데, 누가 뭘 하죠?” 새로 생성한 펠트 회의 장면과 메모 문장으로 상황을 보여준다. |
| 3.4–10.6초 | 가상 회의 메모의 할 일·담당자·기한을 움직이는 단어로 연결해 표 두 행을 만든다. 기존 실제 응답을 읽기 쉽게 재구성한 그래픽이다. |
| 10.6–15초 | 완성된 표를 크게 보여주고, 미정인 기한은 ‘확인 필요’로 남긴다는 핵심을 강조한다. |

공식 자료는 **제작일인 2026-09-22에 다시 확인**했다. 담당자와 기한을 정리하되 원문에 없는 정보는 미지정으로 표시하고 검토하는 안내를 적용했다. 기존 ChatGPT 시연을 오늘 새로 실행한 결과로 소개하지 않는다.

상황 이미지는 내장 이미지 생성 도구로 새로 만들었다. [원본 프롬프트](assets/image-prompt.txt)와 [자산 출처·파일 해시](verification/delivery.json)를 보존했다. 도구 응답에 사용 모델명이 없어 **이 이미지를 GPT Image 2.5로 생성했다고 기록하지 않는다.**

## 소리

기존 SYNK 사운드킷의 notify와 achieve 효과음을 각각 4.55초·9.7초에 넣었다. **내레이션과 배경음악은 없다.** 기존 Typecast 임시 연결이 닫혀 있고 사용 가능한 인증 연결을 찾지 못해 음성을 생성하지 못했다. [음성 준비 상태](audio/audio-status.json)와 원고는 보존했다. 효과음 신호와 무클리핑은 파일 분석으로 확인했으며, 직접 청취 검증으로 기록하지 않는다.

## 확인한 범위

- [HyperFrames 검사](verification/hyperframes-check.json): 런타임 오류 0, 레이아웃 오류·경고 0, 대비 70/70 통과. 장면 진입 중 일시적인 텍스트 겹침 정보 1건과 구조 분리 권고 2건이 있다. 모션 자동 단언 검사는 설정하지 않았다.
- [Impeccable 기계 검사](verification/impeccable-detect.json): 검출 항목 없음. 이것만으로 미감이나 사용자 만족도를 보증하지 않는다.
- [완성 파일 정보](verification/ffprobe.json)와 전체 디코딩: 15초 MP4, 디코딩 오류 없음. 렌더 로그와 출력 프레임을 verification 폴더에 보존했다.
- 도입·변환 중간·결과의 인코딩된 프레임을 직접 확인했고, 별도 검토자가 세 정지 장면의 가독성·위계·여백을 확인했다. 정지 장면 검토로 읽는 시간과 움직임 전체를 평가했다고 간주하지 않는다.
- [플레이어 확인](verification/player-qa.json): 1440×1000, 390×844에서 재생·일시정지·장면 이동·탐색·음소거, 가로 넘침 없음. 실제 휴대폰 기기 확인은 아니다.

## 제작 환경과 재현

| 항목 | 실제 상태 |
|---|---|
| HyperFrames | 이 폴더의 개발 의존성 0.8.58. 로컬 Chrome/GPU로 450프레임 렌더 성공. |
| HyperFrames 스킬 | .agents/skills/에 설치. 원본 커밋은 [toolchain-lock.json](toolchain-lock.json) 참고. |
| Impeccable | 스킬 4.3.1, 실행 엔진 4.0.0. 프로젝트 로컬 캐시 사용. |
| 필수 환경 | Node.js 24.18.0, FFmpeg/FFprobe 8.1.2, 시스템 Chrome. |
| 선택 환경 | Docker·Whisper·Kokoro·MusicGen 미설치로 doctor 전체 결과는 false. 로컬 영상 렌더는 성공했다. |
| 기존 마감 도구 | DaVinci Resolve.exe 21.1.0.14 파일만 확인. 이 샘플은 Resolve를 거치지 않았다. |

이 폴더에서 실행한다. 의존성 복원은 `npm ci --ignore-scripts`를 쓴다.

```powershell
$env:HYPERFRAMES_NO_TELEMETRY = '1'
node build.mjs
npm.cmd run hf -- check --json --snapshots
npm.cmd run hf -- render --quality delivery --fps 30 --workers 2 --output synkbrief-opening-v3.mp4
ffmpeg -i synkbrief-opening-v3.mp4 -c:v libvpx-vp9 -crf 29 -b:v 0 -cpu-used 5 -row-mt 1 -c:a libopus -b:a 96k preview.webm
```

미리보기 서버는 상위 폴더의 preview-server.cjs를 Node로 실행한다. 이미 5197 포트에서 실행 중이면 중복 실행하지 않는다. 플레이어는 IAB용 WebM과 MP4 대체 소스를 사용하며, 기본 브라우저 영상 컨트롤 대신 별도 재생 버튼을 쓴다.

루트 package.json·AGENTS.md·DESIGN.md·자동 훅은 바꾸지 않았다. 이전 98초 검토본과 실제 시연 자료는 보존했다. 다음 작업은 이 도입에 대한 피드백 반영, 실제 사용 절차 연결, 내레이션 제작·직접 청취와 전체 영상 마감이다. 이 샘플은 아직 승인된 대표 양식이 아니다.

