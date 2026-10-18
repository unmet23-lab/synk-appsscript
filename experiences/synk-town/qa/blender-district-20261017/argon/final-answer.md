# 아르곤 마지막 답 (agy stream-json result, 2026-10-17)

블렌더에서 Cycles GPU(OptiX/CUDA) 장치 인식과 glTF WebP 내보내기 설정을 확인하는 테스트 스크립트를 실행했습니다. 완료되는 대로 이어서 모델링과 굽기 작업을 진행하겠습니다.
공유 아틀라스 이미지와 `live_glass` 재질의 glTF 내보내기 구성을 검증하는 스크립트를 실행 중입니다. 완료되는 대로 본 모델링 스크립트를 작성하겠습니다.
기하 구조 및 절차적 재질의 법선 방향과 조명을 점검하기 위해 블렌더 미리보기 테스트 렌더링을 실행하고 있습니다. 완료되는 대로 결과를 확인하고 라이트맵 베이킹 단계로 넘어가겠습니다.
OptiX GPU 기반으로 3장의 2048×2048 라이트맵 아틀라스(`ground`, `upper`, `pavilion`) 베이킹과 노이즈 제거, 그리고 `out/cafe-argon.glb` 내보내기를 실행 중입니다. 완료되는 대로 검증 렌더링을 진행하겠습니다.
아틀라스 그룹 내 다중 메시 간 UV 겹침 문제를 해결하고 텍셀 밀도를 높이기 위해, 그룹 병합 후 단일 UV 언랩·베이킹·`part_id` 분할 방식으로 `scripts/bake_and_export.py`를 다시 실행 중입니다. 완료되는 대로 검증 렌더링을 확인하겠습니다.
구운 텍스처의 그늘 영역 알파(`sun_alpha`) 하한 보정 및 메시 이름 정리를 적용해 `out/cafe-argon.glb`를 다시 내보내고 두 검증 카메라 미리보기를 렌더링하고 있습니다. 완료되는 대로 결과를 확인하겠습니다.
싱크타운 찻집 구역(`town-cafe`) 블렌더 리모델링, 절차적 재질·조명 구성, Cycles OptiX GPU 확산광 굽기(Bake) 및 검증 렌더링을 완료했습니다.

### 1. `out/` 생성 파일 목록
- [out/cafe-argon.glb](out/cafe-argon.glb) — 구운 텍스처(WebP 3장)와 사용자 속성(`synk_bake_scale = 2.0`, `synk_sun_alpha = 1`)을 포함한 최종 GLB 자산 (`3.151 MB`)
- [out/preview-follow.png](out/preview-follow.png) — 내보낸 GLB 재임포트 후 `Standard` 보기 변환 + `Emission(텍스처 × 2.0)`로 렌더링한 따라가기 시점 미리보기 (`1280×900`)
- [out/preview-close.png](out/preview-close.png) — 같은 조건으로 렌더링한 가까이 시점 미리보기 (`1280×900`)
- [out/report.json](out/report.json) — 메시·재질·텍스처·예산·굽기 시간 및 규격 준수 요약 보고서

*(중간 작업본은 [work/cafe-argon.blend](work/cafe-argon.blend), 생성·굽기·검증 스크립트는 [scripts/geo_builder.py](scripts/geo_builder.py), [scripts/mat_builder.py](scripts/mat_builder.py), [scripts/bake_and_export.py](scripts/bake_and_export.py), [scripts/render_previews.py](scripts/render_previews.py)에 있습니다.)*

---

### 2. [out/report.json](out/report.json) 요약
- **삼각형 / 메시 수**: 총 `50,496` 삼각형 (예산 `60,000` 이하), 총 `10`개 메시 (예산 `24`개 이하)
  - `cafe_ground` (`7,952` tris), `cafe_maru` (`3,716` tris), `cafe_wall` (`1,124` tris), `cafe_timber` (`11,804` tris), `cafe_roof` (`10,212` tris), `cafe_awning` (`7,148` tris), `cafe_ceramic` (`3,376` tris), `cafe_metal_lantern` (`2,160` tris), `cafe_foliage` (`2,968` tris), `cafe_glass` (`36` tris)
- **재질(`10`개) 및 텍스처(`3`장)**:
  - 구운 재질 9종(`bake_ground`, `bake_maru`, `bake_wall`, `bake_timber`, `bake_roof`, `bake_awning`, `bake_ceramic`, `bake_metal`, `bake_foliage`): 모두 `synk_bake_scale = 2.0`, `synk_sun_alpha = 1` 부여
  - 실시간 유리 1종(`live_glass`): `#bedbd5`, `roughness = 0.1`, `opacity = 0.29`
  - WebP 텍스처 3장(`2048×2048` RGBA): `tex_bake_upper` (`651.5 KB`), `tex_bake_pavilion` (`512.0 KB`), `tex_bake_ground` (`468.9 KB`)
- **GLB 용량**: `3,303,732 bytes` (`3.151 MB`, 예산 `6.0 MB` 이하)
- **굽기(Bake) 설정 및 소요 시간**:
  - 장치: `NVIDIA GeForce RTX 5090 Laptop GPU` (`OPTIX`)
  - 샘플 수: 전체 확산광(`DIRECT + INDIRECT + COLOR`) `512` 샘플 + OpenImageDenoise + 아일랜드 내부 양방향 필터링, 태양 직접광 비율(`sun_alpha`) `64` 샘플
  - 소요 시간: 아틀라스 3장 합계 약 `123.3초` (전체 파이프라인 `134.8초`)
- **규격 미준수 항목(`unmet_requirements`)**: 없음 (마루 윗면 `y = 0.1295`, 돌마당 윗면 `y = 0.103`, 찻상 윗면 `y = 0.726`, 처마 `2.1m` 이상, 구역 경계 `x ∈ [-3.0, 3.0], z ∈ [-3.4, 5.35]` 높이·색 연속성 모두 충족)

---

### 3. 미리보기(`preview-follow.png`, `preview-close.png`) 자체 점검 및 아쉬운 점
- **구도 및 색감 일치**: v20 기준 화면과 나란히 비교했을 때 돌마당 판석 줄눈, 마루 판재의 단차·모따기(Bevel), 기둥 밑동 주춧돌과 나무 결, 기와 골과 마루 용마루, 찻상 위 다기 세트의 접촉 음영(AO)이 자연스럽게 살아났습니다.
- **아쉬운 점**:
  1. **유리창(`live_glass`)의 미리보기 표현 한계**: 검증 렌더러에서는 다른 모든 재질이 `Emission` 단일 셰이더로 바뀌고 별도 광원이 없는 상태라, 유리창의 프레넬 반사·하늘 비침이 실제 게임(Three.js 환경맵 반사)보다 평면적인 반투명 민트색 막처럼 보입니다.
  2. **화분 잎사귀(`cafe_foliage`)와 안내 천 자수 실의 텍셀 밀도**: 여러 부위가 `2048×2048` 아틀라스 3장을 나눠 쓰다 보니, 가까이 카메라(`preview-close.png`)에서 작은 화분 잎사귀나 청금석 안내 천의 흰 스티치 자수 실을 확대해 보면 텍스처 그라데이션이 다소 부드럽게 뭉개져 보입니다.
  3. **마루 판재 사이 틈의 깊이감**: 판재 모따기와 줄눈 틈 아래 어두운 하부 판재를 넣어 틈새 음영을 잡았으나, 비스듬한 카메라 각도에서 보면 틈새의 그림자 대비가 살짝 얌전해 아틀라스 내 마루 윗면 비중을 조금만 더 키웠다면 나뭇결 미세 요철이 한층 더 또렷했을 것 같습니다.

