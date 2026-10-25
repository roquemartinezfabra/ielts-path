import curriculum from "../data/curriculum.json";
import readingData from "../data/reading.json";
import routeData from "../data/learning-map.json";
import {readingMark,validateFeedback,wordCount,type Attempt,type BandKey,type StudyState} from "./domain";
import {writingTasksForResource} from "./writing-resources";

export type ScenarioId="current_9h"|"recommended_12h"|"intensive_15h";
export type PlanEvidence={id:string;date:string;skillId:string;kind:"production"|"transfer";attemptId?:string;noteId?:string;anchorDate?:string;anchorAttemptId?:string;anchorNoteId?:string;independent:boolean;help:boolean;note:string;resourceId?:string;exposure?:"unseen"|"seen"|"unknown";conditions?:"exam"|"practice"|"unknown";outcome?:"met"|"retry"};
export type StoredLearningPlan={scenario:ScenarioId;activatedAt:string;objectives:{id:string;skillId:string;createdAt:string;status:"active"|"done";note?:string}[];reviews:{id:string;date:string;decision:"keep"|"method"|"increase"|"redistribute";note:string}[];evidence:PlanEvidence[]};
type Conditions={exposure:"unseen"|"seen"|"unknown";assistance:"none"|"allowed"|"unknown";timing:"continuous"|"resumed"|"unknown";openedAt?:string};
type ContextAttempt=Attempt&{conditions?:Conditions};
export type LearningState=StudyState&{learningPlan?:StoredLearningPlan;resourceExposures?:{resourceId:string;date:string;reason:"opened"|"solution"}[]};
export type LearningMapEntry={skillId:string;title:string;group:string;layer:string;layers:string[];prerequisiteSkillIds:string[];prerequisitePolicy:string;gateProfile:string;transferTarget:string;initialFocus:boolean};
export const learningMap:LearningMapEntry[]=routeData;
const mapped=new Map(learningMap.map(item=>[item.skillId,item]));
const allReading=new Map([...readingData.tests,...readingData.drills].map(test=>["reading:"+test.id,test]));
const writingTasks=new Map(curriculum.writingTasks.map(task=>[task.id,task]));
const DAY=86400000;
const bands:BandKey[]=["ta","cc","lr","gra"];
const validDate=(date:string|undefined):date is string=>typeof date==="string"&&Number.isFinite(Date.parse(date));
const content=(text:unknown):text is string=>typeof text==="string"&&!!text.trim();
const round=(n:number)=>Math.round(n*10)/10;
const dateSort=(a:{date:string},b:{date:string})=>Date.parse(a.date)-Date.parse(b.date);
const futureISO=(date:string,days:number)=>new Date(Date.parse(date)+days*DAY).toISOString();

export type WeeklyBudget={id:ScenarioId;title:string;totalMinutes:number;existingCardsMinutes:number;readingWritingMinutes:number;externalMinutes:number;allSkillsMinutes:number;blocks:{id:string;label:string;minutes:number}[];proposed:boolean;phase:"cycle"|"diagnostic"};
const blockNames=["Recuperación diferida","Gramática en contexto: hasta dos patrones","Reading nuevo","Evidencia y revisión de Reading","Lectura accesible por significado","Writing independiente y aplicación","Feedback y reescritura","Transferencia a contexto nuevo","Decisión semanal","Reserva"];
const blockIds=["recall","grammar","reading","reading-review","extensive-reading","writing","writing-review","transfer","weekly-review","buffer"];
const definitions:{id:ScenarioId;title:string;minutes:number;blocks:number[]}[]=[
 {id:"current_9h",title:"Horario actual · 9 h",minutes:540,blocks:[20,60,40,40,30,60,90,25,15,20]},
 {id:"recommended_12h",title:"Inicio propuesto · 12 h",minutes:720,blocks:[30,80,60,60,45,90,130,40,20,25]},
 {id:"intensive_15h",title:"Intensivo propuesto · 15 h",minutes:900,blocks:[35,100,90,80,60,120,160,55,25,35]}
];
/** Read card settings, never change them. Blocks use only the remaining R/W budget. */
export function weeklyBudgets(cardBudgetMinutes=20):WeeklyBudget[]{
 const cards=Math.round((Number.isFinite(cardBudgetMinutes)?Math.min(120,Math.max(5,cardBudgetMinutes)):20)*7);
 return definitions.map(def=>{
  const total=Math.max(def.minutes,cards),available=total-cards,base=def.blocks.reduce((s,n)=>s+n,0);
  const amounts=def.blocks.map(n=>Math.floor(n*available/base));
  amounts[amounts.length-1]+=available-amounts.reduce((s,n)=>s+n,0);
  return {id:def.id,title:cards>def.minutes?def.title+" · tarjetas exceden esta carga":def.title,totalMinutes:total,existingCardsMinutes:cards,readingWritingMinutes:available,externalMinutes:120,allSkillsMinutes:total+120,blocks:amounts.map((minutes,i)=>({id:blockIds[i],label:blockNames[i],minutes})),proposed:def.id!=="current_9h",phase:"cycle"};
 });
}
export function createLearningPlan(scenario:ScenarioId="recommended_12h",now=Date.now()):StoredLearningPlan{return {scenario,activatedAt:new Date(now).toISOString(),objectives:[],reviews:[],evidence:[]};}
function madridDate(now:number){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function remainingStudyDays(examDate:string,now=Date.now()):number|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(examDate)||!Number.isFinite(now))return null;
 const target=Date.parse(examDate+"T00:00:00Z");
 if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==examDate)return null;
 return Math.round((target-Date.parse(madridDate(now)+"T00:00:00Z"))/DAY);
}
function attemptHasContent(a:Attempt){
 if(a.type==="reading"){const test=allReading.get(a.resourceId);return !!test&&test.questions.some(q=>content(a.answers?.[String(q.id)]));}
 if(a.type==="writing")return Object.entries(a.taskTexts||{}).some(([id,text])=>writingTasks.has(id)&&content(text));
 return Object.values(a.answers||{}).some(content);
}
function resourceIds(id:string){return new Set([id,...writingTasksForResource(id).map(task=>task.id)]);}
function overlaps(a:Set<string>,b:Set<string>){return [...a].some(id=>b.has(id));}
function exposureIds(a:Attempt){return new Set([...resourceIds(a.resourceId),...(a.type==="writing"?Object.keys(a.taskTexts||{}):[])]);}
function priorExposure(state:LearningState,a:ContextAttempt){
 const ids=exposureIds(a),end=Date.parse(a.date);
 if(state.attempts.some(other=>other.id!==a.id&&validDate(other.date)&&Date.parse(other.date)<=end&&attemptHasContent(other)&&overlaps(ids,exposureIds(other))))return true;
 const events=(state.resourceExposures||[]).filter(e=>validDate(e.date)&&Date.parse(e.date)<=end&&overlaps(ids,resourceIds(e.resourceId)));
 // Ignore the exact opening of this session, never earlier openings or solutions.
 return events.some(e=>e.reason==="solution"||e.reason==="opened"&&(!validDate(a.conditions?.openedAt)||Date.parse(e.date)!==Date.parse(a.conditions.openedAt)));
}
function independentStatus(state:LearningState,a:ContextAttempt){
 if(a.parentId||a.mode!=="exam")return {status:"provisional" as const,reason:"Práctica o repetición; útil para orientar, sin diagnóstico independiente confirmado."};
 if(priorExposure(state,a)||a.conditions?.exposure==="seen")return {status:"provisional" as const,reason:"Hay exposición previa. Hace falta otra tarea para un control nuevo."};
 const c=a.conditions;
 if(c?.exposure!=="unseen"||c.assistance!=="none"||c.timing!=="continuous")return {status:"provisional" as const,reason:"Ayuda, primera exposición o condiciones desconocidas. No se reconstruyen retrospectivamente."};
 return {status:"confirmed" as const,reason:"Primera exposición, sin ayuda y tiempo continuo declarados. No equivale a una banda oficial."};
}
export type EvidenceStatus="missing"|"provisional"|"confirmed";
export type WritingEvidence={attemptId:string;taskId:string;wordCount:number;estimate:number|null;status:EvidenceStatus;reason:string};
export type DiagnosticOverview={reading:{status:EvidenceStatus;attemptId?:string;score?:number;total?:number;reason:string;completeResource:boolean};writing:{status:EvidenceStatus;reason:string;task1:WritingEvidence|null;task2:WritingEvidence|null;fullEstimate:number|null};emptyAttempts:number};
export function diagnosticEvidence(state:LearningState):DiagnosticOverview{
 const valid=state.attempts.filter(a=>a.completed&&validDate(a.date)&&attemptHasContent(a)).slice().sort(dateSort);
 const reads=valid.filter(a=>a.type==="reading").map(attempt=>{
  const test=allReading.get(attempt.resourceId)!,completeResource=test.questions.length===40,c=independentStatus(state,attempt);
  return {attempt,status:completeResource?c.status:"provisional" as const,reason:completeResource?c.reason:"Fragmento o drill: puntuación por preguntas, sin normalizar a /40 ni a una banda.",completeResource,score:readingMark(test,attempt.answers||{}).filter((m:{correct:boolean})=>m.correct).length,total:test.questions.length};
 });
 // Classify eligible candidates before deduplicating, so empty entries consume no resource.
 const seen=new Set<string>();
 const confirmed=reads.filter(r=>{if(r.status!=="confirmed"||seen.has(r.attempt.resourceId))return false;seen.add(r.attempt.resourceId);return true;});
 const reading=confirmed[0]||reads.at(-1);
 const writes=valid.filter(a=>a.type==="writing");
 const pieces=writes.flatMap(a=>Object.entries(a.taskTexts||{}).filter(([id,text])=>writingTasks.has(id)&&content(text)).map(([id,text])=>{
  const f=a.feedback?.[id],reviewed=!!f&&validateFeedback(f),c=independentStatus(state,a);
  return {attemptId:a.id,taskId:id,wordCount:wordCount(text),estimate:reviewed?bands.reduce((s,key)=>s+f.bands[key],0)/4:null,status:reviewed?c.status:"provisional" as const,reason:reviewed?c.reason:"Producción real pendiente de feedback válido; no asignar banda sin revisión."};
 }));
 const latestPiece=(type:string)=>{const found=pieces.filter(p=>writingTasks.get(p.taskId)?.type===type);return found.slice().reverse().find(p=>p.estimate!==null)||found.at(-1)||null;};
 const full=writes.map(a=>{
  const entries=Object.entries(a.taskTexts||{}).filter(([id,text])=>writingTasks.has(id)&&content(text));
  const one=entries.find(([id])=>writingTasks.get(id)?.type==="task1"),two=entries.find(([id])=>writingTasks.get(id)?.type==="task2");
  if(!one||!two||entries.length!==2||!validateFeedback(a.feedback?.[one[0]])||!validateFeedback(a.feedback?.[two[0]]))return null;
  const first=pieces.find(p=>p.attemptId===a.id&&p.taskId===one[0])!,second=pieces.find(p=>p.attemptId===a.id&&p.taskId===two[0])!;
  return {status:independentStatus(state,a).status,estimate:(first.estimate!+2*second.estimate!)/3,first,second};
 }).filter((item):item is NonNullable<typeof item>=>!!item);
 const paired=full.find(p=>p.status==="confirmed")||full.at(-1),task1=paired?.first||latestPiece("task1"),task2=paired?.second||latestPiece("task2");
 return {reading:reading?{status:reading.status,attemptId:reading.attempt.id,score:reading.score,total:reading.total,reason:reading.reason,completeResource:reading.completeResource}:{status:"missing",reason:"Hace falta una muestra Reading con respuestas reales. Un registro vacío no mide nivel cero.",completeResource:false},writing:{status:paired?.status||((task1||task2)?"provisional":"missing"),task1,task2,fullEstimate:paired?.estimate??null,reason:paired?"Ambas tareas tienen texto y feedback; Task 2 pesa doble. Las condiciones determinan si es un control independiente.":"Writing completo pendiente. La evidencia parcial orienta cada tarea; una tarea vacía no mide competencia lingüística."},emptyAttempts:state.attempts.filter(a=>(a.type==="reading"||a.type==="writing")&&!attemptHasContent(a)).length};
}
export type ResourceContext={id:string;type:"reading"|"writing";taskType?:string;title:string;questionCount?:number;seen:boolean;exposure:"seen"|"unknown";independentCandidate:boolean};
export function resourceContext(state:LearningState):ResourceContext[]{
 const seen=new Set<string>();
 for(const a of state.attempts)if(attemptHasContent(a))for(const id of exposureIds(a))seen.add(id);
 for(const e of state.resourceExposures||[])for(const id of resourceIds(e.resourceId))seen.add(id);
 for(const draft of Object.values(state.drafts))for(const id of resourceIds(draft.resourceId))seen.add(id);
 const list:Omit<ResourceContext,"seen"|"exposure"|"independentCandidate">[]=[...[...allReading].map(([id,test])=>({id,type:"reading" as const,title:test.title,questionCount:test.questions.length})),...curriculum.writingTasks.map(t=>({id:t.id,type:"writing" as const,title:t.title,taskType:t.type}))];
 return list.map(r=>({...r,seen:seen.has(r.id),exposure:seen.has(r.id)?"seen":"unknown",independentCandidate:!seen.has(r.id)}));
}
export type GateProgress={status:"needs-production"|"needs-transfer"|"transfer-recorded"|"needs-review"|"retry";title:string;detail:string;anchorDate?:string;dueDate?:string;transferCount?:number};
function linkedEvidence(state:LearningState,e:PlanEvidence){
 const attempt=e.attemptId?state.attempts.find(a=>a.id===e.attemptId):undefined,note=e.noteId?state.learningNotes?.find(n=>n.id===e.noteId):undefined;
 const group=mapped.get(e.skillId)?.group;
 const noteReal=!!note&&content(note.text)&&((note.kind==="lesson-application"||note.kind==="grammar")?note.resourceId===e.skillId:note.kind==="reading"&&group==="reading");
 const attemptReal=!!attempt&&attemptHasContent(attempt)&&(group==="reading"?attempt.type==="reading":attempt.type==="writing"&&(group!=="task1"&&group!=="task2"||Object.entries(attempt.taskTexts||{}).some(([id,text])=>content(text)&&writingTasks.get(id)?.type===group)));
 let sourceDate=noteReal?note!.date:attemptReal?attempt!.date:undefined;
 const openedAt=(attempt as ContextAttempt|undefined)?.conditions?.openedAt;
 // A delayed click on Save after timeout must not manufacture seven days of retention.
 if(!noteReal&&attemptReal&&attempt!.mode==="exam"&&validDate(openedAt)&&validDate(sourceDate))sourceDate=new Date(Math.min(Date.parse(sourceDate),Date.parse(openedAt)+attempt!.elapsedSeconds*1000)).toISOString();
 const assistanceKnown=noteReal?note!.mode==="independent":!!attempt&&(attempt as ContextAttempt).conditions?.assistance==="none";
 const declaredExposure=(attempt as ContextAttempt|undefined)?.conditions?.exposure;
 return {attempt,note,sourceDate,assistanceKnown,real:!!sourceDate&&validDate(sourceDate)&&Date.parse(sourceDate)<=Date.parse(e.date),repeated:declaredExposure==="seen"||!!(attempt&&(attempt.parentId||attempt.mode==="revision"||priorExposure(state,attempt)))||note?.mode==="assisted"};
}
function teachingEvents(state:LearningState,skillId:string){
 const group=mapped.get(skillId)?.group;
 const events:{date:string;attemptId?:string;noteId?:string}[]=[];
 for(const note of state.learningNotes||[])if(note.resourceId===skillId&&validDate(note.review?.date))events.push({date:note.review.date,noteId:note.id,attemptId:note.attemptId});
 for(const a of state.attempts){
  if(group==="reading"&&a.readingFeedback&&validDate(a.readingFeedback.date)){
   const test=allReading.get(a.resourceId),related=test?.questions.some(q=>a.readingFeedback!.observations.some(o=>o.questionId===String(q.id))&&readingSkillIds(q.type,q.instruction).includes(skillId));
   const priority=a.readingFeedback.priorities.join(" ");
   const matches=(skillId==="r-time-instructions"&&/l[ií]mite|word limit|consigna|ortograf/i.test(priority))||(skillId==="r-inference"&&/atribuci|autor|voces|referente/i.test(priority))||(skillId==="r-true-false-ng"&&/contradic|negaci|not given|ausencia/i.test(priority));
   if(related||matches)events.push({date:a.readingFeedback.date,attemptId:a.id});
  }
  for(const [id,f] of Object.entries(a.feedback||{})){
   const date=(f as typeof f&{reviewedAt?:string}).reviewedAt;
   if(validDate(date)&&content(a.taskTexts?.[id])&&(f.errors?.some(error=>error.skillId===skillId)||(group==="task1"||group==="task2")&&writingTasks.get(id)?.type===group))events.push({date,attemptId:a.id});
  }
 }
 return events;
}
function anchorEvents(state:LearningState,e:PlanEvidence):string[]{
 return teachingEvents(state,e.skillId).filter(event=>(e.anchorNoteId?event.noteId===e.anchorNoteId:!!e.anchorAttemptId&&event.attemptId===e.anchorAttemptId)).map(event=>event.date);
}
export function gateProgress(state:LearningState,skillId:string,now=Date.now()):GateProgress{
 const records=(state.learningPlan?.evidence||[]).filter(e=>e.skillId===skillId&&validDate(e.date)&&Date.parse(e.date)<=now).slice().sort(dateSort);
 if(!records.length)return {status:"needs-production",title:"Producción pendiente",detail:"Recupera el significado y produce un ejemplo propio. Un quiz o un estado manual no acredita uso independiente."};
 if(records.at(-1)?.outcome==="retry")return {status:"retry",title:"Volver al punto que falla",detail:"El último resultado declarado pide otro intento. Cambia contraste, ayuda o feedback; no repitas todo el catálogo."};
 const anchors=teachingEvents(state,skillId).map(event=>event.date).filter(date=>Date.parse(date)<=now).sort((a,b)=>Date.parse(a)-Date.parse(b));
 const latestAnchor=anchors.at(-1);
 const usable=records.filter(e=>{const source=linkedEvidence(state,e);return e.independent&&!e.help&&e.outcome==="met"&&source.real&&source.assistanceKnown&&!source.repeated;});
 const transfers=usable.filter(e=>{const source=linkedEvidence(state,e);return e.kind==="transfer"&&e.exposure==="unseen"&&validDate(e.anchorDate)&&validDate(source.sourceDate)&&anchorEvents(state,e).some(date=>Date.parse(date)===Date.parse(e.anchorDate!))&&Date.parse(source.sourceDate)-Date.parse(e.anchorDate)>=7*DAY&&(!latestAnchor||Date.parse(e.anchorDate)>=Date.parse(latestAnchor));});
 const distinct=new Set(transfers.map(e=>e.attemptId?"attempt:"+e.attemptId:"note:"+e.noteId));
 if(distinct.size)return {status:"transfer-recorded",title:"Transferencia declarada registrada",detail:`${distinct.size} muestra(s) vinculada(s), contexto nuevo y enseñanza fechada. ${distinct.size<2?"Comprueba otra muestra independiente.":"Mantén comprobaciones posteriores."} No marca dominio ni aísla el efecto de práctica intermedia.`,anchorDate:transfers.at(-1)?.anchorDate,transferCount:distinct.size};
 const production=usable.filter(e=>e.kind==="production").at(-1);
 if(production)return {status:"needs-transfer",title:"Probar otro contexto después",detail:latestAnchor?"Prueba un contexto nuevo al menos siete días desde enseñanza/feedback del ciclo; registra práctica intermedia.":"Falta una fecha real de enseñanza/feedback del ciclo. No se inventa desde la fecha del intento.",...(latestAnchor?{anchorDate:latestAnchor,dueDate:futureISO(latestAnchor,7)}:{})};
 return {status:"needs-review",title:"Revisar la evidencia",detail:"Vincula producción real y contrasta el resultado. Ayuda, repetición o condiciones insuficientes no comprueban transferencia independiente.",...(latestAnchor?{anchorDate:latestAnchor,dueDate:futureISO(latestAnchor,7)}:{})};
}
export type ObjectiveRecommendation={id:string;skillId:string;title:string;group:string;layer:string;reason:string;nextAction:string;expectedOutput:string;minutes:number;resourceId?:string;gate:GateProgress;prerequisites:{skillId:string;title:string}[];manualStatus:string};
function readingSkillIds(type:string,instruction:string){
 if(type==="tfng")return ["r-true-false-ng","r-paraphrase"];
 if(type==="ynng")return ["r-yes-no-ng","r-inference"];
 if(type==="choice")return ["r-multiple-choice","r-paraphrase"];
 if(type==="matching")return /heading/i.test(instruction)?["r-matching","r-main-ideas"]:["r-matching","r-scanning"];
 if(/diagram|answer the question/i.test(instruction))return ["r-diagrams-short","r-scanning"];
 return ["r-completion","r-time-instructions"];
}
export function selectObjectives(state:LearningState,now=Date.now()):ObjectiveRecommendation[]{
 const ranking=new Map<string,{weight:number;reason:string}>();
 const add=(id:string,weight:number,reason:string)=>{if(mapped.has(id)){const current=ranking.get(id);ranking.set(id,{weight:(current?.weight||0)+weight,reason:current&&current.weight>=weight?current.reason:reason});}};
 for(const o of state.learningPlan?.objectives||[])if(o.status==="active")add(o.skillId,1000,"Objetivo activo elegido para este ciclo.");
 const writes=state.attempts.filter(a=>a.type==="writing"&&attemptHasContent(a)).slice().sort(dateSort).reverse().slice(0,3);
 for(const a of writes)for(const [id,f] of Object.entries(a.feedback||{})){
  if(!content(a.taskTexts?.[id])||!validateFeedback(f))continue;
  for(const error of f.errors||[])if(error.skillId)add(error.skillId,25,"Patrón señalado en feedback de una producción real; comprobar si persiste en otro contexto.");
  const one=writingTasks.get(id)?.type==="task1";
  const related:Record<BandKey,string[]>={ta:one?["t1-purpose","t1-bullet-development"]:["t2-question","t2-support"],cc:one?["t1-paragraphs"]:["t2-paragraph","t2-structure"],lr:["v-collocations","v-accuracy"],gra:["g-agreement-pronouns","g-word-order"]};
  for(const key of bands)if(f.bands[key]<state.profile.target)related[key].forEach((skill,i)=>add(skill,(state.profile.target-f.bands[key])*(one?2:3)-i,"Criterio del tutor pendiente de desarrollo; verificar con tarea nueva, sin banda automática."));
 }
 const read=state.attempts.filter(a=>a.type==="reading"&&attemptHasContent(a)).slice().sort(dateSort).at(-1);
 if(read){const test=allReading.get(read.resourceId)!,marks=readingMark(test,read.answers||{});test.questions.forEach((q,i)=>{if(!marks[i].correct)readingSkillIds(q.type,q.instruction).forEach((id,index)=>add(id,index?2:5,"Error Reading con respuesta real; contrastar comprensión, evidencia y consigna en otro texto."));});
  for(const text of read.readingFeedback?.priorities||[]){
   if(/l[ií]mite|word limit|consigna|ortograf/i.test(text))add("r-time-instructions",20,"El feedback prioriza consignas y límites de respuesta.");
   if(/contradic|negaci|not given|ausencia/i.test(text))add("r-true-false-ng",20,"El feedback prioriza negación, contradicción y ausencia de evidencia.");
   if(/atribuci|autor|voces|referente/i.test(text))add("r-inference",20,"El feedback prioriza atribuir evidencia y seguir voces.");
  }
 }
 const d=diagnosticEvidence(state);
 if(!d.writing.task2)add("t2-question",8,"Task 2 necesita una producción: analizar obligaciones y escribir sin modelo.");
 if(!d.writing.task1)add("t1-purpose",6,"Obtener una carta propia con propósito y petición claros.");
 for(const id of ["g-word-order","g-be-auxiliaries","t2-paragraph","t1-bullet-development","r-time-instructions","r-inference"])if(state.skills[id]?.status!=="mastered")add(id,1,"Sonda breve para decidir qué explicación hace falta; omitir repaso si ya lo aplicas.");
 const ranked=[...ranking].sort((a,b)=>b[1].weight-a[1].weight),resources=resourceContext(state);
 const chosen=[...ranked.filter(([id])=>mapped.get(id)?.group!=="reading").slice(0,2),...ranked.filter(([id])=>mapped.get(id)?.group==="reading").slice(0,1)];
 return chosen.map(([skillId,candidate])=>{
  const skill=mapped.get(skillId)!,gate=gateProgress(state,skillId,now),read=skill.group==="reading",write=skill.group==="task1"||skill.group==="task2";
  const links=curriculum.skills.find(s=>s.id===skillId)?.practice?.map(p=>p.resourceId)||[];
  const relevant=(r:ResourceContext)=>links.includes(r.id)||["r-skimming","r-scanning","r-time-instructions"].includes(skillId)||allReading.get(r.id)?.questions.some(q=>readingSkillIds(q.type,q.instruction).includes(skillId));
  // Short objective practice must not consume a fresh full diagnostic in a practice session.
  const resource=read?resources.find(r=>r.type==="reading"&&(r.questionCount||0)<40&&r.independentCandidate&&relevant(r)):write?resources.find(r=>r.taskType===skill.group&&r.independentCandidate):undefined;
  const action=gate.status==="needs-transfer"?"En otra sesión, aplica el objetivo en un tema/texto nuevo sin modelo; comprueba la fecha del ciclo.":gate.status==="transfer-recorded"?"Comprueba otra producción independiente. Registrar transferencia no cierra automáticamente el objetivo.":gate.status==="retry"?"Revisa el significado que falló, cambia una ayuda y produce otro ejemplo.":read?"Resuelve un fragmento nuevo, señala evidencia y explica un descarte; separa comprensión y consigna.":write?"Planifica propósito o postura, escribe y comprueba cada obligación antes de mirar un modelo.":"Explica dos contrastes y escribe cuatro mensajes nuevos sin copiar; aplica después el patrón en un párrafo.";
  return {id:"objective:"+skillId,skillId,title:skill.title,group:skill.group,layer:skill.layer,reason:candidate.reason,nextAction:action,expectedOutput:read?"Respuestas con evidencia textual y motivo del error.":write?"Texto propio, plan breve y revisión; reescritura separada.":"Mensajes propios y párrafo aplicado con feedback del patrón.",minutes:read?(resource?allReading.get(resource.id)?.minutes||15:25):write?(skill.group==="task1"?20:40):25,...(resource?{resourceId:resource.id}:{}),gate,prerequisites:skill.prerequisiteSkillIds.map(id=>({skillId:id,title:mapped.get(id)?.title||id})),manualStatus:state.skills[skillId]?.status||"pending"};
 });
}
export function weeklyReview(state:LearningState,now=Date.now()){
 const plan=state.learningPlan,last=plan?.reviews.filter(r=>validDate(r.date)&&Date.parse(r.date)<=now).slice().sort(dateSort).at(-1),anchor=last?.date||plan?.activatedAt,nextDate=validDate(anchor)?futureISO(anchor,7):null;
 return {due:!!nextDate&&Date.parse(nextDate)<=now,nextDate,latestDecision:last?.decision,message:!plan?"Activa un escenario para empezar; mostrar una propuesta no cambia tu perfil.":nextDate&&Date.parse(nextDate)<=now?"Revisión pendiente: compara producción nueva, cumplimiento, feedback y carga.":"Mantén el ciclo hasta la revisión, salvo necesidad de ajustar carga o feedback.",questions:["¿Completaste muestras dentro del tiempo disponible?","¿Mejoró una tarea nueva, además de la reescritura?","¿Se mantiene tras días y qué ayuda hubo?","Si cumpliste y no mejora, ¿qué técnica o feedback cambiarás?","Si funciona pero falta tiempo, ¿puedes sostener mayor carga? Si hay fatiga, redistribuye."]};
}
export function learningOverview(state:LearningState,now=Date.now(),cardBudgetMinutes=20){
 const budgets=weeklyBudgets(cardBudgetMinutes),plan=state.learningPlan,scenario=plan?.scenario||"recommended_12h",diagnostics=diagnosticEvidence(state);
 let selectedBudget=budgets.find(b=>b.id===scenario)||budgets[1];
 const firstWeek=plan&&validDate(plan.activatedAt)&&now-Date.parse(plan.activatedAt)<7*DAY;
 if(scenario==="recommended_12h"&&(!plan||firstWeek)&&!(diagnostics.reading.status==="confirmed"&&diagnostics.writing.status==="confirmed")&&selectedBudget.existingCardsMinutes===140){
  const labels=["Reading nuevo","Revisión Reading","Writing ambas tareas","Autolectura, feedback y reescritura","Sondas lingüísticas","Reparación en contexto","Lectura accesible","Aplicación nueva","Recuperación diferida","Inventario y decisión","Reserva"];
  selectedBudget={...selectedBudget,phase:"diagnostic",blocks:[60,60,60,120,30,70,45,30,15,50,40].map((minutes,i)=>({id:"diagnostic-"+i,label:labels[i],minutes}))};
 }
 const days=remainingStudyDays(state.profile.examDate,now),weeks=Math.max(0,days||0)/7;
 const externalObjectives=(["listening","speaking"] as const).map(skill=>({skill,title:skill==="listening"?"Comprender un audio nuevo":"Aplicar una prioridad al hablar",minutes:60,status:state.external.some(e=>e.skill===skill)?"recorded":"missing",nextAction:skill==="listening"?"Elige un error y compruébalo en otro audio; separa primer bruto/condiciones de escucha con pausa o transcripción. Si persiste, identifica segmentación, léxico o comprensión.":"Elige un criterio, recibe feedback con ejemplo y responde otra pregunta sin modelo. Registra ayuda y persistencia; incluye Easy Peasy/IA ya realizado en este tiempo."}));
 return {map:learningMap,budgets,scenario,selectedBudget,activated:!!plan,diagnostics,objectives:selectObjectives(state,now),weeklyReview:weeklyReview(state,now),resources:resourceContext(state),horizon:{days,weeks,examDate:state.profile.examDate,startDate:madridDate(now),availableHours:round(state.profile.weeklyHours*weeks),plannedHours:round(selectedBudget.totalMinutes/60*weeks),externalHours:round(2*weeks),lastDayLight:true},externalObjectives};
}
