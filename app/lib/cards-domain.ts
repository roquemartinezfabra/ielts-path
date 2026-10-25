import { createEmptyCard, fsrs, type Card as FSRSCard, type Grade } from "ts-fsrs";

export type CardCategory = "vocabulary" | "grammar" | "pronunciation";
export type CardMode = "production" | "recognition";
export type CardContent = {id:string;deck:string;category:CardCategory;mode:CardMode;prompt:string;answer:string;explanation:string;example:string;ipa:string;lemma:string;skillId:string;sourceUrl:string;source:string;audioUrl?:string;audioLicense?:string};
export type CardSchedule = Omit<FSRSCard,"due"|"last_review"> & {due:string;last_review?:string};
export type StudyCard = CardContent & {schedule:CardSchedule;revision:number;suspended:boolean;createdAt:string;updatedAt:string};
export type CardSettings = {newPerDay:number;allocations:Record<CardCategory,number>;budgetMinutes:number;retention:number;timezone:string;learningSteps:["10m"];relearningSteps:["10m"];maxIntervalDays:number};
export type CardReview = {id:string;cardId:string;category:CardCategory;mode:CardMode;siblingKey:string;rating:1|2|3|4;elapsedSeconds:number;reviewedAt:string;dueAtReview:string;previousSchedule:CardSchedule;nextDue:string;success:boolean;delayedRecall:boolean;isNew:boolean};
export type CardTransfer = {id:string;cardId?:string;category:CardCategory;mode:CardMode;date:string;success:boolean;note:string};
export type CardBackup = {schemaVersion:1;exportedAt:string;settings:CardSettings;cards:StudyCard[];reviews:CardReview[];transfers:CardTransfer[]};
export const categories:CardCategory[] = ["vocabulary","grammar","pronunciation"];
export const defaultCardSettings = ():CardSettings => ({newPerDay:10,allocations:{vocabulary:6,grammar:3,pronunciation:1},budgetMinutes:20,retention:.9,timezone:"Europe/Madrid",learningSteps:["10m"],relearningSteps:["10m"],maxIntervalDays:36500});
const record = (v:unknown):v is Record<string,any> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v:unknown,max=1000,min=0):v is string => typeof v === "string" && v.length>=min && v.length<=max;
const number = (v:unknown,min:number,max:number) => typeof v === "number" && Number.isFinite(v) && v>=min && v<=max;
const integer = (v:unknown,min:number,max:number) => number(v,min,max) && Number.isSafeInteger(v);
export const validCardId = (v:unknown):v is string => text(v,160,1) && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(v) && !["constructor","prototype","__proto__"].includes(v);
export const validISO = (v:unknown):v is string => text(v,32,20) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v;
const httpURL = (v:unknown) => text(v,2000) && (!v || /^https:\/\//.test(v) && (()=>{try{return !!new URL(v).hostname;}catch{return false;}})());
export function validateCardContent(v:unknown):v is CardContent {
 return record(v) && validCardId(v.id) && text(v.deck,160,1) && categories.includes(v.category) && ["production","recognition"].includes(v.mode)
  && !!v.deck.trim() && text(v.prompt,6000,1) && !!v.prompt.trim() && text(v.answer,6000,1) && !!v.answer.trim() && text(v.explanation,12000) && text(v.example,6000) && text(v.ipa,1000) && text(v.lemma,300) && text(v.skillId,160)
  && httpURL(v.sourceUrl) && text(v.source,3000) && (v.audioUrl===undefined || httpURL(v.audioUrl)) && (v.audioLicense===undefined || text(v.audioLicense,3000));
}
export function validateCardSettings(v:unknown):v is CardSettings {
 if (!record(v) || !integer(v.newPerDay,0,100) || !record(v.allocations) || !categories.every(c=>integer(v.allocations[c],0,100)) || Object.keys(v.allocations).length!==3
  || categories.reduce((s,c)=>s+v.allocations[c],0)!==v.newPerDay || !integer(v.budgetMinutes,5,120) || !number(v.retention,.8,.97) || !text(v.timezone,100,1)
  || JSON.stringify(v.learningSteps)!=='["10m"]' || JSON.stringify(v.relearningSteps)!=='["10m"]' || !integer(v.maxIntervalDays,1,36500)) return false;
 try{new Intl.DateTimeFormat("en",{timeZone:v.timezone}).format(new Date());return true;}catch{return false;}
}
export function validateSchedule(v:unknown):v is CardSchedule {
 return record(v) && validISO(v.due) && (v.last_review===undefined || validISO(v.last_review)) && number(v.stability,0,365000) && number(v.difficulty,0,10)
  && integer(v.elapsed_days,0,365000) && integer(v.scheduled_days,0,365000) && integer(v.learning_steps,0,100) && integer(v.reps,0,1000000) && integer(v.lapses,0,1000000)
  && integer(v.state,0,3) && (v.reps===0 ? v.state===0 && v.last_review===undefined : validISO(v.last_review)) && v.lapses<=v.reps;
}
export function validateStudyCard(v:unknown):v is StudyCard {return record(v) && validateSchedule(v.schedule) && integer(v.revision,0,1000000) && typeof v.suspended==="boolean" && validISO(v.createdAt) && validISO(v.updatedAt) && validateCardContent(v);}
export function validateReview(v:unknown):v is CardReview {
 return record(v) && validCardId(v.id) && validCardId(v.cardId) && categories.includes(v.category) && ["production","recognition"].includes(v.mode) && text(v.siblingKey,700)
  && integer(v.rating,1,4) && number(v.elapsedSeconds,0,600) && validISO(v.reviewedAt) && validISO(v.dueAtReview) && validISO(v.nextDue) && validateSchedule(v.previousSchedule)
  && typeof v.success==="boolean" && v.success===(v.rating!==1) && typeof v.delayedRecall==="boolean" && typeof v.isNew==="boolean" && v.isNew===(v.previousSchedule.reps===0)
  && v.delayedRecall===(!!v.previousSchedule.last_review && Date.parse(v.reviewedAt)-Date.parse(v.previousSchedule.last_review)>=86400000);
}
export function validateTransfer(v:unknown):v is CardTransfer {return record(v) && validCardId(v.id) && (v.cardId===undefined || validCardId(v.cardId)) && categories.includes(v.category) && ["production","recognition"].includes(v.mode) && validISO(v.date) && typeof v.success==="boolean" && text(v.note,3000,1);}
export function validateCardBackup(v:unknown):v is CardBackup {
 if (!record(v) || v.schemaVersion!==1 || !validISO(v.exportedAt) || !validateCardSettings(v.settings) || !Array.isArray(v.cards) || v.cards.length>20000 || !v.cards.every(validateStudyCard)
  || !Array.isArray(v.reviews) || v.reviews.length>200000 || !v.reviews.every(validateReview) || !Array.isArray(v.transfers) || v.transfers.length>20000 || !v.transfers.every(validateTransfer)) return false;
 const ids = new Set(v.cards.map((c:StudyCard)=>c.id));
 const byId = new Map<string,StudyCard>(v.cards.map((card:StudyCard)=>[card.id,card]));
 return ids.size===v.cards.length && new Set(v.reviews.map((r:CardReview)=>r.id)).size===v.reviews.length && new Set(v.transfers.map((t:CardTransfer)=>t.id)).size===v.transfers.length
  && v.reviews.every((r:CardReview)=>{const card=byId.get(r.cardId);return card && card.category===r.category && card.mode===r.mode;}) && v.transfers.every((t:CardTransfer)=>!t.cardId || byId.get(t.cardId)?.category===t.category);
}
export function serializeSchedule(card:FSRSCard):CardSchedule {const {due,last_review,...rest}=card;return {...rest,due:due.toISOString(),...(last_review?{last_review:last_review.toISOString()}:{})};}
export function newCard(content:CardContent,now=new Date()):StudyCard {return {...content,schedule:serializeSchedule(createEmptyCard(now)),revision:0,suspended:false,createdAt:now.toISOString(),updatedAt:now.toISOString()};}
export function siblingKey(card:CardContent) {return [card.deck,card.category,(card.lemma || card.prompt).normalize("NFKC").toLowerCase().trim()].join("|");}
const dayFormatters=new Map<string,Intl.DateTimeFormat>();
export function dayKey(date:Date|string,timezone:string):string {
 let formatter=dayFormatters.get(timezone);if(!formatter){formatter=new Intl.DateTimeFormat("en-GB",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit"});dayFormatters.set(timezone,formatter);}
 const parts=formatter.formatToParts(new Date(date));
 return ["year","month","day"].map(type=>parts.find(part=>part.type===type)!.value).join("-");
}
export function scheduleReview(card:StudyCard,rating:1|2|3|4,settings:CardSettings,eventId:string,elapsedSeconds:number,now=new Date()):{card:StudyCard;review:CardReview} {
 if (!validateStudyCard(card) || !validateCardSettings(settings) || !validCardId(eventId) || !integer(rating,1,4) || !number(elapsedSeconds,0,600)) throw new Error("Datos de repaso no válidos.");
 if (card.suspended) throw new Error("Esta tarjeta está suspendida.");
 if (Date.parse(card.schedule.due)>now.getTime()) throw new Error("El siguiente repaso de esta tarjeta todavía no vence.");
 const scheduler=fsrs({request_retention:settings.retention,maximum_interval:settings.maxIntervalDays,enable_fuzz:true,enable_short_term:true,learning_steps:settings.learningSteps,relearning_steps:settings.relearningSteps});
 const hydrated={...card.schedule,due:new Date(card.schedule.due),last_review:card.schedule.last_review?new Date(card.schedule.last_review):undefined};
 const next=serializeSchedule(scheduler.next(hydrated,now,rating as Grade).card);
 const reviewedAt=now.toISOString();
 return {card:{...card,schedule:next,revision:card.revision+1,updatedAt:reviewedAt},review:{id:eventId,cardId:card.id,category:card.category,mode:card.mode,siblingKey:siblingKey(card),rating,elapsedSeconds,reviewedAt,dueAtReview:card.schedule.due,previousSchedule:card.schedule,nextDue:next.due,success:rating!==1,delayedRecall:!!card.schedule.last_review && now.getTime()-Date.parse(card.schedule.last_review)>=86400000,isNew:card.schedule.reps===0}};
}
export type CardSummary = ReturnType<typeof cardSummary>;
export function cardSummary(cards:StudyCard[],reviews:CardReview[],settings:CardSettings,now=new Date()) {
 const todayKey=dayKey(now,settings.timezone),today=reviews.filter(r=>dayKey(r.reviewedAt,settings.timezone)===todayKey),active=cards.filter(c=>!c.suspended);
 const recent=reviews.filter(r=>r.delayedRecall && now.getTime()-Date.parse(r.reviewedAt)<=14*86400000);
 const measure=(items:CardReview[])=>({total:items.length,correct:items.filter(r=>r.success).length,rate:items.length?items.filter(r=>r.success).length/items.length:null});
 const firstReview=reviews.reduce((first,r)=>Math.min(first,Date.parse(r.reviewedAt)),now.getTime());
 const overdueCount=active.filter(c=>c.schedule.reps>0 && Date.parse(c.schedule.due)<=now.getTime()-86400000).length;
 const seconds=today.reduce((s,r)=>s+r.elapsedSeconds,0),delayed={...measure(recent),distinctCards:new Set(recent.map(r=>r.cardId)).size,production:measure(recent.filter(r=>r.mode==="production")),recognition:measure(recent.filter(r=>r.mode==="recognition"))};
 const dayTotals=new Map<string,number>();for(const review of reviews){const key=dayKey(review.reviewedAt,settings.timezone);dayTotals.set(key,(dayTotals.get(key)||0)+review.elapsedSeconds);}
 // Subtract calendar dates rather than 24-hour instants across DST boundaries.
 const last14Keys=Array.from({length:14},(_,i)=>new Date(Date.parse(todayKey+"T12:00:00.000Z")-i*86400000).toISOString().slice(0,10)),dailySeconds=last14Keys.map(key=>dayTotals.get(key)||0);
 const activeDays=dailySeconds.filter(value=>value>0).length,sortedSeconds=[...dailySeconds].sort((a,b)=>a-b),medianDailySeconds=(sortedSeconds[6]+sortedSeconds[7])/2;
 let suggestion:{kind:"collect"|"reduce"|"maintain"|"increase";text:string}={kind:"collect",text:"Mantén la carga inicial hasta reunir 14 días y 50 recuperaciones diferidas; las primeras exposiciones no miden retención."};
 if (overdueCount>0) suggestion={kind:"reduce",text:"Hay repasos con al menos un día de retraso. Se pausan las tarjetas nuevas hasta recuperar esos repasos."};
 else if (now.getTime()-firstReview>=14*86400000 && delayed.total>=50) {
  if ((delayed.rate??0)<.8) suggestion={kind:"reduce",text:"La recuperación diferida está por debajo del 80 %. Reduce o pausa las nuevas y revisa las tarjetas ambiguas o con olvidos repetidos."};
  else if ((delayed.rate??0)>=.9 && activeDays>=12 && medianDailySeconds<settings.budgetMinutes*45) suggestion={kind:"increase",text:"Puedes probar 2 tarjetas nuevas más al día durante una semana si encaja con tu carga de Reading y Writing. Hay al menos 12 días activos de los últimos 14 y margen en la mediana diaria. El ajuste es opcional."};
  else suggestion={kind:"maintain",text:"Mantén la configuración y vuelve a revisar la retención y el tiempo dentro de una semana."};
 }
 return {total:cards.length,active:active.length,newCount:active.filter(c=>c.schedule.reps===0).length,dueCount:active.filter(c=>c.schedule.reps>0 && Date.parse(c.schedule.due)<=now.getTime()).length,overdueCount,suspended:cards.length-active.length,lapses:cards.reduce((s,c)=>s+c.schedule.lapses,0),totalReviews:reviews.length,totalSeconds:reviews.reduce((sum,r)=>sum+r.elapsedSeconds,0),activeDays,medianDailySeconds,today:{newCount:today.filter(r=>r.isNew).length,reviews:today.length,seconds,newByCategory:Object.fromEntries(categories.map(cat=>[cat,today.filter(r=>r.isNew && r.category===cat).length])) as Record<CardCategory,number>},delayed,suggestion,newPaused:overdueCount>0,budgetReached:seconds>=settings.budgetMinutes*60};
}
export function buildCardQueue(cards:StudyCard[],reviews:CardReview[],settings:CardSettings,now=new Date(),limit=50):StudyCard[] {
 const summary=cardSummary(cards,reviews,settings,now),today=dayKey(now,settings.timezone),buried=new Map<string,Set<string>>();
 for (const review of reviews.filter(r=>dayKey(r.reviewedAt,settings.timezone)===today)) {const group=buried.get(review.siblingKey)||new Set<string>();group.add(review.cardId);buried.set(review.siblingKey,group);}
 const allowed=(c:StudyCard)=>!c.suspended && (!buried.has(siblingKey(c)) || buried.get(siblingKey(c))!.has(c.id));
 const due=cards.filter(c=>allowed(c) && c.schedule.reps>0 && Date.parse(c.schedule.due)<=now.getTime()).sort((a,b)=>Date.parse(a.schedule.due)-Date.parse(b.schedule.due));
 const queue:StudyCard[]=[];const groups=new Set<string>();
 for (const card of due) {if(!groups.has(siblingKey(card))){queue.push(card);groups.add(siblingKey(card));}if(queue.length>=limit)return queue;}
 if (summary.newPaused || summary.budgetReached) return queue;
 let remaining=Math.max(0,settings.newPerDay-summary.today.newCount);
 const allocations={...settings.allocations};for(const cat of categories)allocations[cat]=Math.max(0,allocations[cat]-summary.today.newByCategory[cat]);
 for (const card of cards.filter(c=>allowed(c) && c.schedule.reps===0).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))) {
  if (remaining<=0 || queue.length>=limit) break;
  if (allocations[card.category]>0 && !groups.has(siblingKey(card))) {queue.push(card);groups.add(siblingKey(card));allocations[card.category]--;remaining--;}
 }
 return queue;
}
