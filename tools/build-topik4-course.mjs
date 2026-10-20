// Only fictional authored questions enter the product bundle. Answer keys stay
// server-side and are released by the classroom service after submission.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8').replace(/\r\n/g,'\n');
export function courseFromMarkdown(writing,reading){
 // Splitting headings also keeps the final chapter, without a sentinel in the source.
 const chapters=writing.split(/^## W(?=\d)/m).slice(1);
 const result=chapters.map(chapter=>{
  const [header,...lines]=chapter.split('\n'),week=Number(header[0]),body=lines.join('\n');
  const questions=[...body.matchAll(/^\*\*(?:문제(?: \d)?\.|5[1-4]\.)\*\*[\s\S]*?(?=^\*\*(?:예시답|개요 예시|서론 예시답|고쳐 쓰기 시범)|^<a id=|$(?![\s\S]))/gm)].map(m=>m[0].trim());
  if(week===2){const spoken=[...body.matchAll(/^\| ([^|]+) \| [^|]+ \|$/gm)].map(m=>m[1]).filter(v=>v!=='말하는 문장');questions.push('다음 문장을 글(「-다」체)로 바꾸십시오.\n'+spoken.join('\n'));}
  const title=`W${header}`,prompt=questions.join('\n\n').replace(/<a[^>]*><\/a>/g,'').trim();
  if(!prompt)throw Error(`Missing W${week}`);
  return {week,title,prompt,reading:[]};
 });
 if(result.length!==8)throw Error('Eight writing weeks required');
 const passages=new Map();
 for(const match of reading.matchAll(/^### (R(\d)-(\d)) · ([^\n]+)\n([\s\S]*?)(?=^### |^## \d|$(?![\s\S]))/gm)){
  const [,,week,,title,body]=match,parts=body.split('**정답:**'),answer=parts[1]?.match(/^[ \t]*([①②③④])/),question=parts[0].replace(/<a[^>]*><\/a>/g,'').trim();
  if(!answer)throw Error('Reading answer missing '+match[1]);
  const quoted=question.split('\n').filter(l=>l.startsWith('> ')).join('\n');
  if(quoted)passages.set(match[1],quoted);
  const resolved=question.replace(/\((R\d-\d)과 같은 지문\)/g,(_,id)=>{if(!passages.has(id))throw Error('Unknown reading passage '+id);return passages.get(id);});
  result[Number(week)-1].reading.push({id:match[1],title,prompt:resolved,answer:'①②③④'.indexOf(answer[1])+1,explanation:parts[1].replace(/^[ \t]*[①②③④]\s*/,'').trim()});
 }
 if(result.some(w=>w.reading.length!==5))throw Error('Five reading questions per week required');
 // W6 refers to W5; always include its exact task context in a standalone screen.
 result[5].prompt+='\n\nW5 주제와 질문:\n'+result[4].prompt;
 return result;
}
const target=new URL('experiences/teacher-world/topik4-course.json',root);
export function build(){return JSON.stringify(courseFromMarkdown(read('docs/온라인반_TOPIK4급/쓰기과제.md'),read('docs/온라인반_TOPIK4급/읽기연습.md')),null,2)+'\n';}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const output=build();if(process.argv.includes('--check')){if(readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==output)throw Error('Stale TOPIK4 course');}else writeFileSync(target,output);
 console.log('TOPIK4 course source and generated questions agree.');
}
