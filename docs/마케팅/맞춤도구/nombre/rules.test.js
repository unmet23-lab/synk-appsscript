'use strict';
// node --test docs/마케팅/맞춤도구/nombre/rules.test.js
// 기대값: 국립국어원 외래어 표기법(표 2·제4절, 표 17·제19절)의 보기와 외래어 표기 용례 조사(fixtures/, 탐색노트.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('./rules.js');
const D = require('./names.js');
const NAMES = require('./fixtures/names.json');
const PT_OFFICIAL = require('./fixtures/pt-official.json').examples;

const ES_OFFICIAL = {
  biz: '비스', blandon: '블란돈', braceo: '브라세오', colcren: '콜크렌', Cecilia: '세실리아', coccion: '콕시온', bistec: '비스텍', dictado: '딕타도',
  chicharra: '치차라', felicidad: '펠리시다드', fuga: '푸가', fran: '프란', ganga: '강가', geologia: '헤올로히아', yungla: '융글라', hipo: '이포',
  quehacer: '케아세르', jueves: '후에베스', reloj: '렐로', kapok: '카포크', lacrar: '라크라르', Lulio: '룰리오', ocal: '오칼', llama: '야마',
  lluvia: '유비아', membrete: '멤브레테', noche: '노체', flan: '플란', 'ñoñez': '뇨녜스', 'mañana': '마냐나', pepsina: '펩시나', 'plantón': '플란톤',
  quisquilla: '키스키야', rascador: '라스카도르', sastreria: '사스트레리아', tetraetro: '테트라에트로', viudedad: '비우데다드', 'xenón': '세논',
  laxante: '락산테', yuxta: '육스타', zagal: '사갈', liquidez: '리키데스', walkirias: '왈키리아스', guerra: '게라', queso: '케소', Guipuzcoa: '기푸스코아',
  antiguo: '안티구오', 'Quórum': '쿠오룸', Nicaragua: '니카라과', Quarai: '콰라이', carrera: '카레라', carretera: '카레테라', accion: '악시온',
  cifra: '시프라', georgico: '헤오르히코', giganta: '히간타', coquito: '코키토', gato: '가토', xilofono: '실로포노', blanco: '블랑코',
};

test('에스파냐어: 표 2와 제4절의 공식 보기 60개', () => {
  for (const [w, ko] of Object.entries(ES_OFFICIAL)) assert.equal(N.es(w).text, ko, w);
});

test('에스파냐어: 멕시코 다빈도 이름 120개가 조사의 규칙 적용 결과와 같다', () => {
  for (const x of NAMES.es) assert.equal(N.convert(x.name, 'es').text, x.rule, x.name);
});

test('포르투갈어: 표 17과 제19절의 보기(관용 2개는 lookup 예외로)', () => {
  for (const x of PT_OFFICIAL) {
    const lang = x.br ? 'br' : 'pt';
    assert.equal(N.lookup(x.w, lang, D).text.replace(/ /g, ''), x.h, x.w + (x.br ? '(브)' : ''));
  }
});

test('포르투갈어: 이름 130개가 포르투갈식·브라질식 규칙 결과와 같다', () => {
  for (const x of NAMES.pt) {
    assert.equal(N.convert(x.name, 'pt').text, x.pt, x.name + ' 포');
    assert.equal(N.convert(x.name, 'br').text, x.br, x.name + ' 브');
  }
});

test('용례가 규칙과 다른 이름은 용례를 앞에 두고 규칙 표기를 후보로', () => {
  const joao = N.lookup('João', 'br', D);
  assert.equal(joao.text, '주앙');
  assert.deepEqual(joao.words[0].alts.map((a) => a.ko), ['조앙']);
  assert.equal(N.lookup('Eduardo', 'br', D).text, '에두아르두');
  assert.equal(N.lookup('Montserrat', 'es', D).text, '몬세라트');
  assert.equal(N.lookup('Rodrigues', 'pt', D).text, '호드리게스');
  assert.equal(N.lookup('Rodrigues', 'br', D).text, '호드리기스');
});

test('두 가지로 쓰는 이름: Ximena·Itzel·Isabella·Elisa', () => {
  assert.deepEqual(N.lookup('Ximena', 'es', D).words[0].alts, [{ ko: '히메나', why: 'x-mexico' }]);
  assert.deepEqual(N.lookup('Itzel', 'es', D).words[0].alts, [{ ko: '이첼', why: 'tz-sound' }]);
  assert.deepEqual(N.lookup('Isabella', 'es', D).words[0].alts, [{ ko: '이사벨라', why: 'll-italian' }]);
  const elisa = N.lookup('Elisa', 'br', D);
  assert.equal(elisa.text, '일리자');
  assert.deepEqual(elisa.words[0].alts, [{ ko: '엘리자', why: 'e-initial' }]);
});

test('소사는 뒤에 붙여 쓰고 접속사 y는 「이」(용례)', () => {
  assert.equal(N.lookup('Felipe de Jesús', 'es', D).text, '펠리페 데헤수스');
  assert.equal(N.lookup('Fernando de la Rúa', 'es', D).text, '페르난도 데라루아');
  assert.equal(N.lookup('Santiago Ramón y Cajal', 'es', D).text, '산티아고 라몬 이 카할');
  assert.equal(N.lookup('Gabriel da Silva', 'br', D).text, '가브리에우 다시우바');
});

test('같은 이름도 언어마다 다르다: José 호세 / 조제', () => {
  const r = N.lookup('José', 'es', D);
  assert.equal(r.text, '호세');
  assert.equal(r.other.br, '조제');
});

test('영어는 용례 목록만: Sarah 세라(흔히 사라), Jennifer 제니퍼, 목록에 없으면 비운다', () => {
  const sarah = N.lookup('Sarah', 'en', D);
  assert.equal(sarah.text, '세라');
  assert.deepEqual(sarah.words[0].alts, [{ ko: '사라', why: 'common' }]);
  assert.equal(N.lookup('Jennifer', 'en', D).text, '제니퍼');
  const miss = N.lookup('Jennifer Lopez', 'en', D);
  assert.equal(miss.missing, true);
  assert.equal(miss.words[1].source, 'missing');
});

test('자기소개 문장과 읽기 도우미', () => {
  assert.equal(N.intro('호르헤'), '제 이름은 호르헤예요.');
  assert.equal(N.intro('카를로스 산체스'), '제 이름은 카를로스 산체스예요.');
  assert.equal(N.intro('마르틴'), '제 이름은 마르틴이에요.');
  assert.equal(N.readAloud('펠리페'), 'pel·li·pe');
  assert.equal(N.readAloud('호르헤'), 'ho·reu·he');
});

test('된소리를 쓰지 않는다(제1장 제4항): Pablo 파블로, Pedro 페드루', () => {
  assert.equal(N.lookup('Pablo', 'es', D).text, '파블로');
  assert.equal(N.lookup('Pedro', 'br', D).text, '페드루');
  assert.equal(N.lookup('Tomás', 'es', D).text, '토마스');
});
