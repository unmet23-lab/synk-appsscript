# 플랫폼 앱 글 전수조사 자료 (2026-10-21~22)

[플랫폼 시그널 README의 기록](../README.md#platform-copy-audit-20261021)에 딸린 자료다. 다시 쓴 글의 옛→새 짝, 쓴 원칙, 검수와 처리 기록을 그대로 둔다.

## 무엇이 있나

| 자리 | 내용 |
|---|---|
| [글원칙.md](글원칙.md) | 다시 쓸 때 따른 원칙과 용어 표(해요체 하나·추상어 금지·내부 말 금지·상태 두세 낱말·오류는 원인과 다음 행동·이름 표) |
| `maps/<영역>/*.json` | 옛→새 짝. 꼴은 `{"<파일>": [["옛 원천 조각", "새 원천 조각", {"n": 개수}], …]}`이고 번호 순서대로 얹었다(긴 조각부터). `*tests*`·`9x-*`는 시험 파일 짝 |
| `검수/아르곤_*.md` | 영역마다 아르곤(Gemini) 검수 지적과 처리(반영·일부·안 함과 이유) |
| `검수/Fable_*.md` · `검수/Fable처리_*.md` | 배포 전 Fable 최종 검수 원문과 처리 |
| `영역보고/*.md` | 영역을 맡아 다시 쓴 쪽의 보고(범위·숫자·대표 전후·고친 화면 문제·제안·남긴 것·시험). 안의 `scratchpad\…` 경로는 작업 때의 임시 폴더라 지금은 없다 |

## 영역과 짝 맵

- `desktop` — PC 앱(`desktop/renderer`·`desktop/src`·`desktop/installer`). `13-leftovers.json`은 검수 뒤 손으로 고친 것을 적은 기록용 짝(옛 조각에 괄호 설명이 붙은 것이 있어 그대로 다시 얹을 수 없다).
- `portal` — 웹 플랫폼·계정 포털(`experiences/synk-account`). `11-leftovers.json`도 기록용.
- `care` — SYNK 플레저(`experiences/relationship-care`). `18-argon.json`은 기록용.
- `world` — SYNK WORLD(`experiences/synk-world-app`·`brand-opening`·`synk-world-home`·게임 셋·`play-common`).
- `path-fortune` — PATH 면접 연습(`experiences/path-vr/interview/film`)과 무료 운세(`experiences/daily-fortune`). `14-argon.json`은 기록용.

## 다시 쓸 때

- 같은 원칙으로 새 화면 글을 쓸 때는 [글원칙.md](글원칙.md)의 이름 표부터 본다(「SYNK ID」·「PC 앱」·「학습 기록 연결」·「쓰던 메모 되살리기」·「내 성향」 등).
- WORLD 번역 표(`experiences/brand-opening/world-strings.mjs`)의 한국어를 바꾸면 그 글을 던지는 원천의 한국어도 글자까지 같게 바꾸고 영어·몽골어를 함께 고친 뒤 몽골어 검문을 돌린다(`tMessage`가 글자로 찾는다).
- 계정 포털 원천을 고치면 `node tools/check-account-bundles.js --build`, 놀이 공통 보상 글은 `node experiences/play-common/build-collection.mjs`, WORLD 계정 모듈은 `node tools/build-world-account.mjs`, 플레저 `model.mjs`는 PC 알림 판정 묶음(`desktop/tools/build-care-notification-model.cjs`)까지 다시 만든다.
