// 첫 실행의 첫 칸 · 화면 언어 고르기(2026-10-19 확정: 언어 고르기 → 「한글을 읽을 수 있어요?」 → 튜터 고르기).
// 언어 이름은 그 언어 글자로 쓰고(English · Монгол · 한국어), 주소의 ?lang=이나 기기 언어 중 지원 언어를 미리 눌러 둔다.
// 지원하지 않는 기기 언어는 아무것도 누르지 않은 채로 둔다(조용히 영어로 간주하지 않는다). 누르는 대로 이 화면 글이 그 언어로 바뀌고,
// 「계속하기」를 눌러야 저장된다(이 기기 + 계정이면 onChoose가 계정 기록에). 설정의 「화면 언어」도 같은 setLang을 쓴다.
import {LANGS,LANG_NAMES,t,setLang,suggestedLang,currentLang,hasChosenLang} from './world-lang.mjs';

const GLOBE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg>';
const CHECK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

export function openLangPicker({home,then=null,onChoose=null}={}){
 let choice=suggestedLang(),active=true,busy=false;
 const content=()=>document.querySelector('#panel-content');
 const shown=()=>choice||currentLang();
 const options=()=>LANGS.map(code=>`<button type="button" class="lang-option" role="radio" lang="${code}" data-lang-choice="${code}" aria-checked="${code===choice}"><strong>${LANG_NAMES[code]}</strong><span class="lang-check">${CHECK}</span></button>`).join('');
 const html=()=>`<div class="lang-picker" data-lang-picker lang="${shown()}"><span class="lang-globe">${GLOBE}</span><p class="lang-lead" data-lang-text="lang.pick.lead">${t('lang.pick.lead',undefined,shown())}</p><div class="lang-options" role="radiogroup" aria-label="${t('lang.pick.group',undefined,shown())}">${options()}</div><div class="panel-actions"><button type="button" class="felt-button" data-lang-confirm ${choice?'':'disabled'}><span data-lang-button>${choice?t('lang.pick.continue',undefined,choice):t('lang.pick.none',undefined,shown())}</span> <span aria-hidden="true">→</span></button></div><p class="panel-note" data-lang-text="lang.pick.note">${t('lang.pick.note',undefined,shown())}</p></div>`;
 // 고를 때마다 이 화면 글만 그 언어로 바꾼다(초점과 자리는 그대로).
 function preview(){
  const root=content()?.querySelector('[data-lang-picker]');if(!root)return;
  const lang=shown();root.lang=lang;
  document.querySelector('#panel-title').textContent=t('lang.pick.title',undefined,lang);
  for(const node of root.querySelectorAll('[data-lang-text]'))node.textContent=t(node.dataset.langText,undefined,lang);
  root.querySelector('.lang-options').setAttribute('aria-label',t('lang.pick.group',undefined,lang));
  for(const button of root.querySelectorAll('[data-lang-choice]'))button.setAttribute('aria-checked',String(button.dataset.langChoice===choice));
  const confirm=root.querySelector('[data-lang-confirm]');confirm.disabled=!choice||busy;
  confirm.querySelector('[data-lang-button]').textContent=choice?t('lang.pick.continue',undefined,choice):t('lang.pick.none',undefined,lang);
 }
 async function confirm(){
  if(!choice||busy||!active)return;busy=true;preview();
  const lang=choice;
  setLang(lang);
  try{await onChoose?.(lang);}catch(error){console.warn('Language save failed',error);}
  busy=false;active=false;then?.();
 }
 function click(event){
  if(!active)return;const root=content()?.querySelector('[data-lang-picker]');if(!root?.contains(event.target))return;
  const option=event.target.closest('[data-lang-choice]');
  if(option){choice=option.dataset.langChoice;preview();return;}
  if(event.target.closest('[data-lang-confirm]'))void confirm();
 }
 // 라디오 묶음: ←/→·↑/↓로 고른다.
 function key(event){
  if(!active||!event.target.closest?.('[data-lang-choice]'))return;
  const step={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];if(!step)return;
  event.preventDefault();const index=(LANGS.indexOf(choice||LANGS[0])+step+LANGS.length)%LANGS.length;choice=LANGS[index];preview();
  content()?.querySelector(`[data-lang-choice="${choice}"]`)?.focus({preventScroll:true});
 }
 home.showPanel(t('lang.pick.title',undefined,shown()),html(),{type:'lang',eyebrow:'LANGUAGE'});
 document.addEventListener('click',click);document.addEventListener('keydown',key);
 home.attachPanelResource({dispose(){active=false;document.removeEventListener('click',click);document.removeEventListener('keydown',key);}});
 content()?.querySelector(choice?`[data-lang-choice="${choice}"]`:'[data-lang-choice]')?.focus({preventScroll:true});
 return true;
}

// 첫 실행에서만 묻는다: 이미 고른 언어가 있으면(이 기기 또는 계정에서 되살린 값) 바로 다음 칸으로 간다.
export function ensureLang({home,then=null,onChoose=null,force=false}={}){
 if(hasChosenLang()&&!force){then?.();return false;}
 return openLangPicker({home,then,onChoose});
}

// 설정 시트의 「화면 언어」 묶음(화면 방향과 같은 알약 셋). 바꾸면 onChange(언어)를 부른다.
export function langSettingsMarkup(){
 const lang=currentLang();
 return `<fieldset class="orientation-settings lang-settings"><legend>${t('lang.settings.title')}</legend><div class="orientation-options lang-setting-options">${LANGS.map(code=>`<label lang="${code}"><input type="radio" name="world-lang" value="${code}" ${code===lang?'checked':''}><span>${LANG_NAMES[code]}</span></label>`).join('')}</div><p class="orientation-help">${t('lang.settings.note')}</p></fieldset>`;
}
