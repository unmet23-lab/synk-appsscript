import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('./public/workspace-entry.js',import.meta.url),'utf8');

// The reset vectors below were checked in Chromium with real select elements.
// This fixture isolates the guard's handling of the browser-owned reset result;
// it does not implement another HTML selection/defaulting algorithm.
function fixture({selected,defaults,reset,multiple=false,size=0,externalForm=false}){
  const options=selected.map((value,index)=>Object.freeze({selected:value,defaultSelected:defaults[index]}));
  const field={tagName:'SELECT',type:multiple?'select-multiple':'select-one',multiple,size,options:Object.freeze(options),
    cloneNode(deep){
      assert.equal(deep,true);
      return {options:options.map(option=>({...option})),externalForm,
        removeAttribute(name){assert.equal(name,'form');this.externalForm=false;}};
    }};
  Object.freeze(field);
  class HTMLFormElement {
    appendChild(copy){assert.notEqual(copy,field);this.copy=copy;}
    reset(){
      assert.notEqual(this.copy,field);
      if(this.copy.externalForm)return;
      this.copy.options.forEach((option,index)=>{option.selected=reset[index];});
    }
  }
  const window=new EventTarget();
  const context=vm.createContext({window,Event,HTMLFormElement,
    document:{body:{classList:{contains:()=>false}},querySelectorAll:selector=>selector==='iframe'?[]:[{elements:[field]}],
      createElement(name){assert.equal(name,'form');return new HTMLFormElement();}}});
  vm.runInContext(source+'\n globalThis.selectGuard=workspaceEntryHasUnfinishedWork;',context);
  return {field,guard:()=>context.selectGuard()};
}

for(const [name,settings,dirty] of [
  ['implicit first selection in the untouched product form',{selected:[true,false],defaults:[false,false],reset:[true,false]},false],
  ['a changed selection without a selected attribute',{selected:[false,true],defaults:[false,false],reset:[true,false]},true],
  ['the saved explicit selection',{selected:[false,true],defaults:[false,true],reset:[false,true]},false],
  ['a change away from the saved explicit selection',{selected:[true,false],defaults:[false,true],reset:[false,true]},true],
  ['an empty multiple select',{selected:[false,false],defaults:[false,false],reset:[false,false],multiple:true},false],
  ['multiple selected defaults',{selected:[true,true],defaults:[true,true],reset:[true,true],multiple:true},false],
  ['a changed multiple selection',{selected:[true,false],defaults:[true,true],reset:[true,true],multiple:true},true],
  ['an unselected size greater than one listbox',{selected:[false,false],defaults:[false,false],reset:[false,false],size:3},false],
  ['implicit selection after disabled option and optgroup',{selected:[false,false,true],defaults:[false,false,false],reset:[false,false,true]},false],
  ['an explicitly selected disabled option',{selected:[false,true],defaults:[false,true],reset:[false,true]},false],
  ['a dynamic option selected without a declared saved default',{selected:[false,true],defaults:[false,false],reset:[true,false]},true],
  ['a select associated with an external form',{selected:[true,false],defaults:[false,false],reset:[true,false],externalForm:true},false],
])test('entry select guard preserves '+name,()=>{
  const f=fixture(settings),before=JSON.stringify(f.field);
  assert.equal(f.guard(),dirty);
  assert.equal(JSON.stringify(f.field),before,'guard must not reset or change the original select');
});
