import assert from "node:assert/strict";
import {readFile,writeFile,readdir,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
const out=resolve(".sites-runtime/auth-tests");await mkdir(out,{recursive:true});
for(const f of (await readdir("app/data")).filter(f=>f.endsWith(".json")))await writeFile(resolve(out,f.replace(".json",".mjs")),"export default "+await readFile("app/data/"+f,"utf8"));
const modules=Object.fromEntries((await readdir("app/lib")).filter(f=>f.endsWith(".ts")).map(f=>[f.slice(0,-3),"app/lib/"+f]));
modules["state-route"]="app/api/state/route.ts";
for(const [name,file] of Object.entries(modules)){
 let source=await readFile(file,"utf8");source=source.replaceAll('"cloudflare:workers"','"./env.mjs"').replace(/"\.\.\/data\/([^\"]+)\.json"/g,'"./$1.mjs"').replace(/"\.\.\/\.\.\/lib\/([^\"]+)"/g,'"./$1.mjs"').replace(/"\.\/([^\"]+)"/g,(_,f)=>'"./'+(f.endsWith(".mjs")?f:f+".mjs")+'"');
 await writeFile(resolve(out,name+".mjs"),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
}
await writeFile(resolve(out,"env.mjs"),"export const env=globalThis.__independentTestEnv;");
const sql=new DatabaseSync(":memory:");for(const f of (await readdir("drizzle")).filter(x=>x.endsWith(".sql")).sort())sql.exec(await readFile("drizzle/"+f,"utf8"));
class Statement{constructor(query,args=[]){this.query=query;this.args=args;}bind(...args){return new Statement(this.query,args);}async first(){return sql.prepare(this.query).get(...this.args)||null;}async all(){return {results:sql.prepare(this.query).all(...this.args)};}execute(){return {meta:{changes:Number(sql.prepare(this.query).run(...this.args).changes)}};}async run(){return this.execute();}}
globalThis.__independentTestEnv={DB:{prepare:q=>new Statement(q),async batch(statements){sql.exec("BEGIN");try{const r=statements.map(s=>s.execute());sql.exec("COMMIT");return r;}catch(e){sql.exec("ROLLBACK");throw e;}}}};
const load=n=>import(pathToFileURL(resolve(out,n+".mjs"))),auth=await load("auth"),api=await load("state-route"),domain=await load("domain"),exchange=await load("tutor-exchange");
const request=(path,options={})=>new Request("https://demo.test"+path,options);
const post=(path,cookie,body,origin="https://demo.test")=>request(path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
const cookieOf=r=>r.headers.getSetCookie()[0].split(";")[0];
assert.equal((await api.GET(request("/api/state",{headers:{"oai-authenticated-user-id":"someone-else"}}))).status,401);
assert.equal((await auth.guestLogin(post("/auth/guest",null,{},"https://other.test"))).status,403);
const guestA=await auth.guestLogin(post("/auth/guest",null,{})),guestB=await auth.guestLogin(post("/auth/guest",null,{})),a=cookieOf(guestA),b=cookieOf(guestB);
assert.equal(guestA.status,303);assert(guestA.headers.get("Set-Cookie").includes("HttpOnly; SameSite=Lax"));assert(guestA.headers.get("Set-Cookie").includes("Secure"));assert.notEqual(a,b);
const state=domain.freshState();state.profile.name="Independent test learner";
assert.equal((await api.POST(post("/api/state",a,{state,revision:0}))).status,200);
assert.equal((await (await api.GET(request("/api/state",{headers:{Cookie:a}}))).json()).state.profile.name,state.profile.name);
assert.notEqual((await (await api.GET(request("/api/state",{headers:{Cookie:b}}))).json()).state.profile.name,state.profile.name);
assert.equal((await api.POST(post("/api/state",a,{state,revision:0}))).status,409);
assert.equal((await api.POST(post("/api/state",a,{state,revision:1},"https://other.test"))).status,403);
assert.equal(await auth.readSession(request("/",{headers:{Cookie:a+"; "+a}})),null);
console.log("PASS real guest sessions, anti-forgery, identity-header rejection, user isolation and revision conflicts");
const tokenResponse=await auth.accountAction(post("/api/account",a,{action:"create-tutor"})),tokenData=await tokenResponse.json();
const bearer=request("/mcp",{headers:{Authorization:"Bearer "+tokenData.token}});assert.equal((await auth.readSession(bearer)).kind,"api");
assert.equal(await auth.readSession(request("/",{headers:{Cookie:"__Host-ielts_session="+tokenData.token}})),null);
assert.equal(await auth.readSession(request("/",{headers:{Authorization:"Bearer "+a.split("=")[1]}})),null);
await auth.accountAction(post("/api/account",a,{action:"revoke-tutor"}));assert.equal(await auth.readSession(bearer),null);
await auth.logout(post("/auth/logout",b,{}));assert.equal(await auth.readSession(request("/",{headers:{Cookie:b}})),null);
const stored=sql.prepare("SELECT token_hash FROM auth_sessions").all();assert(stored.every(row=>!row.token_hash.startsWith("ielts_")));
console.log("PASS hashed sessions, logout, separate bearer access and tutor revocation");
const testEnv=globalThis.__independentTestEnv;assert.equal(auth.githubConfigured(),false);
Object.assign(testEnv,{GITHUB_CLIENT_ID:"fixture-client",GITHUB_CLIENT_SECRET:"fixture-secret",APP_ORIGIN:"https://demo.test"});
const begin=await auth.beginGithub(post("/auth/github",a,{})),location=new URL(begin.headers.get("Location")),nonce=location.searchParams.get("state"),oauthCookie=cookieOf(begin);
assert.equal(location.origin,"https://github.com");assert.equal(location.searchParams.get("code_challenge_method"),"S256");assert.equal(location.searchParams.has("scope"),false);assert.equal(location.searchParams.get("code_challenge").length,43);
assert.equal((await auth.finishGithub(request("/auth/callback?state="+nonce+"&code=fixture",{headers:{Cookie:a}}))).status,400);
let calls=0;const realFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{calls++;if(String(url).endsWith("access_token")){const form=options.body;assert.equal(form.get("code_verifier").length,64);assert.equal(form.get("redirect_uri"),"https://demo.test/auth/callback");return Response.json({access_token:"fixture-provider-token"});}assert.equal(options.headers.Authorization,"Bearer fixture-provider-token");return Response.json({id:123456,login:"example-learner"});};
try{
 const finish=await auth.finishGithub(request("/auth/callback?state="+nonce+"&code=fixture",{headers:{Cookie:oauthCookie}}));assert.equal(finish.status,303);assert.equal((await auth.readSession(request("/",{headers:{Cookie:cookieOf(finish)}}))).userId,"github:123456");assert.equal(calls,2);
 assert.equal((await auth.finishGithub(request("/auth/callback?state="+nonce+"&code=fixture",{headers:{Cookie:oauthCookie}}))).status,400);assert.equal(calls,2);
}finally{globalThis.fetch=realFetch;}
sql.prepare("UPDATE auth_sessions SET expires_at=0").run();assert.equal(await auth.readSession(request("/",{headers:{Cookie:a}})),null);
console.log("PASS GitHub OAuth with PKCE, bound state, single-use callback, stable identity and expiry (provider mocked)");
const study=domain.freshState();study.learningNotes=[{id:"application-1",date:"2026-10-25T08:00:00Z",kind:"grammar",title:"Order",text:"Does she works?",mode:"independent",resourceId:"g-word-order"}];
const revised=exchange.applyTutorPacket(study,{kind:"application",noteId:"application-1",date:"2026-10-25T09:00:00Z",feedback:"Does she work? Use the base verb after does."});assert.equal(revised.learningNotes[0].text,study.learningNotes[0].text);assert.equal(study.learningNotes[0].review,undefined);assert(domain.validateState(revised));assert.throws(()=>exchange.applyTutorPacket(study,{kind:"application",noteId:"stranger",date:"bad",feedback:"Replace"}));assert.equal(exchange.tutorPacket(study,"application-1").data.id,"application-1");
console.log("PASS exported application context and imported feedback preserve original answers");
sql.close();
