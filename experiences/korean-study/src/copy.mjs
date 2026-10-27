// 한국어 공부 화면 글. 새 줄은 여기(ko·en·mn — 영어·몽골어는 현지어 검수 대상), 이미 검수된 WORLD 쓰기 글은
// copy-reused.mjs(빌드가 brand-opening/world-strings.mjs에서 고른 키만 옮겨 만든다)에서 가져온다.
import REUSED from './copy-reused.mjs';
export const LANGS=['ko','en','mn'],LANG_NAMES={ko:'한국어',en:'English',mn:'Монгол'},LANG_KEY='synk.world.lang';
export const COPY={
 'study.title':{ko:'한국어 공부',en:'Korean study',mn:'Солонгос хэлний хичээл'},
 'study.lead':{ko:'TOPIK II 쓰기를 한 가지씩 같이 고쳐 가요. 점수나 급수는 매기지 않아요.',en:'We work on TOPIK II writing one point at a time. There are no scores or levels.',mn:"TOPIK II бичих даалгаврын алдааг нэг нэгээр нь хамт засна. Оноо, түвшин тогтоохгүй."},
 'study.device':{ko:'공부 기록은 이 기기에만 저장돼요. 계정 연결은 아직 없어요.',en:'Your study record is saved only on this device. Account sign-in is not connected yet.',mn:"Хичээлийн явц зөвхөн энэ төхөөрөмжид хадгалагдана. Бүртгэлтэй холбох боломж одоогоор байхгүй."},
 'study.lang':{ko:'화면 언어',en:'Language',mn:'Хэл'},
 'study.stop':{ko:'오늘은 그만',en:'Stop for today',mn:"Өнөөдөртөө болих"},
 'study.stopped':{ko:'여기까지 저장했어요. 다시 열면 이 자리부터 이어서 해요.',en:'Saved up to here. When you come back, you will continue from this point.',mn:'Энд хүртэл хадгаллаа. Дахин нээхэд эндээс үргэлжилнэ.'},
 'study.resumeHere':{ko:'이어서 하기',en:'Continue',mn:'Үргэлжлүүлэх'},
 'study.saveFail':{ko:'이 기기에 저장하지 못했어요. 이 화면을 닫으면 기록이 남지 않아요.',en:'Could not save on this device. If you close this page, the record will not be kept.',mn:"Энэ төхөөрөмжид хадгалж чадсангүй. Энэ хуудсыг хаавал явц хадгалагдахгүй."},
 'resume.title':{ko:'이 기기에 이어서 할 공부가 있어요.',en:'There is an unfinished study session on this device.',mn:'Энэ төхөөрөмжид дуусаагүй хичээл байна.'},
 'resume.note':{ko:'다른 사람이 이 기기로 공부했다면 처음부터 시작해 주세요. 앞 사람의 기록은 지우지 않고 따로 둬요.',en:'If someone else studied on this device, please start over. Their record is kept separately and not deleted.',mn:"Энэ төхөөрөмжөөр өөр хүн хичээллэсэн бол шинээр эхэлнэ үү. Өмнөх хүний явцыг устгахгүй, тусад нь хадгална."},
 'resume.fresh':{ko:'처음부터 하기',en:'Start over',mn:'Шинээр эхлэх'},
 'write.task':{ko:'이 자료를 세 문장 이상으로 설명해 보세요. 시험에서는 200~300자로 써요.',en:'Describe this data in three or more sentences. In the exam you write 200–300 characters.',mn:"Энэ мэдээллийг дор хаяж гурван өгүүлбэрээр тайлбарлаарай. Шалгалтад 200–300 тэмдэгтээр бичдэг."},
 'write.label':{ko:'내 글',en:'My writing',mn:"Миний бичвэр"},
 'write.done':{ko:'다 썼어요',en:'I am done',mn:'Бичиж дууслаа'},
 'write.short':{ko:'세 문장 이상 써 보세요. 질문이나 끝나지 않은 문장, 같은 문장 반복은 세지 않아요.',en:'Write three or more sentences. Questions, unfinished sentences and repeated sentences are not counted.',mn:"Дор хаяж гурван өгүүлбэр бичээрэй. Асуулт, дуусаагүй өгүүлбэр, давтагдсан өгүүлбэрийг тоолохгүй."},
 'write.forms':{ko:'53번 글의 문장 끝',en:'Sentence endings for question 53',mn:'53-р даалгаврын өгүүлбэрийн төгсгөл'},
 'self.q':{ko:'문장 끝만 위에서 아래로 다시 읽어 봤나요? 고칠 곳이 있으면 지금 고쳐도 돼요.',en:"Did you check just the sentence endings again, from top to bottom? You can still fix them now.",mn:'Өгүүлбэрийн төгсгөлийг л дээрээс доош дахин уншсан уу? Засах зүйл байвал одоо засаж болно.'},
 'self.go':{ko:'점검하기',en:'Check',mn:'Шалгах'},
 'seen.title':{ko:'방금 쓴 글',en:'What you just wrote',mn:'Саяхан бичсэн бичвэр'},
 'seen.helpedOk':{ko:'「-습니다/-아요」로 끝난 문장이 없어요. 도움을 보며 쓴 글로 남겨요.',en:"No sentence ends in 「-습니다/-아요」. This will be recorded as completed with help.",mn:"「-습니다/-아요」-аар төгссөн өгүүлбэр алга. Энэ бичвэрийг тусламж харж бичсэн гэж тэмдэглэнэ."},
 'seen.flags':{ko:'끝은 「-다」지만 확인해 볼 꼴이 {n}개 있어요(「많는다」, 「증가하다.」처럼).',en:'The endings are 「-다」, but {n} forms need checking (like 「많는다」 or 「증가하다.」).',mn:'Төгсгөл нь 「-다」 боловч шалгах хэлбэр {n} байна (「많는다」, 「증가하다.」 гэх мэт).'},
 'next.probe':{ko:'짧게 확인하기',en:'Quick check',mn:'Товч шалгах'},
 'next.method':{ko:'연습하기',en:'Practise',mn:'Дадлага хийх'},
 'next.write':{ko:'다른 자료로 쓰기',en:'Write about other data',mn:'Өөр мэдээллээр бичих'},
 'next.rest':{ko:'마치기',en:'Finish',mn:'Дуусгах'},
 'probe.formLead':{ko:'표시한 말을 53번 글에 맞게 「-다」 꼴로 바꿔 써 보세요.',en:'Rewrite the marked word in the 「-다」 form used in question 53.',mn:"Тэмдэглэсэн үгийг 53-р даалгаварт тохирох 「-다」 хэлбэрээр дахин бичээрэй."},
 'probe.formMiss':{ko:'검수된 답과 달라요. 바로 이어서 함께 연습해요.',en:'This is different from the correct answer. We will practise it next.',mn:"Зөв хариултаас өөр байна. Одоо шууд хамт дадлага хийе."},
 'form.input':{ko:'바꿔 쓰기',en:'Your answer',mn:'Хариулт'},
 'form.check':{ko:'확인',en:'Check',mn:'Шалгах'},
 'form.answer':{ko:'이렇게 써요:',en:'Write it like this:',mn:'Ингэж бичнэ:'},
 'form.why':{ko:'설명',en:'Why',mn:'Тайлбар'},
 'method.contrast':{ko:'글의 종류마다 문장 끝이 달라요. 문장 끝을 보고 어떤 글에 어울리는지 골라 봐요.',en:'Each kind of text has its own sentence ending. Look at the ending and choose the text it fits.',mn:"Бичвэрийн төрөл бүрт өгүүлбэрийн төгсгөл өөр өөр байдаг. Төгсгөлийг нь хараад аль төрлийн бичвэрт тохирохыг сонгоорой."},
 'method.examples':{ko:'바구니마다 이런 문장이 들어가요.',en:'Each basket takes sentences like these.',mn:'Төрөл бүрт ийм өгүүлбэр орно.'},
 'method.forms':{ko:'53번 글에서는 말의 종류에 따라 「-다」 꼴이 달라요. 꼴을 보고 직접 써 봐요.',en:'In question 53 the 「-다」 form depends on the kind of word. Look at the forms and write them yourself.',mn:"53-р даалгаварт 「-다」 хэлбэр нь үгийн төрлөөс хамаарч өөр байдаг. Хэлбэрийг нь хараад өөрөө бичиж үзээрэй."},
 'method.apply':{ko:'이번에는 쓴 글에서 문장 끝만 다시 찾아보는 연습을 해요.',en:'This time, practise finding just the sentence endings again in a finished text.',mn:"Энэ удаад бичсэн бичвэрээс зөвхөн өгүүлбэрийн төгсгөлийг дахин нягтлах дадлага хийе."},
 'find.lead':{ko:'끝맺음이 다른 문장을 모두 고르세요.',en:'Choose every sentence with a different ending.',mn:"Төгсгөл нь өөр бүх өгүүлбэрийг сонгоорой."},
 'find.right':{ko:'다 찾았어요.',en:'You found them all.',mn:'Бүгдийг нь оллоо.'},
 'find.wrong':{ko:'표시한 문장이 끝맺음이 다른 문장이에요.',en:'The marked sentences are the ones with a different ending.',mn:"Тэмдэглэсэн өгүүлбэрүүдийн төгсгөл бусдаас өөр байна."},
 'mine.lead':{ko:'방금 글에서 확인해 볼 문장이에요. 끝을 「-다」 꼴로 바꿔 쳐 보세요.',en:'These are sentences to check from what you just wrote. Try retyping them with a 「-다」 ending.',mn:"Таны сая бичсэн бичвэрээс шалгах өгүүлбэрүүд энэ байна. Төгсгөлийг нь 「-다」 хэлбэрт оруулж дахин шивээрэй."},
 'find.tag':{ko:'끝맺음이 다름',en:'Different ending',mn:'Төгсгөл нь өөр'},
 'change.adj':{ko:'「많다」처럼 상태를 나타내는 말에는 「-는다」를 붙이지 않아요.',en:'Words for states, like 「많다」, do not take 「-는다」.',mn:"「많다」 шиг төлөв байдал заасан үгэнд 「-는다」 залгадаггүй."},
 'change.dict':{ko:'「-하다」·「-다」 그대로는 사전에 실린 꼴이에요. 움직임이면 「-한다」·「-ㄴ다」로 써요.',en:'Plain 「-하다」 or 「-다」 is the dictionary form. For actions, write 「-한다」 or 「-ㄴ다」.',mn:"「-하다」, 「-다」 хэвээр нь бол толь бичгийн хэлбэр юм. Үйл хөдлөл заасан бол 「-한다」, 「-ㄴ다」 гэж бичнэ."},
 'next.continue':{ko:'계속',en:'Continue',mn:'Үргэлжлүүлэх'},
 'rest.alone':{ko:'다음에 오면 다른 자료로 한 번 더 써 봐요.',en:'Next time, try once more with different data.',mn:"Дараа ирэхдээ өөр мэдээллээр дахин нэг удаа бичиж үзээрэй."},
 'rest.done':{ko:'이 한 가지는 처음 보는 자료 두 개에서 도움 없이 맞았어요. 다음 주제는 아직 준비 중이에요.',en:'You got this point right without help on two new sets of data. The next topic is not ready yet.',mn:"Анх удаа үзсэн хоёр мэдээллийг тайлбарлахдаа өгүүлбэрийн төгсгөлийг тусламжгүйгээр зөв бичлээ. Дараагийн сэдэв одоогоор бэлтгэгдэж байна."},
 'rest.noItems':{ko:'처음 보는 53번 자료를 다 썼어요. 새 자료가 준비되면 이어서 해요.',en:'You have used all the new data for question 53. We will continue when new data is ready.',mn:"53-р даалгаврын шинэ мэдээллийг бүгдийг нь ашиглаж дууслаа. Шинэ мэдээлэл бэлэн болохоор үргэлжлүүлнэ."},
 'rest.triedAll':{ko:'오늘은 여기까지 해요. 다음에 오면 다시 써 보면서 이어 가요.',en:"Let's stop here for today. Next time, we will pick up with writing again.",mn:'Өнөөдөр ингээд болъё. Дараа ирэхдээ дахин бичиж үргэлжлүүлнэ.'},
};
export function makeT(lang){const pick=entry=>entry?.[lang]??entry?.ko;return (key,vars={})=>{const entry=COPY[key]||REUSED[key];if(!entry)return key;return String(pick(entry)).replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'');};}
export function chooseLang({search=globalThis.location?.search||'',storage=globalThis.localStorage,languages=globalThis.navigator?.languages||[globalThis.navigator?.language].filter(Boolean)}={}){
 try{const q=new URLSearchParams(search).get('lang');if(LANGS.includes(q))return q;}catch{}
 try{const s=storage?.getItem(LANG_KEY);if(LANGS.includes(s))return s;}catch{}
 // 저장값이 없으면 기기 언어(WORLD world-lang.mjs deviceLang과 같은 규칙 — 몽골 문자 mn-Mong·mn-CN은 빼고, 그 모듈은 부르지 않는다). Fable F1.
 for(const raw of languages||[]){const tag=String(raw).toLowerCase();if(/^mn(-|$)/.test(tag)&&!/mong|-cn/.test(tag))return 'mn';const base=tag.split('-')[0];if(base==='ko'||base==='en')return base;}
 return 'ko';
}
