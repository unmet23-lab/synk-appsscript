# synkbrief 01 · v8 기록부터 시작하는 쉬운 가이드

2026-09-23 · 101초·17장면 · 1080×1920·30fps · 내레이션 삽입 전.

[미리보기](http://127.0.0.1:5197/video-v8/preview.html?revision=10) · [MP4](synkbrief-meeting-v8.mp4) · [10쪽 PDF와 복사용 파일](../follow-along-v8/README.md) · [화면 원고](../원고_v8.md) · [검토 기록](research-and-review.md)

회의 내용을 컴퓨터·메모장에 기록하는 익숙한 상황부터 시작한다. 음성 기록은 글로 변환한 뒤 같은 방법을 쓴다고 구분했다. 처음에는 메모 복사 → ChatGPT 입력창 → 제공 요청문 → 메모 자리 교체 → 보내기 → 표 읽기·원문 확인을 따라 한다. 그다음 반복 입력의 불편함을 설명하고 프로젝트 생성·지침 저장·다음 회의 재사용으로 넘어간다.

처음 쓸 `first-use.txt`와 프로젝트에 저장할 `project-instructions.txt`를 구분해 10쪽 PDF·ZIP에 넣었다. 기존 Suno 시티팝_147의 0–101초와 효과음을 사용했다. 내레이션 생성·삽입은 하지 않았다. 기존 v7 이하 결과물은 보존한다.

## 재생성

`content.json`이 장면 내용의 원본이다. `style.css`·`motion.js`는 화면과 GSAP 모션, `build.mjs`는 index.html/scenes.json을 만든다. `build-guide.py`는 가이드와 ZIP을 만들며 PDF 렌더 이미지를 `assets/guide-1.png`·`guide-3.png`로 복사한 뒤 영상을 렌더한다.

```powershell
node build.mjs
node build-preview.mjs
npx hyperframes check --json
npx hyperframes render --quality delivery --fps 30 --workers 2 --output synkbrief-meeting-v8.mp4
node verify-scenes.cjs
node verify-render.cjs
node verify-preview.cjs
```

원본 캡처는 v4의 텍스트 실습과 v6의 프로젝트 실습 자료다. 새 응답을 실행했다고 주장하지 않는다. 메모장·큰 표 등은 설명용 편집 그래픽이다. PDF 10쪽 시각 검사 및 요청문·지침 전문의 텍스트 일치, ZIP 무결성을 확인했다. HyperFrames 런타임·레이아웃 오류 0이며 린트 경고 20개는 단일 파일 장면 구성·트랙 밀도·일부 이미지 재사용 관련이다. 실제 초보자 이해도 조사와 사용자 최종 품질 승인은 별도다.

## 완성 파일 검증

MP4 101.000초·H.264/AAC 전체 디코드 통과, 0.3초 이상 검은 구간 없음. 렌더된 17장면과 모션 중간 18개 샘플 확인. 배경음·효과음 -22.85 LUFS, 피크 -9.22 dBTP로 클리핑 없음. 음량을 측정했으며 최종 청취 승인을 대신하지 않는다. 대비 53/53 자동 검사 통과.

WebM 전체 디코드, 1280/390px 재생·소리 토글·챕터 이동·canvas 프레임·PDF/ZIP/MP4 다운로드 검증 통과. 실제 인앱 브라우저에서도 새 URL·재생·챕터와 canvas 내용 표시를 확인했다.
