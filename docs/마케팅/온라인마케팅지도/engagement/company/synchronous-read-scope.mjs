// Reuse synchronous, read-only projections during one composed read. Nothing is
// retained across requests, users, an await, or a failed top-level operation.
export function createSynchronousReadScope(){
  let active=null;
  function run(fn){const previous=active;active=new Map();try{return fn();}finally{active=previous;}}
  function service(source,methods){
    const wrapped={...source};
    for(const name of methods){
      const read=source[name],readKey={};if(typeof read!=='function')throw new TypeError('Read scope method must be callable.');
      wrapped[name]=function(...args){
        if(!active)return read.apply(source,args);
        // Include the complete user argument and every other argument. Explicit
        // type tags also distinguish missing, undefined, null and string values.
        let key;try{key=JSON.stringify(args.map(value=>[typeof value,value]));}catch{return read.apply(source,args);}
        let values=active.get(readKey);if(!values){values=new Map();active.set(readKey,values);}
        if(values.has(key)){const cached=values.get(key);if(cached.failed)throw cached.error;return cached.value;}
        try{const value=read.apply(source,args);if(!value?.then)values.set(key,{value});return value;}
        catch(error){values.set(key,{failed:true,error});throw error;}
      };
    }
    return wrapped;
  }
  return {run,service};
}
