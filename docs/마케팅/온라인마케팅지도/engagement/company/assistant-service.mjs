import { dateRange, shiftDate } from '../analytics.mjs';
import { growthWeekWindow } from './growth-summary.mjs';
import { CREW_PROFILE_CATALOG } from './crew-profile-service.mjs';
import { answerProductivity } from './assistant-productivity.mjs';

const fail = message => Object.assign(new Error(message), { status: 400 });
const number = value => typeof value === 'number' && Number.isFinite(value);
const format = value => number(value) ? value.toLocaleString('ko-KR', { maximumFractionDigits: 1 }) : '미확인';
const signed = value => number(value) ? `${value > 0 ? '+' : ''}${format(value)}` : '비교 불가';
const clean = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
const marketing = (label, view = 'overview', section = 'mine', extra = {}) => ({ type: 'marketing', label, view, ...(view === 'channels' ? {} : { section }), ...extra });
const messenger = (label, extra = {}) => ({ type: 'messenger', label, ...extra });
const profileAction = draft => ({ type: 'profile', label: draft && Object.keys(draft).length ? '내 업무 카드 초안 확인' : '내 업무 카드 열기', ...(draft && Object.keys(draft).length ? {draft} : {}) });
const helpActions = () => [marketing('내 성과 보기'), messenger('메신저 열기')];
const result = (intent, text, actions = [], data) => ({ mode: 'workspace-guide', intent, text, actions: actions.slice(0, 5), suggestions: [], generative: false, externalCalls: false, ...(data ? { data } : {}) });
const fallback = (text = '확인. 성과 조회, 크루·대화방 찾기, 내 할 일과 공유 파일 찾기를 도울 수 있어요. 할 일을 조금 더 구체적으로 알려 주세요.') => result('unsupported', text, helpActions());
function keyword(message, words) {
  return message.replace(words, ' ').replace(/(?:보여\s*줘|보여\s*주세요|찾아\s*줘|찾아\s*주세요|검색해\s*줘|검색해\s*주세요|열어\s*줘|열어\s*주세요|알려\s*줘|알려\s*주세요|어디(?:에)?\s*있(?:어|나요|어요)?)/g, ' ').replace(/(^|\s)(?:내가|나의|내|최근|공유된|공유|좀|된|있어|있나요)(?=\s|$)/g, '$1').replace(/([가-힣a-z0-9])(?:을|를)(?=\s|$)/gi, '$1').replace(/["'“”‘’?]/g, '').trim().replace(/\s+/g, ' ').slice(0, 200);
}
function windowFor(message, today) {
  const explicit = message.match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (explicit.length > 1) return null;
  let asOf = explicit[0] || today, period = /이번\s*달|이달|월간|지난\s*달|전월/.test(message) ? 'month' : /오늘|금일|어제|하루/.test(message) ? 'day' : 'week';
  if (!explicit.length) {
    if (/어제/.test(message)) asOf = shiftDate(today, -1);
    else if (/지난\s*주|저번\s*주/.test(message)) asOf = shiftDate(growthWeekWindow(today).current.start, -1);
    else if (/지난\s*달|전월/.test(message)) asOf = shiftDate(today.slice(0,8) + '01', -1);
  }
  try { dateRange(asOf, asOf); } catch { return null; }
  if (asOf > today) return null;
  return { asOf, period };
}
function metricSummary(point, period) {
  const comparison = period === 'day' ? point.day : point[period].current;
  const pair = period === 'day' ? null : point[period];
  return { total: point.today.total, count: point.today.count, eligible: point.today.eligible, latest: point.today.latest, newest: point.today.newest, stale: point.today.stale,
    delta: comparison.delta, deltaCount: comparison.count, deltaEligible: comparison.eligible, complete: comparison.complete,
    previousDelta: pair?.previous.delta ?? null, difference: pair?.difference ?? null, rate: pair?.rate ?? null, comparable: pair?.comparable ?? false };
}

export function declaredWorkDraft(message, otherNames=[]) {
  const compact=clean(message);
  // Only explicit first-person declarations become proposals. No psychological or third-person inference.
  if(otherNames.some(name=>clean(name).length>=2&&compact.includes(clean(name)))||/성격|심리|mbti|건강|우울|불안|내향|외향|종교|정치|인종|라고|다던|한다는|친구|동료|누군가|다른\s*(?:사람|크루|팀원)|그분|그녀/i.test(message))return {};
  const draft={},skills=[],preferredTasks=[];
  const statements=message.split(/(?<!\d)\.(?!\d)|[!?。\n]/).map(value=>value.trim()).filter(Boolean);
  for(const statement of statements){
    if(!/^(?:나는|저는|난(?=\s)|전(?=\s)|내가|제가|나의|저의|내\s*(?:업무|기술|역량|선호))/.test(statement)||/못|않|없|아니|싫|안\s|관심만|배우고\s*싶/.test(statement))continue;
    for(const item of CREW_PROFILE_CATALOG.skills){
      const label=item.label.replace(/\s+/g,'\\s*'),match=statement.match(new RegExp(label+'(?:을|를|은|는|이|가)?\\s*([^,.!?]{0,24})'));
      if(!match)continue;const declaration=match[1].split(/하고|하지만|그리고/)[0];
      if(/^(?:정말\s*|잘\s*)?(?:좋아|선호)|^(?:맡고|하고)\s*싶/.test(declaration))preferredTasks.push(item.id);
      else if(/^(?:잘\s*(?:해|하|할)|할\s*수\s*있|경험이?\s*있|가능해)/.test(declaration))skills.push(item.id);
    }
    const hours=statement.match(/주(?:당)?\s*(\d{1,2}(?:\.5)?)\s*시간(?:은|을)?\s*(?:참여\s*)?(?:가능|할애|쓸\s*수|낼\s*수)/);
    if(hours&&Number(hours[1])<=80)draft.availableHours=Number(hours[1]);
  }
  if(skills.length)draft.skills=[...new Set(skills)];if(preferredTasks.length)draft.preferredTasks=[...new Set(preferredTasks)];return draft;
}

// Deterministic intent routing over current authorized records. No prompts, logs, model calls or inferred facts are persisted.
export function createAssistantService({ today, performance, directory, productivity, clientWorkday }) {
  function answer(user, input, request) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || typeof input.message !== 'string' || input.message.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(input.message) || !input.message.trim()) throw fail('마린에게 물어볼 내용을 1~1000자로 입력해 주세요.');
    const message = input.message.trim(), compact = clean(message);
    if(/성격|심리|mbti|건강|우울|불안|내향|외향|종교|정치|인종/i.test(message))return result('profile','성격이나 민감한 정보를 추론하지 않을게요. 본인이 확인한 업무 역량·선호와 가능한 시간만 업무 카드에 담을 수 있어요.',[profileAction()]);
    if(/팀(?:을|은|의|도)?\s*(?:추천|구성|조합|짜)|크루\s*(?:업무\s*)?상태|프로젝트\s*(?:인원|멤버|크루)/.test(message))return ['admin','manager'].includes(user.role)?result('team-builder','공유에 동의한 업무 카드를 보고 크루를 직접 선택해 보세요. 선택한 조합의 역할·시간 조건만 대조하며 자동으로 선발하거나 배정하지 않아요.',[{type:'team-builder',label:'팀 구성 살펴보기'}]):result('profile','팀 구성은 관리자와 팀장이 살펴볼 수 있어요. 내 업무 카드는 직접 확인하고 공유 여부를 정할 수 있어요.',[profileAction()]);
    if(/업무\s*(?:카드|프로필|스타일|선호)|내\s*(?:역량|기술)|기억해|기억해\s*줘|저장해/.test(message)||/^(?:나는|저는|난(?=\s)|전(?=\s)|내가|제가).*(?:좋아|선호|잘해|할\s*수\s*있|시간.*가능)/.test(message)){
      const otherNames=directory(request).members.filter(person=>person.companyUserId!==user.id).map(person=>person.name),draft=declaredWorkDraft(message,otherNames);
      return result('profile',Object.keys(draft).length?'직접 말한 업무 정보를 초안으로 정리했어요. 아직 저장하지 않았어요. 내 업무 카드에서 항목과 공유 여부를 확인한 뒤 저장해 주세요.':'내 업무 카드에서 역량·선호·협업 방식과 가능한 시간을 직접 확인해 주세요. 공유는 기본으로 꺼져 있고 언제든 수정하거나 철회·삭제할 수 있어요.',[profileAction(draft)]);
    }
    if (/^(그중|그럼\s*그|거기서|그거|그것|이중|아까|이어서)/.test(message) || /^(?:우리\s*팀|내\s*팀|지난\s*주|저번\s*주|이번\s*달)(?:만|은|는|도)?[?.!\s]*$/.test(message)) return fallback('확인할 범위를 함께 알려 주세요. 예를 들어 “우리 팀 이번 주 조회수”처럼 물어보면 현재 자료로 확인할 수 있어요.');
    const productivityResult = answerProductivity({ message, request, user, productivity, clientWorkday });
    if (productivityResult) return productivityResult;
    if (/파일|첨부|문서/.test(message)) {
      const query = keyword(message, /파일|첨부(?:파일)?|문서|검색/g), found = directory(request, { include: 'files', query });
      if (!found.items.length) return result('files', '확인. 지금 볼 수 있는 공유 파일에서 일치하는 파일을 찾지 못했어요. 파일 이름을 바꾸어 찾거나 파일 화면을 열어 주세요.', [messenger('공유 파일 보기', { panel: 'files' })], { query, count: 0 });
      const actions = found.items.map(file => messenger(file.title, { channelId: file.channelId, messageId: file.messageId, fileId: file.id, panel: 'files' }));
      return result('files', `확인. 열람 가능한 공유 파일 ${found.items.length}개${found.hasMore ? '를 먼저' : '를'} 찾았어요.\n${found.items.map(file => `· ${file.title} · ${file.channelName}`).join('\n')}`, actions, { query, count: found.items.length, hasMore: found.hasMore });
    }
    if (/할\s*일|업무\s*목록|담당\s*업무|태스크|task/i.test(message)) {
      const completed = /완료/.test(message), query = keyword(message, /할\s*일|업무\s*목록|담당\s*업무|태스크|tasks?|완료(?:한|된)?/gi), found = directory(request, { include: 'tasks', query, completed });
      if (!found.items.length) return result('tasks', `확인. 현재 참여 중인 대화방에 ${completed ? '완료한' : '남아 있는'} 내 담당 업무${query ? ' 중 일치하는 항목이' : '가'} 없어요.`, [messenger('내 할 일 보기', { panel: 'tasks' })], { query, count: 0 });
      return result('tasks', `확인. 내 담당 업무 ${found.items.length}개${found.hasMore ? '를 먼저' : '를'} 찾았어요.\n${found.items.map(task => `· ${task.title}${task.dueDate ? ` · ${task.dueDate}까지` : ''}`).join('\n')}`, found.items.map(task => messenger(task.title, { channelId: task.channelId, messageId: task.messageId, panel: 'tasks' })), { query, count: found.items.length, hasMore: found.hasMore });
    }
    if (/저장한\s*메시지|저장\s*메시지|북마크/.test(message)) return result('navigate', '확인. 내가 저장한 메시지에서 다시 확인할 수 있어요.', [messenger('저장한 메시지 보기', { panel: 'saved' })]);
    if (/콘텐츠\s*기획|기획(?:하고|하자|하기|안|서|을|\s*화면|\s*열)|아이디어/.test(message)) return result('navigate', '확인. 콘텐츠 기획 화면에서 주제와 근거를 정리해 보세요.', [marketing('콘텐츠 기획 열기', 'content', 'plan')]);
    if (/채널\s*(?:수집|등록|연결|관리)|수집|계정\s*연결/.test(message)) return result('navigate', '확인. 채널 수집 화면에서 연결 상태와 수집 결과를 확인할 수 있어요. 연결·수집은 화면에서 직접 진행해 주세요.', [marketing('채널 수집 열기', 'channels', 'all')]);
    if (/전\s*기간|첫\s*기록|전체\s*추이|성장\s*차트/.test(message)) return result('navigate', '확인. 처음 기록한 날부터의 변화는 전체 추이에서 볼 수 있어요.', [marketing('전체 추이 보기', 'history', /전체/.test(message) ? 'all' : 'mine')]);
    if (/성과|실적|현황|성장|조회\s*수|팔로워|좋아요|댓글\s*수|공유\s*수|저장\s*수|도달/.test(message)) {
      if (/내일|모레|다음\s*(?:주|달|월|해)|미래|예측|전망/.test(message)) return fallback('미래 성과를 예측하지는 않아요. 오늘까지 수집된 자료로 내 성과·우리 팀·전체 현황을 확인할 수 있어요.');
      const otherPerson = directory(request).members.some(person => person.companyUserId !== user.id && clean(person.name).length >= 2 && compact.includes(clean(person.name)));
      if (otherPerson && !/내\s|나의|우리\s*팀|전체|회사/.test(message)) return fallback('크루 이름만으로 성과 범위를 정하지 않을게요. 내 성과·우리 팀·전체 중 조회할 범위를 함께 알려 주세요.');
      const selected = windowFor(message, today()); if (!selected) return fallback('확인할 날짜를 다시 알려 주세요. 오늘·어제·이번 주·지난주·이번 달, 또는 YYYY-MM-DD 날짜 하나로 조회할 수 있어요.');
      const scope = /전체|회사/.test(message) ? 'all' : /팀/.test(message) ? 'team' : 'mine';
      const current = performance(user, { ...selected, scope });
      const namedTeam = message.match(/([가-힣A-Za-z0-9]+팀)/)?.[1];
      if (scope === 'team' && namedTeam && !['우리팀', '내팀'].includes(namedTeam) && clean(namedTeam) !== clean(current.teamName)) return fallback('팀 이름을 단정하지 않을게요. 팀 현황 화면에서 조회할 범위를 선택해 주세요.');
      const label = scope === 'mine' ? '내 담당 채널 성과' : scope === 'team' ? (current.teamName ? `${current.teamName} 성과` : '내 팀 성과') : '열람 가능한 전체 성과';
      const action = marketing(`${scope === 'mine' ? '내' : scope === 'team' ? '팀' : '전체'} 성과 자세히 보기`, 'overview', scope);
      if (!current.channelCount) return result('performance', `확인. ${label}에 조회할 채널이 없어요.${scope === 'team' && !current.teamName ? ' 소속 팀이 지정되어 있는지 확인해 주세요.' : ' 채널 수집 화면에서 담당 채널을 확인해 주세요.'}`, [action, marketing('채널 수집 열기', 'channels', 'all')], { scope, asOf: selected.asOf, channelCount: 0 });
      const metricKey = /팔로워/.test(message) ? 'followers' : /좋아요/.test(message) ? 'likes' : /댓글/.test(message) ? 'comments' : /공유\s*수/.test(message) ? 'shares' : /저장\s*수/.test(message) ? 'saves' : /도달/.test(message) ? 'reach' : 'views';
      const metricLabel = { views: '조회수', followers: '팔로워', likes: '좋아요', comments: '댓글', shares: '공유', saves: '저장', reach: '도달' }[metricKey];
      const point = current.growth.metrics[metricKey], summary = metricSummary(point, selected.period);
      const period = selected.period === 'day' ? { start: selected.asOf, end: selected.asOf } : current.growth[selected.period].current;
      const previous = selected.period === 'day' ? null : current.growth[selected.period].previous;
      const lines = [`확인. ${label} · ${period.start}${period.start !== period.end ? `~${period.end}` : ''}.`];
      lines.push(`${metricLabel} ${number(summary.delta) ? `기간 증감 ${signed(summary.delta)}` : '증감은 비교할 기록이 부족해요'}.${number(summary.delta) && !summary.complete ? ' 일부 기록만 비교한 값이에요.' : ''}`);
      if (previous) lines.push(summary.comparable ? `${selected.period === 'week' ? '전주' : '전월'} 같은 기간보다 ${signed(summary.difference)}${number(summary.rate) ? ` (${signed(summary.rate)}%)` : ''}.` : `${selected.period === 'week' ? '전주' : '전월'} 같은 기간과의 비교는 아직 확인할 수 없어요.`);
      if (number(summary.total)) lines.push(`${selected.asOf} 당일 확인 누적 ${format(summary.total)}${summary.count < summary.eligible ? ` · ${summary.eligible}개 중 ${summary.count}개 확인` : ''}.`);
      else lines.push(`${selected.asOf} 당일 누적은 미확인이에요.`);
      return result('performance', lines.join('\n'), [action], { scope, asOf: selected.asOf, period: { kind: selected.period, ...period, ...(previous ? { previous } : {}) }, metric: metricKey, channelCount: current.channelCount, metrics: summary, ownershipBasis: scope === 'mine' ? '현재 내 담당 채널 기록' : '열람 가능한 채널별 기록' });
    }
    const chat = /대화|얘기|이야기|채팅|메신저|디엠|DM|방|크루|사람|보내|전송/i.test(message);
    const found = directory(request), names = found.members.filter(person => clean(person.name).length >= 2 && compact.includes(clean(person.name)));
    const rooms = found.channels.filter(room => room.kind !== 'dm' && clean(room.name).length >= 2 && compact.includes(clean(room.name)));
    if (names.length && (chat || !rooms.length)) return result('people', names.length === 1 ? `확인. ${names[0].name} 크루와 대화를 열 수 있어요. 메시지는 대화방에서 직접 보내 주세요.` : '확인. 이름이 겹치는 크루가 있어요. 팀을 보고 대화할 크루를 선택해 주세요.', names.slice(0,5).map(person => messenger(`${person.name}${person.teamName ? ` · ${person.teamName}` : ''}`, { userId: person.id })));
    if (rooms.length) return result('rooms', rooms.length === 1 ? `확인. 참여 중인 「${rooms[0].name}」 대화방을 열어 주세요.` : '확인. 참여 중인 대화방에서 일치하는 방을 찾았어요.', rooms.slice(0,3).map(room => messenger(room.name, { channelId: room.id })));
    if (chat) return result('rooms', /메신저\s*(?:열|가|화면)|^메신저$/.test(message) ? '확인. 메신저를 열어 주세요.' : '현재 참여 중인 대화방이나 활성 크루 이름에서 일치하는 대상을 찾지 못했어요. 이름을 정확히 알려 주세요.', [messenger('메신저 열기')]);
    if (/마케팅/.test(message)) return result('navigate', '확인. 마케팅 화면에서 내 성과부터 확인할 수 있어요.', [marketing('마케팅 열기')]);
    if (/^(?:안녕|반가워|마린|도와줘|뭐\s*할\s*수|사용법|도움)/.test(message)) return result('help', '확인. 회사 자료를 확인하고 필요한 화면을 안내할게요. “이번 주 내 조회수” 또는 크루·대화방 이름을 알려 주세요.', helpActions());
    return fallback();
  }
  return { answer };
}
