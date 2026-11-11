'use strict';
// 한글 발음 표기 도구(tools/lib/한글표기.js)와 표(tools/lib/한글표기표.json)를 본다(2026-11-11 v3 — 아르곤 IPA 대조 · Fable 5.2 다시 검수 반영).
// 왜: LAB 발음 줄은 표에서 기계로 뽑는다(리듬 한국어 준비안 「사 표기표」). 표가 영어판 · 몽골판의 실제 읽는 법을 그대로 내는지(몽골은 옛판 mn_1110),
//   발음 규칙이 맞는지, 아르곤 · Fable 5.2 검수로 바꾼 칸이 그대로 나오는지, 화면 입구(발음줄 · 음절표기)가 금칙을 로마자로 돌리는지, 금칙 철자(욕설 · 글꼴 깨짐)가 새지 않는지,
//   데바나가리 결합 문자가 깨지지 않는지, README 표가 json과 갈리지 않는지 본다.
//   README 칸에 걸리면 node tools/lib/한글표기.js --README 로 다시 만든다(손으로 고치지 않는다).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const 도구 = require('../tools/lib/한글표기.js');
const { 발음으로, 표기, 문자표, 표읽기 } = 도구;
const 뿌리 = path.join(__dirname, '..');
const 키릴들 = ['mn', 'ru', 'kk', 'ky'];
const 데바들 = ['hi', 'ne'];

test('발음으로 — 연음 · ㅎ 탈락 · 구개음화 · 비음화 · 유음화 · 된소리 · 거센소리 · 대표음', () => {
  const 예 = [
    ['먹어요', '머거요'], ['감사합니다', '감사함니다'], ['좋아요', '조아요'], ['같이', '가치'], ['굳이', '구지'],
    ['괜찮아', '괜차나'], ['싫어', '시러'], ['학교', '학꾜'], ['한국어', '한구거'], ['맛있어', '마시써'],
    ['없어', '업써'], ['값이', '갑씨'], ['닭이', '달기'], ['밟아', '발바'], ['신라', '실라'], ['칼날', '칼랄'],
    ['국물', '궁물'], ['입는', '임는'], ['종로', '종노'], ['백리', '뱅니'], ['좋고', '조코'], ['많다', '만타'],
    ['축하', '추카'], ['깨끗하다', '깨끄타다'], ['앉히다', '안치다'], ['굳히다', '구치다'], ['놓는', '논는'],
    ['옷', '옫'], ['부엌', '부억'], ['지쳤어', '지처써'], ['희망', '히망'], ['열받아', '열바다'], ['몽글아', '몽그라'],
  ];
  for (const [글, 답] of 예) assert.strictEqual(발음으로(글), 답, 글);
  assert.strictEqual(발음으로('밥 먹어!'), '밥 머거!'); // 낱말 사이에는 걸지 않는다 · 한글 밖 글자는 그대로
  assert.strictEqual(발음으로('먹지 마'), '먹찌 마');
  assert.strictEqual(발음으로('먹지 마', { 된소리: false }), '먹지 마'); // 영어판 reads는 된소리를 적지 않았다
});

test('넣지 않은 규칙은 발음 글을 손으로 준다 — ㅎ 약해짐 · 조사 의 · 사잇소리', () => {
  assert.strictEqual(발음으로('억울해'), '어굴해'); // [어구래]는 손으로
  assert.strictEqual(발음으로('하늘의'), '하느리'); // 조사 의[에]는 손으로
  assert.strictEqual(발음으로('김칫국'), '김칟꾹'); // [김치꾹]은 손으로
});

test('표가 빠짐없다 — 문자마다 첫소리 19 · 모음 21 · 받침 대표음 7, 한국어 IPA', () => {
  const 표 = 표읽기();
  for (const [묶음, 목록] of [['초성', 도구.초목록], ['중성', 도구.중목록], ['종성', 도구.대표받침]]) {
    for (const 자 of 목록) assert.ok(표.한국어[묶음][자], `한국어 ${묶음} ${자}`);
  }
  for (const 문자 of [...도구.문자차례, 'mn_1110']) {
    const 판 = 문자표(문자);
    for (const 자 of 도구.초목록) assert.strictEqual(typeof 판.초성[자].글자, 'string', `${문자} 초성 ${자}`);
    for (const 자 of 도구.중목록) assert.ok(판.중성[자].글자, `${문자} 중성 ${자}`);
    for (const 자 of 도구.대표받침) assert.ok(판.종성[자].글자, `${문자} 종성 ${자}`);
    for (const 묶음 of ['초성', '중성', '종성']) for (const [자, 칸] of Object.entries(판[묶음])) assert.ok(칸.IPA, `${문자} ${묶음} ${자} IPA`);
  }
});

test('로마자는 영어판 reads 그대로 — 지마 · 화날때 판본과 관용구 퀴즈 say 줄', () => {
  const 끔 = { 된소리: false, ㅈㅊ뒤ㅕ: false };
  const 로 = 글 => 표기(발음으로(글, 끔), 'latin');
  const 판본 = [
    ['docs/마케팅/LAB_지마_mn_20261031/remotion/src/m22/판본/US.json', ['먹지 마', '눕지 마', '열지 마', '가지 마', '울지 마', '먹어']],
    ['docs/마케팅/LAB_화날때_mn_20261031/remotion/src/film/판본/US.json', ['짜증 나', '열받아', '어이없어', '억울해']],
  ];
  for (const [파일, 원문] of 판본) {
    const 판 = JSON.parse(fs.readFileSync(path.join(뿌리, 파일), 'utf8'));
    assert.deepStrictEqual(원문.map(로), 판.reads, 파일);
    if (판.endRead) assert.strictEqual(로('네, 사장님'), 판.endRead);
  }
  const say = [ // 관용구 · 시간 퀴즈 film/data.ts say: [한국어, 로마자]
    ['간 떨어질 뻔했어요', 'gan tteo-reo-jil ppeon-hae-sseo-yo'], ['간이 콩알만 해졌어요', 'ga-ni kong-al-man hae-jyeo-sseo-yo'],
    ['간이 크네요', 'ga-ni keu-ne-yo'], ['고양이 세수만 했어요', 'go-yang-i se-su-man hae-sseo-yo'], ['귀가 얇아요', 'gwi-ga yal-ba-yo'],
    ['김칫국 마시지 마요', 'gim-chit-guk ma-si-ji ma-yo'], ['눈이 높아요', 'nu-ni no-pa-yo'], ['물 건너갔어요', 'mul geon-neo-ga-sseo-yo'],
    ['물에 빠진 생쥐가 됐어요', 'mu-re ppa-jin saeng-jwi-ga dwae-sseo-yo'], ['미역국 먹었어요', 'mi-yeok-guk meo-geo-sseo-yo'],
    ['바람맞았어요', 'ba-ram-ma-ja-sseo-yo'], ['발이 넓어요', 'ba-ri neol-beo-yo'], ['배꼽 빠지겠어요', 'bae-kkop ppa-ji-ge-sseo-yo'],
    ['불 보듯 뻔해요', 'bul bo-deut ppeon-hae-yo'], ['세 시 삼십 분', 'se si sam-sip bun'], ['손이 커요', 'so-ni keo-yo'],
    ['식은 죽 먹기예요', 'si-geun juk meok-gi-ye-yo'], ['우물 안 개구리였어요', 'u-mul an gae-gu-ri-yeo-sseo-yo'],
    ['입이 무거워요', 'i-bi mu-geo-wo-yo'], ['파리만 날려요', 'pa-ri-man nal-lyeo-yo'], ['한 시 십 분', 'han si sip bun'],
    ['해가 서쪽에서 뜨겠어요', 'hae-ga seo-jjo-ge-seo tteu-ge-sseo-yo'], ['후안이에요', 'hu-a-ni-e-yo'],
    ['기예르모예요', 'gi-ye-reu-mo-ye-yo'], ['레히나예요', 're-hi-na-ye-yo'],
  ];
  for (const [글, 답] of say) assert.strictEqual(로(글), 답, 글);
  assert.strictEqual(표기('하느레 별 따기예요', 'latin'), 'ha-neu-re byeol tta-gi-ye-yo');
  assert.deepStrictEqual(['두근두근', '설레', '심쿵', '반했어', '몽글아', '안녕'].map(x => 표기(발음으로(x), 'latin')),
    ['du-geun-du-geun', 'seol-le', 'sim-kung', 'ban-hae-sseo', 'mong-geu-ra', 'an-nyeong']);
});

test('몽골 옛판(mn_1110)은 저장소 몽골판 읽는 법을 그대로 낸다 — 기존 편의 기준', () => {
  const mn = 표읽기().문자.mn;
  const 지마 = JSON.parse(fs.readFileSync(path.join(뿌리, 'docs/마케팅/LAB_지마_mn_20261031/remotion/src/m22/판본/MN.json'), 'utf8'));
  assert.deepStrictEqual(['먹지 마', '눕지 마', '열지 마', '가지 마', '울지 마', '머거'].map(x => 표기(x, 'mn_1110')), 지마.reads);
  const 화날때 = JSON.parse(fs.readFileSync(path.join(뿌리, 'docs/마케팅/LAB_화날때_mn_20261031/remotion/src/film/판본/MN.json'), 'utf8'));
  assert.strictEqual(표기('열바다', 'mn_1110'), 화날때.reads[1]);
  assert.strictEqual(표기('어구래', 'mn_1110'), 화날때.reads[3]);
  assert.strictEqual(표기('네, 사장님', 'mn_1110'), 화날때.endRead);
  assert.ok(mn.저장소읽기.length >= 70);
  for (const [발, 저장소, 출처] of mn.저장소읽기) assert.strictEqual(표기(발, 'mn_1110'), 저장소, `${발} (${출처})`);
  for (const g of mn.저장소갈림) assert.notStrictEqual(표기(g.발음글, 'mn_1110'), g.저장소, `${g.원문}: 옛판과 같다 — 갈림 목록에서 빼고 저장소읽기로 옮긴다`);
});

test('몽골 v3 — 적힌 규칙 쪽 정리 · 아르곤 · Fable 5.2 반영, 기존 편과 달라진 것은 README 목록에 있다', () => {
  const 예 = [
    ['한구거', 'хангүгө'], ['학꾜', 'хаггё'], ['괜차나', 'гүэнчана'], ['미안해', 'ми-анхэ'], ['조아', 'жо-а'],
    ['네, 사장님', 'нэ, сажан-ним'], ['섿', 'сэд'], ['잠깐만', 'жамгганман'], ['씨', 'шши'], ['돼써요', 'дүэссөё'],
    ['생쥐', 'сэн-жүй'], ['전화', 'жөнхуа'], ['와요', 'ваё'], ['휘', 'хүй'], ['고양이', 'гоян-и'], ['의사', 'иса'],
    ['감사함니다', 'гамсахамнида'], ['안녕하세요', 'аннёнхасэё'], ['머거', 'мөгө'],
    // Fable 5.2 P1-1: 받침 ㅇ은 ㄱ ㄲ ㅋ ㅎ 앞만 붙인다(그 밖 자음 앞 н은 뒤 자리에 동화) · P3-1 ㅟ 앞 ㅅ = ш
    ['정도', 'жөн-до'], ['장소', 'жан-со'], ['공부', 'гон-бү'], ['정말', 'жөн-мал'], ['공짜', 'гон-жжа'], ['사랑해', 'саранхэ'],
    ['항구', 'хангү'], ['쉬어요', 'шүйөё'], ['예뻐요', 'еббөё'],
  ];
  for (const [글, 답] of 예) assert.strictEqual(표기(글, 'mn'), 답, 글);
  // 바뀐 칸은 적힌 규칙(ㅓ=ө · ㅐㅔ=э · ㅡ=ы · ㅜ=ү)과 맞는다
  const 판 = 문자표('mn');
  assert.deepStrictEqual([판.중성.ㅓ.글자, 판.중성.ㅐ.글자, 판.중성.ㅔ.글자, 판.중성.ㅡ.글자, 판.중성.ㅜ.글자], ['ө', 'э', 'э', 'ы', 'ү']);
  const 본문 = fs.readFileSync(도구.README경로, 'utf8');
  assert.match(본문, /몽골판 기존 편과 달라짐/);
  let 다름 = 0;
  for (const [발, 저장소] of 표읽기().문자.mn.저장소읽기) {
    const 이제 = 표기(발, 'mn');
    if (이제 !== 저장소) { 다름 += 1; assert.ok(본문.includes(`| ${발} | ${저장소} | ${이제} |`), `README 달라짐 목록에 ${발}`); }
  }
  assert.ok(다름 > 0);
});

test('러시아 · 카자흐 · 키르기스 — 자리에 따른 글자 · 띄어쓰기 건너 울림 · 철자 고침', () => {
  const 예 = {
    ru: [['감사함니다', 'камсахамнида'], ['학꾜', 'хаккё'], ['진짜', 'чинчча'], ['가자', 'каджа'], ['가지', 'каджи'], ['가치', 'качи'], ['아버지', 'абоджи'], ['울지 마', 'ульджи ма'], ['괜차나', 'куэнчана'],
      ['반가워요', 'пангавоё'], ['와요', 'уаё'], ['귀', 'куи'], ['휘파람', 'хвипхарам'], ['잘 가요', 'чаль гаё'], ['네, 가요', 'нэ, каё'],
      ['몰라', 'молла'], ['고양이', 'коян-и'], ['머거', 'мого'], ['가쟈', 'каджа'], ['감사-함니다', 'камса-хамнида'],
      // Fable 5.2 P2-4 · P2-1: ㅎ 뒤 w-모음은 хв꼴, ㅋ ㅌ ㅍ ㅊ 뒤 ㅙ ㅚ ㅞ ㅟ는 в꼴
      ['회사', 'хвэса'], ['영화', 'ёнхва'], ['훨씬', 'хвольссин'], ['취미', 'чхвими'], ['퀴즈', 'кхвиджы'], ['최고', 'чхвэго'], ['만두', 'манду']],
    kk: [['안녕하세요', 'аннёңһасэё'], ['사랑해', 'сараңһэ'], ['배고파', 'пэгопһа'], ['괜차나', 'куэнчһана'], ['반가워요', 'панга-уөё'],
      ['학꾜', 'хаккё'], ['씨', 'щи'], ['귀', 'күй'], ['휘', 'хви'], ['잘 가요', 'чал гаё'], ['여기', 'йөги'], ['우아', 'у-а'],
      ['가지', 'каджи'], ['회사', 'хвэса'], ['취미', 'чһүйми'], ['오후에', 'оһу-э']],
    ky: [['가자', 'кажа'], ['잘 가요', 'жал гаё'], ['진짜', 'жинчча'], ['괜차나', 'куэнчана'], ['안녕하세요', 'аннёңхасэё'],
      ['반가워요', 'пангауоё'], ['귀', 'кү'], ['사랑해', 'сараңхэ'], ['머거', 'мөгө'], ['회사', 'хвэса'], ['쾌', 'кхвэ'], ['음식', 'ымсик']],
  };
  for (const [문자, 줄] of Object.entries(예)) for (const [글, 답] of 줄) assert.strictEqual(표기(글, 문자), 답, `${문자} ${글}`);
  const 키릴 = /^[Ѐ-ӿ\- ]*$/;
  for (const 문자 of 키릴들) {
    for (let c = 0xac00; c <= 0xd7a3; c += 7) {
      const 음절 = String.fromCodePoint(c);
      for (const 글 of [`${음절}${음절}`, `아${음절}`]) {
        let 낸;
        try { 낸 = 표기(글, 문자); } catch (e) { assert.ok(e.금칙, `${문자} ${글}: ${e.message}`); continue; }
        assert.match(낸, 키릴, `${문자} ${글}`);
        if (문자 !== 'mn') assert.ok(!/[чж][яю]/.test(낸), `${문자} ${글}: 틀린 철자 ${낸}`); // 몽골은 저장소 쓰임 없음 — 손대지 않음
      }
    }
  }
});

test('금칙 철자 — 욕설 꼴은 멈추고, 피할 수 있는 ㅎ+ㅟ는 хви로 돌린다', () => {
  const 멈춤 = [['후예', 'ru'], ['후이', 'ru'], ['후야', 'ru'], ['여보', 'ru'], ['예비', 'ru'], ['후이', 'ky'], ['여보', 'ky'], ['후예', 'kk'],
    ['겉', 'kk'], ['겉', 'ky'], ['쪼다', 'hi'], ['쭈다', 'hi'], ['쪼다', 'ne'], ['무지개', 'ne'], ['찍따', 'ne'], ['뿌띠', 'ne'], ['여보', 'mn'],
    // Fable 5.2: P1-3 오후에 охуэ · P2-5 좁고 жопкко · P2-6 식 сик · P2-7 구 गू · P2-8 쓰 ссы · P3-8 일기예보 ильгиебо
    ['오후에', 'ru'], ['오후에', 'ky'], ['좁꼬', 'ky'], ['식', 'ky'], ['식', 'kk'], ['구', 'hi'], ['쓰', 'ru'], ['싸', 'kk'], ['일기예보', 'ru']];
  for (const [글, 문자] of 멈춤) {
    assert.throws(() => 표기(글, 문자), e => e.금칙 && e.금칙.문자 === 문자 && /금칙 철자/.test(e.message), `${문자} ${글}`);
    assert.doesNotThrow(() => 표기(글, 문자, { 금칙: false }));
  }
  for (const 문자 of ['ru', 'kk']) assert.strictEqual(표기('휘', 문자), 'хви', 문자);
  assert.strictEqual(표기('휘', 'ky'), 'хү');
  assert.strictEqual(표기('휘', 'mn'), 'хүй'); // 몽골은 хүй가 고유어 철자(хүйтэн) — Fable 5.2 P2-3
  // 지나치게 막던 흔한 낱말은 지나간다(Fable 5.2 P2-1 · P2-2 · P2-3) — 낱말 안 сик · 만두 манду도
  const 지나감 = [['취미', 'ru'], ['퀴즈', 'ru'], ['튀김', 'ru'], ['취미', 'kk'], ['퀴즈', 'kk'], ['튀김', 'kk'], ['만드러요', 'ru'], ['만드러요', 'kk'],
    ['만드러요', 'ky'], ['만두', 'ru'], ['예뻐요', 'mn'], ['추워요', 'mn'], ['음식', 'ky'], ['친구', 'hi'], ['누구', 'hi'], ['그 사람', 'ne'], ['구', 'ne']];
  for (const [글, 문자] of 지나감) assert.doesNotThrow(() => 표기(글, 문자), `${문자} ${글}`);
  // ㅎ+모음 · ㅇ+모음 이음 전부: 멈추지 않은 결과에는 금칙 꼴이 없다(표기가 늘 검사한다는 것을 바깥에서 다시 확인)
  const 욕들 = { mn: /хуй|ху[иеёюяэ]|(^|[аэиоөуүыяеёю])ёб|^еб(?!б)/ }; // 몽골은 хүй를 막지 않는다
  const 욕 = /ху[йиеёюяэ]|х[уү]й|(^|[аеёиоуыэюяәөүұі])[её]б/;
  const 모음 = [...도구.중목록];
  for (const 문자 of 키릴들) {
    for (const a of 모음) for (const b of 모음) for (const 받침 of ['', 'ㅂ']) {
      const 첫 = String.fromCodePoint(0xac00 + 18 * 588 + 도구.중목록.indexOf(a) * 28);
      const 둘 = String.fromCodePoint(0xac00 + 11 * 588 + 도구.중목록.indexOf(b) * 28 + (받침 ? 17 : 0));
      for (const 글 of [`${첫}${둘}`, `${둘}${첫}`, 둘 + String.fromCodePoint(0xac00 + 7 * 588 + 8 * 28)]) {
        try { assert.ok(!(욕들[문자] || 욕).test(표기(글, 문자)), `${문자} ${글}`); } catch (e) { if (!e.금칙) throw e; }
      }
    }
  }
  for (const 낱말 of 도구.낱말예) for (const 문자 of 도구.문자차례) assert.doesNotThrow(() => 표기(발음으로(낱말), 문자), `${문자} ${낱말}`);
});

test('데바나가리 — NFC, 결합 문자는 바탕 글자 뒤에만, ZWJ · ZWNJ · 짠드라빈두 없음, ङ 합자 깨짐 없음', () => {
  const 자음 = /[क-ह]/;
  const 홀모음 = /[अ-औ]/;
  const 모음기호 = /[ा-ौ]/;
  const 살피기 = (낸, 이름, 문자) => {
    assert.strictEqual(낸, 낸.normalize('NFC'), `${이름} NFC`);
    assert.ok(!/[‌‍ँ]/.test(낸), `${이름}: ZWJ · ZWNJ · 짠드라빈두`);
    assert.ok(!/््/.test(낸), `${이름}: 할란트 겹침`);
    if (문자 === 'hi') assert.ok(!/ङ/.test(낸), `${이름}: 힌디 표는 ङ를 쓰지 않는다 — ${낸}`);
    if (문자 === 'ne') {
      assert.ok(!/ं/.test(낸), `${이름}: 네팔 표는 아누스와라를 쓰지 않는다`);
      assert.ok(!/ङ्(?=[क-ह])(?![कखगघ])/.test(낸), `${이름}: ङ् 뒤 비연구개 자음 합자 — ${낸}`);
    }
    const 글 = [...낸];
    글.forEach((ch, i) => {
      const 앞 = 글[i - 1] || '';
      if (모음기호.test(ch) || ch === '्') assert.ok(자음.test(앞), `${이름}: ${낸} — ${i}번째 ${ch} 앞이 자음이 아니다`);
      if (ch === 'ं') assert.ok(자음.test(앞) || 모음기호.test(앞) || 홀모음.test(앞), `${이름}: ${낸} — 아누스와라 앞`);
    });
  };
  for (const 문자 of 데바들) {
    for (let c = 0xac00; c <= 0xd7a3; c += 3) {
      const 음절 = String.fromCodePoint(c);
      for (const 글 of [`${음절}${음절}`, `아${음절}`, `${음절}하`, `${음절}아`]) {
        let 낸;
        try { 낸 = 표기(글, 문자); } catch (e) { assert.ok(e.금칙 && e.금칙.종류 !== '글꼴', `${문자} ${글}: ${e.message}`); continue; }
        살피기(낸, `${문자} ${글}`, 문자);
      }
    }
    for (const 낱말 of 도구.낱말예) 살피기(표기(발음으로(낱말), 문자), `${문자} ${낱말}`, 문자);
  }
  const 예 = {
    hi: [['감사함니다', 'गाम्साहाम्नीदा'], ['까 가 카', 'का गा खा'], ['머거', 'मगॉ'], ['시러', 'शीरॉ'], ['사랑해', 'सारांहे'],
      ['안녕하세요', 'आन्न्यंहासेयो'], ['대박', 'देबाक'], ['잘 가요', 'जाल गायो'], ['씨', 'शी'], ['마시써', 'माशीस्सॉ'], ['의사', 'अईसा'], ['샤', 'श्या']],
    ne: [['머거', 'मगअ'], ['시러', 'सीरअ'], ['한구거', 'हान्गूगअ'], ['마시써', 'मासीस्स'], ['반가워요', 'बान्गाउअयो'], ['와', 'उआ'],
      ['왜', 'उए'], ['위', 'उई'], ['안녕하세요', 'आन्न्यङ्-हासेयो'], ['강가', 'गाङ्गा'], ['대박', 'देबाक्'], ['보여', 'बोयअ'], ['시', 'सी'], ['머', 'म']],
  };
  for (const [문자, 줄] of Object.entries(예)) for (const [글, 답] of 줄) assert.strictEqual(표기(글, 문자), 답, `${문자} ${글}`);
});

test('한글 밖 글자 · 문장부호 · 띄어쓰기는 그대로, 풀어 쓴 한글도 받는다', () => {
  assert.strictEqual(표기('안녕, Hi! 123 «네»', 'ru'), 'аннён, Hi! 123 «нэ»');
  assert.strictEqual(표기('한'.normalize('NFD'), 'mn'), 'хан');
  assert.strictEqual(표기('안녕  가요', 'ru'), 'аннён  каё'); // 띄어쓰기 둘은 끊긴 것으로 본다
  assert.throws(() => 표기('가', 'xx'), /모르는 문자/);
});

test('아르곤 검수 기록 — 처리 셋 중 하나 · 까닭 있음 · 바꾼 칸은 표에 있는 칸', () => {
  const 표 = 표읽기();
  const 행이름 = new Set([...도구.초목록.map(x => `첫 ${x}`), ...도구.중목록, ...도구.대표받침.map(x => `받침 ${x}`)]);
  const 항목 = 표.아르곤검수.항목;
  assert.ok(항목.length >= 40);
  for (const x of 항목) {
    assert.ok(['받음', '일부', '안 받음'].includes(x.처리), JSON.stringify(x));
    assert.ok(x.지적 && x.까닭 && 표.문자[x.문자], JSON.stringify(x));
    for (const 칸 of x.칸) assert.ok(행이름.has(칸), `${x.문자} 칸 이름 ${칸}`);
  }
  for (const 문자 of ['ru', 'mn', 'kk', 'ky', 'hi', 'ne']) assert.ok(항목.some(x => x.문자 === 문자), 문자);
  assert.ok(항목.some(x => x.문자 === 'ru' && /금칙/.test(x.지적)), '금칙 철자 항목');
});

test('README 자동 칸이 json에서 만든 것과 같다', () => {
  const 본문 = fs.readFileSync(도구.README경로, 'utf8');
  assert.ok(본문.includes(도구.자동시작) && 본문.includes(도구.자동끝), 'README에 자동 칸 표시');
  assert.strictEqual(도구.README자동칸바꾸기(본문), 본문, 'README 표가 json과 갈렸다 — node tools/lib/한글표기.js --README');
  assert.match(본문, /### 아르곤 검수 반영 \(11-11\)/);
});

test('질문지 — 다시 검수는 바뀐 칸만, --전체는 온 표와 낱말 예 20', () => {
  for (const 문자 of ['mn', 'ru', 'kk', 'ky', 'hi', 'ne']) {
    const 다시 = 도구.질문지(문자);
    assert.match(다시, /다시 검수 — 바뀐 칸만/);
    assert.match(다시, /모름/);
    assert.match(다시, /그대로 써도 된다/);
    for (const 낱말 of 도구.낱말예) assert.ok(다시.includes(`| ${낱말} |`), `${문자} ${낱말}`);
    const 바뀐칸 = new Set(표읽기().아르곤검수.항목.filter(x => x.문자 === 문자 && x.처리 !== '안 받음').flatMap(x => x.칸));
    for (const 칸 of 바뀐칸) assert.ok(다시.includes(`| ${칸} |`), `${문자} 바뀐 칸 ${칸}`);
    const 행수 = (다시.match(/^\| (첫 |받침 )?[ㄱ-ㅣ] \|/gm) || []).length;
    assert.ok(행수 < 47, `${문자} 다시 검수에 온 표가 들어갔다`);
    const 전체 = 도구.질문지(문자, { 전체: true });
    assert.ok(전체.includes('| 받침 ㅇ |') && 전체.includes('| 첫 ㄱ |') && 전체.includes('| ㅢ |'), 문자);
  }
  assert.match(도구.질문지('latin'), /표기표 검수$/m);
});

test('발음줄 · 음절표기 — 금칙에 걸린 줄은 로마자로, 음절은 낱말 문맥을 지키고 칸마다 금칙(Fable 5.2 P2-9 · P2-10)', () => {
  const { 발음줄, 음절표기 } = 도구;
  assert.deepStrictEqual(발음줄('배고파', 'ru'), { 줄: 'пэгопха', 문자: 'ru' });
  const 걸림 = 발음줄('오후에', 'ru');
  assert.strictEqual(걸림.문자, 'latin');
  assert.strictEqual(걸림.줄, 'o-hu-e');
  assert.strictEqual(걸림.금칙.문자, 'ru');
  // 음절마다: 낱말 줄과 같은 꼴(따로 표기하면 HI 머 = मॉ, RU 자 = ча로 달라진다)
  assert.deepStrictEqual(음절표기('머거', 'hi'), ['म', 'गॉ']);
  assert.strictEqual(음절표기('머거', 'hi').join(''), 표기('머거', 'hi'));
  assert.deepStrictEqual(음절표기('가자', 'ru'), ['ка', 'джа']);
  assert.deepStrictEqual(음절표기('정도', 'mn'), ['жөн', 'до']); // 받침 꼴 끝 하이픈은 칸 경계라 뺀다
  assert.deepStrictEqual(음절표기('배고파', 'mn'), ['бэ', 'го', 'па']);
  assert.strictEqual(음절표기('배-고-파', 'mn').length, 3);
  // 낱말 줄은 지나가도 칸에 홀로 서는 꼴은 멈춘다 → 발음줄 음절은 로마자
  assert.strictEqual(표기('음식', 'ky'), 'ымсик');
  assert.throws(() => 음절표기('음식', 'ky'), e => e.금칙 && e.금칙.낸 === 'сик');
  assert.deepStrictEqual(발음줄('음식', 'ky', { 음절: true }), { 음절: ['eum', 'sik'], 문자: 'latin', 금칙: { 문자: 'ky', 찾기: '^сик$', 종류: '말', 낸: 'сик' } });
  for (const 낱말 of 도구.낱말예) for (const 문자 of 도구.문자차례) {
    const 발 = 발음으로(낱말);
    const r = 발음줄(발, 문자, { 음절: true });
    assert.strictEqual(r.음절.length, [...발].filter(ch => /[가-힣]/.test(ch)).length, `${문자} ${낱말}`);
  }
});

test('Fable 5.2 검수 기록 — 여섯 문자 판정 · P1은 모두 받음 · 처리 셋 중 하나', () => {
  const 검 = 표읽기().Fable검수;
  assert.ok(검 && 검.항목.length >= 15);
  assert.deepStrictEqual(Object.keys(검.판정).sort(), ['hi', 'kk', 'ky', 'mn', 'ne', 'ru']);
  for (const x of 검.항목) {
    assert.ok(['받음', '일부', '안 받음'].includes(x.처리), JSON.stringify(x));
    assert.ok(x.번호 && x.지적 && x.까닭, JSON.stringify(x));
    for (const c of x.문자) assert.ok(표읽기().문자[c], `${x.번호} 문자 ${c}`);
  }
  for (const 번호 of ['P1-1', 'P1-2', 'P1-3', 'P1-4']) assert.strictEqual(검.항목.find(x => x.번호 === 번호)?.처리, '받음', 번호);
  const 본문 = fs.readFileSync(도구.README경로, 'utf8');
  assert.match(본문, /### Fable 5\.2 다시 검수 반영 \(11-11, v3\)/);
});
