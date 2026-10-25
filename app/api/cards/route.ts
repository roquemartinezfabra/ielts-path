import {requestUser} from "../../lib/storage";
import {categories,validCardId,validateCardBackup,validateCardContent,validateCardSettings,validateTransfer} from "../../lib/cards-domain";
import {CardsError,readCardBackup,readCardLibrary,readCardsOverview,restoreCardBackup,reviewCard,saveCardSettings,saveCardTransfer,suspendCard,upsertCardContents} from "../../lib/cards-storage";

const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"private, no-store"}});
const revision=(value:unknown)=>Number.isSafeInteger(value) && (value as number)>=0 && (value as number)<1000000;
function failure(error:unknown){return error instanceof CardsError?json({error:error.message},error.status):json({error:"No se pudo completar la operación de tarjetas. Reintenta; el historial existente se conserva."},503);}
export async function GET(request:Request){
 const user=await requestUser(request);if(!user)return json({error:"Inicia sesión para recuperar tus tarjetas."},401);
 try{
  const url=new URL(request.url),action=url.searchParams.get("action");
  if(action==="backup")return json(await readCardBackup(user));
  if(action==="library"){
   const category=url.searchParams.get("category")||"",q=url.searchParams.get("q")||"",deck=url.searchParams.get("deck")||"",offset=Number(url.searchParams.get("offset")||0),limit=Number(url.searchParams.get("limit")||30);
   if(category && !categories.includes(category as any) || q.length>300 || deck.length>160 || !Number.isSafeInteger(offset) || offset<0 || !Number.isSafeInteger(limit) || limit<1 || limit>100)return json({error:"Filtro de biblioteca no válido."},400);
   return json(await readCardLibrary(user,{category,q,deck,offset,limit}));
  }
  if(action && action!=="overview")return json({error:"Acción no reconocida."},400);
  return json(await readCardsOverview(user));
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 const origin=request.headers.get("Origin");if(origin!==new URL(request.url).origin)return json({error:"Esta solicitud debe proceder del propio Site."},403);
 const user=await requestUser(request);if(!user)return json({error:"Inicia sesión."},401);
 const raw=await request.text();if(raw.length>30000000)return json({error:"El archivo supera el límite de 30 MB."},413);
 let body:any;try{body=JSON.parse(raw);}catch{return json({error:"JSON no válido."},400);}
 if(!body || typeof body!=="object" || Array.isArray(body))return json({error:"Datos no válidos."},400);
 try{
  switch(body.action){
   case "settings":if(!revision(body.revision)||!validateCardSettings(body.settings))return json({error:"Configuración no válida: el reparto debe sumar las tarjetas nuevas diarias."},400);return json(await saveCardSettings(user,body.settings,body.revision));
   case "seed":case "create":case "update":case "import":{
    const cards=body.cards || (body.card?[body.card]:null);if(!Array.isArray(cards)||!cards.length||cards.length>100||!cards.every(validateCardContent)||new Set(cards.map(card=>card.id)).size!==cards.length)return json({error:"Envía de 1 a 100 tarjetas válidas con identidades únicas por lote."},400);
    return json(await upsertCardContents(user,cards));
   }
   case "review":if(!validCardId(body.cardId)||!validCardId(body.eventId)||!revision(body.revision)||!Number.isInteger(body.rating)||body.rating<1||body.rating>4||typeof body.elapsedSeconds!=="number"||!Number.isFinite(body.elapsedSeconds)||body.elapsedSeconds<0||body.elapsedSeconds>600)return json({error:"Respuesta de repaso no válida."},400);return json(await reviewCard(user,body));
   case "suspend":if(!validCardId(body.cardId)||!revision(body.revision)||typeof body.suspended!=="boolean")return json({error:"Tarjeta o revisión no válida."},400);return json(await suspendCard(user,body.cardId,body.suspended,body.revision));
   case "transfer":if(!validateTransfer(body.transfer))return json({error:"Registro de transferencia no válido."},400);return json(await saveCardTransfer(user,body.transfer));
   case "restore":if(!revision(body.revision)||!validateCardBackup(body.backup))return json({error:"El respaldo no es válido. No se ha modificado tu historial."},400);return json(await restoreCardBackup(user,body.backup,body.revision));
   default:return json({error:"Acción no reconocida."},400);
  }
 }catch(error){return failure(error);}
}
