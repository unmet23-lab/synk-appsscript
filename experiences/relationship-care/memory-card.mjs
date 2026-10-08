import { memoryTheme as theme } from './memory-theme.mjs';

const text = (value, max, label, required = false) => {
  if (value != null && typeof value !== 'string') throw new Error(`${label}을 확인해 주세요.`);
  const result = (value || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (result.length > max) throw new Error(`${label}은 ${max}자까지 담을 수 있어요. 짧게 발췌해 주세요.`);
  if (required && !result) throw new Error(`${label}을 적어 주세요.`);
  return result;
};
const actions = { contact: '연락한 날', attend: '함께한 날', gift: '선물을 나눈 날', money: '마음을 나눈 날', remember: '기억한 날' };

/** A deliberate, bounded export. Never serializes the person, sources or account. */
export function memoryCardContent({ person, memories = [], activities = [], title = '', message = '' } = {}) {
  if (!person?.id) throw new Error('카드를 전할 사람을 선택해 주세요.');
  if (!Array.isArray(memories) || !Array.isArray(activities) || memories.length + activities.length < 1 || memories.length + activities.length > 3) throw new Error('카드에 담을 기억을 1~3개 골라 주세요.');
  const seen = new Set();
  const items = [
    ...memories.map(item => ({ item, kind: 'memory', label: '남겨 둔 기억', body: item?.text })),
    ...activities.map(item => ({ item, kind: 'activity', label: `${item?.occurredOn || ''} · ${actions[item?.kind] || '함께한 기록'}`, body: item?.note })),
  ].map(({ item, kind, label, body }) => {
    if (!item?.id || item.personId !== person.id) throw new Error('다른 사람의 기억이 섞여 있어요. 선택을 확인해 주세요.');
    const key = `${kind}:${item.id}`;
    if (seen.has(key)) throw new Error('같은 기억은 한 번만 담아 주세요.');
    seen.add(key);
    if (kind === 'activity' && !/^\d{4}-\d{2}-\d{2}$/.test(item.occurredOn)) throw new Error('챙긴 날짜를 확인해 주세요.');
    return { label, text: text(body, 240, '카드에 담을 기억', true) };
  });
  return { name: text(person.name, 80, '이름', true), title: text(title, 60, '제목') || '함께한 순간을 기억해요', message: text(message, 300, '전하고 싶은 말'), items };
}

function linesFor(context, value, maxWidth) {
  // Preserve explicit line breaks and Unicode grapheme clusters, including emoji.
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ko', { granularity: 'grapheme' }) : null;
  return value.split('\n').flatMap(paragraph => {
    const chars = segmenter ? [...segmenter.segment(paragraph)].map(entry => entry.segment) : [...paragraph];
    const lines = []; let line = '';
    for (const character of chars) {
      if (line && context.measureText(line + character).width > maxWidth) { lines.push(line.trimEnd()); line = character.trimStart(); }
      else line += character;
    }
    lines.push(line); return lines;
  });
}

function asset(name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('카드 이미지를 불러오지 못했어요. 화면을 새로 열어 주세요.'));
    image.src = new URL(`assets/${name}`, import.meta.url).href;
  });
}

async function readPhoto(file) {
  if (!file) return null;
  if (!(file instanceof Blob) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('사진은 PNG·JPG·WebP 형식의 10MB 이하 파일로 골라 주세요.');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('사진을 읽지 못했어요. 다른 사진을 골라 주세요.'); }
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 24_000_000) { bitmap.close(); throw new Error('사진은 2,400만 화소 이하로 골라 주세요.'); }
  return bitmap;
}

/** Browser-only PNG: selected photo stays in memory and is never uploaded. */
export async function createMemoryCard(input) {
  const content = memoryCardContent(input);
  const photo = await readPhoto(input.photoFile);
  try {
    await document.fonts.load('500 40px SUIT');
    await document.fonts.load('800 64px SUIT');
    const [envelope, stitch, logo] = await Promise.all([asset('sticker-envelope.webp'), asset('thread-shift.webp'), asset('synk-logo.svg')]);
    const width = 1080, margin = theme.spaces['켜'] * 2, column = width - margin * 2;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('이 브라우저에서 카드 이미지를 만들 수 없어요.');
    const blocks = [];
    const add = (value, size, weight, gap, color = theme.colors.ink) => {
      context.font = `${weight} ${size}px SUIT, sans-serif`;
      const lines = linesFor(context, value, column);
      blocks.push({ lines, size, weight, gap, color, height: lines.length * size * 1.55 });
    };
    add(`${content.name}에게`, 28, 700, theme.spaces['단'], theme.colors.accent);
    add(content.title, 64, 800, theme.spaces['켜']);
    if (photo) blocks.push({ photo: true, height: Math.min(620, column * photo.height / photo.width), gap: theme.spaces['켜'] });
    for (const item of content.items) {
      add(item.label, 25, 700, theme.spaces['칸'], theme.colors.accent);
      add(item.text, 38, 500, theme.spaces['켜']);
    }
    if (content.message) add(content.message, 38, 700, theme.spaces['켜']);
    const startY = 265;
    const height = Math.max(1350, Math.ceil(startY + blocks.reduce((sum, block) => sum + block.height + block.gap, 0) + 145));
    if (height > 4400) throw new Error('카드가 너무 길어요. 기억이나 전하고 싶은 말을 조금 줄여 주세요.');
    canvas.height = height;
    context.fillStyle = theme.colors.paper; context.fillRect(0, 0, width, height);
    context.drawImage(logo, margin, 48, 160, 160 * logo.naturalHeight / logo.naturalWidth);
    context.drawImage(envelope, width - margin - 130, 56, 130, 130);
    // Repeat a complete straight stitch at its original aspect ratio. The source
    // is a square frame; squeezing it to a rule would flatten/cut its fibres.
    const stitchLine = y => {
      const step = theme.spaces['단'] * 2 + theme.spaces['틈'], count = Math.floor(column / step), tile = 48;
      const left = margin + (column - ((count - 1) * step + tile)) / 2;
      for (let n = 0; n < count; n++) context.drawImage(stitch, stitch.naturalWidth * 280 / 1280, stitch.naturalHeight * 85 / 1280,
        stitch.naturalWidth * 95 / 1280, stitch.naturalHeight * 63 / 1280, left + n * step, y, tile, tile * 63 / 95);
    };
    stitchLine(193);
    let y = startY;
    context.textBaseline = 'top';
    for (const block of blocks) {
      if (block.photo) {
        const ratio = Math.min(column / photo.width, block.height / photo.height);
        const w = photo.width * ratio, h = photo.height * ratio;
        context.drawImage(photo, margin + (column - w) / 2, y, w, h);
      } else {
        context.font = `${block.weight} ${block.size}px SUIT, sans-serif`; context.fillStyle = block.color;
        block.lines.forEach((line, index) => context.fillText(line, margin, y + index * block.size * 1.55));
      }
      y += block.height + block.gap;
    }
    stitchLine(height - 128);
    context.font = '500 23px SUIT, sans-serif'; context.fillStyle = theme.colors.accent;
    context.fillText('기억을 꺼내 전하는 마음 · SYNK 플레저', margin, height - 73);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('카드를 저장하지 못했어요. 다시 시도해 주세요.');
    return { blob, filename: 'synk-care-memory.png', width, height };
  } finally { photo?.close(); }
}
