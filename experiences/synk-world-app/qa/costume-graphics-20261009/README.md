# 코스튬 그래픽 v6 · 2026-10-09

사용자는 첫 코스튬 스튜디오를 「훨씬 괜찮네」라고 평가하고 그래픽을 훨씬 더 높이도록 요청했다. 같은 몽글과 옷장 기능에서 의상 조형·직물·빛을 보강한 로컬 미술 시제품이다. 최종 품질 승인이나 네이티브/공개 반영으로 해석하지 않는다.

[현재 스튜디오](http://127.0.0.1:4296/desktop.html?wardrobe=1&opening=off&graphics=studio6) · [확대 비교](comparison-knit.png) · [현재 PC](final-desktop.png) · [390px](final-390.png) · [320px](final-320.png)

## 이번 변경

- **몸에 맞는 옷:** 기존 몽글 몸 곡선에서 161개 단면을 읽어 의상의 곡면과 부착 위치를 맞춘다. 본체·펠트 섬유·눈과 반짝임의 원문 형상은 보존했다. 의상마다 목둘레·옷단 높이·주름의 형태를 달리하고, 목도리가 다른 옷 밖에 놓이도록 두께에 맞춰 조합 크기를 조절한다.
- **실제 뜨개 구조:** 니트에는 둥근 V형 뜨개 고리와 짧은 양모 섬유를 추가했다. 고리는 하나의 형상을 인스턴스로 묶어 그린다. 몸에 따라 내려앉는 케이블 세 줄과 둥글게 말린 골지 가장자리를 구성한다. 가까운 피팅룸에서만 추가 미세 기하를 쓰며 홈/타운은 같은 조형과 직물 표면을 더 가볍게 표시한다.
- **의상 마감:** 앞치마의 곡선 앞판·열린 주머니·접힌 입구·두 줄 박음질·등 끈, 데님의 능직과 구리 리벳, 케이프의 드레이프·말린 칼라·앞여밈, 배자의 실제 V넥·겹친 앞섶·동정·고름을 다듬었다. 기존 앞치마·첫 산책 목도리도 같은 새 의상 구조로 표시한다. 아이템 ID·획득/저장 계약은 유지한다.
- **재료별 표면:** 기존 `avatar-textiles.mjs` 안에 니트·면·데님·코팅 면·고운 직물의 높이/색/normal/거칠기/AO를 독립 생성하는 경로를 추가했다. 기존 몸 펠트 생성기는 보존한다. 의상 지도는 PC 1024, 휴대폰 512이며 방문한 재료를 한 번 만들어 재사용한다. 새 AI 이미지 생성이나 유료 API는 사용하지 않았다.
- **빛과 접촉:** 기존 `contact-light-v6.mjs`를 재사용하여 PC에 8샘플 접촉 AO를 연결하고 VSM 그림자와 광원 균형을 조정했다. 받침의 모서리도 입체적으로 둥글렸다. 휴대폰 크기로 바뀌면 AO 버퍼를 해제하고 그림자 512·DPR 최대 1.5를 적용한다. PC 그림자는 1024, DPR 최대 1.75이며 기존 조작 버퍼 1.2MP 한도를 유지한다.

지급·룩북·계정·SQL·운영 옷장 계약을 추가 변경하지 않았다. 원래 정적 GLB는 새 의상으로 내보내지 않았으며 공통 계약에는 웹 wardrobe revision 6만 기록했다.

## 확인

[실제 브라우저 결과](verification.json)는 **21개 모두 통과**, JavaScript 오류와 자산 응답 실패 0개다.

- 24개 body/neck 조합을 정면·옆·뒤 72시점에서 실제 렌더했다. 미리보기·회전 뒤 서버의 확정 차림이 그대로임을 확인했다.
- 새 의상 좌표의 비유한 값 0개, 앞쪽 눈 영역 아래의 의상 범위, 기존 몸/펠트/눈 원문 동일성을 확인했다. 세 방향의 렌더 확인은 모든 순간의 의상 관통을 수학적으로 증명한 검사가 아니다.
- PC의 실제 접촉 AO/부드러운 그림자, 피팅룸의 입체 고리와 가벼운 세계 표시, 휴대폰 512 지도/작은 기하, 390/320px의 버퍼 정책·가로 넘침을 확인했다.
- 정지한 피팅룸의 반복 프레임 없음, 실제 1200×1500 PNG, 촬영 뒤 버퍼 복원, 실제 WebGL context loss 후 복구·닫기 해제를 확인했다.
- `node --test experiences/synk-world-app/qa/wardrobe-client.test.mjs experiences/synk-world-app/qa/town-bridge.test.mjs`: 관련 저장/소유권/계정 전환 **10개 통과**.

이 기록은 로컬 브라우저/합성 계정/뷰포트 검사다. 실제 S25/iPhone 15의 지속 FPS·발열, 사용자 최종 미술 평가, 리깅·천 시뮬레이션·네이티브 이식·공개 배포는 남는다. `cpuSubmissionMs`는 JavaScript 렌더 제출 시간이며 GPU FPS로 보고하지 않는다.

## 원문과 화면

원문: `experiences/synk-world-home/avatar-wardrobe.mjs`, `avatar-textiles.mjs`, `avatar-v3.mjs`, `wardrobe-stage.mjs`, `avatar-contract.json`. `before/`에 변경 전 원문을 보존했다.

[니트](after-knit.png) · [니트 가까이](after-knit-detail.png) · [데님](after-denim.png) · [케이프](after-cape.png) · [배자](after-hanbok.png) · [앞치마](after-apron.png) · [실제 사진](final-portrait.png)

`before-metrics.json`/`after-metrics.json`과 대응 PNG는 같은 기본 시점의 전후 기록이다. 의상과 조명을 함께 바꿨으므로 재질 한 변수만의 실험으로 읽지 않는다. 비교 PNG는 이 실제 캡처를 나란히 놓은 것이다.

![니트 확대 비교](comparison-knit.png)

```powershell
node experiences/synk-world-app/qa/costume-graphics-20261009/capture.cjs
node experiences/synk-world-app/qa/costume-graphics-20261009/verify.cjs
node experiences/synk-world-app/qa/costume-graphics-20261009/compare.cjs
```

기존 변경 전 캡처를 보존하려면 `capture.cjs --before`는 다시 실행하지 않는다. 사용자 탭의 자동 새로고침 시도는 브라우저 도구 시간 초과로 확인하지 못했으며, 위 새 링크 또는 페이지 새로고침으로 현재 소스를 읽는다.
