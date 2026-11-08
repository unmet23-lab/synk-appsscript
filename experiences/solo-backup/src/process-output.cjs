'use strict';
const { StringDecoder } = require('node:string_decoder');
class ProcessOutput {
  constructor({ structured, progress = () => {}, overflow = () => {} }) { this.structured = structured; this.progress = progress; this.overflow = overflow; this.decoder = new StringDecoder('utf8'); this.text = ''; this.line = ''; }
  accept(bytes) {
    const chunk = this.decoder.write(bytes);
    if (this.structured) { this.text += chunk; if (this.text.length > 16 * 1024 * 1024) { this.text = ''; this.overflow(); } return; }
    this.text = (this.text + chunk).slice(-65536);
    this.line += chunk;
    const lines = this.line.split('\n'); this.line = lines.pop().slice(-65536);
    for (const line of lines) { try { const p = JSON.parse(line); if (p.message_type === 'status' && Number.isFinite(p.percent_done)) this.progress(Math.round(p.percent_done * 100)); } catch {} }
  }
  end() { this.text += this.decoder.end(); return this.text; }
}
module.exports = { ProcessOutput };
