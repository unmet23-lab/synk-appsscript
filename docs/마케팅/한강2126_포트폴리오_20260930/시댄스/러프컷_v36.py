"""러프컷 v36(11-07): v35(v34 바탕)의 흠만 고친 판 — 유호님 11-06 「좋아, 흠 고쳐」.
10-18에 짚으신 v34 흠을 장면 · 대사 · 타이밍은 그대로 두고 고친다.
- 화질 깨짐: 오프닝 뒤 거의 모든 컷이 480×854 초안 판을 1080으로 늘린 것 → 쓰는 구간만 로컬 SeedVR2-3B로 1080p로 키운 판을
  화면에만 갈아 끼운다(재촬영_v40/업스케일/v35/_목록.json, 도구/업스케일_v35.py). 소리는 원본 그대로. 다 키운 뒤 도구/키운판_흐림검사.py로 원본 대비 흐린 장을 잰다.
- 4층 「…상어가 있어서요.」 → 「…상어랑 어깨빵했어요.」(오프닝 어깨빵 콜백), VR ② 카드도 같은 말로. 새 판은 F2_NEW가 있을 때만.
- 마지막에 −14 LUFS(통합) · 참 첨두 −1.5 dBTP로 두 번 재서 맞춘다(전에는 −15.0 안팎).
- 까몽 위치 튐 · 배경 어긋남은 장면마다 잰 결과로 자르기 · 바꾸기만(아래 SEQ 주석 v36).
그 밖은 v35와 같다.
"""
"""러프컷 v35(11-06): v34 그대로에 층 이동 두 자리만 v40(재촬영) 판을 끼운 판. 크레딧 0.
유호님 11-06 「전체적으로 전 버전이 훨씬 재밌는것같아 … 지금은 … 맹하고 … ai슬롭을 억지로 만든 느낌」 → 「응, v34 바탕으로」.
v34의 사건 · 표정 · 볼거리 · 연기 흐름은 그대로 두고, 10-18에 짚으신 「1~2층 갈때도 (드론샷이) 빠졌있어서」만 고친다:
- 1층 → 2층: v34 계단 점프컷(STAIR G1s · G1b) 대신 v40 T1(계단 FPV → 문 위로 솟아 → 2층 전경 원테이크, 생성 소리 대신 라운지 공간음).
- 유람선: v34 하늘 접근(SKY) 뒤에 v40 T2b(구조돼 담요 쓴 상어 — 어깨빵 콜백) 1.5초, 「아이돌 춤이 AI 같다」(10-18)는 무대(STAGE)를 4.6 → 3.0초로.
그 밖은 v34와 같다(아래 옛 머리말은 v23~v34 기록).
"""
"""러프컷 v23: v21 장면 구성 그대로, 2층(SHIFT) 다섯 자리만 인물·흐름을 맞춘 컷으로 바꾼 판(10-13). 이 조립은 크레딧 0.
유호님 10-13 「전체적인 장면 구성은 전 버전이 훨씬 나은것같아. 전 버전을 캐릭터 일관성이랑 흐름만 잘 맞춰서 다시 보여줄수있어?」,
「색감은 내가 좋아하는 색감으로」 → v22(2층을 처음부터 다시 짠 판) 구성은 버리고 v21 순서·대사·자막을 그대로 둔다.
바꾼 자리(파일은 video/v22장면/전버전고침/, 새 컷은 같은 구도 전 버전 컷에 Lab 값을 맞춤 — 도구/v22_색맞춤*.py):
- V2 계단: 뒷머리 묶음 → 한 줄씩(v21 E6 결과를 그 프레임에만 합성, 길이·소리 그대로).
- S3C1 접수대 「면접이시죠? 14분 늦으셨네요.」: 같은 구도로 다시 뽑은 컷(머리·회색 재킷·까몽 키링, 원래 대사를 소리 참고로 입모양).
- 2A 돌아봄: 「니하오」 뒤 그가 몸을 돌려 그녀를 보는 컷(확정 얼굴, SHIFT 벽 배경).
- N1 「…모악산 배네치아요.」: 같은 장면 정면 컷 + 셋이 함께 서 있는 넓은 컷. 목소리는 v15 그의 녹음을 입 움직임(1.17초)에 맞춤.
- S3D 「4층이에요. 계속 올라가세요.」: 2층 사무실(직원·책상·의자)에서 손짓 → 그의 끄덕임 → 걸어 나감 → 그녀가 바라봄 → 창가의 그
  (창밖 유람선 → LA로 이어짐). 마지막 창 컷만 위쪽 하늘을 LA 낮 하늘 쪽으로 식혔다.
그 밖(오프닝·1층·LAB·PATH·4층·엔딩)은 v21과 같다.

v24(10-13, v23을 보신 뒤): 「첫번째 사진 장면 질감이 다음 화면에도 이어져야하는데 두번째 사진 장면 보면 확 바뀌거든?」
「"14분 늦으셨네요" 할 때 "1, 14분 늦으셨네요" 이렇게 발음해」 「다른 직원들이 인사할 때는 질감이 예쁜데 이 사람 나올 때 또 질감이 확 바뀌어」.
- 접수대 S3C1: v23은 옛 접수대 컷(같은 구도)에 맞춰 어둡고 차가웠다. 바로 앞 계단 끝(V2)에 맞춰 밝기·따뜻함·채도·부드러움을
  다시 잡음(도구/결맞춤.py, 원본에서 한 번). 「시, 십사분」의 「시,」(2.17~2.27초)는 같은 컷 바탕 소리로(도구/소리_한토막_지우기.py).
- 「4층이에요」 S3D: 첫 컷이 접수대와 같은 구도라 같은 값으로, 그녀 컷은 A8 그녀 피부에 맞춰 약하게, 창가 컷은 위쪽 하늘만 LA 쪽으로.
- 인사 몽타주 A7: 러시아 직원(1606, NBP 정지컷에서 시작 · 다른 사무실)만 이웃 직원들처럼 따뜻한 빛·채도·부드러움·빛 번짐으로(A7_v23).

v25(10-13, v24를 보신 뒤 다시 뽑기): 「(수고하셨어요→계단) 아예 다시 뽑아줄수있어? 중간에 툭 끊기기도 하고 머리쪽에 계속 일렁이는느낌」,
「아예 이 부분들 다 다시뽑는게 좋겠는데」, 「"모악산 배네치아요" … 얼굴이 너무 누래 … 색감을 제발 통일해줘, 이 여자 색감이나 인트로 색감」,
「(면접이시죠?) 까몽이가 … 이미지파일을 붙여넣은것같아 … 필요하면 이미지부터 생성까지 진행해」, 「4층이에요 … 색감 제발 똑같도록」.
시작 그림을 나노바나나로 새로 그리지 않고 좋다고 하신 컷의 프레임에서 바로 이어 뽑았다(video/v25장면, 작업 _주문.tsv):
- G1 계단: 1층 S2 345프레임에서 → 「수고하셨어요. 4층은 저 계단이요.」 → 계단 오름(5.08초까지, 꼭대기 창 앞 실루엣은 키링이 커져 뺌) → 원래 2층 도착(V2 150~234).
- S3C1 접수대: 도착 화면 마지막(V2 234)에서 이어 뽑은 G2의 가까운 컷(2.625초~), 까몽은 1층과 같은 검은 털 키링.
- 2A·N1: 대화하는 그녀(A8) 프레임에서 이어 뽑은 G4(돌아봄 1.29~4초, 모악산 4~7.04초). 피부 색상각 40~43°(그녀 37°, 예전 55°).
- 인사 몽타주: 러시아 직원만 G5(SHIFT 방 정지컷을 이웃 직원 결로 맞춰 시작, 피부 37° = 니하오 직원).
- S3D: G2 마지막 프레임에서 이어 뽑은 G3(「4층이에요」 → 끄덕 → 걸음 → 그녀 → 창가 → 창밖 유람선으로 나감). 그녀 앞을 그가 지나며
  렌즈를 가린 0.4초(123~134프레임)는 뺐다. G3 끝 프레임이 LA 146프레임과 같아(차이 17) LA를 147프레임부터 잇는다.
- 대사: 감독·접수원은 원래 목소리(생성 목소리 구간만 낮추고 도구/대사_갈아끼우기.py로 입모양_맞춤 자리에), 그의 「모악산」은 안내 목소리 5.30초.

v26(10-13, 유호님 「그냥 유람선 씬부터 synk lab 씬까지 아예 다시… 창문 안 학생 장면 삭제… 커피 라떼로 바뀜… path 직전까지」 → 이미지 콘티
`review/v25_LAB_이미지콘티.jpg` 확인 「오케이 진행해」): 유람선·무대(LA·STAGE)와 건물로 날아가는 N3 앞 8.5초는 그대로, 그 뒤를 새로 뽑은 다섯 장면으로.
- LB1 비행: 건물 3층 띠 창의 계단 칸 유리를 뚫고 들어가 계단을 오르는 그(마린 뒤따름)가 LAB 문을 미는 데까지 한 컷(시작 A4a = N3 8.5초 그림).
- LB2 입장 → 그의 시점 「어. 서. 오. 세. 요~!」(아메리카노). LC 「자, 다음 단어. 학교!」 → 관문 → 몽글 별 눈/뾰로통.
- LD1 「한 번 해 보세요. 병원!」 → 핸들 그대로 들고 병원 관문 → 「…한국 분이세요?」. LD2 「네.」(확정 얼굴 정지컷 그대로). LD3 「아, 면접?」 → 아치로.
- 대사는 원래 녹음(진행자·1919)을 입모양 자리에(도구/대사_여럿_갈아끼우기.py), 마스코트는 현장 참고(refs/마스코트_현장).

v27(10-13, 유호님 「어서오세욧 하고나서 장면인데 인물이 많이 바뀌었어… 약간은 기괴하도록 웃으면서 수업… 뒤에 사람들이랑 배경이랑 전부 달라서」
「아. 면접! 하고 이동하는 장면인데 배경이 갑자기 바뀌어서 배경만 주황색으로」 → 고침 이미지 콘티 `review/v27_LAB_고침_이미지콘티.jpg`, 「153 버전이 제일 좋네」):
- LC1 「자, 다음 단어. 학교!」: 「어서오세요」 그 선생님·그 코랄 방·그 학생 넷으로 다시 뽑은 5초(시작 그림 153). 관문부터(LC)는 L3 92프레임부터 그대로.
- LD3 「아, 면접?」 바스트는 그대로(L4b 64~122프레임), 아치로 걸어가는 컷(LD4)만 뒷벽을 코랄로 바꾼 150에서 다시 뽑은 4초.

v28(10-13, 유호님 「웅 이어가볼래!?」 → 이미지 콘티 `review/v28_PATH4층_이미지콘티.jpg` → 「웅 진해애해」): PATH·4층을 새로 뽑은 열 장면으로.
- PATH(P1~P3): 아치로 들어감 → 상담사 「면접이시죠?…」 → 헤드셋 → VR 속 마린·몽글 면접관에게 90도 절 → 알고 보니 라운지 빈 의자에 절(마린도) → 헤드셋 벗김 「좋아요. 진짜는 4층이에요.」
- 4층(F1~F6): 입장 「왜 늦었어요?」 → 「…상어가 있어서요.」 → 회사 소개 → 「수영 잘해요?」 → 「…아니요.」 「합격.」 → 「나이쓰!」 → 마린 손뼉 → OUT 창밖 까치(끝 = E2 첫 프레임, E2는 1프레임부터).
- 그의 얼굴은 생성마다 첫 컷에서만(확정 얼굴 정지컷이 시작 그림). 대사는 원래 녹음을 입모양 자리에(도구/대사_여럿_갈아끼우기.py).

v29(10-13, 유호님 「마린이 다른거로 바뀌었어 … 톤이 또 이상해졌어 … 아예 내가 아니야 … 이미지콘티 다시」 → 톤 고침 이미지 콘티
`review/v29_PATH4층_톤고침_이미지콘티.jpg` → 「웅 다시 뽑아」): PATH·4층 열 장면을 1층 PULSE 스튜디오의 빛·색에 맞춘 정지컷에서 다시 뽑음.
- 마린은 라운지에서 서서 올려다봄(절하지 않음), 헤드셋 컷 뒤는 라운지 세이지 벽, 4층 와이드·창밖 연결은 그의 뒷모습만, 「합격.」은 탁자 위 손·카드.

v30(10-13, 유호님 「수고하셨어요… 여기 다시 뽑아야할것같아 얼굴이 너무 깨져보여」 → 두 안 중 「안 1로 만들어줘」): 1층 → 계단 G1만 어깨 너머 감독 컷으로 다시(그는 뒤통수·뒷모습만).

v31(10-14, 유호님 「오케이 일단 이 버전 기억해주고 지금 인트로떄 마린 따라가는 장면이나 전체적으로 좀 느리고 재미없는 부분들 편집해서
다시 최종본 만들어줄수있어? 20초정도 줄이면 좋을것같아」): v30을 기준 판으로 두고, 그림이 멈춰 있거나 이동만 하는 곳을 약 20초 덜어 냄.
- 인트로: 쓰러진 얼굴 컷 앞 1초, 물보라 끝 0.5초, 마린이 내려다보며 멈춘 1초, 마린 따라 걷는 뒷모습 컷 통째(1.9초).
  같은 컷 안에서 자르면 얼굴이 살짝 튀어서 얼굴은 컷 경계에서, 마린은 앞뒤 프레임 차이가 가장 작은 자리(26.0 → 27.0)에서 자름.
- 로비: 첫 와이드 앞 0.5초, 간판 올려다보기·계단·문 지나는 컷 끝을 0.7~0.9초씩.
- 유람선 군중 끝 1초, 무대 마지막 컷 0.5초, 무대→LAB 비행은 무대를 위에서 보는 앞부분(2.96초까지) 뺌.
- PATH 걸음 1.4초·반전 뒤 1초, 4층 와이드 0.8초·마린 갸웃 1초·까몽 0.3초·「나이쓰」 뒤 마린 컷 통째(2.1초, 창밖 컷 첫 프레임이 마린),
  로고 카드는 로고가 멈춰 있는 가운데 1.2초(`video/v31장면/마감카드_로고1.2초줄임.mp4`, 떠오름·꺼짐 그대로 — 끝을 자르면 로고가 꺼지지 않고 뚝 끝남).
  까치 비행 앞 1.2초는 잘라 보니 유람선이 툭 튀어나와 v30 그대로 둠.
v32(10-14, 유호님 「일단 지금 해야할것들 준비 다 해서 최종본 보내줘」): 내용은 v31 그대로. 12:22 앱 세션 삭제로 wav가 사라져
다시 조립할 수 있게만 고침 — 2층 2A·A8·N1 소리는 v31 완성본에서 떼어 쓴 `audio/v32_대체/2층_v31완성본_2A_A8_N1.wav`(again=0: 음량·거르기 그대로,
세 조각 사이는 head_x·tail_x=0으로 바로 이음, 대사 sfx는 이미 들어 있어 뺌), ROOT는 메인 저장소. 다음 수정은 이 판에서 시작한다.
  - 떼는 자리는 리미터 두 번(조각·마지막)의 지연 498샘플만큼 뒤에서(안 그러면 10ms 늦게 놓임), 그 구간 bed는 떼어 온 소리에 이미 있어
    거꾸로 줄여 한 번만 남김(안 그러면 조용한 데서 +5.5dB). v31과 맞대기는 `도구/두판_맞대기.py`.
v33(10-14, 유호님 여섯 가지 수정 → 「나이스 뺄게. 일단 추천안대로 진행」): 편집 부분 먼저.
- 한숨: v31에서 뺐던 쓰러진 얼굴 컷 앞 1초(11.33~12.33)를 되살림(OPEN·OPENb는 같은 원본의 이어지는 프레임, 소리 겹침 0으로 바로 이음).
- 면접실 F1~F5: 노란 기 −12 LUT(`review/v33준비/노란기-12.cube`, 피부 색상각 60°→43~46°, 2층 43°에 맞춤).
  「…아니요」 얼굴 컷(F5 0~69프레임)은 대비가 낮고 검정이 떠 −12만 걸면 회색빛 → 앞 컷 F3 분포에 맞춘 LUT(`F5얼굴_F3맞춤_밝기분포.cube`).
- 「합격.」 카드 컷(F5 69~121프레임): 원래 「합격.」 목소리를 방 소리로 지운 판(`video/v33장면/F5_솔직합격.mp4`) 위에
  면접관 목소리로 만든 「솔직해서, 합격.」(`audio/v33/솔직해서합격_최종.wav`, 1.98초)을 3.0초에 얹음.
- 「나이쓰!」 F6 통째 뺌 → 카드 컷에서 바로 창밖 OUT.
- PATH 상담사 컷(P1 111~172프레임)만 같은 생성의 도착 컷에 밝기·색 분포를 맞춤(`P1상담사_도착맞춤.cube`). PATH 나머지는 그대로.
- 새 옵션 lut=<.cube>: 조각 화면에 lut3d를 건다(캐시 키에 LUT 파일 시각 포함).
v33 전체(10-17, 유호님 「검수 손질본대로 진행해」 — Fable 2차 검수 손질본): 새로 뽑은 여섯 컷을 넣음(video/v33장면, 작업 ID _주문.tsv).
- 계단: G1을 93프레임(그가 계단에 들어서는 순간)에서 끊고 FPV 한 컷(201) → 2층 도착 V2는 201 끝과 같은 그림이라 빼고 바로 접수대.
- 「…모악산 배네치아요.」 뒤 어깨 툭툭(222, 고개가 도는 중 2.92초에 N2로). 첫 판(221)은 소매 참고 그림의 창문 배경이 섞여 버림.
- 창밖 OTS 1초(S3D2 165~188) → 하늘에서 내려오는 다이브(301) → 무대 아이돌 클로즈업(STAGE 그대로). LA 항공은 뺌.
- PATH: 절·마스코트 끄덕(P2 0~103) → VR 「거짓말 탐지 면접」(401) → 라운지 빈 의자 반전(P2 104~). 생성 소리 대신 VR 방소리·
  질문 알림(사운드킷 notify)·버저·째깍·정답(achieve), 글자 카드는 ASS(SUIT). 4층 「왜 늦었어요?」에 같은 Q 카드 0.6초(콜백).
- 「솔직해서, 합격.」은 「…아니요」 컷 꼬리(2.65초)에서 시작해 카드 컷에 「합격.」, 뒤 0.4초 정적(1차 검수).
- 까치: 창밖 → 나무(OUT 끝)와 가지·이륙(E2a)을 노을 쪽 LUT로 데운 판(OUT_창밖_노을.mp4·E2_이륙_노을.mp4, 대낮 6초가 섬처럼 튀던 것) → 까치 비행 다시 판(611) 앞 2.75초(뒤는 대낮 하드컷이라 뺌)
  → 상어 착지 다시 판(612, 쪼기·관객 쪽 무표정·으쓱·V 포즈) + 마지막 포즈 1.6초 정지 → 로고. 첫 판(601·602)은 까치 색이 변하고 상어가 거의 안 움직여 버림.
- 끝 노래(STAGE 원곡)는 착지 0.5초에 멈췄다가 4.3초에 멈춘 자리부터 다시(MUSIC 부분 둘). 그 사이엔 상어 클립 소리의 가운데(쪼기·웃음)만.
- 새 기능: SUBS 다섯째·여섯째 칸(스타일, 앞머리 태그), 일곱째 칸 span=True(조각 끝을 넘어 이어짐), MUSIC 끝을 (조각, 원본 기준 초, 페이드) 튜플로,
  m_t0=None이면 앞 부분이 멈춘 자리부터.
v34(10-18, 유호님 「좀 루즈한감이랑 억지가 좀 있는것같아서」 → 「페이블이랑 손질해서 최대한 지루한부분 없애주고 지루하지않게 재밌게 최종 편집」): 편집만(크레딧 0).
사용: python -I 러프컷_만들기_v34.py <출력 mp4>
"""
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')
OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = r'C:\Users\q1212\Documents\SYNK-appsscript'   # v32: 새판을 Videos로 옮겨 폴더 기준 상대 경로가 안 맞음
FONT = os.path.join(ROOT, 'docs', '브랜드_폰트')
KIT = os.path.join(ROOT, 'docs', '브랜드_사운드킷')
TMP = os.path.join(HERE, 'video', '_러프컷v36')
W, H, FPS = 1080, 1920, 24
TARGET_LUFS = -23.0
BED_LUFS = -52.0
XA = 0.12      # 컷 소리 교차의 반쪽 길이(초)
EDGE = 0.01    # 이웃이 없는 끝(영화 처음)은 딸깍 방지만
MOVE, HEAD_MAX = 1.2, 0.5
os.makedirs(TMP, exist_ok=True)


def P(*parts):
    return os.path.join(HERE, *parts)


V6 = lambda n: P('video', 'v6장면', n)
PATCH = lambda n: P('video', 'v8장면', '패치', n)
V11 = lambda n: P('video', 'v11장면', n)
V12 = lambda n: P('video', 'v12장면', n)
V16P = lambda n: P('video', 'v16장면', '패치', n)
TONE16 = lambda n: P('video', 'v16장면', '톤', n)
V17P = lambda n: P('video', 'v17장면', '패치', n)
V18P = lambda n: P('video', 'v18장면', '패치', n)
TONE18 = lambda n: P('video', 'v18장면', '톤', n)
V19P = lambda n: P('video', 'v19장면', '패치', n)
TONE19 = lambda n: P('video', 'v19장면', '톤', n)
AUD19 = lambda n: P('audio', 'v19', n)
V20P = lambda n: P('video', 'v20장면', '패치', n)
TONE20 = lambda n: P('video', 'v20장면', '톤', n)
AUD20 = lambda n: P('audio', 'v20', n)
AUD = lambda n: P('audio', 'v12', n)
AUD15 = lambda n: P('audio', 'v15', n)
AUD16 = lambda n: P('audio', 'v16', n)


def SND(name):
    return name if os.path.isabs(name) else os.path.join(KIT, name)


RAW19 = lambda n: P('video', 'v19장면', n)            # v19 새 컷 원본(패치_v19_톤.py 전)
NEW = lambda n: P('video', 'v20장면', 'v15색감', '패치', n)   # 패치_v20_v15색감.py 결과
V21H = lambda n: P('video', 'v21장면', '머리', n)      # 패치_v21_머리.py 결과
V21P = lambda n: P('video', 'v21장면', '인물', n)      # v21 인물 통일(2a·LAB 진행자) 결과

HG = lambda n: P('재촬영_v40', '시댄스', '다시_1106', 'v35', f'hg-{n}_24.mp4')   # v35: v40 재촬영 판 — 드리미나 파일은 머리가 60fps(실제 24)라 이 스크립트가 장을 늘려 읽어(계단 5.5초가 20초로) 진짜 24fps 1080p로 옮긴 사본
T1_NEW = P('재촬영_v40', '시댄스', '다시_1106', 'v36', '받음', 'T1_a_24.mp4')   # v36: 계단 원테이크를 가방 왼쪽 아래 까몽 판으로(G1 · S3C1과 이어지게), 11-07 드리미나 울트라
# v36: 「…상어랑 어깨빵했어요.」 새 판(드리미나 울트라 11-07 두 판 중 둘째 — 옛 목소리와 음높이 139 대 129Hz · 첫 판 147Hz, 24fps 1080p 사본).
#   말소리 1.70~2.80초(소리 크기 곡선) → 앞 쉼 0.9초를 두고 0.8~3.05초. 옛 판으로 돌리려면 F2_NEW= (빈 값)으로 돌린다.
F2_NEW = os.environ.get('F2_NEW', P('재촬영_v40', '시댄스', '다시_1106', 'v36', '받음', 'F2_b_24.mp4')) or None
F2_TIN, F2_TOUT = float(os.environ.get('F2_TIN', '0.8')), float(os.environ.get('F2_TOUT', '3.05'))
AMB40 = lambda n: P('재촬영_v40', '소리', '효과음', 'raw_1106', n)   # v35: v40 공간음(일레븐 효과음, wav로 옮김)
OPENING = P('video', 'v33장면', 'B18_오프닝_머리_복제프레임고침.mp4')   # v21 머리판에서 · v33 전체(10-17): 원본 생성(B5)의 1초마다 복제 프레임 11장을 앞뒤 중간 그림으로(도구/복제프레임_보간.py, 「까몽이 뚝뚝 끊김」)
S1 = V17P('S1_v17.mp4')            # v17: 로비 클락션 뺌(톤 판 대신 원래 판)
S2 = NEW('S2_v19.mp4')             # v19 머리(한 줄씩)를 원래 색 S2_v17 위에
S2_SHIFT = 32 / 24
FIX23 = lambda n: P('video', 'v22장면', '전버전고침', n)   # v23: v21 구성에 끼우는 2층 고침 컷
V2 = FIX23('V2_머리고침.mp4')       # v23: V2_v19(계단 끝 이음 그대로)에서 뒷머리 묶음만 한 줄씩으로(v21 E6 결과 합성)
V2_SHIFT = -6 / 24
S3B = V6('S3b_2F사무실_15초.mp4')   # v15와 같은 원본
S3C = NEW('S3c_v19.mp4')           # v19 머리를 원래 색 S3c_v18(v18 뒤 사람 움직임) 위에
S3C1N = FIX23('S3C1새_결맞춤.mp4')   # v24: 계단 끝(V2)에 맞춘 결 + 「시,」 더듬음 뺌(대사 1.24~3.4초)
S3D = FIX23('S3D새_결맞춤.mp4')      # v24: 접수대와 같은 결로(9초, 다섯 컷)
EBOARD = V12('EB_v12_펠트보드_1.6초.mp4')
V25 = lambda n: P('video', 'v25장면', n)   # v25: 다시 뽑은 2층
V25L = lambda n: P('video', 'v25LAB', n)   # v26: 다시 뽑은 LAB
V28 = lambda n: P('video', 'v29PATH4F', n)   # v29: 톤 고쳐 다시 뽑은 PATH·4층(v28 구성 그대로)
A7 = V25('A7_v25.mp4')             # v25: 러시아 직원만 G5(조각 목록 A7_v25_조각.json)
G1 = P('video', 'v30G1', 'G1_원래대사.mp4')   # v30: 어깨 너머 감독 「수고하셨어요…」 → 뒷모습으로 계단(감독 원래 목소리 두 토막)
G2 = V25('G2_접수대_원래대사.mp4')   # v25: 접수대(접수원 원래 목소리 2.42초)
G3 = V25('G3_4층이에요_원래대사.mp4')  # v25: 4층이에요 → 창가 → 유람선(접수원 원래 목소리 0.24초)
G4 = V25('G4_돌아봄모악산_7초.mp4')  # v25: 돌아봄 1.29~4초, 모악산 4~7.04초
TWOA = FIX23('R1_돌아봄_색맞춤.mp4')  # v23 2a: 「니하오」 뒤 몸을 돌려 그녀를 봄(81프레임)
A8 = RAW19('1910_커피질문.mp4')     # v19: 입모양 다시, 「음..」 1.22초 · 문장 2.32초(audio/v19/A8v19_대사_맞춤.wav)
A8_TIN, A8_TOUT = 0.7, 3.85
N1 = FIX23('R2_모악산_색맞춤.mp4')   # v23: 정면 「…모악산 배네치아요.」(입 1.17~2.04초) → 2.125초 셋이 선 넓은 컷(85프레임)
N2 = V12('1212c_N2_텀뒤_신입사원이에요_5초.mp4')   # v15와 같은 원본
LA = V18P('LA_v18.mp4')            # v18: 무대 뒤 돛대가 처음부터(원래 색 1105에 합성한 판)
STAGE_SRC = V6('STAGE_무대_리듬컷_10초.mp4')    # 엔딩 노래는 원본 소리에서
STAGE = STAGE_SRC
N3 = V12('1213_N3_무대에서LAB_한컷_13초.mp4')
S5B, GATE = V21P('S5b_병원_v21.mp4'), V6('S5c_관문달리기_kling_4초.mp4')   # v21: 「병원!」 컷(181~236)을 L2 진행자 얼굴로 다시 그린 판
# v17 LAB 새 콘티(유호님 「훌륭해」). 이어 그린 L1은 원래 색 N3 끝에 색·화면 크기·위치를 다시 맞췄다(L1 안 화면 뜀에는 휩 흐림).
AUD17 = lambda n: P('audio', 'v17', n)
L1 = NEW('1803_L1_이음2.mp4')                # 유리 통과 뒤 낮게 날아 학습자(선생님이 몸을 돌려 손짓) → 휩 → 계단 문으로 들어서는 그
L2 = P('video', 'v17장면', '1702_L2_그시점_어서오세요.mp4')  # 그의 시점: 진행자가 또박또박 「어. 서. 오. 세. 요~!」 하며 소매를 끎
L3 = RAW19('1912_저요.mp4')                  # v20에서 뺀 컷(SEQ에 없음)
L4 = RAW19('1920_L4_학교.mp4')               # v19: 뒤에 선 그가 그의 얼굴로(정지컷 1932), 「자, 다음 단어. 학교!」 0.79초
KR = V21P('한국분_v21.mp4')                  # v21: 「한국 분이세요? / 네. / 아, 면접?」를 L2 진행자 얼굴로 다시 그림(같은 대사 소리로 입모양)
L3_TIN, L3_TOUT, L3_LINE = 1.5, 3.6, 2.75
S6 = NEW('S6b_v19.mp4')            # v19: 아치 머리 + 흰 방 인사에 마스코트 반응(원본보다 28프레임 김), 원래 색
S6_X = 28 / 24
N5 = V12('1215_N5_PATH_마린뒷모습_4초.mp4')
S7A, S7B = NEW('S7b1_v20.mp4'), PATCH('S7b2_액자.mp4')   # v20 면접실: 원래 색 머리판 + 웅얼거림 자리를 방 소리로(v20 소리 그대로)
NICE = RAW19('1914_나이쓰.mp4')              # v19: 「합격.」 뒤 안도의 한숨 → 「나이쓰!」(S7B 234프레임에서 이어 그림)
OUTW = NEW('1916_이음3.mp4')                # 창밖으로 빠져나가 강변 나무 까치로(원래 색 1914에 이어 맞추고 끝은 원래 E2 0프레임에)
FLY1, FLY2 = NEW('1915_이음2.mp4'), NEW('1917_이음2.mp4')   # 까치 이륙 뒤 비행(1915 0~67) → 앞을 보고 똑바로 나는 비행(1917)
E1 = V12('1219_E1_그에서나무위까치_5초.mp4')
E2 = V12('1220_E2_까치치맥에서유람선_10초.mp4')
N8 = V12('1218_N8_무대시점_트랄랄레로_5초.mp4')
CARD = P('video', 'v20장면', '마감카드.mp4')
CARD31 = P('video', 'v31장면', '마감카드_로고1.2초줄임.mp4')   # v31: 로고가 멈춰 있는 가운데(60~88프레임)만 뺌
LUT12 = P('review', 'v33준비', '노란기-12.cube')                     # v33: 면접실 노란 기 빼기
LUT_F5 = P('review', 'v33준비', 'F5얼굴_F3맞춤.cube')        # v33: 「아니요」 얼굴 컷만 앞 컷 분포에 · 10-18: 밝기분포 판은 피부가 수채화처럼 끊겨(유호님 3:37) 평균·폭만 맞춘 판 + lut_hq
LUT_P1 = P('review', 'v33준비', 'P1상담사_도착맞춤_부드럽게.cube')   # v33: PATH 상담사 컷만 같은 생성의 도착 컷 분포에(밝기 분위수 포함) · 10-18: 표를 다듬은 판(도구/LUT_부드럽게.py) + lut_hq
F5_NEW = P('video', 'v33장면', 'F5_솔직합격.mp4')                    # v33: 원래 「합격.」 목소리를 방 소리로 지운 F5
LINE_OK = P('audio', 'v33', '솔직해서합격_최종.wav')               # v33: 「솔직해서, 합격.」 면접관 목소리
V33 = lambda n: P('video', 'v33장면', n)    # v33 전체: 10-17 새로 뽑은 컷
AUD33 = lambda n: P('audio', 'v33', n)      # v33 전체: 도구/v33_효과음_만들기.py 결과
STAIR = V33('201_계단SHIFT_8초_맞춤_튐고침.mp4')   # v34: 1초마다 빠진 프레임 7장(옛 24·48…168 앞)에 중간 그림(도구/튐프레임_사이끼우기.py), 옛 k → k + 끼운 수   # 계단 FPV → SHIFT 전경(시작 = G1 93프레임). 도구/이음_화면맞춤_v33.py로 첫 프레임을 G1 92에 맞추고 1초에 걸쳐 원래로(4% 확대)
TAP = V33('222_어깨툭툭_다시_4초_맞춤.mp4')  # 어깨 툭툭(시작 = N1 끝 G4 168프레임). 같은 도구로 인물 위치·크기(3%)·밝기를 N1 끝에 고정
SKY = V33('301_하늘출발_8초_색맞춤.mp4')      # 하늘 → 우리 건물 앞 유람선 → 군중 → 무대 앞. 앞 2초 금빛 안개를 옛 LA 항공 분포로(review/v33준비/SKY앞_LA맞춤.cube), 2.0~2.6초에 원래 색으로(Fable 결과 확인)
VRG = V33('401_VR거짓말_9초.mp4')            # VR 거짓말 탐지 면접 5샷(1.958·3.75·5.458·6.833초 하드컷)
E2R = V33('E2_이륙_노을램프.mp4')            # (첫 판, 안 씀) E2 0~3초를 노을 쪽 반 세기 LUT로 0→2.5초 서서히 — 대낮이 섬처럼 남아 E2_이륙_노을.mp4로 바꿈
FLY = V33('611_까치비행_다시_7초.mp4')        # 까치 비행(2.75초에 대낮 하드컷 → 앞만)
SHARK = V33('612_상어착지_다시_6초.mp4')      # 상어 머리 착지 개그
MIX31 = P('audio', 'v32_대체', '2층_v31완성본_2A_A8_N1.wav')   # v32: v31 완성본 76.4737~85.5887초(2A 시작 1838프레임 - 0.12초 ~ N1 끝 2051프레임 + 0.12초, 리미터 두 번 지연 498샘플만큼 뒤에서)

SEQ = [
    ('video', OPENING, None, None, dict(tin=0.0, tout=272 / 24, tail_x=0.0, name='OPEN')),      # v33: 한숨 +1초 — 뒤 조각이 같은 원본의 바로 다음 프레임이라 소리 겹침 0
    ('video', OPENING, None, None, dict(tin=272 / 24, tout=22.0, head_x=0.0, name='OPENb')),    # v33: v31에서 뺀 11.33~12.33을 되살림(조각을 둘로 둬 뒤 조각 번호·캐시가 그대로), 물보라 끝 22.0~22.5는 그대로 뺌
    ('video', OPENING, None, None, dict(tin=22.5, tout=615 / 24, name='OPENc')),     # v31: 마린 기계음 뒤 멈춘 1초 뺌(26.0 → 27.0, 프레임 차이 가장 작은 자리)
    ('video', OPENING, None, None, dict(tin=27.0, tout=30.79, name='OPENd')),    # v31: 손 잡고 일어남까지
    ('video', OPENING, None, None, dict(tin=32.71, tout=34.66, name='OPENe')),   # v31: 마린 따라 걷는 뒷모습(30.79~32.71) 뺌 → 건물 와이드
    ('video', S1, None, None, dict(tin=0.5, tout=2.79, name='S1')),          # v31: 로비 와이드(앞 0.5초 뺌)
    ('video', S1, None, None, dict(tin=2.79, tout=3.7, name='S1b')),         # v31: 간판 올려다보기 0.9초만
    ('video', S1, None, None, dict(tin=4.54, tout=5.71, name='S1c')),        # 까몽·커피
    ('video', S1, None, None, dict(tin=5.71, tout=6.9, name='S1d')),         # v31: 계단 1.2초만
    ('video', S1, None, None, dict(tin=7.83, tout=9.3, name='S1e')),         # v31: 문 지나기(끝 0.74초 뺌)
    ('video', S2, None, None, dict(tin=0.0, tout=345 / 24, name='S2')),      # v25: 아치 앞 두 사람(345~)부터는 G1이 이어받음
    ('video', G1, None, None, dict(tin=0.0, tout=93 / 24, name='G1')),       # v33 전체: 계단에 들어서는 순간(92프레임)까지 → STAIR 0프레임 = G1 93
    ('video', T1_NEW, None, None, dict(tin=0.0, tout=5.5, amb=(AMB40('amb_lounge_1.wav'), 0.0), name='T1v40')),   # v35: v40 계단 FPV → 2층 전경 원테이크
    ('video', G2, None, None, dict(tin=63 / 24, tout=121 / 24, name='S3C1')),  # v25: G2 가까운 컷
    # v34 뺌(키보드): ('video', S3B, None, None, dict(tin=75 / 24, tout=4.25, name='S3B1a')),  # v18: 74프레임은 앞 장면(접수원) 끝이라 75부터
    ('video', EBOARD, None, None, dict(head=0.0, amb=(S3B, 4.25), name='EB')),
    # v34 뺌(에스프레소): ('video', S3B, None, None, dict(tin=5.58, tout=6.7, name='S3B1b')),
    ('video', S3C, None, None, dict(tin=2.5, tout=4.0, name='S3C2')),
    ('video', A7, None, None, dict(tin=57 / 24, tout=162 / 24, name='A7')),   # v34: 안경남 「니하오」 컷 경계 ~ 빨간머리 인사 끝(앞 둘 뺌)
    ('video', G4, None, None, dict(tin=60 / 24, tout=96 / 24, amb=(MIX31, 0.12 + 29 / 24), again=0.0, tail_x=0.0, name='2A')),   # v25: G4 돌아봄 · v32: 소리는 v31 완성본(원래 A7v15_바탕.wav)
    ('video', A8, None, None, dict(tin=A8_TIN, tout=A8_TOUT, amb=(MIX31, 0.12 + 65 / 24), again=0.0, head_x=0.0, tail_x=0.0,
                                   name='A8')),   # v32: 소리는 v31 완성본(원래 A8v19_바탕.wav + 대사 A8v19_대사_맞춤.wav)
    ('video', G4, None, None, dict(tin=96 / 24, tout=169 / 24, amb=(MIX31, 0.12 + 140 / 24), again=0.0, head_x=0.0,   # v23: 생성 목소리 대신 v15 그의 녹음
                                   name='N1')),   # v32: 소리는 v31 완성본(원래 N1v19_바탕.wav + 대사 N1_대사_안내.wav)
    # v34 뺌(어깨 툭툭 — Fable: 신입사원 소개가 누구 얘기인지 안 읽힘): ('video', TAP, None, None, dict(tin=1 / 24, tout=70 / 24, lufs=-32.0, name='N1b')),   # v33 전체: 어깨 툭툭(0프레임 = N1 끝과 같은 그림이라 1부터), 고개가 도는 중에 N2로
    # v34 뺌(신입사원이에요): ('video', N2, None, None, dict(tin=1.1, tout=4.8, name='N2')),
    ('video', S3B, None, None, dict(tin=10.85, tout=12.9, name='A10')),
    ('video', G3, None, None, dict(tin=0.0, tout=123 / 24, name='S3D')),        # v25: 4층이에요 → 끄덕 → 걸음
    ('video', G3, None, None, dict(tin=165 / 24, tout=189 / 24, name='S3D2')),  # v25: 그녀 → 창가 · v33 전체: 창밖 OTS는 1초(165~188)만, 유리 밖으로 나가는 이동은 뺌
    ('video', SKY, None, None, dict(tin=72 / 24, tout=192 / 24, name='SKY')),      # v33 전체: 하늘에서 내려와 우리 건물 앞 유람선 → 군중 → 무대 앞(LA 뺌)
    ('video', HG('T2b'), None, None, dict(tin=0.0, tout=1.5, amb=(AMB40('amb_river_1.wav'), 0.0), name='T2bv40')),   # v35: 구조된 상어(어깨빵 콜백)
    ('video', STAGE, None, None, dict(tin=1.71, tout=4.71, name='STAGE')),   # v35: 4.6 → 3.0초(「아이돌 춤 AI 같다」 10-18)   # v20: 마지막 항공샷(163~)은 N3 첫 화면과 같은 그림이라 뺌
    # v34 뺌(무대→건물 비행, STAGE 마지막 아이돌 「저기」 → LB1): ('video', N3, None, None, dict(tin=2.96, tout=204 / 24, name='N3')),        # v26: 건물 앞(204프레임)까지 → LB1 첫 그림(A4a)이 204를 이어받음
    ('video', V33('L1_비행계단문_튐고침.mp4'), None, None, dict(tin=25 / 24, tout=143 / 24, name='LB1')),   # v26: 유리 통과 → 계단 → 문
    ('video', V25L('L2_원래대사.mp4'), None, None, dict(tin=0.0, tout=145 / 24, name='LB2')),       # v26: 입장 → 「어서오세요」 3.54초
    # v34 뺌(「학교!」 판): ('video', V25L('L3a_원래대사.mp4'), None, None, dict(tin=0.0, tout=4.0000, name='LC1')),     # v27: 「학교!」 1.14초(어서오세요 그 선생님·그 방)
    # v34 뺌(관문·몽글(학교 판)): ('video', V25L('L3_원래대사.mp4'), None, None, dict(tin=92 / 24, tout=241 / 24, name='LC')),       # v27: 관문(92프레임) → 몽글
    ('video', V25L('L4a_원래대사.mp4'), None, None, dict(tin=0.0, tout=241 / 24, name='LD1')),      # v26: 「병원!」 0.3초 → 관문 → 「한국 분이세요?」 8.63초
    ('video', V25L('L4b1_네_원래대사.mp4'), None, None, dict(tin=1.6, tout=3.4, name='LD2')),       # v26: 「네.」 2.61초(확정 얼굴 그대로)
    ('video', V25L('L4b_원래대사.mp4'), None, None, dict(tin=80 / 24, tout=123 / 24, name='LD3')),  # v27: 「아, 면접?」 3.86초까지(아치 컷 123프레임부터는 뺌)
    # v34 뺌(아치 걷기 — 「아, 면접?」에서 PATH 아치 와이드로 바로): ('video', V25L('L4c_아치로_4초.mp4'), None, None, dict(tin=0.0, tout=2.7500, name='LD4')),   # v27: 코랄 벽 아치로(마린)
    ('video', V28('P1_원래대사.mp4'), None, None, dict(tin=1.4, tout=111 / 24, tail_x=0.0, name='P1')),     # v28: 아치 → 상담사 → 헤드셋(하얘짐) · v33: 세 조각(같은 원본 이어짐, 소리 겹침 0)
    ('video', V28('P1_원래대사.mp4'), None, None, dict(tin=111 / 24, tout=173 / 24, head_x=0.0, tail_x=0.0, lut=LUT_P1, lut_hq=True, name='P1b')),   # v33: 상담사 컷만 도착 컷 분포에 맞춤
    ('video', V28('P1_원래대사.mp4'), None, None, dict(tin=173 / 24, tout=193 / 24, head_x=0.0, name='P1c')),   # 헤드셋 POV(하얘짐)
    ('video', V28('P2_원래대사.mp4'), None, None, dict(tin=0.0, tout=104 / 24, name='P2')),     # v28: VR 면접 절 → 마린·몽글 끄덕 · v33 전체: 반전 앞(103프레임)까지
    ('video', VRG, None, None, dict(tin=0.0, tout=216 / 24, amb=(AUD33('VR_방소리.wav'), 0.0),
                                    sfx=[('synk-sound-notify.wav', 0.30, -4.0), (AUD33('버저.wav'), 2.08, -6.0),
                                         (AUD33('째깍.wav'), 3.95, 4.0), ('synk-sound-achieve.wav', 5.47, -2.0)],
                                    name='VR')),   # v33 전체: 거짓말 탐지 면접(생성 소리 대신 방소리 + 우리 효과음)
    ('video', V28('P2_원래대사.mp4'), None, None, dict(tin=104 / 24, tout=192 / 24, name='P2b')),   # 라운지 빈 의자 반전
    ('video', V28('P3_원래대사.mp4'), None, None, dict(tin=18 / 24, tout=121 / 24, name='P3')),     # v28: 헤드셋 벗김 → 「진짜는 4층」
    ('video', V28('F1_원래대사.mp4'), None, None, dict(tin=0.8, tout=69 / 24, lut=LUT12, name='F1')),     # v34: 4층 입장(앞) — 면접관 정지 0.96초 뺌
    ('video', V28('F1_원래대사.mp4'), None, None, dict(tin=92 / 24, tout=145 / 24, lut=LUT12, sfx=[('synk-sound-notify.wav', 4.51, -10.0)], name='F1b')),   # v34: 「왜 늦었어요?」 + VR Q카드 알림음 콜백
    ('video', F2_NEW, None, None, dict(tin=F2_TIN, tout=F2_TOUT, lut=LUT12, name='F2v36')) if F2_NEW else
    ('video', V28('F2_원래대사.mp4'), None, None, dict(tin=0.0, tout=70 / 24, lut=LUT12, name='F2')),   # v34: 「…상어가 있어서요.」 뒤 쉼 줄임
    ('video', V28('F2_원래대사.mp4'), None, None, dict(tin=85 / 24, tout=100 / 24, lut=LUT12, name='F2k')),   # v34: 까몽 0.6초(85 = 컷 경계)
    # v34 뺌(「우리 회사가 뭐 하는 회사인지 아세요?」): ('video', V28('F2_원래대사.mp4'), None, None, dict(tin=134 / 24, tout=193 / 24, lut=LUT12, name='F2b')),  # v31: 마린 갸웃 1초 뺌 → 면접관 컷 처음부터     # v28: 「…상어가 있어서요.」 → 마린 갸웃 → 「회사 아세요?」
    # v34 뺌(회사 소개 — 상어 → 수영 잘해요? 바로): ('video', V28('F3_원래대사.mp4'), None, None, dict(tin=0.0, tout=169 / 24, lut=LUT12, name='F3')),     # v28: 회사 소개(손동작 없음)
    ('video', V28('F4_원래대사.mp4'), None, None, dict(tin=0.0, tout=122 / 24, lut=LUT12, name='F4')),     # v28: 「수영 잘해요?」 → 눈 → 마린 → 까몽
    ('video', F5_NEW, None, None, dict(tin=22 / 24, tout=69 / 24, lut=LUT_F5, lut_hq=True, name='F5')),      # v33: 「…아니요.」 얼굴 컷 — 앞 컷 분포에 맞춘 LUT
    ('video', F5_NEW, None, None, dict(tin=69 / 24, tout=121 / 24, lut=LUT12, head_x=0.0,   # v33: 카드 컷(원래 「합격.」은 지움)
                                   sfx=[(LINE_OK, 2.65, 0.0)], name='F5b')),   # v33 전체: 「솔직해서,」는 「아니요」 컷 꼬리에서, 「합격.」은 카드에, 뒤 0.4초 정적
    # v33: F6 「나이쓰!」 뺌(유호님 「나이스 뺄게」) → 카드 컷에서 바로 창밖 OUT
    ('video', V33('OUT_창밖_노을.mp4'), None, None, dict(tin=12 / 24, tout=145 / 24, name='OUT')),   # v33 전체: 유리를 지나 나무로 넘어가는 4.4~4.9초부터 노을 쪽 LUT(E2이륙_노을쪽.cube)로  # v28: 마린 → 창 → 유리 → 까치(끝 = E2 0프레임)
    ('video', V33('E2_이륙_노을.mp4'), None, None, dict(tin=1 / 24, tout=60 / 24, name='E2a')),    # v28: OUT 끝 = E2 0프레임이라 1부터 · v33 전체: 노을 쪽 LUT를 끝까지(반만 데운 E2R은 대낮이 그대로라 버림)
    ('video', FLY, None, None, dict(tin=0.0, tout=66 / 24, lufs=-28.0, name='FLY')),   # v33 전체: 까치 비행(날갯짓 소리는 클립 그대로, 작게)
    ('video', V33('701_까치비행_이어붙임_고침.mp4'), None, None, dict(tin=1 / 24, tout=96 / 24, lufs=-30.0, name='FLY2')),   # v33 전체(10-17 2차): 611 앞 2.75초를 video_extension으로 4초 이어 붙임(0프레임 = FLY 끝과 같은 그림이라 1부터, 복제 프레임 3장 보간)
    ('video', SHARK, None, None, dict(tin=0.0, tout=145 / 24, hold=1.6, amb=(AUD33('상어_가운데.wav'), 0.0), lufs=-27.0,
                                      name='SHARK')),   # v33 전체: 상어 착지 개그 + 마지막 V 포즈 1.6초 정지(그 위로 로고가 겹쳐 나옴)
    ('video', CARD31, None, None, dict(head=0.0, xf=1.2, name='TAIL')),      # v20: 로고 마감 카드(검정에서 떠올랐다 꺼짐)
]

# (원본, 원본 시작 초 또는 None(앞 부분이 멈춘 자리부터), 시작 조각, 그 조각 원본 기준 초, 페이드 인, dB, 끝)
# 끝 = 조각 이름(그 조각 끝까지, 끝 2초 페이드) 또는 (조각 이름, 원본 기준 초, 페이드 아웃 초)
MUSIC = [(STAGE_SRC, 0.3, 'E2a', 1.5, 3.5, -1.0, ('SHARK', 0.5, 0.12)),    # v33 전체: 까치가 앉는 순간 뚝 멈춤
         (STAGE_SRC, 4.55, 'SHARK', 4.3, 0.05, -1.0, ('SHARK', 145 / 24 + 1.6, 1.5))]   # 다시 춤추는 순간 4.55초부터(원곡이 10초라 비행이 길어진 뒤엔 「멈춘 자리부터」가 모자람), 정지 포즈 위로 줄어듦

SUBS = [
    ('S2', 0.0, 1.8, '모델분, 늦으셨네요.'),
    ('S2', 2.1, 5.7, '1F PULSE — 광고와 뮤직비디오, AI 모델을 만듭니다'),
    ('S2', 5.85, 7.0, '이쪽이요.'),
    ('S2', 8.5, 10.6, 'AI 모델은 옷을 안 갈아입어도 돼요.'),
    ('G1', 0.0, 2.0, '수고하셨어요. 4층은 저 계단이요.'),
    ('T1v40', 3.0, 5.5, '2F SYNK SHIFT — 회사에 AI를 붙여 생산성을 극대화시킵니다'),   # v35: v40 원테이크에서 사무실이 드러날 때   # v33 전체: 문을 지나 사무실이 드러날 때
    ('S3C1', 2.65, 3.65, '면접이시죠?'),
    ('S3C1', 3.8, 4.95, '14분 늦으셨네요.'),
    ('A8', 1.17, 3.6, '음.. 커피 어디서 샀어요?'),
    ('N1', 5.3, 6.45, '…모악산 배네치아요.'),
    # v34 뺌(신입사원 자막): ('N2', 1.65, 4.4, '이번에 들어온 신입사원이에요ㅎㅎ'),
    ('S3D', 0.24, 1.95, '4층이에요. 계속 올라가세요.'),
    ('LB2', 0.1, 2.7, '3F LAB — 한국어를 게임하듯 배웁니다'),
    ('LB2', 3.5, 5.8, '어. 서. 오. 세. 요~!'),
    # v34 뺌(학교 자막): ('LC1', 1.14, 3.50, '자, 다음 단어. 학교!'),
    ('LD1', 0.3, 2.45, '한 번 해 보세요. 병원!'),
    ('LD1', 8.63, 9.95, '…한국 분이세요?'),
    ('LD2', 2.6, 3.4, '네.'),
    ('LD3', 3.86, 5.1, '아, 면접?'),
    ('P1', 1.5, 3.9, '3F PATH — 한국 유학부터 취업까지, VR로 미리 연습합니다'),
    ('P1b', 4.70, 7.35, '면접이시죠? 한 번 연습하고 가세요.'),
    ('P2', 1.18, 2.39, '잘 부탁드립니다.'),
    # v33 전체: VR 거짓말 탐지 면접 글자 카드(클립 안 시각, 샷: 0~1.958 와이드 · ~3.75 클로즈업 빨강 · ~5.458 와이드 · ~6.833 클로즈업 노랑 · 와이드 절)
    ('VR', 0.30, 1.95, 'Q. 왜 늦었어요?', 'Q', r'{\pos(540,500)\fad(60,0)\fscx118\fscy118\t(0,150,\fscx100\fscy100)}'),
    ('VR', 0.55, 1.95, '①\\N차가 막혀서요', 'CH', r'{\pos(288,668)\fad(120,0)}'),   # 손가락 끝(370,710)을 피해 위로
    ('VR', 0.62, 1.95, '②\\N상어랑 어깨빵했어요' if F2_NEW else '②\\N상어가 있어서요', 'CH', r'{\pos(737,708)\fad(120,0)}'),
    ('VR', 2.08, 2.17, '', 'FLASH', r'{\pos(0,0)\p1\alpha&H70&}m 0 0 l 1080 0 1080 1920 0 1920{\p0}'),
    ('VR', 2.08, 2.13, '삑! 거짓말 감지', 'BUZZ', r'{\pos(556,1474)\fscx135\fscy135}'),
    ('VR', 2.13, 2.18, '삑! 거짓말 감지', 'BUZZ', r'{\pos(522,1486)\fscx115\fscy115}'),
    ('VR', 2.18, 2.23, '삑! 거짓말 감지', 'BUZZ', r'{\pos(548,1477)\fscx104\fscy104}'),
    ('VR', 2.23, 3.72, '삑! 거짓말 감지', 'BUZZ', r'{\pos(540,1480)}'),
    ('VR', 3.76, 5.43, 'Q. 왜 늦었어요?', 'Q', r'{\pos(540,500)}'),
    ('VR', 3.76, 5.43, '①\\N차가 막혀서요', 'CH', r'{\pos(285,708)\c&H9A9A9A&\s1}'),
    ('VR', 3.76, 5.43, '②\\N상어가 있어서요', 'CH', r'{\pos(735,690)}'),
    ('VR', 5.47, 5.55, '솔직함 +30', 'OK', r'{\pos(540,1480)\fscx130\fscy130\t(0,80,\fscx100\fscy100)}'),
    ('VR', 5.55, 5.63, '솔직함 +70', 'OK', r'{\pos(540,1480)}'),
    ('VR', 5.63, 6.05, '솔직함 +100', 'OK', r'{\pos(540,1480)}'),
    ('VR', 6.05, 7.15, 'PERFECT', 'OK', r'{\pos(540,1480)\fscx135\fscy135\t(0,120,\fscx100\fscy100)\fad(0,300)}'),
    ('P3', 2.71, 4.90, '좋아요. 진짜는 4층이에요.'),
    ('F1', 0.9, 2.85, '4F — 면접실'),
    ('F1b', 4.51, 5.54, 'Q. 왜 늦었어요?', 'Q', r'{\pos(540,1720)\fad(60,150)\fscx118\fscy118\t(0,150,\fscx100\fscy100)}'),   # v33 전체: VR 질문 콜백 — 면접관 얼굴(위쪽)을 피해 이 줄 자막 자리에 같은 카드로
    ('F2v36', 1.55, 3.05, '…상어랑 어깨빵했어요.') if F2_NEW else ('F2', 1.03, 2.06, '…상어가 있어서요.'),   # v36: 말소리 1.70~2.80, 1.5초 보이게
    # v34 뺌(회사 질문 자막): ('F2b', 6.03, 7.85, '우리 회사가 뭐 하는 회사인지 아세요?'),
    # v34 뺌(회사 소개 자막 1): ('F3', 0.30, 4.00, '네. 광고, AI 교육, 한국어 학습,'),
    # v34 뺌(회사 소개 자막 2): ('F3', 4.30, 6.95, '외국인 취업, 그리고 개인화 시스템을 만들어요.'),
    ('F4', 0.03, 2.06, '수영 잘해요?'),
    ('F5', 1.66, 2.56, '…아니요.'),
    ('F5', 2.65, 4.63, '솔직해서, 합격.', 'Default', '', True),   # v33 전체: 목소리와 함께 시작해 카드 컷까지 이어짐(span)
]


def run(args, **kw):
    return subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace', **kw)


def duration(src, stream='v:0'):
    """스트림 길이(영상은 영상 스트림으로 잰다 — 소리가 더 길면 컨테이너 길이로 잡다가 끊긴다)."""
    r = run(['ffprobe', '-v', 'error', '-select_streams', stream, '-show_entries', 'stream=duration', '-of', 'csv=p=0', src]).stdout.strip()
    if not r or r == 'N/A':
        r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).stdout.strip()
    return float(r)


def has_audio(src):
    return 'audio' in run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', src]).stdout


def motion_head(src):
    r = run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src])
    w0, h0 = map(int, r.stdout.strip().split(','))
    w = 160
    h = h0 * w // w0
    h -= h % 2
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-t', '1.0', '-i', src, '-vf', f'scale={w}:{h},format=gray', '-f', 'rawvideo', '-'],
                         stdout=subprocess.PIPE)
    raw = p.stdout.read()
    p.wait()
    n = len(raw) // (w * h)
    fx = np.frombuffer(raw[:n * w * h], np.uint8).reshape(n, h, w).astype(np.float32)
    m = np.abs(np.diff(fx, axis=0)).mean(axis=(1, 2))
    idx = int(np.argmax(m >= MOVE)) if (m >= MOVE).any() else 0
    return idx / FPS


def lufs(src, start=0.0, end=None):
    args = ['ffmpeg', '-v', 'info', '-ss', f'{start:.3f}']
    if end is not None:
        args += ['-to', f'{end:.3f}']
    args += ['-i', src, '-vn', '-af', 'loudnorm=print_format=json', '-f', 'null', '-']
    txt = run(args).stderr
    try:
        v = float(json.loads(txt[txt.rfind('{'):txt.rfind('}') + 1])['input_i'])
    except Exception:
        return None
    return v if v > -70 else None


def ken_burns(still, n, z0, z1, ax, ay, out):
    im = Image.open(still).convert('RGB')
    s = max(W / im.width, H / im.height)
    base = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    bw, bh = base.size
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for k in range(n):
        t = k / max(1, n - 1)
        t = t * t * (3 - 2 * t)
        z = z0 + (z1 - z0) * t
        cw, ch = W / z, H / z
        cx = min(max((bw - W) * ax + W * ax, cw / 2), bw - cw / 2)
        cy = min(max((bh - H) * ay + H * ay, ch / 2), bh - ch / 2)
        fr = base.crop((round(cx - cw / 2), round(cy - ch / 2), round(cx + cw / 2), round(cy + ch / 2))).resize((W, H), Image.LANCZOS)
        p.stdin.write(fr.tobytes())
    p.stdin.close()
    p.wait()



# v36: 480p 원본의 쓰는 구간을 SeedVR2로 키운 판(화면만 갈아 끼움, 소리는 원본에서)
UP_INDEX = os.path.join(HERE, '재촬영_v40', '업스케일', 'v35', '_목록.json')   # 11-07: 배치 33 판. 37장 조각 판(도구/업스케일_v36.py)은 원본에 없는 흐림(S1 10~12번 장)을 만들어 버림
UP = json.load(open(UP_INDEX, encoding='utf-8')) if os.path.exists(UP_INDEX) else []
NO_UP = set(os.environ.get('NO_UP', '').split(',')) - {''}   # 시험용: 이 이름의 조각은 키운 판을 안 씀


def _norm(p):
    return os.path.normcase(os.path.abspath(p))


def up_for(src, head, tail, name=''):
    """src의 [head, tail]을 덮는 키운 판이 있으면 (파일, 그 파일 첫 프레임의 원본 프레임 번호)를 준다."""
    if name in NO_UP:
        return None
    s = _norm(src)
    for e in UP:
        if _norm(e['src']) == s and e['a'] <= head + 1e-6 and tail <= e['b'] + 1e-6 and os.path.exists(e['up']):
            first = int(e.get('first', -1))
            if first < 0:
                first = int(np.ceil(e['a'] * FPS - 1e-6))
            if 'nf' not in e:   # SeedVR2는 끝 프레임 하나를 버릴 때가 있다(11-07 S1: 236 → 235) — 모자라면 원본을 쓴다
                e['nf'] = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-count_packets', '-show_entries',
                                              'stream=nb_read_packets', '-of', 'csv=p=0', e['up']], capture_output=True, text=True).stdout.strip() or 0)
            if round(tail * FPS) - first > e['nf']:
                print(f'  키운 판 프레임 모자람 — 원본 씀: {name} {os.path.basename(e["up"])}')
                return None
            return e['up'], first
    return None

def segment(k, kind, src, dur, opt):
    """조각 하나를 화면(프레임 정확, 소리 없음)과 소리(앞뒤 여유 포함 wav)로 따로 만든다. 같은 입력이면 다시 쓰지 않는다."""
    vout = os.path.join(TMP, f'{k:02d}_{os.path.basename(src)}.mp4')
    aout = vout + '.wav'
    meta_path = vout + '.json'
    amb = opt.get('amb')
    key = json.dumps([kind, src, dur, {a: b for a, b in opt.items() if a not in ('name', 'sfx')}, os.path.getmtime(src),
                      os.path.getmtime(amb[0]) if amb else 0, XA, 'v23', SRC_GAIN.get(amb[0] if amb else src),
                      os.path.getmtime(opt['lut']) if opt.get('lut') else 0, up_for(src, float(opt.get('tin', -1)), float(opt.get('tout', 1e9)), opt.get('name', '')) if 'tin' in opt else None],
                     sort_keys=True, default=str, ensure_ascii=False)
    if os.path.exists(meta_path) and os.path.exists(vout) and os.path.exists(aout):
        meta = json.load(open(meta_path, encoding='utf-8'))
        if meta.get('key') == key:
            return meta | {'cached': True}
    if kind == 'still':
        n = round(dur * FPS)
        z0, z1, ax, ay = opt.get('zoom', (1.0, 1.0, 0.5, 0.5))
        ken_burns(src, n, z0, z1, ax, ay, vout)
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'anullsrc=r=48000:cl=stereo', '-t', f'{n / FPS:.4f}', aout])
        meta = dict(key=key, n=n, head=0.0, hl=0.0, tl=0.0, gain=0.0)
        json.dump(meta, open(meta_path, 'w', encoding='utf-8'))
        return meta
    d0 = duration(src)
    if 'tin' in opt:
        head = float(opt['tin'])
    else:
        hm = opt.get('head', HEAD_MAX)
        head = min(motion_head(src), hm) if hm > 0 else 0.0
    tail = min(float(opt.get('tout', d0)), d0)
    f0 = round(head * FPS)
    n = round(tail * FPS) - f0
    nh = round(float(opt.get('hold', 0.0)) * FPS)
    upr = up_for(src, head, tail, opt.get('name', ''))
    vsrc, vf0 = (upr[0], f0 - upr[1]) if upr else (src, f0)
    vf = f"[0:v]trim=start_frame={vf0}:end_frame={vf0 + n},setpts=PTS-STARTPTS"
    lut_rel = os.path.relpath(opt['lut'], os.getcwd()).replace('\\', '/').replace(':', '\\:') if opt.get('lut') else None
    if lut_rel and not opt.get('lut_hq'):   # v33: 색 LUT(.cube)는 크기 바꾸기 전에
        vf += ",lut3d=file='" + lut_rel + "'"
    vf += f",scale={W}:{H}:flags=lanczos,setsar=1"
    if lut_rel and opt.get('lut_hq'):   # v33 전체(10-18): 키운 뒤 16비트·tetrahedral로 — 480p 8비트에 걸면 피부가 계단처럼 끊겨 수채화처럼 보임
        vf += ",format=gbrp16le,lut3d=file='" + lut_rel + "':interp=tetrahedral,format=yuv420p"
    if nh:
        vf += f",tpad=stop_mode=clone:stop={nh}"
    r = run(['ffmpeg', '-v', 'error', '-y', '-i', vsrc, '-filter_complex', vf + '[v]', '-map', '[v]', '-frames:v', str(n + nh), '-an',
             '-c:v', 'libx264', '-crf', '15', '-preset', 'medium', '-pix_fmt', 'yuv420p', vout])
    if r.returncode:
        raise RuntimeError(r.stderr[-800:])
    total = (n + nh) / FPS
    s0 = f0 / FPS
    # 소리: 원래 소리(또는 바탕 소리 파일)의 같은 구간 + 앞뒤 XA초 여유
    target = float(opt.get('lufs', TARGET_LUFS if not amb else -31.0))
    if amb:
        a_src, a0 = amb[0], float(amb[1])
    elif has_audio(src):
        a_src, a0 = src, s0
    else:
        a_src = None
    if a_src is None:
        run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', f'{total:.4f}', aout])
        hl = tl = gain = 0.0
    else:
        adur = duration(a_src, 'a:0')
        if 'again' in opt:                         # v32: 완성본에서 떼어 온 소리는 음량 그대로
            gain = float(opt['again'])
        elif amb and is_bed(a_src):
            li = lufs(a_src, a0, a0 + max(n / FPS, 1.0))
            gain = max(-20.0, min(20.0, target - li)) if li is not None else 0.0
        else:
            gain = SRC_GAIN.get(a_src, 0.0)
        hl = min(float(opt.get('head_x', XA)), a0)          # head_x·tail_x: 이 조각만 컷 밖 소리를 더 길게(L컷·J컷처럼 겹쳐 잇기)
        tl = max(0.0, min(float(opt.get('tail_x', XA)), adur - (a0 + n / FPS)))
        whole = hl + total + tl
        chain = (f"[0:a]atrim=start={a0 - hl:.4f}:end={a0 + n / FPS + tl:.4f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,"
                 f"{'' if 'again' in opt else 'highpass=f=80,lowpass=f=12000,'}volume={gain:.2f}dB,alimiter=limit=0.89:attack=5:release=60:level=false,"
                 f"apad=whole_dur={whole:.4f},atrim=end={whole:.4f}[a]")
        r = run(['ffmpeg', '-v', 'error', '-y', '-i', a_src, '-filter_complex', chain, '-map', '[a]', '-c:a', 'pcm_s16le', aout])
        if r.returncode:
            raise RuntimeError(r.stderr[-800:])
    meta = dict(key=key, n=n + nh, head=s0, hl=hl, tl=tl, gain=gain)
    json.dump(meta, open(meta_path, 'w', encoding='utf-8'))
    return meta


def is_bed(path):
    return path.lower().endswith('.wav')


# 같은 원본에서 나온 조각은 한 크기로 맞춘다. v16까지는 조각마다 따로 -23에 맞춰 같은 사무실 소리(S3B) 조각끼리 4dB,
# PATH(S6) → N5(S6 소리를 이어 씀)는 15dB씩 들쭉날쭉했다. 원본마다 쓰는 구간 전체(처음~마지막으로 쓰는 자리)의 크기로 한 번 정한다.
# 대사 밑에 까는 바탕 소리 파일(wav, Demucs)은 조각마다 -31.
SRC_SPAN = {}
for _kind, _src, _dur, _cap, _opt in SEQ:
    if _kind != 'video':
        continue
    _amb = _opt.get('amb')
    if _amb and is_bed(_amb[0]):
        continue
    if _amb:
        _len = (float(_opt['tout']) - float(_opt['tin'])) if 'tin' in _opt else duration(_src)
        _p, _lo, _hi = _amb[0], float(_amb[1]), float(_amb[1]) + _len
    else:
        _p, _lo, _hi = _src, float(_opt.get('tin', 0.0)), float(_opt.get('tout', duration(_src)))
    _s = SRC_SPAN.setdefault(_p, [_lo, _hi, float(_opt.get('lufs', TARGET_LUFS))])
    _s[0], _s[1] = min(_s[0], _lo), max(_s[1], _hi)
SRC_GAIN = {}
for _p, (_lo, _hi, _tgt) in SRC_SPAN.items():
    if has_audio(_p):
        _li = lufs(_p, _lo, _hi)
        SRC_GAIN[_p] = max(-12.0, min(12.0, _tgt - _li)) if _li is not None else 0.0

metas = []
for k, (kind, src, dur, cap, opt) in enumerate(SEQ):
    assert os.path.exists(src), src
    m = segment(k, kind, src, dur, opt)
    metas.append(m)
    label = os.path.basename(src) + (f"[{opt['tin']:.2f}~{opt['tout']:.2f}]" if 'tin' in opt else '')
    print(f"{k:02d} {'그대로' if m.get('cached') else '새로'} {label} {m['n']}프레임 소리 여유 앞 {m['hl']:.2f} 뒤 {m['tl']:.2f} 음량 {m['gain']:+.1f}dB"
          + (' (바탕 소리)' if opt.get('amb') else ''))

tags = [opt.get('name', '') for (_, _, _, _, opt) in SEQ]
lens = [m['n'] / FPS for m in metas]
heads = [m['head'] for m in metas]
starts = []
t = 0.0
for k in range(len(SEQ)):
    if k == len(SEQ) - 1:
        t -= float(SEQ[k][4].get('xf', 0.0))   # 끝 검은 화면만 겹쳐 서서히
    starts.append(t)
    t += lens[k]
TOTAL = t
TAIL_XF = float(SEQ[-1][4].get('xf', 0.0))


def ass_time(x):
    x = max(0.0, x)
    return f'{int(x // 3600)}:{int(x % 3600 // 60):02d}:{x % 60:05.2f}'


font_dir = os.path.join(TMP, 'fonts')
os.makedirs(font_dir, exist_ok=True)
shutil.copy(os.path.join(FONT, 'SUIT', 'SUIT-Medium.otf'), os.path.join(font_dir, 'SUIT-Medium.otf'))
shutil.copy('C:/Windows/Fonts/batang.ttc', os.path.join(font_dir, 'batang.ttc'))
for _f in ('SUIT-ExtraBold.otf', 'SUIT-Heavy.otf'):   # v33 전체: VR 글자 카드
    shutil.copy(os.path.join(FONT, 'SUIT', _f), os.path.join(font_dir, _f))
style_line = 'Style: Default,Gungsuh,54,&H0000F2FF,&H0000F2FF,&H00000000,&H80000000,0,0,0,0,100,100,1,0,1,2.5,1.5,2,90,90,170,1'
# v33 전체: VR 게임 카드. BorderStyle 3은 OutlineColour로 상자를 칠한다(Outline = 상자 여백).
card_styles = ['Style: Q,SUIT ExtraBold,60,&H00FFFFFF,&H00FFFFFF,&H00241A14,&H00000000,0,0,0,0,100,100,0,0,3,16,0,5,0,0,0,1',
               'Style: CH,SUIT ExtraBold,40,&H005A2A1E,&H005A2A1E,&H00FFFFFF,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1',
               'Style: BUZZ,SUIT Heavy,72,&H00FFFFFF,&H00FFFFFF,&H002D32E5,&H00000000,0,0,0,0,100,100,0,0,3,18,0,5,0,0,0,1',
               'Style: OK,SUIT Heavy,70,&H00241A14,&H00241A14,&H003FD2FF,&H00000000,0,0,0,0,100,100,0,0,3,18,0,5,0,0,0,1',
               'Style: FLASH,Arial,20,&H002D32E5,&H002D32E5,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1']
lines = ['[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
         '[V4+ Styles]',
         'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, '
         'ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
         style_line, *card_styles, '',
         '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text']
sub_report = []
for ent in SUBS:
    tag, t0, t1, text = ent[:4]
    style = ent[4] if len(ent) > 4 else 'Default'
    pre = ent[5] if len(ent) > 5 else ''
    span = ent[6] if len(ent) > 6 else False   # v33 전체: True면 조각 끝에서 자르지 않음(같은 원본이 이어지는 다음 조각까지)
    ks = [k for k, g in enumerate(tags) if g == tag]
    if not ks:
        sub_report.append(f'  ! 이름표 없음 {tag}: {text}')
        continue
    k = ks[0]
    lo, hi = heads[k], heads[k] + lens[k]
    if t0 < lo - 0.05 or t0 > hi:
        sub_report.append(f'  ! 클립 밖 {tag} {t0:.2f}: {text}')
        continue
    g0 = starts[k] + (t0 - lo)
    g1 = starts[k] + (t1 - lo) if span else min(starts[k] + (t1 - lo), starts[k] + lens[k])
    layer = 0 if style == 'Default' else (1 if style == 'FLASH' else 2)
    lines.append(f'Dialogue: {layer},{ass_time(g0)},{ass_time(g1)},{style},,0,0,0,,{pre}{text}')
    sub_report.append(f'  {g0:7.2f}~{g1:7.2f}  {style:5s} {text}')
ass_path = os.path.join(TMP, 'subs.ass')
with open(ass_path, 'w', encoding='utf-8-sig') as f:
    f.write('\n'.join(lines) + '\n')

# 화면: 끝 검은 화면 앞까지는 프레임 그대로 이어 붙이고(겹침 없음), 끝만 1.2초 서서히
cut_list = os.path.join(TMP, 'cut_list.txt')
with open(cut_list, 'w', encoding='utf-8') as f:
    for k in range(len(SEQ) - 1):
        f.write(f"file '{os.path.join(TMP, f'{k:02d}_{os.path.basename(SEQ[k][1])}.mp4')}'\n")
body = os.path.join(TMP, 'body.mp4')
r = run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', cut_list, '-c', 'copy', body])
assert r.returncode == 0, r.stderr[-800:]
LB = sum(lens[:-1])

# 바탕(아주 작은 분홍 잡음)
bed = os.path.join(TMP, 'bed.wav')
raw_bed = os.path.join(TMP, 'bed_raw.wav')
run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'anoisesrc=color=pink:amplitude=0.05:seed=7:duration={TOTAL + 1:.2f}:sample_rate=48000',
     '-af', 'lowpass=f=500,lowpass=f=500,aformat=channel_layouts=stereo', raw_bed])
lb = lufs(raw_bed)
run(['ffmpeg', '-v', 'error', '-y', '-i', raw_bed, '-af', f'volume={BED_LUFS - (lb if lb is not None else -30):.2f}dB,afade=t=in:st=0:d=1.5,afade=t=out:st={TOTAL - 4.5:.2f}:d=3', bed])

SR = 48000


def read_wav(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def env_db(a, s, e):
    """20ms 창마다 소리 크기(dB)."""
    s, e = max(0, int(s)), min(len(a), int(e))
    w = SR // 50
    n = (e - s) // w
    if n <= 0:
        return np.array([-120.0])
    seg = a[s:s + n * w].mean(axis=1).reshape(n, w)
    return 20 * np.log10(np.sqrt((seg ** 2).mean(axis=1)) + 1e-9)


# 틈 메우기: 원본 클립 소리의 앞머리·끝이 0.1~0.6초 조용하면(Seedance 클립에 흔함) 컷에서 바탕 소리가 뚝 끊긴 것처럼 들린다.
# - 뒤 클립 앞머리가 조용하면: 앞 클립의 조용한 꼬리는 잘라 내고, 그 앞 고른 바탕 소리를 거꾸로 이어(거울) 뒤 클립 소리가 나올 때까지 늘린다.
# - 앞 클립 끝이 조용하면: 뒤 클립의 조용한 앞머리는 잘라 내고, 그 뒤 고른 바탕 소리를 거꾸로 붙여 앞 클립이 조용해지는 자리부터 당겨 온다.
# 거울로 쓸 0.5초가 말소리처럼 출렁이면(10~90% 폭 12dB 넘게) 하지 않는다. 조용함 = 그 클립 평소 크기보다 10dB 넘게 작음.
# v18: 메우는 소리는 거울(뒤집기)이 아니라 그 클립 끝(앞) 3초 안에서 말소리 없는 가장 고른 구간(방 소리)을 그대로 옮겨 쓴다.
#   v17은 바로 옆 0.5초를 뒤집어 붙여, 그 0.5초가 말끝이면 말이 거꾸로 이어졌다(「…늦으셨네요」 뒤 「하이에나」, 10-12 유호님 지적).
arrs = [read_wav(os.path.join(TMP, f'{k:02d}_{os.path.basename(SEQ[k][1])}.mp4.wav')) for k in range(len(SEQ))]
cut_h = [0.0] * len(SEQ)   # 앞에서 잘라 낸 길이(초)
ext_h = [0.0] * len(SEQ)   # 앞에 거울로 붙인 길이
cut_t = [0.0] * len(SEQ)   # 끝에서 잘라 낸 길이
ext_t = [0.0] * len(SEQ)   # 끝에 거울로 붙인 길이
onset_b = {}               # 앞 소리를 이어 쓴 컷: 뒤 클립 소리가 실제로 나오는 시각(컷 기준)
quiet_a = {}               # 뒤 소리를 당겨 쓴 컷: 앞 클립이 조용해지는 시각(컷 기준)
fill_report = []
self_h, self_t = set(), set()   # 제 소리로 메운 앞머리·끝(이웃이 없어 방 소리를 못 찾으면 메우지 않는다)


def quiet_run(e, ref):
    """e(창 크기 목록)의 맨 앞부터 ref-10dB 아래로 이어지는 창 수."""
    above = e >= ref - 10
    return int(np.argmax(above)) if above.any() else len(e)


def spread(e):
    return float(np.percentile(e, 90) - np.percentile(e, 10)) if len(e) > 3 else 99.0


for k in range(1, len(SEQ) - 1):
    A, B = arrs[k - 1], arrs[k]
    mA, mB = metas[k - 1], metas[k]
    eB = env_db(B, 0, 2.0 * SR)                      # 뒤 클립 소리 시작부터
    refB = float(np.median(eB[15:])) if len(eB) > 25 else float(np.median(eB))
    gi = quiet_run(eB, refB)
    eA = env_db(A, len(A) - 2.0 * SR, len(A))[::-1]   # 앞 클립 소리 끝부터 거꾸로
    refA = float(np.median(eA[15:])) if len(eA) > 25 else float(np.median(eA))
    ui = quiet_run(eA, refA)
    bodyA, bodyB = eA[ui:ui + 25], eB[gi:gi + 25]
    gB, uA = gi * 0.02, ui * 0.02
    if gB >= 0.08 and len(bodyA) > 5 and np.median(bodyA) - np.median(eB[:max(1, gi)]) >= 8 and spread(bodyA) < 12:
        a_end_rel = mA['tl'] - uA                       # 꼬리를 자른 뒤 앞 소리 끝(컷 기준)
        need = -mB['hl'] + gB + 0.1                     # 뒤 클립 소리가 나오는 자리 + 0.1초
        ext = need - a_end_rel
        if ext > 0.02:
            cut_t[k - 1], ext_t[k - 1] = uA, min(0.8, ext)
            onset_b[k] = -mB['hl'] + gB
            fill_report.append(f'  {starts[k]:7.2f}  {tags[k]} 앞머리 {gB:.2f}초 조용 → {tags[k - 1]} 바탕 소리를 {ext_t[k - 1]:.2f}초 이어 씀')
            continue
    if uA >= 0.08 and len(bodyB) > 5 and np.median(bodyB) - np.median(eA[:max(1, ui)]) >= 8 and spread(bodyB) < 12:
        b_start_rel = -mB['hl'] + gB                    # 앞머리를 자른 뒤 뒤 소리 시작(컷 기준)
        need = mA['tl'] - uA - 0.1                      # 앞 클립이 조용해지는 자리 - 0.1초
        ext = b_start_rel - need
        if ext > 0.02:
            cut_h[k], ext_h[k] = gB, min(0.8, ext)
            quiet_a[k] = mA['tl'] - uA
            fill_report.append(f'  {starts[k]:7.2f}  {tags[k - 1]} 끝 {uA:.2f}초 조용 → {tags[k]} 바탕 소리를 {ext_h[k]:.2f}초 당겨 씀')
            continue
    # 소리 파일이 영상보다 짧아 생긴 완전 무음(-90dB 아래)은 무조건 제 소리 거울로 메운다(10-12 E1 끝 0.08초)
    dsA = int(np.argmax(eA >= -90)) if (eA >= -90).any() else 0
    dsB = int(np.argmax(eB >= -90)) if (eB >= -90).any() else 0
    if dsA and not cut_t[k - 1]:
        cut_t[k - 1] = ext_t[k - 1] = dsA * 0.02
        fill_report.append(f'  {starts[k]:7.2f}  {tags[k - 1]} 끝 {dsA * 0.02:.2f}초 무음 → 제 소리로 메움')
    if dsB and not cut_h[k]:
        cut_h[k] = ext_h[k] = dsB * 0.02
        fill_report.append(f'  {starts[k]:7.2f}  {tags[k]} 앞머리 {dsB * 0.02:.2f}초 무음 → 제 소리로 메움')
    # 이웃 소리가 말소리라 못 메우면 제 소리로: 조용한 앞머리(끝)를 그 클립 방 소리로 바꾼다(소리 길이·자리는 그대로)
    if gB >= 0.06 and not cut_h[k] and len(bodyB) > 5 and np.median(bodyB) - np.median(eB[:max(1, gi)]) >= 8:
        cut_h[k] = ext_h[k] = gB
        self_h.add(k)
        fill_report.append(f'  {starts[k]:7.2f}  {tags[k]} 앞머리 {gB:.2f}초 조용 → 제 방 소리로 메움')
    if uA >= 0.06 and not cut_t[k - 1] and len(bodyA) > 5 and np.median(bodyA) - np.median(eA[:max(1, ui)]) >= 8:
        cut_t[k - 1] = ext_t[k - 1] = uA
        self_t.add(k - 1)
        fill_report.append(f'  {starts[k]:7.2f}  {tags[k - 1]} 끝 {uA:.2f}초 조용 → 제 방 소리로 메움')


def tone_window(a, L, lo, hi):
    """a[lo:hi](샘플) 안에서 길이 L창(20ms)인 가장 고른 방 소리 구간의 시작 샘플. 말소리(출렁임 6dB 넘게)·무음은 뺀다."""
    w = SR // 50
    e = env_db(a, lo, hi)
    ok = e[e > -80]
    if len(ok) < L:
        return None
    ref = float(np.median(ok))
    best = None
    for i in range(0, len(e) - L + 1):
        seg = e[i:i + L]
        if seg.min() < -70 or seg.mean() < ref - 18:
            continue
        if float(np.percentile(seg, 90) - np.percentile(seg, 10)) > 6:
            continue
        key = float(np.percentile(seg, 90))
        if best is None or key < best[0]:
            best = (key, i)
    return None if best is None else lo + best[1] * w


def room_tone(a, n, lo, hi):
    """n샘플짜리 방 소리. 긴 구간이 없으면 0.4초·0.2초 조각을 10ms씩 겹쳐 이어 붙인다. 없으면 None."""
    w = SR // 50
    x = SR // 100
    for L in (max(2, int(np.ceil(n / w))), 20, 10):
        s0 = tone_window(a, L, lo, hi)
        if s0 is not None:
            piece = a[s0:s0 + L * w].copy()
            break
    else:
        return None
    fo = np.cos(np.linspace(0, np.pi / 2, x))[:, None]
    fi = np.sin(np.linspace(0, np.pi / 2, x))[:, None]
    out = piece
    while len(out) < n:
        out = np.concatenate([out[:-x], out[-x:] * fo + piece[:x] * fi, piece[x:]])
    return out[:n]


tone_report = []
for k in range(len(SEQ)):
    if not (cut_h[k] or ext_h[k] or cut_t[k] or ext_t[k]):
        continue
    a = arrs[k]
    i0, i1 = int(cut_h[k] * SR), len(a) - int(cut_t[k] * SR)
    core = a[i0:i1]
    nh, nt = int(ext_h[k] * SR), int(ext_t[k] * SR)
    x = SR // 100
    fo = np.cos(np.linspace(0, np.pi / 2, x))[:, None]
    fi = np.sin(np.linspace(0, np.pi / 2, x))[:, None]
    if nh:
        tone = room_tone(a, nh + x, i0, min(len(a), i0 + 3 * SR))
        if tone is None and k in self_h:
            tone_report.append(f'  {tags[k]} 앞머리: 방 소리를 못 찾아 메우지 않음')
            core, nh = a[:i1], 0
            ext_h[k] = cut_h[k] = 0.0
        elif tone is None:
            tone_report.append(f'  {tags[k]} 앞머리: 방 소리를 못 찾아 거울(v17 방식)')
            core = np.concatenate([core[:nh][::-1], core])
        else:
            core = np.concatenate([tone[:nh], tone[nh:] * fo + core[:x] * fi, core[x:]])
    if nt:
        tone = room_tone(a, nt + x, max(0, i1 - 3 * SR), i1)
        if tone is None and k in self_t:
            tone_report.append(f'  {tags[k]} 끝: 방 소리를 못 찾아 메우지 않음')
            core = np.concatenate([core, a[i1:]])
            ext_t[k] = cut_t[k] = 0.0
        elif tone is None:
            tone_report.append(f'  {tags[k]} 끝: 방 소리를 못 찾아 거울(v17 방식)')
            core = np.concatenate([core, core[len(core) - nt:][::-1]])
        else:
            core = np.concatenate([core[:-x], core[-x:] * fo + tone[:x] * fi, tone[x:]])
    arrs[k] = core
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le',
                    os.path.join(TMP, f'{k:02d}_틈메움.wav')], input=arrs[k].astype(np.float32).tobytes(), check=True)
HL = [metas[k]['hl'] - cut_h[k] + ext_h[k] for k in range(len(SEQ))]   # 컷 앞으로 나간 소리 길이
TL = [metas[k]['tl'] - cut_t[k] + ext_t[k] for k in range(len(SEQ))]   # 컷 뒤로 나간 소리 길이

inputs = ['-i', body, '-i', os.path.join(TMP, f'{len(SEQ) - 1:02d}_{os.path.basename(SEQ[-1][1])}.mp4'), '-i', bed]
rel_ass = os.path.relpath(ass_path, os.getcwd()).replace('\\', '/')
rel_fonts = os.path.relpath(font_dir, os.getcwd()).replace('\\', '/')
fc = ["[0:v]settb=AVTB,setpts=PTS-STARTPTS[vb]", "[1:v]settb=AVTB,setpts=PTS-STARTPTS[vt]",
      f"[vb][vt]xfade=transition=fade:duration={TAIL_XF:.3f}:offset={LB - TAIL_XF:.4f}[vx]",
      f"[vx]subtitles=filename='{rel_ass}':fontsdir='{rel_fonts}'[vs]",
      "[2:a]aformat=channel_layouts=stereo[bed]"]
labels = ['[bed]']
seam_report = []
FADES = {}
for k, m in enumerate(metas):
    idx = len(inputs) // 2
    filled = cut_h[k] or ext_h[k] or cut_t[k] or ext_t[k]
    inputs += ['-i', os.path.join(TMP, f'{k:02d}_틈메움.wav') if filled else os.path.join(TMP, f'{k:02d}_{os.path.basename(SEQ[k][1])}.mp4.wav')]
    alen = HL[k] + lens[k] + TL[k]
    a_start = starts[k] - HL[k]               # 이 소리가 놓이는 자리
    a_end = a_start + alen
    # 커지는 구간: 이 소리 시작 ~ 앞 클립 소리 끝(앞 소리를 이어 쓴 컷이면 이 클립 소리가 실제로 나오기 0.02초 전까지)
    # 줄어드는 구간: 뒤 클립 소리 시작(뒤 소리를 당겨 쓴 컷이면 이 클립이 조용해지는 자리) ~ 이 소리 끝
    # 둘 다 여유가 없으면 0.01초로 바로 잇는다(줄였다 키우면 그 사이가 비어 움푹 꺼진다 — v17a 첫 측정 46.58초 21.7dB).
    if k == 0:
        fin = EDGE
    else:
        prev_end = starts[k] + TL[k - 1]
        if k in onset_b:
            prev_end = min(prev_end, starts[k] + onset_b[k] - 0.02)
        fin = max(EDGE, prev_end - a_start)
    if k == len(SEQ) - 1:
        fout = EDGE
    elif k == len(SEQ) - 2 and TAIL_XF > 0:
        fout = TAIL_XF                      # 끝 검은 화면으로 서서히 넘어가는 동안 함께 줄인다
    else:
        next_start = starts[k + 1] - HL[k + 1]
        if (k + 1) in quiet_a:
            next_start = max(next_start, starts[k + 1] + quiet_a[k + 1])
        fout = max(EDGE, a_end - next_start)
    fin, fout = min(fin, alen / 2), min(fout, alen / 2)
    FADES[k] = (a_start, alen, fin, fout)
    ms = int(round(a_start * 1000))
    fc.append(f"[{idx}:a]aformat=channel_layouts=stereo,afade=t=in:st=0:d={fin:.3f}:curve=qsin,"
              f"afade=t=out:st={max(0.0, alen - fout):.4f}:d={fout:.3f}:curve=qsin,adelay={ms}|{ms}[c{k}]")
    labels.append(f'[c{k}]')
    if k:
        seam_report.append(f'  {starts[k]:7.2f}  {tags[k - 1]} → {tags[k]}  겹쳐 잇기 {fin:.2f}초')
sfx_report = []
for k, (kind, src, dur, cap, opt) in enumerate(SEQ):
    for wav, tt, gdb in opt.get('sfx', []):
        at = starts[k] + (tt - heads[k])
        idx = len(inputs) // 2
        inputs += ['-i', SND(wav)]
        ms = int(round(at * 1000))
        fc.append(f"[{idx}:a]aresample=48000,aformat=channel_layouts=stereo,volume={gdb:.1f}dB,adelay={ms}|{ms}[s{idx}]")
        labels.append(f'[s{idx}]')
        sfx_report.append(f'  {at:7.2f}  {os.path.basename(wav)} {gdb:+.0f}dB')
music_report = []
m_parts = []
m_next = {}   # 원본마다 앞 부분이 멈춘 자리(m_t0=None이면 거기부터)
for src_m, m_t0, tag, lt, fin, gdb, end in MUSIC:
    k = tags.index(tag)
    g0 = starts[k] + (lt - heads[k])
    if isinstance(end, tuple):   # v33 전체: (조각, 원본 기준 초, 페이드 아웃)
        k2 = tags.index(end[0])
        g1, fout_m = starts[k2] + (end[1] - heads[k2]), end[2]
    else:
        k2 = tags.index(end)
        g1, fout_m = starts[k2] + lens[k2], 2.0
    if m_t0 is None:
        m_t0 = m_next[src_m]
    dur = g1 - g0
    m_next[src_m] = m_t0 + dur
    m_parts.append((src_m, m_t0, g0, g1, dur, fin, fout_m, gdb))
m_gain = {}   # v33 전체: 같은 원본은 쓰는 구간 전체 크기로 한 번만 맞춘다(멈췄다 다시 나올 때 크기가 튀지 않게)
for src_m in {p[0] for p in m_parts}:
    lo = min(p[1] for p in m_parts if p[0] == src_m)
    hi = max(p[1] + p[4] for p in m_parts if p[0] == src_m)
    li = lufs(src_m, lo, hi)
    m_gain[src_m] = -21.0 - li if li is not None else 0.0
for src_m, m_t0, g0, g1, dur, fin, fout_m, gdb in m_parts:
    gain = m_gain[src_m] + gdb
    idx = len(inputs) // 2
    inputs += ['-i', src_m]
    ms = int(round(g0 * 1000))
    fc.append(f"[{idx}:a]atrim=start={m_t0:.3f}:duration={dur:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,"
              f"volume={gain:.2f}dB,afade=t=in:st=0:d={fin:.2f},afade=t=out:st={max(0.0, dur - fout_m):.3f}:d={fout_m:.2f},adelay={ms}|{ms}[m{idx}]")
    labels.append(f'[m{idx}]')
    music_report.append(f'  {g0:7.2f}~{g1:7.2f}  노래 {os.path.basename(src_m)} {m_t0:.2f}초부터 {gain:+.1f}dB')
fc.append(''.join(labels) + f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0,alimiter=limit=0.89:attack=5:release=60:level=false,"
          f"afade=t=out:st={TOTAL - 1.5:.2f}:d=1.5[amix]")
# v32: again 조각(2A~N1)은 v31 완성본에서 떼어 온 소리라 v31의 바탕 잡음(bed)이 같은 자리에 이미 들어 있다.
# 그 구간에서는 bed를 떼어 온 소리가 커지고 줄어드는 만큼(qsin) 거꾸로 줄여 bed가 한 번만 남게 한다(안 하면 조용한 데서 +5.5dB).
MIXK = [k for k in range(len(SEQ)) if 'again' in SEQ[k][4]]
if MIXK:
    bw = read_wav(bed)
    tt = np.arange(len(bw)) / SR
    g = np.ones(len(bw), np.float32)
    s0, _, fi0, _ = FADES[MIXK[0]]
    s1, l1, _, fo1 = FADES[MIXK[-1]]
    e1 = s1 + l1
    g[(tt >= s0) & (tt < e1)] = 0.0
    m = (tt >= s0) & (tt < s0 + fi0)
    g[m] = 1 - np.sin((tt[m] - s0) / fi0 * np.pi / 2)
    m = (tt >= e1 - fo1) & (tt < e1)
    g[m] = 1 - np.sin((e1 - tt[m]) / fo1 * np.pi / 2)
    bed2 = os.path.join(TMP, 'bed_v31구간뺌.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s16le', bed2],
                   input=(bw * g[:, None]).astype(np.float32).tobytes(), check=True)
    inputs[inputs.index(bed)] = bed2
    print(f'bed: {s0:.3f}~{e1:.3f}초는 떼어 온 v31 소리의 bed를 씀(들어올 때 {fi0:.2f}초, 나갈 때 {fo1:.2f}초 맞물림)')
args = ['ffmpeg', '-v', 'error', '-y'] + inputs + ['-filter_complex', ';'.join(fc), '-map', '[vs]', '-map', '[amix]',
                                                   '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p',
                                                   '-c:a', 'pcm_s24le', '-t', f'{TOTAL:.4f}', OUT + '.pre.mov']
r = run(args)
if r.returncode == 0:   # v36 마감 음량: 통합 −14 LUFS · 참 첨두 −1.5 dBTP
    # ① loudnorm 두 번 재기(입력 −23.7 · 첨두 −1.0이라 선형으론 못 가고 동적으로 −14.7 안팎) → PCM
    # ② 남은 차이만 올리고 4배 오버샘플 리미터(−1.8 dBFS)로 첨두만 누른다 → AAC. 11-07 시험 렌더에서 ①만으로는 −14.7이었다.
    import re as _re
    PRE, ST1 = OUT + '.pre.mov', OUT + '.st1.wav'

    def _meas(path, af=''):
        m = run(['ffmpeg', '-v', 'info', '-i', path, '-vn', '-af', (af + ',' if af else '') + 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json',
                 '-f', 'null', '-'])
        return json.loads(_re.findall(r'\{[^{}]*\}', m.stderr)[-1])
    js = _meas(PRE)
    ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:"
          f"measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
    r = run(['ffmpeg', '-v', 'error', '-y', '-i', PRE, '-vn', '-af', ln + ',aresample=48000', '-c:a', 'pcm_s24le', ST1])
    j2 = _meas(ST1)
    # ② AAC 인코딩에서 첨두가 1.4dB쯤 오른다(11-07 첫 판 −1.8 dBFS 한도 → −0.41 dBTP) — 인코딩한 판을 다시 재며 한도 · 이득을 고친다
    g, lim, hist = -14.0 - float(j2['input_i']), -2.5, []
    for _ in range(4):
        af2 = f"volume={g:.2f}dB,aresample=192000,alimiter=limit={10 ** (lim / 20):.4f}:attack=1:release=50:level=false,aresample=48000"
        r = run(['ffmpeg', '-v', 'error', '-y', '-i', PRE, '-i', ST1, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', af2,
                 '-c:a', 'aac', '-b:a', '192k', '-t', f'{TOTAL:.4f}', OUT])
        j3 = _meas(OUT)
        oi, otp = float(j3['input_i']), float(j3['input_tp'])
        hist.append(f'{g:+.2f}dB · 한도 {lim:.1f} → {oi:.2f} LUFS · {otp:.2f} dBTP')
        if abs(oi + 14.0) <= 0.15 and otp <= -1.5:
            break
        if otp > -1.5:
            lim -= otp + 1.5 + 0.2
        g += -14.0 - oi
    print(f"마감 음량: 맞춤 전 {js['input_i']} LUFS · {js['input_tp']} dBTP → ① {j2['input_i']} LUFS · {j2['input_tp']} dBTP → ② "
          + ' / '.join(hist) + f" · LRA {j3['input_lra']}")
    if r.returncode == 0:
        os.remove(PRE)
        os.remove(ST1)
print('러프컷', 'OK' if r.returncode == 0 else r.stderr[-1500:], f'예상 길이 {TOTAL:.3f}초({round(TOTAL * FPS)}프레임), 자막 {sum(1 for s in sub_report if not s.lstrip().startswith("!"))}줄')
for k, s in enumerate(starts):
    print(f'  {s:7.2f}  {tags[k]}  {os.path.basename(SEQ[k][1])}')
print('이음(소리 교차)')
print('\n'.join(seam_report))
print('틈 메우기')
print('\n'.join(fill_report) or '  없음')
print('\n'.join(tone_report) or '  (모두 방 소리로 메움)')
print('자막')
print('\n'.join(sub_report))
print('효과음')
print('\n'.join(sfx_report))
print('노래')
print('\n'.join(music_report))
