// 틀을 보기 값으로 채워 한 쪽에 늘어놓는다(눈으로 보는 확인용). node 메일보기.mjs <출력 html>
import { writeFileSync } from 'node:fs';
import { 설정 } from './틀.mjs';
const 채움 = (s) => s.replace(/\{\{ if eq \.Provider "google" \}\}Google\{\{ else \}\}\{\{ \.Provider \}\}\{\{ end \}\}/g, 'Google')
  .replaceAll('{{ .OldEmail }}', 'old@example.com').replaceAll('{{ .Email }}', 'name@example.com').replaceAll('{{ .Token }}', '12345678').replaceAll('{{ .SiteURL }}', 'https://synk.im');
const 이름 = ['password_changed', 'email_changed', 'identity_linked', 'identity_unlinked'];
const 통 = [...이름.map((n) => [설정[`mailer_subjects_${n}_notification`], 설정[`mailer_templates_${n}_notification_content`]]), [설정.mailer_subjects_reauthentication, 설정.mailer_templates_reauthentication_content]];
const 남은 = 통.flat().filter((s) => /\{\{/.test(채움(s)));
if (남은.length) throw new Error('채우지 못한 자리: ' + 남은.join(' | ').slice(0, 300));
writeFileSync(process.argv[2], `<!doctype html><meta charset="utf-8"><title>SYNK 보안 메일 보기</title><body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:24px">${통.map(([제목, 본문]) => `<section style="background:#fff;margin:0 auto 24px;max-width:600px;padding:24px;border-radius:8px"><p style="color:#565a61;font-size:13px;margin:0 0 12px">제목: <b>${채움(제목)}</b></p>${채움(본문)}</section>`).join('')}</body>`);
console.log('ok', 통.length);
