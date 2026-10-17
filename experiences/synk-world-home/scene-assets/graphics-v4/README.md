# 몽글 정적 제작 후보 v4

> 아래 `roundtrip.png` 비교 원본은 [보관 목록](../../../../docs/_ops/github-storage/archive-20261017.json)에 있다. 새 체크아웃에서는 저장소 루트에서 `python tools/git-storage-restore.py --path "experiences/synk-world-home/qa/graphics-v4-export/roundtrip.png"`로 복원한 뒤 이미지 열기·과거 manifest 재산출을 진행한다.

2026-10-09. 웹의 공통 `avatar-v3.mjs`와 `avatar-textiles.mjs`를 그대로 내보낸 정적 후보다. 캐릭터 API/ID는 v3와 호환되며 **재질 revision은 4**다. 최종 미술 승인·리깅·Unity 렌더를 완료한 자산은 아니다.

- [GLB](mongle-v4.glb): 3,684,424B · 12 mesh · 11 material · 9 image · 44,940 triangles.
- [Blender 편집 사본](mongle-v4.blend): Blender 5.2.1 LTS로 가져와 텍스처를 포함해 저장했다.
- [내보내기 기록](mongle-v4.export.json) · [출처와 파일 해시](manifest.json).
- [동일 조명 비교](../../qa/graphics-v4-export/roundtrip.png) · [Blender 검사](../../qa/graphics-v4-export/blender-import.json).

위치·노멀·UV·정점 색, 색 텍스처·미세 normal·AO(R)/roughness(G), 텍스처 반복 좌표, sheen·clearcoat·specular를 내보냈다. 몸·목도리·앞치마 노드는 분리돼 있다. 기존 로컬 GLTFLoader로 다시 읽어 **82개 항목**을 확인했고 동일 조명 RGB 평균 절대 차이는 0.765/255였다. 이는 해당 비교 장면의 결과이며 엔진 간 외형 일치를 보장하지 않는다.

## 제작에 넘길 때 남은 것

- 본·애니메이션은 없다. runtime의 짧은 기모 선 8,376개는 GLB에서 제외했다.
- 이 파일의 몸체 정점 색에는 `scarf-apron` 동시 착용의 접촉 음영이 담겨 있다. 웹은 차림에 따라 다시 계산하지만 GLB는 정적이다. 네이티브에서 옷을 숨기거나 바꾸려면 의상별 음영 처리도 함께 만들어야 한다.
- `envMapIntensity`는 표준 glTF 재질 속성이 아니므로 Unity 조명에서 별도 조정해야 한다. URP 셰이더·LOD·의상 가림·리깅·실기기 검증이 남는다.
- 이전 v3 GLB/Blender 파일은 이전 재질의 이력으로 보존했다. 현재 공통 계약은 이 v4 후보를 가리킨다.

새 외부 패키지·다운로드·이미지 생성·유료 API는 사용하지 않았다. 승인 펠트 색 이미지는 기존 원본을 유지했다.
