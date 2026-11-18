# 최종본 검사 — 다 만든 영상 한 편에서 컷 전수 검수가 되풀이해 잡던 것을 기계로 잰다(2026-11-13, 유호님 「실수한것들이나 검수에서 지적받은부분들 다음에 참고해서
# 더 효율적으로 제작할수있게 어느정도 반영되고있어 ?」 → 「응, 고쳐」).
#
# 왜 있나: 「사람이 굳음」(점검표 26) · 「같은 판을 배율만 바꿔 이어 붙임 · 같은 장면 두 번」(50) · 「끝 3초가 약함」(2) · 「낮은 화소를 크게」(48)가 B38 v10 →
#   B39 v10 → B39 v16 → 메일비서 v12까지 편마다 마지막 컷 전수 검수에서야 잡혔다. 그 검사들(사람움직임.py · 컷연속성검사의 「같은판」)은 받은 판이나 컷표(틀 2)를
#   보는데, SNS 두 브랜드 편은 옛 컷표이거나 컷표가 없고 편집에서 판을 잘라 키운 것은 컷표에 안 나온다. 그래서 최종 영상 하나만 보고 잰다 —
#   올리기 전 검사 ⑳이 부르고(재연 · 진행자 편), 혼자 불러도 된다.
#
#   python -I -X utf8 tools/최종본검사.py <최종.mp4> [--json] [--항목 굳음,같은판,되풀이,끝,화소,조용,멈춤,첫머리[,흐름][,말]] [--컷초 3.9,5.87,…]
#   「흐름」은 기본 항목이 아니다. 영상 마감 관문(tools/영상관문판.py)이 붙여 부른다. 맞춘 자료가 애니 공모전 한 편뿐이라 SNS 올리기 전 검사에는 아직 넣지 않았다.
#   「말」도 기본 항목이 아니다(알림만 낸다). 최종 확인 묶음이 「--항목 기본,말」로 부르고, 만드는 세션은 렌더 뒤 「--항목 말」로 표를 본다(제작 절차 「순서」 2).
#
# 잰 것(결과 「걸림」의 항목 이름 — 올리기 전 검사가 이 이름으로 등급을 매긴다):
#   굳음      컷마다 사람움직임.py(카메라를 걷어 낸 사람 자리 움직임, 480×270 장당 px)의 「사람」 값 — 0.12 아래(점검표 26 문턱)이고 사람 자리를
#             얼굴 · 실루엣으로 잡은 컷. 0.8초 아래 컷은 재지 않는다. 얼굴 극접사(「가까움」)는 값이 미덥지 않아 알림으로만
#   구간굳음  3초 넘는 컷 안에서 1.5초 창(0.5초씩)이 잇달아 0.12 아래인 자리 — 컷 전체 값은 넘어도 뒤 절반이 멎은 꼴(B39 v10 54.4~57.0)
#   첫머리굳음 컷 첫 0.25초가 굳은 채로 시작한다(11-18 서울로 1:48 C14s 「이 장면 시작할떄 0.1초정도 굳어있는 상태에서 시작」 · 11-14 1:08과 같은 짜임,
#             점검표 26). 생성 영상(Omni · Seedance)은 0~1초를 느리게 출발하는데 편집이 원본 0.3초 언저리부터 쓰고, ease로 미는 창(첫 속도 0)이 겹친다.
#             굳음 · 구간굳음은 컷 전체나 컷 안 1.5초 멈춤만 재서 이 짜임을 못 잡았다. 끝 코드를 바꾸지 않는 걸림이다(SOFT).
#             어떻게: 긴 변 192 회색 장(컷 찾기 · 화면멈춤과 같은 장 — 더 풀지 않는다)의 이웃 장 차이에서 두 장 안의 큰 값을 장 움직임으로 보고,
#             컷 경계 다음 6장의 평균이 그 컷 가운데(길이 30~70%) 평균의 0.3배 아래이고 컷이 1초 넘으면 걸린다. 경계는 찾은 경계에 --컷초를 더한다.
#             걸릴 만한 컷만 카메라 옮김(위상 상관)을 재서, 카메라가 서 있다가 출발하는 컷(서울로 Q02 난간 접사)은 「알림」에만 적는다.
#             영상 맨 앞 덩이(0초)와 검은 화면에서 밝아지는 첫머리(결이 없는 장)는 재지 않는다.
#             맞춘 자료(서울로 라t · 라w 54컷): 라t C14s 0.27 · Q05b 0.18 · R06k 0.17 · Q09j 0.24가 걸리고 라w는 0곳. 맡긴 판정 그대로(장 차이 평균 ·
#             절반)면 라w에서 15곳이 걸려 문턱을 0.3으로 내렸다(지나갈 컷 가운데 가장 낮은 것이 라w Q09j 0.34 · R14 0.36). 헛걸림 수와 다른 편 실측은 tests/최종본검사.test.js 머리에 있다.
#   같은판    이웃한 두 컷의 경계 장이 한 그림의 배율 · 자리만 바꾼 것(닮음 변환이 화면 넓게 맞음 · 배율 6% 넘게 다르거나 25px 넘게 옮김) — 같은 판을 잘라 붙임
#   같은구도  이웃한 두 컷이 배율 · 자리까지 같은 그림(점프 컷)
#   되풀이    이웃하지 않은 두 컷의 가운데 장이 같은 그림(배율이 달라도) — 「똑같은 장면이 반복」(11-12 서울로) · 같은 판 두 번(B39 21.4초 = 54.4초)
#   끝소리    끝에서 2초 넘게 0.25초 칸마다 몸통 소리 가운데보다 10dB 넘게 작다 — 끝에 소리 한 방 없이 방 소리만 남는다(점검표 2 · B39 v10 −43dB)
#   끝화소    끝 3초에 걸린 컷의 가는 결 비(가는 결 / 중간 결 에너지)가 0.125 아래 — 720p 판을 화면에서 또 잘라 키운 흐린 끝(점검표 48 · 2,
#             B39 v10 57~58.5초 0.107). 끝 밖의 컷은 값만 「알림」에 적는다(어두운 판 · 얕은 심도와 아직 가르지 못한다)
#   조용구간  가운데(앞 0.5초 · 끝 3초 뺌) 1초 창 소리가 이 편의 큰 소리(몸통 0.25초 칸의 위 10%)보다 10dB 넘게 작은 채 10초 넘게 이어진다 —
#             말 · 사건 소리 없이 작은 소리만 깔린 긴 구간(최종 확인 갈래 「소리」, 흠 장부 설계 3단계 · 11-15). 끝 코드를 바꾸지 않는 걸림이다(SOFT).
#             맞춘 자료(두 브랜드 최종본 45개 · 만족 사례 영상 6개 실측, 걸림 1/51): 걸리는 것 synkbrief 무료체험 28.0~40.75초 12.75초(큰 소리 −11.4dB ·
#             평균 −25.5dB), 지나가는 것 가운데 가장 긴 자리 영상통화연인 8.0초(최종 확인 통과 · 만족 사례 S52) · 없는판결 7.5초 · 질문다섯개 6.5초 · 나머지 5초 아래.
#             10dB를 8 · 12dB로 바꿔도 무료체험만 걸린다(13.25초 · 10.5초).
#             짧고 깊은 빈 소리(필라테스예약 14.0~16.25초 −37~−38dB)는 재지 않는다 — 통과한 영상통화연인 14.5~17.75초가 더 깊고 길어(−37~−40dB) 가를 문턱이 없다
#   화면멈춤  화면 전체가 2초 넘게 그대로다 — 긴 변 192 · 24fps 회색 장에서 이웃 장의 평균 차이가 0.08 아래인 장이 잇달아 2초를 넘는다. 끝에서 0.6초 안에
#             끝나는 멈춤은 끝 화면이라 뺀다(정지구간.js와 같은 값). 말은 이어져도 화면이 서 있는 흠이다(최종 확인 갈래 「멈춘화면」 · 점검표 20, 흠 장부 · 11-16).
#             끝 코드를 바꾸지 않는 걸림이다(SOFT). 올리기 전 검사 ②(tools/정지구간.js)는 0.5초 칸 평균이라 칸 경계에 걸친 멈춤과, ffmpeg tblend가 낸
#             한 장짜리 튐(한도인수인계 7.07초 3.86 — 실제 장은 같다)에 끊긴 멈춤을 짧게 잰다(한도인수인계 5.30~7.40초 2.10초를 1.5초로 재 통과).
#             맞춘 자료(두 브랜드 최종본 38개 · 만족 사례 영상 12개, 걸림 1/50): 걸리는 것 yuhobuilds 한도인수인계 5.29~7.42초 2.13초. 최종 확인을 거친 편과
#             만족 사례는 가장 긴 멈춤이 1.21초다(LAB 관용구 퀴즈 #4 · #5, 지적147 0.08초). 문턱 0.05~0.12 · 길이 1.75~2초 어디서도 이 둘의 판정은 같다.
#             최종 확인 전에 나간 옛 편 가운데 셋째줄그대로(0.08에서 1.80초, 0.1에서 2.33초)와 옛사진복원(1.87초)만 문턱 따라 갈린다.
#             그림 한 장을 천천히 당기는 「거의 그대로」(윈도우깨짐다시 22.1~25.7초)는 장마다 0.9~2.0씩 바뀌어 재지 못한다 — 카메라를 걷어 낸 차이로도
#             통과한 편(지적147 2.12초)과 갈리지 않았다
#   말(알림만 · 11-16 흠 장부 「소리」) 말 시각으로 말 없는 자리 표와 마지막 말 뒤 꼬리를 낸다. 걸림은 내지 않는다.
#             어떻게: silero VAD v6(faster-whisper에 든 모델 · onnxruntime)이 32ms 칸마다 말 확률을 낸다. 0.5 위면 말로 들어가고 0.35 아래면 나오며,
#             0.3초보다 짧은 쉼은 잇는다. 알림 「말」에 말 크기(말 구간 전력 평균) · 말 없는 자리(1초 넘음 — 시작 · 끝 · 길이 · 그 자리 dB · 말보다 몇 dB
#             작은가) · 첫 말 · 마지막 말 뒤 꼬리를 적는다. VAD를 못 쓰면(패키지 없음 · 실패 · SYNK_말시각=끔) 알림에 까닭 한 줄만 적는다(못잼에 넣지 않아 끝 코드는 그대로).
#             왜 VAD인가: 정답이 있는 yuhobuilds 네 편(Remotion에 놓은 목소리 줄 자리)에서 재현 0.955~0.987 · 정밀 0.967~0.992이고, 1초 넘는 말 없는 자리를
#             모두 찾으며 경계는 0.12초 안이다. 받아쓰기(large-v3-turbo) 낱말 시각은 빈 자리 끝을 0.5초쯤 이르게 잡고(정밀 0.89~0.96), 한 편에 불러오기
#             18초 + 8~25초가 들며, 음악만 있는 편에서는 지어내기 고리로 몇 분씩 돈다(base도 269초). VAD는 불러오기 4초 · 돌리기 0.3초다.
#             한계: 이 사이로 하는 작은 말은 놓친다(필라테스예약 「되돌려 놔」 24.1~25.7초 −30dB, 말 확률 0.001 — 받아쓰기는 받았다).
#             걸림이 없는 까닭(맞춘 자료 두 브랜드 최종본 38개 · 만족 사례 12개): 최종 확인이 짚은 말 없는 자리(윈도우깨짐다시 2.98초 · 반짝73 1.82초 ·
#             없는판결 6.46초)보다 통과한 편의 자리가 길거나 깊다(지적147 3.11초 · 영상통화연인 4.23초에 말보다 14.8dB 작음 · 메일비서 8.16초). 짧고 깊은
#             빈 소리(필라테스예약 13.95~16.42초 13.2dB)도 영상통화연인이 더 길고 깊다. 마지막 말 뒤 꼬리는 게시 편 목소리되풀이(4.51초 · 14.9dB)가 걸린 두 편
#             (없는판결 4.34초 16.2dB · 원생명단 6.8초 12.4dB) 사이에 든다. 그 자리의 화면 변화(이웃 장 차이)를 더해도 갈리지 않았다(흠 장부 설계
#             「소리 흠을 말 시각으로 재며 본 것」). 그래서 숫자는 최종 확인 독립 검수자와 만드는 세션의 눈에 맡긴다.
#   흐름(11-16, 컷 안의 탈것과 배경 움직임 — 셋 다 끝 코드를 바꾸지 않는 「확인」이다)
#             왜: 11-15 서울로 「다리가 기억하는 것」 시험에서 카본 영상 심사와 Fable 마감 관문이 유호님이 짚으신 움직임 흠을 하나도 못 봤다. 카본은 1초에 한 장쯤,
#             Fable은 8장 띠로 보기 때문이다(docs/마케팅/PULSE_AI모델_캐스팅_20260930/검수방식_시험_완성영상_카본과Fable_20261115.md). 그래서 기계가 잰다.
#             어떻게: 컷마다 특징점을 긴 변 1000으로 이어 추적한다(Lucas-Kanade, 앞뒤로 추적해 0.3px 넘게 어긋난 점은 버림). 장마다 닮음 변환으로 카메라 움직임을
#             맞추고 그 나머지를 그 점의 움직임으로 본다. 0.5초 넘게 이어진 점의 평균 가로 속도가 초당 2px(화면 너비 1000 기준) 넘으면 「움직이는 점」이다.
#             화면을 띠 셋(위 · 가운데 · 아래) × 왼쪽 · 오른쪽 여섯 칸으로 나누고, 움직이는 점이 25개 넘고 그 85% 넘게 한 방향이면 그 칸의 방향으로 친다.
#             컷은 장 차이로 찾은 경계에 --컷초(관문은 컷표 경계를 준다)를 더해 나눈다 — 천 닦기 같은 전환은 장 차이로 못 찾는다.
#             카메라 배율이 초당 2% 넘게 바뀌는 컷(앞으로 가는 카메라 · 확대)은 ①②를 재지 않는다. 움직이는 점이 가로와 세로로 함께 퍼지거나 모이는 컷
#             (다가오는 차)은 ①을 재지 않는다. 두 퍼짐이 모두 초당 1%를 넘으면 ②도 재지 않는다(바닥 없이 쓰면 퍼짐이 0에 가까운 서울로 라f E03k도
#             부호만 같아 빠졌고, ②에서 아예 빼면 다가오는 버스 지금 판 Q04가 걸렸다).
#   흐름갈림  ① 같은 띠의 왼쪽 칸과 오른쪽 칸이 반대 방향으로 가고, 둘 다 초당 2.5px 넘고, 두 칸의 점이 옆으로 간다(세로 / 가로 속도의 가운데 값 0.5 아래 —
#             카메라 위로 지나가는 버스는 1.4~1.8이라 빠진다) — 같은 길의 차가 서로 반대로 가거나 한쪽이 뒤로 밀린다
#             (서울로 11-14 판 C08 55.3~57.7초: 가운데 띠 왼쪽 −8.0, 오른쪽 +3.2. 고친 지금 판은 같은 방향이라 지나간다)
#   멈췄다감  ② 한 방향으로 가는 칸의 1/8초 속도가, 가다가 0.5초 넘게 멈춘 뒤 다시 간다(간다 = 그 칸 속도 위 20% 값의 40% 넘음, 멈춤 = 속도의 크기가
#             초당 1.5px 아래 — 뒤로 가는 창(차단벽을 밀며 몸을 흔드는 서울로 S04y)과 느려진 창(실이 풀리는 지금 판 E04m 0.6~3.5)은 멈춤이 아니다)
#             (서울로 11-14 판 E03k 147.8~151.7초: 위 띠 오른쪽 금빛 버스가 1초 서 있다가 다시 감. 서 있다가 처음 출발하거나 가다가 끝에 서는 컷은 걸지 않는다.
#             「감」은 1/8초 창 둘 넘게 잇달아야 한다 — 탈것이 화면 밖으로 나간 뒤 남은 점 몇 개가 한 창씩 튀는 값(서울로 Y15w)을 치지 않으려고.
#             사람도 걸린다: 같은 판 S06k는 사진 찍는 아이가 0.9초 굳었다가 다시 움직인다 — 11-15 카본이 짚은 굳음과 같은 자리)
#   제자리바퀴 ③ 한 열에서 위와 아래의 가로 흐름이 반대로 초당 20px 넘고 한 줄에서 왼쪽과 오른쪽의 세로 흐름도 반대다(도는 것). 그런데 도는 자리와
#             그 옆 한 열을 뺀 나머지 칸 흐름의 90번째 값이 초당 10px 아래다 — 바퀴만 돌고 탈것도 배경도 안 간다(긴 변 480 조밀 흐름, 4 × 8칸)
#             (서울로 라f 판 Q06 16.6~18.1초 파란 버스 바퀴: 나머지 칸 흐름 90번째 값 0.2px/s. 11-14 노란 택시 판은 배경이 초당 240px 넘게 흘러 지나간다)
#             맞춘 자료와 헛걸림 수는 tests/최종본검사.test.js 머리에 있다.
# 글자 판 · 표시가 컷을 넘어 그대로 남는 자리는 맞춤에서 뺀다 — 맞은 점이 화면 위아래로 네 줄(80px 칸) 넘게 퍼져야 그림으로 본다(자막 두 줄은 한두 줄).
#
# 끝 코드: 0 걸림 없음(조용구간 · 화면멈춤 · 첫머리굳음 · 흐름 셋만 걸려도 0) / 1 걸림 있음 / 2 잴 수 없음(파일 · ffmpeg). 판정(고칠 것 · 확인할 것)은 올리기 전 검사가 한다 — 이 도구는 잰 값과 자리만 낸다.
#   조용구간이 끝 코드를 바꾸지 않는 까닭: 혼자 부르는 편집 스크립트 · 세션이 끝 코드 1을 「고칠 것」으로 읽어 멈추지 않게(새 항목은 어디서나 확인할 것이다).
# 맞춘 자료(11-13): B39 「없는 판결」 v10(컷 전수 검수 표 — 같은판 4.4→5.5→7.4 · 9.7→11.0 · 54.4→57.0→58.5, 되풀이 21.4=54.4,
#   굳음 4.4~5.5 · 21.4~23.4 · 54.4~57.0, 끝 3초 방 소리 −44dB, 끝 근접 2.55배). 시험: node --test tests/최종본검사.test.js
import argparse
import importlib.util
import json
import math
import os
import subprocess
import sys

import cv2

cv2.setNumThreads(4)   # 올리기 전 검사가 여러 편을 함께 돌려도 PC를 다 잡지 않게
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MOTION_PY = os.environ.get("SYNK_MOTION_PY") or os.path.join(HERE, "..", "docs", "마케팅", "PULSE_포트폴리오_제작준비_20261012", "시댄스무제한", "사람움직임.py")
FPS = 24.0             # 모든 장을 24fps로 풀어 잰다 — 사람움직임 0.12 문턱을 맞춘 판이 24fps이고(30fps 편은 같은 움직임이 0.8배로 나온다),
                       # 가변 프레임 편도 장 번호 = 초 × 24가 된다(11-13 Fable 검수 3 · 4)
CHUNK = 240            # 사람 움직임은 컷을 10초(240장)씩 끊어 잰다 — 한 판 긴 편도 메모리가 컷 길이에 비례해 불지 않게(Fable 검수 8)
FROZEN = 0.12          # 사람움직임.py와 같은 문턱(점검표 26)
MIN_CUT = 0.8          # 이보다 짧은 컷은 굳음을 재지 않는다
WIN, WIN_STEP, WIN_LONG = 1.5, 0.5, 3.0
SCALE_STEP = 0.06      # 같은판: 배율이 이만큼 넘게 다르면 「배율 바꿈」
SHIFT_PX = 25          # 같은판: 긴 변 640 기준 이만큼 넘게 옮기면 「자리 옮김」
MIN_INLIERS = 25
CUT_AREA = 0.3         # 컷으로 볼 바뀐 화면 몫(회색 25 넘게 바뀐 화소)
MIN_ROWS = 4           # 맞은 점이 80px 칸 줄 몇 줄에 퍼져야 그림으로 보나(글자 판은 한두 줄)
REPEAT_INLIERS = 40
END_SEC = 3.0
END_QUIET_DB = 10.0
END_QUIET_SEC = 2.0     # 끝에서 이만큼 넘게 조용하면 「끝 소리 한 방 없음」
DETAIL_FLAG = 0.125    # 이 아래면 잘라 키운 판으로 본다(끝 3초만 걸림 — 그 밖은 알림)
DETAIL_MIN = 5.0
QUIET_REF_PCT = 90     # 조용구간: 몸통 0.25초 칸의 위 10%를 「큰 소리」 기준으로(가운데 값은 긴 조용함 자체에 끌려 내려간다 — 무료체험 가운데 −25.9dB)
QUIET_DB = 10.0        # 1초 창 소리가 기준보다 이만큼 넘게 작으면 조용한 칸
QUIET_SEC = 10.0       # 조용한 칸이 이만큼 넘게 이어지면 걸림
FROZEN_DIFF = 0.08     # 화면멈춤: 이웃 장(긴 변 192 · 24fps 회색) 평균 차이가 이 아래면 같은 장 — 멈춘 장은 0.00~0.03(한도인수인계), 만족 사례 LAB 그래자의
                       # 잔잔한 채팅 화면은 가운데 값 0.11(가장 작은 장 0.05)이라 0.05~0.12 어디서도 판정이 같다
FROZEN_SEC = 2.0       # 같은 장이 이만큼 넘게 이어지면 걸림(제작 절차 「큰 흠」의 「2초 넘게 멈춘 화면」)
FROZEN_END = 0.6       # 끝에서 이만큼 안에 끝나는 멈춤은 끝 화면이라 뺀다(tools/정지구간.js와 같은 값)
SPEECH_TH = 0.5        # 말: silero VAD(faster-whisper에 든 v6) 32ms 칸의 말 확률이 이 위면 말로 들어가고, 0.15 낮은 값 아래로 내려가면 나온다
SPEECH_JOIN = 0.3      # 이보다 짧은 쉼은 한 말로 잇는다
SPEECH_GAP = 1.0       # 「말 없는 자리」 표에 적는 가장 짧은 빈 자리(초)
LINE_QUIET_DB = 13.0   # 작은 줄: 받아쓰기 줄 하나가 그 편 줄 크기 가운데 값보다 이만큼 넘게 작다(최종 확인 묶음이 짚는다 — 이 도구 걸림이 아니다).
                       # 묶음과 같은 셈으로 50편을 재니 필라테스예약 「되돌려 놔」 15.5dB만 넘고 나머지는 11.2dB(무료체험 「됐다」) 아래다 — 12~15 어디서도 같다
LINE_MIN_SEC = 0.3     # 이보다 짧은 받아쓰기 구간은 줄 크기에서 뺀다
SOFT = {"조용구간", "화면멈춤", "흐름갈림", "멈췄다감", "제자리바퀴", "첫머리굳음"}     # 끝 코드를 바꾸지 않는 걸림 — 검사이력에도 등급 「확인」으로 남는다
DEFAULT_ITEMS = "굳음,같은판,되풀이,끝,화소,조용,멈춤,첫머리"
# 흐름(컷 안 탈것 · 배경 움직임) — 값은 모두 「화면 너비 1000 기준 px/s」다
FLOW_LONG = 1000       # 특징점 추적은 긴 변 1000으로 푼다
FLOW_EDGE = 2          # 컷 앞뒤 2장(경계 · 전환)은 뺀다
FLOW_MIN_SEC = 0.75    # 앞뒤를 뺀 컷이 이보다 짧으면 재지 않는다
FLOW_SEED = 6          # 0.25초마다 빈 자리에 새 점을 뿌린다
FLOW_FB = 0.3          # 앞뒤로 추적해 이만큼(px) 넘게 어긋난 점은 버린다
TRACK_MIN = 12         # 0.5초 넘게 이어진 점만 센다
MOVE_MIN = 2.0         # 카메라를 걷어 낸 가로 속도가 이만큼 넘으면 움직이는 점
CELL_MIN = 25          # 칸에 움직이는 점이 이만큼 있어야 칸의 방향을 낸다
AGREE = 0.85           # 칸 안 움직이는 점의 이만큼이 한 방향이어야 그 칸의 방향이다(0.8이면 서울로 R03 와이퍼 0.82가 걸린다)
SPLIT_MIN = 2.5        # ① 엇갈린 두 칸이 모두 이만큼 넘게 간다
SIDEWAYS = 0.5         # ① 엇갈린 두 칸의 점이 옆으로 간다(세로 / 가로 속도의 가운데 값이 이 아래) — 카메라 위로 지나가는 버스(서울로 라f Q04 1.4~1.8)는 뺀다
ZOOM_MAX = 2.0         # 카메라 배율이 초당 이만큼(%) 넘게 바뀌는 컷은 ①②를 재지 않는다
STEP_WIN = 3           # ② 1/8초 창
STOP_RUN = 4           # ② 1/8초 창 넷(0.5초) 넘게 멈춘 뒤 다시 간다
GO_FRAC, STOP_FRAC = 0.4, 0.15
STOP_ABS = 1.5         # ② 멈춤은 1/8초 창의 가로 속도 크기가 이 아래(px/s) — 서울로 E03k · S06k의 멈춤은 0.0~0.2
ZOOM_SPREAD = 0.01     # ② 움직이는 점의 가로 · 세로 퍼짐이 둘 다 초당 1% 넘을 때만 확대로 본다(라f E03k 0.3%는 확대가 아니다, 다가오는 버스 Q04는 15% · 54%)
ROT_MIN = 20.0         # ③ 한 열 위아래 가로 흐름이 반대로 이만큼 넘으면 도는 것
BG_MAX = 10.0          # ③ 도는 자리 밖 칸 흐름의 90번째 값이 이 아래면 배경이 안 흐른다
DENSE_LONG = 480       # ③ 조밀 흐름은 긴 변 480으로
BANDS = ("위", "가운데", "아래")
# 첫머리굳음(11-18, 점검표 26) — 값은 모두 긴 변 192 · 24fps 회색 장(컷 찾기 · 화면멈춤과 같은 장)에서 잰다
HEAD_N = 6             # 컷 경계 다음 6장(0.25초)
HEAD_RATIO = 0.3       # 첫머리 움직임이 그 컷 가운데(길이 30~70%)의 이 몫 아래면 걸림(장 차이 평균 · 0.5면 서울로 고친 판 54컷에서 15곳이 걸린다 — 시험 머리)
HEAD_MIN_SEC = 1.0     # 1초 넘는 컷만 잰다
HEAD_MID = (0.3, 0.7)
HEAD_CAM = 0.25        # 카메라 출발: 카메라 옮김(위상 상관, 장당 px)이 이 위이고 첫머리 카메라가 그 절반 아래면 걸지 않는다(서울로 Q02 0.33~0.49 · 걸린 넷 0.15 아래)
HEAD_NEXT = 18         # 카메라는 가운데와 첫머리 바로 뒤 18장(0.75초) 가운데 큰 쪽으로 본다 — 닦기 전환으로 다음 컷과 한 덩이가 되면 가운데가 다음 컷이다
HEAD_FLAT = 4.0        # 첫머리 장의 결(회색 표준편차)이 이 아래면 한 색 화면이라 재지 않는다(검은 화면 0~1 · 그림 20~70)
HEAD_NOTE = 0.5        # 이 몫 아래 컷은 걸리지 않아도 알림 「첫머리」에 적는다


def probe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
                        "-show_entries", "format=duration", "-of", "json", path], capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError(r.stderr.strip() or "ffprobe 실패")
    j = json.loads(r.stdout)
    s = j["streams"][0]
    n, d = (int(x) for x in s["r_frame_rate"].split("/"))
    return int(s["width"]), int(s["height"]), n / d, float(j["format"]["duration"])


def fit_size(w, h, long_side):
    k = long_side / max(w, h)
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def decode(path, size, gray=True):
    w, h = size
    pix = "gray" if gray else "bgr24"
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={w}:{h}",
                          "-f", "rawvideo", "-pix_fmt", pix, "-"], capture_output=True).stdout
    c = 1 if gray else 3
    n = len(raw) // (w * h * c)
    a = np.frombuffer(raw[: n * w * h * c], np.uint8)
    return a.reshape(n, h, w) if gray else a.reshape(n, h, w, 3)


def pick(path, size, idxs):
    """필요한 장만 골라 푼다 — {장 번호: 회색 그림}. 한 번 흘려 읽으며 고른다.
    11-16까지는 select='eq(n,…)+…' 식 하나로 골랐는데, 컷이 쉰 개 남짓인 편(서울로 3분)은 식이 길어 ffmpeg가 아무것도 안 내
    같은판 · 되풀이가 KeyError로 못 쟀다(현장 노트 영상 「select=eq(n…)」 항목과 같은 함정)."""
    idxs = sorted(set(int(i) for i in idxs))
    if not idxs:
        return {}
    w, h = size
    want, last, out = set(idxs), idxs[-1], {}
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={w}:{h}",
                             "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    try:
        k = 0
        while k <= last:
            raw = proc.stdout.read(w * h)
            if len(raw) < w * h:
                break
            if k in want:
                out[k] = np.frombuffer(raw, np.uint8).reshape(h, w)
            k += 1
    finally:
        proc.stdout.close()
        if proc.poll() is None:
            proc.kill()
        proc.wait()
    return out


# ── 컷 ──
def find_cuts(small, fps):
    """이웃 장 차이가 앞뒤 반 초의 가운데 값보다 크게 튀고 화면의 CUT_AREA 넘게 바뀐 장 — 새 컷의 첫 장 번호. 3장 안에 붙은 둘은 큰 쪽 하나"""
    f = small.astype(np.float32)
    dd = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    half = max(6, int(round(fps / 2)))
    hits = []
    for i in range(len(dd)):
        nb = np.concatenate([dd[max(0, i - half):i], dd[i + 1:i + 1 + half]])
        med = float(np.median(nb)) if len(nb) else 0.0
        if dd[i] > 6 and dd[i] > 4 * max(med, 0.8):
            area = float((np.abs(f[i + 1] - f[i]) > 25).mean())
            if area >= CUT_AREA:                # 화면 캡처의 글자 · 스크롤처럼 한 자리만 바뀐 것은 컷이 아니다(y한도 0.05~0.28 · 실제 컷 0.32~0.84)
                hits.append((i + 1, float(dd[i])))
    cuts = []
    for k, v in hits:
        if k < 2 or k > len(f) - 2:
            continue
        if cuts and k - cuts[-1][0] <= 3:
            if v > cuts[-1][1]:
                cuts[-1] = (k, v)
            continue
        cuts.append((k, v))
    return [k for k, _ in cuts]


# ── 같은 그림 맞춤 ──
_ORB = None


def orb():
    global _ORB
    if _ORB is None:
        _ORB = cv2.ORB_create(3000, edgeThreshold=15, patchSize=15)
    return _ORB


def features(img):
    return orb().detectAndCompute(img, None)


def relation(fa, fb, shape, min_inliers=MIN_INLIERS, strict=False):
    """두 장을 잇는 닮음 변환 가운데 「그림」으로 볼 만한 것.
    글자 판 · 표시는 컷을 넘어 같은 자리에 남아 「배율 1 · 안 옮김」 맞춤을 한두 줄(80px 칸)에 모은다 — 그런 맞춤은 걷어 내고 남은 점으로 다시 맞춘다.
    배율 · 자리가 바뀐 맞춤은 글자 판이 만들 수 없으니 두 줄에 퍼지면 그림이다(사람 자리는 화면 가운데 두세 줄에 모인다 — B39 5.5초 · 57초).
    배율 · 자리가 그대로인 맞춤은 네 줄 넘게 퍼져야 그림이다. strict(되풀이 — 멀리 떨어진 두 컷)면 늘 네 줄을 요구한다."""
    (ka, da), (kb, db) = fa, fb
    if da is None or db is None or len(ka) < 20 or len(kb) < 20:
        return None
    bf = cv2.BFMatcher(cv2.NORM_HAMMING)
    m = [x for x in bf.knnMatch(da, db, k=2) if len(x) == 2 and x[0].distance < 0.75 * x[1].distance]
    if len(m) < min_inliers:
        return None
    pa = np.float32([ka[x[0].queryIdx].pt for x in m])
    pb = np.float32([kb[x[0].trainIdx].pt for x in m])
    h, w = shape
    unit = max(h, w) / 640                      # 길이 기준(긴 변 640)
    cell_h = 80 * unit
    centre = np.float32([[w / 2, h / 2]])
    keep = np.ones(len(m), bool)
    for _ in range(4):
        if keep.sum() < min_inliers:
            return None
        M, inl = cv2.estimateAffinePartial2D(pa[keep], pb[keep], method=cv2.RANSAC, ransacReprojThreshold=3.0 * unit, maxIters=4000, confidence=0.995)
        if M is None:
            return None
        inl = inl.ravel().astype(bool)
        idx = np.where(keep)[0][inl]
        if len(idx) < min_inliers:
            return None
        rows = {}
        for _x, y in pa[idx]:
            rows[int(y // cell_h)] = rows.get(int(y // cell_h), 0) + 1
        spread = sum(1 for v in rows.values() if v >= 3)
        s = float(math.hypot(M[0, 0], M[1, 0]))
        if not 0.4 <= s <= 2.5:                 # 찌그러진 맞춤(배율 0 · 수십 배) — 그림이 아니다
            keep[idx] = False
            continue
        moved = float(np.linalg.norm(cv2.transform(centre[None], M)[0, 0] - centre[0])) / unit   # 화면 가운데가 옮겨 간 거리(긴 변 640 기준 px)
        changed = abs(s - 1) > SCALE_STEP or moved > SHIFT_PX
        if (changed and spread >= 2 and not strict) or spread >= MIN_ROWS:
            return {"맞은점": int(len(idx)), "맞춤비": round(len(idx) / len(m), 2), "배율": round(s, 3), "옮김": round(moved, 1), "줄": spread}
        keep[idx] = False                       # 글자 판 맞춤 — 걷어 내고 남은 점으로 다시
    return None


def kind_of(rel):
    if not rel:
        return None
    if abs(rel["배율"] - 1) > SCALE_STEP or rel["옮김"] > SHIFT_PX:
        return "같은판"
    return "같은구도"


# ── 화소(잘라 키운 판) ──
def detail_ratio(gray):
    """가는 결(σ1 아래) 에너지 / 중간 결(σ1~3) 에너지 — 제 화소 판은 0.25~0.31(B39 · 메일비서 실측), 720p 판을 화면에서 또 잘라 키운 컷은 0.11 안팎.
    결이 거의 없는 어두운 판은 둘 다 작아 미덥지 않으니 중간 결이 DETAIL_MIN 아래면 None. 위 20%(글자 판)는 뺀다"""
    g = gray.astype(np.float32)
    g = g[int(g.shape[0] * 0.2):]
    b1 = cv2.GaussianBlur(g, (0, 0), 1.0)
    b3 = cv2.GaussianBlur(g, (0, 0), 3.0)
    mid = float(np.mean((b1 - b3) ** 2))
    if mid < DETAIL_MIN:
        return None
    return round(float(np.mean((g - b1) ** 2)) / mid, 3)


# ── 사람 움직임(사람움직임.py를 빌려 컷마다) ──
_MOTION = None


def motion_mod():
    global _MOTION
    if _MOTION is None:
        spec = importlib.util.spec_from_file_location("사람움직임", MOTION_PY)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _MOTION = mod
    return _MOTION


def _summarise(mod, a, b, fps, ps):
    s = mod.summary(ps)
    if not s:
        return None
    row = {"시작": round(a / fps, 2), "끝": round(b / fps, 2), "사람": s["사람"], "카메라": s["카메라"], "판정": s["판정"],
           "사람장": s["얼굴 장"] + s["실루엣 장"], "장": s["장"]}
    wins = []
    if (b - a) / fps >= WIN_LONG:
        n = int(round(WIN * fps))
        st = int(round(WIN_STEP * fps))
        for w0 in range(0, max(1, len(ps) - n + 1), st):
            part = ps[w0:w0 + n]
            ws = mod.summary(part)
            ppl = sum(1 for x in part if x[2] in ("얼굴", "실루엣"))
            if ws and ws["사람"] < FROZEN and ppl > len(part) / 2:
                wins.append(round((a + 2 + w0) / fps, 2))
    row["멎은창"] = wins
    return row


def measure_motion(path, fps, segs):
    """사람움직임.py와 같은 480×270 bgr 장을 한 번만 풀어(24fps) 컷마다 이웃 장 흐름을 잰다 — 컷 앞뒤 2장은 빼고, 긴 컷은 CHUNK장씩
    (끊는 자리의 장은 다음 덩이의 첫 장으로 다시 써서 이웃 쌍을 잃지 않는다)"""
    mod = motion_mod()
    W, H = mod.W, mod.H
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", f"fps={FPS:g},scale={W}:{H}",
                             "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = W * H * 3
    out, i = [], 0

    def pairs_of(buf):
        fr = np.array(buf)
        mod.frames = lambda *_args, _fr=fr: _fr          # pairs()가 이 덩이의 장만 보게
        return mod.pairs(None)

    try:
        for a, b in segs:
            ps, buf = [], []
            while i < b:
                raw = proc.stdout.read(size)
                if len(raw) < size:
                    break
                if a + 2 <= i < b - 2:
                    buf.append(np.frombuffer(raw, np.uint8).reshape(H, W, 3))
                    if len(buf) >= CHUNK:
                        ps += pairs_of(buf)
                        buf = [buf[-1]]
                i += 1
            if len(buf) >= 2:
                ps += pairs_of(buf)
            if (b - a) / fps < MIN_CUT or len(ps) < 5:
                continue
            row = _summarise(mod, a, b, fps, ps)
            if row:
                out.append(row)
    finally:
        proc.stdout.close()
        proc.wait()
    return out


# ── 소리 ──
def audio_rms(path, dur=None, rate=16000):
    """0.25초 칸마다 dBFS. 소리 줄기가 영상보다 짧으면 모자란 칸을 무음(−90dB)으로 채운다 — 소리가 먼저 끝난 끝도 「조용한 끝」이다(Fable 검수 5)"""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    if not len(x):
        return None
    hop = rate // 4
    n = len(x) // hop
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    want = int(dur * 4) if dur else 0
    if want > len(db):
        db = np.concatenate([db, np.full(want - len(db), -90.0)])
    return db


# ── 흐름(컷 안 탈것 · 배경 움직임) ──
_LK = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))


class FlowCut:
    """한 컷의 장을 차례로 받아 특징점 추적(①②)과 조밀 흐름(③)을 함께 쌓는다."""

    def __init__(self, W, H):
        self.W, self.H, self.k = W, H, 1000.0 / W            # k: 화면 너비 1000 기준으로 바꾸는 배율
        s = DENSE_LONG / max(W, H)
        self.dw, self.dh = max(16, int(W * s) // 2 * 2), max(16, int(H * s) // 2 * 2)
        self.gx, self.gy = (8, 4) if W >= H else (4, 8)
        self.prev = self.prev_small = self.pts = self.ids = None
        self.nid, self.n, self.scales = 0, 0, []
        self.tracks = {}       # id → [첫 x, 첫 y, 걸음 수, 가로 합, 세로 합]
        self.steps = []        # 걸음마다 {id: 카메라를 걷어 낸 가로 이동}
        self.dense = []        # 조밀 흐름 칸 값(가로, 세로) — 두 장에 한 번

    def add(self, g):
        if self.prev is not None and self.pts is not None and len(self.pts):
            self._track(g)
        small = cv2.resize(g, (self.dw, self.dh), interpolation=cv2.INTER_AREA)
        if self.prev_small is not None and self.n % 2 == 1:
            f = cv2.calcOpticalFlowFarneback(self.prev_small, small, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            cells = np.zeros((self.gy, self.gx, 2), np.float32)
            for r in range(self.gy):
                for c in range(self.gx):
                    cells[r, c] = np.median(f[r * self.dh // self.gy:(r + 1) * self.dh // self.gy,
                                              c * self.dw // self.gx:(c + 1) * self.dw // self.gx].reshape(-1, 2), axis=0)
            self.dense.append(cells)
        if self.n % FLOW_SEED == 0:
            self._seed(g)
        self.prev, self.prev_small = g, small
        self.n += 1

    def _seed(self, g):
        mask = np.full(g.shape, 255, np.uint8)
        if self.pts is not None:
            for x, y in self.pts.reshape(-1, 2):
                cv2.circle(mask, (int(x), int(y)), 8, 0, -1)
        new = cv2.goodFeaturesToTrack(g, 800, 0.005, 8, mask=mask)
        if new is None:
            return
        ids = np.arange(self.nid, self.nid + len(new))
        self.nid += len(new)
        if self.pts is None or not len(self.pts):
            self.pts, self.ids = new, ids
        else:
            self.pts, self.ids = np.concatenate([self.pts, new]), np.concatenate([self.ids, ids])

    def _track(self, g):
        q, st, _ = cv2.calcOpticalFlowPyrLK(self.prev, g, self.pts, None, **_LK)
        back, st2, _ = cv2.calcOpticalFlowPyrLK(g, self.prev, q, None, **_LK)
        fb = np.linalg.norm((back - self.pts).reshape(-1, 2), axis=1)
        ok = (st.ravel() == 1) & (st2.ravel() == 1) & (fb < FLOW_FB)
        P, Q = self.pts.reshape(-1, 2)[ok], q.reshape(-1, 2)[ok]
        ids = self.ids[ok]
        self.pts, self.ids = q[ok], ids
        step = {}
        if len(P) >= 8:
            M, _ = cv2.estimateAffinePartial2D(P, Q, method=cv2.RANSAC, ransacReprojThreshold=0.5, maxIters=2000)
            if M is not None:
                self.scales.append(float(math.hypot(M[0, 0], M[1, 0])))
                R = (Q - P) - (P @ M[:, :2].T + M[:, 2] - P)
                for i, p, r in zip(ids, P, R):
                    t = self.tracks.setdefault(int(i), [float(p[0]), float(p[1]), 0, 0.0, 0.0])
                    t[2] += 1
                    t[3] += float(r[0])
                    t[4] += float(r[1])
                    step[int(i)] = float(r[0])
        self.steps.append(step)

    # ── 판정 ──
    def zoom_rate(self):
        """카메라 배율이 초당 몇 % 바뀌나(앞으로 가는 카메라 · 확대)"""
        if not self.scales:
            return 0.0
        return (float(np.exp(np.mean(np.log(np.clip(self.scales, 0.5, 2.0))) * FPS)) - 1) * 100

    def _moving(self):
        """0.5초 넘게 이어진 점 → (x, y, 가로 속도, 세로 속도) — px/s(화면 너비 1000 기준)"""
        rows = [(t[0], t[1], t[3] / t[2] * FPS * self.k, t[4] / t[2] * FPS * self.k, i) for i, t in self.tracks.items() if t[2] >= TRACK_MIN]
        return [r for r in rows if math.hypot(r[2], r[3]) >= MOVE_MIN]

    def _cells(self, mv):
        """칸(띠, 쪽) → (가운데 가로 속도, 한 방향 몫, 점 수, 그 방향 점 id들) — 방향이 서는 칸만"""
        out = {}
        for b in range(3):
            for side in range(2):
                m = [r for r in mv if min(2, int(r[1] / self.H * 3)) == b and (r[0] >= self.W / 2) == bool(side) and abs(r[2]) >= MOVE_MIN]
                if len(m) < CELL_MIN:
                    continue
                med = float(np.median([r[2] for r in m]))
                agree = float(np.mean([np.sign(r[2]) == np.sign(med) for r in m]))
                if agree >= AGREE:
                    side_ratio = float(np.median([abs(r[3]) / abs(r[2]) for r in m]))     # 세로 / 가로 — 옆으로 가는 탈것은 작다
                    out[(b, side)] = (med, agree, len(m), {r[4] for r in m if np.sign(r[2]) == np.sign(med)}, side_ratio)
        return out

    def _zoomlike(self, mv, floor=0.0):
        """움직이는 점이 가로 · 세로로 함께 퍼지거나 모이나(다가오는 · 멀어지는 것 — 확대처럼 보이는 것). floor: 두 퍼짐이 모두 넘어야 할 초당 몫"""
        if len(mv) < 10:
            return False
        a = np.array(mv)
        sx = np.polyfit(a[:, 0] - self.W / 2, a[:, 2], 1)[0]
        sy = np.polyfit(a[:, 1] - self.H / 2, a[:, 3], 1)[0]
        return bool(sx * sy > 0 and abs(sy) >= 0.5 * abs(sx) and min(abs(sx), abs(sy)) >= floor)

    def judge(self, t0, t1):
        hits, zoom = [], self.zoom_rate()
        mv = self._moving()
        cells = self._cells(mv)
        zoomlike = self._zoomlike(mv)
        note = {"항목": "흐름", "초": t0, "끝초": t1, "카메라배율": round(zoom, 2), "움직이는점": len(mv),
                "칸": {f"{BANDS[b]}{'왼오'[s]}": round(v[0], 1) for (b, s), v in sorted(cells.items())}}
        if abs(zoom) < ZOOM_MAX:
            갈림 = []
            for b in range(3 if not zoomlike else 0):
                L, R = cells.get((b, 0)), cells.get((b, 1))
                if (L and R and np.sign(L[0]) != np.sign(R[0]) and min(abs(L[0]), abs(R[0])) >= SPLIT_MIN
                        and max(L[4], R[4]) <= SIDEWAYS):
                    갈림.append((b, L, R))
            if 갈림:   # 한 컷에 한 줄 — 가장 세게 엇갈린 띠를 글에, 나머지 띠는 값에
                b, L, R = max(갈림, key=lambda x: min(abs(x[1][0]), abs(x[2][0])))
                hits.append({"항목": "흐름갈림", "초": t0, "끝초": t1,
                             "값": {"띠": BANDS[b], "왼": round(L[0], 1), "오른": round(R[0], 1), "점": [L[2], R[2]], "한방향": [round(L[1], 2), round(R[1], 2)],
                                   "띠들": [BANDS[x[0]] for x in 갈림]},
                             "글": f"{t0}~{t1}초 컷의 {BANDS[b]} 띠에서 왼쪽은 {L[0]:+.1f}, 오른쪽은 {R[0]:+.1f}로 가로 방향이 엇갈린다"
                                   f"(카메라를 걷어 낸 움직이는 점의 가운데 값, 화면 너비 1000 기준 px/s) — 같은 길의 탈것이 서로 반대로 가거나 뒤로 밀리는지 본다"})
            멈춤 = [] if self._zoomlike(mv, ZOOM_SPREAD) else [((b, s), r) for (b, s), v in sorted(cells.items()) for r in [self._stop_go(v)] if r]
            if 멈춤:   # 한 컷에 한 줄 — 가장 오래 멈춘 칸을 글에
                (b, s), (a_, b_, ser) = max(멈춤, key=lambda x: x[1][1] - x[1][0])
                hits.append({"항목": "멈췄다감", "초": round(t0 + a_, 2), "끝초": round(t0 + b_, 2),
                             "값": {"컷": [t0, t1], "칸": f"{BANDS[b]}{'왼오'[s]}", "칸들": [f"{BANDS[x[0][0]]}{'왼오'[x[0][1]]}" for x in 멈춤], "속도": ser},
                             "글": f"{t0}~{t1}초 컷의 {BANDS[b]} {('왼쪽', '오른쪽')[s]} 칸에서 가던 것이 {t0 + a_:.2f}~{t0 + b_:.2f}초 동안 멈췄다가 다시 간다"
                                   f"(1/8초마다 가로 속도 px/s: {' '.join(f'{x:+.0f}' for x in ser if x is not None)}) — 탈것이 뚝 섰다가 튀어 나가는지, 사람이 잠깐 굳는지 본다"})
        r = self._spin()
        if r:
            hits.append({"항목": "제자리바퀴", "초": t0, "끝초": t1, "값": r,
                         "글": f"{t0}~{t1}초 컷에 도는 것(바퀴)이 있는데 나머지 화면이 거의 안 흐른다(흐름 90번째 값 {r['바탕90']}px/s, 문턱 {BG_MAX:g}) — "
                               f"바퀴만 돌고 탈것도 배경도 제자리인지 본다"})
        return hits, note

    def _stop_go(self, cell):
        """가다가 0.5초 넘게 멈춘 뒤 다시 가는 자리 → (멈춘 시작초, 끝초, 1/8초 속도 줄) — 컷 첫 장 기준 초"""
        med, _, _, group, _ = cell
        sign = 1.0 if med > 0 else -1.0
        ser = []
        for s0 in range(0, len(self.steps) - STEP_WIN + 1, STEP_WIN):
            win = self.steps[s0:s0 + STEP_WIN]
            common = [i for i in group if all(i in st for st in win)]
            ser.append(float(np.median([sum(st[i] for st in win) for i in common])) * FPS / STEP_WIN * self.k if len(common) >= 8 else None)
        vals = [x * sign for x in ser if x is not None]
        if len(vals) < 6:
            return None
        ref = float(np.percentile(vals, 80))
        if ref < 2 * MOVE_MIN:
            return None
        go = [x is not None and x * sign >= max(MOVE_MIN, GO_FRAC * ref) for x in ser]
        # 거의 서 있음 — 뒤로 가는 창은 멈춤이 아니다(서울로 S04y 차단벽을 밀며 몸을 앞뒤로 흔듦). 느려진 것도 멈춤이 아니다(지금 판 E04m 실이 풀리며 초당 0.6~3.5)
        stop = [x is not None and abs(x) < min(max(1.0, STOP_FRAC * ref), STOP_ABS) for x in ser]

        def 이어감(g):
            """창 둘 넘게 잇달아 가나 — 탈것이 화면 밖으로 나간 뒤 남은 점 몇 개가 한 창씩 튀는 값(서울로 Y15w 125 · 60)을 「감」으로 치지 않는다"""
            return any(g[k] and g[k + 1] for k in range(len(g) - 1))

        i = 0
        while i < len(ser):
            if not stop[i]:
                i += 1
                continue
            j = i
            while j < len(ser) and stop[j]:
                j += 1
            if j - i >= STOP_RUN and 이어감(go[:i]) and 이어감(go[j:]):   # 걸음 k = 컷 첫 장에서 FLOW_EDGE + k번째 장 → 다음 장
                return round((FLOW_EDGE + i * STEP_WIN) / FPS, 2), round((FLOW_EDGE + j * STEP_WIN) / FPS, 2), [None if x is None else round(x, 1) for x in ser]
            i = j
        return None

    def _spin(self):
        """도는 것(한 열 위아래 가로 흐름 반대 + 한 줄 좌우 세로 흐름 반대)이 있는데 그 밖 칸이 거의 안 흐르면 값을 낸다"""
        if len(self.dense) < 3:
            return None
        m = np.mean(self.dense, axis=0) * FPS * (1000.0 / self.dw)      # px/s(화면 너비 1000 기준)
        dx, dy = m[..., 0], m[..., 1]
        cols = {c for c in range(self.gx) for r1 in range(self.gy) for r2 in range(r1 + 1, self.gy)
                if dx[r1, c] * dx[r2, c] < 0 and min(abs(dx[r1, c]), abs(dx[r2, c])) >= ROT_MIN}
        if not cols:
            return None
        c0, c1 = max(0, min(cols) - 1), min(self.gx, max(cols) + 2)
        flip = any(dy[r, a] * dy[r, b] < 0 and min(abs(dy[r, a]), abs(dy[r, b])) >= ROT_MIN / 2
                   for r in range(self.gy) for a in range(c0, c1) for b in range(a + 1, c1))
        rest = np.ones((self.gy, self.gx), bool)
        rest[:, c0:c1] = False
        if not flip or not rest.any():
            return None
        bg = np.hypot(dx[rest], dy[rest])
        bg90 = float(np.percentile(bg, 90))
        if bg90 >= BG_MAX:
            return None
        return {"도는열": [min(cols), max(cols)], "바탕90": round(bg90, 1), "바탕가운데": round(float(np.median(bg)), 1),
                "도는칸가로": [round(float(x), 0) for x in dx[:, min(cols)]]}


def measure_flow(path, segs, w, h, pre=None):
    """컷마다 FlowCut — 긴 변 1000 회색 장을 한 번만 풀어(24fps) 컷 앞뒤 2장을 빼고 잰다 → (걸림, 알림).
    segs는 차례대로 겹치지 않는 (첫 장, 끝 장) 줄이다. 받은 뒤 검사(tools/받은뒤검사.py)는 판의 쓰는 구간만 준다(11-16).
    pre는 풀기 앞에 거는 ffmpeg 거르개다(받은 뒤 검사가 편집 창으로 자르는 crop) — 그때 w · h는 자른 크기다. 재는 법은 같다.
    풀기는 마지막 덩이의 끝 장에서 멈춘다 — 판 뒤의 버리는 구간까지 풀다가 읽기를 끊으면 ffmpeg가 「Broken pipe」를 쏟는다."""
    W, H = fit_size(w, h, FLOW_LONG)
    last = max((b for _a, b in segs), default=0)
    proc = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-an", "-vf", (f"{pre}," if pre else "") + f"fps={FPS:g},scale={W}:{H}",
                             "-frames:v", str(max(1, last)), "-f", "rawvideo", "-pix_fmt", "gray", "-"], stdout=subprocess.PIPE)
    size = W * H
    hits, notes, i = [], [], 0
    try:
        for a, b in segs:
            lo, hi = a + FLOW_EDGE, b - FLOW_EDGE
            fc = FlowCut(W, H) if (hi - lo) / FPS >= FLOW_MIN_SEC else None
            while i < b:
                raw = proc.stdout.read(size)
                if len(raw) < size:
                    break
                if fc is not None and lo <= i < hi:
                    fc.add(np.frombuffer(raw, np.uint8).reshape(H, W))
                i += 1
            if fc is not None and fc.n >= 4:
                hs, note = fc.judge(round(a / FPS, 2), round(b / FPS, 2))
                hits += hs
                notes.append(note)
    finally:
        proc.stdout.close()
        proc.wait()
    return hits, notes


def quiet_runs(db):
    """조용구간 — 0.25초 칸 dB 줄 → (큰 소리 기준 dB, [(시작 칸, 끝 칸, 그 자리 평균 dB)] 긴 순). 앞 0.5초와 끝 3초(끝소리가 본다)는 뺀다.
    1초 창(칸 넷의 평균 전력)으로 다듬어 말 사이 짧은 숨 · 한 번 튄 효과음에 자리가 끊기지 않게 한다. 몸통이 QUIET_SEC보다 짧으면 (None, [])"""
    a, b = 2, len(db) - int(END_SEC * 4)
    if b - a < QUIET_SEC * 4:
        return None, []
    ref = float(np.percentile(db[a:b], QUIET_REF_PCT))
    pw = 10 ** (np.asarray(db, np.float64) / 10)
    runs, s = [], -1
    for i in range(a, b + 1):
        lo = max(0, i - 2)
        q = i < b and 10 * math.log10(float(pw[lo:lo + 4].mean()) + 1e-12) < ref - QUIET_DB
        if q and s < 0:
            s = i
        elif not q and s >= 0:
            runs.append((s, i, round(10 * math.log10(float(pw[s:i].mean()) + 1e-12), 1)))
            s = -1
    return round(ref, 1), sorted(runs, key=lambda r: r[0] - r[1])


def frame_diffs(small):
    """이웃 장 평균 절대 차이 — dd[i] = |장 i+1 − 장 i|의 평균(회색 0~255). 장마다 따로 빼서 큰 float 사본을 만들지 않는다"""
    return np.array([float(np.abs(small[i + 1].astype(np.int16) - small[i]).mean()) for i in range(len(small) - 1)], np.float32)


def frozen_runs(dd, fps, th=FROZEN_DIFF):
    """화면멈춤 — 이웃 장 차이 줄 → [(시작초, 끝초, 끝 화면인가)] 긴 순. dd[s..i−1]이 문턱 아래면 장 s..i가 같은 그림이라
    s/fps부터 (i+1)/fps까지 화면에 머문다. 끝 화면은 영상 끝에서 FROZEN_END 안에 끝나는 멈춤이다"""
    total = (len(dd) + 1) / fps
    out, s = [], -1
    for i in range(len(dd) + 1):
        q = i < len(dd) and dd[i] < th
        if q and s < 0:
            s = i
        elif not q and s >= 0:
            a, b = s / fps, (i + 1) / fps
            out.append((round(a, 2), round(b, 2), total - b < FROZEN_END))
            s = -1
    return sorted(out, key=lambda r: r[0] - r[1])


def merged_segs(cuts, extra, n):
    """장 차이로 찾은 경계(cuts)에 컷표 경계(extra, 장 번호)를 합친 (첫 장, 끝 장) 줄 — 3장 안은 하나로(찾은 경계가 이긴다).
    컷표가 낡았어도 한 컷이 둘로 나뉠 뿐이다. 흐름 · 첫머리가 함께 쓴다"""
    bs = sorted(set(cuts))
    for e in sorted(set(extra)):
        if 2 <= e <= n - 2 and all(abs(e - c) > 3 for c in bs):
            bs.append(e)
    bs = [0] + sorted(bs) + [n]
    return [(bs[k], bs[k + 1]) for k in range(len(bs) - 1)]


def small_camera(small):
    """긴 변 192 장의 카메라 옮김 — 장 i → i+1의 위상 상관 옮김 크기(장당 px). 부른 쌍만 재고 기억한다(첫머리굳음은 걸릴 만한 컷만 묻는다)"""
    memo, win = {}, []

    def shift(i):
        if i not in memo:
            if not win:
                win.append(cv2.createHanningWindow((small.shape[2], small.shape[1]), cv2.CV_32F))
            (dx, dy), _r = cv2.phaseCorrelate(small[i].astype(np.float32), small[i + 1].astype(np.float32), win[0])
            memo[i] = math.hypot(dx, dy)
        return memo[i]
    return shift


def head_freeze(dd, segs, fps, shift, texture=None, th=HEAD_RATIO):
    """첫머리굳음 — 컷마다 경계 다음 HEAD_N장의 움직임 평균을 그 컷 가운데(길이 30~70%)의 평균에 견준다 → [잰 줄](비 낮은 순).
    잰 줄: {"a", "b", "비", "첫머리", "가운데", "카메라": [첫머리, 뒤] 또는 None, "걸림": bool}. shift(i)는 장 i → i+1의 카메라 옮김(장당 px),
    texture(i)는 장 i의 결(회색 표준편차)이다 — 시험은 고정 자료의 값을 넣는다.
    장 움직임은 이웃 장 차이 dd에서 두 장 안의 큰 값(max(dd[i], dd[i+1]))이다 — 한 그림을 두 장씩 쓰는 판(초당 12장, 서울로 H1 · E08 · 고친 R06k)은
    장 차이가 0과 값을 번갈아 내 평균이 반으로 꺼진다. 비가 th 아래인 컷만 카메라를 재서, 카메라가 서 있다가 출발하는 컷은 걸지 않는다 —
    가운데나 첫머리 바로 뒤 HEAD_NEXT장 가운데 큰 쪽의 카메라(가운데 값)가 HEAD_CAM 위이고 첫머리 카메라가 그 절반 아래(서울로 Q02 난간 접사).
    재지 않는 컷: 영상 맨 앞 덩이(0초 — 경계가 아니다. SNS 최종본 두 편의 첫 장면 사진 · 손가락이 거기서 걸렸다), 첫머리가 결 없는 한 색인 컷
    (검은 화면에서 밝아지는 첫머리 — 포트폴리오 p6 · rs), 장이 모자라거나 가운데가 아예 서 있는 컷"""
    s = np.maximum(dd[:-1], dd[1:]) if len(dd) > 1 else np.zeros(0, np.float32)
    out = []
    for a, b in segs:
        L = b - a
        if a == 0 or L / fps <= HEAD_MIN_SEC:
            continue
        lo, hi = a + int(L * HEAD_MID[0]), a + int(math.ceil(L * HEAD_MID[1])) - 1
        if a + HEAD_N > len(s) or hi > len(s) or hi - lo < 2:
            continue
        hm, mm = float(s[a:a + HEAD_N].mean()), float(s[lo:hi].mean())
        if mm <= 0 or (texture is not None and float(np.mean([texture(i) for i in range(a, a + HEAD_N)])) < HEAD_FLAT):
            continue
        r = hm / mm
        row = {"a": a, "b": b, "비": round(r, 2), "첫머리": round(hm, 2), "가운데": round(mm, 2), "카메라": None, "걸림": False}
        if r < th:
            ch = float(np.mean([shift(i) for i in range(a, a + HEAD_N)]))
            nx = range(a + HEAD_N, min(a + HEAD_N + HEAD_NEXT, b - 1))
            cm = max(float(np.median([shift(i) for i in range(lo, hi)])), float(np.median([shift(i) for i in nx])) if len(nx) >= 4 else 0.0)
            row["카메라"] = [round(ch, 2), round(cm, 2)]
            row["걸림"] = not (cm >= HEAD_CAM and ch < cm / 2)
        out.append(row)
    return sorted(out, key=lambda x: x["비"])


def speech_runs(probs, hop=0.032, th=SPEECH_TH, join=SPEECH_JOIN, min_speech=0.1):
    """말 확률 줄(칸 hop초) → 말 구간 [(시작초, 끝초)] 시간 순. 확률이 th 위면 들어가고 th−0.15 아래로 내려가면 나온다.
    join초보다 짧은 쉼은 한 말로 잇고, min_speech초보다 짧은 조각은 버린다"""
    out_th = th - 0.15
    runs, on, s = [], False, 0
    for i, p in enumerate(probs):
        if not on and p >= th:
            on, s = True, i
        elif on and p < out_th:
            runs.append([s * hop, i * hop])
            on = False
    if on:
        runs.append([s * hop, len(probs) * hop])
    merged = []
    for a, b in runs:
        if merged and a - merged[-1][1] < join:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(round(a, 2), round(b, 2)) for a, b in merged if b - a >= min_speech]


def _power_db(db, a, b):
    """0.25초 칸 dB 줄에서 a~b초 칸들의 전력 평균 dB(칸이 없으면 None)"""
    seg = np.asarray(db[max(0, int(math.floor(a * 4))): max(int(math.floor(a * 4)) + 1, int(math.ceil(b * 4)))], np.float64)
    return round(10 * math.log10(float(np.mean(10 ** (seg / 10))) + 1e-12), 1) if len(seg) else None


def speech_table(runs, db, dur, gap=SPEECH_GAP):
    """말 구간 · 0.25초 칸 dB → {말dB, 말없는자리, 첫말초, 꼬리}. 말dB는 말 구간 길이로 무게를 준 전력 평균이고, 「말보다」는 그 자리가
    말보다 몇 dB 작은가다. 말 없는 자리는 gap초 넘는 말 사이(시간 순), 꼬리는 마지막 말 끝부터 영상 끝까지다. 말이 없으면 None"""
    lv_of = [(b - a, _power_db(db, a, b)) for a, b in runs]
    lv_of = [(w_, v) for w_, v in lv_of if v is not None and w_ > 0]
    if not runs or not lv_of:
        return None
    w = np.array([w_ for w_, _ in lv_of], np.float64)
    lv = np.array([v for _, v in lv_of], np.float64)
    speech = round(10 * math.log10(float(np.sum(w * 10 ** (lv / 10)) / w.sum()) + 1e-12), 1)

    def row(a, b):
        d = _power_db(db, a, b) if b - a >= 0.25 else None
        return {"초": round(a, 2), "끝초": round(b, 2), "길이초": round(b - a, 2), "dB": d, "말보다": round(speech - d, 1) if d is not None else None}

    gaps = [row(runs[i][1], runs[i + 1][0]) for i in range(len(runs) - 1) if runs[i + 1][0] - runs[i][1] > gap]
    return {"말dB": speech, "말없는자리": gaps, "첫말초": runs[0][0], "꼬리": row(runs[-1][1], max(dur, runs[-1][1]))}


def line_db(x, a, b, sr=16000):
    """16kHz 소리의 a~b초 전력 평균 dB(표본이 모자라면 None)"""
    seg = np.asarray(x[int(a * sr): int(b * sr)], np.float64)
    return round(10 * math.log10(float(np.mean(seg * seg)) + 1e-12), 1) if len(seg) >= 16 else None


def quiet_lines(rows, th=LINE_QUIET_DB, span=None):
    """받아쓰기 줄 [{초, 끝초, dB, …}] → (줄 크기 가운데 dB, 그보다 th dB 넘게 작은 줄 — 「가운데보다」를 붙여 작은 순).
    LINE_MIN_SEC보다 짧은 줄과 dB가 없는 줄은 빼고, span(VAD 첫 말초, 마지막 말 끝초)이 있으면 그 0.5초 밖 줄도 뺀다 — 받아쓰기는 말 없는
    끝 · 음악에서 「감사합니다」 같은 줄을 지어낸다(없는판결 60.0~62.0초). 남은 줄이 셋보다 적으면 (None, [])다(대사 한 줄만 작음 — 흠 장부 「소리」 · 11-16).
    받아쓰기가 있어야 잰다: VAD는 이 사이로 하는 작은 말을 놓친다(머리말 「말」). 부르는 쪽은 줄 끝을 소리 길이로 잘라 dB를 잰다"""
    lo, hi = (span[0] - 0.5, span[1] + 0.5) if span else (-math.inf, math.inf)
    use = [r for r in rows if r.get("dB") is not None and r["끝초"] - r["초"] >= LINE_MIN_SEC and r["끝초"] >= lo and r["초"] <= hi]
    if len(use) < 3:
        return None, []
    med = round(float(np.median([r["dB"] for r in use])), 1)
    low = [{**r, "가운데보다": round(med - r["dB"], 1)} for r in use if med - r["dB"] > th]
    return med, sorted(low, key=lambda r: r["dB"])


def speech_text(n):
    """알림 「말」 → 사람이 읽는 줄(--json 없이 부를 때 — 만드는 세션이 「--항목 말」로 표를 본다). 「말」을 재지 않았으면 빈 목록"""
    if not n:
        return []
    if n.get("못잼"):
        return [f"[말 · 못 잼] {n['못잼']}"]
    if n.get("말dB") is None:
        return ["[말] 말이 잡히지 않았다(말 없는 영상이거나 음악 · 노래만)"]
    out = [f"[말] 말 크기 {n['말dB']}dB · 첫 말 {n['첫말초']}초 · 말 없는 자리(1초 넘음) {len(n['말없는자리'])}곳"]
    for g in n["말없는자리"]:
        lv = f" · 말보다 {g['말보다']}dB 작음" if g.get("말보다") is not None else ""
        out.append(f"[말 없는 자리] {g['초']}~{g['끝초']}초 {g['길이초']}초{lv}")
    c = n.get("꼬리")
    if c:
        lv = f" · 말보다 {c['말보다']}dB 작음" if c.get("말보다") is not None else ""
        out.append(f"[마지막 말 뒤 꼬리] {c['초']}~{c['끝초']}초 {c['길이초']}초{lv}")
    return out


def vad_probs(path):
    """영상 소리 → (32ms 칸마다 말 확률, None). silero VAD v6(faster-whisper에 든 모델 · onnxruntime)이다.
    패키지 · 모델이 없거나 실패하면 (None, 까닭) — 부르는 쪽은 그 항목만 건너뛴다(끝 코드와 다른 항목은 그대로)"""
    if os.environ.get("SYNK_말시각") == "끔":
        return None, "SYNK_말시각=끔"
    try:
        from faster_whisper.vad import get_vad_model
    except Exception as e:  # noqa: BLE001 — 패키지가 없는 PC · CI
        return None, f"faster-whisper VAD를 못 불렀다({type(e).__name__}: {e})"[:200]
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32)
    if len(x) < 512:
        return None, "소리 줄기 없음"
    try:
        return np.asarray(get_vad_model()(np.pad(x, (0, 512 - len(x) % 512))), np.float32).ravel(), None
    except Exception as e:  # noqa: BLE001
        return None, f"VAD 실패({type(e).__name__}: {e})"[:200]


def main(argv=None):
    ap = argparse.ArgumentParser(description="최종본 검사 — 굳음 · 같은 판 · 되풀이 · 끝 · 화소 · 조용 · 멈춤 (+ 흐름: 관문이 붙여 부른다)")
    ap.add_argument("mp4")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--항목", default=DEFAULT_ITEMS)
    ap.add_argument("--컷초", default="", help="흐름 · 첫머리가 쓴다: 컷이 바뀌는 초(쉼표) — 천 닦기 같은 전환은 장 차이로 못 찾아 컷표 경계를 더한다")
    o = ap.parse_args(argv)
    want = set(o.항목.split(","))
    if "기본" in want:     # 「기본,말」 — 기본 항목에 더해 부른다(최종 확인 묶음)
        want |= set(DEFAULT_ITEMS.split(","))
    try:
        w, h, src_fps, dur = probe(o.mp4)
    except Exception as e:  # noqa: BLE001 — 끝 코드 2로 알린다
        print(json.dumps({"파일": o.mp4, "오류": str(e)}, ensure_ascii=False) if o.json else f"잴 수 없음: {e}")
        return 2
    small = decode(o.mp4, fit_size(w, h, 192))
    if len(small) < 4:
        print(json.dumps({"파일": o.mp4, "오류": "장이 모자람"}, ensure_ascii=False) if o.json else "잴 수 없음: 장이 모자람")
        return 2
    n = len(small)
    fps = FPS
    cuts = find_cuts(small, fps)
    bounds = [0] + cuts + [n]
    segs = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]

    def msegs():
        """흐름 · 첫머리는 컷표 경계(--컷초)를 더한 덩이로 잰다 — 천 닦기 같은 전환은 장 차이로 못 찾는다. 항목 안에서 불러 --컷초가 틀려도 그 항목만 못잼이다"""
        return merged_segs(cuts, [int(round(float(x) * fps)) for x in o.컷초.split(",") if x.strip()], n)
    t = lambda k: round(k / fps, 2)  # noqa: E731
    hits, notes, failed = [], [], []

    def guard(name, fn):
        """항목 하나가 죽어도 앞서 잰 것은 낸다 — 못 잰 항목은 「못잼」에(Fable 검수 2)"""
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            failed.append({"항목": name, "오류": f"{type(e).__name__}: {e}"[:300]})

    need = set()
    if "같은판" in want:
        for c in cuts:
            need.update((c - 1, c))
    if "되풀이" in want:
        need.update((a + b) // 2 for a, b in segs)
    size = fit_size(w, h, 640)
    shape = (size[1], size[0])
    mid = None
    try:
        mid = pick(o.mp4, size, need) if need else None
    except Exception as e:  # noqa: BLE001
        failed.append({"항목": "같은판 · 되풀이", "오류": f"{type(e).__name__}: {e}"[:300]})

    def _same():
        if "같은판" in want and mid is not None:
            for c in cuts:
                rel = relation(features(mid[c - 1]), features(mid[c]), shape)
                k = kind_of(rel)
                if k:
                    hits.append({"항목": k, "초": t(c), "값": rel,
                                 "글": (f"{t(c)}초 컷 경계가 앞 컷과 같은 그림이다 — 배율 {rel['배율']} · {rel['옮김']}px 옮김(같은 판을 잘라 키워 이어 붙임, 점검표 50)"
                                        if k == "같은판" else f"{t(c)}초 컷 경계의 앞뒤가 배율 · 자리까지 같은 그림이다(점프 컷, 점검표 50)")})

    guard("같은판", _same)

    def _repeat():
        if "되풀이" in want and mid is not None:
            reps = [(a, b, features(mid[(a + b) // 2])) for a, b in segs if (b - a) / fps >= 0.5]
            group_of = {}                              # 컷 번호 → 무리(가장 이른 컷) — 이은 이은 것으로 번지지 않게 각 컷은 가장 이른 짝의 무리에만 든다
            for j in range(len(reps)):
                for i in range(j):
                    if reps[j][0] <= reps[i][1]:       # 이웃 컷은 같은판이 본다
                        continue
                    if relation(reps[i][2], reps[j][2], shape, REPEAT_INLIERS, strict=True):
                        group_of[j] = group_of.get(i, i)
                        group_of.setdefault(i, i)
                        break
            groups = {}
            for j, g in sorted(group_of.items()):
                groups.setdefault(g, []).append(j)
            for g in groups.values():                  # 같은 그림 무리마다 한 줄(B39 v10 법정 전경 0 · 2.9 · 18.4 · 34초가 네 줄로 흩어지지 않게)
                if len(g) < 2:
                    continue
                times = [t(reps[i][0]) for i in g]
                hits.append({"항목": "되풀이", "초": times[1], "앞초": times[0], "값": {"컷": times},
                             "글": f"같은 그림의 컷이 {len(times)}번 나온다 — {' · '.join(f'{x}초' for x in times)}(같은 장면 반복, 점검표 50)"})

    guard("되풀이", _repeat)

    def _detail():
        if "화소" in want:
            full = pick(o.mp4, (w, h), [(a + b) // 2 for a, b in segs if (b - a) / fps >= 0.5])
            end_from = n - int(round(END_SEC * fps))
            for a, b in segs:
                k = (a + b) // 2
                if k not in full:
                    continue
                r = detail_ratio(full[k])
                if r is None:
                    continue
                if r < DETAIL_FLAG and b > end_from:
                    hits.append({"항목": "끝화소", "초": t(a), "끝초": t(b), "값": {"가는결비": r},
                                 "글": f"끝 3초의 {t(a)}~{t(b)}초 컷이 잘라 키운 흐린 그림이다 — 가는 결 비 {r}(제 화소 판 0.25 안팎, 점검표 48 · 2)"})
                else:
                    notes.append({"항목": "화소", "초": t(a), "가는결비": r})

    guard("화소", _detail)

    sound = {}

    def audio():
        """0.25초 칸 dB — 끝 · 조용이 함께 쓰도록 한 번만 푼다"""
        if "db" not in sound:
            sound["db"] = audio_rms(o.mp4, dur)
        return sound["db"]

    def _end():
        if "끝" in want:
            db = audio()
            if db is not None and len(db) > 4 * (END_SEC + 2):
                end_n = int(END_SEC * 4)
                body_mid = float(np.median(db[4: len(db) - end_n]))
                quiet = 0                               # 끝에서부터(마지막 0.25초 칸은 빼고) 몸통 가운데보다 10dB 넘게 작은 칸이 잇달아 몇 개인가
                for v in db[-2::-1]:
                    if v < body_mid - END_QUIET_DB:
                        quiet += 1
                    else:
                        break
                row = {"끝조용초": round((quiet + 1) / 4, 2), "몸통가운데dB": round(body_mid, 1), "끝최대dB": round(float(np.max(db[-end_n:-1])), 1)}
                if quiet >= END_QUIET_SEC * 4:
                    hits.append({"항목": "끝소리", "초": round(dur - row["끝조용초"], 2), "값": row,
                                 "글": f"끝 {row['끝조용초']}초가 몸통 소리 가운데({row['몸통가운데dB']}dB)보다 {END_QUIET_DB:.0f}dB 넘게 작은 방 소리뿐이다 — 끝 소리 한 방이 없다(점검표 2)"})
                else:
                    notes.append({"항목": "끝소리", **row})

    guard("끝", _end)

    def _quiet():
        if "조용" in want:
            db = audio()
            if db is None:
                return
            ref, runs = quiet_runs(db)
            if ref is None:
                return
            for s, e, lvl in runs:
                if (e - s) / 4 <= QUIET_SEC:
                    break
                a_, b_, n_ = round(s / 4, 2), round(e / 4, 2), round((e - s) / 4, 2)
                hits.append({"항목": "조용구간", "초": a_, "끝초": b_, "값": {"길이초": n_, "평균dB": lvl, "기준dB": ref},
                             "글": f"{a_}~{b_}초 {n_}초 동안 소리가 이 편의 큰 소리({ref}dB)보다 {QUIET_DB:.0f}dB 넘게 작다(평균 {lvl}dB) — "
                                   f"말 · 사건 소리 없이 작은 소리만 깔린 긴 구간이라 폰 스피커로는 비어 들린다(최종 확인 갈래 「소리」)"})
            notes.append({"항목": "조용구간", "최장초": round((runs[0][1] - runs[0][0]) / 4, 2) if runs else 0, "기준dB": ref})

    guard("조용", _quiet)

    diffs = {}

    def small_diffs():
        """긴 변 192 장의 이웃 장 차이 — 멈춤 · 첫머리가 함께 쓰도록 한 번만 잰다(장은 컷 찾기에서 이미 풀었다)"""
        if "dd" not in diffs:
            diffs["dd"] = frame_diffs(small)
        return diffs["dd"]

    def _frozen():
        if "멈춤" in want:
            runs = frozen_runs(small_diffs(), fps)
            body = [r for r in runs if not r[2]]
            for a_, b_, _end in body:
                n_ = round(b_ - a_, 2)
                if n_ <= FROZEN_SEC:
                    break
                hits.append({"항목": "화면멈춤", "초": a_, "끝초": b_, "값": {"길이초": n_, "문턱": FROZEN_DIFF},
                             "글": f"{a_}~{b_}초 {n_}초 동안 화면 전체가 그대로다(이웃 장 평균 차이 {FROZEN_DIFF} 아래) — 말은 이어져도 화면이 "
                                   f"{FROZEN_SEC:g}초 넘게 서 있으면 최종 확인의 「멈춘 화면」이다(점검표 20)"})
            notes.append({"항목": "화면멈춤", "최장초": round(body[0][1] - body[0][0], 2) if body else 0})

    guard("멈춤", _frozen)

    def _head():
        if "첫머리" in want:
            rows = head_freeze(small_diffs(), msegs(), fps, small_camera(small), lambda i: float(small[i].std()))
            for r in sorted((x for x in rows if x["걸림"]), key=lambda x: x["a"]):
                a_, b_ = t(r["a"]), t(r["b"])
                hits.append({"항목": "첫머리굳음", "초": a_, "끝초": b_,
                             "값": {"비": r["비"], "첫머리": r["첫머리"], "가운데": r["가운데"], "카메라": r["카메라"], "문턱": HEAD_RATIO},
                             "글": f"{a_}~{b_}초 컷 첫 0.25초의 움직임(장 차이)이 그 컷 가운데의 {r['비']}배다 — 컷이 굳은 채로 시작해 보인다. "
                                   f"원본 시작을 제 빠르기가 된 뒤로 옮기고, 첫머리를 미는 창은 고른 빠르기로 민다(점검표 26)"})
            low = [r for r in rows if r["비"] < HEAD_NOTE]
            notes.append({"항목": "첫머리", "잰컷": len(rows),
                          "낮은컷": [{"초": t(r["a"]), "비": r["비"], **({"카메라출발": r["카메라"]} if r["카메라"] and not r["걸림"] else {})} for r in low]})

    guard("첫머리", _head)

    def _speech():
        """말 시각(silero VAD) — 말 없는 자리 표와 마지막 말 뒤 꼬리를 「알림」에 낸다. 걸림은 내지 않는다(걸릴 편과 지나갈 편을 가르는 문턱이
        없었다 — 머리말 「말」). VAD를 못 쓰면 이 항목만 「알림」 한 줄로 건너뛴다(못잼에 넣지 않는다 — 끝 코드가 바뀌지 않게)"""
        if "말" not in want:
            return
        try:
            probs, why = vad_probs(o.mp4)
            db = audio() if probs is not None else None
            if probs is None or db is None:
                notes.append({"항목": "말", "못잼": why or "소리를 못 풀었다"})
                return
            table = speech_table(speech_runs(probs), db, dur)
            notes.append({"항목": "말", "모델": "silero VAD v6", **(table or {"말dB": None, "말없는자리": [], "첫말초": None, "꼬리": None})})
        except Exception as e:  # noqa: BLE001 — 말 시각이 깨져도 끝 코드 · 다른 항목은 그대로(guard에 맡기면 못잼에 들어 끝 코드가 2가 된다)
            notes.append({"항목": "말", "못잼": f"{type(e).__name__}: {e}"[:200]})

    guard("말", _speech)

    def _flow():
        if "흐름" in want:
            hs, ns = measure_flow(o.mp4, msegs(), w, h)
            hits.extend(hs)
            notes.extend(ns)

    guard("흐름", _flow)

    def _motion():
        if want & {"굳음"}:
            for r in measure_motion(o.mp4, fps, segs):
                if r["판정"] == "가까움 · 눈으로 판정":
                    notes.append({"항목": "가까움", "초": r["시작"], "끝초": r["끝"], "사람": r["사람"]})
                    continue
                mostly_people = r["사람장"] > (r["장"] - 1) / 2
                if mostly_people and r["사람"] < FROZEN:
                    hits.append({"항목": "굳음", "초": r["시작"], "끝초": r["끝"], "값": {"사람": r["사람"], "카메라": r["카메라"]},
                                 "글": f"{r['시작']}~{r['끝']}초 컷의 사람이 굳어 있다 — 사람 {r['사람']}(0.12 아래, 점검표 26)"})
                elif mostly_people and r["멎은창"]:
                    hits.append({"항목": "구간굳음", "초": r["멎은창"][0], "끝초": r["끝"], "값": {"사람": r["사람"], "창": r["멎은창"]},
                                 "글": f"{r['시작']}~{r['끝']}초 컷 안 {r['멎은창'][0]}초부터 1.5초 넘게 사람이 멎는다(점검표 26)"})
                notes.append({"항목": "사람", "초": r["시작"], "끝초": r["끝"], "사람": r["사람"], "판정": r["판정"], "사람장": r["사람장"], "장": r["장"]})

    guard("굳음", _motion)

    out = {"파일": o.mp4, "길이": round(dur, 2), "fps": fps, "원본fps": round(src_fps, 3), "컷": [t(c) for c in cuts], "걸림": hits, "알림": notes,
           **({"못잼": failed} if failed else {})}
    if o.json:
        print(json.dumps(out, ensure_ascii=False))
    else:
        print(f"{os.path.basename(o.mp4)} · {out['길이']}초 · 컷 {len(cuts) + 1}개")
        for x in hits:
            print(f"  [{x['항목']}] {x['글']}")
        for x in failed:
            print(f"  [못 잼 · {x['항목']}] {x['오류']}")
        if not hits and not failed:
            print("  걸림 없음")
        for line in speech_text(next((x for x in notes if x.get("항목") == "말"), None)):
            print(f"  {line}")
    hard = [x for x in hits if x["항목"] not in SOFT]
    code = 1 if hard else (2 if failed else 0)
    _검사이력(시작=o.mp4, 눈="최종본검사", 단계="편집", 결과="걸림" if hard else ("못 잼" if failed else ("확인" if hits else "통과")), 끝코드=code,
           판경로=[o.mp4], 걸림=[{"규칙": x["항목"], "등급": "확인" if x["항목"] in SOFT else "걸림", "글": x["글"]} for x in hits]
           + [{"규칙": x["항목"], "등급": "확인", "글": f"못 잼 — {x['오류']}"} for x in failed])
    return code


def _검사이력(판경로=None, **k):
    """편 폴더 게시/검사이력.jsonl에 이 실행 한 줄(tools/lib/검사이력.py, 흠 장부 설계 1단계). 무엇이 실패해도 위 출력과 끝 코드는 그대로다.
    올리기 전 검사 ⑳이 부를 때는 그 검사가 한 줄로 남기므로 SYNK_검사이력=끔으로 부른다. 최종 확인 묶음은 SYNK_검사단계=최종 확인을 넘긴다."""
    try:
        if os.environ.get("SYNK_검사이력") == "끔":
            return
        spec = importlib.util.spec_from_file_location("검사이력", os.path.join(HERE, "lib", "검사이력.py"))
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        m.도구에서남기기(판=m.경로지문(판경로) if 판경로 else None, **k)
    except BaseException:   # noqa: BLE001 — 이력은 검사 결과를 바꾸지 않는다
        pass


if __name__ == "__main__":
    sys.exit(main())
