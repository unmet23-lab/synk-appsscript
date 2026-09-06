/** SYNK LAB 지원서 폼 — docs/지원서_양식_v1.md 그대로 짓는다 (2026-09-06)
 *  ⚠ 파일 업로드 문항(④-7)은 FormApp 이 «만들지»를 못한다 — 그것만 화면에서 손으로 붙인다. */
function 폼짓기() {
  var f = FormApp.openById('1nLc6fVXgahxKpePhBsLWAqfSFfpbop_FGgzBRdafhBs');

  f.setTitle('SYNK LAB 지원서 — 개원 멤버 모집');
  f.setDescription(
    'SYNK LAB은 2027년 2월 울란바토르에 문을 여는 한국어 학원입니다.\n' +
    '함께 시작할 개원 멤버를 찾고 있습니다.\n\n' +
    '· 다 쓰시는 데 10~15분 걸립니다.\n' +
    '· 자유 문항은 한국어로 써 주세요. 문법과 철자는 채점하지 않습니다.\n' +
    '· 접수 결과는 hello@synk.im 에서 회신드립니다.\n' +
    '· 개인정보처리방침: https://synk.im/privacy/');

  // 이미 있는 것을 전부 걷고 처음부터 짓는다 — 손으로 만들다 만 것이 섞이지 않게.
  var 것들 = f.getItems();
  for (var i = 것들.length - 1; i >= 0; i--) f.deleteItem(것들[i]);

  /* ── 섹션 1 — 갈래 나누기 ─────────────────────────────────────────── */
  var 갈래 = f.addMultipleChoiceItem().setTitle('어디에 지원하시나요?').setRequired(true);

  f.addTextItem().setTitle('성함').setRequired(true);
  f.addTextItem().setTitle('연락처 (전화번호 또는 이메일)').setRequired(true);

  /* ── 섹션 2 — 한국어 강사 ────────────────────────────────────────── */
  var 강사쪽 = f.addPageBreakItem().setTitle('한국어 강사 지원자');

  f.addTextItem().setTitle('국적').setRequired(true);
  f.addTextItem().setTitle('모어 (가장 편한 언어)').setRequired(true);

  var 급수 = f.addMultipleChoiceItem().setTitle('TOPIK 급수').setRequired(true);
  급수.setChoiceValues(['6급', '5급', '4급', '3급 이하 / 아직 없음']);

  f.addParagraphTextItem()
    .setTitle('한국어를 어디서, 얼마 동안 쓰셨나요?')
    .setHelpText('· 기관 이름과 기간을 함께 적어 주세요.\n' +
      '  (예: 「○○대학교 한국어학과 · 2021년 3월 ~ 2025년 2월」)\n' +
      '· 전공·근무·거주·수업 무엇이든 괜찮습니다.')
    .setRequired(true);

  f.addParagraphTextItem()
    .setTitle('누구를, 몇 명, 얼마 동안 가르치셨나요?')
    .setHelpText('· 예: 「중학생 12명 · 주 2회 · 1년 반」\n' +
      '· 가르쳐 보신 적이 없으면 「없음」이라고 써 주세요.')
    .setRequired(true);

  f.addParagraphTextItem()
    .setTitle('가르쳤던 학생 한 명이 교실에서 무엇을 했는지 3문장으로 써 주세요.')
    .setHelpText('· 이름은 쓰지 마세요. 「A 학생」처럼 써 주세요.\n' +
      '· 언제 있었던 일인지, 몇 번 그랬는지, 교실 어디에서였는지를 본 그대로 써 주세요.\n' +
      '· 한국어로 써 주세요. 문법과 철자는 채점하지 않습니다. 저희가 보는 것은 글솜씨가 ' +
      '아니라 「무엇을 보셨는가」입니다.\n' +
      '· 아직 가르쳐 보신 적이 없으면, 함께 공부한 사람 한 명으로 써 주셔도 됩니다.')
    .setRequired(true);

  /* ── 섹션 3 — 몽골어 감수자 ──────────────────────────────────────── */
  var 감수쪽 = f.addPageBreakItem().setTitle('몽골어 감수자 지원자');

  var 모어mn = f.addMultipleChoiceItem()
    .setTitle('몽골어가 모어(가장 편한 언어)이신가요?\nМонгол хэл таны төрөлх хэл (хамгийн хялбар хэл) мөн үү?')
    .setRequired(true);
  모어mn.setChoiceValues(['네 / Тийм', '아니요 / Үгүй']);

  f.addParagraphTextItem()
    .setTitle('평소에 어떤 글을 읽고 쓰시나요? 남의 글을 고쳐 본 적이 있으면 함께 적어 주세요.\n' +
      'Та голдуу ямар бичвэр уншиж, бичдэг вэ? Хэн нэгний бичсэнийг засаж байсан бол хамт бичнэ үү.')
    .setHelpText('· 번역 자격증이나 학위는 필요 없습니다. 학교 과제, 회사 문서, SNS 글 무엇이든 괜찮습니다.\n' +
      '· 몽골어로 쓰셔도 됩니다.\n\n' +
      '· Орчуулгын гэрчилгээ, диплом шаардлагагүй. Сургуулийн даалгавар, ажлын ' +
      'бичиг баримт, олон нийтийн сүлжээний бичлэг — юу ч байсан болно.\n' +
      '· Монголоор бичсэн ч болно.')
    .setRequired(true);

  f.addParagraphTextItem()
    .setTitle('아래는 저희가 몽골 학부모에게 보여 드리려고 쓴 문장입니다. 읽으시고, 어색한 곳이 있으면 ' +
      '「어디가 · 왜 · 어떻게 고치면 좋을지」를 적어 주세요.\n' +
      'Доорх нь бид монгол эцэг эхчүүдэд үзүүлэхээр бичсэн өгүүлбэр юм. Уншаад, ' +
      'эвгүй санагдах газар байвал «хаана нь · яагаад · яаж засвал сайн бэ»-г бичнэ үү.')
    .setHelpText('「Улаанбаатар дахь солонгос хэлний сургалтын төв.\n' +
      ' Солонгос хэл — тоглоом шиг сурна.」\n\n' +
      '· 고칠 데가 없다고 생각하시면 「없음」이라고 쓰셔도 됩니다.\n' +
      '· 몽골어로 답해 주세요.\n\n' +
      '· Засах газар байхгүй гэж бодож байвал «байхгүй» гэж бичсэн ч болно.\n' +
      '· Монголоор хариулна уу.')
    .setRequired(true);

  /* ── 갈래 나누기 — 첫 문항의 보기가 각자 제 섹션으로 간다 ─────────── */
  갈래.setChoices([
    갈래.createChoice('한국어 강사', 강사쪽),
    갈래.createChoice('몽골어 감수자', 감수쪽),
  ]);
  // 강사 섹션을 다 채우면 감수자 섹션으로 넘어가지 않고 그대로 낸다.
  강사쪽.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  /* ── 설정 셋 ─────────────────────────────────────────────────────── */
  f.setCollectEmail(false);            // 켜면 지원자가 구글 로그인을 해야 한다
  f.setLimitOneResponsePerUser(false);
  f.setConfirmationMessage(
    '지원서를 받았습니다. 고맙습니다.\n\n' +
    '서류 검토 뒤 hello@synk.im 에서 회신드리겠습니다.\n' +
    '문의는 페이스북 페이지 메시지로도 받습니다 — facebook.com/synkworld');

  Logger.log('끝났다 · 문항 %s개 · 응답 링크 %s', f.getItems().length, f.getPublishedUrl());
}
