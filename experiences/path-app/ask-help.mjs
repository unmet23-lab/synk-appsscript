// PATH 「물어보기」의 앱 도움말 근거(근거 묶음의 help 갈래). 순수 자료만 둔다(브라우저 · Node 공용, 내장 모듈 없음).
// 문장은 PATH 화면 글(app.mjs · account-ui.mjs · consent-ui.mjs · study-ui.mjs · path-ui.mjs · channel-ui.mjs · doc-check-ui.mjs)과
// 3단계 설계 · AI 상담 설계에서 확인한 사실만 옮긴다. 화면 글이 바뀌면 여기도 고친다(ask-sources.test.mjs가 화면 글의 단추 이름을 대조한다).
// source: 그 사실이 보이는 앱 안 화면(app.mjs의 S.page 이름) 또는 null. 앱 자신의 글이라 checked는 null이다(90일 빼기에 넣지 않는다).

const L = (ko, en) => Object.freeze({ ko, en });
const lines = (ko, en) => Object.freeze({ ko: Object.freeze(ko), en: Object.freeze(en) });
const item = (id, title, l, source = null) => Object.freeze({ id, kind: 'help', title, lines: l, source, checked: null });

export const HELP_CONTACT = 'hello@synk.im';

export const ASK_HELP = Object.freeze([
  item('help-app-what', L('이 앱이 하는 일', 'What this app does'), lines([
    '「대학」 탭에서는 대학이 공개한 모집 요강에서 옮긴 과정을 봐요. 한국어, 성적, 준비한 돈을 넣으면 맞는 과정과 모자란 것을 알려 줘요.',
    '대학 자세히에서 「이 과정으로 준비하기」를 누르면, 그 과정에 내는 서류와 기한을 「내 길」에 모아 보여 줘요.',
    '「채널」에서는 TOPIK, 비자와 서류, 장학금, 사기 주의, 대학 소식 글을 공식 출처와 확인한 날과 함께 봐요.',
    '내 길의 대학 서류 줄에서 「서류 점검」을 쓸 수 있고, 몽골어 졸업 · 성적증명서 줄에서는 「몽골어 서류의 번역 초안 만들기」를 쓸 수 있어요.',
    '면접 연습은 여섯 질문에 글이나 말로 답하는 연습이에요. 실제 질문은 대학마다 다르고, 점수나 합격을 말하지 않아요.',
    '「도움」 탭에서는 공식 기관에 물어볼 질문을 정리해요. PATH가 답을 대신 판단하지 않아요.',
    'PATH에 실린 대학은 SYNK와 협약한 대학이 아니에요. 대학이 공개한 모집 요강에서 옮겼어요.'
  ], [
    'The Schools tab shows programs taken from admissions guides the universities published. Enter your Korean level, grades and funds to see what fits and what is missing.',
    'On a program’s details, press “Prepare for this program” and My path gathers that program’s documents and deadlines.',
    'News shows posts on TOPIK, visas and documents, scholarships, scam alerts and university news, each with its official source and the date it was checked.',
    'On My path you can use “Check this document” on the university document rows, and “Make a translation draft of the Mongolian document” on the Mongolian graduation certificate and transcript rows.',
    'Interview practice asks six questions you answer by typing or speaking. Real questions differ by university, and it gives no score or admission result.',
    'The Help tab helps you draft a question for official sources. PATH does not judge answers.',
    'The universities in PATH are not SYNK partner universities. Their details are taken from published admissions guides.'
  ])),

  item('help-delete-study-data', L('계정의 유학 준비 자료 지우기', 'Delete study data from account'), lines([
    '계정에 저장한 「내 조건」, 「다가오는 날」, 고른 과정, 서류 표시는 「나」 탭의 내 정보에서 「유학 준비 자료」 칸의 「계정의 유학 준비 자료 지우기」로 지워요.',
    '지우면 계정에 저장하기로 한 동의도 함께 거둬요. 그 뒤로 넣는 조건은 이 탭에만 남아요.',
    '계정에 저장하지 않아도 돼요. 「이 탭에만 두기」를 고르면 이 탭에만 두고, 탭을 닫으면 사라져요.',
    '내 조건만 지우려면 내 조건 화면의 「조건 모두 지우기」를 눌러요.'
  ], [
    'Your conditions, upcoming dates, picked program and marks saved to your account are deleted on the Me tab’s Profile page, with “Delete study data from account” in the Study data section.',
    'Deleting it also withdraws your consent to save it to your account. Conditions you add afterwards stay in this tab only.',
    'You do not have to save to your account. Choose “Keep in this tab only” and it stays in this tab, disappearing when you close the tab.',
    'To clear only your conditions, press “Clear all conditions” on the conditions page.'
  ]), 'profile'),

  item('help-clear-tab', L('이 탭의 PATH 데이터 지우기', 'Clear PATH data in this tab'), lines([
    '로그인하지 않으면 작성 내용은 이 탭에만 저장돼요.',
    '공용 기기라면 사용 후 「나」 탭의 내 정보에서 「저장 방식」 칸의 「이 탭의 PATH 데이터 지우기」로 지워 주세요.',
    '「내 조건」과 「다가오는 날」은 로그인하지 않으면 계정에 저장되지 않고 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.'
  ], [
    'Without signing in, drafts are saved only in this tab.',
    'On a shared device, clear them when you are done with “Clear PATH data in this tab” in the Storage section of the Me tab’s Profile page.',
    'Without signing in, your conditions and upcoming dates are not saved to an account; they stay in this tab only and disappear when you close the tab or sign out.'
  ]), 'profile'),

  item('help-delete-account', L('SYNK 계정 지우기', 'Deleting your SYNK account'), lines([
    'PATH 앱 화면에서는 SYNK 계정을 삭제할 수 없어요.',
    'SYNK 계정을 삭제하면 계정에 저장한 유학 준비 자료도 함께 지워져요.',
    `계정 삭제를 도와 달라면 ${HELP_CONTACT}으로 문의해 주세요.`
  ], [
    'Accounts cannot be deleted from the PATH app screens.',
    'Deleting your SYNK account also deletes the study data saved to it.',
    `For help deleting your account, write to ${HELP_CONTACT}.`
  ]), 'profile'),

  item('help-sign-in', L('로그인이 안 될 때', 'Trouble signing in'), lines([
    'SYNK ID는 중앙 계정으로 가입하고 로그인해요. 이메일이나 Google 계정을 쓸 수 있어요.',
    '비밀번호를 잊었거나 계정을 되찾을 때는 SYNK ID 중앙 로그인 화면에서 해요.',
    '「다시 로그인해야 합니다」가 보이면 다시 로그인해 주세요.',
    '로그인하지 않아도 PATH를 쓸 수 있어요. 그때 자료는 이 탭에만 저장되고 탭을 닫으면 사라질 수 있어요.',
    '로그인하면 이 탭의 자료를 계정으로 가져올지, 계정에 저장된 자료를 쓸지 고를 수 있어요.',
    `그래도 안 되면 ${HELP_CONTACT}으로 문의해 주세요.`
  ], [
    'SYNK ID uses a central account for sign-up and sign-in. You can use email or Google.',
    'Password resets and account recovery are handled on the SYNK ID central sign-in page.',
    'If you see “Please sign in again”, sign in again.',
    'You can use PATH without signing in. Your data is then saved in this tab only and may be lost when the tab closes.',
    'When you sign in, you can choose to import this tab’s data into your account or use the data saved in your account.',
    `If it still does not work, write to ${HELP_CONTACT}.`
  ]), 'profile'),

  item('help-contact', L('SYNK 문의처', 'Contacting SYNK'), lines([
    `SYNK 문의처는 ${HELP_CONTACT}이에요.`,
    '대학 요강은 그 대학에, 비자는 비자신청센터(KVAC)에 직접 물어봐야 해요. SYNK가 대학이나 KVAC를 대신해 답할 수 없어요.',
    '「도움」 탭에서 공식 기관에 물어볼 질문을 정리할 수 있어요.'
  ], [
    `You can reach SYNK at ${HELP_CONTACT}.`,
    'Ask the university about its admissions guide and the visa center (KVAC) about visas. SYNK cannot answer for the university or KVAC.',
    'The Help tab helps you draft a question for official sources.'
  ]), 'help'),

  item('help-no-promise', L('입학과 비자를 약속하지 않아요', 'No promise of admission or a visa'), lines([
    'PATH는 입학이나 비자, 장학금 선발을 약속하지 않아요. 마지막 판단은 대학과 출입국, 장학 기관이 해요.',
    '대학 비교와 내 길의 서류 목록도 입학이나 비자를 약속하지 않아요.',
    '「준비했어요」 표시는 학생이 스스로 누르는 표시이고, 누군가 서류를 확인했다는 뜻이 아니에요.'
  ], [
    'PATH does not promise admission, a visa or a scholarship. The university, the immigration office and the scholarship body make the final decision.',
    'The school comparison and the My path document list do not promise admission or a visa either.',
    'A “Ready” mark is something you press yourself; it does not mean anyone has checked the document.'
  ])),

  item('help-ai-not-official', L('AI의 안내는 대학이나 KVAC의 확인이 아니에요', 'AI guidance is not a check by the university or KVAC'), lines([
    'AI의 안내예요. 대학이나 KVAC의 확인이 아니에요.',
    'AI는 PATH에 실린 공개 자료만 근거로 답해요. 자료에 없으면 「자료에 없어요」라고 하고 물을 곳을 알려 줘요.',
    '서류 점검 결과도 대학이나 비자신청센터(KVAC)의 확인이 아니에요. 마지막 판단은 대학이 해요.',
    '번역 초안은 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.'
  ], [
    'This is guidance from AI. It is not a check by the university or KVAC.',
    'The AI answers only from the public information in PATH. If something is not there, it says so and tells you where to ask.',
    'Document check results are not a check by the university or the visa center (KVAC) either. The university makes the final decision.',
    'A translation draft does not promise admission or a visa. The university and immigration office make the final decision.'
  ]))
]);
