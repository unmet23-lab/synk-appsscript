# Google 무료 영상 경로 확인 — 2026-09-27

사용자가 Google Flow 또는 세 글자 이름의 무료 영상 도구를 문의했다. 정확히 기억한 제품명은 미확정이다. LTX는 Google 제품이 아니다.

## 공식 안내

- Google Flow: 구독 없이 하루 50 Google Flow credits. https://support.google.com/flow/answer/16526234?hl=en
- Google Vids: 2026-09-23 공식 발표에서 Omni 1.1 Flash 무료 영상 생성을 안내. https://blog.google/products-and-platforms/products/workspace/gemini-omni-in-google-vids/
- Vids 개인 계정의 공식 한도: AI 아바타와 영상 클립 합산 월 6회. https://support.google.com/docs/answer/15609411?hl=en
- LTX Desktop: 로컬 생성에 건당 사용료 없음. Windows 공식 요구 사양은 NVIDIA 24GB 이상 VRAM, RAM 32GB, 저장 공간 100GB 이상. 이 PC의 충족 여부는 이번에 확인하지 않음. https://ltx.io/ltx-desktop

## 실제 화면

- Flow: flow.google.com/unsupported-country로 연결됨. 시작 개인정보 고지 뒤에 지역 제한 안내가 보임. 대한민국은 공식 지원 목록에 있으므로 한국 전체가 지원되지 않는다고 판단할 수 없음. 계정/현재 접속 환경의 원인은 확인하지 못함.
- Vids: 현재 기본 로그인 계정에서 시작 및 생성 패널 진입 성공. Omni, 세로, 720p, 10초 설정 확인. 1080p 선택은 비활성.
- 최초 접근 시 개인용 빈 Vids 문서가 생성됨. 공유되지 않았으며 생성 버튼은 누르지 않음. 영상 생성 성공이나 계정의 남은 무료 횟수는 아직 검증하지 않음.
- 기존 제작 계정도 Google 계정 선택 목록에 있음. 실제 제작은 기존 제작 계정으로 맞춘 후 진행할 것.
- 결제, 업그레이드, API 키 발급, 얼굴 이미지 업로드는 하지 않음.

## 첫 장면 테스트 원고

목적: 인물이 실제로 움직이며 한국어를 말할 때의 자연스러운 표정, 대사 정확도, 두 사람의 화자 구분을 짧게 검증.

설정: 세로 9:16, 720p, 약 10초, 1개 결과. 무료 한도 표시를 확인한 후 생성. 유호의 기준 이미지를 Google Vids에 새로 전송하려면 해당 목적과 전송 대상을 사용자에게 확인한다.

```text
Create a 10-second photorealistic vertical 9:16 Korean cafe comedy scene. Use the supplied cafe reference image to maintain the same two adult characters, clothing, hair, counter, and daylight. Natural skin texture, restrained acting, realistic conversational timing. No subtitles, logos, music, or invented written text.

0.0-2.6s: Medium two-shot. The adult female barista asks briskly but warmly in Korean, "드시고 가세요, 가지고 가세요?" Her two options run together naturally, as in a real busy cafe. She looks at the male customer.
2.6-3.3s: Cut closer to the male customer. He gives a small confident nod and answers "네!" a little too quickly.
3.3-4.8s: Cut to the barista. She pauses, tilts her head slightly, and gently asks "어느 쪽이요?" She is friendly and genuinely waiting for a choice, never mocking him.
4.8-6.2s: Cut to the customer. His smile falters as he realizes he answered a choice question with yes. A brief awkward breath and restrained eyebrow movement make the moment funny. Do not exaggerate or distort his face.
6.2-8.8s: He relaxes and politely asks, "다시 말해 주세요." Deliver this as an actual request to the barista, not as a classroom narrator. Clear Korean, natural breathing, a small rising request intonation.
8.8-10.0s: The barista nods with a reassuring smile. End on the two-shot, ready for her clearer explanation in the next clip.

One speaker at a time. Each quoted line is spoken once, exactly as written, by the specified speaker. Keep lips synchronized to Korean dialogue. Subtle cafe ambience only, clear dry voices in the foreground. No laughter track and no artificial slow motion.
```

채택 기준:

- 유호 얼굴 일관성, 손·입술·표정 왜곡 없음.
- 네 문장 정확, 화자 뒤바뀜 없음, 중간 대사 잘림 없음.
- 선택 질문에 '네'라고 한 어색함이 표정과 쉼으로 전달됨.
- 표현이 광고 나레이션처럼 들리지 않음.
- 실제 영상 파일로 내보내고 재생·청취 후 전체 편집에 채택 여부 판단.
