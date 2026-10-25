import {env} from "cloudflare:workers";
import {buildCardQueue,cardSummary,defaultCardSettings,newCard,scheduleReview,validateCardSettings,type CardBackup,type CardContent,type CardReview,type CardSettings,type CardTransfer,type StudyCard} from "./cards-domain";

type CardRow={content:string;schedule:string;revision:number;suspended:number;created_at:string;updated_at:string};
export class CardsError extends Error {constructor(message:string,public status=400){super(message);}}
const db=()=>{if(!env.DB)throw new CardsError("El almacenamiento de tarjetas no está disponible.",503);return env.DB;};
const cardFromRow=(row:CardRow):StudyCard=>({...JSON.parse(row.content),schedule:JSON.parse(row.schedule),revision:row.revision,suspended:!!row.suspended,createdAt:row.created_at,updatedAt:row.updated_at});
const contentOnly=(card:CardContent):CardContent=>({id:card.id,deck:card.deck,category:card.category,mode:card.mode,prompt:card.prompt,answer:card.answer,explanation:card.explanation,example:card.example,ipa:card.ipa,lemma:card.lemma,skillId:card.skillId,sourceUrl:card.sourceUrl,source:card.source,...(card.audioUrl?{audioUrl:card.audioUrl}:{}),...(card.audioLicense?{audioLicense:card.audioLicense}:{})});
async function runBatches(statements:D1PreparedStatement[],size=50){for(let i=0;i<statements.length;i+=size)await db().batch(statements.slice(i,i+size));}
export async function readCardSettings(userId:string):Promise<{settings:CardSettings;revision:number}> {
 const row=await db().prepare("SELECT payload,revision FROM flashcard_settings WHERE user_id=?").bind(userId).first<{payload:string;revision:number}>();
 if(!row)return {settings:defaultCardSettings(),revision:0};
 const settings=JSON.parse(row.payload);if(!validateCardSettings(settings))throw new CardsError("La configuración guardada necesita revisión.",500);
 return {settings,revision:row.revision};
}
export async function saveCardSettings(userId:string,settings:CardSettings,revision:number){
 const now=new Date().toISOString();
 const results=await db().batch([
  db().prepare("INSERT OR IGNORE INTO flashcard_settings(user_id,payload,revision,updated_at) VALUES(?,?,0,?)").bind(userId,JSON.stringify(defaultCardSettings()),now),
  db().prepare("UPDATE flashcard_settings SET payload=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=?").bind(JSON.stringify(settings),now,userId,revision)
 ]);
 if(results[1].meta.changes!==1)throw new CardsError("La configuración cambió en otra ventana. Recarga antes de guardar.",409);
 return {revision:revision+1};
}
export async function readCards(userId:string):Promise<StudyCard[]>{const result=await db().prepare("SELECT content,schedule,revision,suspended,created_at,updated_at FROM flashcards WHERE user_id=? ORDER BY created_at,id").bind(userId).all<CardRow>();return result.results.map(cardFromRow);}
export async function readCardReviews(userId:string):Promise<CardReview[]>{const result=await db().prepare("SELECT payload FROM flashcard_reviews WHERE user_id=? ORDER BY reviewed_at").bind(userId).all<{payload:string}>();return result.results.map(row=>JSON.parse(row.payload));}
export async function readCardsOverview(userId:string){
 const [{settings,revision},cards,reviews,transfers,transferCount]=await Promise.all([readCardSettings(userId),readCards(userId),readCardReviews(userId),db().prepare("SELECT payload FROM flashcard_transfers WHERE user_id=? ORDER BY recorded_at DESC LIMIT 20").bind(userId).all<{payload:string}>(),db().prepare("SELECT COUNT(*) AS n FROM flashcard_transfers WHERE user_id=?").bind(userId).first<{n:number}>()]),now=new Date();
 const deckCounts=new Map<string,number>();for(const card of cards)deckCounts.set(card.deck,(deckCounts.get(card.deck)||0)+1);
 return {settings,revision,summary:cardSummary(cards,reviews,settings,now),queue:buildCardQueue(cards,reviews,settings,now),decks:[...deckCounts].map(([name,count])=>({name,count})),recentTransfers:transfers.results.map(row=>JSON.parse(row.payload) as CardTransfer),transferCount:transferCount?.n||0};
}
export async function readCardBackup(userId:string):Promise<CardBackup>{
 const [{settings},cards,reviews,result]=await Promise.all([readCardSettings(userId),readCards(userId),readCardReviews(userId),db().prepare("SELECT payload FROM flashcard_transfers WHERE user_id=? ORDER BY recorded_at").bind(userId).all<{payload:string}>()]);
 return {schemaVersion:1,exportedAt:new Date().toISOString(),settings,cards,reviews,transfers:result.results.map(row=>JSON.parse(row.payload))};
}
export async function readCardLibrary(userId:string,filter:{q:string;category:string;offset:number;limit:number;deck?:string}){
 const clauses=["user_id=?"],args:(string|number)[]=[userId];
 if(filter.category){clauses.push("category=?");args.push(filter.category);}
 if(filter.deck){clauses.push("deck=?");args.push(filter.deck);}
 if(filter.q){clauses.push("(LOWER(content) LIKE ? OR LOWER(lemma) LIKE ?)");args.push("%"+filter.q.toLowerCase()+"%","%"+filter.q.toLowerCase()+"%");}
 const where=clauses.join(" AND ");
 const [rows,count]=await Promise.all([db().prepare(`SELECT content,schedule,revision,suspended,created_at,updated_at FROM flashcards WHERE ${where} ORDER BY deck,id LIMIT ? OFFSET ?`).bind(...args,filter.limit,filter.offset).all<CardRow>(),db().prepare(`SELECT COUNT(*) AS n FROM flashcards WHERE ${where}`).bind(...args).first<{n:number}>()]);
 return {cards:rows.results.map(cardFromRow),total:count?.n||0};
}
export async function upsertCardContents(userId:string,contents:CardContent[]){
 const known:{id:string;category:string;mode:string}[]=[];
 for(let offset=0;offset<contents.length;offset+=50){const chunk=contents.slice(offset,offset+50);const rows=await db().prepare(`SELECT id,category,mode FROM flashcards WHERE user_id=? AND id IN (${chunk.map(()=>"?").join(",")})`).bind(userId,...chunk.map(card=>card.id)).all<{id:string;category:string;mode:string}>();known.push(...rows.results);}
 if(known.some(existing=>{const card=contents.find(card=>card.id===existing.id)!;return card.category!==existing.category || card.mode!==existing.mode;}))throw new CardsError("Una identidad existente tiene otra categoría o modo. Conserva su identidad o usa un identificador distinto.",409);
 const now=new Date(),statements=contents.map(content=>{const card=newCard(content,now);return db().prepare("INSERT INTO flashcards(user_id,id,deck,category,mode,lemma,content,schedule,due,reps,suspended,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,0,0,?,?) ON CONFLICT(user_id,id) DO UPDATE SET deck=excluded.deck,category=excluded.category,mode=excluded.mode,lemma=excluded.lemma,content=excluded.content,updated_at=excluded.updated_at,revision=flashcards.revision+1 WHERE flashcards.category=excluded.category AND flashcards.mode=excluded.mode")
  .bind(userId,card.id,card.deck,card.category,card.mode,card.lemma,JSON.stringify(contentOnly(card)),JSON.stringify(card.schedule),card.schedule.due,card.schedule.reps,card.createdAt,card.updatedAt);});
 const results=await db().batch(statements),changed=results.reduce((n,result)=>n+result.meta.changes,0);
 if(changed!==contents.length)throw new CardsError("Una identidad existente tiene otra categoría o modo. Conserva su identidad o importa esa dirección con un identificador distinto.",409);
 return {imported:changed};
}
export async function reviewCard(userId:string,input:{cardId:string;revision:number;eventId:string;rating:1|2|3|4;elapsedSeconds:number}){
 const prior=await db().prepare("SELECT payload FROM flashcard_reviews WHERE user_id=? AND id=?").bind(userId,input.eventId).first<{payload:string}>();
 if(prior){const review=JSON.parse(prior.payload) as CardReview;if(review.cardId!==input.cardId || review.rating!==input.rating)throw new CardsError("Este identificador de repaso ya pertenece a otra respuesta.",409);return {review,duplicate:true};}
 const [{settings},cards,reviews]=await Promise.all([readCardSettings(userId),readCards(userId),readCardReviews(userId)]),card=cards.find(card=>card.id===input.cardId),now=new Date();
 if(!card)throw new CardsError("No se encuentra esta tarjeta.",404);
 if(card.revision!==input.revision)throw new CardsError("Esta tarjeta cambió en otra ventana. Recarga la cola.",409);
 if(!buildCardQueue(cards,reviews,settings,now).some(item=>item.id===card.id))throw new CardsError("Esta tarjeta ya no está disponible en la cola de hoy. Recarga los repasos.",409);
 const next=scheduleReview(card,input.rating,settings,input.eventId,input.elapsedSeconds,now);
 const results=await db().batch([
  db().prepare("UPDATE flashcards SET schedule=?,due=?,reps=?,revision=revision+1,updated_at=?,last_event_id=? WHERE user_id=? AND id=? AND revision=? AND suspended=0 AND NOT EXISTS(SELECT 1 FROM flashcard_reviews WHERE user_id=? AND id=?)")
   .bind(JSON.stringify(next.card.schedule),next.card.schedule.due,next.card.schedule.reps,next.card.updatedAt,input.eventId,userId,input.cardId,input.revision,userId,input.eventId),
  db().prepare("INSERT OR IGNORE INTO flashcard_reviews(user_id,id,card_id,reviewed_at,payload) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM flashcards WHERE user_id=? AND id=? AND revision=? AND last_event_id=?)")
   .bind(userId,input.eventId,input.cardId,next.review.reviewedAt,JSON.stringify(next.review),userId,input.cardId,input.revision+1,input.eventId)
 ]);
 if(results[0].meta.changes!==1){const accepted=await db().prepare("SELECT payload FROM flashcard_reviews WHERE user_id=? AND id=?").bind(userId,input.eventId).first<{payload:string}>();if(accepted){const review=JSON.parse(accepted.payload) as CardReview;if(review.cardId===input.cardId && review.rating===input.rating)return {review,duplicate:true};}throw new CardsError("El repaso ya cambió en otra ventana. Recarga la cola.",409);}
 return {...next,duplicate:false};
}
export async function suspendCard(userId:string,cardId:string,suspended:boolean,revision:number){const result=await db().prepare("UPDATE flashcards SET suspended=?,revision=revision+1,updated_at=? WHERE user_id=? AND id=? AND revision=?").bind(suspended?1:0,new Date().toISOString(),userId,cardId,revision).run();if(result.meta.changes!==1)throw new CardsError("La tarjeta cambió en otra ventana. Recarga la biblioteca.",409);return {revision:revision+1};}
export async function saveCardTransfer(userId:string,transfer:CardTransfer){
 if(transfer.cardId){const card=await db().prepare("SELECT category FROM flashcards WHERE user_id=? AND id=?").bind(userId,transfer.cardId).first<{category:string}>();if(!card)throw new CardsError("No se encuentra la tarjeta de esa transferencia.",404);if(card.category!==transfer.category)throw new CardsError("La categoría de la aplicación debe coincidir con la tarjeta.");}
 await db().prepare("INSERT OR IGNORE INTO flashcard_transfers(user_id,id,recorded_at,payload) VALUES(?,?,?,?)").bind(userId,transfer.id,transfer.date,JSON.stringify(transfer)).run();return {saved:true};
}
export async function restoreCardBackup(userId:string,backup:CardBackup,revision:number){
 // Merge is intentionally non-destructive and retryable. Validation happens in
 // the API before any write. Newer local cards and unexported history survive.
 const saved=await readCardSettings(userId);if(saved.revision!==revision)throw new CardsError("La configuración cambió. Recarga antes de fusionar el respaldo.",409);
 const existing=await db().prepare("SELECT id,category,mode FROM flashcards WHERE user_id=?").bind(userId).all<{id:string;category:string;mode:string}>(),byId=new Map(existing.results.map(card=>[card.id,card]));
 if(backup.cards.some(card=>{const known=byId.get(card.id);return known && (known.category!==card.category || known.mode!==card.mode);}))throw new CardsError("El respaldo reutiliza una identidad con otra categoría o dirección. No se ha fusionado; revisa los identificadores.",409);
 const statements:D1PreparedStatement[]=backup.cards.map(card=>db().prepare("INSERT INTO flashcards(user_id,id,deck,category,mode,lemma,content,schedule,due,reps,suspended,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET deck=excluded.deck,category=excluded.category,mode=excluded.mode,lemma=excluded.lemma,content=excluded.content,schedule=excluded.schedule,due=excluded.due,reps=excluded.reps,suspended=excluded.suspended,revision=flashcards.revision+1,last_event_id=NULL,updated_at=excluded.updated_at WHERE flashcards.updated_at < excluded.updated_at")
  .bind(userId,card.id,card.deck,card.category,card.mode,card.lemma,JSON.stringify(contentOnly(card)),JSON.stringify(card.schedule),card.schedule.due,card.schedule.reps,card.suspended?1:0,card.revision,card.createdAt,card.updatedAt));
 for(const review of backup.reviews)statements.push(db().prepare("INSERT OR IGNORE INTO flashcard_reviews(user_id,id,card_id,reviewed_at,payload) VALUES(?,?,?,?,?)").bind(userId,review.id,review.cardId,review.reviewedAt,JSON.stringify(review)));
 for(const transfer of backup.transfers)statements.push(db().prepare("INSERT OR IGNORE INTO flashcard_transfers(user_id,id,recorded_at,payload) VALUES(?,?,?,?)").bind(userId,transfer.id,transfer.date,JSON.stringify(transfer)));
 await runBatches(statements);
 // Settings use their own revision; if another tab edited them during a large
 // merge, retain the newer settings rather than overwriting the other session.
 let settingsRestored=true;try{await saveCardSettings(userId,backup.settings,revision);}catch(error){if(error instanceof CardsError && error.status===409)settingsRestored=false;else throw error;}
 return {restored:backup.cards.length,merged:true,settingsRestored};
}
