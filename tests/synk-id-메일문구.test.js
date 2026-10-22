'use strict';

/* SYNK ID 가입 확인·비밀번호 재설정·이메일 변경 메일(tools/synk-id/auth-settings.js --메일문구)을 운영에 넣기 전에
 * 깨진 틀을 막는다. Supabase는 틀을 보낼 때 Go 템플릿으로 풀고, 풀지 못하면 그 메일이 나가지 않아 가입이 멈춘다. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAILS } = require('../tools/synk-id/auth-settings.js');

const KINDS = ['confirmation', 'recovery', 'email_change'];
// Supabase 메일 틀이 이 세 메일에 주는 값 중 우리가 쓰는 것만.
const FIELDS = new Set(['.ConfirmationURL', '.Email', '.NewEmail', '.SiteURL', '.TokenHash']);

test('세 메일마다 제목과 본문이 있고, 칸 이름은 Supabase 템플릿 칸뿐이다', () => {
  assert.deepEqual(Object.keys(MAILS).sort(), KINDS.flatMap(k => [`mailer_subjects_${k}`, `mailer_templates_${k}_content`]).sort());
  for (const [key, value] of Object.entries(MAILS)) {
    assert.equal((value.match(/{{/g) || []).length, (value.match(/}}/g) || []).length, `${key}: 여닫는 괄호 수`);
    for (const [, field] of value.matchAll(/{{\s*([^}]*?)\s*}}/g)) assert.ok(FIELDS.has(field), `${key}: 모르는 칸 {{ ${field} }}`);
    // 「{{ .Email }}}」처럼 남는 괄호 하나는 위 셈을 지나 본문에 그대로 찍힌다.
    assert.ok(!/[{}]/.test(value.replace(/{{ \.[A-Za-z]+ }}/g, '')), `${key}: 짝 없는 중괄호`);
    // html/template은 따옴표·태그가 열린 채 끝난 자리의 칸을 보낼 때 풀지 못한다.
    for (const tag of ['div', 'h2', 'p', 'a']) {
      assert.equal(value.match(new RegExp(`<${tag}[ >]`, 'g'))?.length, value.match(new RegExp(`</${tag}>`, 'g'))?.length, `${key}: <${tag}> 여닫기`);
    }
    assert.equal((value.match(/"/g) || []).length % 2, 0, `${key}: 따옴표 짝`);
  }
});

test('본문은 확인 단추 하나로 이어지고, 한국어·영어·몽골어가 다 있다', () => {
  for (const kind of KINDS) {
    const body = MAILS[`mailer_templates_${kind}_content`], subject = MAILS[`mailer_subjects_${kind}`];
    // 재설정 메일은 어느 브라우저·기기에서나 열리는 token-hash 링크(PKCE 확인 링크는 요청한 브라우저에서만 열렸다).
    const link = kind === 'recovery' ? 'href="{{ .SiteURL }}/id/?view=reset&token_hash={{ .TokenHash }}&type=recovery"' : 'href="{{ .ConfirmationURL }}"';
    assert.equal(body.split(link).length - 1, 1, `${kind}: 확인 링크는 단추 하나`);assert.equal((body.match(/href=/g) || []).length, 2, `${kind}: 단추와 synk.im 줄 말고 다른 링크 없음`);
    assert.ok(kind !== 'recovery' || !body.includes('.ConfirmationURL'), 'recovery: PKCE 확인 링크를 쓰지 않는다');
    assert.match(subject, /^SYNK [가-힣 ]+ · [A-Za-z ]*SYNK[A-Za-z -]*$/, `${kind}: 제목은 한국어 · 영어`);
    assert.match(body, /<p lang="en"[^>]*>[A-Za-z]/, `${kind}: 영어 줄`);
    assert.match(body, /<p lang="mn"[^>]*>[^<]*[А-Яа-яӨөҮү]/, `${kind}: 몽골어 줄`);
    assert.ok(!body.includes('{{ .NewEmail }}') || kind === 'email_change', `${kind}: 새 주소 칸은 이메일 변경에만`);
  }
});

test('보내는 주소로 온 답장도 받으므로 「답장할 수 없어요」라고 쓰지 않는다', () => {
  for (const value of Object.values(MAILS)) assert.ok(!/답장할 수 없/.test(value));
});
