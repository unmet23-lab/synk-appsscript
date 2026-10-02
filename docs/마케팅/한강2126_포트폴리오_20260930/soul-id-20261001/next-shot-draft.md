# YUHO · 다음 기준 이미지 1장과 4초 연기 시험 초안

> **2026-10-01 유호님 결정:** 유호님 얼굴은 확정 얼굴만 쓴다. 이 초안의 `YUHO` 소울(인터뷰 24장) 대신 [고정 얼굴 세트](../../제작양식/실제얼굴_화보_뮤직비디오.md#고정-얼굴-세트)와 소울 `Yuho-Approved-360`을 쓴다.

2026-10-01. **로컬 준비 문서이며 생성·업로드·새 학습을 실행하지 않았다.** 기존 YUHO 학습의 완료 및 생성 화면에서의 선택 가능 여부는 담당 작업에서 실시간 확인한다. 이 문서에는 예상 가격이나 현재 잔액을 넣지 않는다.

## 이번 한 컷의 목적

사용자가 원하는 **본인의 얼굴 + 승인한 PULSE 여성 장면의 실제 촬영 같은 질감**이 한 공간에서 함께 성립하는지 확인한다. 인물과 공간을 같이 만든 기준 이미지 한 장을 먼저 검토하고, 그 이미지가 적합할 때 약 4초의 작은 시선·미소 시험으로 움직임을 확인한다.

이것은 **동일인·촬영감 시험**이다. 47초 본편의 첫 장면이나 PULSE 출연자를 바꾸는 안이 아니며, 기존 VR 레이싱 → 사고 → 까몽 → 입장 → PULSE → SHIFT → 강·수달 → LAB + PATH 흐름은 유지한다. 본인의 얼굴을 PULSE 여성의 얼굴로 바꾸지 않는다. 아직 넘어짐·커피·VR 게임·폰·마스코트 동작을 한 컷에 넣지 않는다.

## 참조 역할과 현재 근거

| 역할 | 사용할 기준 | 적용 범위 |
|---|---|---|
| 얼굴 정체성 | 기존 **YUHO / 실제 인터뷰 선별 24장 / Soul Cinema** 학습 | 이 24장에서 학습한 사용자 얼굴·실제 머리·자연스러운 비대칭만 동일인 기준으로 사용. 별도 `YuhoCornrow` 캐릭터나 과거 생성 남자 이미지를 얼굴 기준으로 혼합하지 않음. |
| 24장 출처 | [학습 준비 기록](README.md), [선별 명세](selection-manifest.json) | 실제 촬영 프레임 24장. 20장은 원본 색·피부를 유지한 소스, 4장은 다른 촬영일의 기존 색보정 소스. 전부 무보정이라고 부르지 않음. |
| 촬영 질감 | [승인 PULSE 프레임](../review/pulse-human-performance-approved-frame.png), [성공한 영상 프롬프트](../prompts/pulse-human-performance-t2v-v1.txt), [사용자 승인 범위](../video/human-realism-approval.json) | 자연스러운 피부색, 카메라 오른쪽 창빛, 반대쪽 얼굴의 그림자, 눈높이 중근경, 작은 시선·고개·미소. 여성의 얼굴·나이·머리·니트 의상은 가져오지 않음. |
| 의상 | [분할 콘티의 유지 기준](../실촬영_분할콘티_20261001.md) | 차콜 셔츠 재킷 + 흰 티셔츠. 본편의 어두운 바지·흰 운동화·검은 가방도 기준 유지. 이 중근경에서는 허리 아래와 손 소품이 프레임 밖에 있음. 인터뷰의 다른 옷이 자동으로 따라오면 수정 대상. |
| 공간 | 같은 문서의 PULSE 기준 및 기존 제작 콘티 | 2126년 한강 SYNK의 베리 펠트 `#99295D`, 옅은 곡면 벽, 나무 책상, 식물, 펜 디스플레이·음악 장비, 먼 미래 한강 창밖. 인물이 실제로 그 공간의 빛을 받는 장면. |

**참조 입력 원칙:** 화면에서 기존 YUHO 캐릭터를 실제로 선택했는지 확인한다. 프롬프트에 이름만 쓴 것을 캐릭터 연결로 간주하지 않는다. PULSE 여성 이미지는 우선 사람에게 보여 주는 비교 자료와 촬영 묘사의 근거로 사용한다. 실행 UI에서 동일인 참조와 스타일 참조를 명확히 구분할 수 있는지 확인되지 않으면 여성 이미지를 동일인 입력에 넣지 않는다. 새로 사진을 업로드하거나 같은 24장으로 학습을 다시 제출할 필요는 없다.

## 기준 이미지 한 장 · 촬영 설계

| 요소 | 구체적인 지시 |
|---|---|
| 화면 | 9:16 한 장. 눈높이, 가슴 위 중근경, 50mm에 해당하는 자연스러운 원근. 얼굴을 충분히 읽되 피부만 극단적으로 확대한 매크로는 피함. |
| 자세 | PULSE 책상 옆에 편안히 앉은 상체. 어깨가 과도하게 정렬되지 않은 평범한 자세. 몸은 카메라에 거의 정면, 얼굴은 정면에서 약간 벗어난 방향. |
| 표정 | 입을 편하게 닫고 옆 사람의 말을 듣는 순간. 눈에 초점이 있고 눈가와 입의 긴장이 작음. 사진 촬영용 고정 미소·크게 드러나는 치아 없음. |
| 머리·얼굴 | 선택한 YUHO Soul ID의 실제 얼굴과 콘로우를 유지. 이목구비를 작거나 예쁘게 다시 설계하지 않음. 수염·주름·피부 결은 학습 얼굴에 없는 것을 과장해서 추가하지 않음. |
| 빛 | 카메라 오른쪽 큰 창의 부드러운 자연광. 반대쪽 뺨과 눈 주변에 자연스러운 그늘. 피부는 중립색, 평범한 카메라 노출. 창과 피부의 하이라이트가 같은 방향. |
| 공간과 거리 | 의자·책상·어깨가 같은 광원과 초점 공간에 존재. 배경은 얼굴보다 부드럽지만 공간이 알아볼 수 있을 정도. 창밖은 먼 한강·미래 건물의 흐린 실루엣. |
| 펠트·브랜드 | 베리색 펠트 흡음 패널·의자, 담백한 옅은 곡면 벽. 작은 입체 펠트 `synk PULSE` 벽사인을 뒤에 배치. 간판이 얼굴보다 강하게 빛나거나 거대한 타이틀처럼 보이지 않음. |
| 평가용 생략 | 이 얼굴 시험에서는 VR이 눈·이마를 가리지 않음. 컵·폰·게임·로봇 이동은 화면에 등장시키지 않음. 본편 오프닝의 VR 착용 조건을 변경한 것이 아님. |

### 실행 화면에 적용할 이미지 프롬프트 초안

아래 텍스트를 기존 **YUHO 캐릭터가 연결된 상태**에서 사용한다. 실제 UI의 프롬프트/캐릭터 결합 지원 여부는 실행 전에 확인한다. 특정 참조 토큰이나 미확인 기능을 가정하지 않는다.

```text
One vertical 9:16 photographic frame for a Korean live-action feature film casting and lighting test. Use only the selected YUHO Soul ID character for the man's identity. Keep his actual facial proportions, eyes, nose, jaw, ears, natural asymmetry, skin tone and cornrow hairstyle. Do not redesign him as a generic handsome model.

An eye-level medium close shot, chest up, with natural 50mm perspective. He wears the established charcoal shirt jacket over a plain white T-shirt. He sits comfortably beside a wooden work desk in the SYNK PULSE studio. His body is nearly frontal and his face is turned only slightly toward someone just off camera left. His lips are relaxed and closed, and his eyes are quietly attentive. An ordinary moment of listening before a small reaction, not a posed portrait. Hands and hand-held props stay below the frame.

The year is 2126 beside the Han River, but this room feels physically built and inhabited. Berry felt acoustic panels and a berry chair, pale curved walls, natural wood, a few plants, an unobtrusive pen display and music-production equipment farther behind him. A small dimensional felt sign reading 'synk PULSE' sits softly out of focus in the background. A distant future Han River skyline is visible through a large window. Keep these architectural and material cues restrained and believable.

The window is to camera right and provides the main light. His other cheek and the far side of the room remain naturally shaded. Neutral afternoon daylight, normal exposure, ordinary skin color variation, a few natural stray hairs. The same light must illuminate his face, clothing, chair and surrounding architecture. His body belongs inside this room with plausible depth and contact. Background softness comes from the same lens, without a cutout edge or artificial portrait blur.

Prioritize the presence of a real working adult photographed during a quiet moment. Avoid glossy orange skin, dramatic golden backlight, beauty retouching, plastic smoothness, exaggerated pores, artificially enlarged eyes, fixed advertising smiles, uniform face lighting, glowing felt, decorative particles, haze effects, added film grain, or hyper-sharp CGI rendering. No female subject, no borrowed female facial features, no headset covering the face, no coffee splash, no floating body, no racing game, no collage, no captions or Korean text overlays.
```

영문 프롬프트의 `no female subject`는 이 **한 남자 얼굴 시험 프레임**의 인물 수 지시다. 본편 PULSE 여성 캐스팅을 제외한다는 뜻이 아니다. 로고가 잘못 생성돼도 인물의 품질 판단과 구분하고, 최종 적용은 승인된 로고 자산의 편집 합성으로 처리한다.

## 이미지에서 먼저 볼 다섯 가지

1. **닮음:** 실제 24장 대표 사진과 눈 간격·코/턱·귀·헤어라인이 같은 사람으로 읽히는가. 이전 AI 남자와 닮았다는 이유만으로 통과하지 않는다.
2. **피부와 눈:** 모공을 많이 넣은 그림이 아니라 정상 노출의 실제 피부처럼 보이는가. 눈동자·흰자·눈가의 밝기가 과장되지 않았는가.
3. **공간:** 얼굴과 배경의 광원 방향·색온도·초점·그늘이 한 번에 촬영한 것처럼 맞는가. 거절된 원본 합성의 ‘사람과 배경이 따로 논다’를 다시 만들지 않았는가.
4. **연속성:** 차콜 셔츠 재킷·흰 티셔츠와 베리 펠트·미래 한강의 기준이 맞는가. 다른 인터뷰 의상이나 여성의 니트가 따라오지 않았는가.
5. **다음 동작의 여유:** 얼굴이 너무 큰 표정으로 고정돼 있지 않고 약한 시선 변화·짧은 미소를 이어갈 수 있는가.

한 장이 통과하기 전에 여러 이미지나 영상을 한꺼번에 생성하지 않는다. 학습 완료 표시와 위 품질 통과는 서로 다른 확인이다.

## 다음 4초 연기 시험 · 이미지가 적합할 때만

같은 YUHO·의상·공간·광원·카메라를 유지한 연속 한 컷이다. **AI가 만든 새 연기**이며 실제 인터뷰의 표정 픽셀을 그대로 보존한 영상이라고 설명하지 않는다. 4초는 목표 편집 길이이며 실제 모델의 지원 길이·해상도·가격은 실행 화면에서 확인한다.

| 시간 제안 | 실제로 보일 반응 |
|---|---|
| 0.0–0.8초 | 이미지와 같은 자세로 조용히 듣고 있다. 숨에 따라 어깨가 아주 작게 움직임. |
| 0.8–1.7초 | 눈이 카메라 왼쪽의 상대에게 먼저 움직이고, 고개가 약 5도 뒤따름. 급한 회전이나 반복 끄덕임 없음. |
| 1.7–2.8초 | 상대의 말에 입꼬리와 눈가가 함께 아주 조금 반응하는 짧은 미소. 치아를 크게 보이지 않음. |
| 2.8–4.0초 | 미소가 자연스럽게 잦아들며 상대를 바라봄. 마지막 프레임까지 살아 있는 호흡과 눈의 초점 유지. |

깜빡임을 과제로 추가해 모든 동작을 동시에 강제하지 않는다. 자연스럽게 발생하면 양눈의 형태와 타이밍을 확인한다. 말·립싱크·휴대폰·손 동작·로봇은 이번 시험 범위에 넣지 않는다.

### 4초 영상 프롬프트 초안

```text
A four-second single continuous live-action performance test using the approved YUHO reference frame and the same selected YUHO identity. Preserve the same man's facial structure, cornrows, charcoal shirt jacket, plain white T-shirt, seated posture, SYNK PULSE room, camera framing and window-light direction. One eye-level chest-up shot with natural 50mm perspective. Normal real-time motion.

He is quietly listening to a person just off camera left. For the first short moment he remains naturally attentive with subtle breathing. His eyes then shift a little toward that person; his head follows by only about five degrees. A brief understated smile forms through a small change around both the eyes and mouth, without a broad grin or prominent teeth. The smile gently settles while he keeps looking toward the person. This is a fleeting ordinary response, not a performed advertising smile. Keep his identity, face volume and skin texture stable throughout.

The camera remains steady with at most very slight natural operator breathing. No zoom, orbit, dolly, whip pan, speed ramp or slow motion. Window light from camera right, natural shadow on the other cheek, neutral skin color and stable exposure. Hair strands and clothing respond only to the small head and shoulder movement. His face and the room share one physically coherent lighting setup.

No dialogue, no lip-sync performance, no repeated nodding, no frozen smile, no face reshaping, no beauty filtering, no synthetic skin shine, no added grain or particles. No VR action, coffee spill, falling, hand choreography or game screen. No music or captions. If audio is produced, only quiet natural room tone. Evaluate this as one small human reaction, not a finished story scene.
```

### 영상 통과 기준

- 같은 시점의 얼굴이 프레임마다 다른 사람이 되지 않는다. 특히 고개를 돌린 뒤 코·턱·눈 크기·헤어라인을 확인한다.
- 눈의 이동과 고개 반응이 자연스럽게 이어지고, 입꼬리만 기계적으로 벌어지거나 치아가 새로 생기지 않는다.
- 피부의 질감·노출이 움직임에 따라 점멸하지 않으며 얼굴과 방의 빛이 분리되지 않는다.
- 시작/중간/끝 정지 프레임뿐 아니라 1배속 전체 재생으로 확인한다. 디코딩 성공을 연기 품질 통과로 대신하지 않는다.
- 사용자가 얼굴 닮음과 PULSE 수준의 사람 질감을 함께 확인해야 다음 본편 동작으로 넘어간다. 실패하면 이번 한 컷의 광원·표정·앵글을 조정하고 전체 콘티 배치 생성으로 확대하지 않는다.

## 비용·실행 범위

- 이 초안 단계는 로컬 문서만 작성했다. 이미지/영상 생성, 사진 추가 업로드, 새 Soul 학습, 유료 실행은 없다.
- 기존 **YUHO 24장** 캐릭터를 사용한다. 이름이 비슷한 별도 캐릭터를 고르거나 학습 지연을 이유로 중복 제출하지 않는다.
- 다음 실행은 기준 이미지 **1장**부터다. 실제 생성 화면의 계정·기존 캐릭터 선택·모델·장수·표시 비용을 확인한다. 현재 가격을 과거 견적에서 추정하지 않는다.
- 승인 이후 영상도 짧은 **1컷** 단위다. 예산 절약을 위해 검토 전 자동 재생성·다중 결과·고해상도 승격을 하지 않는다. 신규 결제·충전은 하지 않는다.

## 이번 준비에서 읽은 근거

- [Soul ID 현재 기록](README.md): YUHO·24장·학습 접수/대기 이력, 출처 구성, 별도 YuhoCornrow와 구분, 다음 작은 반응 시험 원칙.
- [선별 명세](selection-manifest.json): 24장·20/4 구성·앉은 상반신 위주 한계, 실제 촬영 프레임과 처리 기록.
- [프로젝트 제작 기록](../README.md): PULSE 질감 승인, 원본 합성 거절, 실제 본인+공간을 함께 구성하는 다음 경로.
- [분할 콘티](../실촬영_분할콘티_20261001.md): 본인/의상/소품/층별 브랜드, 47초·25컷 유지, 추가 촬영 불가. 본문에 남은 과거 원본 합성 우선 계획은 맨 위의 후속 거절보다 앞선 이력으로 읽었다.
- [PULSE 승인 JSON](../video/human-realism-approval.json), [당시 성공 프롬프트](../prompts/pulse-human-performance-t2v-v1.txt): 촬영 질감의 승인 범위와 구체적인 빛·렌즈·연기 설계. 이 조건이 성공의 단일 원인임을 증명한 것으로 해석하지 않는다.
