---
mode: autonomous
message: "제품 사진 한 장으로 광고 세 컷을 만들고 원본과 비교한다"
audience: "AI로 직접 콘텐츠를 만들어 보려는 초보 실무자"
---

# 사진 한 장으로 광고 세 컷

실제 음성 파일 길이에 맞춘 56.5초, 1080×1920, 30fps. 8개 참고의 원본 콘텐츠는 재사용하지 않고 구성 원리를 변형했다.

## Frame 01 — 결과부터 / 0–6.6667s
작은 원본 한 장 옆에서 실제 AI 결과 세 장이 순서대로 교체된다. 큰 1과 3의 대비가 첫 3초의 약속이다. 결과 사진이 세 장의 인쇄물처럼 펼쳐지며 머그컵 한 개라는 연결을 유지한다. 모션: text-stagger의 GSAP stagger 구조, waterfall-entry의 짧은 진입, keyframes의 split-screen 및 transform. 효과음: 짧은 pop. 상태: animated.

## Frame 02 — 기준 사진 / 6.6667–14.9s
제품 사진이 파일 한 장으로 내려앉고 첨부라는 다음 행동이 크게 나타난다. 앱 화면을 흉내내지 않는 설명 그래픽이다. 모션: bounded paper rotation, power3 entry, upload nudge. 효과음: soft click. 상태: animated.

## Frame 03 — 고정할 조건 / 14.9–25.4333s
모양·색·재질 세 가지가 먼저 자리를 잡는다. 복사할 요청문이 읽는 속도에 맞춰 드러나며 마지막 글자 금지 문구가 강조된다. 모션: typed-prompt의 결정적 reveal 구조, css-marker-patterns 강조, waterfall-entry. 상태: animated.

## Frame 04 — 세 컷 / 25.4333–36.7333s
크게 펼쳐지는 전체/디테일/사용 장면이 각각 빛·질감·상황에 답한다. 한 사진을 단순히 확대하는 것과 실제 생성 사진 교체를 구분한다. 모션: keyframes slow reframe 및 종이 슬라이드 컷, finite transforms. 효과음: 짧은 whoosh. 상태: animated.

## Frame 05 — 원본 대조 / 36.7333–46.1s
동일한 원본 옆에 편집 결과를 고정하고 손잡이를 함께 표시한다. 모양·색·테두리를 확인하는 관점을 남긴다. 모션: css-marker-patterns의 circle 및 색 강조, 비교 두 사진은 계속 고정. 상태: animated.

## Frame 06 — 완성 예와 자료 / 46.1–56.5s
세 컷을 짧게 연결한 광고 예시 후 실제 완성한 PDF 첫 페이지와 복사문을 꺼낸다. 마지막은 팔로우와 댓글 synk 안내. 자동 DM이 작동한다는 주장은 하지 않는다. 모션: hard cut 및 finite slide/reveal, 텍스트 홀드. 효과음: chime. 상태: animated.

## 소리와 검증
SunHi 한국어 합성 여성 음성, 보유 Suno 시티팝 음악, 보유 효과음. 음성 실제 길이 및 word boundary로6단락/22개 자막 동기화. 직접 청취 여부는 검수기록에 별도로 기록한다. 모든 이미지는 실제 내장 imagegen 생성 결과이며 소스와 프롬프트를 보관한다.
