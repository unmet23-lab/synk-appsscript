// 고객 SNS 검토 화면(/social-review)을 실제 회사 서버 코드로 띄우는 일회용 합성 서버(2026-10-23). 127.0.0.1에서만 돌고,
// 자료는 임시 폴더에 두었다가 끝날 때 지운다. SNS로는 아무것도 나가지 않는다(가짜 공급자).
// 장면(검토 링크 하나씩):
//   daily     유호님 1일 1편 — 인스타 릴스 + 유튜브 쇼츠, 같은 세로 영상, 필수 검토, 답하기 전
//   customer  가상 브랜드 모루 — 인스타 사진 둘(반복 문구 둘·첫 댓글·대체 텍스트) + 페이스북 영상(링크), 7일마다 3번, 의견 둘 뒤 수정 요청
//   approved  승인한 뒤
//   optional  필수 아닌 검토, 일정 없음, 콘텐츠 만료 있음
//   long      긴 제목·긴 문구·해시태그 많음·계정 넷(인스타·페이스북·유튜브·틱톡)·의견 여럿
//   revoked   거둔 링크(서버가 410)
//   revised   고친 판(10-24) — 의견·수정 요청을 받은 판을 고쳐 다시 승인·예약한 새 링크, 지난 판과 바뀐 곳이 보임
//   before    그 지난 판의 옛 링크(고친 뒤라 서버가 410)
// 쓰는 법: node qa/verify-social-review-fixture.mjs [port]
//   → 한 줄 JSON { base, links: { 장면: 주소 }, directory }. 표준입력에 stop을 보내면 멈추고 폴더를 지운다(윈도는 자식에 SIGINT가 잘 안 간다).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCompanyApp } from '../server.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const demo = join(here, '..', 'public', 'pulse-app', 'demo-assets');
const port = Number(process.argv[2] || 47831);
const origin = `http://127.0.0.1:${port}`;
const directory = await mkdtemp(join(tmpdir(), 'synk-social-review-fixture-'));
const media = join(directory, 'media-src');

// 보여 줄 파일: 모루 장면 그림을 4:5 사진 둘·9:16 세로 영상으로 바꾸고, 가로 영상은 체험용 예고편을 그대로 쓴다.
const ff = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
mkdirSync(media, { recursive: true });
ff('-i', join(demo, 'scene-1.png'), '-vf', 'scale=-2:1350,crop=1080:1350', join(media, 'moru-1.png'));
ff('-i', join(demo, 'scene-2.png'), '-vf', 'scale=-2:1350,crop=1080:1350:x=(iw-1080)*0.62', join(media, 'moru-2.png'));
ff('-i', join(demo, 'scene-3.png'), '-vf', 'scale=-2:1350,crop=1080:1350:x=(iw-1080)*0.35', join(media, 'moru-3.png'));
ff('-loop', '1', '-i', join(demo, 'scene-3.png'), '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-vf', 'scale=-2:1920,crop=1080:1920,format=yuv420p',
  '-t', '4', '-r', '30', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', join(media, 'daily-short.mp4'));

const socialProvider = {
  settings: () => ({ configured: true, integrations: [] }),
  capability: channel => ({ mode: 'automatic', canPublish: true, formats: ['post', 'image', 'carousel', 'video', 'reel', 'shorts'], maxTextLength: 5000, maxMediaCount: 10,
    connection: { status: 'connected', integrationId: channel.externalId, profile: channel.handle } }),
  publish: async () => { throw Object.assign(Error('합성 서버는 게시하지 않는다'), { status: 409 }); },
  status: async () => ({ status: 'unknown' }),
};
const app = createCompanyApp({ dataDir: join(directory, 'company'), host: '127.0.0.1', port, origin, schedule: false, socialProvider,
  synkIdentityConfig: null, teachingConfig: null, synkCustomerIdentityConfig: null, workNotificationsEnabled: false, webPushEnabled: false,
  messengerDriveStorage: { active: async () => null, status: async () => ({ provider: 'local' }) } });

let stopping;
async function stop() {
  if (stopping) return stopping;
  stopping = (async () => {
    await app.stop();
    const target = resolve(directory), prefix = resolve(tmpdir()) + sep;
    if (!target.startsWith(prefix) || !target.split(sep).at(-1).startsWith('synk-social-review-fixture-')) throw Error('Unexpected fixture path');
    await rm(target, { recursive: true, force: true });
  })();
  return stopping;
}
process.on('SIGINT', () => void stop().then(() => process.exit(0)));
process.on('SIGTERM', () => void stop().then(() => process.exit(0)));
process.stdin.on('data', chunk => { if (String(chunk).trim() === 'stop') void stop().then(() => process.exit(0)); });

const password = '합성-검토-비밀번호-0123456789';
const staff = app.store.createUser({ email: 'review-fixture@company.test', name: '제작 담당', role: 'admin', password });
const channels = [
  ['yb-ig', 'instagram', '유호빌드', '@yuhobuilds'], ['yb-yt', 'youtube', '유호빌드', '@yuhobuilds'],
  ['moru-ig', 'instagram', '모루 커피', '@moru.coffee'], ['moru-fb', 'facebook', '모루 커피', 'facebook.com/moru.coffee'],
  ['moru-yt', 'youtube', '모루 커피 공식 채널 — 매일 아침 한 잔의 루틴을 기록합니다', '@moru.coffee.official'], ['moru-tt', 'tiktok', '모루 커피', '@moru.coffee'],
];
for (const [id, platform, displayName, handle] of channels)
  app.store.put('channels', id, { id, platform, displayName, handle, externalId: 'ext-' + id, active: true, ownerIds: [staff.id], connectionVersion: 1 });
await app.start();

// 작업실 화면과 같은 길(로그인 → 세션 쿠키·CSRF)로 원고를 만든다.
let cookie = '', csrf = '';
async function call(path, { method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(origin + path, { method, redirect: 'error', headers: { origin, cookie, 'x-csrf-token': csrf, ...(body && !(body instanceof Uint8Array) ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body instanceof Uint8Array ? body : body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  if (!response.ok) throw Error(`${method} ${path} ${response.status}: ${text.slice(0, 300)}`);
  return { response, data: text ? JSON.parse(text) : {} };
}
{
  const { response, data } = await call('/api/login', { method: 'POST', body: { email: staff.email, password } });
  cookie = (response.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).find(c => c.startsWith('synk_company_session=')) || '';
  csrf = data.csrfToken;
}
async function upload(file, type) {
  const bytes = new Uint8Array(readFileSync(file));
  const { data } = await call('/api/social/media', { method: 'POST', body: bytes,
    headers: { 'content-type': type, 'content-length': String(bytes.length), 'x-file-name': encodeURIComponent(file.split(/[\\/]/).at(-1)), 'x-version-label': encodeURIComponent('합성 검토 자료') } });
  return { assetId: data.asset.id };
}
const short = await upload(join(media, 'daily-short.mp4'), 'video/mp4');
const moru1 = await upload(join(media, 'moru-1.png'), 'image/png'), moru2 = await upload(join(media, 'moru-2.png'), 'image/png'), moru3 = await upload(join(media, 'moru-3.png'), 'image/png');
const film = await upload(join(demo, 'preview-v2.mp4'), 'video/mp4');

const day = (days, hour, minute = 0) => { const d = new Date(Date.now() + days * 86400000), kst = new Date(d.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  return new Date(`${kst}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`).toISOString(); };
async function post(input, { approve = true, schedules = [], link = {}, answers = [], revoke = false } = {}) {
  let { data: { post: row } } = await call('/api/social/posts', { method: 'POST', body: { language: 'ko', category: '합성 검토', campaignId: '', ...input } });
  if (approve) ({ data: { post: row } } = await call(`/api/social/posts/${row.id}/action`, { method: 'POST', body: { revision: row.revision, action: 'approve', note: '합성 검토' } }));
  for (const [scheduledAt, channelIds] of schedules)
    await call(`/api/social/posts/${row.id}/action`, { method: 'POST', body: { revision: row.revision, action: 'schedule', mode: 'fixed', scheduledAt, timezone: 'Asia/Seoul', channelIds } });
  const { data: made } = await call(`/api/social/posts/${row.id}/review-links`, { method: 'POST', body: { revision: row.revision, expiresInHours: 72, required: true, label: '합성 검토', ...link } });
  const token = new URL(made.url).hash.split('=')[1], headers = { 'content-type': 'application/json', origin, authorization: 'Bearer ' + token };
  let revision = made.link.revision;
  for (const [index, answer] of answers.entries()) {
    const response = await fetch(origin + '/api/social-review/respond', { method: 'POST', headers, body: JSON.stringify({ revision, requestId: 'fixture-answer-' + index + '-' + row.id.slice(0, 8), ...answer }) });
    if (!response.ok) throw Error('답 저장 실패 ' + response.status + ' ' + await response.text());
    revision = (await response.json()).review.revision;
  }
  if (revoke) await call(`/api/social/review-links/${made.link.id}/revoke`, { method: 'POST', body: { revision } });
  rows.set(made.url, row);
  return made.url;
}
const rows = new Map();

const daily = await post({ title: '멈춘 시간 재기', body: '', variants: [
  { channelId: 'yb-ig', format: 'reel', text: '42초 쇼츠를 재 보니 24초가 멈춰 있었어요.\n\n멈춘 구간을 찾는 법은 고정 댓글에 적어 둘게요.\n\n#쇼츠만들기 #영상편집 #유호빌드', media: [short], options: { shareToFeed: true, madeWithAi: true } },
  { channelId: 'yb-yt', format: 'shorts', title: '42초 쇼츠, 재 보니 24초가 멈춰 있었어요', text: '멈춘 구간을 찾는 법\n\n#shorts #영상편집', media: [short],
    options: { privacy: 'public', madeForKids: false, notifySubscribers: true, madeWithAi: true, language: 'ko', audioLanguage: 'ko', categoryId: '22' } },
] }, { schedules: [[day(2, 21), ['yb-ig', 'yb-yt']]], link: { label: '유호님 승인', expiresInHours: 96 } });

const moruText = '하루의 첫 장면을 천천히.\n모루 드립백이 가을 원두로 바뀌었어요. 봉투를 뜯고 물을 붓는 3분, 오늘은 나만의 루틴으로 시작해 보세요.\n\n#모루커피 #드립백 #가을원두';
const customer = await post({ title: '가을 첫 잔 — 드립백 새 원두', body: '모루 드립백 가을 원두 소개. 인스타는 사진 두 장, 페이스북은 15초 예고편으로 올려요.', recurrence: { intervalDays: 7, maxOccurrences: 3 }, variants: [
  { channelId: 'moru-ig', format: 'carousel', text: moruText, media: [moru1, moru2],
    options: { firstComment: '원두 이야기는 프로필 링크에서 볼 수 있어요.', altText: '모루 드립백 봉투와 커피 한 잔', hashtags: '#모루커피 #드립백' },
    copyVariants: [{ id: 'second', text: '두 번째 주에도 같은 루틴으로.\n물 온도는 92도면 충분해요.\n\n#모루커피 #드립백' }, { id: 'third', title: '', text: '세 번째 주, 가을 원두 마지막 소식.\n\n#모루커피' }] },
  { channelId: 'moru-fb', format: 'video', text: '15초 안에 담은 모루의 아침. 새 원두는 이번 주부터 매장과 온라인에서 만나요.', media: [film], options: { link: 'https://moru.example/drip' } },
] }, { schedules: [[day(3, 12), ['moru-ig', 'moru-fb']]], link: { label: '모루 마케팅팀 검토', expiresInHours: 120 }, answers: [
  { decision: 'comment', name: '김지은', comment: '두 번째 사진은 원두가 더 잘 보이는 컷이면 좋겠어요.' },
  { decision: 'reject', name: '박서준 · 모루 마케팅', comment: '가격 문구는 빼 주세요. 첫 댓글 링크는 그대로 좋아요.\n두 번째 사진도 지은 님 말대로 바꿔 주세요.' },
] });

const approved = await post({ title: '모루 매장 안내', body: '', variants: [
  { channelId: 'moru-ig', format: 'image', text: '이번 주 토요일은 오후 6시까지 열어요.\n\n#모루커피', media: [moru1], options: { altText: '모루 매장 안내 그림' } },
] }, { schedules: [[day(1, 9, 30), ['moru-ig']]], answers: [{ decision: 'approve', name: '박서준 · 모루 마케팅', comment: '' }] });

const optional = await post({ title: '시음회 예고', body: '', expiresAt: day(10, 18), variants: [
  { channelId: 'moru-ig', format: 'image', text: '새 원두 시음회 신청은 다음 주에 열어요.', media: [moru2], options: {} },
] }, { approve: false, link: { required: false, expiresInHours: 24 } });

const longText = '모루 커피 가을 시즌 정리. '.repeat(40) + '\n\n' + Array.from({ length: 24 }, (_, i) => '#모루커피시즌' + (i + 1)).join(' ') + '\nhttps://moru.example/' + 'a'.repeat(120);
const long = await post({ title: '모루 커피 가을 시즌 전체 정리 — 매장 네 곳의 원두·드립백·시음회·굿즈 일정을 한 번에 알려 드리는 긴 제목의 게시물', body: '공통 문구 '.repeat(60), variants: [
  { channelId: 'moru-ig', format: 'carousel', text: longText, media: [moru1, moru2], options: { firstComment: '첫 댓글 '.repeat(30), hashtags: '#모루커피 '.repeat(20), altText: '대체 텍스트 '.repeat(20) } },
  { channelId: 'moru-fb', format: 'post', text: longText, media: [], options: { link: 'https://moru.example/' + 'b'.repeat(140) } },
  { channelId: 'moru-yt', format: 'video', title: '모루 커피 가을 시즌 전체 정리 '.repeat(3).trim(), text: longText, media: [film], options: { privacy: 'unlisted', madeForKids: false, categoryId: '26', language: 'ko', paidPartnership: true } },
  { channelId: 'moru-tt', format: 'video', text: '짧은 문구', media: [short], options: { whoCanReply: 'followers' } },
] }, { schedules: [[day(4, 10), ['moru-ig', 'moru-fb']], [day(5, 19, 30), ['moru-yt', 'moru-tt']]], link: { label: '긴 글 검토', expiresInHours: 168 }, answers: Array.from({ length: 6 }, (_, i) => (
  { decision: i === 5 ? 'approve' : 'comment', name: i % 2 ? '' : '아주 긴 이름을 가진 검토자 '.repeat(3).trim(), comment: i === 5 ? '' : ('의견 ' + (i + 1) + ' — ' + '확인했어요. '.repeat(18)) })) });

const revoked = await post({ title: '거둔 링크', body: '', variants: [{ channelId: 'yb-ig', format: 'image', text: '거둔 링크', media: [moru1], options: {} }] }, { revoke: true });

// 고친 판(10-24): 고객 장면처럼 의견·수정 요청을 받은 게시물을 담당자가 고쳐(가격 줄 빼기·물 온도 고침·두 번째 사진 바꿈·
// 첫 댓글 고침·일정 하루 미룸) 다시 승인·예약하고 새 링크를 만든다. 옛 링크(before)는 서버가 닫고, 새 링크(revised)에 지난 판과 바뀐 곳이 보인다.
async function revise(url, input, schedules) {
  const id = rows.get(url).id;
  let { data: { post: row } } = await call(`/api/social/posts/${id}`, { method: 'POST', body: { revision: rows.get(url).revision, ...input } });
  ({ data: { post: row } } = await call(`/api/social/posts/${id}/action`, { method: 'POST', body: { revision: row.revision, action: 'approve', note: '합성 검토 — 고친 판' } }));
  for (const [scheduledAt, channelIds] of schedules)
    await call(`/api/social/posts/${id}/action`, { method: 'POST', body: { revision: row.revision, action: 'schedule', mode: 'fixed', scheduledAt, timezone: 'Asia/Seoul', channelIds } });
  const { data: made } = await call(`/api/social/posts/${id}/review-links`, { method: 'POST', body: { revision: row.revision, expiresInHours: 72, required: true, label: '고친 판 검토' } });
  return made.url;
}
const priced = moruText.replace('\n\n#모루커피', '\n가격은 한 상자 1만 2천 원이에요.\n\n#모루커피');
const firstIg = { channelId: 'moru-ig', format: 'carousel', text: priced, media: [moru1, moru2],
  options: { firstComment: '원두 이야기는 프로필 링크에서 볼 수 있어요.', altText: '모루 드립백 봉투와 커피 한 잔', hashtags: '#모루커피 #드립백' },
  copyVariants: [{ id: 'second', text: '두 번째 주에도 같은 루틴으로.\n물 온도는 92도면 충분해요.\n\n#모루커피 #드립백' }] };
const firstFb = { channelId: 'moru-fb', format: 'video', text: '15초 안에 담은 모루의 아침. 새 원두는 이번 주부터 매장과 온라인에서 만나요.', media: [film], options: { link: 'https://moru.example/drip' } };
const before = await post({ title: '가을 첫 잔 — 드립백 새 원두', body: '모루 드립백 가을 원두 소개. 인스타는 사진 두 장, 페이스북은 15초 예고편으로 올려요.', recurrence: { intervalDays: 7, maxOccurrences: 3 }, variants: [firstIg, firstFb] },
  { schedules: [[day(3, 12), ['moru-ig', 'moru-fb']]], link: { label: '모루 마케팅팀 검토', expiresInHours: 120 }, answers: [
    { decision: 'comment', name: '김지은', comment: '두 번째 사진은 원두가 더 잘 보이는 컷이면 좋겠어요.' },
    { decision: 'reject', name: '박서준 · 모루 마케팅', comment: '가격 문구는 빼 주세요. 첫 댓글은 「프로필 맨 위 링크」로 바꿔 주세요.\n두 번째 주 문구의 물 온도는 90도로, 올리는 날은 하루 미뤄 주세요.' },
  ] });
const revised = await revise(before, { variants: [
  { ...firstIg, text: moruText, media: [moru1, moru3], options: { ...firstIg.options, firstComment: '원두 이야기는 프로필 맨 위 링크에서 볼 수 있어요.' },
    copyVariants: firstIg.copyVariants.map(copy => ({ ...copy, text: copy.text.replace('92도', '90도') })) },
  firstFb,
] }, [[day(4, 12), ['moru-ig', 'moru-fb']]]);

console.log(JSON.stringify({ base: origin + '/social-review', links: { daily, customer, approved, optional, long, revoked, revised, before, notoken: origin + '/social-review' }, directory }));
