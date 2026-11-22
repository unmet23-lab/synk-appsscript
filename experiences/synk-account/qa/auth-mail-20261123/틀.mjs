// SYNK ID 보안 알림 메일과 확인 번호 메일의 틀(2026-11-23, 유호님 「Alerts + re-auth」).
// 운영 Auth(config/auth)에 그대로 싣는다. 양식은 10-22에 바꾼 가입 · 재설정 · 이메일 변경 메일과 같다:
// 한국어 본문, 영어 · 몽골어 작은 글, 바닥줄.
// 쓰는 값: {{ .Email }} 모든 틀, {{ .OldEmail }} 이메일 변경, {{ .Provider }} 연결 · 해제, {{ .Token }} 확인 번호.

const 겉 = (안) => `<div style="max-width:520px;color:#10131a;line-height:1.6;word-break:keep-all;overflow-wrap:break-word">\n${안}\n<p style="color:#565a61;font-size:13px">SYNK · <a href="https://synk.im/">synk.im</a> · 문의 hello@synk.im<br>비밀번호나 인증번호는 누구에게도 알려 주지 마세요.</p>\n</div>`;
const 제목 = (글) => `<h2 style="font-size:20px;line-height:1.4">${글}</h2>`;
const 단추 = (주소, 글) => `<p><a href="${주소}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#3d6bc9;color:#ffffff;text-decoration:none;font-weight:700">${글}</a></p>`;
const 작은글 = (말, 글) => `<p lang="${말}" style="color:#565a61;font-size:13px">${글}</p>`;
const 다시정하기 = 단추('{{ .SiteURL }}/id/?view=recover', '비밀번호 다시 정하기');
const 방법 = '{{ if eq .Provider "google" }}Google{{ else }}{{ .Provider }}{{ end }}';

export const 글 = {
  password_changed: {
    ko: ['{{ .Email }} 계정의 비밀번호가 방금 바뀌었어요. 직접 바꾸셨다면 하실 일은 없어요.', '직접 바꾸지 않았다면 아래 단추로 비밀번호를 다시 정하고 hello@synk.im으로 알려 주세요.'],
    en: 'The password for {{ .Email }} was just changed. If you did this, there is nothing to do. If you did not, reset your password with the button above and let us know at hello@synk.im.',
    mn: '{{ .Email }} хаягтай бүртгэлийн нууц үг саяхан солигдлоо. Хэрэв та өөрөө сольсон бол юу ч хийх шаардлагагүй. Хэрэв та өөрөө солиогүй бол дээрх товчийг дарж нууц үгээ шинээр тохируулаад, hello@synk.im хаягаар бидэнд мэдэгдэнэ үү.',
  },
  email_changed: {
    ko: ['SYNK 계정의 로그인 이메일이 {{ .OldEmail }}에서 {{ .Email }} 주소로 바뀌었어요. 직접 바꾸셨다면 하실 일은 없어요.', '직접 바꾸지 않았다면 바로 hello@synk.im으로 알려 주세요.'],
    en: 'The sign-in email of your SYNK account was changed from {{ .OldEmail }} to {{ .Email }}. If you did this, there is nothing to do. If you did not, let us know at hello@synk.im right away.',
    mn: 'SYNK бүртгэлийн нэвтрэх имэйл хаяг солигдлоо. Өмнөх хаяг: {{ .OldEmail }}. Шинэ хаяг: {{ .Email }}. Хэрэв та өөрөө сольсон бол юу ч хийх шаардлагагүй. Хэрэв та өөрөө солиогүй бол hello@synk.im хаягаар бидэнд яаралтай мэдэгдэнэ үү.',
  },
  identity_linked: {
    ko: [`{{ .Email }} 계정에 ${방법} 로그인이 연결됐어요. 이제 ${방법}로도 SYNK에 로그인할 수 있어요.`, '직접 연결하지 않았다면 바로 hello@synk.im으로 알려 주세요. 연결을 끊어 드릴게요. 그 사이 아래 단추로 비밀번호를 다시 정해 주세요.'],
    en: `${방법} sign-in was linked to {{ .Email }} and can now be used to sign in to SYNK. If you did not do this, let us know at hello@synk.im and we will remove it. Meanwhile, reset your password with the button above.`,
    mn: `{{ .Email }} хаягтай бүртгэлд ${방법} хаяг холбогдлоо. Одоо энэ хаягаар SYNK-т нэвтэрч болно. Хэрэв та өөрөө холбоогүй бол hello@synk.im хаягаар бидэнд даруй мэдэгдэнэ үү. Бид холболтыг салгаж өгнө. Тэр болтол дээрх товчийг дарж нууц үгээ шинээр тохируулна уу.`,
  },
  identity_unlinked: {
    ko: [`{{ .Email }} 계정에서 ${방법} 로그인 연결이 끊겼어요. 이제 ${방법}로는 SYNK에 로그인할 수 없어요.`, '직접 끊지 않았다면 아래 단추로 비밀번호를 다시 정하고 hello@synk.im으로 알려 주세요.'],
    en: `${방법} sign-in was removed from {{ .Email }} and can no longer be used to sign in to SYNK. If you did not do this, reset your password with the button above and let us know at hello@synk.im.`,
    mn: `{{ .Email }} хаягтай бүртгэлээс ${방법} хаягийн холболт салгагдлаа. Одоо энэ хаягаар SYNK-т нэвтрэх боломжгүй. Хэрэв та өөрөө салгаагүй бол дээрх товчийг дарж нууц үгээ шинээр тохируулаад, hello@synk.im хаягаар бидэнд мэдэгдэнэ үү.`,
  },
  reauthentication: {
    ko: ['SYNK ID에서 본인 확인을 요청하셨어요. 화면에 아래 번호를 넣어 주세요.', '번호는 1시간 동안 쓸 수 있어요. 직접 요청하지 않았다면 누군가 이 계정에 로그인해 있을 수 있어요. 아래 단추로 비밀번호를 다시 정하고 hello@synk.im으로 알려 주세요.'],
    en: 'You asked SYNK ID to confirm it is you. Enter the code above on the screen; it works for one hour. If you did not ask for this, someone may be signed in to your account. Reset your password with the button above and let us know at hello@synk.im.',
    mn: 'Та SYNK ID дээр өөрийгөө баталгаажуулах хүсэлт гаргалаа. Дээрх кодыг дэлгэцэд оруулна уу. Код 1 цагийн турш хүчинтэй. Хэрэв та энэ хүсэлтийг гаргаагүй бол таны бүртгэлд өөр хүн нэвтэрсэн байж магадгүй. Дээрх товчийг дарж нууц үгээ шинээр тохируулаад, hello@synk.im хаягаар бидэнд мэдэгдэнэ үү.',
  },
};

const 머리 = {
  password_changed: ['SYNK 비밀번호가 바뀌었어요', 'Your SYNK password was changed'],
  email_changed: ['SYNK 로그인 이메일이 바뀌었어요', 'Your SYNK sign-in email was changed'],
  identity_linked: ['SYNK 계정에 로그인 방법이 더해졌어요', 'A sign-in method was added to your SYNK account'],
  identity_unlinked: ['SYNK 계정에서 로그인 방법이 빠졌어요', 'A sign-in method was removed from your SYNK account'],
};

function 본문(이름) {
  const g = 글[이름], [첫, 둘] = g.ko;
  if (이름 === 'reauthentication') {
    return 겉([제목('SYNK 확인 번호'), `<p>${첫}</p>`, '<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">{{ .Token }}</p>', `<p>${둘}</p>`, 다시정하기, 작은글('en', g.en), 작은글('mn', g.mn)].join('\n'));
  }
  const 줄 = [제목(머리[이름][0]), `<p>${첫}</p>`, `<p>${둘}</p>`];
  if (이름 !== 'email_changed') 줄.push(다시정하기);
  줄.push(작은글('en', g.en), 작은글('mn', g.mn));
  return 겉(줄.join('\n'));
}

// 운영 config/auth에 보낼 값. 알림 넷을 켜고 틀 다섯을 바꾼다. 다른 키는 건드리지 않는다.
export const 설정 = {
  mailer_notifications_password_changed_enabled: true,
  mailer_notifications_email_changed_enabled: true,
  mailer_notifications_identity_linked_enabled: true,
  mailer_notifications_identity_unlinked_enabled: true,
  ...Object.fromEntries(Object.keys(머리).map((이름) => [`mailer_subjects_${이름}_notification`, `${머리[이름][0]} · ${머리[이름][1]}`])),
  ...Object.fromEntries(Object.keys(머리).map((이름) => [`mailer_templates_${이름}_notification_content`, 본문(이름)])),
  mailer_subjects_reauthentication: 'SYNK 확인 번호 {{ .Token }} · Your SYNK verification code',
  mailer_templates_reauthentication_content: 본문('reauthentication'),
};
