# 실제 이미지 생성 기록

2026-09-27 · 내장 `image_gen` 사용. 원본 1개를 생성한 뒤 이 동일한 원본 파일을 `referenced_image_paths`로 지정하여 3개의 편집 결과를 각각 생성했다. 모델 식별자는 도구 응답에 제공되지 않았다. 외부 참고 게시물의 이미지·영상은 사용하지 않았다.

## 파일 연결

| 파일 | 용도 | 생성 응답 파일 |
|---|---|---|
| assets/images/source.png | 가상 머그컵 기준 이미지 | exec-3effad24-25a3-4123-88f0-3b62922ce8bb.png |
| assets/images/hero.png | 전체 컷 | exec-9a6e68e3-f8d3-4c13-b963-841065ae1dd0.png |
| assets/images/detail.png | 가까운 컷 | exec-6bc4d8fd-7f38-4498-bedc-507d734aec02.png |
| assets/images/lifestyle.png | 사용 장면 | exec-913bec2e-a248-43ff-bb2f-1714b2dcd841.png |

## 실제 입력 프롬프트

### 기준 이미지
Use case: product-mockup. Create one photorealistic source product photograph for an educational tutorial about making three advertising photos from one source. A single cobalt blue glazed ceramic mug, straight gently tapered cylindrical body, generously rounded circular C handle on the right, thick rounded rim, matte-satin outside and glossy inside, no pattern, no lid, no logo, no text or numbers. The object is centered on an ordinary clean white tabletop against a pale gray-white wall, mild flat window light, straightforward unretouched smartphone inventory photograph. Show the whole mug with generous margin, 3/4 front angle slightly above so we can see the interior and right handle. Simple plain shape easy to preserve. No other objects, no steam, no hands. Portrait 4:5 image. True photographic material, no rendering look.

### 전체 컷
Use case: compositing/product advertisement. EDIT TARGET: the attached source photograph. Preserve this exact cobalt-blue ceramic mug: tapered cylinder, rounded rim, C handle, glaze and color, proportions. Re-stage the SAME mug for a premium minimalist editorial advertisement. Full mug in a three-quarter view, handle clearly visible to the right, standing on a white block plinth near a white sunlit wall. Warm afternoon hard light casts a beautiful long crisp diagonal shadow, otherwise realistic blue ceramic color. One out-of-focus small orange slice very far in background as a subtle warm color contrast, NOT covering product. Composition vertical 4:5 with mug large in lower 2/3, 20% quiet upper margin. High-end actual photography, striking light and tactile glaze, no CGI look. No text, no label, no logos, no extra mug, no people, no added features.

### 디테일 컷
Use case: compositing/product advertisement. EDIT TARGET: the attached source photograph. Keep the EXACT same cobalt-blue ceramic mug, identical tapered body, rounded lip, curved C handle, glaze color and material. Make a premium macro detail advertising photograph, closer camera to the existing handle and its junction to mug, and rounded top rim. Show most of the mug large, right handle very clearly, tighter frame with the left part slightly cropped. Same clean white surface and white studio background, soft directional daylight with delicate ceramic highlights. Blue stays blue, no speckles or embellishments added. Actual optical macro texture, subtle depth of field, believable clean real photograph. Portrait 4:5. No writing, no logo, no diagram, no other objects, no redesign.

### 사용 장면
Use case: compositing/product advertisement. EDIT TARGET: the attached source photograph. Preserve the EXACT cobalt blue ceramic mug object, proportions, rounded rim and right-side rounded C handle, same smooth glaze. Create a premium candid lifestyle photograph of the mug on a sunny white cafe table next to a blank white notebook and a simple silver pen. One natural adult hand gently holds the C handle from the right (handle remains visible), a small portion of a soft white shirt cuff. No face or person body. Eye-level three-quarter 50mm perspective, warm late afternoon sunlight, tasteful soft shadows, contemporary calm editorial advertising. Mug remains the main large central subject. Hand anatomically correct, no extra fingers; no second mug. Contents can be dark coffee within existing rim. Composition portrait4:5, no text, no branding, no readable writing, no product shape changes.

## 관찰
네 파일 모두 1122×1402. 파란색 무지 표면·테이퍼 몸체·C형 손잡이·둥근 테두리가 대체로 이어진다. 빛에 따라 표면 반사와 밝기는 바뀌며 픽셀 수준으로 동일한 제품을 보장하지 않는다. 사용 컷은 손·컵의 접촉이 자연스럽고 눈에 띄는 추가 손가락은 없다. 실재 제품의 성능이나 제조 규격을 검증한 자료가 아니다. 본편 프롬프트는 위 입력문의 핵심 조건을 한국어로 간추린 설명 그래픽이다.
