# 실제 발화·웃음 보존 검증

## 목표와 현재 판정

목표는 카페 대사를 말하고 웃는 동안에도 유호로 보이는 완성 영상이다. 정지 이미지가 닮거나 원본 참고 영상을 모은 것만으로 완료하지 않는다. test-07은 사용자가 무표정은 닮고 발화는 닮지 않는다고 판정했으므로 동적 얼굴 재현 불합격이다.

영상 파일 471개의 목록을 조사하고, 복사본·중간 렌더·마스코트를 구분했다. 471개를 모두 재생했다는 뜻은 아니다. 서로 다른 실제 촬영 두 그룹에서 발화와 웃음 근거를 확보했다. 원본 4개의 약 50분 촬영물은 기존 프레임 조사와 이번 후보 정밀 확인을 연결해 탐색했다. 상세 범위·실제 확인은 inventory.md 및 interview 관찰 기록을 따른다.

## 실제 동작 입력

- 웃음 보존 우선: `interview/MVI_2550_01098.0_01108.0_three-quarter-teeth-smile.mp4`.
- 가림 없는 정면 발화: `interview/MVI_2548_00351.2_00358.2_frontal-unoccluded-smiling-speech.mp4`.
- 정면 발화→미소의 전체 맥락: `interview/MVI_2548_00345.5_00355.5_frontal-speaking-to-smile.mp4`. 350.5초 무렵 손이 코/입을 가리므로 그 부분은 생성 입력으로 우선하지 않는다.
- 원래 웃음은 눈이 좁아지고 볼이 올라가며 입꼬리가 비대칭으로 변한다. 이 움직임 자체를 지워서 닮음을 맞추지 않는다. 치아 노출, 턱 길이, 코 폭과 각 특징의 관계가 실제 웃음과 함께 유지되어야 한다.

## A. 실제 웃음 동작 유지 시험 — 대본 변경 전

Google Vids 수정 모드에 웃음 보존 우선 영상을 넣는다. 첫 실험은 추가 인물 이미지 없이 배경만 바꾼다. 의상·음성·대본까지 동시에 바꾸지 않는다. 아래 지시가 모델의 픽셀 잠금 기능을 보장하는 것은 아니다.

업로드 후보는 `upload-ready/yuho-genuine-smile-under10s.mp4`다. 기존 10초 참고본의 컨테이너 길이는 10.009317초여서 끝의 약 0.1초를 덜어낸 9.920초 사본을 준비했다. 원본 앞부분 593프레임과 사본의 디코딩 픽셀이 모두 동일함을 확인했다. 웃음의 시작·정점·회복 구간은 유지했다. 원본 파일은 보존했다. 무손실 사본은 약 193MiB이고 High 4:4:4 Predictive 프로파일이므로 실제 Google 업로드 호환성은 아직 미확인이다. 업로드가 거절되면 일반 H.264 호환 사본을 만들되 얼굴 움직임의 재생성은 하지 않는다.

이 시험은 원본 구도를 보존해야 하므로 입력과 동일한 가로 16:9를 선택한다. 참고본은 59.94fps, 생성 출력은 24fps일 수 있으므로 프레임 번호 대신 같은 재생 시각으로 비교한다. 특히 상대 시각 1.5~4초의 웃음 변화와 앞뒤 발화를 연속 재생해 확인한다.

> Change only the interview-room background to a naturally lit Korean cafe. Preserve the actual man from this source video, his original clothing, hair, original audio and speech, framing, timing, every speaking and smiling movement, and all facial features. Keep the complete genuine smile onset, peak and recovery, including his real narrowing eyelids, rising cheeks, asymmetric mouth corners, teeth exposure and long narrow chin. Do not reduce or replace his smile. Do not generate a new face, reshape features, beautify, add a generic grin, or freeze his expression. One continuous shot with the exact source duration.

입력과 출력의 같은 시점을 전체 1배속 및 0.5배속으로 비교한다. 말하기와 웃음 정점이 모두 일치해야 A 통과다. 원본 대사를 유지하는 시험이므로 카페 완성본이라고 제공하지 않는다.

## B. 카페 의상·정면·실제 표정 참조

내장 이미지 생성 도구로 두 보조 이미지를 만들었다. 각각 실제 발화/웃음 프레임에서 출발했으며 원본 표정을 보존하고 배경과 옷만 바꾸도록 요청했다. 현재 생성 후보이며 사용자 승인이나 동영상 성공 근거는 아니다.

- `cafe-expression-references/yuho-speaking-cafe.png` ← MVI_2548 350초.
- `cafe-expression-references/yuho-smiling-cafe.png` ← MVI_2550 1102초.
- 각 폴더의 speaking-prompt.txt / smile-prompt.txt에 정확한 지시문 보존.

### 원본보다 나이 들어 보인다는 후속 피드백

사용자가 닮았으나 원래보다 약간 늙어 보인다고 피드백했다. 현재 브라우저는 연결되지 않아 사용자가 보고 있는 정확한 화면은 재확인하지 못했다. 저장된 실제 웃음 프레임과 카페 참조 이미지를 비교했으며 생성 이미지의 눈가·볼 선과 피부 대비가 원본보다 또렷한 점을 확인했다. 다만 원본은 저대비 촬영 프레임이므로 해상도·조명 차이와 생성 변화가 함께 작용할 수 있다.

내장 이미지 편집으로 `cafe-expression-references/yuho-smiling-cafe-age-match-v2.png`를 별도 후보로 만들었다. 원본 표정·얼굴형을 기준으로 두고, 과장된 눈밑 그림자·주름 대비·피부 세부 대비만 줄이는 지시를 사용했다. 정확한 지시는 `smile-age-match-v2-prompt.txt`. 사용자가 “지금 느낌으로 카페 영상” 제작을 승인했으므로 이 정지 이미지에서 후속 test-09를 생성했다. 정지 이미지 승인은 동적 닮음 승인과 구분한다. 기존 파일은 보존했다.

후속 영상에도 다음 조건을 추가한다: "Match the source person's natural apparent age. Preserve the complete speaking and smiling motion while matching the source depth and contrast of facial lines and skin texture. Do not add or intensify wrinkles, under-eye shadows, cheek folds, pore contrast or sharpening. Do not reshape the face, enlarge the eyes, suppress the smile or apply a plastic beauty filter." 나이를 임의로 지정하거나 원본보다 젊은 별도 얼굴을 만드는 지시로 대체하지 않는다.

## C. 목표 대사 및 웃음의 최종 시험

A에서 동작 보존을 확인한 뒤 카페 대사와 의상을 적용한다. 실제 카페 대사에 없는 원본 발화를 완성된 대본으로 속이지 않는다. 실제 "감사합니다"가 포함된 원본 구간은 따로 조사해 사용 가능성을 검토한다. 나머지 새 대사에는 발화 재생성이 필요하며 닮음과 입 모양을 다시 검증해야 한다.

합격 범위: "다시 말해 주세요", 응답 대사, 말하기→미소 전환, 치아가 드러나는 웃음, 표정 회복. 웃음을 작게 만들거나 입을 숨겨서 통과시키지 않는다. 얼굴 형태, 음성/입 모양, 감정 연기, 전체 편집 연결을 각각 확인한다. 최종 사용자 동적 닮음 판단이 남아 있으면 목표 미완료다.

## 현재 실행 상태

2026-09-27 test-10 결과: 실제 동작 영상과 “배경만 교체” 지시를 Google Vids Omni 수정에 넣어 가로 1080p/24fps/9.834초 영상을 생성했다. 원본과 비교했을 때 0.5/1.5초 입 벌어짐, 4초 치아 노출, 8초 발화 입 모양이 다르며 인물 자세도 재합성됐다. 큰 웃음의 흐름 일부를 따라왔으나 표정 그대로 보존하는 시험은 통과하지 못했다. `../google-vids/motion-review/`에 6시점 비교·관찰·브라우저 1배/0.5배 전체 재생 근거를 보존했다. 이 결과를 사용자 얼굴 재현 성공으로 보고하지 않는다.

후속 방식: 캐시된 로컬 인물 분리 모델로 원본 영상의 인물 마스크만 계산하고 원본 RGB는 그대로 두어 카페 배경에 합성했다. `../google-vids/motion-composite/yuho-original-face-cafe-10s.mp4` — 9.92초, 1920×1080, 24fps, 238프레임. 첫 1초 샘플 24프레임과 전체본의 5개 무손실 표본에서 인물 내부 RGB 차이 0과 중앙 얼굴 alpha 1.0을 확인했다(인코딩 전). 전체 238프레임의 인코딩 후 중앙 얼굴 평균 오차는 1.569/255이며, 원본과 출력의 디코딩 음성 해시는 같다. 전체 디코딩 및 브라우저 원본/합성 동시 끝까지 재생 확인. 얼굴·음성·대사는 원본 인터뷰 그대로이며, 새 카페 대사를 만들어 낸 시험은 아니다. 머리카락 외곽의 밝은 경계는 별도 마감 과제다. 표정 보존 방법을 확인한 로컬 비교본이며 사용자의 자연스러움 판단과 새 카페 대사 구현은 남아 있다.

2026-09-27 v4 후속 사용자 판정: “조금 비슷하긴한데 아직도 내 웃음이랑 미소랑 약간 다른것같네”. 따라서 v4는 표정 재현 승인본이 아니다. 사진 1장 기반의 웃음 재생성을 반복하는 대신 위 A의 실제 동영상 배경 변경 시험을 진행한다. 원본 미소 영상에서 만든 9.920초 호환 사본 `upload-ready/yuho-genuine-smile-under10s-compatible.mp4`는 1920×1080/59.94fps, 593프레임, 약 14.2MB다. H.264 CRF16/yuv420p로 형식 호환 변환하고 원래 AAC 음성을 복사했으며 얼굴을 재생성하거나 시간 흐름을 바꾸지 않았다. 손실 압축이므로 디코딩 픽셀이 원본과 완전히 같다고 주장하지 않는다. 시험 지시문은 `../google-vids/test-10-motion-preservation-prompt.txt`.

2026-09-27 후속: 브라우저 연결을 복구하고 승인된 age-match-v2 이미지를 Google Vids Omni에 업로드해 `../google-vids/test-09-age-match-cafe.mp4`를 생성·다운로드했다. 1080×1920, 24fps, 10.005초. 이번 입력은 정지 이미지이며, 위 A의 원본 영상 동작 보존 시험을 실행한 것은 아니다. 정확한 지시는 `../google-vids/test-09-prompt.txt`다.

자동 받아쓰기에서 “다시 말해 주세요”, “영수증 필요하세요?”, “아, 괜찮아요. 감사합니다”를 확인했다. 8개 표본 프레임에서 3/4 구도·머리·의상·얼굴 윤곽의 급격한 변화와 눈가 주름의 과도한 증가가 두드러지지 않았고, 발화 후 눈이 좁아지며 웃는 변화가 있다. 이 확인은 직접 청취·세밀한 입 모양·사용자의 동적 닮음 승인을 대체하지 않는다.

새 영상만 사용하는 15.208초 학습 편집을 `../rebuild-v4/SYNK_LAB_CAFE_AGE_MATCH_v4.mp4`로 렌더했다. 전체 디코딩·자막 배치·브라우저 끝까지 재생 확인, 사용자 동적 닮음 승인과 직접 청취는 별도다. 신규 결제·구독·충전·SNS 게시 없음. 기존 v3 파일과 Google 문서의 이전 30초 타임라인은 보존했다. test-09는 생성 결과로 내려받았으며 이전 타임라인을 교체하지 않았다. 앞선 연결 대기 상태는 해소됐지만 말할 때와 웃을 때의 최종 닮음 승인은 남아 있다.
