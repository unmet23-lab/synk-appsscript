# synkbrief 01 · 두서없는 회의 기록을 읽기 쉬운 회의록으로

2026-09-27 최신 · [159.70초 v19 마감본](video-v19/README.md). v18의 설명·Typecast 은경·Suno BGM을 유지하면서 전환 22곳, 부드러운 클릭·전환 소리, 결과 항목별 등장과 엔딩 강조를 다듬었다. 자막 겹침 11곳을 수정했다. 23장면·53자막·1080×1920·30fps. 바탕화면 대표 영상을 갱신하고 v18은 보관했다. 사용자 최종 검토와 영상 게시 전이다.

[v19 영상 보기](http://127.0.0.1:5197/video-v19/preview.html?revision=26) · [공개 자료 페이지](https://synk.im/brief/meeting/) · [11쪽 PDF·한글 키트](follow-along-v15/README.md) · [Instagram 자동 DM 연결 상태](instagram-delivery/README.md)

[2026-09-26 업로드 전 최종 점검](업로드전_최종점검_20260926.md): 영상·자료 검사는 통과했으며 댓글 자동 DM의 실수신 확인은 남아 있다.

**10-13 쇼츠 새 디자인:** 유호님 「디자인이 좀 후져 보인다」 → 45초판과 같은 순서·내레이션으로 디자인만 다시 만든 [v20 쇼츠(45.2초)](video-v20/README.md). 흰 바탕 + 실제 ChatGPT 화면 확대 + 청금석 선택 표시, 카메라 고정. 게시 전이다.

## 이전 v3 도입 검토 이력

**최신 검토 상태:** 사용자는 98초 2차본도 이해도·요약·임팩트·디자인·여백이 부족하다고 평가했다. [도구 조사](디자인_영상도구_조사_20260922.md) 뒤 HyperFrames + Impeccable로 [15초 v3 도입 샘플](video-v3/README.md)을 렌더했다. 새 펠트 상황 이미지와 [공식 자료 조사](video-v3/research.md)를 반영해 메모 → 표 → 미지정 기한 ‘확인 필요’를 보여준다. 기존 승인 효과음 2개를 넣었으며 Typecast 연결이 닫혀 있어 내레이션은 없다. 전체 튜토리얼을 대체하는 완성본이나 사용자 승인·발행 완료 콘텐츠가 아니다.

[15초 도입 미리보기](video-v3/preview.html) · [v3 MP4](video-v3/synkbrief-opening-v3.mp4)

v3는 1080×1920·30fps다. HyperFrames 검사에서 레이아웃 오류·경고 0건·대비 70/70 통과·런타임 오류 0건, Impeccable 검출 0건을 확인했다. 자동 검사 결과와 사용자 시각 품질 승인은 구분한다. 상세 제작·검증은 [v3 작업 기록](video-v3/README.md)을 따른다.

## 이전 98초 2차 검토본

[영상과 게시 문안 보기](index.html) · [영상 MP4](video-v2/synkbrief-01-meeting-tasks.mp4) · [표지](video-v2/cover.png)

이전 48초 버전에 대한 사용자 피드백은 ‘처음에 어떤 상황인지 알려주고, 훨씬 이해하기 쉽고 상세해야 한다’였다. 새 도입은 ‘메모는 남겼는데, 누가 언제까지 뭘 하기로 했죠?’이며, 완성 결과를 먼저 보여준다.

입력창 위치 → 복사용 입력문 붙이기 → 표시된 자리만 내 메모로 교체 → 한 번에 보내기 → 결과를 원문과 대조하는 순서다. 민호의 기한이 ‘확인 필요’인 이유와 다음 회의 날짜를 마감으로 쓸 수 없는 이유도 설명한다.

- 공통 영상 1편: 98초, 1080×1920, 30fps, H.264. 실제 화면 캡처를 편집한 무음 자막형 검토본이며 연속 화면 녹화는 아니다.
- [YouTube](posts/youtube.txt), [Instagram](posts/instagram.txt), [TikTok](posts/tiktok.txt) `@synkbrief` 게시 문안 3종.
- [복사용 입력문](prompt-template.txt), [설명 원고](원고.md), [실제 영상 자막·타임라인](video-v2/scenes.json).
- 음성·BGM은 미포함이며 SNS 게시·예약은 하지 않았다.

## 실제 시연

새로 쓴 가상 회의 메모를 ChatGPT 임시 채팅에 직접 넣었다. [입력](prompt-v2-demo.txt), [응답](demo-response-v2.txt), [입력 화면](assets/v2/03-filled.png), [응답 화면](assets/v2/05-result-desktop.png)을 보존했다.

지수의 기한은 9월 23일, 민호의 기한은 ‘확인 필요’로 나왔다. 인터뷰는 확인할 질문으로 분리됐고, 다음 회의 날짜는 기한으로 사용되지 않았다. 특정 모델의 우열이나 항상 같은 결과를 주장하지 않는다. 마지막에 민호에게 묻는 문장은 편집 예시이며 실제 전송한 메시지가 아니다.

영상 속 UI는 실제 화면을 자른 것이다. 입력창 전체와 확대 장면을 함께 사용한다. 큰 설명 글자와 화살표는 편집 요소다. [자르기 기록](assets/v2/crop-provenance.json)에 원본과 범위를 남겼다.

## 확인과 보존

11컷과 입력창 전체 화면 2종의 서체·이미지·핵심 글자 영역을 검사했다. 인코딩된 영상에서 입력창 전체→확대, 메모 교체 뒤 전체 화면, 순차 설명 장면을 확인했다. FFmpeg 전체 디코드도 통과했다. 수치와 파일 지문은 [검증 기록](verification.json), [렌더 정보](video-v2/video-metadata.json)에 있다.

이전 영상은 `video/`, 원고는 [원고_v1_보관.md](원고_v1_보관.md), 게시 문안은 `posts-v1/`에 보존했다. 기존 `index.html` 미리보기는 `video-v2/`를 사용하며, 새 도입 샘플은 별도 `video-v3/preview.html`에서 본다.

## 98초 2차본 재생성

저장소 루트에서 실행한다.

```powershell
node docs/마케팅/synkbrief_회의메모_20260921/video-v2/crop-demo.cjs
node docs/마케팅/synkbrief_회의메모_20260921/video-v2/render.cjs --render
node docs/마케팅/synkbrief_회의메모_20260921/build-preview.cjs
node docs/마케팅/synkbrief_회의메모_20260921/preview-server.cjs
```

미리보기는 `http://127.0.0.1:5197/`이다. 렌더러는 로컬 Playwright·Sharp, Chrome·FFmpeg를 사용한다. 브라우저에는 VP9 WebM 사본과 일반 HTML 재생 버튼을 제공하고, 저장 링크는 MP4를 제공한다. 현재 렌더에는 외부 업로드·음성 생성 API 호출이 없다.

