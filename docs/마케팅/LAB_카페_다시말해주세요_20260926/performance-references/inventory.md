# 말하기·웃음 재현용 촬영 자료 조사

조사일: 2026-09-27. 원본은 변경하지 않았다. 새로운 업로드·설치·삭제 없이 파일 목록, 기존 편집 기록, 기존 썸네일과 제한된 새 프레임을 확인했다.

## 조사 범위와 해석

- `C:\Users\q1212\Videos`
- `C:\Users\q1212\OneDrive\Desktop`
- `C:\Users\q1212\Desktop`
- `C:\Users\q1212\Documents\SYNK-appsscript\outputs`
- `C:\Users\q1212\Documents\SYNK-appsscript\artifacts`

대소문자 확장자와 숨김·ignore 파일까지 포함하여 동영상 471개, 논리적 크기 약 66.12 GiB를 찾았다. 이는 촬영 471건이 아니다. 대부분 인터뷰의 중간 렌더, 알파 자막, 보정층, 파생 컷이다. 이 조사 범위 밖의 전체 PC·외장 장치·온라인 보관소를 다 확인했다는 뜻도 아니다.

열거한 파일에는 Windows Offline(0x1000)·RecallOnDataAccess(0x400000) 플래그가 없었다. OneDrive의 `525344`는 Archive/ReparsePoint/Pinned 조합으로, 숫자가 크다는 이유만으로 온라인 전용으로 판단하지 않는다. 실제 읽기 성공 여부는 아래 ffprobe/프레임 확인과 별개로 기록했다. 수정 일시는 촬영 날짜의 증명이 아니다.

원시 파일 목록은 `inventory-paths.json`, 제한된 11개 파일의 현재 길이·해상도·프레임레이트 확인은 `inventory-probes.json`에 있다.

## 우선 사용할 실제 촬영

### A. 9월 24~25일 Jordan 상의 인터뷰 원본 4개

| 현재 실제 절대경로 | 길이 | 파일 수정 일시 | 현재 확인 | 중복 관계 |
|---|---:|---|---|---|
| `C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2547.MP4` | 723.489초 | 2026-09-24 23:12 | ffprobe 성공 | 식물 배경의 좌향 3/4 원본 |
| `C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2548.MP4` | 1021.587초 | 2026-09-24 23:30 | ffprobe 성공 | 정면 원본 |
| `C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2549.MP4` | 118.585초 | 2026-09-24 23:53 | ffprobe 성공 | 창문 배경의 우향 3/4 짧은 원본 |
| `C:\Users\q1212\OneDrive\Desktop\새 폴더 (3)\MVI_2550.MP4` | 1143.476초 | 2026-09-25 00:12 | ffprobe 성공 | 우향 3/4 긴 원본 |

4개 모두 현재 ffprobe 기준 1920×1080 HEVC, 60000/1001 fps. 현재 새 프레임 전체 스캔은 중복하지 않았다. 기존 실제 프레임을 바탕으로 작성된 다음 보고서가 원본 시간 탐색에 바로 쓸 수 있다.

- `C:\Users\q1212\Documents\SYNK-appsscript\outputs\interview_20260925\analysis\visual\visual_review.md`
- 같은 폴더의 `candidate_sheet_1.jpg`~`candidate_sheet_6.jpg`, `MVI_2548_0350_full.jpg`, `MVI_2550_0770_full.jpg`

기존 보고서의 **후속 확인 우선 시간**: MVI_2548 350초 전후(정면 웃으며 설명), 1000~1008초(정면 미소와 발화); MVI_2550 1098~1118초(자연 웃음, 1102초 치아 살짝 보임); MVI_2547 692~696초와 704~712초(3/4 미소). 이 시간 추천은 과거 검토 기록이며, 이번 생성에 쓰기 전 담당자가 실제 후보를 다시 확인해야 한다.

`outputs/interview_20260925`, `artifacts/interview_20260925`, `Videos/SYNK_1231_Interview_20260925`, `Videos/SYNK_Premium_Interview_20260925` 아래 결과물은 관련 편집기록에서 이 원본군의 파생 편집으로 확인된다. 별도 촬영으로 세지 않는다. 최신 v9의 세부 웃음 분석은 다른 조사에서 진행하므로 여기서 중복하지 않았다.

### B. 9월 23일 별도 촬영: 흰색 티셔츠 인터뷰

현재 사용 가능한 정면 발화 컷:

- **`C:\Users\q1212\Videos\SYNK_Interview_20260923\renders\ResolveClean\04.mp4`**
- 길이 10.433초, 1920×1080, 30fps, H.264. ffprobe와 새 프레임 추출 성공.
- `edit_plan.json`상 원본 **MVI_2359.MP4 165.52~175.94초**에 해당한다.
- 새 대표 프레임: `inventory-interview0923-front.jpg` (컷 3초, 깜빡이는 순간이므로 정지 기준으로 채택하지 않음).
- 새 움직임 표본: **`inventory-interview0923-front-sequence.jpg`**. 컷을 2초 간격으로 샘플링한 5개 프레임이며 마지막 검정 칸은 시트의 빈 칸이다. 실제 영상의 검정 장면이 아니다.
- 시각 확인: 정면에서 입을 벌리고 설명하며 눈을 좁히고 고개를 조금 움직이는 실제 발화. 큰 웃음 참고보다는 말할 때의 입·눈·턱 움직임 참고에 적합하다. 흰 티셔츠와 콘로우, 배경이 확인되어 9/25 Jordan 상의 촬영과 다른 테이크군이다.
- 사용자 인터뷰 맥락과 기존 편집 정보가 연결되는 촬영만 후보에 포함했다. 이름만 같은 다른 인물을 추가하지 않았다.

현재 존재하는 전체 편집본:

- `C:\Users\q1212\Videos\SYNK_Interview_20260923\renders\SYNK_Interview_FINAL_1080p.mp4` — 165.300초, 1920×1080, 30fps. 현재 ffprobe 성공.
- 같은 촬영의 숏폼 `short_v2\SYNK_Interview_SHORT_FINAL_1080p.mp4`와 `renders\ResolveClean\01.mp4`~`12.mp4`는 별도 촬영이 아니라 파생 컷이다.

직접 본 기존 대표 이미지:

- `C:\Users\q1212\Videos\SYNK_Interview_20260923\review\contact_sheet.jpg` — MVI_2351·2352의 작업/설명, MVI_2355~2360의 다양한 인터뷰 구도.
- `C:\Users\q1212\Videos\SYNK_Interview_20260923\review\MVI_2359_full.png` — 정면 입을 열고 말하는 큰 프레임.

과거 편집 코드의 원본 위치 `C:\Users\q1212\OneDrive\Desktop\MVI_2359.MP4`는 현재 없다. 그러므로 남아 있는 무자막 컷과 이미지까지는 사용할 수 있지만, 원본 전체에 새로 접근했다고 보고하면 안 된다.

## 중복을 확인한 자료

`C:\Users\q1212\Videos\SYNK_Premium_Interview_20260925\shorts_v1`의 A~F 6개 MP4와 `C:\Users\q1212\OneDrive\Desktop\SYNK_창업자_인터뷰_세로클립_v1`의 같은 이름 6개는 **각각 SHA-256이 동일**했다. 별도의 촬영 12개로 세지 않는다. 해시 근거: `inventory-duplicate-verification.json`.

현재 `OneDrive\Desktop\SYNK_창업자_인터뷰_v9`는 실제 동영상 사본이 아니라 Videos의 최종 자료로 이어지는 `.lnk` 모음이다.

## 확인했지만 얼굴 기준에 포함하지 않은 자료

| 자료 | 현재 확인 | 제외 이유 |
|---|---|---|
| `C:\Users\q1212\Videos\OneDrive_video_local_20260924\Desktop\SYNK PULSE\인물\완성 영상\source-natural-5s.mp4` | 5.005초, 2초 프레임 확인 | 앞머리 있는 남성의 세로 영상. 파일명·외모만으로 지금 요청의 실제 촬영/본인이라고 확정하지 않음. 생성·편집 출처도 확인되지 않아 기준 제외. |
| 같은 폴더 `yuho-cafe-5s-final.mp4` | 5.000초, 2초 프레임 확인 | 위 영상과 같은 자세에 배경이 바뀐 파생 결과. 얼굴을 학습할 실제 촬영 기준으로 쓰지 않음. |
| `...\문서\카카오톡 받은 파일\KakaoTalk_20260911_183823135.mp4` | 206.400초, 첫 부분 프레임 확인 | 가족 옛 사진 슬라이드. 최근 본인 말하기·웃음 영상 아님. |
| 같은 폴더 `KakaoTalk_20260905_164441733.mp4` | 26.137초, 프레임 확인 | 게임 녹화. |
| 같은 폴더 `KakaoTalk_20260921_183737975.mp4` | 10.000초, 프레임 확인 | 고양이 영상. |
| `C:\Users\q1212\Videos\SYNK_LAB_표현소개\EP01_아맞다_20260927\SYNK_LAB_아맞다_EP01_KO_음성.mp4` | 실제 2초 프레임 추출·직접 확인 (`inventory-lab-expression.jpg`) | 빨간 마스코트와 `아 맞다!` 설명 자막 영상. 실제 사용자 얼굴·카페 발화 참고가 아님. 같은 폴더 EN 파생본 2개도 별도 촬영으로 세지 않음. |
| `synkbrief_회의정리` 계열 | 목록과 기존 제작 분류 확인 | 촬영 원본 후보가 아닌 콘텐츠 렌더. 얼굴 자료로 편입하지 않음. |
| 2026-08-31 KakaoTalk 3개와 6월 MV/웹드라마 3개 | 목록만 확인 | 최근 사용자 촬영으로 연결되는 근거 없음. 전체 재생하지 않았고 얼굴 자료에서 제외. |

`...\문서\카카오톡 받은 파일`의 완전한 앞부분은 `C:\Users\q1212\Videos\OneDrive_video_local_20260924`이다. 각 확인 프레임은 이 폴더의 `inventory-pulse-*.jpg`, `inventory-kakao*.jpg`에 보존했다.

## 찾았지만 현재 원본이 없는 기록

- `C:\Users\q1212\Videos\SYNK_Friends_Teaser_20260920\Friends_Teaser_FINAL_4K.mp4`: **디렉터리부터 현재 없음**. 과거 기억은 경로 탐색에만 사용했고 현재 자료라고 취급하지 않았다. 조사한 5개 루트 안에서는 Friends 티저의 다른 실제 동영상을 찾지 못했다.
- `C:\Users\q1212\OneDrive\Desktop\zzdz.mov`, `...\kkkkkkkkkkkkk.mov`: 현재 없음. 남아 있는 보정 기록과 썸네일은 Jordan 상의 인터뷰로 보이며, 별도 웃음 촬영이라고 셀 근거가 없다.
- 전체 PC/휴대폰/외장 디스크에 다른 원본이 있을 가능성은 이 조사만으로 배제하지 않는다. 다만 현재 접근 가능한 9/25 네 원본과 9/23 정면 무자막 발화만으로도 이전 단일 무표정 이미지보다 동적 참조를 보강할 수 있다.

## 제작 반영 시 주의

무표정 기준 이미지 한 장에 일반적인 웃는 연기를 주문하는 대신, **같은 촬영의 실제 발화→웃음 연속 구간**을 우선 사용한다. 9/23 촬영은 추가 입 모양과 표정의 관찰 근거이며, 의상·배경·피부 보정을 섞어 새로운 얼굴을 평균내도록 지시하지 않는다. 참고 영상을 확보했다는 사실만으로 생성 결과가 본인과 닮았다는 검증이 끝난 것은 아니다.
