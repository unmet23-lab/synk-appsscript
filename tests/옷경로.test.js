/**
 * 옷 그림 «이름 규칙»을 지킨다 (2026-09-08).
 *
 * 왜 있나 — 같은 차림이 두 이름을 가지면 앱이 파일을 못 찾는다.
 *   「목도리+3급왕관」과 「3급왕관+목도리」가 둘 다 나오면 그 순간 자산 절반이 미아가 된다.
 *   그래서 이름은 «목록에 적힌 차례»로만 난다.
 */
'use strict';

/* 🔴 [09-08] `describe`·`it` 은 전역이 아니다 — `node:test` 에서 꺼내 와야 한다.
 *   빠져 있어서 이 파일이 첫 줄에서 죽었고, 저장소 «전체» 초록을 요구하는 배포 게이트가
 *   그 빨강 하나로 남의 배포까지 막고 있었다. */
const { describe, it } = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const L = require(path.join(__dirname, '..', 'tools', 'lib', '옷목록.js'));

const 저장소 = path.join(__dirname, '..');

describe('옷 그림 이름 규칙', () => {
  it('겹쳐 입은 이름은 넣은 차례가 아니라 «목록 차례»로 난다', () => {
    const a = L.옷토막('까몽', ['목도리', '3급 왕관']);
    const b = L.옷토막('까몽', ['3급 왕관', '목도리']);
    assert.strictEqual(a, b, '넣는 차례가 바뀌면 다른 이름이 난다 — 자산이 미아가 된다');
    assert.ok(!a.includes(' '), `이름에 빈칸이 남았다 — ${a}`);
  });

  it('목록에 없는 옷은 이름을 안 낸다', () => {
    assert.throws(() => L.옷토막('까몽', ['없는옷']), /목록에 없다/);
  });

  it('표정이 있으면 표정 방으로, 없으면 옷만 있는 방으로 간다', () => {
    assert.ok(L.옷경로('까몽', ['목도리']).includes('_누끼_틀_avif'));
    assert.ok(L.옷경로('까몽', ['목도리'], '윙크').includes('_표정_누끼_틀_avif'));
  });

  it('모르는 방을 부르면 조용히 빈 경로를 내지 않는다', () => {
    assert.throws(() => L.옷경로('까몽', ['목도리'], null, '없는방'), /그런 방이 없다/);
  });

  it('앱이 읽는 꼴은 avif · 중간 방은 png 다', () => {
    assert.ok(L.옷경로('까몽', ['목도리'], '윙크', '앱').endsWith('.avif'));
    assert.ok(L.옷경로('까몽', ['목도리'], '윙크', '표정틀').endsWith('.png'));
  });

  it('차림 수는 「의상 최대 1 + 악세 최대 2」로 센다 (유호 확정 09-06)', () => {
    const c = L.차림수('까몽');
    const 둘씩 = (c.악세 * (c.악세 - 1)) / 2;
    assert.strictEqual(c.한벌, c.의상 + c.악세);
    assert.strictEqual(c.두벌, c.의상 * c.악세 + 둘씩);
    assert.strictEqual(c.세벌, c.의상 * 둘씩);
    assert.strictEqual(c.전부, c.한벌 + c.두벌 + c.세벌);
  });

  /* 🔴 이 시험은 «지금 있는 자산»을 잰다 — 자산이 늘면 같이 늘어야 한다.
     경로 함수가 실물과 어긋나면 앱이 빈 그림을 얹는다. */
  it('경로 함수가 실제로 있는 파일을 가리킨다', () => {
    const 볼것 = [
      ['까몽', ['목도리'], null, '틀'],
      ['까몽', ['목도리'], '윙크', '표정틀'],
      ['까몽', ['목도리'], '눈감음', '표정틀'],
    ];
    for (const [m, o, e, d] of 볼것) {
      const p = path.join(저장소, L.옷경로(m, o, e, d));
      if (!fs.existsSync(path.dirname(p))) return;      // 자산을 안 받은 기계에서는 건너뛴다
      assert.ok(fs.existsSync(p), `경로 함수가 없는 파일을 가리킨다 — ${L.옷경로(m, o, e, d)}`);
    }
  });
});
