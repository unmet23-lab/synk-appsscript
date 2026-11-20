// Load the same access functions as index.html when older client fixtures load
// individual scripts. Event wiring is covered by the browser acceptance flow.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./public/workspace-access.js',import.meta.url),'utf8');
export function workspaceClientContext(globals,{withEvents=false}={}){
  const context=vm.createContext(globals);vm.runInContext(withEvents?source:source.split("document.addEventListener('change'")[0],context);return context;
}
