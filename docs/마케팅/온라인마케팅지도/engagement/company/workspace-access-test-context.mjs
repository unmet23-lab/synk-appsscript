// Load the same access functions as index.html when older client fixtures load
// individual scripts. Event wiring is covered by the browser acceptance flow.
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./public/workspace-access.js',import.meta.url),'utf8').split("document.addEventListener('change'")[0];
export function workspaceClientContext(globals){
  const context=vm.createContext(globals);vm.runInContext(source,context);return context;
}
