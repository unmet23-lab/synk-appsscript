# 절차적 원단 재질 — 2026-10-10

담당 제품 파일은 `experiences/synk-world-home/avatar-textiles.mjs`다. 기존 몽글 본체용 `make(wool/knit/cotton)`와 avatar-v3의 몸·눈·기준 형상은 그대로 두고 의상 상세 재질을 확장했다. 새 미술 만족과 실물 휴대폰 성능은 숫자 검사만으로 확정하지 않는다.

## API·소유 계약

- `createAvatarTextiles({anisotropy,detailSize})` 및 `fabric(kind,repeat)`는 기존 호출을 유지한다. 기본 wool/knit/cotton은 기존 512 원문/픽셀이고 의상 detail 재질만 `detailSize >= 1024`일 때 1024, 그 외 512다.
- 새 canonical kind: `linen-detail`, `corduroy-detail`, `quilted-detail`, `velvet-detail`, `silk-detail`, `wool-felt-detail`. 이 여섯 plain 이름도 같은 상세 재질의 alias다.
- `fabric`은 color/sRGB map, linear normal map, AO(R)/roughness(G) 공용 packed map을 반환한다. 방향성이 있는 종류는 RG방향/B강도 `anisotropyMap`도 반환한다. map clone마다 repeat를 분리하고 생성된 원본·clone은 기존 `textures` 배열에 등록한다. AO와 roughness는 같은 clone을 공유한다.
- `wardrobeFabricProfile(kind)`는 복사한 plain 수치 object다. `roughness`, `normalScale`(number), `sheen`, `sheenRoughness`, `anisotropy`, `aoMapIntensity`, `clearcoat`, `clearcoatRoughness`를 제공한다. 호출자는 normalScale을 Vector2로 변환하고 sheenColor를 의상 basecolor로 정한다.

Root는 profile 연결과 예전 wax/hanbok/tie의 덮어쓰기 extra 제거를 담당했다. 형상·깃·패널·지퍼·파이핑·입체 미세털은 root의 `wardrobe-garments-v8.mjs` 범위다. 원단 scalar와 map 값의 곱이 같은 거칠기로 수렴하지 않도록 분리했다.

| 원단 | 1024 실효 거칠기 평균 | 주요 표면·빛 정보 |
|---|---:|---|
| cotton-detail | 0.8935 | 촘촘한 평직·낮은 광택 |
| denim-detail | 0.8023 | 사선 능직·방향성·면보다 낮은 거칠기 |
| knit-detail | 0.9474 | 연속 뜨개 고리·골 AO·넓은 sheen |
| wax-detail | 0.5334 | 코팅된 면·clearcoat 0.36/거칠기 0.23 |
| linen-detail | 0.9322 | 굵고 불균일한 실·느슨한 평직 |
| corduroy-detail | 0.8670 | 세로 골 normal/AO·결 방향 광택 |
| quilted-detail, 최종 delta | 0.8277 | 미세 polyester shell 평직·큰 봉제는 형상이 담당 |
| velvet-detail | 0.7116 | 세로 nap 방향·high sheen·부드러운 광택 |
| silk-detail | 0.2507 | satin float·낮은 거칠기·방향성 하이라이트 |
| wool-felt-detail | 0.9667 | 무작위 짧은 섬유·매트한 반사 |

이 값은 CPU canvas에서 map 녹색 채널 평균×profile scalar를 계산한 것이다. 실제 WebGL의 조명·시점·형상·UV·normal이 만든 최종 밝기 수치가 아니다. 실제 의상에서 scalar가 연결되는지와 결/빛이 보이는지는 model 담당의 같은 구도 사진과 material inspector 근거로 확인한다.

## 순수 검사와 보존 자료

초기 `textiles.test.mjs` 4개는 정상 exit0으로 통과했다. `textures-results.json`/`raw/`의 74 PNG는 초기 SHA `cb58f9fcdd76af152f8897871988a35fbb59ce102df51ebe3ced93e2c14b06c3`의 자료로 보존했다. 새 six canonical/alias, scalar 복사, 10종×512/1024 map·colorSpace·repeat clone·소유, normal 정규화, 실효 거칠기와 기존 base3종 실제 RGBA 동일을 검사했다. 이후 전체 helper를 실행하면 `textures-current-results.json`/`raw-current/`를 사용해 초기 자료를 덮지 않는다.

`preservation-results.json`은 최종 파일을 기준으로 avatar-v3 전체 16,254bytes가 before/current SHA `fee00167ac0e23d8f758e3ad6d1f9563cc06db4c4292238bd06e0e6198b9e33d`로 같고 base builder prefix도 동일함을 기록한다. 옛 보존 결과는 `preservation-before-quilted-results.json`이다.

## 퀼팅 봉제 delta

실제 `close-quilted.png`의 큰 X선은 초기 texture의 의도된 diamond normal/AO였다. Root의 네 가로 padded panel과 겹쳐 이중 봉제로 보인다는 실제 사진 피드백을 받아 `quilted-detail`의 weaveHeight/reflectance 두 분기만 수정했다. profile, 다른 원단, body builder는 바꾸지 않았다.

`node --test experiences/synk-world-app/qa/costume-materials-20261010/quilted-delta.test.mjs`의 2개가 정상 exit0으로 통과했다. `delta-quilted/result.json` 및 전후 512/1024 PNG 12개를 보존했다. 1024 AO최소값은 194→250, 16×16 큰 구역의 평균 AO 표준편차는 8.5278→0.0035로 큰 대각선 shadow가 제거됐다. 실효 거칠기는 0.8285→0.8277로 유지된다.

최종 textiles SHA는 `b9714655b651a87c970a6999841eb1cd54078985025c6448f0fe86fad30b6aa4`다. 이 담당자는 자체 GPU swatch를 실행하지 않았다. 외부 생성·유료 호출·공개 배포는 하지 않았다.

최종 실제 사진은 `runs/2026-10-09T20-22-23-069Z-after-focus-719c1a41/`에서 읽기 검토했다. `revised-close-quilted.png`에서 초기의 큰 X가 없어지고 가로 padded volume과 미세직조만 남았다. revised/equal-grey wool-felt에서 교차하는 개별 섬유가 보이고 silk의 좁게 이어지는 하이라이트와 다르다. velvet에는 짧은 pile 점이 생겼지만 일정 방향으로 누운 결은 여전히 은은하다. 숫자 검사만으로 모든 원단의 결이 강하게 구분된다고 확대하지 않는다. 모델 담당은 focus10/10/source18 일치와 GPU 종료를 보고했다. 해당 focus의 silk 끝단 삼각 끊김은 root/model의 별도 형상 offset delta 검수 범위이며 이 tex 변경과 구분한다.
