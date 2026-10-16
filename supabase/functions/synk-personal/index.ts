import postgres from 'npm:postgres@3.4.4';
import runtime from './synk-personal-runtime.mjs';
const config={url:Deno.env.get('SUPABASE_URL')!,apiKey:Deno.env.get('SUPABASE_ANON_KEY')!,oauthClients:Deno.env.get('SYNK_OAUTH_CLIENT_PRODUCTS')};
const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:4});
Deno.serve(runtime.createPersonalService({store:runtime.createPersonalStore(sql),verify:runtime.createAuthVerifier(config),model:runtime.model,enabled:()=>Deno.env.get('SYNK_PERSONAL_ENABLED')==='true',storage:()=>runtime.createPersonalStorage({url:config.url,key:Deno.env.get('STORAGE_SIGN_KEY')||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||''})}));
