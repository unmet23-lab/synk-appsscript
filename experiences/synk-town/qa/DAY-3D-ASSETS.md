# 첫 하루 — 3D 공간과 자산 범위

2026-10-09. 담당 구현은 [day-scene.mjs](../day-scene.mjs), [day-environment.mjs](../day-environment.mjs), 플레이어 초기 대체 모형 [day-character.mjs](../day-character.mjs), 주민 [day-residents.mjs](../day-residents.mjs).

- 공통 방향: [몽글다운 형태와 실제 재료의 3D 세계](../../../docs/디자인/게임_풍경과_재질.md#world-graphics-20261009).
- 초기 내부 원천: [WORLD 홈 scene.mjs](../../synk-world-home/scene.mjs)의 팔 없는 종 모양 몸·물결 밑단, 앞치마, 절차적 펠트·나무·돌 표면, 환경 조명 방식을 Town에 맞게 경량화해 사용한다. 홈 원본은 수정하지 않는다.
- 라이브러리: 기존 [Three.js 로컬 사본과 MIT 고지](../../synk-world-home/scene-assets/THREE-LICENSE.txt)를 서버의 `/day-assets/three.module.js`, `/day-assets/three.core.js` 기존 두 경로와 공용 아바타가 사용하는 `/scene-assets/three.module.js`, `/scene-assets/three.core.js` 고정 별칭으로 읽는다. 외부 CDN·유료 생성·외부 이미지 다운로드는 없다.
- 집·찻집·공방·온실, 길·벤치·화분·찻잔, 플레이어와 주민은 실제 메시다. 텍스트 표찰과 재질 표면만 CanvasTexture다. 캐릭터를 한 장 이미지로 대체하지 않는다.
- 플레이어는 공용 몽글 v3다. 주민은 사용자 외형 정정에 따라 사람형 다섯 명과 교수 계열 연구원으로 분리했다. 찻집 주인은 묶은 머리·녹색 앞치마, 공방 주인은 짧은 머리·넓은 어깨·남색 작업복, 첫 손님은 은발·안경·자주 카디건, 책 손님은 웨이브 단발·황토 니트·책, 동행 손님은 긴 묶은 머리·청록 재킷·가방이다. **최종 이름·캐스팅·승인 마스터 모델·공통 인벤토리 코스튬 자산을 확정한 것은 아니다.**
- 연구원은 [교수연구실 원천](../../../docs/캐릭터/교수연구실/정본.json)의 연보라 타원 펠트·검은 둥근 안경·아이보리 두갈래 콧수염을 참고한 절차적 3D 모델이다. 원본 2D 이미지를 수정하거나 승인된 3D 리그를 재사용한 것이 아니다. 교수의 코·입·눈썹은 추가하지 않는다. 사람형 주민에는 별도의 얼굴·손발·신발과 관절이 있다.
- 두 손님 생활은 책 손님·동행 손님의 개별 모델을 사용한다. 서버의 실제 장면 projection으로 두 잔·단맛·요청표·탁자와 그림 메뉴판을 표시한다. 그림/글 선택은 메뉴판 배치에 반영하며 생활을 닫으면 방문객과 임시 소품을 제거한다. 2D 대체 화면도 같은 주민의 실제 메시 렌더 초상을 사용한다.
- 펠트 몸·천 앞치마 외에 나뭇결, 거친 석재, 유약 도자기, 반투명 유리의 다른 거칠기·표면·조명을 사용한다. 유리는 경량 투명 재질이며 물리적 굴절 시뮬레이션은 아니다.
- 넓게/가까이 시점과 균형/경험 품질은 독립이다. 균형 DPR 상한은 좁은 화면 1.25, 그 외 1.5. 경험은 각각 1.6/2. 프레임 목표 상한은 각각 30/60이며 실제 보장 FPS가 아니다. 숨김·화면 밖에서는 렌더링을 멈춘다.
- 환경의 반복 기와·창틀·포장·잎과 꽃은 instancing. 캐릭터는 근접 촬영에서 실루엣과 옷의 두께가 보이는 별도 메시다. 실제 메모리·렌더 호출·삼각형과 최근 최대 360프레임의 CPU 렌더 시간/프레임 간격 p50·p95를 수집한다. CPU 렌더 시간은 GPU 완료 시간이나 휴대폰 발열 검증이 아니다.

## 호출 계약

```js
const scene = createDayScene(canvas, { onDestination, onError });
const serial = scene.render(view.day.scene, {
  quality: 'balanced', // 'experience'
  camera: 'follow', // 'close', 'wide'
  reducedMotion: false,
});
scene.resize();
scene.stats();
scene.dispose();
```

`render` 반환 serial이 `stats().renderedSerial` 이하인지 확인하면 해당 입력이 실제 WebGL 프레임으로 그려졌는지 구분할 수 있다. `ready`만으로 새 연출의 전달을 확정하지 않는다. 실제로 보이는 시간·사용자 관람 조건은 소비 UI가 별도 확인한다.

`scene` 입력은 `location`, `player:{x,z}`, `npcs:[{id,x,z,pose}]`, `props:[{id,kind,x,z,preview,orientation}]`다. 위치는 집(-6,0), 찻집(0,0), 공방(6,0), 온실(0,-6). 클릭은 목적지 요청만 전달하며 의뢰 수락·수확·재료 소비를 실행하지 않는다. 도착·완료·보상·기억은 서버 규칙이 결정한다. 받은 위치 사이의 최대 260ms 보간과 자세 흔들기는 표시일 뿐 저장 사실을 만들지 않는다.

첫 자리 연출은 `legacy:{...view.scene,active:true}`, `legacyActors:Loom.sample(...).actors`를 전달한다. `%` 좌표를 찻집 내부 3D 좌표로 변환해 동일 찻집 주인·손님·찻잔을 보여 준다. C1은 자기 장면이 주인을 붙잡는 동안만 `lifeHold:view.life.background`(owner·prop)로 같은 주인의 자세와 정리할 잔을 표현한다(2026-10-23 W3 — 그 밖에는 마을 계획이 주인을 그린다). 첫 자리 연출 중에는 C1 위치를 보내지 않는다. 찻집 주인은 복제하지 않는다. 해당 연출의 전달 ACK는 소비 UI가 실제 노출과 완료한 단계를 확인해야 한다.

WebGL 초기화 실패는 예외, 실행 중 context loss는 `onError`로 알린다. 소비 UI는 생활 현황·버튼을 유지하며 텍스트 대안을 명시한다. 대안을 3D 성공으로 보고하지 않는다.

이 문서는 제작 출처와 계약이다. 실제 화면·자동화 결과는 첫 하루 검증 기록에서 확인한다. Galaxy S25·iPhone 15 실기기, 장시간 발열, 실제 플레이어 재미 검증은 별도다.


## 2026-10-09 그래픽 개편과 추가 근접 시점

사용자의 그래픽·마감 개선 요청과 홈 채팅에서 전달된 추가 근접 시점 요청에 따라 기존 걷기 추적을 보존하고 `걷기 → 가까이 → 동네 전체` 순으로 전환한다. 근접은 플레이어를 따라오는 낮은 3D 카메라이며, 화면을 잘라 확대하는 방식이 아니다. WASD의 방향 축은 세 시점에서 같다. 홈 v2는 참고 방향이며 최종 만족/완성 승인으로 간주하지 않는다.

- 초기 역할 모형: 기존 WORLD 홈 [scene-v2.mjs](../../synk-world-home/scene-v2.mjs)의 몽글을 모든 역할에 재사용했던 모형은 사용자 정정으로 NPC에서 제외했다. `day-character.mjs`는 공용 플레이어 로딩 전 대체 모형으로만 남는다. 새 주민의 의복은 계정 아이템 지급·보유·착용의 근거가 아니다.
- 플레이어: [공용 avatar-v3.mjs](../../synk-world-home/avatar-v3.mjs)의 `createMongleAvatar`를 직접 사용한다. 같은 얼굴·몸·목도리·앞치마 메시를 홈과 타운에서 재사용한다. 독립 4288은 목도리 시연 차림이다. WORLD 리허설 호스트가 명시적으로 연결된 경우에만 서버에서 확인한 차림을 `setAppearance`로 표시한다. 계정별 호스트·권한 검증은 WORLD 연결 서버의 별도 책임이다.
- 환경: 실제 이동 가능한 네 장소와 충돌 좌표를 보존한다. 건물 재료와 창틀·처마·기와, 조경과 외곽 풍경을 세분화하고 하늘/따뜻한 직사광/차가운 환경광을 분리한다.
- 승인된 로컬 표면: `/day-assets/felt-coral.webp`는 `synk-world-home/assets/felt-coral.webp`를 그대로 제공한다. `/day-assets/azure-sky-v3{,-mobile}.jpg`, `terrain-normal.jpg`, `cliff-normal.jpg`는 [graphics-v2/provenance.json](../../synk-world-home/scene-assets/graphics-v2/provenance.json)의 원본을 그대로 제공한다. 하늘은 기존 SYNK 제작 이미지, 두 normal map은 기존 Poly Haven CC0 자산이다. 새 생성·다운로드·리터치는 없다.
- 모바일은 작은 하늘 파일을 사용하고 기존 DPR/30·60프레임 상한을 유지한다. 그림자는 균형 1024, 경험 2048의 VSM이며 근접에서는 플레이어 주변으로 그림자 범위를 좁힌다. `assetsReady`와 `assetFailures`를 따로 기록하며 표면 파일 실패 시 절차적 재질을 유지한다. `ready`는 모든 표면 파일 성공의 증명이 아니다.
- 얼굴·하반신은 12개 지점에서 가림 물체의 범위를 확인한다. 걷기에서는 옅게 만들고 가까이에서는 가림 메시와 그 그림자를 숨겨 눈·옷 위의 반투명 잔상을 없앤다. 세로 패널이 열리면 플레이어와 가까운 주민의 3D 경계를 실제 패널 아래 남는 영역에 맞추고, 닫으면 원래 근접 거리로 복귀한다. 태블릿은 픽셀 임계값이 아니라 실제 패널 너비로 판단한다.
- HUD 추가 부품: `badge-cream.webp`, `badge-coral.webp`, `chip-blush.webp`, `chip-blush-long.webp`는 `docs/디자인/펠트부품/assets/ui/`의 승인 원본을 `assets/ui/`로 바이트 그대로 복사했다. 새 이미지 생성·색상 변경·리터치는 없다.
- 자산은 고정된 preview 경로만 연다. 사용자 저장·생활 완료/관람 ACK·이동 권위는 그래픽 코드에서 바꾸지 않는다.

검증과 전후 화면은 [GRAPHICS.md](GRAPHICS.md)에 기록한다. 그래픽 개선의 배수나 실기기 성능을 수치로 보장하지 않는다.

자원 해제는 [반복 부품 GPU 회귀](GRAPHICS-resources.json)에서 인스턴스별 버퍼 해제까지 확인한다. 이 검사는 실기기 장시간 메모리·발열 측정과 다르다.
