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

## 2026-09-10 개정 자산

- `assets/felt-fibers-v2.png`: 이 대화에서 ImageGen으로 생성한 1254×1254 중성 펠트 섬유 표면. 별도의 게임 자산 팩을 구매하지 않았다. 원본은 Codex 생성 이미지 `exec-566deee2-3a24-47fa-83ce-50ba10ee3696.png`이며 이미지 편집 없이 복사했다. 생성 지시: 위에서 수직으로 찍은 무채색 바늘펠트의 매크로 표면, 고른 확산광, 짧고 굽은 양모 섬유·압축된 다공성 표면, 5cm 범위, 반복 가능한 가장자리, 주름·큰 그림자·글자 없음. `world-materials.js`가 표면색과 미세한 높이 변화에 사용하며, 재질 설정으로 섬유 광택과 거칠기를 더한다.
- `scene-assets/ssao/`: Three.js r180의 SSAOPass·SSAOShader·SimplexNoise. MIT 원문과 정확한 상류 경로는 같은 폴더의 `LICENSE.txt`, `SOURCES.md`.
- `audio-score.js`·`audio.js`: 이번 작품을 위해 작성한 음표·화음·합성 악기·환경과 행동 효과. 상업 음원·효과 샘플을 재사용하지 않았다. 사람의 성우·실제 펠트 피아노 녹음으로 표시하지 않는다.

## 선택적 로컬 AI

게임 코드에는 실행 파일·모델 파일을 포함하지 않는다. `../install-ai.cjs`를 직접 실행하면 사용자 로컬 앱 데이터 폴더에 아래 고정 파일을 내려받고 SHA-256을 확인한다. 게임 서버는 다운로드를 자동 실행하지 않는다.

- 실행 도구: [llama.cpp b10881](https://github.com/ggml-org/llama.cpp/releases/tag/b10881), MIT. 공식 Windows Vulkan ZIP, SHA-256 `1390bfabe8525b208a0d2ed8d77805d2e5c3a2a5d1f608a8bb768014d048eaac`.
- 원 모델: [Qwen3-4B-Instruct-2507](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), Apache-2.0.
- 압축 모델: [Unsloth GGUF](https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/tree/a06e946bb6b655725eafa393f4a9745d460374c9), `Qwen3-4B-Instruct-2507-Q4_K_M.gguf`, 2,497,281,120바이트, SHA-256 `3605803b982cb64aead44f6c1b2ae36e3acdb41d8e46c8a94c6533bc4c67e597`. 고정 revision은 `a06e946bb6b655725eafa393f4a9745d460374c9`.
- AI 응답 생성은 이 컴퓨터의 프로세스에서 수행한다. 한국어 답변 읽기는 브라우저·운영체제가 제공하는 음성 기능이며 별도 성우 자산이 아니다.
