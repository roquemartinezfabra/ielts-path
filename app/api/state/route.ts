import {readState,writeState,requestUser} from "../../lib/storage";
import {validateState} from "../../lib/domain";
export async function GET(request:Request) {
 const user=await requestUser(request);if(!user)return Response.json({error:"Inicia sesión para recuperar tu progreso."},{status:401});
 try {
  const saved=await readState(user);
  if(!validateState(saved.state)||!Number.isSafeInteger(saved.revision)||saved.revision<0)return Response.json({error:"El historial guardado no tiene el formato esperado. Conserva tu respaldo y solicita su revisión."},{status:500});
  return Response.json(saved);
 }catch{return Response.json({error:"No se pudo recuperar tu progreso. Reintenta la conexión."},{status:503});}
}
export async function POST(request:Request) {
 const origin=request.headers.get("Origin");
 if(origin!==new URL(request.url).origin)return Response.json({error:"Esta solicitud debe proceder del propio Site."},{status:403});
 const user=await requestUser(request);if(!user)return Response.json({error:"Inicia sesión."},{status:401});
 const text=await request.text();if(text.length>3000000)return Response.json({error:"El respaldo es demasiado grande."},{status:413});
 let body:any;try{body=JSON.parse(text);}catch{return Response.json({error:"JSON no válido."},{status:400});}
 if(!body||typeof body!=="object"||Array.isArray(body)||!validateState(body.state)||!Number.isSafeInteger(body.revision)||body.revision<0||body.revision>=Number.MAX_SAFE_INTEGER)return Response.json({error:"Los datos no tienen el formato esperado."},{status:400});
 const revision=await writeState(user,body.state,body.revision);return revision===null?Response.json({error:"Tu progreso cambió en otra ventana. Recarga antes de guardar."},{status:409}):Response.json({revision});
}
