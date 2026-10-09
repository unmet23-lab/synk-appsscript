# SYNK WORLD 그래픽 v3 · 2026-10-09

사용자가 승인한 것은 그래픽의 **방향**이다. v2와 v3의 완성도, ‘레이싱 이상’의 품질, 정식 캐릭터 원본 승인은 아직 받지 않았다. 이 묶음은 기존 v2를 보존한 채 실제 3D 조형·재질을 개선하고 앱의 공통 자산으로 연결하기 위한 구현 결과다.

## 실제 변경

- `avatar-v3.mjs`: 팔·입 없이 종형 몸, 정면 다섯 물결 밑단, 두 검은 구슬 눈을 유지한다. 긴 펠트 결을 줄이고 짧은 섬유와 표면의 미세한 요철로 바꿨다. 밑단은 굵은 튜브 대신 개별 실땀이다.
- 목도리의 넓이·윗선·처짐을 비대칭으로 만들고 앞뒤 면과 옆단을 닫았다. 앞치마는 미세 직물, 세로 주름, 겹단, 부푼 주머니와 작은 바느질을 가진다. 천은 미리 만든 정적 곡면이며 실시간 천 시뮬레이션이 아니다.
- 건축의 모서리·창호·처마·석재 이음을 다듬었다. 식물은 접힌 V자 면에서 둥근 곡면 잎으로 수정했다. 도시 43개는 6개 군집의 서로 다른 깊이로 나누고 산·강 사이 간격과 대기 원근을 맞췄다.
- 수면은 세 방향 파장과 가변 위상으로 환경 반사를 바꾼다. 마지막 검수에서 과도한 가로 줄무늬를 발견해 반사 진폭과 색 대비를 낮췄다.

## 재사용 계약

`createMongleAvatar({mobile=false, textureLoader, anisotropy=4})`는 Promise로 다음 객체를 반환한다.

```js
{ group, setOutfit, update, getOutfit, metrics, dispose }
```

- 원점은 발바닥, 정면 +Z, 위 +Y. 몸체 bounds는 폭 1.80048, 높이 1.83423, 두께 1.60915다. 물리적인 미터 크기로 확정한 값은 아니다.
- `setOutfit('none'|'scarf'|'apron'|'scarf-apron')`으로 조합한다. 실제 아이템 ID는 목 `mongle-scarf-first-steps`, 몸 `mongle-apron-starter`다. 획득·소유 권한은 서버/소비자가 확인한다. factory는 표시만 담당한다.
- `update(seconds,{reducedMotion,greeting})`는 몸의 미세한 기울기·눌림만 변경한다. 이동 위치는 소비자가 지정한다.
- `dispose()`는 소유 지오메트리, 재질, 텍스처, 인스턴스 버퍼를 해제한다. 여러 번 호출해도 해제는 한 번이다.
- `mountHomeScene`은 이전의 `setOutfit / setTime / greet / capture / dispose / metrics` 계약을 유지한다. 모바일 DPR은 1.5 이하, 홈 루프는 30Hz 상한, 화면 밖/비활성 탭/움직임 줄이기 처리를 유지한다.

## 정적 원본 후보

`mongle-v3.glb`는 **런타임 factory에서 실제 사용하는 동일 지오메트리**를 슬롯별로 묶어 내보낸 파일이다. 몸·목도리·앞치마 노드를 독립적으로 유지한다. `mongle-v3.blend`는 이 GLB를 Blender 5.2.1 LTS에서 가져와 저장한 편집 가능한 사본이다. 손으로 최종 조형한 제작 승인 원본이라고 부르지 않는다.

- GLB 3,153,872B · 9 mesh · 8 material · 4 embedded image · 43,252 triangles.
- 위치·노멀·UV·기본 색 텍스처·sheen·clearcoat를 포함한다.
- 본·애니메이션이 없다. 런타임 짧은 섬유 선과 bump 셰이더는 이 정적 GLB에 옮기지 않았다. 네이티브에서 같은 촉감을 내려면 URP 재질 변환과 최종 노멀/거칠기/접촉 음영 굽기가 필요하다.
- [내보내기 기록](mongle-v3.export.json), [파일 해시·출처](manifest.json), [Blender 가져오기 확인](../../qa/graphics-v3/blender-import.json).

## 검수와 한계

실제 브라우저 PC 1400×720 및 휴대폰 390×465의 **3D 장면 영역**을 낮·노을로 캡처해 세 차례 조형과 재료를 수정했다. 앱 전체 화면 검수는 별도 앱 통합 결과에서 확인한다.

- [최종 렌더 기록](../../qa/graphics-v3/capture.json): 두 크기 모두 콘솔/런타임 오류 0.
- [공통 캐릭터 20개 검사](../../qa/graphics-v3/avatar-contract-check.json): 네 조합의 부위 표시, 발바닥 원점, 유효 정점, 움직임 줄이기, 재질·텍스처·지오메트리 단일 해제 확인.
- PC 장면 153 draw calls / 263,648 triangles, 모바일 장면 125 calls / 219,536 triangles. 이는 정지 렌더 통계이며 FPS·발열의 측정값이 아니다.
- S25·아이폰 15 지속 성능, 네이티브 빌드, 실제 학습 보상 왕복, 타운 적용 여부는 이 파일만으로 완료를 주장하지 않는다.

기존 하늘·표면 텍스처는 그대로 재사용했다. 추가된 `terrain.jpg`는 레이싱에 있던 Poly Haven Rocky Terrain 02(CC0)의 사본이다. 이번 묶음에는 새 이미지 생성·유료 API·외부 자산 구매가 없다. 절차 코드와 캡처·내보내기 도구는 `qa/graphics-v3/`에 있다.
