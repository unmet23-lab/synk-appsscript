// Each detail form keeps its own local draft. Saving one form cannot erase a
// different, unfinished form when the page renders again.
export function createFormDrafts(){
  const screens=new Map();
  return {
    capture(screen,form,values,defaults={}){
      const changed=Object.keys(values).some(key=>values[key]!==defaults[key]);
      if(!changed){this.clear(screen,form);return;}
      if(!screens.has(screen))screens.set(screen,new Map());
      screens.get(screen).set(form,{...values});
    },
    read(screen,form){const value=screens.get(screen)?.get(form);return value?{...value}:null;},
    has(screen){return Boolean(screens.get(screen)?.size);},
    clear(screen,form){
      if(form===undefined){screens.delete(screen);return;}
      const forms=screens.get(screen);forms?.delete(form);if(!forms?.size)screens.delete(screen);
    },
    clearAll(){screens.clear();},
  };
}
