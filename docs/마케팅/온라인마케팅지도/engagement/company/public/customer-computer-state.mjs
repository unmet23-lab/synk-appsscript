// Customer-page state only. Canonical Core and computer adapters own all
// interpretation/recommendation logic; this module has no storage or network.
export function createCustomerComputerState({createInterpretation,createConsultation,Interpretation,Ask,content,rules}) {
  const make=()=>createInterpretation({Interpretation,content});
  let interpretation=make();
  const consultation=createConsultation({Ask,content,rules});
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  function restore(document) {
    if(!document||document.version!==1||typeof document.text!=='string'||document.text.length>4000||!document.answers||typeof document.answers!=='object'||Array.isArray(document.answers)
      ||Object.keys(document).some(key=>!['version','text','answers'].includes(key)))throw Error('invalid-saved-consultation');
    const next=make();next.setText(document.text);
    const allowed=new Set();
    for(const step of content.steps)for(const field of step.type==='group'?step.fields:[step]){
      const about=step.type==='group'?step.id+'.'+field.id:step.id;allowed.add(about);
      // Empty uses is the default unanswered state, not a confirmed condition.
      if(Object.hasOwn(document.answers,about)&&!(about==='uses'&&Array.isArray(document.answers[about])&&document.answers[about].length===0))next.setManual(about,document.answers[about]);
    }
    if(Object.keys(document.answers).some(key=>!allowed.has(key))||canonical(next.snapshot().answers)!==canonical({uses:[],...document.answers}))throw Error('invalid-saved-conditions');
    interpretation=next;return snapshot();
  }
  function snapshot(){const source=interpretation.snapshot();return {source,next:consultation.choose(source.answers),result:source.answers.uses.length?consultation.compute(source.answers):null};}
  return Object.freeze({snapshot,restore,reset:()=>{interpretation=make();return snapshot();},
    serialize:()=>{const value=interpretation.snapshot();return {version:1,text:value.text,answers:value.answers};},
    text:value=>interpretation.setText(value),analyze:()=>interpretation.analyze(),review:(...args)=>interpretation.review(...args),
    manual:(...args)=>interpretation.setManual(...args),member:(...args)=>interpretation.setManualMember(...args),
    request:()=>interpretation.buildExtractionRequest(),ingest:value=>interpretation.ingest(value),
    catalog:()=>interpretation.catalog,summary:value=>consultation.summary(value)});
}
