#!/usr/bin/env node
// SYNK ID login settings on one talk project: shows them, and with --적용 sets what the SYNK login
// path needs (site address https://synk.im, the consent page as OAuth 2.1 authorization path, allowed
// return addresses, sign-up open). Rehearsal by default; production with --운영.
// With --메일문구 it sets only SYNK's sign-up, password-reset and email-change mails (Korean, with English
// and Mongolian lines), so a mail fix never reopens sign-up or widens return addresses changed on the dashboard;
// Supabase takes custom mails only after a custom SMTP sender is configured on the project.
// Every run prints the fields that differ from the project now, and --적용 sends only those.
// Prints settings only, never keys or secrets.
'use strict';

const SHOW = ['site_url', 'uri_allow_list', 'disable_signup', 'mailer_autoconfirm', 'external_email_enabled', 'password_min_length',
  'oauth_server_enabled', 'oauth_server_authorization_path', 'oauth_server_allow_dynamic_registration', 'smtp_host', 'rate_limit_email_sent',
  'mailer_subjects_confirmation', 'mailer_subjects_recovery', 'mailer_subjects_email_change'];
// The mails say their links expire in an hour, which is the project's mailer_otp_exp.
const LINK_SECONDS = 3600;
// Colours of the SYNK ID page the person just used (experiences/synk-account/assets/scrapbook.css: ink, muted, brand).
const muted = 'color:#565a61;font-size:13px';
const foot = `<p style="${muted}">SYNK · <a href="https://synk.im/">synk.im</a> · 문의 hello@synk.im<br>`
  + '비밀번호나 인증번호는 누구에게도 알려 주지 마세요.</p>';
// keep-all wraps Korean at spaces (a phone otherwise leaves 「요」 alone on the last line); long addresses still break.
// The reset mail links straight to the SYNK ID page with a token hash, which works in any browser or device;
// the PKCE {{ .ConfirmationURL }} needed the browser that asked (10-22 「비번 까먹으면 아예 방법이 없네」).
// The page uses the one-time token only after a tap, so a mail scanner opening links cannot spend it.
const RECOVERY_LINK = '{{ .SiteURL }}/id/?view=reset&token_hash={{ .TokenHash }}&type=recovery';
const mail = (title, lines, button, english, mongolian, href = '{{ .ConfirmationURL }}') => `<div style="max-width:520px;color:#10131a;line-height:1.6;word-break:keep-all;overflow-wrap:break-word">\n`
  + `<h2 style="font-size:20px;line-height:1.4">${title}</h2>\n`
  + `${lines.map(line => `<p>${line}</p>`).join('\n')}\n`
  + `<p><a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#3d6bc9;color:#ffffff;text-decoration:none;font-weight:700">${button}</a></p>\n`
  + `<p lang="en" style="${muted}">${english}</p>\n<p lang="mn" style="${muted}">${mongolian}</p>\n${foot}\n</div>`;
const MAILS = {
  mailer_subjects_confirmation: 'SYNK 가입을 확인해 주세요 · Confirm your SYNK sign-up',
  mailer_templates_confirmation_content: mail('SYNK 가입을 확인해 주세요',
    ['아래 단추를 누르면 {{ .Email }} 주소로 SYNK 계정 가입이 끝나요.', '직접 가입하지 않았다면 이 메일은 무시해 주세요. 링크는 한 번만 쓸 수 있고 1시간 뒤 만료돼요.'],
    '가입 확인하기', 'Confirm your SYNK sign-up for {{ .Email }} with the button above. If you did not sign up, ignore this email. The link works once and expires in an hour.',
    'Дээрх товчийг дарж {{ .Email }} хаягаар үүсгэсэн SYNK бүртгэлээ баталгаажуулна уу. Хэрэв та бүртгүүлээгүй бол энэ имэйлийг үл тоомсорлож болно. Холбоосыг зөвхөн нэг удаа ашиглах боломжтой бөгөөд 1 цагийн дараа хүчингүй болно.'),
  mailer_subjects_recovery: 'SYNK 비밀번호를 다시 정해 주세요 · Reset your SYNK password',
  mailer_templates_recovery_content: mail('SYNK 비밀번호를 다시 정해 주세요',
    ['{{ .Email }} 계정의 비밀번호를 다시 정하는 요청을 받았어요. 아래 단추를 눌러 새 비밀번호를 정해 주세요.', '직접 요청하지 않았다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요. 링크는 1시간 뒤 만료돼요.'],
    '새 비밀번호 정하기', 'Reset the password for {{ .Email }} with the button above. If you did not ask for this, ignore this email; nothing changes. The link expires in an hour.',
    'Дээрх товчийг дарж {{ .Email }} хаягтай бүртгэлийн нууц үгээ шинээр тохируулна уу. Хэрэв та энэ хүсэлтийг гаргаагүй бол энэ имэйлийг үл тоомсорлож болно. Таны нууц үг өөрчлөгдөхгүй. Холбоос 1 цагийн дараа хүчингүй болно.', RECOVERY_LINK),
  // Secure email change is on (mailer_secure_email_change_enabled), so this mail goes to both addresses
  // and the change completes only after both are confirmed.
  mailer_subjects_email_change: 'SYNK 이메일 변경을 확인해 주세요 · Confirm your SYNK email change',
  mailer_templates_email_change_content: mail('SYNK 이메일 변경을 확인해 주세요',
    ['SYNK 계정의 이메일을 {{ .Email }}에서 {{ .NewEmail }} 주소로 바꾸는 요청을 받았어요. 두 주소로 보낸 메일의 단추를 모두 누르면 바뀌어요.', '직접 요청하지 않았다면 이 메일은 무시하고 hello@synk.im으로 알려 주세요. 링크는 1시간 뒤 만료돼요.'],
    '변경 확인하기', 'Confirm the change of your SYNK email from {{ .Email }} to {{ .NewEmail }} with the button above; it completes once both addresses are confirmed. If you did not ask for this, ignore this email and let us know at hello@synk.im. The link expires in an hour.',
    'SYNK бүртгэлийн имэйл хаягийг солих хүсэлт хүлээн авлаа: {{ .Email }} → {{ .NewEmail }}. Дээрх товчийг дарахаас гадна нөгөө хаяг руу илгээсэн имэйлийн товчийг ч дарсны дараа л хаяг солигдоно. Хэрэв та энэ хүсэлтийг гаргаагүй бол энэ имэйлийг үл тоомсорлож, hello@synk.im хаягаар бидэнд мэдэгдэнэ үү. Холбоос 1 цагийн дараа хүчингүй болно.'),
};

async function main() {
  // Loaded here so the tests can read MAILS without SYNK-talk's credentials next to this checkout.
  const { target, management, projectName } = require('./lib.js');
  const t = target(), mails = process.argv.includes('--메일문구');
  const read = () => management(t.ref, '/config/auth').then(r => r.json());
  const show = c => Object.fromEntries(SHOW.map(k => [k, k === 'smtp_host' ? (c[k] ? '(set)' : '(none)') : c[k]]));
  const now = await read();
  console.log(`target ▸ ${await projectName(t.ref)} (${t.ref})`);
  console.log('now:', JSON.stringify(show(now)));
  const allow = [...new Set([...(now.uri_allow_list || '').split(',').map(s => s.trim()).filter(Boolean), `https://synk.im${t.portalPath}**`, 'synktalk://oauth/callback'])].join(',');
  const patch = mails ? {} : { site_url: 'https://synk.im', uri_allow_list: allow, oauth_server_enabled: true, oauth_server_authorization_path: t.portalPath,
    oauth_server_allow_dynamic_registration: false, disable_signup: false };
  if (mails) {
    const refuse = !now.smtp_host ? 'Supabase only lets custom mails go out through a custom SMTP sender: set SMTP on the project first.'
      : now.mailer_otp_exp !== LINK_SECONDS ? `The mails say links expire in an hour, but mailer_otp_exp is ${now.mailer_otp_exp}: fix the copy first.` : '';
    if (refuse && t.apply) throw new Error(refuse);
    if (refuse) console.log('mails not taken:', refuse);
    else Object.assign(patch, MAILS);
  }
  const changed = Object.keys(patch).filter(k => now[k] !== patch[k]);
  console.log('differs:', changed.length ? changed.join(', ') : '(nothing)');
  if (!t.apply) { console.log('(not changed; add --적용)'); return; }
  if (!changed.length) return;
  const res = await management(t.ref, '/config/auth', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(changed.map(k => [k, patch[k]]))) });
  console.log('patch: HTTP', res.status, res.ok ? '' : (await res.text()).slice(0, 300));
  console.log('after:', JSON.stringify(show(await read())));
  process.exitCode = res.ok ? 0 : 1;
}

if (require.main === module) main().catch(e => { console.error(String(e.message || e)); process.exitCode = 1; });
module.exports = { MAILS };
