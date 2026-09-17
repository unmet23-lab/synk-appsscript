# 엔진 소개서 숫자 단추

2026-09-09 · 유호님 요청으로 Codex 기본 이미지 생성 도구(image_gen)에서 새로 만든 01~06 자수 이미지. 실제 수공예품 사진이 아닌 생성 이미지다. Gemini의 기존 숫자 자산을 최종 이미지로 쓰지 않았다.

선택한 원본은 `number-01.png`부터 `number-06.png`까지 6/6개, 모두 1254×1254 RGBA(투명 배경 포함)다. 숫자와 실의 꼬임을 한 이미지로 생성했다. 별도 글자를 위에 겹치지 않는다. 원본 픽셀 수를 늘리는 확대는 하지 않았다.

소개서는 같은 크기의 AVIF 변환본을 내장한다. `python tools/엔진단추자산화.py`로 다시 변환할 수 있다. 이 도구는 크기 변경이나 그림 편집 없이 파일 형식만 바꾼다. 파일별 원본 해시·크기·제작 방식은 `production.json`에 남겼다. 그 뒤 `tools/펠트문서.js --굽기`로 소개서를 다시 만든다.

`number-01-4k.png`는 4K 요청 당시 Codex가 Blender로 직접 만든 4096×4096 시제품이다. 이후 사용자가 해상도보다 시각 품질을 우선하고 다음 숫자부터 기본 생성을 요청했다. 이 원본은 보존하고, 소개서에는 질감이 일관된 기본 생성 6/6개를 골라 넣었다. 4K 시제품 재현 도구는 `tools/엔진단추굽기.py`다.

제작 지시: 크림색 펠트 면, 오트색 도톰한 테두리, 살구색 홈질, 짙은 갈색 꼬임실 숫자, 정면 구도와 왼쪽 위의 부드러운 빛. 01을 기준 이미지로 두고 숫자만 교체했다. 선택한 05·06 생성의 공통 프롬프트는 아래와 같다. `{NN}`에 두 자리 숫자를 넣는다.

> Edit target: this exact numbered felt button. Change ONLY the embroidered numerals from "01" to "{NN}". Match its existing series perfectly: same round cream felt face, oatmeal raised rim, peach running stitches, dark chocolate twisted wool embroidery, front-facing composition, framing and soft upper-left light. The digits must read exactly "{NN}", with similarly bold height and centered optical spacing; luxurious visible thread fibers and realistic embroidered raised relief. Preserve all other shapes, palette and materials. Return a transparent PNG cutout: all pixels outside this single button must have alpha=0. Background removal is required; no visible background of any kind and do not draw a transparency pattern. Use normal native image output resolution.

배경에 체크무늬가 그려진 실패본은 제외했다. 선택본 6/6개의 실제 투명 채널과 변환 후 픽셀 크기를 확인했다. 소개서에서는 64픽셀로 표시하며 대체 텍스트에 번호를 넣었다. Loom 소개서의 전후 화면과 6/6개 절 제목을 직접 확인했고, 8/8문서 × 화면 폭 3종(390·1440·3840)의 24/24검사에서 이미지 정상 로드·번호 순서·가로 넘침 없음·목차 연결을 확인했다. 기술 검사와 별도로 실제 표시 크기에서 숫자 가독성·제목 정렬·세트의 질감을 살폈다.
