import { validateAlbum, serializeAlbum, QUESTIONS, RECIPE_QUESTIONS } from './model.mjs';
import { BOOK_FONT_CSS, BOOK_FONT_LICENSE } from '../member-book-assets.mjs';

export const ARCHIVE_NAME = 'synk-family-album.zip';
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
const utf8 = new TextEncoder();
const EXTENSIONS = Object.freeze({ 'image/jpeg':'jpg', 'image/png':'png', 'image/webp':'webp', 'audio/mpeg':'mp3', 'audio/wav':'wav', 'audio/ogg':'ogg', 'audio/webm':'webm', 'audio/mp4':'m4a' });
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = index => String(index + 1).padStart(3, '0');
const mediaPath = (index, kind, media) => `originals/page-${number(index)}-${kind}.${EXTENSIONS[media.type]}`;
const paragraphs = value => `<p class="book-prose">${escape(value)}</p>`;

// The same scoped rules serve the in-app preview and the standalone, offline book.
// Stories and memories are allowed to flow over multiple printed pages.
export const BOOK_CSS = `
.album-book{--book-ink:#10131a;--book-muted:#565a61;--book-line:#d6dbe3;--book-blue:#24448c;font-family:SUIT,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:var(--book-ink);background:#fff;line-height:1.8;overflow-wrap:anywhere;word-break:normal;text-align:left;font-size:16px;font-weight:400}
.album-book *{box-sizing:border-box}.album-book h1,.album-book h2,.album-book h3,.album-book p,.album-book figure,.album-book blockquote,.album-book dl,.album-book ol{margin:0}.album-book a{color:var(--book-blue);text-underline-offset:4px}.album-book a:focus-visible{outline:3px solid var(--book-blue);outline-offset:4px}
.album-book .book-cover,.album-book .book-toc,.album-book .book-page,.album-book .book-colophon{max-width:850px;margin:0 auto;padding:52px 48px}.album-book .book-cover{padding-top:76px;padding-bottom:64px;border-bottom:1px solid var(--book-line)}.album-book .book-brand,.album-book .book-eyebrow{font-family:"Inter Tight",SUIT,sans-serif;font-size:12px;line-height:1.5;letter-spacing:.1em;font-weight:700;color:var(--book-muted)}.album-book h1{font-size:clamp(36px,7vw,62px);line-height:1.2;letter-spacing:-.055em;margin:40px 0 24px;font-weight:800;word-break:keep-all}.album-book .book-intro{max-width:35em;font-size:18px}.album-book .book-count{margin-top:36px;font-weight:700;color:var(--book-blue)}.album-book .book-print-help{margin-top:20px;font-size:13px;color:var(--book-muted)}.album-book .book-toc h2{font-size:22px;margin-bottom:20px}.album-book .book-toc ol{padding-left:24px}.album-book .book-toc li{padding:8px 0}.album-book .book-toc time{display:block;font-size:13px;color:var(--book-muted)}
.album-book .book-page{border-top:1px solid var(--book-line);padding-top:48px;padding-bottom:56px}.album-book .book-page h2{font-size:clamp(28px,5vw,42px);line-height:1.3;letter-spacing:-.045em;font-weight:800;margin:14px 0 18px;word-break:keep-all}.album-book .book-meta{display:flex;flex-wrap:wrap;gap:5px 20px;color:var(--book-muted);font-size:14px;margin-bottom:26px}.album-book .book-photo{margin:28px 0}.album-book .book-photo img{display:block;width:auto;max-width:100%;height:auto;max-height:560px;object-fit:contain;margin:0 auto}.album-book figcaption{margin-top:9px;font-size:12px;color:var(--book-muted)}.album-book .book-prose{white-space:pre-wrap;line-height:1.95;orphans:3;widows:3}.album-book .book-section{margin-top:30px}.album-book .book-section h3{font-size:17px;line-height:1.5;font-weight:800;margin-bottom:12px}.album-book .book-answer,.album-book .book-memory,.album-book .book-attempt{padding:16px 0;border-top:1px solid var(--book-line)}.album-book .book-answer dt,.album-book .book-memory cite,.album-book .book-attempt time{display:block;font-style:normal;font-size:14px;font-weight:700;margin-bottom:6px}.album-book .book-answer dd{margin:0}.album-book .book-source{font-size:12px;color:var(--book-muted);margin-top:8px}.album-book audio{display:block;width:100%;max-width:480px;height:48px;margin:12px 0}.album-book .book-audio-path{font-size:12px;color:var(--book-muted)}.album-book .book-recipe-meta{font-size:14px;line-height:1.8;margin:18px 0}.album-book .book-recipe-status{font-size:14px;color:var(--book-muted);margin-top:12px}.album-book .book-colophon{border-top:1px solid var(--book-line);font-size:13px;color:var(--book-muted)}.album-book .book-colophon p+p{margin-top:10px}.album-book .book-print-only{display:none}
@media(max-width:600px){.album-book .book-cover,.album-book .book-toc,.album-book .book-page,.album-book .book-colophon{padding:32px 22px}.album-book .book-cover{padding-top:48px}.album-book .book-intro{font-size:16px}.album-book .book-meta{display:block}.album-book .book-meta span{display:block}.album-book .book-photo img{max-height:420px}}
@media print{.album-book{font-size:10.5pt;line-height:1.75}.album-book .book-cover,.album-book .book-toc,.album-book .book-page,.album-book .book-colophon{max-width:none;margin:0;padding:0;border:0}.album-book .book-cover{break-after:page;padding-top:35mm}.album-book h1{font-size:38pt}.album-book .book-toc{break-after:page}.album-book .book-toc h2{font-size:20pt}.album-book .book-page{break-before:page}.album-book .book-page h2{font-size:25pt;break-after:avoid}.album-book h3,.album-book dt,.album-book cite,.album-book .book-eyebrow,.album-book .book-meta{break-after:avoid}.album-book .book-meta{margin-bottom:6mm}.album-book .book-photo{break-inside:avoid;margin:7mm 0}.album-book .book-photo img{max-height:115mm;max-width:100%;width:auto;object-fit:contain}.album-book .book-section{margin-top:7mm}.album-book .book-prose,.album-book .book-answer,.album-book .book-memory,.album-book .book-attempt{break-inside:auto;overflow:visible;max-height:none}.album-book .book-answer,.album-book .book-memory,.album-book .book-attempt{padding:4mm 0}.album-book audio,.album-book .book-print-help,.album-book .book-screen-only{display:none!important}.album-book .book-print-only{display:block}.album-book .book-colophon{break-before:page;padding-top:20mm}.album-book a{color:inherit;text-decoration:none}.album-book .book-toc li{break-inside:avoid}}
@page{size:A4;margin:18mm 18mm 20mm}
`;

function mode(options) {
  const value = options?.mediaMode ?? 'embedded';
  if (value !== 'embedded' && value !== 'files') throw new Error('책의 파일 보관 방식을 확인해 주세요.');
  return value;
}

function recipeContent(page) {
  if (!page.recipe) return '';
  const recipe = page.recipe;
  const latest = recipe.attempts.reduce((stamp, item) => Math.max(stamp, Date.parse(item.createdAt)), 0);
  const changed = latest && Date.parse(recipe.revisedAt) > latest;
  return `<section class="book-section"><h3>우리 집 손맛</h3>
    <div class="book-recipe-meta">${recipe.learnedFrom ? `<p>배운 사람 · ${escape(recipe.learnedFrom)}</p>` : ''}${recipe.servings ? `<p>분량 · ${escape(recipe.servings)}</p>` : ''}</div>
    <div class="book-section"><h3>재료</h3>${paragraphs(recipe.ingredients || '아직 남기지 않았어요.')}</div>
    <div class="book-section"><h3>만드는 순서</h3>${paragraphs(recipe.steps || '아직 남기지 않았어요.')}</div>
    <p class="book-recipe-status">${recipe.attempts.length ? `직접 만들어 본 기록 ${recipe.attempts.length}번${changed ? ' · 마지막 기록 뒤 레시피를 수정했어요.' : ''}` : '아직 직접 만들어 본 기록이 없어요.'}</p>
    ${recipe.attempts.length ? `<section class="book-section"><h3>만들어 보며 알게 된 것</h3>${recipe.attempts.map(attempt => `<div class="book-attempt"><time datetime="${escape(attempt.date)}">${escape(attempt.date)}</time>${paragraphs(attempt.note)}</div>`).join('')}</section>` : ''}
  </section>`;
}

function pageContent(page, index, mediaMode, mediaUrl) {
  const details = [...QUESTIONS, ...RECIPE_QUESTIONS].filter(question => Object.hasOwn(page.details, question.id));
  const source = (kind, media) => {
    if (mediaMode === 'files') return mediaPath(index, kind, media);
    if (!mediaUrl) return media.data;
    const url = mediaUrl(media,kind,index);
    if (typeof url !== 'string' || !(url === media.data || url.startsWith('blob:'))) throw new Error('미리보기 파일 주소를 확인해 주세요.');
    return url;
  };
  const audioPath = page.audio ? mediaPath(index, 'audio', page.audio) : '';
  return `<article class="book-page" id="story-${number(index)}" aria-labelledby="title-${number(index)}">
    <p class="book-eyebrow">${number(index)} / ${page.recipe ? '우리 집 손맛' : '가족 이야기'}</p>
    <h2 id="title-${number(index)}">${escape(page.title)}</h2>
    <div class="book-meta">${page.date ? `<span><time datetime="${escape(page.date)}">${escape(page.date)}</time></span>` : ''}${page.person ? `<span>함께한 사람 · ${escape(page.person)}</span>` : ''}<span>기록한 사람 · ${escape(page.author)}</span></div>
    ${page.photo ? `<figure class="book-photo"><img src="${escape(source('photo', page.photo))}" alt="${escape(page.title)}에 남긴 사진"><figcaption>사진 원본 · ${escape(page.photo.name)}</figcaption></figure>` : ''}
    ${paragraphs(page.story)}
    ${recipeContent(page)}
    ${details.length ? `<section class="book-section"><h3>더 남겨 둔 이야기</h3><dl>${details.map(question => `<div class="book-answer"><dt>${escape(question.label)}</dt><dd>${paragraphs(page.details[question.id])}</dd></div>`).join('')}</dl></section>` : ''}
    ${page.audio ? `<section class="book-section"><h3>그때의 목소리</h3><audio controls preload="none" src="${escape(source('audio', page.audio))}">이 브라우저에서 음성을 들을 수 없다면 원본 파일을 열어 주세요.</audio><p class="book-source">원본 파일 · ${escape(page.audio.name)}</p><p class="book-audio-path">소장 묶음의 음성 위치: ${escape(audioPath)}</p><p class="book-print-only book-source">목소리는 소장 묶음의 원본 음성 파일로 함께 보관해 주세요.</p></section>` : ''}
    ${page.contributions.length ? `<section class="book-section"><h3>함께 덧붙인 기억</h3>${page.contributions.map(memory => `<blockquote class="book-memory"><cite>${escape(memory.name)}</cite>${paragraphs(memory.text)}<p class="book-source">남긴 날 · ${escape(memory.createdAt.slice(0,10))}</p></blockquote>`).join('')}</section>` : ''}
  </article>`;
}

function content(validated, mediaMode, mediaUrl) {
  const recipes = validated.pages.filter(page => page.recipe).length;
  return `<div class="album-book">
    <header class="book-cover"><p class="book-brand">SYNK · FAMILY STORIES</p><h1>우리 가족의<br>이야기</h1><p class="book-intro">함께한 날의 이야기와 목소리.<br>우리의 말로 남겨, 오래 꺼내 보는 책.</p><p class="book-count">이야기 ${validated.pages.length}장${recipes ? ` · 우리 집 손맛 ${recipes}장 포함` : ''}</p><p class="book-print-help">브라우저의 인쇄 메뉴에서 종이에 인쇄하거나 PDF로 저장할 수 있어요. 음성은 화면에서 듣거나 소장 묶음의 원본 파일로 간직해 주세요.</p></header>
    ${validated.pages.length ? `<nav class="book-toc" aria-label="이야기 목차"><h2>이 책에 담긴 이야기</h2><ol>${validated.pages.map((page,index) => `<li><a href="#story-${number(index)}">${escape(page.title)}</a>${page.date ? `<time datetime="${escape(page.date)}">${escape(page.date)}</time>` : ''}</li>`).join('')}</ol></nav>` : '<section class="book-toc"><h2>첫 이야기가 기다리고 있어요.</h2></section>'}
    ${validated.pages.map((page,index) => pageContent(page,index,mediaMode,mediaUrl)).join('')}
    <footer class="book-colophon"><p>이 책은 가족이 직접 남긴 글과 사진, 목소리로 만들었습니다. 덧붙인 기억은 기록한 사람의 이름과 함께 담았습니다.</p><p>종이와 PDF에는 음성이 재생되지 않습니다. 소장 묶음의 index.html과 originals 폴더를 함께 보관하면 SYNK에 접속하지 않고도 이야기와 원음을 열 수 있습니다.</p><p>synk-family-album.json은 앨범에 다시 불러올 수 있는 복원 파일입니다. 이 파일과 원본에는 가족의 개인적인 기록이 담겨 있으니 함께 받을 사람에게만 전달해 주세요.</p><p>SYNK · 가족 이야기 앨범</p></footer>
  </div>`;
}

export function renderAlbumBookContent(album, options = {}) {
  return content(validateAlbum(album), mode(options), options.mediaUrl);
}

function documentHtml(validated, mediaMode) {
  // Offline file URLs are permitted only for generated relative originals. No
  // active content, network, forms, frames, plugins or base-URL changes are used.
  const policy = "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data: file:; media-src data: file:; font-src data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1"><title>우리 가족의 이야기 · SYNK</title><style>${BOOK_FONT_CSS}\nhtml,body{margin:0;padding:0;background:#fff}\n${BOOK_CSS}</style></head><body>${content(validated, mediaMode)}</body></html>`;
}

export function renderAlbumBook(album, options = {}) {
  return documentHtml(validateAlbum(album), mode(options));
}

const CRC_TABLE = Uint32Array.from({length:256}, (_,index) => {
  let value = index;
  for(let bit=0;bit<8;bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(bytes) {
  let value = 0xffffffff;
  for (let i=0;i<bytes.length;i++) value = CRC_TABLE[(value ^ bytes[i]) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function mediaData(media) {
  const binary = atob(media.data.slice(media.data.indexOf(',') + 1));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function checkSignal(signal) {
  if (signal?.aborted) throw new Error('소장 묶음 만들기를 취소했어요.');
}

// ZIP format, stored entries (method 0), UTF-8 names and CRC32. No dependency,
// compression worker, remote script or filename supplied by the album is used.
function storeZip(entries, maximum) {
  let localSize = 0, directorySize = 0;
  const prepared = entries.map(entry => {
    const name = utf8.encode(entry.name);
    const result = {...entry,nameBytes:name,crc:crc32(entry.bytes),offset:localSize};
    localSize += 30 + name.length + entry.bytes.length;
    directorySize += 46 + name.length;
    return result;
  });
  const total = localSize + directorySize + 22;
  if (total > maximum) throw new Error('소장 묶음은 64 MB까지 만들 수 있어요. 앨범을 나누어 보관해 주세요.');
  const result = new Uint8Array(total), view = new DataView(result.buffer);
  const u16 = (offset,value) => view.setUint16(offset,value,true);
  const u32 = (offset,value) => view.setUint32(offset,value,true);
  let central = localSize;
  for (const entry of prepared) {
    const {nameBytes,bytes,crc,offset} = entry;
    u32(offset,0x04034b50);u16(offset+4,20);u16(offset+6,0x800);u16(offset+8,0);u16(offset+10,0);u16(offset+12,33);
    u32(offset+14,crc);u32(offset+18,bytes.length);u32(offset+22,bytes.length);u16(offset+26,nameBytes.length);u16(offset+28,0);
    result.set(nameBytes,offset+30);result.set(bytes,offset+30+nameBytes.length);
    u32(central,0x02014b50);u16(central+4,20);u16(central+6,20);u16(central+8,0x800);u16(central+10,0);u16(central+12,0);u16(central+14,33);
    u32(central+16,crc);u32(central+20,bytes.length);u32(central+24,bytes.length);u16(central+28,nameBytes.length);u16(central+30,0);u16(central+32,0);u16(central+34,0);u16(central+36,0);u32(central+38,0);u32(central+42,offset);
    result.set(nameBytes,central+46);central += 46+nameBytes.length;
  }
  u32(central,0x06054b50);u16(central+4,0);u16(central+6,0);u16(central+8,entries.length);u16(central+10,entries.length);u32(central+12,directorySize);u32(central+16,localSize);u16(central+20,0);
  return result;
}

const READ_ME = `우리 가족의 이야기 — 소장 묶음\n\n1. ZIP 파일을 먼저 압축 해제해 주세요.\n2. 압축을 푼 폴더의 index.html을 브라우저로 열면 이야기책을 볼 수 있습니다. SYNK 로그인이나 인터넷 연결이 필요하지 않습니다.\n3. 브라우저의 인쇄 메뉴에서 PDF로 저장하거나 종이에 인쇄할 수 있습니다. 용지는 A4, 배율은 기본값을 권장합니다.\n4. 음성은 HTML 책의 재생 버튼으로 듣습니다. 브라우저가 해당 형식을 지원하지 않으면 originals 폴더의 음성 원본을 기기의 재생 앱으로 열어 주세요. 종이와 PDF에는 음성이 재생되지 않습니다.\n5. originals 폴더에는 올린 사진과 음성을 원본 바이트 그대로 담았습니다. 안전하게 열도록 파일명만 페이지 순서에 맞춰 바꾸었으며 원래 파일명은 책과 복원 파일에 남겼습니다.\n6. synk-family-album.json을 가족 이야기 앨범에서 불러오면 기록을 다시 편집할 수 있습니다. 글·질문 답변·덧붙인 기억·손맛 기록·사진·음성이 함께 들어 있습니다.\n7. index.html과 originals 폴더는 같은 폴더 안에 함께 보관해 주세요. 필요한 사람에게 묶음 전체를 전달해야 원음도 열립니다.\n\n기록은 사용자가 직접 남긴 내용이며, 손맛의 시도 기록은 현재 레시피의 완성도나 안전성을 보증하지 않습니다.\n이 묶음에는 가족의 사진·목소리·개인적인 기록이 들어 있습니다. 함께 받을 사람에게만 전달해 주세요.\n\n서체 라이선스: FONT-LICENSE.txt\nSYNK · 가족 이야기 앨범\n`;

export async function buildAlbumArchive(album, options = {}) {
  checkSignal(options.signal);
  const validated = validateAlbum(album);
  const requested = options.maxBytes ?? MAX_ARCHIVE_BYTES;
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > MAX_ARCHIVE_BYTES) throw new Error('소장 묶음의 파일 크기 제한을 확인해 주세요.');
  const entries = [
    {name:'index.html',bytes:utf8.encode(documentHtml(validated,'files'))},
    {name:'synk-family-album.json',bytes:utf8.encode(serializeAlbum(validated))},
    {name:'읽어주세요.txt',bytes:utf8.encode(READ_ME)},
    {name:'FONT-LICENSE.txt',bytes:utf8.encode(BOOK_FONT_LICENSE)},
  ];
  for(let index=0;index<validated.pages.length;index++) {
    const page = validated.pages[index];
    for(const kind of ['photo','audio']) if(page[kind]) entries.push({name:mediaPath(index,kind,page[kind]),bytes:mediaData(page[kind])});
    checkSignal(options.signal);
    await Promise.resolve();
  }
  checkSignal(options.signal);
  return {bytes:storeZip(entries,requested),filename:ARCHIVE_NAME,mime:'application/zip'};
}
