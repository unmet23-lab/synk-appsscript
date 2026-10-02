---
workflow: general-video
flow: automation
storyboard: no
message: "실제 인터뷰 표정을 유지한 4초 합성 시험을 원본과 비교한다."
destination: local-review
aspect: 1920x1080
language: ko
length: 4s
---

## Intent

사용자가 허락한 인터뷰의 실제 인물 표정을 재사용한다. 완성본 연출 승인이 아닌 합성 경계와 실사 인물 보존을 확인하는 4초 검토용 편집이다. 본편의 나머지 촬영은 AI로 진행하라는 요청과 별개로 이 시안은 실제 인터뷰 구간만 사용한다.

## Assets

- `../../video/real-actor-composite-4s-v1/source-master.mp4` — 1920×1080, 24fps, 4초 원본 구간.
- `../../video/real-actor-composite-4s-v1/composite-master.mp4` — 같은 샘플 순서의 합성 결과. 편집 타임라인의 유일한 영상.
- `../../video/real-actor-composite-4s-v1/portrait-480p.mp4` — 원본 제작자가 만든 480×854 세로 검토본. 이 프로젝트에서 별도 크롭하지 않는다.

## Customizations

- 장식, 표정 생성, 피부 보정, 색 필터, 속도 변경, 보간, 전환을 추가하지 않는다.
- 별도 검토 페이지에서 원본과 합성을 같은 시각으로 재생·정지·프레임 이동한다.
- 사용자 요청에 따라 제작과 로컬 검토는 승인되어 있다. 추가 승인 질문 없이 진행한다.

## Notes

- 외부 업로드, 게시, 계정 접근, 유료 생성 없음.
- 파일은 `prepare-media.ps1`로 복사한 뒤 로컬 media-use adopt만 실행한다.
- 소스 미존재 상태를 완성이나 재생 확인으로 보고하지 않는다.
