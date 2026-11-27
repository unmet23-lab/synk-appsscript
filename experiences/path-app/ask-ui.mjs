// PATH 「물어보기」(AI 상담) · 「사람에게 연결」 · 「내 상담」 화면. 상태를 받아 HTML 글을 내는 순수 함수만 둔다(창, DOM, 저장소, 네트워크를 쓰지 않는다).
// 결: 시안 2판(.sx)과 번역 초안 · 서류 점검 쪽. 공개 CSP(style-src 'self')라 인라인 스타일을 쓰지 않는다.
// 모델이 낸 글(답 · 요약)과 학생 글은 모두 esc()를 거친다. 「AI의 안내」 표시와 안내 글은 모델 글과 섞이지 않는 자리에 둔다.
// 「위험해요」 입구는 로그인 · 동의 · 나이 · 한도 · 스위치와 상관없이 늘 맨 위에 있고, 모델을 부르지 않는다(emergency.mjs의 고정 글).
import { CONTACTS, EMERGENCY_CHECKED, MN_REVIEWED, urgentText } from './emergency.mjs';
import { MASK_TOKEN } from './ask-shape.mjs';
import { CASE_STATUSES, HELP_MAIL, MAX_QUESTION_CHARS, MAX_NOTE_CHARS, briefExpired, screenTarget, teenReady } from './ask-flow.mjs';

/** 이 쪽의 몽골어 글(아래 M의 셋째 칸)이 현지어 검수(tools/몽골어대조.js)를 마쳤는가. false면 몽골어 줄을 보이지 않는다. */
export const ASK_MN_REVIEWED = false;
export const ASK_PRIVACY_URL = 'https://synk.im/privacy/#path-ask';
export const CASE_PRIVACY_URL = 'https://synk.im/privacy/#path-cases';
const PRIVACY_URL_EN = 'https://synk.im/privacy/#synk-id-en';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
const BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
const PHONE = svg('<path d="M6.2 3.5h-2a1 1 0 0 0-1 1.1c.5 6.3 5.9 11.7 12.2 12.2a1 1 0 0 0 1.1-1v-2a1 1 0 0 0-.8-1l-2.6-.6a1 1 0 0 0-1 .3l-1 1a9.5 9.5 0 0 1-4.2-4.2l1-1a1 1 0 0 0 .3-1l-.6-2.6a1 1 0 0 0-1-.8z"/>');
const GO = svg('<path d="M7.5 4.5 13 10l-5.5 5.5"/>');

// [한국어, 영어, 몽골어]
export const M = {
  kicker: ['물어보기', 'Ask', 'Асуух'],
  title: ['PATH에 물어보세요', 'Ask PATH', 'Асуултаа PATH дээр асуугаарай'],
  lead: ['대학이 공개한 요강과 PATH가 확인한 자료로 AI가 답해요. 답마다 근거를 달아요.', 'AI answers from the admissions guides universities published and the facts PATH checked. Every answer shows its sources.', 'Их сургуулиудын нийтэлсэн элсэлтийн журам болон PATH шалгасан мэдээлэлд үндэслэн хиймэл оюун хариулна. Хариулт бүрд эх сурвалжийг нь харуулна.'],
  // 「위험해요」
  danger: ['위험해요', 'I am in danger', 'Би аюулд байна'],
  dangerSub: ['누르면 긴급 번호가 바로 보여요. AI를 부르지 않아요.', 'Shows emergency numbers right away. It does not use AI.', 'Дарвал яаралтай дугаарууд шууд харагдана. Хиймэл оюун ашиглахгүй.'],
  urgentTitle: ['지금 위험하다면', 'If you are in danger now', 'Хэрэв та яг одоо аюулд байгаа бол'],
  inMN: ['몽골에 있다면', 'If you are in Mongolia', 'Монголд байгаа бол'],
  inKR: ['한국에 있다면', 'If you are in Korea', 'Солонгост байгаа бол'],
  h24: ['24시간', '24 hours', '24 цаг'],
  sosChecked: ['번호를 확인한 날', 'Numbers checked on', 'Дугаарыг шалгасан өдөр'],
  sosSources: ['번호를 확인한 곳', 'Where the numbers come from', 'Дугаарын эх сурвалж'],
  close: ['닫기', 'Close', 'Хаах'],
  connectNow: ['지금 사람에게 연결', 'Connect to a person now', 'Одоо хүнтэй холбогдох'],
  urgentAgree: ['급하다는 표시와 내 SYNK ID를 SYNK 담당자에게 보내는 데 동의해요. 아래에서 고르면 내가 마지막에 쓴 글도 함께 가요. 한국 서울에 있는 SYNK 회사 서버에 남아요. 담당자의 답은 「내 상담」에 와요.', 'I agree to send an urgent alert with my SYNK ID to a SYNK staff member. If I choose below, the last message I wrote goes too. It is kept on the SYNK company server in Seoul, Korea. The staff member’s answer appears in “My cases”.', 'Яаралтай гэсэн тэмдэг болон миний SYNK ID-г SYNK-ийн ажилтанд илгээхийг зөвшөөрч байна. Доор сонговол миний хамгийн сүүлд бичсэн зурвас ч хамт илгээгдэнэ. Энэ мэдээлэл Солонгосын Сөүл хотод байрлах SYNK компанийн серверт хадгалагдана. Ажилтны хариу «Миний зөвлөгөө» хэсэгт ирнэ.'],
  urgentLast: ['내가 마지막에 쓴 글도 함께 보내기', 'Also send the last message I wrote', 'Миний хамгийн сүүлд бичсэн зурвасыг хамт илгээх'],
  urgentSending: ['알리는 중이에요.', 'Sending the alert.', 'Мэдэгдэл илгээж байна.'],
  urgentSent: ['SYNK 담당자에게 알렸어요. 위험하면 위 번호로 먼저 연락하세요.', 'A SYNK staff member has been alerted. If you are in danger, call one of the numbers above first.', 'SYNK-ийн ажилтанд мэдэгдлээ. Аюулд байгаа бол дээрх дугаарын аль нэг рүү эхлээд залгаарай.'],
  urgentFail: ['알리지 못했어요. 위 번호로 연락하거나 hello@synk.im으로 메일을 보내 주세요.', 'The alert did not go through. Call one of the numbers above or email hello@synk.im.', 'Мэдэгдэл илгээж чадсангүй. Дээрх дугаар руу залгана уу, эсвэл hello@synk.im хаяг руу цахим шуудан илгээнэ үү.'],
  urgentMail: ['SYNK 담당자에게는 hello@synk.im으로 알릴 수 있어요.', 'You can tell a SYNK staff member at hello@synk.im.', 'SYNK-ийн ажилтанд hello@synk.im хаягаар мэдэгдэж болно.'],
  urgentAge: ['나이를 고르면 SYNK 담당자에게 바로 알릴 수 있어요.', 'Choose your age to alert a SYNK staff member right away.', 'Насаа сонговол SYNK-ийн ажилтанд шууд мэдэгдэж болно.'],
  urgentGuardian: ['보호자가 이 내용을 함께 읽고 동의했어요', 'A parent or guardian read this with me and agreed', 'Эцэг эх эсвэл асран хамгаалагч маань энэ мэдээллийг надтай хамт уншиж, зөвшөөрсөн'],
  // 나이
  ageLegend: ['나이를 골라 주세요', 'Choose your age', 'Насаа сонгоно уу'],
  ageWhy: ['나이에 따라 쓸 수 있는 기능이 달라요. 만 18세 이상만 AI와 대화해요.', 'What you can use depends on your age. Only people 18 or older chat with the AI.', 'Наснаас хамаарч ашиглах боломжтой үйлчилгээ өөр өөр байна. Зөвхөн 18 ба түүнээс дээш настай хүн хиймэл оюунтай ярилцах боломжтой.'],
  adult: ['만 18세 이상', '18 or older', '18 ба түүнээс дээш настай'],
  teen: ['만 14~17세', '14 to 17', '14–17 настай'],
  under14: ['만 14세 미만', 'Under 14', '14 нас хүрээгүй'],
  ageAgain: ['나이 다시 고르기', 'Choose age again', 'Насаа дахин сонгох'],
  under14Note: ['만 14세 미만은 AI 물어보기와 사람 연결을 쓸 수 없어요. 보호자가 hello@synk.im으로 물어봐 주세요.', 'If you are under 14, you cannot use AI questions or connect to a person. Please ask a parent or guardian to email hello@synk.im.', '14 нас хүрээгүй бол хиймэл оюунаас асуух болон хүнтэй холбогдох үйлчилгээг ашиглах боломжгүй. Эцэг эх, асран хамгаалагчаараа hello@synk.im хаягаар асуулгаарай.'],
  teenNote: ['만 14~17세는 AI와 대화하지 않아요. 공식 안내를 보거나, 보호자와 함께 SYNK 담당자에게 물어볼 수 있어요.', 'If you are 14 to 17, you do not chat with the AI. You can check official sources, or ask a SYNK staff member together with a parent or guardian.', '14–17 настай бол хиймэл оюунтай ярилцах боломжгүй. Албан ёсны мэдээллийг үзэж болно. Эсвэл эцэг эх, асран хамгаалагчтайгаа хамт SYNK-ийн ажилтнаас асууж болно.'],
  signIn: ['SYNK ID로 로그인하면 AI에게 물어볼 수 있어요. 「위험해요」는 로그인하지 않아도 쓸 수 있어요.', 'Sign in with your SYNK ID to ask the AI. “I am in danger” works without signing in.', 'SYNK ID-аар нэвтэрвэл хиймэл оюунаас асууж болно. «Би аюулд байна» товчийг нэвтрэхгүйгээр ашиглаж болно.'],
  signInBtn: ['SYNK ID로 로그인', 'Sign in with SYNK ID', 'SYNK ID-аар нэвтрэх'],
  // 공식 안내 입구
  officialTitle: ['공식 안내에서 확인하기', 'Check official sources', 'Албан ёсны мэдээллийг шалгах'],
  officialLead: ['PATH는 공식 기관에 물어볼 질문을 정리하도록 도와요.', 'PATH helps you write down a question for official sources.', 'PATH нь албан ёсны байгууллагаас асуух асуултаа бэлдэхэд тань тусална.'],
  officialBtn: ['물어볼 질문 정리하기', 'Draft a question', 'Асуултаа бэлдэх'],
  offNote: ['물어보기는 잠시 쉬어요. 공식 안내에서 직접 확인해 주세요.', 'Ask is paused for now. Please check official sources yourself.', 'Асуух үйлчилгээ түр зогссон байна. Албан ёсны мэдээллийг өөрөө шалгана уу.'],
  // 동의
  consentTitle: ['처음 한 번 확인해 주세요', 'Please read this once', 'Эхлээд нэг удаа шалгана уу'],
  beforeSend: ['보내기 전에 확인해 주세요', 'Before you send', 'Илгээхээсээ өмнө шалгана уу'],
  what: ['보내는 것', 'What is sent', 'Илгээх зүйл'],
  whatText: ['질문, 최근 대화, 그리고 켜 둔 경우 내 조건과 고른 과정이 가요. 위험한 일을 쓴 글도 같은 길로 가요.', 'Your question and recent conversation, plus your conditions and picked program if you turn that on. A message about something dangerous goes the same way.', 'Таны асуулт болон сүүлийн үеийн ярилцлага илгээгдэнэ. Нөхцөлөө хамт илгээхийг сонгосон бол таны оруулсан нөхцөл болон сонгосон хөтөлбөр ч илгээгдэнэ. Аюултай зүйлийн тухай бичсэн зурвас ч ижил замаар илгээгдэнэ.'],
  who: ['받는 곳', 'Who receives it', 'Хүлээн авах газар'],
  whoText: ['Anthropic(미국)의 Claude가 답을 만들어요. 글은 SYNK 서버(Supabase, 싱가포르)를 거쳐 가요. 정보가 몽골 밖으로 옮겨져요.', 'Claude by Anthropic (USA) writes the answer. The text passes through the SYNK server (Supabase, Singapore). Your information leaves Mongolia.', 'Хариултыг АНУ-ын Anthropic компанийн Claude бичнэ. Бичвэр нь SYNK-ийн серверээр (Supabase, Сингапур) дамжина. Таны мэдээлэл Монголоос гадагш дамжина.'],
  keep: ['저장', 'Storage', 'Хадгалалт'],
  keepText: ['SYNK는 질문과 답을 저장하지 않아요. Anthropic은 악용을 막으려고 정한 기간 동안 보관할 수 있고, AI 학습에는 쓰지 않아요. 대화는 이 탭에만 있고 탭을 닫으면 사라져요.', 'SYNK does not store your questions or the answers. Anthropic may keep them for the period it sets to prevent misuse, and does not use them to train AI. The conversation stays in this tab only and disappears when you close it.', 'SYNK нь асуулт, хариултыг хадгалахгүй. Anthropic нь зүй бусаар ашиглахаас сэргийлэх зорилгоор өөрийн тогтоосон хугацаанд хадгалж болох боловч хиймэл оюуныг сургахад ашиглахгүй. Ярилцлага зөвхөн энэ цонхонд байх бөгөөд цонхыг хаахад устгагдана.'],
  dont: ['쓰지 말 것', 'Do not write', 'Бичиж болохгүй зүйл'],
  dontText: ['여권번호, 등록번호, 비밀번호는 쓰지 마세요. 써도 보내기 전에 가려요.', 'Do not write passport numbers, registration numbers or passwords. If you do, they are hidden before sending.', 'Паспортын дугаар, регистрийн дугаар, нууц үгээ бүү бичээрэй. Бичсэн ч илгээхээс өмнө нуугдана.'],
  promise: ['약속하지 않는 것', 'What it does not promise', 'Амлахгүй зүйл'],
  promiseText: ['AI의 안내는 대학이나 KVAC의 확인이 아니에요. 입학과 비자 결과를 약속하지 않아요.', 'The AI’s guidance is not a confirmation from a university or KVAC. It does not promise admission or a visa.', 'Хиймэл оюуны өгсөн мэдээллийг их сургууль эсвэл KVAC баталгаажуулаагүй. Элсэлт болон визийн үр дүнг амлахгүй.'],
  contact: ['문의', 'Questions', 'Холбоо барих'],
  privacy: ['개인정보 처리방침', 'Privacy policy', 'Хувийн мэдээллийн бодлого'],
  agree: ['위 내용을 읽었고, 물어보기에 동의해요', 'I have read the above and agree to use Ask', 'Дээрх мэдээллийг уншиж, Асуух үйлчилгээг ашиглахыг зөвшөөрч байна'],
  start: ['동의하고 물어보기', 'Agree and start', 'Зөвшөөрөөд асуух'],
  // 대화
  langLabel: ['답 받을 말', 'Answer language', 'Хариултын хэл'],
  topic: ['주제', 'Topic', 'Сэдэв'],
  topicOff: ['주제 빼기', 'Remove topic', 'Сэдвийг хасах'],
  withProfile: ['내 조건도 함께 보내기', 'Also send my conditions', 'Миний нөхцөлийг хамт илгээх'],
  withProfileSub: ['켜 두면 넣어 둔 내 조건과 고른 과정이 함께 가요.', 'When on, the conditions you entered and your picked program are sent too.', 'Асаалттай үед таны оруулсан нөхцөл болон сонгосон хөтөлбөр хамт илгээгдэнэ.'],
  profileNone: ['아직 넣은 조건이 없어요.', 'You have not entered any conditions yet.', 'Та одоогоор нөхцөл оруулаагүй байна.'],
  profileSends: ['보내는 칸', 'Sent', 'Илгээх хэсэг'],
  qLabel: ['물어볼 것', 'Your question', 'Таны асуулт'],
  example: ['예: 「이 과정은 한국어 몇 급이 필요해요?」', 'For example: “What Korean level does this program need?”', 'Жишээ нь: «Энэ хөтөлбөрт хэдэн түвшний солонгос хэл шаардлагатай вэ?»'],
  send: ['물어보기', 'Ask', 'Асуух'],
  waiting: ['답을 만드는 중이에요. 30초쯤 걸려요. 이 화면을 열어 두세요.', 'Writing the answer. This takes about 30 seconds. Keep this screen open.', 'Хариулт бичиж байна. 30 секунд орчим болно. Энэ дэлгэцийг нээлттэй байлгана уу.'],
  quota: ['하루 20번까지 물어볼 수 있어요.', 'You can ask up to 20 times a day.', 'Өдөрт 20 удаа хүртэл асууж болно.'],
  clear: ['대화 지우기', 'Clear conversation', 'Ярилцлагыг устгах'],
  me: ['나', 'Me', 'Би'],
  ai: ['PATH AI', 'PATH AI', 'PATH AI'],
  band: ['AI의 안내예요. 대학이나 KVAC의 확인이 아니에요.', 'This is guidance from AI. It is not a confirmation from a university or KVAC.', 'Энэ бол хиймэл оюуны өгсөн мэдээлэл. Их сургууль эсвэл KVAC үүнийг баталгаажуулаагүй.'],
  sources: ['근거', 'Sources', 'Эх сурвалж'],
  checked: ['확인한 날', 'Checked', 'Шалгасан өдөр'],
  inPath: ['PATH에서 보기', 'See in PATH', 'PATH дээр харах'],
  official: ['공식 출처', 'Official source', 'Албан ёсны эх сурвалж'],
  askWhere: ['물을 곳', 'Where to ask', 'Хаана асуух вэ'],
  rechecking: ['이 자료는 다시 확인하고 있어요. 공식 출처에서 직접 확인해 주세요.', 'This information is being checked again. Please check the official source yourself.', 'Энэ мэдээллийг дахин шалгаж байна. Албан ёсны эх сурвалжийг өөрөө шалгана уу.'],
  // 사람 연결(답 아래)
  hAct: ['여기부터는 SYNK 담당자가 함께해요.', 'From here, a SYNK staff member works with you.', 'Эндээс цааш SYNK-ийн ажилтан тантай хамт ажиллана.'],
  hSynk: ['SYNK 담당자가 도와야 하는 일이에요.', 'This needs help from a SYNK staff member.', 'Үүнд SYNK-ийн ажилтны тусламж хэрэгтэй.'],
  hStuck: ['AI가 두 번 답하지 못했어요. 사람에게 물어볼 수 있어요.', 'The AI could not answer twice. You can ask a person.', 'Хиймэл оюун хоёр удаа хариулж чадсангүй. Хүнээс асууж болно.'],
  connect: ['사람에게 연결', 'Connect to a person', 'Хүнтэй холбогдох'],
  connectStuck: ['사람에게 물어볼래요', 'I want to ask a person', 'Би хүнээс асуумаар байна'],
  connectHow: ['누르면 AI가 지금까지의 상담을 요약해요. 보내기 전에 확인하고 고칠 수 있어요.', 'AI summarizes the conversation so far. You can check and edit it before sending.', 'Дарвал хиймэл оюун одоог хүртэлх ярилцлагыг хураангуйлна. Илгээхээсээ өмнө шалгаж, засаж болно.'],
  closedMail: ['지금은 사람 연결을 받지 않아요. hello@synk.im으로 물어봐 주세요.', 'Connecting to a person is not available right now. Please email hello@synk.im.', 'Одоогоор хүнтэй холбогдох боломжгүй байна. hello@synk.im хаягаар асуугаарай.'],
  // 넘김 요약
  bKicker: ['사람에게 연결', 'Connect to a person', 'Хүнтэй холбогдох'],
  bTitle: ['담당자에게 보낼 요약', 'Summary for the staff member', 'Ажилтанд илгээх хураангуй'],
  bLead: ['AI가 지금까지의 상담을 정리했어요. 맞지 않는 줄은 고치거나 빼 주세요. 담당자는 이 요약으로 일해요.', 'AI has summarized the conversation. Edit or remove any line that is wrong. The staff member works from this summary.', 'Хиймэл оюун одоог хүртэлх ярилцлагыг хураангуйлсан. Буруу мөрийг засна уу эсвэл хасна уу. Ажилтан энэ хураангуйд үндэслэн ажиллана.'],
  bBack: ['물어보기로', 'Back to Ask', 'Асуух хэсэг рүү буцах'],
  bLoading: ['요약을 만드는 중이에요. 30초쯤 걸려요. 이 화면을 열어 두세요.', 'Making the summary. This takes about 30 seconds. Keep this screen open.', 'Хураангуй гаргаж байна. 30 секунд орчим болно. Энэ дэлгэцийг нээлттэй байлгана уу.'],
  bKind: ['갈래', 'Type', 'Төрөл'],
  bDeadline: ['가장 가까운 기한', 'Nearest deadline', 'Хамгийн ойрын эцсийн хугацаа'],
  bNoDeadline: ['정해진 기한이 없어요.', 'No set deadline.', 'Тогтсон эцсийн хугацаа байхгүй.'],
  bFixed: ['이 칸은 고칠 수 없어요.', 'You cannot edit this part.', 'Энэ хэсгийг засах боломжгүй.'],
  situation: ['지금 상황', 'Your situation', 'Таны одоогийн байдал'],
  wants: ['바라는 것', 'What you want', 'Таны хүсэж буй зүйл'],
  aiDone: ['AI가 이미 안내한 것', 'What AI already explained', 'Хиймэл оюуны аль хэдийн тайлбарласан зүйл'],
  openQ: ['아직 풀리지 않은 것', 'Still unresolved', 'Шийдэгдээгүй байгаа зүйл'],
  tasks: ['담당자가 할 일', 'What the staff member will do', 'Ажилтны хийх ажил'],
  why: ['까닭', 'Why a person', 'Хүн хэрэгтэй шалтгаан'],
  by: ['기한', 'Due', 'Эцсийн хугацаа'],
  edited: ['내가 고침', 'Edited by me', 'Би зассан'],
  added: ['내가 더함', 'Added by me', 'Би нэмсэн'],
  remove: ['빼기', 'Remove', 'Хасах'],
  restore: ['되살리기', 'Restore', 'Сэргээх'],
  removed: ['뺀 줄이에요. 담당자에게는 「학생이 뺌」으로 가요.', 'Removed. The staff member sees it as “removed by the student”.', 'Энэ мөрийг хассан. Ажилтанд «Сурагч хассан» гэж харагдана.'],
  addLine: ['한 줄 더하기', 'Add a line', 'Мөр нэмэх'],
  withTitle: ['함께 보낼 것', 'Also send', 'Хамт илгээх зүйл'],
  withConv: ['전체 AI 대화', 'The whole AI conversation', 'Хиймэл оюунтай хийсэн бүх ярилцлага'],
  withConvSub: ['처음에는 꺼져 있어요. 요약만으로도 담당자가 일할 수 있어요.', 'Off at first. The staff member can work from the summary alone.', 'Эхэндээ унтраалттай. Ажилтанд хураангуй л байхад хангалттай.'],
  withMine: ['내 조건', 'My conditions', 'Миний нөхцөл'],
  withProgram: ['고른 과정', 'Picked program', 'Сонгосон хөтөлбөр'],
  note: ['담당자에게 한마디(쓰지 않아도 돼요)', 'A note to the staff member (optional)', 'Ажилтанд үлдээх үг (заавал биш)'],
  cWhatText: ['이 요약, 함께 보내기로 고른 것, SYNK ID가 가요. 담당자의 답은 「내 상담」에 와요.', 'This summary, what you chose to send and your SYNK ID. The staff member’s answer appears in “My cases”.', 'Энэ хураангуй, хамт илгээхээр сонгосон зүйл, SYNK ID илгээгдэнэ. Ажилтны хариу «Миний зөвлөгөө» хэсэгт ирнэ.'],
  cWhatTeen: ['쓴 글, 고른 갈래, 보호자가 동의했다는 표시, SYNK ID가 가요. 담당자의 답은 「내 상담」에 와요.', 'Your message, the type you chose, a note that your guardian agreed and your SYNK ID. The staff member’s answer appears in “My cases”.', 'Таны бичсэн зурвас, сонгосон төрөл, асран хамгаалагч зөвшөөрсөн гэсэн тэмдэг, SYNK ID илгээгдэнэ. Ажилтны хариу «Миний зөвлөгөө» хэсэгт ирнэ.'],
  cWho: ['보는 사람', 'Who sees it', 'Хэн харах вэ'],
  cWhoText: ['SYNK PATH 담당자와 SYNK 대표가 봐요.', 'The SYNK PATH staff member and the head of SYNK.', 'SYNK PATH үйлчилгээний ажилтан болон SYNK-ийн тэргүүн харна.'],
  cWhere: ['두는 곳', 'Where it is kept', 'Хаана хадгалах вэ'],
  cWhereText: ['한국 서울에 있는 SYNK 회사 서버에 둬요. 몽골 밖이에요. 매일 하는 백업에 최대 38일 남아요.', 'On the SYNK company server in Seoul, Korea, outside Mongolia. Daily backups keep it for up to 38 days.', 'Солонгосын Сөүл хотод байрлах SYNK компанийн серверт хадгална. Энэ сервер Монголоос гадна байрладаг. Өдөр бүрийн нөөц хуулбарт 38 хоног хүртэл үлдэнэ.'],
  cKeepText: ['끝난 상담은 90일 뒤에 지워요. 「내 상담」에서 언제든 바로 지울 수 있어요. 지운 뒤에는 갈래, 만든 날, 끝난 날, 할 일 수만 1년 남기고 내용은 남기지 않아요.', 'Finished cases are deleted after 90 days. You can delete one at any time in “My cases”. After deletion, only the type, dates and number of tasks are kept for a year, with no content.', 'Дууссан зөвлөгөөг 90 хоногийн дараа устгана. «Миний зөвлөгөө» хэсгээс хүссэн үедээ шууд устгаж болно. Устгасны дараа зөвхөн төрөл, нээсэн өдөр, дууссан өдөр, ажлын тоог 1 жил хадгалж, агуулгыг хадгалахгүй.'],
  cTr: ['번역', 'Translation', 'Орчуулга'],
  cTrText: ['내 글과 담당자의 답은 Claude가 한국어와 내 말 사이로 옮겨요.', 'Claude translates between Korean and your language for your messages and the staff member’s answers.', 'Таны бичсэн зүйл болон ажилтны хариултыг Claude солонгос хэл болон таны хэлний хооронд орчуулна.'],
  cPromiseText: ['SYNK 담당자는 대학이나 KVAC를 대신하지 않아요. 입학과 비자 결과를 약속하지 않아요.', 'SYNK staff do not act for a university or KVAC. They do not promise admission or a visa.', 'SYNK-ийн ажилтан их сургууль эсвэл KVAC байгууллагыг төлөөлөхгүй. Элсэлт болон визийн үр дүнг амлахгүй.'],
  cAgree: ['위 내용을 읽었고, 이 내용을 SYNK 담당자에게 보내는 데 동의해요', 'I have read the above and agree to send this to a SYNK staff member', 'Дээрх мэдээллийг уншиж, үүнийг SYNK-ийн ажилтанд илгээхийг зөвшөөрч байна'],
  cSend: ['담당자에게 보내기', 'Send to the staff member', 'Ажилтанд илгээх'],
  cSending: ['보내는 중이에요.', 'Sending.', 'Илгээж байна.'],
  cSent: ['보냈어요. 담당자가 답하면 오늘 화면의 「내 상담」에 와요.', 'Sent. When the staff member answers, it appears in “My cases” on Today.', 'Илгээлээ. Ажилтны хариулт «Өнөөдөр» дэлгэцийн «Миний зөвлөгөө» хэсэгт ирнэ.'],
  refetch: ['요약 다시 받기', 'Get the summary again', 'Хураангуйг дахин авах'],
  toToday: ['오늘 화면으로', 'Go to Today', '«Өнөөдөр» дэлгэц рүү очих'],
  // 14~17세 연결 양식
  tTitle: ['SYNK 담당자에게 물어보기', 'Ask a SYNK staff member', 'SYNK-ийн ажилтнаас асуух'],
  tKind: ['무엇을 도와 드릴까요', 'What do you need help with', 'Танд юугаар туслах вэ'],
  tAct: ['대학 지원을 함께 준비하고 싶어요', 'I want help preparing my application', 'Их сургуульд өргөдөл өгөх бэлтгэлээ хамтдаа хиймээр байна'],
  tSynk: ['내 자료, 계정, SYNK에 관한 일이에요', 'It is about my data, account or SYNK', 'Миний мэдээлэл, хэрэглэгчийн бүртгэл эсвэл SYNK-тэй холбоотой асуудал'],
  tNote: ['담당자에게 쓸 말', 'Your message', 'Ажилтанд бичих зурвас'],
  // 상태별 안내
  blocked: ['지금은 답하지 못했어요. 다시 물어봐 주세요.', 'No answer this time. Please ask again.', 'Одоогоор хариулж чадсангүй. Дахин асуугаарай.'],
  failed: ['지금은 답하지 못했어요. 다시 물어봐 주세요.', 'No answer this time. Please ask again.', 'Одоогоор хариулж чадсангүй. Дахин асуугаарай.'],
  refused: ['이 질문에는 AI가 답하지 않아요. 물어볼 곳은 「도움」 탭에서 정리할 수 있어요.', 'The AI does not answer this question. You can draft a question for official sources in the Help tab.', 'Энэ асуултад хиймэл оюун хариулахгүй. «Тусламж» хэсэгт албан ёсны байгууллагад тавих асуултаа бэлдэж болно.'],
  limit: ['오늘 물어볼 수 있는 만큼 다 물었어요. 내일 다시 물어봐 주세요.', 'You have asked as much as you can today. Please ask again tomorrow.', 'Өнөөдрийн асуух эрхээ бүгдийг ашигласан байна. Маргааш дахин асуугаарай.'],
  paused: ['오늘은 물어보기가 모두 쉬어요. 한국 시각 오전 9시(몽골 시각 오전 8시)에 다시 열려요. 급하면 위의 「위험해요」를 눌러 주세요.', 'Ask is paused for everyone today. It opens again at 9:00 Korea time (8:00 Mongolia time). If it is urgent, tap “I am in danger” above.', 'Өнөөдөр «Асуух» үйлчилгээ бүх хүнд түр зогссон. Солонгосын цагаар өглөөний 9 цагт (Монголын цагаар 8 цагт) дахин нээгдэнэ. Яаралтай бол дээрх «Би аюулд байна» товчийг дарна уу.'],
  busy: ['지금 처리 중인 질문이 많아요. 잠시 뒤에 다시 물어봐 주세요.', 'Many questions are being answered right now. Please ask again in a moment.', 'Яг одоо олон асуултад хариулж байна. Хэсэг хүлээгээд дахин асуугаарай.'],
  unavailable: ['물어보기는 잠시 쉬어요. 공식 안내에서 직접 확인해 주세요.', 'Ask is paused for now. Please check official sources yourself.', 'Асуух үйлчилгээ түр зогссон байна. Албан ёсны мэдээллийг өөрөө шалгана уу.'],
  done_before: ['이 질문은 이미 답했어요. 답은 저장하지 않아 다시 보여 드리지 못해요. 다시 물으면 오늘 한 번을 더 써요.', 'This question was already answered. Answers are not stored, so it cannot be shown again. Asking again uses one more of today’s questions.', 'Энэ асуултад аль хэдийн хариулсан. Хариулт хадгалагддаггүй тул дахин харуулах боломжгүй. Дахин асуувал өнөөдрийн эрхээс нэгийг ашиглана.'],
  lost: ['답을 받지 못했어요. 오늘 한 번이 쓰였을 수 있어요. 다시 물어봐 주세요.', 'The answer did not arrive. One of today’s questions may have been used. Please ask again.', 'Хариулт ирсэнгүй. Өнөөдрийн нэг эрх ашиглагдсан байж магадгүй. Дахин асуугаарай.'],
  signin: ['SYNK ID로 다시 로그인해 주세요.', 'Please sign in with your SYNK ID again.', 'SYNK ID-аараа дахин нэвтэрнэ үү.'],
  account: ['계정이 바뀌어 이 탭의 대화를 지웠어요.', 'Your account changed, so the conversation in this tab was cleared.', 'Хэрэглэгчийн бүртгэл солигдсон тул энэ цонхны ярилцлагыг устгалаа.'],
  empty: ['물어볼 글을 써 주세요.', 'Please write your question.', 'Асуултаа бичнэ үү.'],
  long: ['1,000자까지 물어볼 수 있어요. 나눠서 물어봐 주세요.', 'Questions can be up to 1,000 characters. Please split it.', 'Нэг асуултад 1,000 тэмдэгт хүртэл бичиж болно. Хувааж асуугаарай.'],
  cleared: ['대화를 지웠어요.', 'Conversation cleared.', 'Ярилцлагыг устгалаа.'],
  expired: ['요약을 받은 지 10분이 지났어요. 요약을 다시 받아 주세요. 고친 줄은 지워져요.', 'It has been 10 minutes since the summary was made. Please get it again. Your edits will be cleared.', 'Хураангуй гарснаас хойш 10 минут өнгөрсөн. Хураангуйг дахин авна уу. Таны зассан мөр арилна.'],
  tooMany: ['고친 줄은 10개까지 보낼 수 있어요.', 'You can send up to 10 edited lines.', 'Зассан мөрийг 10 хүртэл илгээж болно.'],
  tooLong: ['한 줄은 300자까지 쓸 수 있어요.', 'Each line can be up to 300 characters.', 'Нэг мөрөнд 300 тэмдэгт хүртэл бичиж болно.'],
  editFail: ['고친 줄을 한국어로 옮기지 못했어요. 다시 보내 주세요.', 'Your edited lines could not be translated into Korean. Please send again.', 'Таны зассан мөрийг солонгос хэл рүү орчуулж чадсангүй. Дахин илгээнэ үү.'],
  caseFail: ['보내지 못했어요. 다시 보내거나 hello@synk.im으로 알려 주세요.', 'It could not be sent. Try again or email hello@synk.im.', 'Илгээж чадсангүй. Дахин илгээнэ үү, эсвэл hello@synk.im хаягаар бидэнд мэдэгдэнэ үү.'],
  caseOpen: ['이미 열린 상담이 있어요. 오늘 화면의 「내 상담」에서 글을 더해 주세요.', 'You already have an open case. Please add a message in “My cases” on Today.', 'Танд аль хэдийн нээлттэй зөвлөгөө байна. «Өнөөдөр» дэлгэцийн «Миний зөвлөгөө» хэсэгт зурвас нэмнэ үү.'],
  caseLimit: ['이번 주에 보낼 수 있는 만큼 보냈어요. hello@synk.im으로 알려 주세요.', 'You have sent as many as you can this week. Please email hello@synk.im.', 'Энэ долоо хоногт илгээх боломжтой хязгаартаа хүрсэн байна. hello@synk.im хаягаар бидэнд мэдэгдэнэ үү.'],
  closed: ['지금은 사람 연결을 받지 않아요. hello@synk.im으로 물어봐 주세요.', 'Connecting to a person is not available right now. Please email hello@synk.im.', 'Одоогоор хүнтэй холбогдох боломжгүй байна. hello@synk.im хаягаар асуугаарай.'],
  // 내 상담
  cases: ['내 상담', 'My cases', 'Миний зөвлөгөө'],
  st_new: ['답을 기다려요', 'Waiting for an answer', 'Хариу хүлээж байна'],
  st_reviewing: ['보는 중', 'In review', 'Хянаж байна'],
  st_answered: ['답 왔음', 'Answered', 'Хариу ирсэн'],
  st_closed: ['끝남', 'Closed', 'Дууссан'],
  k_urgent: ['급함', 'Urgent', 'Яаралтай'],
  k_act: ['함께할 일', 'Work together', 'Хамтдаа хийх ажил'],
  k_synk: ['SYNK 일', 'SYNK matter', 'SYNK-тэй холбоотой асуудал'],
  k_stuck: ['AI가 답하지 못한 일', 'AI could not answer', 'Хиймэл оюун хариулж чадаагүй асуулт'],
  staff: ['SYNK 담당자', 'SYNK staff', 'SYNK-ийн ажилтан'],
  unread: ['새 답이 있어요', 'New answer', 'Шинэ хариу байна'],
  readBtn: ['읽었어요', 'Mark as read', 'Уншсан'],
  more: ['글 더하기', 'Add a message', 'Зурвас нэмэх'],
  moreSend: ['보내기', 'Send', 'Илгээх'],
  moreFail: ['글을 보내지 못했어요. 다시 보내 주세요.', 'The message was not sent. Please try again.', 'Зурвас илгээгдсэнгүй. Дахин илгээнэ үү.'],
  del: ['이 상담 지우기', 'Delete this case', 'Энэ зөвлөгөөг устгах'],
  delNote: ['지우면 담당자에게 보낸 내용과 답이 바로 지워져요. 내 길에 보이던 상담 표시도 사라져요. 되돌릴 수 없어요.', 'Deleting removes what you sent and the answers right away. The case marker on My path disappears too. This cannot be undone.', 'Устгавал ажилтанд илгээсэн зүйл болон хариулт шууд устгагдана. Миний зам дээрх зөвлөгөөний тэмдэглэгээ ч арилна. Буцаах боломжгүй.'],
  deleteSoon: ['끝난 지 오래된 상담이라 곧 저절로 지워져요. 남겨 둘 내용이 있으면 지금 옮겨 적어 두세요.', 'This finished case will be deleted automatically soon. Copy anything you want to keep now.', 'Энэ дууссан зөвлөгөө удахгүй автоматаар устгагдана. Хадгалах зүйл байвал одоо хуулж аваарай.'],
  deleted: ['상담을 지웠어요.', 'Case deleted.', 'Зөвлөгөөг устгалаа.'],
  delFail: ['지우지 못했어요. 다시 눌러 주세요.', 'Could not delete. Please try again.', 'Устгаж чадсангүй. Дахин дарна уу.'],
  loadFail: ['지금 불러오지 못했어요.', 'Could not load right now.', 'Одоогоор ачаалж чадсангүй.'],
  reload: ['다시 불러오기', 'Load again', 'Дахин ачаалах'],
  loading: ['불러오는 중이에요.', 'Loading.', 'Ачаалж байна.'],
  marker: ['SYNK 담당자와 상담하고 있어요.', 'You have an open case with a SYNK staff member.', 'Та SYNK-ийн ажилтантай зөвлөлдөж байна.'],
  markerBtn: ['내 상담 보기', 'See my cases', 'Миний зөвлөгөөг харах'],
};

const KIND_TEXT = { act: 'hAct', synk: 'hSynk', stuck: 'hStuck' };
const PROFILE_LABEL = { topik: ['TOPIK', 'TOPIK'], gradePct: ['고교 성적', 'School grades'], fundsWon: ['준비한 돈', 'Funds'], education: ['학력', 'Education'], target: ['고른 과정', 'Picked program'], docs: ['서류 표시', 'Document marks'] };

/** 화면 글 도구. lang은 화면 말(ko · en), mn은 몽골어 줄을 보일지. */
function tools(view) {
  const en = view.lang === 'en', mn = view.mn ?? ASK_MN_REVIEWED;
  const P = (a) => (en ? a[1] : a[0]);
  const mnLine = (a) => (mn && a[2] ? `<span class="sx-mn" lang="mn">${esc(a[2])}</span>` : '');
  const both = (a, tag = 'p', cls = '', attrs = '') => `<${tag}${cls ? ` class="${cls}"` : ''}${attrs}><span>${esc(P(a))}</span>${mnLine(a)}</${tag}>`;
  const L = (ko, e) => (en ? e : ko);
  const pickT = (o) => (o ? (en ? o.en : o.ko) ?? o.ko : '');
  return { en, mn, P, mnLine, both, L, pickT };
}
const ext = (url, label, L) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}<span class="sr-only"> (${L('새 탭에서 열림', 'opens in new tab')})</span></a>`;
const mail = `<a href="mailto:${HELP_MAIL}">${HELP_MAIL}</a>`;
const lines = (s) => esc(s).replace(/\n/g, '<br>');
/** 고정 카드의 말: 몽골어는 검수 전이면 영어로(emergency.mjs의 규칙). */
export const cardLang = (askLang) => (askLang === 'mn' ? (MN_REVIEWED ? 'mn' : 'en') : askLang === 'en' ? 'en' : 'ko');

/* ── 「위험해요」 입구와 고정 카드 ── */
const cardTools = (view) => { const cl = cardLang(view.askLang || view.lang); return { cl, T: tools({ ...view, lang: cl === 'ko' ? 'ko' : 'en', mn: cl === 'mn' }) }; };
function urgentEntry(view) {
  const { T } = cardTools(view);
  const open = view.urgent?.open === true;
  return `<button type="button" class="sx-sos-entry" data-action="askUrgent" aria-expanded="${open}" aria-controls="ask-urgent"><span class="sx-sos-ic">${PHONE}</span><span><b>${esc(T.P(M.danger))}</b>${T.mnLine(M.danger)}<small>${esc(T.P(M.dangerSub))}</small></span></button>`;
}
/** 고정 카드. 모델을 부르지 않는다. 번호 · 문안은 emergency.mjs 그대로. */
export function renderUrgentCard(view) {
  const { T, cl } = cardTools(view), u = view.urgent || {};
  const label = (c) => c.label[cl] || c.label.en, what = (c) => c.what[cl] || c.what.en;
  const hours = (c) => (c.hours === '24h' ? (cl === 'ko' ? '24시간' : '24 hours') : '');
  const group = (country, title) => {
    const list = CONTACTS.filter((c) => c.country === country);
    return `<h3 class="sx-sos-h">${esc(cl === 'ko' ? title[0] : title[1])}</h3><ul class="sx-sos-list">${list.map((c) => `<li><a class="sx-sos" href="tel:${esc(c.number)}"><b>${esc(c.number)}</b><span><span class="sx-sos-name">${esc(label(c))}</span><small>${esc(what(c))}${hours(c) ? ` · ${esc(hours(c))}` : ''}</small></span></a></li>`).join('')}</ul>`;
  };
  const sources = [...new Set(CONTACTS.map((c) => c.source))];
  const srcFold = `<details class="sx-past" data-fold="sos-src"><summary>${esc(cl === 'ko' ? M.sosSources[0] : M.sosSources[1])}</summary><ul class="sx-sos-src">${sources.map((s) => `<li>${ext(s, new URL(s).hostname, T.L)}</li>`).join('')}</ul></details>`;
  return `<section class="sx-sos-card" id="ask-urgent" aria-labelledby="ask-urgent-h">
<div class="sx-h-row"><h2 class="sx-sos-title" id="ask-urgent-h" tabindex="-1" lang="${cl}">${esc(cl === 'ko' ? M.urgentTitle[0] : M.urgentTitle[1])}</h2><button type="button" class="sx-btn2 line" data-action="askUrgent">${esc(T.P(M.close))}</button></div>
<p class="sx-sos-text" lang="${cl}">${esc(urgentText(view.askLang || view.lang))}</p>
${group('MN', M.inMN)}${group('KR', M.inKR)}
<p class="sx-src">${esc(cl === 'ko' ? M.sosChecked[0] : M.sosChecked[1])} ${esc(EMERGENCY_CHECKED)}</p>${srcFold}
${urgentConnect(view, T, u)}</section>`;
}
function urgentConnect(view, T, u) {
  const mailLine = `<p class="sx-note is-box"><span>${esc(T.P(M.urgentMail)).replace(HELP_MAIL, mail)}</span>${T.mnLine(M.urgentMail)}</p>`;
  if (u.phase === 'sent') return T.both(M.urgentSent, 'p', 'sx-store', ' role="status" id="urgent-sent" tabindex="-1"');
  const age = view.ask?.age ?? null;
  if (!view.signedIn || age === 'under14' || view.open !== true) return mailLine;
  if (age === null) return `${T.both(M.urgentAge, 'p', 'sx-fine')}${ageChoices(view, T, 'urgent-age')}${mailLine}`;
  const busy = u.phase === 'sending', dis = busy ? ' disabled' : '';
  const check = (id, action, on, a) => `<label class="sx-check"><input type="checkbox" id="${id}" data-action="${action}"${on ? ' checked' : ''}${dis}><span><span>${esc(T.P(a))}</span>${T.mnLine(a)}</span></label>`;
  const ready = u.agree === true && (age !== 'teen' || u.guardian === true) && !busy;
  return `<div class="sx-sos-connect">${check('urgent-agree', 'urgentAgree', u.agree, M.urgentAgree)}${age === 'teen' ? check('urgent-guardian', 'urgentGuardian', u.guardian, M.urgentGuardian) : ''}${view.lastStudent ? check('urgent-last', 'urgentLast', u.last, M.urgentLast) : ''}
<button type="button" class="sx-cta coral" data-action="urgentSend"${ready ? '' : ' disabled'}>${esc(T.P(M.connectNow))}</button>
${busy ? T.both(M.urgentSending, 'p', 'sx-fine', ' role="status"') : u.phase === 'failed' ? `<p class="sx-err" role="alert"><span>${esc(T.P(M.urgentFail)).replace(HELP_MAIL, mail)}</span>${T.mnLine(M.urgentFail)}</p>` : ''}</div>`;
}

function ageChoices(view, T, idp) {
  const age = view.ask?.age ?? null;
  return `<fieldset class="sx-tr-age"><legend>${esc(T.P(M.ageLegend))}${T.mnLine(M.ageLegend)}</legend>${['adult', 'teen', 'under14'].map((a) => `<label class="sx-choice"><input type="radio" id="${idp}-${a}" name="${idp}" value="${a}" data-action="askAge"${age === a ? ' checked' : ''}><span>${esc(T.P(M[a]))}${T.mnLine(M[a])}</span></label>`).join('')}</fieldset>`;
}

/* ── 공식 안내 입구(스위치 꺼짐 · 로그인 전 · 14~17세 · 14세 미만) ── */
function officialEntry(view, T) {
  return `<section class="sx-card line" aria-labelledby="ask-official-h"><h2 id="ask-official-h">${esc(T.P(M.officialTitle))}${T.mnLine(M.officialTitle)}</h2>${T.both(M.officialLead)}
<button type="button" class="sx-btn2" data-action="nav" data-page="help">${esc(T.P(M.officialBtn))}${GO}</button></section>${view.officialHtml || ''}`;
}

/* ── 동의 ── */
function consentItems(T, items) {
  return `<dl class="sx-tr-items">${items.map(([k, t]) => `<div class="sx-tr-item"><dt>${esc(T.P(k))}</dt><dd><span>${esc(T.P(t))}</span>${T.mnLine(t)}</dd></div>`).join('')}</dl>`;
}
const contactItem = (T, url) => `<div class="sx-tr-item"><dt>${esc(T.P(M.contact))}</dt><dd>SYNK · ${mail} · ${ext(T.en ? PRIVACY_URL_EN : url, T.P(M.privacy), T.L)}</dd></div>`;
function askConsent(view, T) {
  const ask = view.ask;
  return `<section class="sx-card line sx-tr-consent" aria-labelledby="ask-consent-h"><h2 class="sx-h" id="ask-consent-h">${esc(T.P(M.consentTitle))}${T.mnLine(M.consentTitle)}</h2>
${consentItems(T, [[M.what, M.whatText], [M.who, M.whoText], [M.keep, M.keepText], [M.dont, M.dontText], [M.promise, M.promiseText]]).replace('</dl>', contactItem(T, ASK_PRIVACY_URL) + '</dl>')}
<label class="sx-check"><input type="checkbox" id="ask-agree" data-action="askAgree"${ask.agree ? ' checked' : ''}><span><span>${esc(T.P(M.agree))}</span>${T.mnLine(M.agree)}</span></label>
<button type="button" class="sx-cta" data-action="askStart"${ask.agree ? '' : ' disabled'}>${esc(T.P(M.start))}</button></section>`;
}
function caseConsent(T, idp, on) {
  return `<section class="sx-tr-consent" aria-labelledby="${idp}-consent-h"><h3 class="sx-h" id="${idp}-consent-h">${esc(T.P(M.beforeSend))}${T.mnLine(M.beforeSend)}</h3>
${consentItems(T, [[M.what, idp === 'teen' ? M.cWhatTeen : M.cWhatText], [M.cWho, M.cWhoText], [M.cWhere, M.cWhereText], [M.keep, M.cKeepText], [M.cTr, M.cTrText], [M.promise, M.cPromiseText]]).replace('</dl>', contactItem(T, CASE_PRIVACY_URL) + '</dl>')}
<label class="sx-check"><input type="checkbox" id="${idp}-agree" data-action="${idp === 'teen' ? 'teenAgree' : 'briefAgree'}"${on ? ' checked' : ''}><span><span>${esc(T.P(M.cAgree))}</span>${T.mnLine(M.cAgree)}</span></label></section>`;
}

/* ── 젤리 알약: 회색 홈 안에서 흰 알약 하나가 옮겨 간다. data-at은 지금 자리, data-from은 앞 자리(앱이 다음 그림에서 옮긴다). ── */
function jelly(label, action, options, current, from = null) {
  const at = Math.max(0, options.findIndex(([v]) => v === current));
  const prev = from === null ? at : Math.max(0, options.findIndex(([v]) => v === from));
  return `<div class="sx-jelly" role="group" aria-label="${esc(label)}" data-n="${options.length}" data-at="${prev}" data-to="${at}"><span class="sx-jelly-pill" aria-hidden="true"></span>${options.map(([v, l, langAttr]) => `<button type="button" data-action="${action}" data-id="${esc(v)}" aria-pressed="${v === current}"${langAttr ? ` lang="${langAttr}"` : ''}>${esc(l)}</button>`).join('')}</div>`;
}

/* ── 대화 ── */
function sourceRows(view, T, cites) {
  const items = cites.map((id) => view.sources?.get(id)).filter(Boolean);
  if (!items.length) return '';
  return `<div class="sx-ask-src"><p class="sx-ask-src-h">${esc(T.P(M.sources))}</p><ul>${items.map((it) => {
    const screen = screenTarget(it.screen) && view.canOpen?.(it.screen) ? `<button type="button" class="sx-link" data-action="askScreen" data-id="${esc(it.id)}">${esc(T.P(M.inPath))}${GO}</button>` : '';
    const off = it.source ? ext(it.source, T.P(M.official), T.L) : '';
    return `<li><b>${esc(T.pickT(it.title))}</b><span class="sx-ask-src-a">${screen}${off}${it.checked ? `<span class="sx-ask-src-d">${esc(T.P(M.checked))} ${esc(it.checked)}</span>` : ''}</span></li>`;
  }).join('')}</ul></div>`;
}
function handoffBox(view, T, e, i) {
  if (!['act', 'synk', 'stuck'].includes(e.kind)) return '';
  const say = M[KIND_TEXT[e.kind]];
  if (view.open !== true) return `<div class="sx-ask-hand">${T.both(say, 'p', 'sx-ask-hand-t')}<p class="sx-fine"><span>${esc(T.P(M.closedMail)).replace(HELP_MAIL, mail)}</span>${T.mnLine(M.closedMail)}</p></div>`;
  return `<div class="sx-ask-hand">${T.both(say, 'p', 'sx-ask-hand-t')}<button type="button" class="sx-cta" data-action="askHandoff" data-id="${i}">${esc(T.P(e.kind === 'stuck' ? M.connectStuck : M.connect))}</button>${T.both(M.connectHow, 'p', 'sx-fine')}</div>`;
}
function aiEntry(view, T, e, i) {
  const t = e.turn, where = t.ask_where ? view.sources?.get(t.ask_where) : null;
  const refer = where?.ask ? `<p class="sx-ask-where"><b>${esc(T.P(M.askWhere))}</b> ${esc(T.pickT(where.ask))}</p>` : '';
  return `<li class="sx-ask-ai"><p class="sx-ask-who">${esc(T.P(M.ai))}</p><div class="sx-ask-text">${lines(t.text)}</div>${t.rechecking ? T.both(M.rechecking, 'p', 'sx-note is-box') : ''}${refer}${sourceRows(view, T, e.cites || [])}
<p class="sx-ask-band" role="note"><span>${esc(T.P(M.band))}</span>${T.mnLine(M.band)}</p>${handoffBox(view, T, e, i)}</li>`;
}
function chat(view, T) {
  const ask = view.ask, busy = ask.phase === 'sending';
  const langs = [['ko', '한국어', 'ko'], ['en', 'English', 'en'], ['mn', 'Монгол', 'mn']];
  const topic = view.topicName ? `<p class="sx-ask-topic"><span><b>${esc(T.P(M.topic))}</b> ${esc(T.pickT(view.topicName))}</span><button type="button" class="sx-link" data-action="askTopicOff">${esc(T.P(M.topicOff))}</button></p>` : '';
  const sends = view.profileFields?.length ? `<small>${esc(T.P(M.profileSends))}: ${esc(view.profileFields.map((k) => (T.en ? PROFILE_LABEL[k][1] : PROFILE_LABEL[k][0])).join(', '))}</small>` : `<small>${esc(T.P(M.profileNone))}</small>`;
  const profile = `<label class="sx-check sx-ask-switch"><input type="checkbox" role="switch" id="ask-profile" data-action="askProfile"${ask.withProfile ? ' checked' : ''}${busy ? ' disabled' : ''}><span><span>${esc(T.P(M.withProfile))}</span>${T.mnLine(M.withProfile)}<small>${esc(T.P(M.withProfileSub))}</small>${ask.withProfile ? sends : ''}</span></label>`;
  const log = ask.turns.length ? `<ol class="sx-ask-log" aria-label="${esc(T.L('대화', 'Conversation'))}">${ask.turns.map((e, i) => (e.role === 'student'
    ? `<li class="sx-ask-me"><p class="sx-ask-who">${esc(T.P(M.me))}</p><div class="sx-ask-text">${lines(e.text).replaceAll(MASK_TOKEN, esc(T.L('[가린 번호]', '[hidden number]')))}</div></li>` : aiEntry(view, T, e, i))).join('')}</ol>` : T.both(M.example, 'p', 'sx-fine');
  const notice = ask.notice && ask.notice !== 'account' && M[ask.notice] ? `<p class="${['cleared'].includes(ask.notice) ? 'sx-store' : 'sx-store is-warn'}" id="ask-notice" role="status" tabindex="-1"><span>${esc(T.P(M[ask.notice]))}</span>${T.mnLine(M[ask.notice])}</p>` : '';
  const err = ask.error && M[ask.error] ? `<p class="sx-err" id="ask-err" role="alert"><span>${esc(T.P(M[ask.error]))}</span>${T.mnLine(M[ask.error])}</p>` : '';
  const left = Number.isInteger(ask.remaining) ? T.both([`오늘 ${ask.remaining}번 더 물어볼 수 있어요.`, `${ask.remaining} left today.`, `Өнөөдөр дахиад ${ask.remaining} удаа асууж болно.`], 'p', 'sx-fine') : T.both(M.quota, 'p', 'sx-fine');
  const count = `${[...String(ask.text || '')].length.toLocaleString('en-US')} / ${MAX_QUESTION_CHARS.toLocaleString('en-US')}${T.en ? '' : '자'}`;
  return `<div class="sx-ask-tools">${jelly(T.P(M.langLabel), 'askLang', langs, ask.lang, view.langFrom ?? null)}${topic}${profile}</div>
${log}${notice}
<div class="sx-field sx-ask-compose"><label for="ask-text">${esc(T.P(M.qLabel))}</label><textarea id="ask-text" class="sx-tr-text sx-ask-input" rows="3" maxlength="${MAX_QUESTION_CHARS + 200}" data-action="askText"${err ? ' aria-invalid="true" aria-describedby="ask-err ask-count"' : ' aria-describedby="ask-count"'}${busy ? ' readonly' : ''}>${esc(ask.text || '')}</textarea><p class="sx-fine" id="ask-count">${esc(count)}</p>${err}</div>
<div class="sx-row2 sx-ask-acts"><button type="button" class="sx-cta" data-action="askSend"${busy || !String(ask.text || '').trim() ? ' disabled' : ''}>${esc(T.P(M.send))}</button>${ask.turns.length ? `<button type="button" class="sx-btn2 line" data-action="askClear"${busy ? ' disabled' : ''}>${esc(T.P(M.clear))}</button>` : ''}</div>
${busy ? T.both(M.waiting, 'p', 'sx-note is-box', ' id="ask-wait" role="status" tabindex="-1"') : ''}${left}`;
}

/* ── 14~17세 연결 양식 ── */
function teenForm(view, T) {
  const t = view.teen || {};
  if (view.open !== true) return `<section class="sx-card" aria-labelledby="teen-h"><h2 id="teen-h">${esc(T.P(M.tTitle))}</h2><p><span>${esc(T.P(M.closedMail)).replace(HELP_MAIL, mail)}</span>${T.mnLine(M.closedMail)}</p></section>`;
  if (t.phase === 'sent') return `<section class="sx-card meadow" aria-labelledby="teen-h"><h2 id="teen-h" tabindex="-1">${esc(T.P(M.tTitle))}</h2>${T.both(M.cSent, 'p', '', ' role="status"')}</section>`;
  const busy = t.phase === 'sending', dis = busy ? ' disabled' : '';
  const err = t.error && M[t.error] ? `<p class="sx-err" role="alert"><span>${esc(T.P(M[t.error])).replace(HELP_MAIL, mail)}</span>${T.mnLine(M[t.error])}</p>` : '';
  return `<section class="sx-card line" aria-labelledby="teen-h"><h2 id="teen-h">${esc(T.P(M.tTitle))}${T.mnLine(M.tTitle)}</h2>
<div class="sx-field"><p class="sx-label">${esc(T.P(M.tKind))}</p>${jelly(T.P(M.tKind), 'teenKind', [['act', T.P(M.tAct)], ['synk', T.P(M.tSynk)]], t.kind || null, view.teenFrom ?? null).replace('class="sx-jelly"', `class="sx-jelly is-tall${t.kind ? '' : ' is-empty'}"`)}${T.mn ? `<p class="sx-fine"><span class="sx-mn" lang="mn">${esc(M.tAct[2])} · ${esc(M.tSynk[2])}</span></p>` : ''}</div>
<div class="sx-field"><label for="teen-note">${esc(T.P(M.tNote))}</label><textarea id="teen-note" class="sx-tr-text sx-ask-input" rows="4" maxlength="${MAX_NOTE_CHARS}" data-action="teenNote"${busy ? ' readonly' : ''}>${esc(t.note || '')}</textarea></div>
<label class="sx-check"><input type="checkbox" id="teen-guardian" data-action="teenGuardian"${t.guardian ? ' checked' : ''}${dis}><span><span>${esc(T.P(M.urgentGuardian))}</span>${T.mnLine(M.urgentGuardian)}</span></label>
${caseConsent(T, 'teen', t.agree)}
<button type="button" class="sx-cta" data-action="teenSend"${teenReady(t) ? '' : ' disabled'}>${esc(T.P(M.cSend))}</button>${busy ? T.both(M.cSending, 'p', 'sx-fine', ' role="status"') : err}</section>`;
}

/**
 * 「물어보기」 쪽.
 * view: { lang, mn?, signedIn, off, open(Workspace 연결 열림 true|false|null), ask: S.ask, urgent, teen, askLang, lastStudent,
 *   topicName, profileFields, sources(Map), canOpen(screen), officialHtml, langFrom, teenFrom }
 */
export function renderAsk(view) {
  const T = tools(view), ask = view.ask || {};
  const head = `<header class="sx-head"><p class="sx-kicker">${esc(T.P(M.kicker))}</p><h1 class="sx-title page-title" id="ask-title" tabindex="-1">${esc(T.P(M.title))}</h1>${T.both(M.lead, 'p', 'sx-lead')}</header>`;
  const acct = ask.notice === 'account' ? T.both(M.account, 'p', 'sx-store is-warn', ' role="status"') : '';
  const top = `${urgentEntry(view)}${view.urgent?.open ? renderUrgentCard(view) : ''}${acct}`;
  let body;
  if (view.off) body = `${T.both(M.offNote, 'p', 'sx-store is-warn', ' role="status"')}${officialEntry(view, T)}`;
  else if (!view.signedIn) body = `${T.both(M.signIn, 'p', 'sx-note is-box')}<button type="button" class="sx-cta" data-action="accountSignIn">${esc(T.P(M.signInBtn))}</button>${officialEntry(view, T)}`;
  else if (!ask.age) body = `<section class="sx-card line" aria-labelledby="ask-age-h"><h2 id="ask-age-h">${esc(T.P(M.ageLegend))}</h2>${T.both(M.ageWhy)}${ageChoices(view, T, 'ask-age')}</section>`;
  else if (ask.age === 'under14') body = `<p class="sx-note is-box"><span>${esc(T.P(M.under14Note)).replace(HELP_MAIL, mail)}</span>${T.mnLine(M.under14Note)}</p>${officialEntry(view, T)}`;
  else if (ask.age === 'teen') body = `${T.both(M.teenNote, 'p', 'sx-note is-box')}${officialEntry(view, T)}${teenForm(view, T)}`;
  else if (!ask.consent) body = askConsent(view, T);
  else body = chat(view, T);
  const again = view.signedIn && ask.age && !view.off && ask.phase !== 'sending' ? `<p class="sx-fine"><button type="button" class="sx-link" data-action="askAgeReset">${esc(T.P(M.ageAgain))}</button></p>` : '';
  return `<div class="sx sx-ask">${head}${top}${body}${again}</div>`;
}

/* ── 넘김 요약 쪽 ── */
function lineEditor(T, field, d, i, orig, busy) {
  const id = `brief-${field}-${i}`, changed = d.index === null ? 'added' : !d.removed && d.text !== orig ? 'edited' : null;
  const tag = changed ? `<span class="sx-tag is-check">${esc(T.P(M[changed]))}</span>` : '';
  if (d.removed) return `<li class="sx-brief-line is-removed"><p class="sx-brief-old">${esc(orig)}</p>${T.both(M.removed, 'p', 'sx-fine')}<button type="button" class="sx-link" data-action="briefRestore" data-id="${field}" data-value="${i}"${busy ? ' disabled' : ''}>${esc(T.P(M.restore))}</button></li>`;
  return `<li class="sx-brief-line"><div class="sx-brief-row"><label class="sr-only" for="${id}">${esc(T.P(M[field === 'task' ? 'tasks' : field === 'open' ? 'openQ' : field]))} ${i + 1}</label><textarea id="${id}" class="sx-tr-text sx-brief-input" rows="2" maxlength="300" data-action="briefLine" data-id="${field}" data-value="${i}"${busy ? ' readonly' : ''}>${esc(d.text)}</textarea>${tag}</div>
<button type="button" class="sx-link" data-action="briefRemove" data-id="${field}" data-value="${i}"${busy ? ' disabled' : ''}>${esc(T.P(M.remove))}</button></li>`;
}
/**
 * 넘김 요약 쪽. view: { lang, mn?, open, now, brief: { phase: 'loading'|'ready'|'sending'|'sent'|'failed', notice, got: { brief, ticket, at }, draft, with: { conversation, profile, program }, note, agree, programName } }
 */
export function renderBrief(view) {
  const T = tools(view), b = view.brief || {};
  const head = `<button type="button" class="sx-back" data-action="askBriefLeave">${BACK}${esc(T.P(M.bBack))}</button>
<header class="sx-head"><p class="sx-kicker">${esc(T.P(M.bKicker))}</p><h1 class="sx-title page-title" id="brief-title" tabindex="-1">${esc(T.P(M.bTitle))}</h1>${T.both(M.bLead, 'p', 'sx-lead')}</header>`;
  const noteBox = (k) => (k && M[k] ? `<p class="sx-store is-warn" id="brief-notice" role="status" tabindex="-1"><span>${esc(T.P(M[k])).replace(HELP_MAIL, mail)}</span>${T.mnLine(M[k])}</p>` : '');
  if (b.phase === 'loading') return `<div class="sx sx-ask sx-brief">${head}${T.both(M.bLoading, 'p', 'sx-note is-box', ' id="brief-wait" role="status" tabindex="-1"')}</div>`;
  if (b.phase === 'sent') return `<div class="sx sx-ask sx-brief">${head}<section class="sx-card meadow"><h2 id="brief-sent" tabindex="-1">${esc(T.P(M.cSent))}</h2>${T.mnLine(M.cSent)}<button type="button" class="sx-btn2" data-action="nav" data-page="today">${esc(T.P(M.toToday))}${GO}</button></section></div>`;
  if (!b.got) return `<div class="sx sx-ask sx-brief">${head}${noteBox(b.notice || 'lost')}<div class="sx-row2"><button type="button" class="sx-cta" data-action="askBriefRetry">${esc(T.P(M.refetch))}</button></div></div>`;
  if (view.open !== true) return `<div class="sx sx-ask sx-brief">${head}${noteBox('closed')}</div>`;
  const expired = briefExpired(b.got, view.now);
  const s = b.got.brief.student, d = b.draft, busy = b.phase === 'sending';
  const kindName = T.P(M['k_' + b.got.brief.kind]);
  const fixed = `<dl class="sx-brief-fixed"><div><dt>${esc(T.P(M.bKind))}</dt><dd>${esc(kindName)}</dd></div><div><dt>${esc(T.P(M.bDeadline))}</dt><dd>${b.got.brief.deadline ? esc(b.got.brief.deadline) : esc(T.P(M.bNoDeadline))}</dd></div></dl>${T.both(M.bFixed, 'p', 'sx-fine')}`;
  const single = (f) => `<section aria-labelledby="brief-${f}-h"><h2 class="sx-h" id="brief-${f}-h">${esc(T.P(M[f]))}${T.mnLine(M[f])}</h2><ul class="sx-brief-list">${lineEditor(T, f, { ...d[f], index: 0 }, 0, s[f], busy)}</ul></section>`;
  const multi = (f, title, origs, extra = () => '') => `<section aria-labelledby="brief-${f}-h"><h2 class="sx-h" id="brief-${f}-h">${esc(T.P(title))}${T.mnLine(title)}</h2><ul class="sx-brief-list">${d[f].map((x, i) => lineEditor(T, f, x, i, x.index === null ? '' : origs[x.index], busy).replace('</li>', `${x.index === null ? '' : extra(x.index)}</li>`)).join('')}</ul><button type="button" class="sx-btn2" data-action="briefAdd" data-id="${f}"${busy ? ' disabled' : ''}>${esc(T.P(M.addLine))}</button></section>`;
  const taskExtra = (i) => { const t = s.tasks[i]; return `<p class="sx-fine"><b>${esc(T.P(M.why))}</b> ${esc(t.why)}${t.by ? ` · <b>${esc(T.P(M.by))}</b> ${esc(t.by)}` : ''}</p>`; };
  const aiDone = s.ai_done.length ? `<section aria-labelledby="brief-done-h"><h2 class="sx-h" id="brief-done-h">${esc(T.P(M.aiDone))}${T.mnLine(M.aiDone)}</h2><ul class="sx-brief-done">${s.ai_done.map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>${T.both(M.bFixed, 'p', 'sx-fine')}</section>` : '';
  const w = b.with || {}, dis = busy ? ' disabled' : '';
  const opt = (id, on, a, sub = '') => `<label class="sx-check"><input type="checkbox" id="brief-with-${id}" data-action="briefWith" data-id="${id}"${on ? ' checked' : ''}${dis}><span><span>${esc(T.P(a))}</span>${T.mnLine(a)}${sub}</span></label>`;
  const withBox = `<section aria-labelledby="brief-with-h"><h2 class="sx-h" id="brief-with-h">${esc(T.P(M.withTitle))}</h2>${opt('conversation', w.conversation, M.withConv, `<small>${esc(T.P(M.withConvSub))}</small>`)}${view.hasProfile ? opt('profile', w.profile, M.withMine) : ''}${view.programName ? opt('program', w.program, M.withProgram, `<small>${esc(T.pickT(view.programName))}</small>`) : ''}</section>`;
  const note = `<div class="sx-field"><label for="brief-note">${esc(T.P(M.note))}</label><textarea id="brief-note" class="sx-tr-text sx-ask-input" rows="3" maxlength="${MAX_NOTE_CHARS}" data-action="briefNote"${busy ? ' readonly' : ''}>${esc(b.note || '')}</textarea></div>`;
  const send = expired
    ? `${noteBox('expired')}<button type="button" class="sx-cta" data-action="askBriefRetry">${esc(T.P(M.refetch))}</button>`
    : `${noteBox(b.notice)}<button type="button" class="sx-cta" data-action="briefSend"${b.agree && !busy ? '' : ' disabled'}>${esc(T.P(M.cSend))}</button>${busy ? T.both(M.cSending, 'p', 'sx-fine', ' id="brief-wait" role="status" tabindex="-1"') : ''}`;
  return `<div class="sx sx-ask sx-brief">${head}${fixed}${single('situation')}${single('wants')}${aiDone}${multi('open', M.openQ, s.open)}${multi('task', M.tasks, s.tasks.map((t) => t.do), taskExtra)}${withBox}${note}${caseConsent(T, 'brief', b.agree)}${send}</div>`;
}

/* ── 「내 상담」 카드(오늘 화면) ── */
/** view: { lang, mn?, cases: { phase: 'loading'|'ok'|'error', list, note, text: { [id]: 글 } }, known(이 탭에서 보낸 건이 있음) } */
export function renderCases(view) {
  const T = tools(view), c = view.cases;
  if (!c) return '';
  const wrap = (body) => `<section class="sx sx-entry sx-cases" aria-labelledby="cases-h"><div class="sx-card line"><h2 id="cases-h">${esc(T.P(M.cases))}${T.mnLine(M.cases)}</h2>${body}</div></section>`;
  const note = c.note && M[c.note] ? `<p class="sx-store${['deleted'].includes(c.note) ? '' : ' is-warn'}" role="status">${esc(T.P(M[c.note]))}</p>` : '';
  if (c.phase === 'error') return view.known ? wrap(`${T.both(M.loadFail, 'p', 'sx-store is-warn', ' role="status"')}<button type="button" class="sx-btn2" data-action="casesLoad">${esc(T.P(M.reload))}</button>`) : '';
  if (c.phase === 'loading') return view.known ? wrap(T.both(M.loading, 'p', 'sx-fine', ' role="status"')) : '';
  const list = c.list || [];
  if (!list.length) return note ? wrap(note) : '';
  const one = (k) => {
    const msgs = k.messages.map((m) => `<li class="${m.from === 'staff' ? 'sx-ask-ai' : 'sx-ask-me'}"><p class="sx-ask-who">${esc(T.P(m.from === 'staff' ? M.staff : M.me))}${m.at ? ` · ${esc(m.at.slice(0, 10))}` : ''}</p><div class="sx-ask-text">${lines(m.text).replaceAll(MASK_TOKEN, esc(T.L('[가린 번호]', '[hidden number]')))}</div></li>`).join('');
    const id = k.id, done = k.status === 'closed';
    return `<article class="sx-case" aria-labelledby="case-${id}-h"><div class="sx-case-top"><h3 id="case-${id}-h">${esc(T.P(M['k_' + k.kind]))}${k.created_at ? ` · ${esc(k.created_at.slice(0, 10))}` : ''}</h3><span class="sx-tag ${k.status === 'answered' ? 'is-ok' : k.status === 'closed' ? 'wait' : 'is-check'}">${esc(T.P(M['st_' + k.status]))}</span></div>
${k.wants ? `<p class="sx-case-wants">${esc(k.wants)}</p>` : ''}${k.delete_soon ? `<p class="sx-store is-warn" role="status"><span>${esc(T.P(M.deleteSoon))}${k.delete_at ? ` (${esc(k.delete_at.slice(0, 10))})` : ''}</span>${T.mnLine(M.deleteSoon)}</p>` : ''}${k.earlier ? `<p class="sx-fine">${esc(T.L(`앞의 글 ${k.earlier}개는 여기 보이지 않아요. 담당자는 모두 봐요.`, `${k.earlier} earlier messages are not shown here. The staff member sees them all.`))}</p>` : ''}${msgs ? `<ol class="sx-ask-log">${msgs}</ol>` : ''}
${k.unread ? `<div class="sx-row2"><p class="sx-tag is-ok">${esc(T.P(M.unread))}</p><button type="button" class="sx-btn2" data-action="caseRead" data-id="${id}">${esc(T.P(M.readBtn))}</button></div>` : ''}
${done ? '' : `<div class="sx-field"><label for="case-text-${id}">${esc(T.P(M.more))}</label><textarea id="case-text-${id}" class="sx-tr-text sx-ask-input" rows="2" maxlength="${MAX_NOTE_CHARS}" data-action="caseText" data-id="${id}">${esc(c.text?.[id] || '')}</textarea><button type="button" class="sx-btn2" data-action="caseSend" data-id="${id}"${String(c.text?.[id] || '').trim() ? '' : ' disabled'}>${esc(T.P(M.moreSend))}</button></div>`}
<details class="sx-past" data-fold="case-del-${id}"><summary>${esc(T.P(M.del))}</summary>${T.both(M.delNote, 'p', 'sx-fine')}<button type="button" class="sx-btn2 line danger" data-action="caseDelete" data-id="${id}">${esc(T.P(M.del))}</button></details></article>`;
  };
  return wrap(`${note}${list.map(one).join('')}`);
}
/** 「내 길」에 보이는 상담 표시. 열린 건이 있을 때만. */
export function renderCaseMarker(view) {
  const T = tools(view);
  return `<section class="sx-card lapis sx-case-marker"><p class="sx-k">${esc(T.P(M.cases))}</p>${T.both(M.marker)}<button type="button" class="sx-btn2" data-action="nav" data-page="today">${esc(T.P(M.markerBtn))}${GO}</button></section>`;
}
export { CASE_STATUSES };
