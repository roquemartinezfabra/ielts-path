import {accountInfo,beginGithub,finishGithub,guestLogin,logout} from "../../lib/auth";
export async function POST(request:Request){
 const action=new URL(request.url).pathname.split("/").at(-1);
 try{if(action==="guest")return await guestLogin(request);if(action==="github")return await beginGithub(request);if(action==="logout")return await logout(request);}
 catch{return Response.json({error:"No se pudo iniciar la sesión. Reintenta la conexión."},{status:503,headers:{"Cache-Control":"no-store"}});}
 return new Response(null,{status:404});
}
export async function GET(request:Request){
 const action=new URL(request.url).pathname.split("/").at(-1);
 try{if(action==="callback")return await finishGithub(request);if(action==="status")return await accountInfo(request);}
 catch{return Response.json({error:"No se pudo recuperar la sesión."},{status:503,headers:{"Cache-Control":"no-store"}});}
 return new Response(null,{status:404});
}
