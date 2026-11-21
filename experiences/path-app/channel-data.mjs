// PATH 채널 자료. 글마다 공식 출처와 확인한 날이 붙는다. 순수 자료와 함수만 둔다(창, DOM, 저장소를 쓰지 않는다).
// 「대학 소식」 글은 손으로 적지 않고 study-data.mjs의 실제 과정 접수 차수에서 만든다(같은 날을 두 곳에 적지 않는다).
// 검사(validateChannelData)는 공개 묶음 도구와 시험이 부른다. 날짜에 따라 바뀌는 조건(90일, 지난 날)은 검사에 넣지 않는다.
import { daysUntil } from './study-data.mjs';

const L = (ko, en) => Object.freeze({ ko, en });

export const DATE_KINDS = Object.freeze(['apply', 'exam', 'result', 'deadline']);
export const FOR_YOU = Object.freeze(['topikExam', 'finance', 'gksGrade', 'program']);
export const POST_STATUS = Object.freeze(['official', 'announced']);
export const CHANNEL_TONES = Object.freeze(['lapis', 'meadow', 'ink', 'coral']);
export const STALE_DAYS = 90;
export const NEW_DAYS = 14;

export const CHANNELS = Object.freeze([
  { id: 'topik', tone: 'lapis', name: L('TOPIK', 'TOPIK'), sub: L('시험 일정, 접수, 성적 쓰는 법', 'Test dates, registration and using your score') },
  { id: 'visa', tone: 'ink', name: L('비자와 서류', 'Visas and documents'), sub: L('유학 비자, 잔고 증명, 서류 확인', 'Student visas, proof of funds and document checks') },
  { id: 'scholarship', tone: 'meadow', name: L('장학금', 'Scholarships'), sub: L('정부 장학금, 대학 장학금, 모집 시기', 'Government and university scholarships and when they open') },
  { id: 'scam', tone: 'coral', name: L('사기 주의', 'Scam alerts'), sub: L('가짜 유학원 가리는 법, 공식 창구', 'Spotting fake agencies and finding the official desks') },
  { id: 'univ', tone: 'lapis', name: L('대학 소식', 'University news'), sub: L('공개 모집 요강의 접수 일정', 'Application dates from published admissions guides') }
].map(Object.freeze));

/** 글이 모이기 전인 채널. 목록에 한 줄로만 둔다. */
export const COLLECTING = Object.freeze([L('한국 생활', 'Life in Korea'), L('취업', 'Jobs'), L('선배 이야기', 'Stories from seniors'), L('부모님 방', 'For parents')]);

/**
 * 손으로 적는 글. 사실과 날은 공식 쪽에서 직접 읽은 것만 쓴다(2026-11-21 확인).
 * 재정 금액과 잔고 증명 기간은 study-data.mjs의 RULES에만 두고 글에 다시 적지 않는다(「내게 해당되나요?」가 RULES를 읽는다).
 */
const freezePost = (p) => Object.freeze({ ...p, points: Object.freeze([...p.points]), dates: Object.freeze((p.dates || []).map(Object.freeze)) });
const KVAC_D2 = 'https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4';
export const POSTS = Object.freeze([
  {
    id: 'topik-mn-2026-results', channel: 'topik', status: 'official',
    title: L('몽골에서 본 하반기 TOPIK 성적은 12월에 나와요', 'Scores from the autumn TOPIK tests in Mongolia come out in December'),
    points: [
      L('PBT 제108회(10월 18일 시험) 성적은 12월 10일, 제109회(11월 15일 시험) 성적은 12월 22일에 나와요.', 'PBT round 108 (tested Oct 18) results come out on Dec 10, and round 109 (tested Nov 15) on Dec 22.'),
      L('IBT 제16회는 11월 28일 몽골국립대학교에서 치르고 성적은 12월 18일에 나와요. 이 회차 접수는 끝났어요.', 'IBT round 16 is held at the National University of Mongolia on Nov 28, with results on Dec 18. Registration for it has closed.'),
      L('TOPIK 성적은 성적 발표일로부터 2년 동안 유효해요.', 'TOPIK scores are valid for two years from the results date.')
    ],
    source: { title: L('TOPIK 누리집 시험 일정', 'TOPIK official test schedule'), url: 'https://www.topik.go.kr/TWGUID/TWGUID0020.do?searchGubun=ALL' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21',
    dates: [
      { id: 'topik-ibt16-exam-mn', kind: 'exam', start: '2026-11-28', label: L('IBT 제16회 시험(몽골)', 'IBT round 16 test (Mongolia)'), url: 'https://topik.mn/ibt/Home/Content/3' },
      { id: 'topik-pbt108-result', kind: 'result', start: '2026-12-10', label: L('PBT 제108회 성적 발표', 'PBT round 108 results') },
      { id: 'topik-ibt16-result', kind: 'result', start: '2026-12-18', label: L('IBT 제16회 성적 발표', 'IBT round 16 results') },
      { id: 'topik-pbt109-result', kind: 'result', start: '2026-12-22', label: L('PBT 제109회 성적 발표', 'PBT round 109 results') }
    ],
    forYou: 'topikExam', action: { label: L('TOPIK 누리집 열기', 'Open the TOPIK site'), url: 'https://www.topik.go.kr/' }
  },
  {
    id: 'topik-2027-plan', channel: 'topik', status: 'official',
    title: L('2027년 TOPIK 일정이 나왔어요. 몽골 회차는 1월에 공지돼요', '2027 TOPIK dates are out. Mongolia rounds will be announced in January'),
    points: [
      L('2027년에는 PBT가 제110회부터 제115회까지 여섯 번, IBT가 제17회부터 제22회까지 여섯 번 열려요(교육부 공고 제2026-419호).', 'In 2027 there are six PBT rounds (110–115) and six IBT rounds (17–22), under Ministry of Education notice 2026-419.'),
      L('몽골에서 어느 회차를 여는지와 몽골 접수 기간은 아직 공지되지 않았어요. 국외 PBT 시행 국가와 접수처는 2027년 1월 중 TOPIK 누리집에 올라와요.', 'Which rounds run in Mongolia, and when registration opens there, has not been announced. Overseas PBT countries and registration offices will be posted on the TOPIK site in January 2027.'),
      L('몽골 접수 기간은 한국 국내와 달라요. 2026년 제109회는 몽골 접수가 8월 17~21일, 국내 접수가 9월 1~7일이었어요. 몽골에서는 topik.mn에서 접수해요.', 'Registration in Mongolia runs on different dates from Korea. For round 109 in 2026, Mongolia took registrations Aug 17–21 while Korea took them Sep 1–7. In Mongolia you register at topik.mn.')
    ],
    source: { title: L('TOPIK 누리집 「2027년 한국어능력시험 시행계획 공고」', 'TOPIK site: 2027 TOPIK administration plan'), url: 'https://www.topik.go.kr/TWINFO/TWINFO0011.do?bbsId=BBSMSTR00076&nttId=140003' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [],
    forYou: null, action: { label: L('몽골 TOPIK 접수처(topik.mn)', 'TOPIK registration in Mongolia (topik.mn)'), url: 'https://topik.mn/' }
  },
  {
    id: 'visa-funds-proof', channel: 'visa', status: 'official',
    title: L('유학 비자 잔고 증명, 얼마를 얼마 동안', 'Proof of funds for a student visa: how much, and for how long'),
    points: [
      L('유학(D-2)과 어학연수(D-4) 비자를 신청할 때 은행 잔고 증명이 필요해요. 금액은 비자 종류와 대학이 수도권인지에 따라 달라요.', 'Student (D-2) and language training (D-4) visas need proof of funds. The amount depends on the visa and on whether the school is in the Seoul area.'),
      L('몽골에서 신청할 때는 예치(잔고) 증명서와 본인이나 부모의 몽골 은행 계좌 거래내역서를 내요. 언제 발급받는지와 얼마 동안 유지하는지에도 조건이 있어요.', 'In Mongolia you submit a deposit (balance) certificate and the statement of your own or a parent’s Mongolian bank account. There are rules on when it is issued and how long the money is kept.'),
      L('법무부가 TOPIK 4급이 있으면 이 증명을 면제하는 계획을 발표했지만 시행일은 정해지지 않았어요. 지금은 증명이 필요해요.', 'The Ministry of Justice has announced a plan to waive this proof for TOPIK level 4, but no start date has been set. For now the proof is required.')
    ],
    // KVAC에서 읽은 사실은 출처 줄(법무부)과 따로 날짜와 함께 적는다(페이블 다시 검수 FA2).
    note: L('KVAC 몽골 유학(D-2) 서류 목록 7번 칸(2026-11-22 확인): 예치증명서와 본인 또는 부모의 몽골 은행 계좌 거래내역서. 같은 칸에 「우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 내 학교가 해당되는지는 아래 KVAC 서류 목록에서 확인하세요.', 'KVAC Mongolia student visa (D-2) list, item 7 (checked 2026-11-22): a deposit certificate and the transaction statement of your own or a parent’s Mongolian bank account. The same item says it does not apply to top-certified universities. Check whether your school counts in the KVAC list below.'),
    source: { title: L('법무부 2026-10-07 보도자료(별첨의 현행 기준)', 'Ministry of Justice press release, 2026-10-07 (current rules in the annex)'), url: 'https://www.moj.go.kr/bbs/moj/182/611170/artclView.do' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [],
    forYou: 'finance', action: { label: L('KVAC 유학 비자 서류 목록', 'KVAC student visa document list'), url: KVAC_D2 }
  },
  {
    id: 'visa-docs-mn', channel: 'visa', status: 'official',
    title: L('몽골에서 유학 비자를 낼 때 챙길 서류', 'Documents for a student visa applied for in Mongolia'),
    points: [
      L('KVAC 서류 목록에는 학력 서류를 「아포스티유 확인을 받은 서류」로 내라고 적혀 있어요. 몽골 학교 졸업자는 원본으로 되는지 문구가 분명하지 않으니 KVAC에 먼저 물어보세요.', 'The KVAC list asks for academic documents “with an Apostille”. The wording on whether graduates of Mongolian schools may submit originals is unclear, so ask KVAC first.'),
      L('결핵진단서가 필요해요. 대사관이 지정한 울란바토르 병원 아홉 곳에서 받을 수 있고, 병원 목록은 KVAC 누리집에 있어요.', 'A tuberculosis certificate is required. You can get it at nine Ulaanbaatar hospitals designated by the embassy; the list is on the KVAC site.'),
      L('몽골어 서류에는 번역본과 번역자 신분증 사본, 「번역자 확인서」를 함께 내요. 심사는 20일 걸리고, KVAC에 본인이 직접 접수할 수 있어요.', 'Mongolian-language documents need a translation, a copy of the translator’s ID and a translator’s confirmation form. Review takes 20 days, and you can apply at KVAC yourself.')
    ],
    source: { title: L('KVAC 몽골 「유학(D-2-1~D-2-4)」 서류 목록', 'KVAC Mongolia: Study visa (D-2-1 to D-2-4) documents'), url: KVAC_D2 },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [],
    forYou: null, action: { label: L('KVAC 유학 비자 서류 목록', 'KVAC student visa document list'), url: KVAC_D2 }
  },
  {
    id: 'gks-2027-u', channel: 'scholarship', status: 'official',
    title: L('2027 정부초청장학생(GKS) 학부: 대사관 접수는 끝났고 1월 7일 발표', '2027 GKS undergraduate: embassy applications have closed, results on Jan 7'),
    points: [
      L('2027 학부 장학생 대사관 전형은 몽골에서 4명을 뽑아요. 일반 전형 2명, 지방 대학에만 지원하는 R-GKS 전형 2명이에요. 접수는 2026년 9월 15~30일에 끝났어요.', 'The 2027 undergraduate embassy track selects 4 students from Mongolia: 2 in the general track and 2 in R-GKS, which applies to regional universities only. Applications ran Sep 15–30, 2026 and have closed.'),
      L('지원 조건은 만 25세 미만(2002년 3월 1일 이후 출생), 고등학교 졸업 또는 졸업 예정, 본인과 부모 모두 외국 국적이에요. TOPIK 3급 이상이면 가산점이 있어요.', 'You must be under 25 (born on or after Mar 1, 2002), have finished or be finishing high school, and you and both parents must hold non-Korean nationality. TOPIK level 3 or higher earns extra points.'),
      L('장학생은 한국어연수 1년과 학위 과정 동안 등록금(학기당 500만 원 한도), 왕복 항공료, 학업장려금(학위 기간 한 해 1,440만 원)을 받아요. 최종 합격 발표는 2027년 1월 7일 예정이에요.', 'Scholars get one year of Korean training plus the degree, with tuition (up to ₩5,000,000 a semester), round-trip airfare and a stipend (₩14,400,000 a year during the degree). Final results are planned for Jan 7, 2027.')
    ],
    source: { title: L('주몽골 한국대사관 「2027 정부초청 외국인(몽골국적) 학부 장학생 모집」', 'Korean Embassy in Mongolia: 2027 GKS undergraduate call'), url: 'https://overseas.mofa.go.kr/mn-ko/brd/m_373/view.do?seq=1339551' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21',
    dates: [{ id: 'gks-2027-u-final', kind: 'result', start: '2027-01-07', label: L('GKS 학부 최종 합격 발표(예정)', 'GKS undergraduate final results (planned)') }],
    forYou: 'gksGrade', criteria: { gradePct: 80, of: L('고등학교 전 학년 성적', 'all high school years'), other: L('또는 석차 상위 20% 안, 또는 CGPA 2.64/4.0 이상', 'or the top 20% of your class, or a CGPA of 2.64/4.0 or higher') },
    action: null
  },
  {
    id: 'gks-2027-g', channel: 'scholarship', status: 'official',
    title: L('2027 GKS 대학원 장학생은 아직 공고 전이에요', '2027 GKS graduate scholarships have not been announced yet'),
    points: [
      L('2027 대학원 장학생 요강은 2026년 11월 21일 현재 Study in Korea에 올라오지 않았어요. 2026년에는 2월 2일에 요강이 올라왔어요.', 'As of Nov 21, 2026 the 2027 graduate guidelines are not on Study in Korea. In 2026 they were posted on Feb 2.'),
      L('2026년 몽골 대사관 전형은 2월 12~25일에 접수했고 일반과정 13명을 뽑았어요.', 'In 2026 the Mongolia embassy track took applications Feb 12–25 and selected 13 students for the general program.'),
      L('2026년 기준 지원 조건은 40세 미만, 학사 또는 석사 졸업, 직전 과정 평균 80% 이상이에요. 2027년 요강이 나오면 다시 확인하세요.', 'The 2026 requirements were: under 40, a bachelor’s or master’s degree, and an average of 80% or higher in your last program. Check again when the 2027 guidelines come out.')
    ],
    source: { title: L('Study in Korea 「정부초청 장학금」 안내', 'Study in Korea: Government scholarships'), url: 'https://www.studyinkorea.go.kr/ko/plan/scholarship.do' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [], forYou: null, action: null
  },
  {
    id: 'scam-visa-guarantee', channel: 'scam', status: 'official',
    title: L('「비자를 받아 준다」는 말은 믿지 마세요', 'Do not trust anyone who promises you a visa'),
    points: [
      L('비자는 대사관이 심사해서 내줘요. KVAC는 어떤 개인이나 제3자도 비자 발급을 보장할 수 없다고 공지했어요(2026-01-23).', 'Visas are reviewed and issued by the embassy. KVAC has announced that no individual or third party can guarantee a visa (2026-01-23).'),
      L('KVAC 예약은 무료이고 이메일과 전화로만 받아요. 비자 수수료와 서비스 수수료는 신청할 때 KVAC에서 내고 영수증을 받아요.', 'KVAC appointments are free and taken only by email and phone. Visa and service fees are paid at KVAC when you apply, and you get a receipt.'),
      L('대사관은 정해진 수수료보다 많은 돈을 요구하면 사기라고 경고했어요(2026-02-06 취업비자 안내). 의심스러우면 대사관이나 KVAC에 알리세요.', 'The embassy has warned that asking for more than the set fee is a scam (2026-02-06, work visa notice). If something seems wrong, tell the embassy or KVAC.')
    ],
    source: { title: L('KVAC 몽골 「Important Notices」', 'KVAC Mongolia: Important Notices'), url: 'https://www.visaforkorea.mn/important-notices' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [],
    forYou: null, action: { label: L('KVAC 공식 누리집', 'KVAC official site'), url: 'https://www.visaforkorea.mn/' }
  },
  {
    id: 'scam-check-university', channel: 'scam', status: 'official',
    title: L('지원하기 전에 인증 대학인지 확인하세요', 'Check that the university is certified before you apply'),
    points: [
      L('교육부와 법무부가 교육국제화역량을 인증한 대학은 학위과정 181곳, 어학연수과정 123곳이에요. 인증 기간은 2026년 3월부터 2030년 2월까지지만, 해마다 점검해 기준에 못 미치면 인증이 취소되니 지원할 때 명단을 다시 확인하세요.', 'The Ministry of Education and the Ministry of Justice have certified 181 universities for degree programs and 123 for language programs, from Mar 2026 to Feb 2030. Certification is checked every year and can be withdrawn, so check the list again when you apply.'),
      L('2026년 2학기부터 1년 동안 비자 발급이 제한되는 대학이 학위과정 16곳, 어학연수과정 4곳 있어요. 같은 대학도 과정마다 따로 정해지니 내가 갈 과정으로 확인하세요.', 'For one year from the second semester of 2026, visas are restricted at 16 universities for degree programs and 4 for language programs. Degree and language tracks are judged separately, so check the track you plan to join.'),
      L('KVAC도 학생비자를 신청하기 전에 Study in Korea의 인증 대학 명단에서 학교를 확인하라고 안내해요.', 'KVAC also tells students to check the school against the certified list on Study in Korea before applying for a student visa.')
    ],
    source: { title: L('법무부 · 교육부 「2025년 교육국제화역량 인증 결과」 보도자료(2026-02-12)', 'Ministries of Justice and Education: 2025 certification results (2026-02-12)'), url: 'https://www.moj.go.kr/bbs/moj/182/603491/artclView.do' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [],
    forYou: null, action: { label: L('Study in Korea 인증 대학 명단', 'Study in Korea certified list'), url: 'https://www.studyinkorea.go.kr/ko/plan/certifiedUniversity.do' }
  },
  {
    id: 'scam-agency-registration', channel: 'scam', status: 'announced',
    title: L('해외 유학원 등록제는 아직 계획이에요', 'Registration of overseas study agencies is still only a plan'),
    points: [
      L('법무부는 2026-10-07에 재외공관과 함께 요건을 갖춘 현지 유학원을 골라 공개하고 관리하는 「해외 유학원 등록제」 계획을 발표했어요.', 'On 2026-10-07 the Ministry of Justice announced a plan to select, publish and manage qualified local study agencies together with embassies.'),
      L('추진 일정은 「2027년 하반기까지」로 적혀 있고 시행일은 정해지지 않았어요. 시범 운영할 공관도 공개되지 않았어요.', 'The plan says “by the second half of 2027”; no start date has been set, and the pilot embassies have not been named.'),
      L('법무부는 도입 이유로 유학원의 과도한 수수료, 부정확한 정보, 허위 서류 작성을 들었어요. 시행 전인 지금은 대학 요강과 KVAC 안내를 직접 확인하세요.', 'The ministry cited excessive agency fees, inaccurate information and false documents. Until it starts, check university guides and KVAC notices yourself.')
    ],
    source: { title: L('법무부 2026-10-07 보도자료', 'Ministry of Justice press release, 2026-10-07'), url: 'https://www.moj.go.kr/bbs/moj/182/611170/artclView.do' },
    checkedAt: '2026-11-21', postedAt: '2026-11-21', dates: [], forYou: null, action: null
  }
].map((p) => freezePost(p)));


const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** 「12월 3일」 · 「Dec 3」. baseYear와 해가 다르면 해를 붙인다. */
export function monthDay(d, en, baseYear) {
  const [y, m, day] = d.split('-').map(Number), yr = baseYear !== undefined && y !== baseYear;
  return en ? `${MON[m - 1]} ${day}${yr ? `, ${y}` : ''}` : `${yr ? `${y}년 ` : ''}${m}월 ${day}일`;
}

/** 「대학 소식」 글: 실제 과정마다 한 편. 접수 차수가 날이 되고, 날의 id는 차수의 시작 날이다. */
export function univPosts(programs) {
  return programs.filter((p) => !p.example && Array.isArray(p.applyRounds) && p.applyRounds.length).map((p) => {
    const rounds = p.applyRounds, many = rounds.length > 1, base = Number(rounds[0][0].slice(0, 4));
    const span = (r, en) => `${monthDay(r[0], en, base)} – ${monthDay(r[1], en, base)}`;
    // 차수가 지나도 맞는 말(「접수 기간」)로 쓰고, 첫 해를 밝힌다(이듬해에 열어도 해가 헷갈리지 않게).
    const roundsText = L(
      `접수 기간(${base}년): ${rounds.map((r, i) => `${many ? `${i + 1}차 ` : ''}${span(r, false)}`).join(', ')}.`,
      `Application periods (${base}): ${rounds.map((r, i) => `${many ? `round ${i + 1} ` : ''}${span(r, true)}`).join(', ')}.`);
    const who = L(`${p.name.ko}${p.level !== 'language' ? ' 학부' : ''}`, `${p.name.en}${p.level !== 'language' ? ' undergraduate' : ''}`);
    const korean = p.requires.topik ? L(`TOPIK ${p.requires.topik}급 이상이 필요해요. 다른 길도 있는지 요강에서 확인하세요.`, `TOPIK level ${p.requires.topik} or higher is required. Check the guide for other ways to qualify.`)
      : L('한국어 성적이 없어도 지원할 수 있어요.', 'You can apply without a Korean test score.');
    const ug = p.level !== 'language';
    return freezePost({
      id: 'univ-' + p.id, channel: 'univ', status: 'official',
      title: L(`${p.name.ko}${ug ? ' 학부' : ''}${p.term ? ` ${p.term.ko}` : ''} 원서 접수`, `${p.name.en}${ug ? ' undergraduate' : ''}${p.term ? `, ${p.term.en}` : ''}: applications`),
      points: [roundsText, korean, L('대학이 공개한 모집 요강에서 옮겼어요. SYNK와 협약한 대학은 아니에요.', 'Taken from the university’s published admissions guide. Not a SYNK partner university.')],
      source: p.source, checkedAt: p.checkedAt, postedAt: p.checkedAt,
      dates: rounds.map((r, i) => ({ id: `univ-${p.id}-${r[0]}`, kind: 'apply', start: r[0], end: r[1], label: many ? L(`${i + 1}차 원서 접수`, `Round ${i + 1} applications`) : L('원서 접수', 'Applications'), who })),
      // 과정 자료에는 요강 주소만 있고 접수처 주소가 없다(원광대 학부는 방문 · 우편 접수). 접수처 단추를 걸지 않는다.
      forYou: 'program', programId: p.id, action: null
    });
  });
}

/** 화면에 쓰는 글 전부: 손으로 적은 글 + 대학 소식. */
export function allPosts(programs, posts = POSTS) {
  return [...posts, ...univPosts(programs)];
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T00:00:00Z'));
const isText = (v, max = 200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isPair = (v, max) => isObj(v) && isText(v.ko, max) && isText(v.en, max);
const isHttps = (v) => { try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const fail = (m) => { throw new TypeError('Invalid channel data: ' + m); };

/** 자료의 약속을 검사한다. 어기면 던진다. programIds는 실제로 있는 과정 id들이다. */
export function validateChannelData(channels, posts, programIds = []) {
  if (!Array.isArray(channels) || !Array.isArray(posts)) fail('lists');
  const chIds = new Set();
  for (const c of channels) {
    if (!isObj(c) || !ID_RE.test(c.id) || chIds.has(c.id) || !CHANNEL_TONES.includes(c.tone) || !isPair(c.name) || !isPair(c.sub)) fail('channel ' + (c && c.id));
    chIds.add(c.id);
  }
  const postIds = new Set(), dateIds = new Set();
  for (const p of posts) {
    if (!isObj(p) || !ID_RE.test(p.id) || postIds.has(p.id)) fail('post id ' + (p && p.id));
    postIds.add(p.id);
    if (!chIds.has(p.channel) || !POST_STATUS.includes(p.status) || !isPair(p.title)) fail('post text ' + p.id);
    if (!Array.isArray(p.points) || p.points.length !== 3 || !p.points.every((x) => isPair(x, 300))) fail('post points ' + p.id);
    if (!(p.note === undefined || isPair(p.note, 600))) fail('post note ' + p.id);
    if (!isObj(p.source) || !isPair(p.source.title) || !isHttps(p.source.url) || !isDate(p.checkedAt) || !isDate(p.postedAt)) fail('post source ' + p.id);
    if (!(p.forYou === null || FOR_YOU.includes(p.forYou))) fail('post forYou ' + p.id);
    if ((p.forYou === 'program') !== (p.programId !== undefined) || (p.programId !== undefined && !programIds.includes(p.programId))) fail('post program ' + p.id);
    if (!(p.action === null || (isObj(p.action) && isPair(p.action.label) && isHttps(p.action.url)))) fail('post action ' + p.id);
    if (!Array.isArray(p.dates)) fail('post dates ' + p.id);
    for (const d of p.dates) {
      if (!isObj(d) || !ID_RE.test(d.id) || dateIds.has(d.id) || !DATE_KINDS.includes(d.kind) || !isDate(d.start) || !isPair(d.label)) fail('date ' + p.id);
      dateIds.add(d.id);
      if (d.kind === 'apply' ? !(isDate(d.end) && d.end >= d.start) : d.end !== undefined) fail('date span ' + d.id);
      if (!(d.url === undefined || isHttps(d.url)) || !(d.cancelled === undefined || d.cancelled === true) || !(d.who === undefined || isPair(d.who))) fail('date extra ' + d.id);
    }
    // 규칙마다 필요한 자료: 시험 글은 성적 발표 날, 장학금 성적 글은 기준.
    if (p.forYou === 'topikExam' && !p.dates.some((d) => d.kind === 'result')) fail('topikExam needs a result date ' + p.id);
    if (p.forYou === 'gksGrade' ? !(isObj(p.criteria) && Number.isInteger(p.criteria.gradePct) && p.criteria.gradePct > 0 && p.criteria.gradePct <= 100 && (p.criteria.other === undefined || isPair(p.criteria.other, 300)) && (p.criteria.of === undefined || isPair(p.criteria.of))) : p.criteria !== undefined) fail('post criteria ' + p.id);
  }
  return true;
}

/** 넣은 날의 「그날」: 접수 기간은 끝 날, 나머지는 그날. */
export const dueDay = (d) => (d.kind === 'apply' ? d.end : d.start);
export const endDay = (d) => (d.kind === 'apply' ? d.end : d.start);

/**
 * 날의 지금 상태(한국 날짜로 센다).
 * apply: before(시작 전, days = 시작까지) · open(접수 중, days = 끝까지) · past.
 * 그 밖: soon(days = 그날까지, 오늘이면 0) · past. 취소된 날은 cancelled.
 */
export function dateStatus(d, now = new Date()) {
  if (d.cancelled) return { state: 'cancelled', days: null };
  if (d.kind === 'apply') {
    const toStart = daysUntil(d.start, now);
    if (toStart !== null && toStart > 0) return { state: 'before', days: toStart };
    const toEnd = daysUntil(d.end, now);
    return toEnd === null ? { state: 'past', days: null } : { state: 'open', days: toEnd };
  }
  const days = daysUntil(d.start, now);
  return days === null ? { state: 'past', days: null } : { state: 'soon', days };
}

export function findDate(posts, id) {
  for (const post of posts) for (const date of post.dates) if (date.id === id) return { post, date };
  return null;
}

/**
 * 오늘 화면의 「다가오는 날」. saved는 [{ id, start, end }](넣을 때 본 날)이다.
 * changed는 넣을 때 본 날이 지금 자료와 다를 때 그 옛 날({ start, end }). missing은 자료에서 못 찾은 넣은 날 수.
 */
export function upcomingDates(posts, saved, now = new Date()) {
  const rows = [];
  let missing = 0;
  for (const s of saved) {
    const hit = findDate(posts, s.id);
    if (!hit) { missing++; continue; }
    const d = hit.date, end = endDay(d);
    const changed = s.start !== d.start || s.end !== end ? { start: s.start, end: s.end } : null;
    // 차례는 화면의 날짜 칸과 같은 날로 센다: 시작 전인 접수는 시작 날(카본 A5).
    const status = dateStatus(d, now);
    rows.push({ ...hit, due: status.state === 'before' ? d.start : dueDay(d), status, changed });
  }
  const byDue = (a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0);
  const gone = (r) => r.status.state === 'past' || r.status.state === 'cancelled';
  return { upcoming: rows.filter((r) => !gone(r)).sort(byDue), past: rows.filter(gone).sort(byDue).reverse(), missing };
}

/** 그날부터 오늘(한국 날짜)까지 지난 날 수. */
function daysSince(dateText, now) {
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Math.floor((t + 9 * 3600000) / 86400000) - Date.parse(dateText + 'T00:00:00Z') / 86400000;
}

/** 확인한 지 90일을 넘긴 글(공식 안내에서 다시 확인하라고 알린다). 확인한 날부터 90일째까지는 아니다. */
export function isStalePost(post, now = new Date(), days = STALE_DAYS) {
  return daysSince(post.checkedAt, now) > days;
}

/** 올린 지 NEW_DAYS일 안인 글(저장 없이 세는 「새 글」). */
export function isNewPost(post, now = new Date(), days = NEW_DAYS) {
  return daysSince(post.postedAt, now) < days;
}

/** 글에서 가장 가까운(지나지 않은 · 취소되지 않은) 날. 없으면 null. */
export function nextDate(post, now = new Date()) {
  let best = null;
  for (const d of post.dates) {
    const st = dateStatus(d, now);
    if (st.state === 'past' || st.state === 'cancelled') continue;
    const due = st.state === 'before' ? d.start : dueDay(d);
    if (!best || due < best.due) best = { date: d, status: st, due };
  }
  return best;
}

const newest = (a, b) => (a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0);

/** 채널 화면 맨 위 글: 가장 가까운 날이 있는 글, 없으면 새로 올린 글. */
export function featuredPost(posts, now = new Date()) {
  let best = null;
  for (const p of posts) {
    const n = nextDate(p, now);
    if (n && (!best || n.due < best.due)) best = { post: p, due: n.due };
  }
  return best ? best.post : [...posts].sort(newest)[0] || null;
}

/** 새 소식: 보이기로 둔 채널의 글을 새로 올린 순으로. */
export function latestPosts(posts, channelsOff = [], n = 2) {
  return posts.filter((p) => !channelsOff.includes(p.channel)).sort(newest).slice(0, n);
}

export function postById(posts, id) {
  return posts.find((p) => p.id === id) || null;
}
