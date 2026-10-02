# synkbrief 01 · v12 차분한 여성 내레이션

2026-09-23 · 140.33초·18장면 · 음성 포함 검토본.

[영상 보기](http://127.0.0.1:5197/video-v12/preview.html?revision=15) · [MP4](synkbrief-meeting-v12.mp4) · [10쪽 PDF·자료 ZIP](../follow-along-v11/README.md) · [낭독 대본](낭독대본.md) · [낭독 자막](narration.srt)

사용자가 요청한 차분하고 부드러운 여자 목소리로 Typecast 은경을 사용했다. ssfm-v30, tonedown 0.5, 템포 1.04, 18구간·930자를 합성했다. 기존 Typecast Lite 연결과 크레딧 잔량, 현재 목소리 제공 여부를 확인했다. 원본 WAV와 단어별 시각은 audio/에 보존했다. 직접 청취에 의한 음색 평가는 아직 확인하지 않았으며 사용자가 검토할 수 있도록 실제 음성 샘플과 영상을 제공한다.

음성을 압축하지 않고 실제 길이에 맞춰 112초 영상을 약 140.33초로 조정했다. 자막 47개는 단어 타이밍에 맞췄다. 여덟 UI 장면의 클릭·붙여넣기·저장 효과를 실제 발화 시점으로 옮겼다. 프로젝트 개념, 회의 전용 폴더 비유, 프로젝트별 지침과 계정 전체 지침 구분, 원본과 결과 비교, PDF·댓글 synk 엔딩은 유지했다.

기존 Suno BGM은 유지했다. HyperFrames voiceover carve 0.45로 말소리와 겹치는 음악 대역·볼륨을 자동 조정한다. 뒤쪽 음악 연결은 같은 음원의 시작 부분을 2초 겹쳐 이어 붙이고 마지막 3초를 줄인다. 효과음도 클릭 시점과 함께 이동했다.

## 확인

1080×1920·30fps H.264/AAC. MP4/WebM 전체 디코드 통과. 47자막의 표시·장면 내 위치·음성 잘림 없음, 8개 카메라 장면 28시점의 타깃·커서 일치 확인. 1280/390px 미리보기의 재생·소리 토글·장면 이동·다운로드 통과. HyperFrames check 통과, 오류 0, 기존 단일 HTML 타임라인 등 구조 경고 21건. 음량 -17.06 LUFS / -2.77 dBTP. 검사 기록은 verification/에 있다.

실제 청취 품질 승인·SNS 게시·댓글 자료 자동 전달은 완료하지 않았다. 이전 v11 이하와 PDF 원본을 보존한다. PDF 내용은 v11과 같아 기존 10쪽 자료를 연결한다.

## 재제작

기존 음성을 쓸 때는 추가 합성 없이 `node prepare-voice.cjs`, `npm run build`, HyperFrames 렌더, `node build-preview.mjs` 순으로 진행한다. prepare-voice는 action-markers.json의 실제 발화 위치를 유지한다. 목소리·문장이 달라지면 기존 파일을 덮어쓰지 않고 별도 수정본을 만든다.

새 합성이 필요할 때만 `node voice-connection.cjs`로 localhost 연결 화면을 연다. 키는 메모리에만 보관한다. `node synthesize.cjs`는 이 편의 고정 대본만 생성하며 매 요청 전 월 크레딧 잔량을 확인한다. 연결 여부만 확인하려면 /status를 읽는다. 키를 로그·문서·채팅에 기록하지 않는다.

[Typecast 공식 타임스탬프 API](https://typecast.ai/docs/api-reference/text-to-speech/text-to-speech-with-timestamps), [구독 잔량 API](https://typecast.ai/docs/api-reference/subscription/get-subscription). 확인일 2026-09-23. ChatGPT 내용 근거는 [v11 자료 검토](../video-v11/research-and-review.md)를 따른다.
