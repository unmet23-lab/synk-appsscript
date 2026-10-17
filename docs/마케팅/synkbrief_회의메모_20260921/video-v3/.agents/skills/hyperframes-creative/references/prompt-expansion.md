# Prompt Expansion

과거 HyperFrames 장면 제작의 설계 메모 형식이다. 현재 요청과 [이 폴더의 적용 범위](../SKILL.md)를 따른다. 상세한 장면 분해가 구현에 도움이 될 때만 사용한다. 단순 수정이나 충분히 구체적인 원고를 매번 다시 확장하지 않는다.

## Prerequisites

- 해당 영상의 디자인 값은 `references/design-spec.md`의 파일 형식을 참고하되 현재 SYNK 승인 자산·서체를 우선한다.
- 여러 장면을 설계할 때만 `references/beat-direction.md`와 `references/video-composition.md`를 필요한 범위에서 읽는다.
- `house-style.md`는 선택형 예제다. 장식 수·ambient motion·배경 미세 요소를 채우기 위해 새 내용이나 장면을 만들지 않는다.

## Why always run it

과거 공급자 문서의 “항상 확장” 절차는 적용하지 않는다. 요청이 이미 충분하면 그 원고를 구현한다. 빠진 시간·전환·배치처럼 구현에 필요한 사항만 보완하고, 새 주장·추가 장면·별도 내레이션·음악은 요청 범위를 기준으로 판단한다.

## What to generate

필요한 항목만 짧게 적는다.

1. **Title + style block** — 승인된 색·서체·분위기와 출처.
2. **Rhythm declaration** — 장면의 빠르기와 쉬는 지점, 총 길이.
3. **Global rules** — 이 영상에서 실제로 선택한 공통 동작과 전환.
4. **Per-scene beats** — 목적, 보이는 내용, 배치, 동작, 다음 장면으로의 전환. 고정 요소 수를 맞추거나 빈 곳을 채우려고 내용을 만들지 않는다.
5. **Recurring motifs** — 내용 이해에 도움이 되는 경우만.
6. **Constraints** — 해당 요청의 사실성·가독성·자산·범위 제약.

## Output

후속 제작자가 재사용해야 하면 프로젝트의 `.hyperframes/expanded-prompt.md`에 저장한다. 대화에는 핵심 결정과 결과 위치만 알린다. 이미 승인된 제작은 이어서 진행하고, 아직 결정되지 않은 사항이나 범위를 넓히는 변경만 사용자에게 확인한다.
