import {env} from "cloudflare:workers";
import catalog from "../data/oxford-catalog.json";
import {defaultCardSettings,newCard,validateCardContent,type CardContent} from "./cards-domain";
import {CardsError} from "./cards-storage";

export async function readOxfordStatus(userId:string){
 const result=await env.DB.prepare("SELECT part_index,card_count FROM flashcard_pack_parts WHERE user_id=? AND pack_id=? AND version=? ORDER BY part_index").bind(userId,catalog.id,catalog.version).all<{part_index:number;card_count:number}>();
 return {version:catalog.version,total:catalog.total,parts:catalog.parts.length,installedParts:result.results.map(row=>row.part_index),installed:result.results.reduce((sum,row)=>sum+row.card_count,0)};
}

export async function installOxfordPart(userId:string,version:unknown,index:unknown){
 if(version!==catalog.version)throw new CardsError("El mazo se ha actualizado. Recarga antes de continuar.",409);
 if(!Number.isInteger(index)||(index as number)<0||(index as number)>=catalog.parts.length)throw new CardsError("Parte del mazo no válida.");
 const partIndex=index as number,part=catalog.parts[partIndex];
 const installed=await env.DB.prepare("SELECT card_count FROM flashcard_pack_parts WHERE user_id=? AND pack_id=? AND version=? AND part_index=?").bind(userId,catalog.id,catalog.version,partIndex).first();
 if(installed)return {added:0,...await readOxfordStatus(userId)};
 // Fetch only the trusted, versioned public asset; never a URL supplied by the client.
 const response=await env.ASSETS.fetch(new Request(`https://assets.local/decks/oxford-5000/${catalog.version}/${part.file}`));
 if(!response.ok)throw new CardsError("No se pudo cargar el mazo. Puedes reanudar sin perder lo incorporado.",503);
 const bytes=await response.arrayBuffer();
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),byte=>byte.toString(16).padStart(2,"0")).join("");
 if(hash!==part.sha256)throw new CardsError("El archivo del mazo no coincide con esta versión. Recarga e inténtalo de nuevo.",503);
 const cards=JSON.parse(new TextDecoder().decode(bytes)) as CardContent[];
 if(!Array.isArray(cards)||cards.length!==part.count||!cards.every(card=>validateCardContent(card)&&card.category==="vocabulary"&&card.mode==="recognition")||new Set(cards.map(card=>card.id)).size!==cards.length)throw new CardsError("El contenido del mazo no es válido.",503);
 const ids=JSON.stringify(cards.map(card=>card.id));
 const incompatible=await env.DB.prepare("SELECT id FROM flashcards WHERE user_id=? AND id IN (SELECT value FROM json_each(?)) AND (category!='vocabulary' OR mode!='recognition') LIMIT 1").bind(userId,ids).first();
 if(incompatible)throw new CardsError("Una tarjeta existente reutiliza un identificador de este mazo con otro tipo. Revisa esa identidad antes de continuar.",409);
 const now=new Date(),stamp=now.toISOString(),schedule=JSON.stringify(newCard(cards[0],now).schedule);
 const settings={...defaultCardSettings(),newPerDay:6,allocations:{vocabulary:6,grammar:0,pronunciation:0}};
 // One transaction per part: interruption/retries cannot reset a card or duplicate a review.
 // Bulk INSERT SELECT keeps D1 queries bounded even for a complete 5,535-card deck.
 const results=await env.DB.batch([
  env.DB.prepare("INSERT OR IGNORE INTO flashcard_settings(user_id,payload,revision,updated_at) SELECT ?,?,0,? WHERE NOT EXISTS(SELECT 1 FROM flashcards WHERE user_id=?)").bind(userId,JSON.stringify(settings),stamp,userId),
  env.DB.prepare("INSERT OR IGNORE INTO flashcards(user_id,id,deck,category,mode,lemma,content,schedule,due,reps,suspended,revision,created_at,updated_at) SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.deck'),json_extract(value,'$.category'),json_extract(value,'$.mode'),json_extract(value,'$.lemma'),value,?,?,0,0,0,?,? FROM json_each(?)")
   .bind(userId,schedule,stamp,stamp,stamp,JSON.stringify(cards)),
  env.DB.prepare("INSERT OR IGNORE INTO flashcard_pack_parts(user_id,pack_id,version,part_index,card_count,installed_at) VALUES(?,?,?,?,?,?)").bind(userId,catalog.id,catalog.version,partIndex,part.count,stamp)
 ]);
 return {added:results[1].meta.changes,...await readOxfordStatus(userId)};
}
