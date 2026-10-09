export const engineeringText = {
 verdict: `## 새로 만든다면: Unity 6.6 + URP + Blender + 공식 CLI

**SYNK WORLD에는 Unity 6.6 정식 Supported 버전과 URP로 iOS·Android·PC 네이티브 앱을 만들고, Blender에서 규격화한 캐릭터·의상을 생산하는 방식을 추천한다.** Codex·Claude의 공식 실행 환경에서 Unity 공식 CLI를 사용해 장면·프리팹·검사·빌드의 반복 작업을 자동화한다.

판단 조건은 Galaxy S25와 iPhone 15 기본형, 휴대폰 앱 주력, PC 확장, 생활 마을과 여러 코스튬의 지속 추가다. 기존 Babylon.js 시제품, 기존 코드와 개발 언어에는 가산점을 주지 않았다. 웹에서 설치 없이 동일한 게임을 실행하는 것은 현재 필수 조건으로 두지 않았다.

효율은 **사용자에게 보이는 품질, 두 휴대폰의 지속 실행 비용, 새 콘텐츠 한 개의 완성 시간, 출시·업데이트·검수 부담**을 함께 평가했다. Unity를 모든 장면에서 가장 빠른 렌더러로 입증했다는 뜻은 아니다. 이번 결과는 공식 기능·지원 조건에 근거한 설계 추천이고, 동일 자산의 엔진별 실기기 벤치마크는 아직 없다.

이전 보고서의 “기존 3D 시제품을 활용하며 엔진을 고른다”는 권고는 이번 판단에서 제외한다. Steam 그래픽 비교 자료는 아래에 유지했다.`,
 versions: `## 최신 버전과 출시 가능한 기능을 구분했다

Unity의 현재 정식 Supported 계열은 **6.6**, 최신 LTS는 **6.3**이다. 공식 정책은 신규·중기 제작에는 Supported 업데이트를, 버전을 고정할 제작에는 LTS를 권장한다. 시작은 6.6 최신 패치로 하되 필수 패키지와 OS 빌드를 확인하고 버전을 고정한다. 6.7 베타나 다음 세대의 예정 기능을 제작 전제로 삼지 않는다. [6.6 발표](https://discussions.unity.com/t/unity-6-6-is-now-available/1735357) · [지원 정책](https://unity.com/releases/unity-6/support)

대안도 현재 공식 배포를 확인했다. Unreal Engine 5.8, Godot 4.7.2 안정판, Cocos Creator 3.8.8 LTS를 비교했다. 최신 엔진 안에도 실험 기능이 섞이므로 버전 번호만으로 판단하지 않았다.`,
 architecture: `## 앱 전체를 하나의 네이티브 게임 클라이언트로 설계한다

추천 구성은 **홈·옷장·미니게임·타운의 캐릭터 표현을 Unity에서 일관되게 처리하는 앱**이다. 첫 화면부터 큰 마을을 전부 불러오지 않고, 가벼운 홈과 필요한 캐릭터만 표시한다. 콘텐츠는 필요할 때 불러오고 나갈 때 해제한다. 이는 두 개의 앱 UI와 렌더링 환경 사이를 계속 연결하는 작업을 줄이기 위한 설계 판단이다.

UI는 홈·옷장·목록에 **UI Toolkit의 문서·스타일·데이터 바인딩**을 우선 검토한다. 키프레임·Timeline 애니메이션이 중요한 화면은 uGUI가 대안이다. 공식 플러그인 안내는 신규 프로젝트에 UI Toolkit을 권하지만 6.6의 일반 비교표는 런타임 기본 권장으로 uGUI를 남겨 두고 있다. “최신 UI니까 모든 화면에 무조건 적용”하지 않고 한글 입력·스크롤·접근성·펠트 UI 애니메이션으로 확인한다. [공식 플러그인 지침](https://docs.unity.com/en-us/ai/unity-plugin/about-unity-plugin) · [6.6 UI 비교](https://docs.unity.com/en-us/engine/6000.6/manual/uitoolkits/ui-system-compare)

의상·가구·마을 묶음은 **Addressables**로 필요한 때 내려받고 메모리에서 관리한다. 이 기능은 지정한 로컬 또는 CDN 주소의 자산을 불러올 수 있다. 한국어 노래 영상은 캐릭터·마을 자산 묶음과 분리해 재생하고, 영상 시청 중 무거운 타운 렌더링을 유지하지 않는다. 영상 해상도·코덱·자막·중단 후 복귀는 기기별 검수 항목이다. [Addressables](https://docs.unity.com/en-us/engine/6000.6/manual/packages-list/packages-all/pack-safe/com-unity-addressables) · [VideoPlayer](https://docs.unity3d.com/6000.6/Documentation/ScriptReference/Video.VideoPlayer.html)

공통 서버는 코스튬 소유권·착용 ID·마을 상태를 관리하고, 기기별로 적절한 세부 모델과 텍스처를 표시한다. 크로스플랫폼은 같은 코드를 여러 OS에 빌드하는 것에 더해 계정·저장·동시 접속을 각각 구현해야 한다. 기존 저장 구조를 유지해야 해서 엔진을 선택하는 방식은 이번 추천에 포함하지 않았다.`,
 rendering: `## 화질은 고급스럽게, 매 프레임의 일은 선택적으로

**기본:** URP + Render Graph, 제한된 실시간 조명과 그림자, 미리 계산한 간접광, 명확한 색과 재질. Render Graph는 불필요한 패스를 줄이고 자원을 재사용하며 모바일 GPU의 타일 메모리를 활용할 여지가 있다. 효과 크기는 장면에 따라 다르다. [Render Graph](https://docs.unity3d.com/6000.3/Documentation/Manual/urp/render-graph-introduction.html)

**빛:** 정적 건물은 베이크 조명, 캐릭터·이동 소품은 빛 샘플을 이용한다. APV는 간접광을 자연스럽게 받게 하는 후보지만 실시간 무제한 조명 계산은 아니다. 가구 이동의 새로운 간접광이 자동으로 구워지지는 않는다. 낮밤·날씨와 사용자 집 꾸미기를 고려해 정적 빛과 움직이는 부분을 나눠 설계한다. [APV](https://docs.unity.com/en-us/engine/6000.3/manual/lighting-overview/lighting/probevolumes/concept)

**펠트:** 짧은 섬유의 요철·거칠기·가장자리 빛·봉제선·옷의 두께를 먼저 만든다. 근접 옷장에는 세부 표현을 늘리고, 멀리 보이는 다른 캐릭터는 단순화한다. 많은 투명 털 레이어와 모든 인물의 천 물리를 기본값으로 두지 않는다. 펠트처럼 보이는 방식과 실제 섬유를 모두 시뮬레이션하는 방식은 비용이 다르다. [Android 재질 최적화](https://developer.android.com/games/optimize/materials?hl=en)

**최신 최적화 기능:** Forward와 Forward+는 같은 장면에서 비교한다. GRD는 반복 소품의 CPU 처리 부담을 줄일 수 있지만 GPU 부담은 늘어날 수 있다. 6.6의 GRD는 Forward+/Deferred+와 MeshRenderer 등 조건이 있고, 움직이는 코스튬 메시를 자동으로 해결하지 않는다. DOTS/ECS 전체 전환도 16인 마을의 선행 조건으로 두지 않는다. [GRD 조건](https://docs.unity3d.com/6000.6/Documentation/Manual/urp/gpu-resident-drawer.html) · [성능의 교환 관계](https://docs.unity3d.com/6000.6/Documentation/Manual/urp/gpu-resident-drawer-performance.html)

S25와 iPhone 15는 각각 측정한다. PC는 같은 미감에서 그림자 거리·식물·반사·해상도를 확장한다. 사진·영상용 최고 품질과 장시간 플레이 품질은 별도 설정으로 관리한다.`,
 costume: `## 가장 큰 생산성 개선은 ‘코스튬 공장’을 만드는 데 있다

1. **승인된 몸과 커스텀 뼈대:** 팔 없는 몽글에 맞는 마스터 모델·표정·Generic rig를 만든다. 캐릭터의 얼굴과 몸을 새 의상마다 다시 생성하지 않는다.
2. **체형군과 부착 규격:** 뼈 이름·모자·안경·가방의 부착 위치와 의상 안쪽 여유를 정한다. 여러 마스코트를 무조건 한 인간형 몸에 맞추지 않는다.
3. **분리된 옷 제작:** Blender에서 옷을 만들고 몸의 변형 가중치를 옮긴 뒤 포즈와 체형에 맞춰 보정한다. 고정 장식은 부착점, 흔들림은 필요한 보조 뼈 위주로 처리한다.
4. **충돌 규칙을 데이터로 관리:** 옷에 가려진 몸 영역 숨김, 긴 목도리와 특정 상의의 조합 제한, 겹침 순서, 보정 변형을 지정한다.
5. **자동 내보내기·검사:** 모델·텍스처·LOD·썸네일·itemId를 함께 내보내고 뼈·재질·파일 누락을 검사한다. 정해진 회전·걷기·앉기 포즈와 조합을 자동 촬영해 사람의 최종 시각 검수를 돕는다.

이 방식은 기본 자산 수를 대략 의상 N개+장식 M개로 관리하게 하지만, **조합 N×M×체형×동작의 호환 검수는 남는다.** 규격과 조합 제한이 생산성을 높이는 핵심이다. 최초 마스터와 옷 맞춤에는 3D 아티스트의 제작·검수가 필요하며 자동 도구만으로 품질을 보장하지 않는다. [Generic rig](https://docs.unity3d.com/6000.6/Documentation/Manual/GenericAnimations.html) · [Blender 가중치 전달](https://docs.blender.org/manual/en/4.3/modeling/modifiers/modify/data_transfer.html) · [보정 변형](https://docs.blender.org/manual/en/4.5/animation/shape_keys/introduction.html)

같은 뼈대를 쓰는 16명이 자동으로 한 번의 그리기 작업이 되지는 않는다. 재질 수·스킨 메시 수·보조 뼈·그림자 비용을 따로 본다. 메시 결합은 성능 문제가 확인될 때 옷 변경 결과를 캐시하는 방식으로 검토한다. [Unity 인스턴싱 제약](https://docs.unity3d.com/6000.3/Documentation/Manual/GPUInstancing.html)`,
 automation: `## Codex·Claude는 공식 Unity CLI로 반복 작업을 맡긴다

현재 공식 경로는 **Unity 플러그인 + Unity CLI + Unity Pipeline**이다. 셸 명령을 실행할 수 있는 에이전트는 CLI 명령으로 에디터를 조작하고 검사·빌드를 실행할 수 있다. 필요한 환경에는 CLI의 MCP 모드를 쓴다. **예전 in-editor AI assistant 패키지의 MCP 서버는 폐기 경로**이므로 새 구축의 기준으로 삼지 않는다. [공식 전환 안내](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)

프리팹 생성, 아이템 등록, 장면 배치, 잘못된 자산 탐지, 반복 포즈 촬영, 빌드를 자동화 대상으로 삼는다. 공식 CLI·MCP·플러그인은 무료이며 Unity 자체 AI 크레딧 구독 없이 사용할 수 있다고 명시돼 있다. Codex·Claude 사용 한도와 에디터 라이선스는 별도다. 이번 조사에서 플러그인을 설치하거나 유료 서비스를 실행하지 않았다. [Unity 공식 도구 안내](https://unity.com/features/ai)

생산성은 코드 몇 줄 생성했는지가 아니라 **채택 가능한 의상 한 벌을 추가하고 두 휴대폰에서 검수하기까지 걸리는 시간**으로 측정한다. 초기 규격을 만들고 같은 작업을 반복할수록 실제 절감량을 확인할 수 있다.`,
 aiassets: `## AI 3D는 초안에 쓰고, 최종 캐릭터 규격은 고정한다

Meshy·Tripo·Rodin을 현재 공식 기능으로 비교했다. 생성·리메시·텍스처·리깅 보조는 유용한 후보지만, 생성한 모델이 바로 몽글 코스튬으로 쓸 수 있다는 증거는 아니다. 우선 의자·화분·소품·장식 초안에 적용하고, 채택률과 정리 시간을 측정한다.

“자동리깅은 인간형만 가능”이라는 설명도 현재는 맞지 않는다. Tripo는 여러 비인간 골격을 명시하고 Meshy에는 Smart Rig Beta 안내가 있다. 다만 팔 없는 몽글의 승인된 얼굴·표정·옷 호환을 보장하지는 않는다. [Tripo 리깅](https://developers.tripo3d.ai/en/docs/animations-rig) · [Meshy 안내](https://www.meshy.ai/tutorials/character-auto-rigging-workflow)

비교할 총시간은 **생성 + 재시도 + 메시 정리 + 뼈대 연결 + 옷 맞춤 + LOD + 검수**다. 이 합계가 짧아지는 자산에만 도입한다. 이번에는 기능을 조사했으며 생성 결과 비교나 결제는 하지 않았다.`,
 validation: `## 도구 선택과 성능 검증을 구분한다

**권고할 도구는 Unity 6.6 + URP로 명확히 정한다.** 모든 후보 엔진을 끝없이 시제품으로 만드는 절차를 권하지 않는다. Godot는 소스 통제·라이선스 비용이 최우선이 되거나 필요한 시각 효과를 더 단순하게 정할 때의 강한 대안이고, Cocos는 TypeScript와 웹·미니게임 동시 배포가 핵심이 될 때 재평가한다.

첫 제작 검증에는 완성된 몽글 한 종과 옷·장식 조합, 16명 밀집 장면, 장식한 집, 낮밤·비, 영상에서 타운으로 돌아오는 동작을 포함한다. 성능용 복제 캐릭터와 실제 네트워크 접속 검사는 구분한다. 균형 모드 60fps와 경험 모드 30fps를 초기 목표로 두되, 채택 여부는 두 기기 각각의 30분 프레임 지연·메모리·열·배터리·앱 복귀 결과로 결정한다. 미측정 FPS나 폴리곤 상한을 확정값으로 제시하지 않는다. [기기 프로파일링](https://docs.unity.com/en-us/engine/6000.6/manual/analysis/profiler/profiling-applications/profiling-target-device) · [Apple 프레임·열 분석](https://developer.apple.com/documentation/xcode/analyzing-the-performance-of-your-metal-app/)

제작 반복 시험에서는 새 의상 추가부터 맞춤·조합 확인·내보내기·실기기 검수까지 시간을 기록한다. 렌더링과 제작 공정 중 어디가 먼저 병목인지 확인해 그 부분을 자동화한다.

iPhone 앱은 Unity가 생성한 프로젝트를 Xcode로 빌드해야 한다. 로컬 빌드에는 Mac이 필요하며 Mac 기반 빌드 서비스는 대안이다. Windows에서 코딩한 것만으로 iOS 출시 검증이 끝나는 것은 아니다. [iOS 빌드 환경](https://docs.unity.com/en-us/engine/6000.6/manual/platform-specific/iphone/getting-started/ios-environment-setup)

이번에 완료한 것은 **현재 공식 문서 검증과 제작 방식 추천, 보고서 갱신**이다. 엔진 설치·완성 자산 제작·S25/iPhone 15 벤치마크·스토어 배포는 수행하지 않았다.`,
};
