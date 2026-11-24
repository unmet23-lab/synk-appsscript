// PATH 「내 길」 서류 자료. 대학 요강과 KVAC 몽골 누리집에서 2026-11-22에 직접 읽은 것만 적는다.
// 확인하지 못한 것은 적지 않고, 요강이 둘로 읽히는 곳은 unclear로 그대로 보인다. 학생의 「준비했어요」는 확인이 아니다.

const L = (ko, en) => Object.freeze({ ko, en });
const freeze = (o) => Object.freeze(o);

export const DOC_STAGES = Object.freeze(['apply', 'admitted', 'visa']);

const KVAC_D2 = freeze({ title: L('KVAC 몽골 「유학(D-2-1~D-2-4)」 서류 목록', 'KVAC Mongolia student visa (D-2) document list'), url: 'https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4' });
const KVAC_D4 = freeze({ title: L('KVAC 몽골 「한국어연수(D-4-1)」 서류 목록', 'KVAC Mongolia language trainee visa (D-4-1) document list'), url: 'https://www.visaforkorea.mn/ko/korean-language-trainee-d-4-1' });

// only: 출처가 「해당자만」이나 「가진 사람만」이라고 적은 서류({ cond: 원문 조건 }). 화면은 그 묶음 안에 접어 둔다.
const doc = (id, stage, name, extra = {}) => freeze({ id, stage, name, from: null, when: null, note: null, unclear: null, only: null, ...extra });
const only = (ko, en) => freeze({ cond: L(ko, en) });

/* ── 과정별 원서 · 합격 뒤 서류 ── */

const JBNU_UG = freeze({
  source: freeze({ title: L('전북대학교 2027학년도 전기 학부 외국인특별전형 모집요강', 'Jeonbuk National University, Spring 2027 undergraduate international admissions guide'), url: 'https://ioffice.jbnu.ac.kr/bbs/ioffice/5310/401304/artclView.do' }),
  id: 'docs-jbnu-ug',
  checkedAt: '2026-11-22',
  term: L('2027학년도 전기 요강 기준', 'Based on the Spring 2027 guide'),
  ask: L('전북대 국제협력과(admissionu@jbnu.ac.kr, 요강 10쪽)', 'JBNU Office of International Affairs (admissionu@jbnu.ac.kr, guide p. 10)'), // 공개허용: 대학이 공개 요강에 적은 입학 업무 연락처
  how: L('UWAY에서 온라인으로 접수하고(성적증명서와 사진 파일을 올려요), 서류는 우편이나 방문으로 국제협력과에 내요. 전형료는 80,000원이에요.', 'Apply online on UWAY (you upload your transcript and photo), then send the documents to the Office of International Affairs by post or in person. The application fee is ₩80,000.'),
  rules: [
    L('원본을 내는 것이 원칙이에요. 원본을 다시 받을 수 없으면 발급기관의 원본대조필 사본이나 공증본 원본을 내요.', 'Originals are the rule. If you cannot get another original, submit a copy certified by the issuing office or a notarized copy.'),
    L('한국어 · 영어가 아닌 서류는 번역본이 꼭 필요해요. 공증받지 않은 번역본에는 번역자확인서와 번역자 졸업증을 더 내요.', 'Documents not in Korean or English need a translation. An unnotarized translation also needs the translator confirmation form and the translator’s diploma.')
  ],
  unclear: [L('번역 형식이 요강의 두 곳에서 달라요. 앞쪽은 공증 없는 번역에 번역자확인서를 붙이면 된다고 하고, 서류 표는 「번역회사의 번역본」을 말해요. 개인 번역을 받아 주는지 대학에 먼저 물어보세요.', 'The guide describes translations in two ways: one part accepts an unnotarized translation with the translator form, the document table asks for a translation by a translation company. Ask the university whether a personal translation is accepted.')],
  docs: [
    doc('jbnu-ug-forms', 'apply', L('입학지원서 · 유학경비부담서약서 · 개인정보이용동의서', 'Application form, financial guarantee pledge, privacy consent'), { note: L('온라인 접수에서 작성한 뒤 출력해 서명해요.', 'Fill them in during online application, then print and sign.') }),
    doc('jbnu-ug-grad', 'apply', L('고등학교 졸업(예정)증명서', 'High school (expected) graduation certificate'), {
      note: L('원본이 원칙이에요. 졸업예정자는 졸업예정증명서를 먼저 내고, 졸업증명서는 2027-02-19까지 내요.', 'Original as a rule. If you are about to graduate, submit the expected-graduation certificate first and the graduation certificate by 2027-02-19.'),
      unclear: L('비고의 「아포스티유 확인서 혹은 영사확인 서류로 대체」가 졸업증명서에 아포스티유를 받으라는 뜻인지, 아래 학력인증서와 같은 서류라는 뜻인지 요강에서 갈리지 않아요.', 'The note “replace with an apostille or consular confirmation” could mean the certificate itself needs an apostille, or that it is the same document as the diploma verification below. The guide does not say which.')
    }),
    doc('jbnu-ug-transcript', 'apply', L('고등학교 전 과정 성적증명서', 'High school transcript (all years)'), {
      note: L('원본과 번역회사 번역본, 또는 공증받은 사본이에요. 온라인 접수 때 파일로도 올려요. 졸업예정자는 지금까지의 성적표를 내고 졸업 뒤 최종본을 더 내요.', 'The original with a translation company’s translation, or a notarized copy. Also upload it during online application. If you are about to graduate, submit your current transcript and the final one after graduation.'),
      unclear: L('성적증명서에 아포스티유가 필요한지 요강의 두 곳이 달라요. 서류 표에는 없고, 학력인증 안내는 「졸업 및 성적증명서에 대한 아포스티유」를 말해요.', 'The guide differs on whether the transcript needs an apostille: the document table does not say so, but the verification section mentions an apostille for the graduation certificate and transcript.')
    }),
    doc('jbnu-ug-verify', 'apply', L('고등학교 졸업 학력인증서(아포스티유)', 'High school diploma verification (apostille)'), {
      note: L('원본을 내요. 몽골은 아포스티유 협약국이라 아포스티유 확인서를 받아요. 졸업예정자는 2027-02-19까지 내요.', 'Submit the original. Mongolia is an apostille country, so you get an apostille certificate. If you are about to graduate, submit it by 2027-02-19.')
    }),
    doc('jbnu-ug-family', 'apply', L('가족관계증명서와 부모 여권 사본', 'Family relation certificate and parents’ passport copies'), { note: L('증명서는 원본과 번역회사 번역본, 또는 공증받은 사본이에요. 부모 두 사람의 여권 사본(여권이 없으면 신분증 사본)을 내고, 본인과 부모의 이름 · 국적이 보여야 해요.', 'The certificate as an original with a translation company’s translation, or a notarized copy. Add copies of both parents’ passports (or ID cards if they have no passport); names and nationalities must be visible.') }),
    doc('jbnu-ug-language', 'apply', L('어학능력 증빙(TOPIK 성적표나 한국어학당 수료증)', 'Language proof (TOPIK score report or language institute certificate)'), {
      when: L('원서 접수일 기준 최근 2년 안에 발급된 것', 'Issued within the last two years as of the application date'),
      note: L('한국어 트랙은 TOPIK 2급 이상 같은 조건이 있어요. 시험에 접수만 했으면 접수증을 먼저 내요. 장학금은 2026-12-23까지 낸 성적만 반영해요.', 'The Korean track needs TOPIK level 2 or similar. If you have only registered for the test, submit the registration slip first. Scholarships count only scores submitted by 2026-12-23.')
    }),
    doc('jbnu-ug-bank', 'apply', L('은행잔고증명서', 'Bank balance certificate'), {
      when: L('제출일 기준 30일 안에 발급된 것', 'Issued within 30 days of submission'),
      note: L('원본이에요. 본인이나 부모 계좌로 1,600만 원(약 13,000달러) 이상이에요. 원서를 낼 때나 합격 뒤에 내도 되고, 늦어도 비자 신청 전에 내요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.', 'Original, from your own or a parent’s account, ₩16,000,000 (about USD 13,000) or more. You may submit it with the application or after admission, but before the visa application at the latest. Owner, validity and copies can differ from the visa deposit certificate.')
    }),
    doc('jbnu-ug-passport', 'apply', L('여권 사본', 'Passport copy')),
    doc('jbnu-ug-arc', 'apply', L('외국인등록증 사본', 'Alien registration card copy'), { only: only('한국에 살고 있는 사람만', 'Only if you live in Korea') }),
    doc('jbnu-ug-portfolio', 'apply', L('작품성과집(포트폴리오, USB 등)', 'Portfolio (USB etc.)'), { only: only('예술대학 지원자만', 'Only for College of Arts applicants') })
  ],
  // 서류 기한은 그 차수(시작 날)에 매단다: 날짜가 바뀌어도 id가 그대로라 넣어 둔 학생은 「날짜가 바뀌었어요」를 본다.
  deadlines: [
    freeze({ round: '2026-11-09', key: 'docs', start: '2026-11-27', label: L('2차 서류 제출 마감(2차 원서를 낸 사람만)', 'Round 2 document deadline (only if you applied in round 2)') }),
    freeze({ round: '2026-11-09', key: 'originals', start: '2027-02-19', label: L('원본 · 졸업 서류 제출(사본을 냈거나 졸업예정자)', 'Originals and graduation documents (if you sent copies or were about to graduate)') })
  ]
});

const JBNU_LANG = freeze({
  source: freeze({ title: L('전북대학교 한국어학당 입학신청 · 제출서류', 'Jeonbuk National University Korean Language Institute: application and documents'), url: 'https://wz3.jbnu.ac.kr/lec_korean/10899/subview.do' }),
  id: 'docs-jbnu-lang',
  checkedAt: '2026-11-22',
  term: L('2027 봄학기 접수 기준(학당 누리집)', 'Based on the spring 2027 intake (institute pages)'),
  how: L('온라인으로 접수하고 서류는 스캔해서 올려요. 전형료는 70,000원이에요(2027년 봄학기부터 오른 금액). 낸 서류와 전형료는 돌려주지 않아요.', 'Apply online and upload scanned documents. The application fee is ₩70,000 (raised from spring 2027). Documents and the fee are not returned.'),
  rules: [L('모든 서류에 국문이나 영문 번역본, 또는 공증본을 붙여요. 번역본이면 번역자 확인서를 더 내요.', 'Attach a Korean or English translation, or a notarized copy, to every document. With a translation, add the translator confirmation form.')],
  unclear: [],
  docs: [
    doc('jbnu-lang-photo', 'apply', L('사진(3.5 × 4.5cm 컬러)', 'Photo (3.5 × 4.5 cm, colour)')),
    doc('jbnu-lang-passport', 'apply', L('여권 사본', 'Passport copy')),
    doc('jbnu-lang-grad', 'apply', L('최종학력 학교 졸업증명서', 'Graduation certificate from your last school'), {
      note: L('원본을 스캔해 올려요.', 'Upload a scan of the original.'),
      unclear: L('한국어 안내에는 이 줄에 「(중국)」 표기가 붙어 있고, 영어 안내에는 없이 모든 지원자 서류로 적혀 있어요. 졸업예정자가 무엇을 내는지도 학당 누리집에 없어요.', 'The Korean page marks this line “(China)”, while the English page lists it for all applicants. The page also does not say what students who have not yet graduated submit.')
    }),
    doc('jbnu-lang-transcript', 'apply', L('최종학력 학교 성적증명서', 'Transcript from your last school'), { note: L('원본을 스캔해 올려요.', 'Upload a scan of the original.') }),
    doc('jbnu-lang-verify', 'apply', L('최종학력 인증서류(아포스티유)', 'Diploma verification (apostille)'), { note: L('원본이에요. 아포스티유나, 한국 영사관 · 주한 자국 공관의 영사인증을 받아요.', 'Original, with an apostille or consular confirmation.') }),
    doc('jbnu-lang-bank', 'apply', L('은행잔고증명서', 'Bank balance certificate'), { when: L('신청일 기준 30일 안에 발급된 것', 'Issued within 30 days of applying'), note: L('본인이나 부모 명의로 800만 원 이상이에요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.', 'In your own or a parent’s name, ₩8,000,000 or more. Owner, validity and copies can differ from the visa deposit certificate.') }),
    doc('jbnu-lang-family', 'apply', L('가족관계증명서', 'Family relation certificate'), { note: L('가족 구성원이 모두 나와야 해요.', 'All family members must be listed.') })
  ],
  deadlines: []
});

const WKU_UG = freeze({
  source: freeze({ title: L('원광대학교 2027학년도 1학기(3월) 외국인 학부 신(편)입학 모집요강(안)', 'Wonkwang University, Spring 2027 undergraduate international admissions guide (draft)'), url: 'https://ipsi.wku.ac.kr/detail.do?menuurl=qBExJT7yxTZkr1QAFxkj1g%3D%3D&board_seq=9786' }),
  id: 'docs-wku-ug',
  checkedAt: '2026-11-22',
  term: L('2027학년도 1학기 요강 기준', 'Based on the Spring 2027 guide'),
  ask: L('원광대 국제교류과(063-850-5843, 요강 문의처)', 'Wonkwang University Office of International Affairs (+82-63-850-5843, from the guide)'),
  how: L('방문이나 우편으로 국제교류과에 내요. 온라인 접수는 없어요. 전형료는 100,000원이고 돌려주지 않아요.', 'Submit in person or by post to the Office of International Affairs. There is no online application. The fee is ₩100,000 and is not refunded.'),
  status: L('요강 파일 이름에 「(안)」이 붙어 있어 바뀔 수 있어요.', 'The guide file is marked as a draft, so it may change.'),
  rules: [L('서류는 한국어나 영어만 받아요. 다른 언어면 번역본에 번역자 확인서와 번역자 신분증 사본을 붙여요. 번역 공증은 요구하지 않아요.', 'Only Korean or English documents are accepted. Other languages need a translation with the translator confirmation form and a copy of the translator’s ID. Notarization is not required.')],
  unclear: [],
  docs: [
    doc('wku-ug-forms', 'apply', L('입학원서 · 개인정보 수집 및 이용 동의서(대학 서식)', 'Application form and privacy consent (university forms)')),
    doc('wku-ug-grad', 'apply', L('고등학교 졸업(예정)증명서', 'High school (expected) graduation certificate'), {
      note: L('원본이에요. 졸업예정자는 졸업예정증명서를 낼 수 있고, 졸업 뒤 졸업증명서와 학력인증 서류를 입학 전까지 내요.', 'Original. If you are about to graduate you may submit the expected-graduation certificate, then the graduation certificate and verification before entry.'),
      unclear: L('「졸업 후 1년이 넘었으면 표준입학허가서 발행 전에 졸업증명서를 낸다」는 문장이 졸업예정자에게도 해당하는지 요강에서 갈리지 않아요.', 'The guide does not make clear whether the rule “if more than a year has passed since graduation, submit the certificate before the admission letter is issued” applies to students about to graduate.')
    }),
    doc('wku-ug-transcript', 'apply', L('고등학교 전체 성적증명서', 'High school transcript (all years)'), { note: L('사본이에요.', 'A copy.') }),
    doc('wku-ug-verify', 'apply', L('고교 학력인증(아포스티유)', 'High school diploma verification (apostille)'), {
      when: L('3개월 안에 발급된 것이 원칙이에요. 비자 발급 때(2월) 6개월 안이면 인정될 수 있어요.', 'Issued within 3 months as a rule; within 6 months at visa time (February) may be accepted.'),
      note: L('원본이에요.', 'Original.'),
      unclear: L('아포스티유가 졸업증명서에만 필요한지 성적증명서까지 필요한지 적혀 있지 않아요.', 'The guide does not say whether the apostille is needed only for the graduation certificate or also for the transcript.')
    }),
    doc('wku-ug-passport', 'apply', L('여권 사본', 'Passport copy'), { when: L('여권이 6개월 이상 남아 있어야 해요.', 'At least 6 months of passport validity.') }),
    doc('wku-ug-family', 'apply', L('가족관계증명서', 'Family relation certificate'), { note: L('사본이에요.', 'A copy.') }),
    doc('wku-ug-parents-id', 'apply', L('부 · 모 신분증 사본', 'Copies of parents’ ID cards')),
    doc('wku-ug-translator', 'apply', L('번역자 확인서와 번역자 신분증 사본', 'Translator confirmation form and translator’s ID copy'), { only: only('번역본을 내는 사람만', 'Only if you submit translations') }),
    doc('wku-ug-arc', 'apply', L('외국인등록증 사본', 'Alien registration card copy'), { only: only('한국에 살고 있는 사람만', 'Only if you live in Korea') }),
    doc('wku-ug-language', 'apply', L('어학(한국어 · 영어) 입증 서류', 'Language proof (Korean or English)'), { only: only('한국어나 영어 성적이 있는 사람만', 'Only if you have a Korean or English score'), note: L('입학할 때는 필수가 아니에요.', 'It is not required for admission.') }),
    doc('wku-ug-bank', 'admitted', L('재정능력 입증서류', 'Proof of funds'), {
      when: L('발급일부터 1개월 안. 합격 통보 뒤 등록 기간 안에 발급받아요.', 'Within 1 month of issue; get it after the admission notice, during registration.'),
      note: L('원본 2부(출입국 · 재외공관용과 대학용)예요. 본인 명의로 1,600만 원 이상이고, 통장 앞뒤 사본과 은행 연락처가 있는 서식이 필요해요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.', 'Two originals (one for immigration, one for the university), in your own name, ₩16,000,000 or more, with copies of both sides of the bankbook and a bank form showing the bank’s contact. Owner, validity and copies can differ from the visa deposit certificate.')
    })
  ],
  deadlines: []
});

const WKU_LANG = freeze({
  source: freeze({ title: L('2026 원광대학교 한국문화교육센터 모집요강', 'Wonkwang University Korean Culture Education Center admissions guide, 2026'), url: 'https://ipsi.wku.ac.kr/detail.do?menuurl=8pYtphfeWm2Bb85hdKCTcQ%3D%3D&board_seq=7060' }),
  id: 'docs-wku-lang',
  checkedAt: '2026-11-22',
  term: L('2026학년도 요강의 2027 봄학기 일정', 'Spring 2027 dates from the 2026 guide'),
  ask: L('원광대 한국문화교육센터(063-850-5504, 요강 문의처)', 'Wonkwang University Korean Culture Education Center (+82-63-850-5504, from the guide)'),
  how: L('원본과 사본을 나눠 우편이나 방문으로 내요. 전형료 · 교재비는 100,000원이고 처음 입학할 때 한 번 내요.', 'Submit originals and copies by post or in person. The application and textbook fee of ₩100,000 is paid once, at first entry.'),
  status: L('2026학년도 요강이에요. 2027 봄학기 일정은 이 요강의 일정표에서 읽었어요.', 'This is the 2026 guide; the spring 2027 dates come from its schedule table.'),
  rules: [L('한국어 · 영어가 아닌 서류는 한국어나 영어 번역본을 함께 내요.', 'Documents not in Korean or English need a Korean or English translation.')],
  unclear: [],
  docs: [
    doc('wku-lang-form', 'apply', L('입학지원서(사진 3.5 × 4.5cm)', 'Application form (photo 3.5 × 4.5 cm)')),
    doc('wku-lang-essay', 'apply', L('자기소개서(학업계획 포함)', 'Self-introduction (with study plan)')),
    doc('wku-lang-passport', 'apply', L('여권 사본', 'Passport copy'), { when: L('여권이 6개월 이상 남아 있어야 해요.', 'At least 6 months of passport validity.') }),
    doc('wku-lang-family', 'apply', L('가족관계증명서', 'Family relation certificate'), { note: L('원본과 사본이에요. 지원자와 부모(또는 배우자)가 모두 나오지 않으면 공증을 붙여요.', 'Original and copy. If you and your parents (or spouse) are not all listed, attach a notarization.') }),
    doc('wku-lang-parents-id', 'apply', L('부 · 모 신분증 사본', 'Copies of parents’ ID cards')),
    doc('wku-lang-grad', 'apply', L('최종학력 졸업증명서(고등학교 졸업 이상)', 'Graduation certificate (high school or higher)'), { note: L('원본과 사본이에요.', 'Original and copy.') }),
    doc('wku-lang-transcript', 'apply', L('최종학력 성적증명서', 'Transcript from your last school'), { note: L('원본과 사본이에요.', 'Original and copy.') }),
    doc('wku-lang-verify', 'apply', L('학력인증보고서(아포스티유)', 'Diploma verification report (apostille)'), { when: L('비자 신청일부터 3개월 안에 발급된 것', 'Issued within 3 months of the visa application'), note: L('아포스티유 원본이에요.', 'Original apostille.') }),
    doc('wku-lang-translator', 'apply', L('번역자 확인서(출입국 서식)', 'Translator confirmation form (immigration form)'), { only: only('번역본을 내는 사람만', 'Only if you submit translations') }),
    doc('wku-lang-bank', 'admitted', L('은행잔고증명서', 'Bank balance certificate'), { when: L('비자 신청일 기준 30일 안에 발급된 것', 'Issued within 30 days of the visa application'), note: L('원본이에요. 본인 명의로 800만 원(6,500달러) 이상이에요. 합격한 뒤에 내요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.', 'Original, in your own name, ₩8,000,000 (USD 6,500) or more. Submit after admission. Owner, validity and copies can differ from the visa deposit certificate.') })
  ],
  deadlines: []
});

const JJ_UG = freeze({
  source: freeze({ title: L('2027학년도 전주대학교 전기 외국인 신 · 편입학 특별전형 모집요강', 'Jeonju University, Spring 2027 international admissions guide'), url: 'https://www.jj.ac.kr/global/admission/guidelines.do' }),
  id: 'docs-jj-ug',
  checkedAt: '2026-11-22',
  term: L('2027학년도 전기 요강 기준', 'Based on the Spring 2027 guide'),
  how: L('oia.jj.ac.kr에서 온라인 원서를 내고 서류와 면접 동영상을 올린 뒤, 서류는 방문 · 택배 · 우편으로 기한까지 국제교육관에 도착하게 보내요. 이메일로는 받지 않아요. 전형료는 120,000원이에요.', 'Apply online at oia.jj.ac.kr and upload the documents and interview video, then send the documents in person, by courier or by post so they arrive at the International Education Center by the deadline. Email is not accepted. The fee is ₩120,000.'),
  rules: [
    L('입학원서를 포함한 모든 서류는 원본, 또는 번역공증과 영사인증 · 아포스티유를 받은 것으로 내요.', 'All documents, including the application form, must be originals or translated, notarized and apostilled (or consular-confirmed).'),
    L('원서 사진은 최근 3개월 안에 찍은 3 × 4cm 컬러사진을 스캔해 올려요.', 'For the photo, upload a scan of a 3 × 4 cm colour photo taken within the last 3 months.')
  ],
  unclear: [],
  docs: [
    doc('jj-ug-form', 'apply', L('입학원서', 'Application form'), { note: L('인터넷 접수 뒤 출력해 원본 1부를 내요.', 'Print after online application and submit one original.') }),
    doc('jj-ug-passports', 'apply', L('지원자와 부모 여권 사본', 'Passport copies for you and your parents'), { when: L('입학 예정일에 유효한 여권', 'Valid on the planned entry date') }),
    doc('jj-ug-family', 'apply', L('가족관계 증명서류', 'Family relation documents'), {
      note: L('원본 1부예요. 부모가 이혼하거나 돌아가셨으면 정부 발행 증명서를 더 내요.', 'One original. If your parents are divorced or deceased, add the government certificate.'),
      unclear: L('가족관계증명서 원본에 번역 · 공증이 필요한지 이 줄에는 없어요(대체 서류에만 공증이 적혀 있어요).', 'This line does not say whether the original needs a translation or notarization (only substitute documents mention notarization).')
    }),
    doc('jj-ug-grad', 'apply', L('고등학교 졸업(예정)증명서(아포스티유 또는 영사확인)', 'High school (expected) graduation certificate (apostille or consular confirmation)'), {
      note: L('원본 1부예요. 졸업예정자는 입학 전에 졸업하지 못하면 입학 허가가 취소돼요. 졸업 뒤 아포스티유를 받은 졸업증명서와 최종 성적증명서를 내요.', 'One original. If you do not graduate before entry, admission is cancelled. After graduating, submit the apostilled graduation certificate and the final transcript.'),
      unclear: L('몽골어 증명서에 번역공증이 필요한지 이 줄에는 없고, 요강 앞쪽의 일반 규칙으로만 알 수 있어요.', 'This line does not say whether a Mongolian certificate needs a notarized translation; only the general rule at the front of the guide does.')
    }),
    doc('jj-ug-transcript', 'apply', L('고등학교 성적증명서(아포스티유 또는 영사확인, 번역공증)', 'High school transcript (apostille or consular confirmation, notarized translation)'), { note: L('원본 1부예요.', 'One original.') }),
    doc('jj-ug-language', 'apply', L('어학능력 입증서류', 'Language proof'), { when: L('원서 접수 시작일에 유효한 것', 'Valid on the first day of applications'), note: L('한국어 트랙은 TOPIK 2급 이상, 세종학당 초급2 이상(온라인 세종학당은 안 됨), 사회통합프로그램 2단계 같은 조건이에요.', 'The Korean track needs TOPIK level 2 or higher, King Sejong Institute Beginner 2 or higher (not online), Social Integration Program level 2 or similar.') }),
    doc('jj-ug-arc', 'apply', L('외국인등록증 사본(앞 · 뒷면)', 'Alien registration card copy (front and back)'), { only: only('해당하는 사람만(한국에 살고 있는 사람)', 'Only if it applies to you (living in Korea)') }),
    doc('jj-ug-video', 'apply', L('면접 동영상', 'Interview video'), { note: L('3분 안, 100MB 이하로 원서 접수 기간에 올려요. 한국어 트랙은 한국어로 답해요.', 'Up to 3 minutes and 100 MB, uploaded during the application period. Korean-track applicants answer in Korean.') }),
    doc('jj-ug-bank', 'admitted', L('재정능력 입증서류', 'Proof of funds'), { when: L('원서 접수 뒤에 발급된 것만', 'Issued after you applied'), note: L('원본 1부예요. 최종 합격자만 내요. 본인이나 부모 명의로 1,600만 원(13,000달러) 이상이에요. 기한은 대학이 따로 알려요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.', 'One original, final admits only, in your own or a parent’s name, ₩16,000,000 (USD 13,000) or more. The university sets the deadline separately. Owner, validity and copies can differ from the visa deposit certificate.') })
  ],
  deadlines: [
    freeze({ round: '2026-12-01', key: 'docs', start: '2026-12-18', label: L('2차 서류 도착 기한(2차 원서를 낸 사람만 · 대학 도착 기준)', 'Round 2 documents must arrive (round 2 applicants only, arrival at the university)') }),
    freeze({ round: '2027-01-04', key: 'docs', start: '2027-01-15', label: L('3차 서류 도착 기한(3차 원서를 낸 사람만 · 대학 도착 기준)', 'Round 3 documents must arrive (round 3 applicants only, arrival at the university)') })
  ]
});

export const PROGRAM_DOCS = freeze({ 'jbnu-ug': JBNU_UG, 'jbnu-lang': JBNU_LANG, 'wku-ug': WKU_UG, 'wku-lang': WKU_LANG, 'jj-ug': JJ_UG });

/* ── 비자 서류(KVAC 몽골, 번호대로) ── */

const SPONSOR_CHECK = L('KVAC 누리집에 「우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 97만 원이 한 달 소득인지 다른 기준인지도 문장만으로는 확실하지 않아요. 둘 다 KVAC에 물어보세요.', 'KVAC says this does not apply to top-certified universities. The text also does not make clear whether ₩970,000 is a monthly income or another measure. Ask KVAC about both.');
const EXEMPT = L('KVAC 누리집에 「우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 내 대학이 해당되는지는 KVAC에 물어보세요.', 'KVAC says this does not apply to top-certified universities. Ask KVAC whether your university counts.');
const visaCommon = (p, src) => [
  doc(`${p}-form`, 'visa', L('사증발급신청서(비자 신청서)', 'Visa application form')),
  doc(`${p}-photo`, 'visa', L('컬러사진(3.5 × 4.5cm)', 'Colour photo (3.5 × 4.5 cm)'), { when: L('최근 6개월 안에 찍은 것', 'Taken within the last 6 months'), note: L('흰색이나 황백색 배경, 정면, 선글라스 · 모자 없이 눈과 귀가 보여야 해요.', 'White or off-white background, facing forward, no sunglasses or hat, eyes and ears visible.') }),
  doc(`${p}-passport`, 'visa', L('여권과 여권 사본 1매', 'Passport and one copy'), { when: L('접수일부터 6개월 이상 남아 있어야 해요.', 'At least 6 months of validity from the application date.') }),
  doc(`${p}-essay`, 'visa', L('자기소개서(KVAC 서식, 본인 서명)', 'Self-introduction (KVAC form, signed by you)'), { unclear: L('KVAC 누리집에 「전액 장학생 및 우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 내가 해당되는지는 KVAC에 물어보세요.', 'KVAC says this does not apply to full scholarship holders and top-certified universities. Ask KVAC whether that includes you.') }),
  doc(`${p}-admission`, 'visa', L('표준입학허가서', 'Standard certificate of admission'), { from: L('합격한 대학이 보내 줘요.', 'Sent by the university after admission.'), when: L('유효기간 3개월', 'Valid for 3 months') }),
  doc(`${p}-bizreg`, 'visa', L('교육기관 사업자등록증 사본', 'Copy of the school’s business registration'), { from: L('대학에서 받아요.', 'From the university.'), when: L('최근 6개월 안에 발급된 것', 'Issued within the last 6 months') })
];
const visaTail = (p) => [
  doc(`${p}-sponsor`, 'visa', L('유학경비 부담능력 입증자료', 'Proof that your sponsor can pay'), { note: L('기본은 부모가 입증해요(부모가 없을 때만 형제자매). 유학경비 지원확인서, 신분증과 관계 증명, 사업자는 납세증명서(etax.mta.mn 영문)와 법인상세조회서(E-Mongolia), 직장인은 사회보험료 납부확인서와 재직증명서 원본, 그 밖에는 최근 3개월 은행거래내역서예요. KVAC 누리집에는 「재정능력 총액이 97만 원(250만 투그릭) 이상」이고 최근 6개월 사회보험료 납부내역으로 월평균 소득을 계산한다고 적혀 있어요. 입증하는 사람의 소득 조건으로 읽혀요. KVAC 누리집에서 예치증명서가 아니라 이 서류에 적힌 조건이에요.', 'Usually your parents (siblings only if there are no parents): a support confirmation, IDs and proof of relationship; business owners add a tax certificate (English, etax.mta.mn) and a company record (E-Mongolia); employees add social insurance records and an original employment certificate; otherwise 3 months of bank statements. KVAC says the “total financial ability” must be at least ₩970,000 (MNT 2,500,000), with average monthly income taken from 6 months of social insurance. This reads as the sponsor’s income. It is listed separately from the deposit.'), unclear: SPONSOR_CHECK }),
  doc(`${p}-civil`, 'visa', L('혼인관계증명서(만 19세 미만은 출생등록증명서)', 'Marriage record (under 19: birth registration certificate)'), { from: L('E-Mongolia에서 외국어로 발급해요.', 'Issued in a foreign language from E-Mongolia.') }),
  doc(`${p}-birth`, 'visa', L('출생증명서', 'Birth certificate')),
  doc(`${p}-crime`, 'visa', L('범죄경력증명서', 'Criminal record certificate'), { from: L('E-Mongolia에서 외국어로 발급해요.', 'Issued in a foreign language from E-Mongolia.'), only: only('만 18세 이상이고 처음 신청하는 사람만', 'Only if you are 18 or older and applying for the first time') }),
  doc(`${p}-tb`, 'visa', L('결핵진단서', 'Tuberculosis test certificate'), { note: L('KVAC가 지정한 기관에서 받아요. 지정기관 목록 링크는 KVAC 누리집에서 열리지 않아 KVAC에 물어보세요.', 'From a KVAC-designated clinic. The list link on the KVAC page does not open, so ask KVAC.') }),
  doc(`${p}-school`, 'visa', L('최종학교 졸업 · 성적증명서 원본(아포스티유)', 'Original graduation certificate and transcript (apostille)'), { note: L('아포스티유를 받은 학력 서류, 또는 영사확인을 받은 서류예요.', 'Apostilled education documents, or documents with consular confirmation.') }),
  doc(`${p}-language`, 'visa', L('어학능력 입증서류', 'Language proof'), { only: only('어학능력 요건이 있는 대학에 가는 사람만', 'Only if your university has a language requirement') })
];

export const VISA_DOCS = freeze({
  'D-2': freeze({
    id: 'docs-visa-d2', name: L('유학(D-2)', 'Student (D-2)'), source: KVAC_D2, checkedAt: '2026-11-22',
    rules: [L('몽골어 서류는 번역본 원본에 번역자 신분증 사본과 번역자 확인서를 붙여요. 신청은 비자신청센터(KVAC)나 공인대행법인에 본인이 직접 가는 것이 원칙이에요.', 'Mongolian documents need an original translation with the translator’s ID copy and the translator confirmation form. You apply in person at the visa center (KVAC) or an authorized agency as a rule.')],
    docs: [
      ...visaCommon('visa-d2'),
      doc('visa-d2-deposit', 'visa', L('예치증명서와 몽골 계좌 거래내역서', 'Deposit certificate and Mongolian bank statement'), { when: L('비자 신청일 기준 14일 안에 발급, 같은 금액을 30일 이상 유지', 'Issued within 14 days of the visa application; keep the amount for at least 30 days'), note: L('수도권 대학 2,000만 원, 비수도권 대학 1,600만 원 이상이에요. 본인이나 부모의 몽골 은행 계좌 거래내역서를 함께 내요. 대학에 내는 잔고 증명과는 명의 · 기한 · 부수가 다를 수 있어요.', '₩20,000,000 for Seoul-area universities, ₩16,000,000 elsewhere, plus the statement of your own or a parent’s Mongolian bank account. Owner, validity and copies can differ from the bank certificate the university asks for.'), unclear: EXEMPT }),
      ...visaTail('visa-d2')
    ]
  }),
  'D-4-1': freeze({
    id: 'docs-visa-d4-1', name: L('어학연수(D-4-1)', 'Language trainee (D-4-1)'), source: KVAC_D4, checkedAt: '2026-11-22',
    rules: [L('몽골어 서류는 번역본 원본에 번역자 신분증 사본과 번역자 확인서를 붙여요. 신청은 비자신청센터(KVAC)나 공인대행법인에 본인이 직접 가는 것이 원칙이에요.', 'Mongolian documents need an original translation with the translator’s ID copy and the translator confirmation form. You apply in person at the visa center (KVAC) or an authorized agency as a rule.')],
    docs: [
      ...visaCommon('visa-d4'),
      doc('visa-d4-plan', 'visa', L('연수계획서와 연수과정 운영 현황', 'Training plan and program overview'), { from: L('대학이 준비해요.', 'Prepared by the university.') }),
      doc('visa-d4-deposit', 'visa', L('예치증명서와 몽골 은행잔고증명서', 'Deposit certificate and Mongolian bank balance certificate'), { when: L('비자 신청일 기준 2주 안에 발급, 같은 금액을 30일 이상 유지', 'Issued within 2 weeks of the visa application; keep the amount for at least 30 days'), note: L('수도권 대학 1,000만 원, 비수도권 대학 800만 원 이상이에요. KVAC 누리집의 문장이 「800만원 이상(비」에서 끊겨 있어요. 대학에 내는 잔고 증명과는 명의 · 기한 · 부수가 다를 수 있어요.', '₩10,000,000 for Seoul-area universities, ₩8,000,000 elsewhere. The KVAC sentence is cut off after “₩8,000,000 or more (non-”. Owner, validity and copies can differ from the bank certificate the university asks for.'), unclear: EXEMPT }),
      ...visaTail('visa-d4')
    ]
  })
});

/**
 * 「번역 초안 만들기」 단추를 다는 서류 줄과 처음 고를 종류(grad 졸업증명서 · transcript 성적증명서).
 * 학교가 몽골어로 내는 졸업 · 성적증명서만 연다. 가족관계 · 출생 증명서는 가족 동의 문장을 갖춘 뒤 연다(번역초안_설계.md).
 * 비자 묶음의 「졸업 · 성적증명서 원본」 줄은 KVAC 규칙(몽골어 서류는 번역본을 붙임)이 있어 단다. 두 서류를 함께 가리키므로 'either'로 두고
 * 화면에서 종류를 고르게 한다(처음은 졸업증명서).
 */
export const TRANSLATE_DOCS = freeze({
  'jbnu-ug-grad': 'grad', 'jbnu-ug-transcript': 'transcript', 'jbnu-lang-grad': 'grad', 'jbnu-lang-transcript': 'transcript',
  'wku-ug-grad': 'grad', 'wku-ug-transcript': 'transcript', 'wku-lang-grad': 'grad', 'wku-lang-transcript': 'transcript',
  'jj-ug-grad': 'grad', 'jj-ug-transcript': 'transcript', 'visa-d2-school': 'either', 'visa-d4-school': 'either'
});
const translateEntry = (docId) => (Object.hasOwn(TRANSLATE_DOCS, docId) ? TRANSLATE_DOCS[docId] : null);
/** 그 줄에서 처음 쓸 종류. 번역 단추가 없는 줄은 null. */
export const translateKindOf = (docId) => { const k = translateEntry(docId); return k === 'either' ? 'grad' : k; };
/** 졸업 · 성적증명서를 함께 가리키는 줄이라 화면에서 종류를 골라야 하는가. */
export const translateKindChoice = (docId) => translateEntry(docId) === 'either';

/** 과정의 비자: 학부는 D-2, 어학연수는 D-4-1. */
export const visaFor = (program) => (program && program.level === 'language' ? 'D-4-1' : 'D-2');

/** 과정의 서류 묶음. 없으면 null. only가 달린 서류를 따로 둔다(빼지 않는다). */
export function docsFor(program) {
  const pd = program && PROGRAM_DOCS[program.id];
  if (!pd) return null;
  const visa = VISA_DOCS[visaFor(program)];
  // 접는 것은 출처가 「해당자만」 · 「가진 사람만」이라고 적은 서류뿐이다. 필수 서류는 내 조건과 상관없이 늘 보인다.
  const fits = (d) => !d.only;
  const all = [...pd.docs, ...visa.docs];
  return { program: pd, visa, all, mine: all.filter(fits), notMine: all.filter((d) => !fits(d)) };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v, max = 600) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isPair = (v, max) => isObj(v) && isText(v.ko, max) && isText(v.en, max);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isHttps = (v) => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const fail = (m) => { throw new TypeError('Invalid docs data: ' + m); };

/** 서류 자료의 약속을 검사한다. programIds는 실제로 싣는 과정 id. 어기면 던진다. */
export function validateDocsData(programDocs = PROGRAM_DOCS, visaDocs = VISA_DOCS, programIds = Object.keys(programDocs)) {
  const ids = new Set();
  const checkDoc = (d, where) => {
    if (!isObj(d) || !ID_RE.test(d.id) || ids.has(d.id) || !DOC_STAGES.includes(d.stage) || !isPair(d.name, 200)) fail('doc ' + where + ' ' + (d && d.id));
    for (const k of ['from', 'when', 'note', 'unclear']) if (!(d[k] === null || isPair(d[k]))) fail('doc text ' + d.id + ' ' + k);
    if (!(d.only === null || (isObj(d.only) && isPair(d.only.cond, 200)))) fail('doc only ' + d.id);
    if (!(d.changedAt === undefined || isDate(d.changedAt))) fail('doc changedAt ' + d.id);
    ids.add(d.id);
  };
  const checkSet = (set, where, id) => {
    if (!isObj(set) || set.id !== id || !isObj(set.source) || !isPair(set.source.title) || !isHttps(set.source.url) || !isDate(set.checkedAt)) fail('source ' + where);
    if (!Array.isArray(set.docs) || !set.docs.length) fail('docs ' + where);
    if (!(set.rules === undefined || (Array.isArray(set.rules) && set.rules.every((r) => isPair(r))))) fail('rules ' + where);
    if (!(set.unclear === undefined || (Array.isArray(set.unclear) && set.unclear.every((r) => isPair(r))))) fail('unclear ' + where);
  };
  for (const [pid, pd] of Object.entries(programDocs)) {
    if (!programIds.includes(pid)) fail('unknown program ' + pid);
    checkSet(pd, pid, `docs-${pid}`);
    if (!isPair(pd.how) || !isPair(pd.term) || !(pd.status === undefined || isPair(pd.status)) || !(pd.ask === undefined || isPair(pd.ask))) fail('program text ' + pid);
    for (const d of pd.docs) { checkDoc(d, pid); if (d.stage === 'visa') fail('visa doc in program ' + d.id); if (!d.id.startsWith(pid + '-')) fail('doc id prefix ' + d.id); }
    if (!Array.isArray(pd.deadlines)) fail('deadlines ' + pid);
    const seen = new Set();
    for (const x of pd.deadlines) {
      const key = `${x && x.round}-${x && x.key}`;
      if (!isObj(x) || !isDate(x.round) || !['docs', 'originals'].includes(x.key) || !isDate(x.start) || x.start < x.round || !isPair(x.label) || seen.has(key)) fail('deadline ' + pid);
      seen.add(key);
    }
  }
  for (const [visa, vd] of Object.entries(visaDocs)) {
    checkSet(vd, visa, `docs-visa-${visa.toLowerCase().replace('-', '')}`);
    if (!isPair(vd.name)) fail('visa name ' + visa);
    for (const d of vd.docs) { checkDoc(d, visa); if (d.stage !== 'visa') fail('non-visa doc in visa ' + d.id); }
  }
  // 번역 단추를 다는 줄은 실제로 있는 서류여야 하고, 종류는 첫 판의 둘뿐이다.
  for (const [id, kind] of Object.entries(TRANSLATE_DOCS)) if (!ids.has(id) || !['grad', 'transcript', 'either'].includes(kind)) fail('translate doc ' + id);
  return true;
}

/** 서류 기한을 대학 소식 글의 날로. id는 차수의 시작 날에 매단다(univ-<과정>-<차수 시작>-docs · -originals). docsDue는 맨 위 글을 고를 때 빼는 표시다. */
export function deadlineDates(programId) {
  const pd = PROGRAM_DOCS[programId];
  if (!pd) return [];
  return pd.deadlines.map((x) => freeze({ id: `univ-${programId}-${x.round}-${x.key}`, kind: 'deadline', start: x.start, label: x.label, docsDue: true }));
}
