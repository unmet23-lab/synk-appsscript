#!/usr/bin/env node
// SYNK ID login settings on one talk project: shows them, and with --적용 sets what the SYNK login
// path needs (site address https://synk.im, the consent page as OAuth 2.1 authorization path, allowed
// return addresses, sign-up open). Rehearsal by default; production with --운영.
// With --메일문구 it also sets SYNK's Korean/English sign-up, password-reset and email-change mails;
// Supabase allows that only after a custom SMTP sender is configured on the project.
// Prints settings only, never keys or secrets.
'use strict';
const { target, management, projectName } = require('./lib.js');

const SHOW = ['site_url', 'uri_allow_list', 'disable_signup', 'mailer_autoconfirm', 'external_email_enabled', 'password_min_length',
  'oauth_server_enabled', 'oauth_server_authorization_path', 'oauth_server_allow_dynamic_registration', 'smtp_host', 'rate_limit_email_sent',
  'mailer_subjects_confirmation'];
const foot = '<p style="color:#6b6f7b;font-size:13px">SYNK · <a href="https://synk.im/">synk.im</a> · 문의 hello@synk.im<br>'
  + '이 메일에는 답장할 수 없어요. 비밀번호나 인증번호는 누구에게도 알려 주지 마세요.</p>';
const mail = (title, lines, button, english) => `<h2>${title}</h2>\n${lines.map(line => `<p>${line}</p>`).join('\n')}\n`
  + `<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#ff6b5c;color:#ffffff;text-decoration:none;font-weight:700">${button}</a></p>\n`
  + `<p style="color:#6b6f7b;font-size:13px">${english}</p>\n${foot}`;
const MAILS = {
  mailer_subjects_confirmation: 'SYNK 가입을 확인해 주세요 · Confirm your SYNK sign-up',
  mailer_templates_confirmation_content: mail('SYNK 가입을 확인해 주세요',
    ['아래 단추를 누르면 {{ .Email }} 주소로 SYNK 계정 가입이 끝나요.', '직접 가입하지 않았다면 이 메일은 무시해 주세요. 링크는 한 번만 쓸 수 있고 1시간 뒤 만료돼요.'],
    '가입 확인하기', 'Confirm your SYNK sign-up for {{ .Email }} with the button above. If you did not sign up, ignore this email. The link works once and expires in an hour.'),
  mailer_subjects_recovery: 'SYNK 비밀번호를 다시 정해 주세요 · Reset your SYNK password',
  mailer_templates_recovery_content: mail('SYNK 비밀번호를 다시 정해 주세요',
    ['{{ .Email }} 계정의 비밀번호를 다시 정하는 요청을 받았어요. 아래 단추를 눌러 새 비밀번호를 정해 주세요.', '직접 요청하지 않았다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요. 링크는 1시간 뒤 만료돼요.'],
    '새 비밀번호 정하기', 'Reset the password for {{ .Email }} with the button above. If you did not ask for this, ignore this email; nothing changes. The link expires in an hour.'),
  mailer_subjects_email_change: 'SYNK 새 이메일 주소를 확인해 주세요 · Confirm your new email',
  mailer_templates_email_change_content: mail('새 이메일 주소를 확인해 주세요',
    ['SYNK 계정의 이메일을 {{ .Email }}에서 {{ .NewEmail }}(으)로 바꾸는 요청을 받았어요. 아래 단추를 누르면 바뀌어요.', '직접 요청하지 않았다면 이 메일은 무시하고 hello@synk.im으로 알려 주세요.'],
    '새 주소 확인하기', 'Confirm {{ .NewEmail }} as the new email for your SYNK account with the button above. If you did not ask for this, ignore this email and tell hello@synk.im.'),
};

(async () => {
  const t = target(), mails = process.argv.includes('--메일문구');
  const read = () => management(t.ref, '/config/auth').then(r => r.json());
  const show = c => Object.fromEntries(SHOW.map(k => [k, k === 'smtp_host' ? (c[k] ? '(set)' : '(none)') : c[k]]));
  const now = await read();
  console.log(`target ▸ ${await projectName(t.ref)} (${t.ref})`);
  console.log('now:', JSON.stringify(show(now)));
  if (!t.apply) { console.log('(not changed; add --적용)'); return; }
  const allow = [...new Set([...(now.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean), `https://synk.im${t.portalPath}**`, 'synktalk://oauth/callback'])].join(',');
  const patch = { site_url: 'https://synk.im', uri_allow_list: allow, oauth_server_enabled: true, oauth_server_authorization_path: t.portalPath,
    oauth_server_allow_dynamic_registration: false, disable_signup: false };
  if (mails) {
    if (!now.smtp_host) throw new Error('Supabase only lets custom mails go out through a custom SMTP sender: set SMTP on the project first.');
    Object.assign(patch, MAILS);
  }
  const res = await management(t.ref, '/config/auth', { method: 'PATCH', body: JSON.stringify(patch) });
  console.log('patch: HTTP', res.status, res.ok ? '' : (await res.text()).slice(0, 300));
  console.log('after:', JSON.stringify(show(await read())));
  process.exitCode = res.ok ? 0 : 1;
})().catch(e => { console.error(String(e.message || e)); process.exitCode = 1; });
