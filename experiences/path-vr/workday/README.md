# PATH 일터 체험

한국 일터의 하루를 앉아서 미리 겪어 보는 체험이다. 일터의 사람이 건네는 말을 듣고, 한국어로 답하고, 갈림길에서 고른다. 끝에 점수 없는 「체험 기록 한 장」을 본인 기기에서 만들어 받는다. 휴대폰과 PC가 기본이고 Quest는 같은 주소의 선택이다.

- 공개 주소: `synk.im/path/workday/`
- 직업: 「요양보호사의 하루」(열림), 「호텔 프런트의 하루」, 「면세점 판매의 하루」, 「해외영업·무역 사무의 하루」, 「의료 코디네이터의 하루」, 「고객상담의 하루」(만드는 중, 각자 곁 세션)
- 상위 설계: [PATH 일터 체험 설계](../../../docs/PATH_일터체험_설계.md)
- 구현 설계와 검토 처리표: [진행기 설계](docs/진행기_설계.md)
- 제작 기록(그림, 영상, 크레딧, 공개 명령): [제작 기록](docs/제작기록.md)
- 유호님이 실제 기기에서 볼 것: [Quest와 휴대폰 점검표](docs/점검표_Quest와_휴대폰.md)

## 직업을 더하는 법

코드는 고치지 않는다. 자료 한 벌을 더한다.

1. `jobs/<id>/job.json`에 장면표를 쓴다. 꼴은 `jobs/care-home/job.json`과 [진행기 설계 3-2](docs/진행기_설계.md)를 따른다.
2. `jobs/<id>/places/`에 자리 사진(16:9, 1920×1080 JPEG)을 넣는다. 인물 사진에는 `live`(사람이 있는 사각형)를 적는다.
3. `jobs/<id>/manifest.json`에 영상 목록을 둔다. 영상이 없으면 `{"status": "making", "clips": []}`로 두고 사진과 자막으로 연다.
4. `jobs/index.json`에 카드를 더한다. `status`가 `open`이어야 들어갈 수 있다.
5. `node --test experiences/path-vr/tests/workday-engine.test.mjs`가 장면표, 파일, 직업 목록을 검사한다.

제작 자료(지시문, 고르기 전 그림)는 `jobs/<id>/production/`에 둔다. 이 폴더는 로컬 서버와 공개 묶음에 실리지 않는다.

## 돌려 보기

```bash
node experiences/path-vr/server.mjs            # http://127.0.0.1:4292/workday/
node --test experiences/path-vr/tests/workday-engine.test.mjs
node tools/package-path-workday.mjs            # 공개 묶음 → .tmp/path-workday-pages/
node tools/package-path-workday.mjs --live     # 빌려 쓰는 면접실 파일이 synk.im에 같은 바이트로 있는지
```

## 지키는 선

- 점수, 등급, 추천 문구가 없다. 기록은 일어난 일만 적고 본인이 받아서 본인이 낸다. SYNK로 보내는 단추가 없다.
- 음성은 기기 안에서만 글로 바꾸고 저장하지 않는다. 진행과 고른 것은 그 창의 `sessionStorage`에만 있고 창을 닫으면 사라진다. 이름과 맺음에 쓴 글은 저장하지 않는다.
- 걷는 화면, 미끄러지는 회전, 움직이는 카메라, 고개를 따라다니는 글자가 없다. Quest는 한 번에 10분 안쪽이다.
- 가리킬 곳은 꽉 찬 작은 점과 가는 선이다. 고리, 구멍, 빽빽한 점 무늬, 저절로 도는 표시가 없다.
- 배설과 목욕 도움은 화면으로 보이지 않고 선배의 말로만 알린다.
