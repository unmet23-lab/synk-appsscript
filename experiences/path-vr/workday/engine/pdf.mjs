/** A PDF of A4 pages, one JPEG each, written by hand so the record needs no server and no library.
 * Text is part of the picture (not selectable) because a learner may write in any script; the
 * on-screen paper printed with the browser is the copy whose letters stay selectable.
 * The learner's own typed words never leave the device. */
const A4 = Object.freeze({ width: 595.28, height: 841.89 });
const ascii = (text) => Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff);
/** PDF text string as UTF-16BE hex, so a Korean title survives every reader. */
function hexText(value) {
  let hex = 'FEFF';
  for (const unit of String(value)) for (let index = 0; index < unit.length; index++) hex += unit.charCodeAt(index).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}
function pdfDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `D:${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/** imagePdf({ pages: [{ jpeg, width, height }, …], title, date }). A single page may be passed flat. */
export function imagePdf({ pages, jpeg, width, height, title = '', date = new Date() } = {}) {
  const sheets = Array.isArray(pages) ? pages : [{ jpeg, width, height }];
  if (!sheets.length || sheets.length > 8) throw new RangeError('쪽은 1~8장이에요.');
  for (const sheet of sheets) {
    if (!(sheet?.jpeg instanceof Uint8Array) || sheet.jpeg.length < 4 || sheet.jpeg[0] !== 0xff || sheet.jpeg[1] !== 0xd8) throw new TypeError('JPEG 바이트가 필요해요.');
    if (!Number.isInteger(sheet.width) || !Number.isInteger(sheet.height) || sheet.width <= 0 || sheet.height <= 0) throw new RangeError('그림 크기가 필요해요.');
  }
  const content = ascii(`q ${A4.width} 0 0 ${A4.height} 0 0 cm /Im0 Do Q`);
  // Objects: 1 catalog, 2 pages, 3 info, then page / image / content for each sheet.
  const pageId = (index) => 4 + index * 3;
  const objects = [
    [ascii('<< /Type /Catalog /Pages 2 0 R >>')],
    [ascii(`<< /Type /Pages /Kids [${sheets.map((_, index) => `${pageId(index)} 0 R`).join(' ')}] /Count ${sheets.length} >>`)],
    [ascii(`<< /Title ${hexText(title)} /Producer ${hexText('SYNK PATH')} /CreationDate (${pdfDate(date)}) >>`)],
  ];
  sheets.forEach((sheet, index) => {
    const id = pageId(index);
    objects.push(
      [ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`)],
      [ascii(`<< /Type /XObject /Subtype /Image /Width ${sheet.width} /Height ${sheet.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${sheet.jpeg.length} >>\nstream\n`), sheet.jpeg, ascii('\nendstream')],
      [ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii('\nendstream')],
    );
  });
  const parts = [ascii('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
  const offsets = [];
  let length = parts[0].length;
  const push = (bytes) => { parts.push(bytes); length += bytes.length; };
  objects.forEach((chunks, index) => {
    offsets.push(length);
    push(ascii(`${index + 1} 0 obj\n`));
    for (const chunk of chunks) push(chunk);
    push(ascii('\nendobj\n'));
  });
  const xref = length;
  push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const output = new Uint8Array(length);
  let cursor = 0;
  for (const part of parts) { output.set(part, cursor); cursor += part.length; }
  return output;
}
