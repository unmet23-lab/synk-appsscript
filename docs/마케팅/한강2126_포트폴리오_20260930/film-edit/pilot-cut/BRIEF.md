---
workflow: general-video
flow: companion
storyboard: no
message: "LAB의 짧은 행동과 두 사람의 반응을 확인하는 검토용 파일럿"
aspect: 1080x1920
language: ko
length: 6.125s
---

## Intent

새 Seedance 2.5 LAB 8초 소스에서 지정된 두 구간만 이어 147프레임의 검토본을 만든다. 실제 사용자 영상 제작·수정 승인이 있으며 주 작업자가 해당 편집과 렌더를 위임했다. 추가 사용자 승인 요청 없이 check와 실제 렌더·검증까지 수행한다.

## Assets

- `../../video/lab-cinema-action-8s-seedance25-v1.mp4` — HEVC 1080×1920, 24fps, 비디오 193프레임/8.041667초, 파일 8.05초, AAC 오디오.
- `assets/video/lab-cinema-action-8s-seedance25-v1.mp4` — 편집 프로젝트의 동일 로컬 복사본.

## Customizations

- source frames 0–102 inclusive → 103 frames.
- source frames 148–191 inclusive → 44 frames.
- 총 147프레임, 6.125초. 출력은 1080×1920, 24fps.
- source frames 103–147 및 192는 제외한다. 5.5초 부근의 관련 없는 물 장면은 출력에 없다.
- source 영상과 오디오를 같은 경계에서 hard cut한다. 추가 모션·음악·텍스트·끝카드는 없다.
- 최종 경로: `../../video/lab-cinema-action-tight-review-v1.mp4`.

## Notes

- 상위 58초 프로젝트의 hold는 유지한다. 이 결과는 별도 검토용 파일럿이며 전체 영상의 승인이나 완료가 아니다.
- 사운드 클릭이 확인되지 않은 상태에서 임의 fade를 추가하지 않는다.
