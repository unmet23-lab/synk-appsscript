# -*- coding: utf-8 -*-
"""Write report_template.md (placeholders {{NAME}} are filled by build_report.py)."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import BASE  # noqa: E402

TEMPLATE = r'''# 스팀 생활형 게임 태그 전수 크롤링 — 후보군과 지표

> 수집: **2026-10-21 21:01~21:56 KST** · 싱크 타운 벤치마킹용 정량 조사(리뷰 본문 분석은 별도 조사 범위)
> 이어받은 방식: 저장소 `docs/디자인/싱크타운_Steam생활게임_TOP10_조사_20261008.md`의 Wilson 95% 하한(z=1.96)·필터·수집 시각 기록. 이번에는 「선정 후보 24개」가 아니라 **태그 기준 합집합 전부**를 훑었다.
> 데이터: `steam_life_universe.json`(25,148개 전부) · `steam_life_universe.csv`(본 목록: 생활 500개 이상 + 언어 100개 이상) · `steam_life_universe_all.csv`(전부) · 원자료 `raw/` · 스크립트 `scripts/` · 표 원본 `report_tables.md` · 범위 숫자 `report_stats.json`

## 0. 한눈에

- **훑은 범위:** Steam 상점 검색에서 생활형 핵심 태그 17개의 합집합, 넓은 태그는 교집합 조건(24개 질의)으로만, 언어·교육 태그 6개, 분류 확인용 교집합 23개 — 질의 70개, 검색 결과 **849쪽**(점수 정렬 530쪽 + 출시순 319쪽). 고유 게임 **25,148개**(리뷰 점수가 있는 게임 17,341 + 점수 없는 출시작 7,807).
- **본 목록:** 누적 리뷰 500개 이상 생활형 **2,970개**, 언어·교육 100개 이상 **1,089개**. 그중 성인 표시·도구·장르가 다른 게임(태그만 걸린 FPS·공포 등)을 빼고 순위에 올린 생활형은 1,544개(1,000개 이상 1,026개), 언어·교육은 564개.
- **판도:** 규모와 평가를 함께 갖춘 축은 여전히 Stardew Valley(1,046,237개·98.46%)와 RimWorld(248,528개·97.80%)다. Wilson 상위는 리뷰 1천~3만 개 규모의 작은 고평가작이 채웠다. 특히 **손님 취향을 듣고 만들어 주는 가게**(Creature Kitchen 99.48%, Papa's Freezeria Deluxe 99.09%, Touhou Mystia's Izakaya 98.43%)와 **켜 두는 작업 동반**(Chill with You 98.02%, Spirit City 97.34%, Bongo Cat 113,033개)이 2024~26년에 크게 늘었다.
- **10-08과 달라진 점:** 기본 경로를 Steam 구매(purchase_type=steam)에서 전체(all)로 바꾸자 무료 전환작의 숫자가 크게 바뀌었다(The Sims 4 83,367→201,649, Palia 59→44,832). 10-08 TOP10은 이번 1,000개 이상 생활형 순위에서 Stardew 16위·Slime Rancher 38위·Fields of Mistria 95위였고 나머지는 100위 밖이다(평가가 떨어진 것이 아니라 비교 대상이 1,026개로 넓어졌다).
- **비어 있는 자리:** 채팅 없는 비동기 온기 분야는 26개뿐이고, 온기를 주고받는 큰 사례는 Kind Words(8,977개·97.73%)가 사실상 유일하다(나머지는 1~3천 개 규모이거나 비동기 대전). 한국어를 가르치는 Steam 게임은 리뷰 100개를 넘는 것이 없다(Let's Learn Korean! Hangul ≈84개). 언어 쪽에서 크게 팔린 게임은 가르치는 앱이 아니라 **해독·소통 자체가 재미인 게임**(Chants of Sennaar ≈31,243개)이다.
- **이번에 못 한 것:** 수집을 멈춘 시점 기준이다. 뒤에 더한 질의에서 들어온 생활형 1,000개·언어 2,066개는 누적 리뷰를 받지 못해 상점 표시값으로 근사했고(표의 ‡), 10-08 TOP10의 Steam 구매 경로 재수집·appdetails·리뷰 히스토그램은 하지 않았다(§1.4).

## 1. 수집 범위와 방법

### 1.1 태그 선택 — 어느 태그를 합집합에, 어느 태그를 교집합에만

태그 목록은 `tagdata/populartags/english`(429개)와 `IStoreService/GetTagList`(446개)로 확인했다. 검색의 `tags=a,b`는 **교집합**이다(Life Sim 2,686개 ∩ Building → 645개, 순서를 바꿔도 같음). 게임마다 사용자 태그 상위 20개가 검색에 쓰인다(Stardew는 20번째 태그 Fishing으로 낚시 질의에도 들어옴).

**U1 — 합집합(태그가 붙은 게임 전부, 17개).** 생활 그 자체를 가리키는 태그만 넣었다. 수는 이번 수집 시각의 검색 총수다(앞 세 열은 성인 숨김 해제·미국 지역, 마지막 열은 한국 기본 노출).

{{Q_U1}}

**U2 — 교집합 조건으로만(22개 + 보강 2개).** 동물 태그는 Simulation과, 짓기·경영·방치 태그는 Relaxing과 함께 붙을 때만 넣었다. Asynchronous Multiplayer는 「비동기 온기」 분야를 보려고 작게나마 통째로 넣었다. **Cute ∩ Simulation·City Builder ∩ Cute는 10-08 후보를 맞춰 본 뒤 더했다** — Slime Rancher(태그: Cute·Exploration·Adventure…)와 FANTASY LIFE i(RPG·JRPG·City Builder…)가 처음 질의 어디에도 걸리지 않았기 때문이다.

{{Q_U2}}

**L·L2 — 언어·교육(합집합, 기준 100개).** Typing·Trivia는 L2로 따로 표시했다.

{{Q_L}}

**합집합에 넣지 않은 넓은 태그와 이유.** Management(5,134)·Sandbox(5,127)·Story Rich(14,350)·Relaxing(9,522)·Cute(13,031)·Choices Matter(6,248)·Family Friendly(8,106)·Simulation(18,108)·Casual(30,991)은 생활형이 아닌 게임이 대부분이라 위 교집합이나 분류용으로만 썼다(괄호는 한국 기본 노출의 점수 있는 게임 수). Immersive Sim(4,027)은 원래 Deus Ex류 장르인데 **Immersive Sim ∩ Life Sim이 1,253개**나 될 만큼 FMV 연애물 등에 넓게 붙어 있어 분류용으로만 썼다. Romance·Otome·Idler·Incremental·Building·Crafting·Base Building·City Builder·동물 태그도 통째로는 넣지 않았다.

**X — 분류 확인용 교집합(23개, U1의 부분집합이라 새 게임을 더하지 않음).** 예: Management ∩ Life Sim 1,091, Sandbox ∩ Life Sim 785, Story Rich ∩ Life Sim 729, Cute ∩ Cozy 1,312, Education ∩ Life Sim 249, Asynchronous Multiplayer ∩ Cozy 7. 전부는 아래 표와 `report_stats.json`의 `queries`에 있다.

{{Q_X}}

### 1.2 검색 매개변수와 직접 확인한 동작

- 꼴: `https://store.steampowered.com/search/results/?query&start={n}&count=100&tags={id[,id]}&category1=998&infinite=1&sort_by=Reviews_DESC&l=english&ignore_preferences=1&cc=us`. `category1=998`(게임)로 DLC·사운드트랙·데모·소프트웨어를 뺐다. `count=100`이 그대로 먹고, `start`는 100씩 차례로 넘겨야 한다(임의 시작점은 가까운 쪽 경계로 맞춰졌다). 9,522개짜리 Relaxing도 96쪽을 넘겨 고유 9,522개를 끝까지 받았다.
- **정렬마다 총수가 다르다.** Cozy 기준 `Reviews_DESC` 1,765(리뷰 점수가 있는 게임만 — 상점 표시 기준 10개 이상), `Released_DESC` 2,697(점수 없는 출시작 포함), 관련도·이름·가격 정렬 6,172(미출시 포함). 그래서 점수 정렬(A)로 본 목록을 받고, 핵심·언어 태그는 출시순(C)으로 한 번 더 받아 점수 없는 출시작까지 셌다.
- `ignore_preferences=1`은 기본 설정에서 숨는 성인 게임을, `cc=us`는 한국 상점에 없는 게임을 더한다(Casual: 기본 30,991 → 둘 다 켜면 34,790). 한국 기본 노출 수는 표의 마지막 열에 따로 적었다.
- 검색 결과 말풍선의 리뷰 수는 「사용자 언어 기준」이라(Stardew 396,097 = 영어·Steam 구매) 지표로 쓰지 않았다.
- `store.steampowered.com`은 짧게 몰아 부르면 429를 돌려준다(같은 시각 다른 에이전트의 리뷰 수집과 한도를 나눠 썼다). 429마다 45초 이상 쉬고 이어 받았고, 검색 실패로 빠진 쪽은 없다.

### 1.3 지표

- **누적 리뷰(기본):** 공식 경로 `api.steampowered.com/IUserReviewsService/GetAppReviews`로 받았다. 상점 `appreviews`와 같은 값을 준다는 것을 확인했다 — `purchase_type` 0=steam·1=all·2=Steam 밖 구매, `languages:["all"]`, 비주제 활동 필터는 기본으로 켜짐(Sun Haven: 켜면 25,665 = 상점 `filter_offtopic_activity=1`, 끄면 25,725). 같은 게임 435개를 두 경로로 받아 389개가 같았고, 나머지도 −3~+14개(받은 시각 차이)였다. 이번 기본값은 **전체 언어·전체 구매 경로·비주제 필터 켬**이다.
- **10-08과의 차이:** 10-08은 Steam 구매 경로만 셌다. 유료 게임 4,697개의 전체/표시 비율은 중앙값 1.11배(90% 1.35배, 99% 2.19배)로 크지 않지만, **무료 게임은 Steam 구매가 거의 없어 그 경로로는 숫자가 무너진다**(Palia: Steam 구매 60 vs 전체 44,832, The Sims 4: 10-08 83,367 vs 오늘 201,649). 무료 게임 831개는 상점 표시값이 곧 전체 값이었다(비율 1.00~1.02). 이번 값은 무료 게임을 제대로 세는 대신 키 등록·번들 리뷰도 들어간다(비율 최대 52.5배 — Find Love or Die Trying, 전체 11,926 vs 표시 227).
- **정렬:** Wilson 95% 하한(z=1.96) 내림차순. 인접한 작은 차이는 서열의 근거가 아니다.
- **‡ 근사값:** 누적 리뷰를 받지 못한 게임은 `IStoreBrowseService/GetItems`의 상점 표시 기준(전체 언어, 유료는 Steam 구매자·무료는 전체) 리뷰 수와 정수 긍정률로 하한을 근사했다(본 목록 중 생활 396개·언어 682개).
- **최근 30일:** 상점 페이지(`/app/{id}/?l=english`, 나이 확인 쿠키)의 「Recent Reviews」 줄. 한국어 상점에서도 같은 수(Stardew 7,036)가 나와 **전체 언어·상점 표시 기준**임을 확인했다. 상점 표시 900개 이상과 10-08 후보 24개, 1,674쪽을 받았다. 리뷰 1,000개 이상 순위 대상 1,026개 중 674개에 값이 있다(나머지: 30일 10개 미만, 출시 30일 이내, 받지 않음, 실패).
- **메타데이터:** 게임별 `appdetails`(5분 200회 제한) 대신 `IStoreBrowseService/GetItems`로 100개씩 받았다 — 태그 상위 20개와 가중치, Steam 출시일(UTC), 앞서 해보기, 무료 여부, 한국어(UI·음성·자막), 미국·한국 가격, 짧은 설명(appdetails `short_description`과 같은 문구), 콘텐츠 설명자. 한 줄 설명은 이 짧은 설명을 바탕으로 썼다.
- **보유자 추정:** SteamSpy 태그 목록(33개 정상, 13개는 똑같은 70개짜리 엉뚱한 목록이 와서 버림)과 게임별 1,215건. 2024년 이후 출시작은 리뷰보다 적은 구간(Bongo Cat 리뷰 113,033개에 0~20K)이 많아 참고만 한다.
- **관련도 판정(태그 가중치 상위 10 + 짧은 설명):** ① 핵심 — 상위 10 태그에 U1 태그가 있고 같은 상위 10에 생활 문맥 태그(Simulation·Cozy·Relaxing·Casual·Management·Visual Novel 등)가 함께 있음(ULTRAKILL처럼 Dating Sim 밈 태그만 붙은 게임을 거름). ② 인접(†) — U2 교집합의 태그가 모두 상위 10에 있음(넓은 ×Relaxing 교집합은 U1 태그가 상위 20에 있을 때만). ③ 주변 — 그 밖, 그리고 공포·사격·전쟁 태그가 상위 3을 차지하고 생활 태그가 상위 3에 없는 게임(Doki Doki Literature Club!, Stronghold Crusader HD 등 146개). ④ 성인 — 콘텐츠 설명자 3(성인 전용 성적 콘텐츠)·4(잦은 노출·성적 콘텐츠) 또는 상위 5 태그에 Sexual Content·Nudity·Hentai. ⑤ 도구 — 상위 3 태그에 Software(DFHack, SteamVR 등). 순위표에는 ①②만 올렸다.

### 1.4 수집 결과 숫자, 걸러 낸 수, 실패

| 단계 | 수 | 비고 |
|---|---:|---|
| 질의 | 70 (A) + 23 (C) | U1 17 · U2 24 · L 4 · L2 2 · X 23. C는 U1·L·L2만 |
| 검색 쪽 | 849 | A 530쪽(21:01~21:29) · C 319쪽(21:29~21:46) · 정렬별 총수 확인 21:46~21:56 |
| 고유 게임 | 25,148 | 점수 있음 17,341 · 점수 없는 출시작 7,807 · 처음 들어온 층 U1 16,295 / U2 4,344 / L 3,977 / L2 532 |
| 검색에서 뺀 행 | 25 | 앱이 아닌 묶음·패키지 행 |
| 검색 총수와 고유 수 차이 | 1~3개씩 6건 | A: Idler ∩ Relaxing 1,232/1,233 · C: Farming Sim 1,582/1,584, Agriculture 1,049/1,051, Colony Sim 1,227/1,228, Dating Sim 5,658/5,661, Education 3,980/3,981(받는 동안 쪽 경계를 넘은 것으로 보임) |
| GetItems(미국) | 17,341 | 점수 있는 게임 전부, 실패 0 (21:11~21:31) |
| GetItems(한국) | 16,428 | 마지막 질의에서 들어온 913개는 받지 못함 (21:24~21:28) |
| 누적 리뷰(전체 경로) | 5,528 (+515) | 실패 0 (21:19~21:43). 515는 처음 상점 경로로 받은 것으로 대부분 겹침 |
| 누적 리뷰를 못 받아 근사(‡) | 생활 1,000 · 언어 2,066 | U1은 표시 100개 이상 4,965개 전부 받음. U2만 걸린 1,563개 중 563개, 언어만 걸린 1,538개 중 0개를 받음 |
| 본 목록 | 생활 2,970 · 언어 1,089 | 생활: 정확 2,574 + 근사 396 / 언어: 정확 407 + 근사 682 |
| 생활 본 목록 판정 | 핵심 1,305 · 인접 239 · 약한 인접 44 · 주변 887 · 도구 4 · 성인 491 | 순위 대상 1,544 (1,000개 이상 1,026: 정확 956 · 근사 70) |
| 언어 본 목록 판정 | 언어 핵심 484 · 인접(타자·퀴즈) 80 · 주변 481 · 성인 44 | 순위 대상 564 |
| 상점 페이지 | 1,674 | 정상 1,513 · 실패 161(로그인 요구 성인 전용 113, Site Error 48) · 최근 줄 있음 1,080 (21:21~21:55) |
| SteamSpy | 태그 46건 · 게임 1,215건 | 생활 본 목록 2,790개에 보유자 구간. 15개는 상한이 리뷰 수보다 작음 |

**받지 않은 것(멈춘 시점 기준):** 10-08 TOP10의 Steam 구매 경로 재수집(시험으로 Stardew·Palia·Sun Haven 3개만 확인), `appdetails`(GetItems로 대신), 리뷰 히스토그램(시험 4건), 뒤 질의 게임의 누적 리뷰, 표시 900개 미만 게임의 최근 30일, 점수 없는 출시작의 키 등록 표본 확인. 상점 페이지 실패 목록은 부록 B.

### 1.5 「전수」라고 말할 수 있는 범위와 없는 범위

**전수라고 말할 수 있는 것**

- 2026-10-21 21:01~21:46 KST Steam 상점 검색(게임 분류, 성인 숨김 해제, 미국 지역)에서 **위 17개 핵심 태그 중 하나라도 사용자 태그 상위 20에 든 게임 가운데 리뷰 점수가 있는 것 전부**(17개 질의 모두 검색 총수 = 고유 수)와 **출시작 전부**(질의당 차이 0~3개).
- 그중 상점 표시 기준 리뷰 100개 이상인 4,965개는 전체 경로 누적 리뷰를 모두 받았다. 핵심 태그 게임의 「500개 이상」 판정은 이 범위에서 정확하다.

**전수가 아닌 것**

- **태그가 안 붙은 생활형 게임.** 10-08 후보 Slime Rancher·FANTASY LIFE i는 처음 질의에 없어 교집합 두 개를 더해 잡았다. Terraria·Palworld·Valheim·Death Stranding처럼 생활 요소가 있어도 생활 태그가 상위 20에 없는 게임은 범위 밖이다. Spiritfarer는 Farming Sim이 19번째 태그라 겨우 들어왔다.
- **교집합·언어 질의의 정확도.** 뒤에 받은 U2 질의와 언어 질의 게임은 상점 표시값 근사(‡)다. 표시 100개(언어 20개) 미만 게임은 누적 리뷰를 받지 않았다 — 키 등록 리뷰가 많아 전체 경로로는 500개를 넘는 게임이 빠졌을 수 있다(받은 5,528개 중 전체/표시 2배 이상이 61개).
- **검색 노출 밖.** 삭제·숨김·미국과 한국 모두에서 막힌 게임, 미출시작(점수·출시 정렬에서 빠짐), 성인 전용 상점 페이지(로그인 요구 113개의 최근 30일).
- **시점과 태그 변동.** 태그는 투표로 바뀌므로 같은 질의도 날마다 다르다. Steam 밖(모바일·콘솔·중국 플랫폼) 이용자는 없다.
- **표본 성격.** 리뷰 작성자는 무작위 표본이 아니고, 최근 30일은 표시 900개 이상만, 보유자 구간은 SteamSpy 추정이다.

## 2. 전체 순위 — 리뷰 1,000개 이상, Wilson 하한 상위 40

† 인접(교집합으로 들어온 게임) · ‡ 상점 표시값 근사 · 한 줄 설명은 표마다 상위 10개를 빠짐없이 채웠고 그 아래는 있는 것만 적었다. 숨은그림찾기·짧은 비주얼노벨처럼 **작고 평가가 고른 게임이 위를 채운다**는 점을 감안해 읽는다 — 규모까지 보려면 §2.1.

{{T_OVERALL}}

순위에서 뺀 게임 중 하한이 40위 안쪽이었던 것 — 성인 표시: {{T_OVERALL_ADULT_HIDDEN}} / 주변(태그만 걸림·도구): {{T_OVERALL_PERIPHERAL_HIDDEN}}

### 2.1 리뷰 1만 개 이상만 보면(171개 중 상위 15)

{{T_OVERALL_10K}}

## 3. 누적 규모 상위 20

{{T_SCALE}}

鬼谷八荒 Tale of Immortal(224,936개·55.45%)은 대부분 중국어 리뷰로 커진 규모다. 무료 낚시 두 편(Russian Fishing 4·Fishing Planet)과 The Sims 4는 무료 게임이라 10-08 방식(Steam 구매 경로)으로 세면 크게 줄어드는 숫자다(§1.3의 Palia·The Sims 4 사례).

## 4. 2025-01-01 이후 출시작 상위 20 — 누적 리뷰 수 순(최근 흥행작)

출시일은 GetItems의 Steam 출시일(UTC)이라 앞서 해보기 시작일과 정식 출시일 중 하나로 찍힌다(예: Fields of Mistria는 1.0 날짜 2026-08-05).

{{T_RECENT_RELEASES}}

### 4.1 같은 기간 Wilson 상위 10(1,000개 이상)

{{T_RECENT_RELEASES_WILSON}}

## 5. 최근 30일 평가가 누적과 크게 다른 게임

조건: 순위 대상, 누적 1,000개 이상, 최근 30일 50개 이상, 차이 ±10%p 이상. 최근 값은 상점 표시 기준이고 누적은 전체 경로라(유료 게임의 Steam 구매 경로 누적은 받지 못함) 몇 %p는 경로 차이일 수 있다. 원인(업데이트·운영 사건·리뷰 몰림)은 이번 범위에서 확인하지 않았다.

**크게 오른 게임**

{{T_SHIFT_UP}}

**크게 내린 게임**

{{T_SHIFT_DOWN}}

## 6. 분야별 상위와 싱크 타운 관점

**분류 기준(한 게임이 여러 분야에 들 수 있음).** 태그는 가중치 상위 10개, 문구는 이름+짧은 설명이다. 각 표는 리뷰 1,000개 이상 Wilson 순이고, 1,000개 이상이 5개 미만이면 500개, 언어는 100개 기준이다.

| 분야 | 판정 |
|---|---|
| 농사·생활 | Farming Sim·Agriculture·Farming이 상위 10, 또는 Life Sim이 상위 5 |
| 마을 만들기·공동체 | City Builder + 생활 문맥 태그, 또는 마을·주민·이웃·공동체 낱말 + Building·City Builder·Colony Sim·Farming Sim·Life Sim·Crafting |
| 관계·연애 | Dating Sim·Romance·Otome + 문맥 태그, 또는 관계·우정·결혼 낱말 + Life Sim·Cozy·Wholesome·Farming Sim |
| 집 꾸미기 | Decorating·Organizing이 상위 20, 또는 꾸미기·가구·인테리어·「내 집」 낱말 + 생활 태그 |
| 군락·창발 시뮬 | Colony Sim·God Game, 또는 Sandbox+Life Sim + 시뮬·자율·세대 낱말 |
| 가게·손님 응대·대화 | Shop Keeper·Cooking·Job Simulator, 또는 가게·카페·손님·서빙 낱말 + 경영·시뮬 태그 |
| 동물·펫 돌봄 | 돌봄 낱말(키우다·먹이·입양·목장·구조 등) + 동물 태그나 낱말 + 생활 태그, 숨은그림찾기가 상위 3이면 제외 |
| 낚시 | Fishing이 상위 10, 또는 상위 20 + 낚시 낱말 |
| 공부 동반·방치형 | Desktop Companion(상위 20), Idler·Incremental + Relaxing·Cozy류, 또는 공부·집중·로파이·작업 낱말 + 생활 태그 |
| 비동기 온기 | Asynchronous Multiplayer(상위 20) + 아늑한 태그, 또는 편지·익명·낯선 사람·다른 플레이어 낱말 + Cozy·Wholesome·Relaxing·Life Sim |
| 언어 학습·교육 | 언어 층(L·L2)이면서 Language Learning·Education, 또는 Word Game·Spelling(상위 5가 비주얼노벨류면 제외) |

아래 「핵심 후보」는 규칙 표와 규모를 함께 보고 싱크 타운에 가까운 것을 고른 것이며, 「시사점」은 설계 가설이다(원작 기능의 효과를 이 숫자로 증명하지 않는다).

### 6.1 농사·생활

{{T_SEG_farm_life}}

- **핵심 후보:** Stardew Valley 1,046,237개·98.46%·최근 98%(7,045) / Fields of Mistria 36,449개·96.82%·최근 95%(1,190) / Volcano Princess 49,447개·97.64% / Grimshire 3,517개·97.05%(EA) / The Sims 4 201,649개·86.18%(생활 시뮬 규모 기준점)
- **시사점:** 상위작은 수확보다 **주민 관계·마을 복구·육성 선택이 붙은 생활**이다. 싱크 타운도 작물·재료가 선물·주문·마을 변화로 이어지는 순환을 먼저 만든다.

### 6.2 마을 만들기·공동체

{{T_SEG_town_community}}

- **핵심 후보:** Minami Lane 6,839개·96.93% / Town to City 7,226개·97.03%(2026-05) / Tiny Glade 25,002개·97.15% / Dorfromantik† 29,700개·96.09% / Timberborn 42,240개·95.78%
- **시사점:** 목표 없이 짓는 장난감(Tiny Glade, Townscaper† 21,675개·95.00%)과 **작은 거리 하나를 꾸며 주민 행복을 채우는 경영**(Minami Lane)이 함께 높다. 16명 마을은 거리 단위 꾸미기와 주민 반응을 같은 화면에서 보여 주는 쪽이 맞다.

### 6.3 관계·연애

{{T_SEG_relationship}}

- **핵심 후보:** Our Life: Beginnings & Always 13,835개·98.53% / Creature Kitchen 10,415개·99.48% / Volcano Princess 49,447개·97.64% / Fields of Mistria 36,449개·96.82% / Sky: Children of the Light 25,602개·86.60%
- **시사점:** 연애 그 자체보다 **함께 자라는 이웃**(Our Life)과 **좋아하는 음식으로 친해지는 과정**(Creature Kitchen)이 최상위다. 관계를 호감 수치보다 시간·취향의 기억으로 쌓는 설계와 맞는다.

### 6.4 집 꾸미기

{{T_SEG_home_decor}}

- **핵심 후보:** Spirit City: Lofi Sessions 17,006개·97.34% / Unpacking 41,145개·92.98% / Squeakross: Home Squeak Home 2,286개·97.73% / House Flipper 112,466개·93.83% / Tiny Bookshop 7,967개·95.85%(가게 꾸미기가 손님에 영향)
- **시사점:** 꾸미기만 하는 게임보다 **꾸미기가 다른 목적과 묶인 게임**(집중 도구, 이삿짐 속 사연, 퍼즐 보상)이 높다. 내 집 꾸미기를 주민 방문·공부 시간과 연결한다.

### 6.5 군락·창발 시뮬

{{T_SEG_colony_emergent}}

- **핵심 후보:** RimWorld 248,528개·97.80%·최근 97%(1,732) / Oxygen Not Included 144,569개·96.63% / Wobbledogs 15,486개·98.04% / Timberborn 42,240개·95.78% / WorldBox 57,471개·95.16%
- **시사점:** RimWorld의 「AI 이야기꾼 + 정착민의 감정·관계」가 창발 서사의 기준이다. 주민 자율 생활 설계의 비교 기준으로 둔다.

### 6.6 가게·손님 응대·대화

{{T_SEG_shop_service}}

- **핵심 후보:** Touhou Mystia's Izakaya 33,086개·98.43% / Papa's Freezeria Deluxe 13,457개·99.09% / Creature Kitchen 10,415개·99.48% / TCG Card Shop Simulator 50,736개·96.14%·최근 89%(736) / Tiny Bookshop 7,967개·95.85%·최근 98%(175). 규칙상 주변으로 빠졌지만 대화형 가게의 대표: VA-11 Hall-A 38,841개·97.09%, Coffee Talk 12,663개·94.25%
- **시사점:** **손님의 말을 듣고 취향대로 만들어 내는 반복**이 생활형 전체에서 가장 높은 평가를 받는다. 찻집 주문 듣기·되묻기·맞춰 내기 학습과 그대로 겹치는 분야라 첫 생활 구간의 중심에 둘 만하다.

### 6.7 동물·펫 돌봄

{{T_SEG_animal_pet}}

- **핵심 후보:** Slime Rancher† 158,299개·97.94% / Wobbledogs 15,486개·98.04% / Creature Kitchen 10,415개·99.48% / Loddlenaut 6,377개·97.62% / Planet Zoo† 98,223개·90.77%
- **시사점:** 먹이·환경을 바꾸면 **생물이 곧바로 몸짓·변이·생산으로 반응**하는 게임이 높다. 펫·마스코트 돌봄은 즉각 반응을 먼저, 수치 관리는 뒤로 둔다.

### 6.8 낚시

{{T_SEG_fishing}}

- **핵심 후보:** WEBFISHING 70,525개·97.20%·최근 91%(141) / DAVE THE DIVER 164,303개·96.37% / Cat Goes Fishing 16,637개·93.82% / Cornerpond 2,766개·96.41% / Tiny Aquarium: Social Fishkeeping 3,802개·95.08%
- **시사점:** 낚시가 크게 팔린 경우는 **모여 있는 공간**(WEBFISHING — 짧은 설명이 「채팅방 중심」이라 채팅 없는 싱크 타운과는 반대 방향)이거나 **다른 생활의 재료**(DAVE의 초밥집)일 때다. 낚시는 식재료·이웃 선물로 이어지는 짧은 활동으로 둔다.

### 6.9 공부 동반·방치형

{{T_SEG_study_idle}}

- **핵심 후보:** Chill with You: Lo-Fi Story† 13,049개·98.02%·최근 97%(363) / Spirit City: Lofi Sessions 17,006개·97.34% / Virtual Cottage 11,125개·97.38% / Rusty's Retirement 14,925개·96.39% / Bongo Cat 113,033개·96.45%·최근 96%(2,333)
- **시사점:** 2024~26년 가장 빨리 커진 흐름이다. 화면 한쪽에 **켜 두면 곁에 있어 주는** 형태가 리뷰 11만 개(Bongo Cat)까지 갔다. 학습 앱의 공부 타이머·함께 있음 연출과 바로 이어진다.

### 6.10 비동기 온기(채팅 없는 교류)

{{T_SEG_async_warmth}}

- **핵심 후보:** Kind Words 8,977개·97.73% / Tiny Aquarium: Social Fishkeeping 3,802개·95.08%(친구 수조 방문) / On-Together: Virtual Co-Working 1,557개·92.81% / Different Strokes 1,592개·91.74%
- **시사점:** 낯선 사람에게 익명 위로 편지를 보내는 Kind Words가 거의 유일한 큰 사례이고 분야 전체가 26개로 작다. **채팅 없이 온기를 주고받는 마을**은 Steam에서 아직 빈자리다. 단 태그·낱말 판정이라 놓친 게임이 있을 수 있고 채팅 기능 유무는 확인하지 않았다(Backpack Battles·Super Auto Pets는 비동기 대전이지 온기가 아니다).

### 6.11 언어 학습·교육

교육 태그 전반(규칙 표)은 Education이 공학·운전·퍼즐 게임에도 넓게 붙어 언어 학습과 거리가 있다. 그래서 **Language Learning 태그(상위 20)나 언어 학습 낱말이 있는 게임**만 따로 뽑았다(100개 이상 34개).

{{T_LANG_LEARNING}}

교육 전반(참고):

{{T_SEG_language_edu}}

- **핵심 후보:** Chants of Sennaar ≈31,243개·≈97.84%(고대 언어 해독 퍼즐) / Homicipher ≈7,887개·≈95.55%(인외 존재의 말 해독) / Wagotabi ≈1,609개·≈97.21%(일본어 교육 RPG) / Learn Japanese To Survive! Hiragana Battle ≈1,742개·≈89.55% / Influent 1,702개·70.93%(어휘 수집 3D)
- **시사점:** 크게 팔린 언어 게임은 가르치는 앱이 아니라 **뜻을 추측하고 맞혀 가는 과정 자체가 재미인 게임**이다. 직접 가르치는 게임은 2천 개 안팎에 머문다. 한국어를 가르치는 Steam 게임은 리뷰 100개를 넘는 것이 없다(Let's Learn Korean! Hangul ≈84개). 한국 생활 소재 게임도 작다(POJANGMACHA 243개·91.06%, 100 Korea Cats 1,173개·93.76%).

## 7. 10-08 조사와 달라진 점

{{COMPARE_1008}}

1. **범위:** 직접 고른 24개 → 태그 합집합 25,148개(1,000개 이상 순위 대상 1,026개). 10-08 TOP10 가운데 이번 생활형 Wilson 40위 안에 든 것은 Stardew(16위)와 Slime Rancher(38위)뿐이다. 리뷰 1만 개 이상만 보면 Stardew는 7위다. 평가가 떨어진 것이 아니라, 1천~3만 개 규모의 고평가 소품(숨은그림찾기, 주문 요리, 작업 동반, 짧은 비주얼노벨)이 대거 비교 대상에 들어왔다.
2. **경로:** Steam 구매 → 전체. 유료 후보는 리뷰 수가 8~31% 늘고 하한은 ±0.8%p 안에서 움직였다(Hello Kitty 92.79→93.54%, Dinkum 92.04→91.45%). 무료로 바뀐 The Sims 4(83,367→201,649)와 무료인 Palia(59→44,832, 이번 602위)는 10-08 값이 이용자 대부분을 빼고 센 것이었다.
3. **13일 사이 증가(상점 표시 기준 ≈ Steam 구매):** Stardew +3,220(897,795→901,015), Fields of Mistria +493, Paralives +299, inZOI +206, Hello Kitty +151.
4. **최근 30일:** 10-08 TOP10은 모두 최근 93% 이상이다(Tiny Bookshop·Farm Together 2 98%). 아래쪽 후보는 최근이 누적보다 낮은 게임이 많다 — My Time at Portia 80%(46개)·Cozy Grove 80%(25개)·Dinkum 86%(83개)·Sun Haven 70%(120개).
5. **새로 들어온 상위작(24개 밖):** §2 상위 40 중 38개, §2.1 1만 개 이상 상위 15 중 14개가 새 게임이다. 눈여겨볼 게임은 §8.
6. **방법:** 10-08이 「향후 재수집할 때 확인하라」고 남긴 `IUserReviewsService/GetAppReviews`의 필터 대응(§1.3)을 확인해 이번 누적 값의 기본 경로로 썼다.

## 8. 기존 조사(09-21·10-08)에 없던 눈여겨볼 게임

| 게임 | 지표 | 왜 볼 만한가(싱크 타운 관점) |
|---|---|---|
| [Creature Kitchen](https://store.steampowered.com/app/3097300/) | 10,415개·99.48%·최근 99%(551)·2026-02·한국어 UI·자막 | 동물 손님이 좋아하는 간식을 요리해 주며 친해짐 — 찻집 주문과 관계 쌓기를 한 고리로 묶은 최고 평가 |
| [Touhou Mystia's Izakaya](https://store.steampowered.com/app/1584090/) | 33,086개·98.43%·한국어 UI·자막 | 낮 채집 → 밤 단골 취향 응대의 하루 순환 |
| [Papa's Freezeria Deluxe](https://store.steampowered.com/app/2291760/) | 13,457개·99.09% | 손님 주문을 듣고 그대로 만드는 단순 반복이 99% — 초급 듣기 과제의 기본형 |
| [TOEM: A Photo Adventure](https://store.steampowered.com/app/1307580/) | 12,705개·98.88% | 주민 고민을 사진으로 풀어 주는 부탁 해결 |
| [Our Life: Beginnings & Always](https://store.steampowered.com/app/1129190/) | 13,835개·98.53% | 이웃과 어린 시절부터 함께 자라는 장기 관계 |
| [Chill with You](https://store.steampowered.com/app/3548580/) · [Spirit City](https://store.steampowered.com/app/2113850/) · [Virtual Cottage](https://store.steampowered.com/app/1369320/) · [Bongo Cat](https://store.steampowered.com/app/3419430/) | 13,049·17,006·11,125·113,033개, 모두 96~98% | 켜 두는 작업 동반 — 공부 시간과 마을 생활을 잇는 가장 큰 새 흐름 |
| [Kind Words](https://store.steampowered.com/app/1070710/) | 8,977개·97.73% | 채팅 없는 비동기 온기의 거의 유일한 대형 사례 |
| [RimWorld](https://store.steampowered.com/app/294100/) | 248,528개·97.80% | 주민 감정·관계가 사건을 만드는 창발 서사의 기준 |
| [Minami Lane](https://store.steampowered.com/app/2678990/) · [Town to City](https://store.steampowered.com/app/3115220/) · [Tiny Glade](https://store.steampowered.com/app/2198150/) | 6,839·7,226·25,002개, 97% 안팎 | 작은 거리·마을 꾸미기와 주민 반응 |
| [Wobbledogs](https://store.steampowered.com/app/1424330/) · [Loddlenaut](https://store.steampowered.com/app/1644940/) | 15,486·6,377개, 98.04%·97.62% | 돌봄에 즉시 반응하는 생물 |
| [Chants of Sennaar](https://store.steampowered.com/app/1931770/) · [Homicipher](https://store.steampowered.com/app/2302660/) · [Wagotabi](https://store.steampowered.com/app/2701720/) | ≈31,243·≈7,887·≈1,609개 | 말을 해독하며 소통하는 재미 — 학습을 게임 목표로 숨기는 방식 |
| [Is This Seat Taken?](https://store.steampowered.com/app/3035120/) · [Kabuto Park](https://store.steampowered.com/app/3376990/) · [Ye Guild Clerk!](https://store.steampowered.com/app/3715020/) · [Dressmaker](https://store.steampowered.com/app/4019220/) | 9,833·4,734·2,333·17,795개, 96.9~99.2% | 2025~26년 고평가 소품: 사람 취향 맞춰 자리 배정, 곤충 수집, 길드 접수원, 재단·바느질 |
| [TCG Card Shop Simulator](https://store.steampowered.com/app/3070070/) · [Supermarket Together](https://store.steampowered.com/app/2709570/) | 50,736·100,580개, 96.14%·94.18% | 가게 경영 시뮬의 대형 흥행 |
| [Heartopia](https://store.steampowered.com/app/4025700/) · [Starsand Island](https://store.steampowered.com/app/2966320/) | 16,203개·65.48%(최근 66%) · 7,214개·75.43%(최근 54%) | 2026년 생활 시뮬 신작 중 평가가 낮은 쪽 — 이유는 리뷰 본문 조사에서 확인할 대상 |

## 9. 한계와 이어서 할 일

- 이번 값은 수집을 멈춘 시점의 자료로 끝냈다. 이어서 할 일: ① 근사(‡) 게임 3,066개의 누적 리뷰(전체 경로) 받기, ② 10-08 TOP10의 Steam 구매 경로 재수집, ③ 표시 900개 미만의 최근 30일, ④ 점수 없는 출시작 표본으로 키 등록 비중 확인, ⑤ 상점 페이지 Site Error 48건 다시 받기.
- 분야 분류는 태그·짧은 설명 규칙이라 실제 플레이 구조와 다를 수 있다(예: Creature Kitchen이 관계·가게·동물에 모두 듦). 기능과 사용자 반응의 원문 근거는 다른 에이전트의 기능별 리뷰 조사와 맞춰 본다.
- 높은 하한은 재미의 서열이나 학습 효과의 증거가 아니다. 한국어 학습에 맞춘 NPC·TOPIK 효과는 싱크 타운에서 따로 검증해야 한다.

## 부록 A. 파일과 재현

- `scripts/queries.py` 질의 계획 · `crawl_search.py` 검색 · `fetch_storebrowse.py` GetItems · `fetchers.py` 누적 리뷰(api_all)·상점 페이지·SteamSpy · `fetch_steamspy_tags.py` · `build_universe.py` 병합·지표 · `segments.py` 관련도·분야 규칙 · `tables.py`·`make_tables_md.py` 표 · `stats.py` 범위 숫자 · `write_report_template.py`·`build_report.py` 이 문서.
- 원자료: `raw/search/{A,C}/<질의>/<start>.json.gz`(검색 응답 원문), `raw/storebrowse_{us,kr}/batch_*.json.gz`, `raw/api_all/<appid>.json`, `raw/store/<appid>.html.gz`, `raw/steamspy*/`, `raw/logs/`. 같은 결과를 네트워크 없이 다시 만들려면 `python -I -X utf8 scripts/build_universe.py`, `make_tables_md.py`, `stats.py`, `write_report_template.py`, `build_report.py`를 차례로 돌린다.

## 부록 B. 상점 페이지 실패 161건

로그인 요구(성인 전용) 113건, Site Error 48건. 다시 받지 않았다.

{{STORE_FAILS}}
'''


def main():
    path = os.path.join(BASE, 'report_template.md')
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(TEMPLATE)
    print('template written', len(TEMPLATE))


if __name__ == '__main__':
    main()
