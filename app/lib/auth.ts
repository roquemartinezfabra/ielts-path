import {env} from "cloudflare:workers";

export type Session={userId:string;kind:"guest"|"github"|"api";name:string;tokenHash:string};
const lifetime=30*86400;
const now=()=>Math.floor(Date.now()/1000);
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
export const sameOrigin=(request:Request)=>request.headers.get("Origin")===new URL(request.url).origin;
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
export async function hashToken(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,"0")).join("");}
function cookieName(request:Request,suffix="session"){return (new URL(request.url).protocol==="https:"?"__Host-":"")+"ielts_"+suffix;}
export function readCookie(request:Request,suffix="session"){
 const prefix=cookieName(request,suffix)+"=",values=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).filter(x=>x.startsWith(prefix));
 return values.length===1?values[0].slice(prefix.length):null;
}
function cookie(request:Request,value:string,seconds=lifetime,suffix="session"){
 return `${cookieName(request,suffix)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol==="https:"?"; Secure":""}`;
}
export async function readSession(request:Request):Promise<Session|null>{
 const bearer=request.headers.get("Authorization"),token=bearer?.startsWith("Bearer ")?bearer.slice(7):readCookie(request);
 if(!token||!/^ielts_[a-f0-9]{64}$/.test(token))return null;
 const tokenHash=await hashToken(token),row=await env.DB!.prepare("SELECT user_id, kind, display_name FROM auth_sessions WHERE token_hash=? AND expires_at>?").bind(tokenHash,now()).first<{user_id:string;kind:Session["kind"];display_name:string}>();
 if(!row||bearer&&row.kind!=="api"||!bearer&&row.kind==="api")return null;
 return {userId:row.user_id,kind:row.kind,name:row.display_name,tokenHash};
}
export async function requestUser(request:Request){return (await readSession(request))?.userId||null;}
async function createSession(userId:string,kind:Session["kind"],name:string,seconds=lifetime){
 const token="ielts_"+randomToken(),tokenHash=await hashToken(token);
 await env.DB!.prepare("INSERT INTO auth_sessions(token_hash,user_id,kind,display_name,created_at,expires_at) VALUES(?,?,?,?,?,?)").bind(tokenHash,userId,kind,name.slice(0,100),now(),now()+seconds).run();
 return token;
}
export function githubConfigured(){return !!(env.GITHUB_CLIENT_ID&&env.GITHUB_CLIENT_SECRET&&env.APP_ORIGIN);}
function origin(request:Request){return env.APP_ORIGIN||new URL(request.url).origin;}
function redirectWithCookie(request:Request,target:string,token:string,extra?:string){const headers=new Headers({Location:target,"Cache-Control":"no-store"});headers.append("Set-Cookie",cookie(request,token));if(extra)headers.append("Set-Cookie",extra);return new Response(null,{status:303,headers});}
export async function guestLogin(request:Request){
 if(!sameOrigin(request))return json({error:"Abre el acceso desde esta web."},403);
 const existing=await readSession(request);if(existing)return new Response(null,{status:303,headers:{Location:"/","Cache-Control":"no-store"}});
 await env.DB!.prepare("DELETE FROM auth_sessions WHERE expires_at < ?").bind(now()).run();
 const token=await createSession("guest:"+crypto.randomUUID(),"guest","Estudiante");
 return redirectWithCookie(request,"/",token);
}
export async function logout(request:Request){
 if(!sameOrigin(request))return json({error:"Solicitud de otro origen."},403);
 const session=await readSession(request);if(session)await env.DB!.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(session.tokenHash).run();
 return new Response(null,{status:303,headers:{Location:"/","Cache-Control":"no-store","Set-Cookie":cookie(request,"",0)}});
}
export async function beginGithub(request:Request){
 if(!sameOrigin(request))return json({error:"Abre el acceso desde esta web."},403);
 if(!githubConfigured())return json({error:"El acceso con GitHub aún no está configurado. Puedes entrar como invitado."},503);
 const state=randomToken(),verifier=randomToken(),digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...digest)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
 await env.DB!.prepare("DELETE FROM auth_oauth_states WHERE expires_at < ?").bind(now()).run();
 await env.DB!.prepare("INSERT INTO auth_oauth_states(state_hash,verifier,expires_at) VALUES(?,?,?)").bind(await hashToken(state),verifier,now()+600).run();
 const url=new URL("https://github.com/login/oauth/authorize");url.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID!,redirect_uri:origin(request)+"/auth/callback",state,code_challenge:challenge,code_challenge_method:"S256"}).toString();
 return new Response(null,{status:303,headers:{Location:url.toString(),"Cache-Control":"no-store","Set-Cookie":cookie(request,state,600,"oauth")}});
}
export async function finishGithub(request:Request){
 if(!githubConfigured())return json({error:"Acceso con GitHub no configurado."},503);
 const url=new URL(request.url),state=url.searchParams.get("state"),code=url.searchParams.get("code");
 if(!state||!/^[a-f0-9]{64}$/.test(state)||state!==readCookie(request,"oauth")||!code||code.length>200)return json({error:"El acceso ha caducado o no es válido. Vuelve a iniciarlo."},400);
 const stateHash=await hashToken(state),row=await env.DB!.prepare("SELECT verifier FROM auth_oauth_states WHERE state_hash=? AND expires_at>?").bind(stateHash,now()).first<{verifier:string}>();
 if(!row)return json({error:"Este acceso ya se utilizó o ha caducado."},400);
 const consumed=await env.DB!.prepare("DELETE FROM auth_oauth_states WHERE state_hash=?").bind(stateHash).run();if(consumed.meta.changes!==1)return json({error:"Acceso ya utilizado."},400);
 const exchanged=await fetch("https://github.com/login/oauth/access_token",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.GITHUB_CLIENT_ID!,client_secret:env.GITHUB_CLIENT_SECRET!,code,redirect_uri:origin(request)+"/auth/callback",code_verifier:row.verifier})});
 const data=await exchanged.json() as {access_token?:string};if(!exchanged.ok||!data.access_token)return json({error:"GitHub no pudo completar el acceso. Inténtalo de nuevo."},502);
 const response=await fetch("https://api.github.com/user",{headers:{Authorization:`Bearer ${data.access_token}`,Accept:"application/vnd.github+json","User-Agent":"IELTS-Path"}}),user=await response.json() as {id?:number;login?:string};
 if(!response.ok||!Number.isSafeInteger(user.id)||!user.login)return json({error:"No se pudo verificar la cuenta de GitHub."},502);
 // The provider token is used only to identify the account and is never stored.
 const token=await createSession("github:"+user.id,"github",user.login);
 return redirectWithCookie(request,"/",token,cookie(request,"",0,"oauth"));
}
export async function accountInfo(request:Request){
 const session=await readSession(request);
 return json({user:session?{kind:session.kind,name:session.name}:null,githubAvailable:githubConfigured()});
}
export async function accountAction(request:Request){
 if(!sameOrigin(request))return json({error:"Solicitud de otro origen."},403);
 const session=await readSession(request);if(!session||session.kind==="api")return json({error:"Entra en tu espacio para gestionar el acceso."},401);
 let body:{action?:string};try{body=await request.json();}catch{return json({error:"Datos no válidos."},400);}
 if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"Datos no válidos."},400);
 if(body.action==="revoke-tutor"){
  await env.DB!.prepare("DELETE FROM auth_sessions WHERE user_id=? AND kind='api'").bind(session.userId).run();return json({revoked:true});
 }
 if(body.action==="create-tutor"){
  // A single revocable token per learner, with a bounded expiry.
  await env.DB!.prepare("DELETE FROM auth_sessions WHERE user_id=? AND kind='api'").bind(session.userId).run();
  const token=await createSession(session.userId,"api",session.name,7*86400);return json({token,expiresInDays:7,endpoint:origin(request)+"/mcp"});
 }
 return json({error:"Acción no reconocida."},400);
}
