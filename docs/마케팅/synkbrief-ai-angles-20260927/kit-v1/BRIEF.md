---
workflow: general-video
flow: automation
storyboard: no
message: "제품 사진 한 장을 AI로 광고 세 컷으로 바꾸고 원본과 비교하는 방법 — SNS 키트판"
destination: instagram-reels
aspect: 1080x1920
language: ko
length: 56.5s
---

## Intent

2026-10-01 사용자 요청 「니가 바꿔준게 정말 훨씬 나아. 전에 쓰던 양식 이걸로 전부 다 교체해줄래?」에 따라 synkbrief 「사진 1장으로 광고 3컷」(2026-09-27)을 SNS 제작 키트의 모양과 모션으로 다시 만든다. 같은 날 「밋밋하고 재미없는 제작 컨텐츠는 아무도 안볼것같아」라는 말도 있어 키트 §9 템포(1.5초 안 화면 변화, 3~4초 장면, 전환 섞기, 낱말 자막)를 56.5초 전체에 적용한다.

## Assets

- 원본 프로젝트(`../`)의 내레이션 최종 믹스 `master.wav`(Edge TTS SunHi + 보유 Suno 음악 + 효과음), `audio-timing.json` 낱말 시각, 생성 이미지 4장(AI 예시), 실습 가이드 첫 쪽(`guide-preview.png`).
- SNS 키트 사본(`assets/synk-kit/`, `node tools/SNS키트_영상연결.js .`로 넣음).

## Customizations

- 계정 `brief`(청금석 색 면 + 흰 종이), 0초 화면 = 표지(제목 + 결과 세 장).
- 카메라 화면은 증거 장면 하나, 옛 창은 복사할 요청문 하나, 끝 장은 따라 하기 자료(맞춤 틀)와 행동 하나.
- 원본의 소리·장면 순서·사실·시간은 그대로 둔다.

## Notes

- 원본 MP4·표지·장면 파일은 건드리지 않는다. 렌더는 사용자 확인 뒤에 한다.
- 새 이미지·영상 생성 없음. 외부 게시 없음.
