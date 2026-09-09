# 의존성과 자산 출처

## Three.js r180 / npm 0.180.0

- 라이선스: MIT. 원문 `vendor/THREE-LICENSE.txt`.
- upstream: https://github.com/mrdoob/three.js/tree/r180
- 고정 버전 배포: https://unpkg.com/three@0.180.0/
- 포함 파일: `three.module.js`, `three.core.js`, `RoundedBoxGeometry.js`, `addons/utils/BufferGeometryUtils.js`, `addons/objects/Reflector.js`, `addons/postprocessing/{EffectComposer,RenderPass,UnrealBloomPass,ShaderPass,MaskPass,Pass,OutputPass}.js`, `addons/shaders/{CopyShader,LuminosityHighPassShader,OutputShader}.js`.
- 원본 라이선스 헤더를 유지했다. 브라우저 런타임은 외부 CDN을 요청하지 않는다.

## 글꼴

SYNK 저장소의 승인된 서체 파일을 같은 라이선스와 함께 복사했다. 파일 자체와 해당 파일에 함께 제공된 원문이 기준이다.

- SUIT Variable: `assets/fonts/SUIT-Variable.woff2`, `SUIT-OFL.txt`. SIL Open Font License 1.1.
- Inter Tight Medium / Bold: `assets/fonts/InterTight-*.ttf`, `InterTight-OFL.txt`. SIL Open Font License 1.1.
- DM Mono Regular: `assets/fonts/DMMono-Regular.ttf`, `DMMono-OFL.txt`. SIL Open Font License 1.1.
- SYNK Bracket: `assets/fonts/SYNKBracket-Regular.ttf`, `SYNKBracket-OFL.txt`. 저장소에 함께 제공된 라이선스 적용.

## SYNK 제작 자산

- `vendor/loom.css`: SYNK canonical `tools/lib/loom.js`의 `css({지면:'부품만',천:null})` 출력. 마감 CSS는 `style.css`에서 게임의 구조를 정의한다.
- `assets/felt-neutral.avif`: `docs/Loom_자산/구움/공방_무채펠트.avif`의 동일 복사본. 기존 승인된 SYNK 펠트 표면.
- `assets/felt-city.png`: 부모 작업에서 생성·관리하는 미술 기준 이미지. 정지 폴백 용도이며 Three.js 실시간 렌더와 구분한다.
- `scene.js`: 이 작업에서 직접 구성한 도시 기하 구조·텍스처 폴백·빛·카메라. 별도 유료 게임 자산이나 상용 엔진 런타임을 사용하지 않았다.

실제 렌더러는 Three.js/WebGL2다. Unreal Engine 런타임과 GTA 자산은 포함하지 않는다.
