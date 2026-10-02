---
workflow: general-video
flow: automation
storyboard: no
message: "회의 메모를 할 일·담당자·기한 표로 정리하되 없는 기한은 확인 필요로 남긴다."
destination: synkbrief YouTube Shorts, Instagram Reels, TikTok
aspect: 1080x1920
language: ko
length: 15s opening sample
---

## Intent
사용자의 '이어서 해'에 따라 새 제작 방식의 15초 도입 샘플을 실제로 만든다. 구체적인 상황을 먼저 알려주고, 이해도·요약·임팩트·여백·모션·소리를 함께 다듬는다. 기존 98초 전체 영상은 이번 샘플로 덮어쓰지 않는다.

## Assets
- `../prompt-v2-demo.txt`, `../demo-response-v2.txt`: 가상 회의 메모와 실제 ChatGPT 응답. 그림 속 표는 해당 응답을 읽기 좋게 재구성한다.
- 생성한 펠트 회의 장면: 상황을 설명하는 창작 일러스트. 실제 인물·실제 회의의 기록이 아니다.
- 기존 승인 SUIT·Inter Tight 서체. SYNK의 흰색·검정 기본 바탕, 청금석 강조색.

## Customizations
자료는 2026-09-22 확인한 공식 문서를 사용하며 research.md에 출처와 반영 위치를 남긴다. 회의 후 혼란 → 메모에서 정리 → 빈 기한 확인의 연속 변화를 만든다. 영상 생성과 렌더는 사용자가 요청한 계속 제작 범위다. 반복적인 기획·렌더 재승인을 요구하지 않는다.

## Notes
나레이션은 기존 연결이 가능하면 사용한다. 불가능하면 생성하지 못한 상태를 명시하며 새 결제·키 발급은 하지 않는다. 현재 내장 이미지 도구는 모델 지정 인자가 없으므로 GPT Image 2.5 사용을 단정하지 않는다.
