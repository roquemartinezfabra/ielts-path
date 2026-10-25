import curriculum from "../data/curriculum.json";
import readingData from "../data/reading.json";
import {writingTasksForResource} from "./writing-resources";
export type BandKey = "ta" | "cc" | "lr" | "gra";
export type Feedback = { bands: Record<BandKey, number>; summary: string; evidence: string[]; priorities: string[]; errors?: {skillId?: string; original: string; corrected: string; rule: string}[]; model?: string;reviewedAt?:string };
export type ReadingFeedback = {date:string;summary:string;priorities:string[];observations:{questionId:string;feedback:string}[]};
export type AttemptConditions = {exposure:"unseen"|"seen"|"unknown";assistance:"none"|"allowed"|"unknown";timing:"continuous"|"resumed"|"unknown";openedAt?:string};
export type SessionDraft = {texts:Record<string,string>;startedAt:number;elapsedSeconds?:number;mode:"exam"|"practice"|"revision";resourceId:string;parentId?:string;transferFrom?:string;plans?:Record<string,string>;conditions?:AttemptConditions};
export type LessonSupport={hints:Record<string,number>;corrections:Record<string,string>;diagnostic:Record<string,string>;followups:Record<string,string>};
export type Attempt = { id: string; type: "reading" | "writing" | "lesson"; resourceId: string; lessonVersion?: 1 | 2 | 3; lessonVariant?:string;lessonSupport?:LessonSupport; title: string; date: string; mode: "exam" | "practice" | "revision"; elapsedSeconds: number; answers?: Record<string,string>; score?: number; total?: number; taskTexts?: Record<string,string>; feedback?: Record<string,Feedback>; readingFeedback?:ReadingFeedback; parentId?: string; transferFrom?:string; plans?:Record<string,string>;conditions?:AttemptConditions; completed: boolean };
export type LearningNote = {id:string;date:string;kind:"reading"|"grammar"|"writing-reflection"|"lesson-application";title:string;text:string;mode:"independent"|"assisted";resourceId?:string;attemptId?:string;reviewOf?:string;revisionOf?:string;minutes?:number;url?:string;difficulty?:"easy"|"suitable"|"hard";review?:{date:string;feedback:string}};
export type SkillProgress = {status: "pending" | "learning" | "mastered"; correct: number; total: number; lastDate?: string; nextReview?: string};
export type PlanEvidence={id:string;date:string;skillId:string;kind:"production"|"transfer";attemptId?:string;noteId?:string;anchorDate?:string;anchorAttemptId?:string;anchorNoteId?:string;independent:boolean;help:boolean;note:string;resourceId?:string;exposure?:"unseen"|"seen"|"unknown";conditions?:"exam"|"practice"|"unknown";outcome?:"met"|"retry"};
export type LearningPlan={scenario:"current_9h"|"recommended_12h"|"intensive_15h";activatedAt:string;objectives:{id:string;skillId:string;createdAt:string;status:"active"|"done";note?:string}[];reviews:{id:string;date:string;decision:"keep"|"method"|"increase"|"redistribute";note:string}[];evidence:PlanEvidence[]};
export type ExternalControl={id:string;date:string;skill:string;band?:number;source:string;feedback?:string;conditions?:string;nextObjective?:string;rawScore?:string};
export type StudyState = { foundationRoute?:{steps:Record<string,{theoryAt?:string;examplesAt?:string;completedAt?:string}>}; schemaVersion: 1; profile: {name: string; examDate: string; weeklyHours: number; target: number}; skills: Record<string,SkillProgress>; attempts: Attempt[]; official: {date: string; listening: number; reading: number; writing: number; speaking: number; source: string} | null; external: ExternalControl[]; journal: {id:string;date:string;minutes:number;note:string}[]; learningNotes?:LearningNote[];learningPlan?:LearningPlan;resourceExposures?:{resourceId:string;date:string;reason:"opened"|"solution"}[]; drafts: Record<string,SessionDraft> };
export const freshState = (): StudyState => ({schemaVersion:1,profile:{name:"Estudiante",examDate:"2027-01-15",weeklyHours:9,target:7.5},skills:{},attempts:[],official:null,external:[],journal:[],drafts:{}});
export const wordCount = (text:string) => text.trim() ? text.trim().split(/\s+/).length : 0;
export const normalize = (text:string) => text.toLowerCase().trim().replace(/\s+/g," ");
export function readingMark(test:any, answers:Record<string,string>) {return test.questions.map((q:any)=>({id:String(q.id),correct:(q.accepted?.length?q.accepted:[q.answer]).some((a:string)=>normalize(a)===normalize(answers[q.id]||""))}));}
const bandKeys: BandKey[] = ["ta", "cc", "lr", "gra"];
const modes = ["exam", "practice", "revision"];
const skillNames = ["listening", "reading", "writing", "speaking"];
const unsafeKeys = new Set(["__proto__", "constructor", "prototype"]);
const record = (v:any): v is Record<string,any> => !!v && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const text = (v:any, max:number, min=0): v is string => typeof v === "string" && v.length >= min && v.length <= max;
const key = (v:any): v is string => text(v,200,1) && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(v) && !unsafeKeys.has(v);
const finite = (v:any, min:number, max:number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const integer = (v:any, min:number, max:number): v is number => finite(v,min,max) && Number.isSafeInteger(v);
const band = (v:any): v is number => finite(v,0,9);
const optional = (v:any, check:(value:any)=>boolean) => v === undefined || check(v);
function dateOnly(v:any): v is string {
 if (!text(v,10,10) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
 const parsed = new Date(v + "T00:00:00.000Z");
 return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === v;
}
function dateValue(v:any): v is string {
 if (dateOnly(v)) return true;
 return text(v,40,20) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && dateOnly(v.slice(0,10)) && Number.isFinite(Date.parse(v));
}
function mapOf(v:any, check:(value:any,id:string)=>boolean, max:number, min=0) {
 if (!record(v)) return false;
 const entries = Object.entries(v);
 return entries.length >= min && entries.length <= max && entries.every(([id,value])=>key(id) && check(value,id));
}
const stringList = (v:any, count:number, length:number) => Array.isArray(v) && v.length <= count && v.every(x=>text(x,length));
const uniqueIds = (items:any[]) => items.every(x=>record(x)&&key(x.id))&&new Set(items.map(x=>x.id)).size === items.length;
const writingTasks = new Map(curriculum.writingTasks.map(task=>[task.id,task]));
const readingTests = new Map([...readingData.tests,...readingData.drills].map(test=>["reading:"+test.id,test]));
const writingTaskType = (id:string) => writingTasks.get(id)?.type || (/^w1(?:-|$)/.test(id) ? "task1" : /^w2(?:-|$)/.test(id) ? "task2" : null);
function resourceTextKeys(resourceId:string): string[] | null {
 const reading = readingTests.get(resourceId);
 if (reading) return reading.questions.map(q=>String(q.id));
 const task = writingTasks.get(resourceId);
 if (task) return [task.id];
 const pair=writingTasksForResource(resourceId);
 return pair.length ? pair.map(t=>t.id) : null;
}
function fullWriting(attempt:Attempt) {
 const tasks = Object.keys(attempt.taskTexts || {});
 return tasks.length === 2 && tasks.some(id=>writingTaskType(id)==="task1") && tasks.some(id=>writingTaskType(id)==="task2");
}
export function writingBand(attempt:Attempt) {
 if (attempt.type !== "writing" || !record(attempt.taskTexts) || !record(attempt.feedback)) return null;
 const tasks = Object.keys(attempt.taskTexts);
 if (!tasks.length || tasks.length > 2 || (tasks.length === 2 && !fullWriting(attempt))) return null;
 if(tasks.some(id=>!attempt.taskTexts?.[id]?.trim())) return null;
 let sum = 0, weightTotal = 0;
 for (const id of tasks) {
  const type = writingTaskType(id), feedback = attempt.feedback[id];
  if (!type || !Object.hasOwn(attempt.feedback,id) || !validateFeedback(feedback)) return null;
  const weight = type === "task2" ? 2 : 1;
  const mean = bandKeys.reduce((total,k)=>total + feedback.bands[k],0) / 4;
  sum += weight * mean;
  weightTotal += weight;
 }
 return sum / weightTotal;
}
export function validateFeedback(value:any): value is Feedback {
 return record(value) && record(value.bands) && Object.keys(value.bands).length === 4 && bandKeys.every(k=>Object.hasOwn(value.bands,k) && band(value.bands[k]))
  && text(value.summary,12000) && stringList(value.evidence,100,8000) && stringList(value.priorities,30,4000)
  && optional(value.errors, errors=>Array.isArray(errors) && errors.length <= 100 && errors.every(error=>record(error) && optional(error.skillId,key) && text(error.original,8000) && text(error.corrected,8000) && text(error.rule,8000)))
  && optional(value.model, model=>text(model,40000)) && optional(value.reviewedAt,dateValue);
}
function validateAttempt(a:any): a is Attempt {
 if (!record(a) || !key(a.id) || !["reading","writing","lesson"].includes(a.type) || !key(a.resourceId) || !text(a.title,500,1)
  || !dateValue(a.date) || !modes.includes(a.mode) || !finite(a.elapsedSeconds,0,604800) || typeof a.completed !== "boolean"
  || !optional(a.parentId,id=>key(id) && id !== a.id)
  || !optional(a.lessonVersion,version=>a.type === "lesson" && integer(version,1,3))
  || !optional(a.lessonVariant,v=>a.type === "lesson" && a.resourceId === "g-word-order" && ["word-order-a-v1","word-order-b-v1"].includes(v))
  || !optional(a.lessonSupport,v=>a.type === "lesson" && record(v) && mapOf(v.hints,n=>integer(n,0,2),100) && ["corrections","diagnostic","followups"].every(k=>mapOf(v[k],x=>text(x,4000),100)))
  || !optional(a.transferFrom,id=>key(id) && id !== a.id)
  || !optional(a.conditions,validateConditions)
  || !optional(a.answers, answers=>mapOf(answers, answer=>text(answer,4000),1000))
  || !optional(a.taskTexts, tasks=>mapOf(tasks, answer=>text(answer,40000),2,1))
  || !optional(a.score, n=>integer(n,0,1000)) || !optional(a.total, n=>integer(n,0,1000))) return false;
 if ((a.score === undefined) !== (a.total === undefined) || (a.score !== undefined && a.score > a.total)) return false;
 if (a.type === "reading") {
  const test = readingTests.get(a.resourceId), allowed = resourceTextKeys(a.resourceId);
  if (!test || !allowed || !record(a.answers) || Object.keys(a.answers).some(id=>!allowed.includes(id)) || a.score === undefined || a.total !== test.questions.length) return false;
 }
 if (a.type === "writing") {
  const allowed = resourceTextKeys(a.resourceId);
  if (!allowed || readingTests.has(a.resourceId) || !record(a.taskTexts) || Object.keys(a.taskTexts).length !== allowed.length || !allowed.every(id=>Object.hasOwn(a.taskTexts,id))) return false;
  if (!optional(a.plans,plans=>mapOf(plans,(value,id)=>allowed.includes(id) && text(value,8000),2))) return false;
 }
 if (a.type !== "writing" && (a.plans !== undefined || a.transferFrom !== undefined)) return false;
 if (a.feedback !== undefined && (a.type !== "writing" || !mapOf(a.feedback,(f,id)=>Object.hasOwn(a.taskTexts,id) && validateFeedback(f),2))) return false;
 if (a.readingFeedback !== undefined && (a.type !== "reading" || !validateReadingFeedback(a.readingFeedback,a.resourceId))) return false;
 return true;
}
export function validateState(s:any): s is StudyState {
 if (!record(s) || s.schemaVersion !== 1 || !record(s.profile) || !text(s.profile.name,120,1) || !dateOnly(s.profile.examDate)
  || !finite(s.profile.weeklyHours,Number.EPSILON,60) || !finite(s.profile.target,1,9)) return false;
 if (!mapOf(s.skills,p=>record(p) && ["pending","learning","mastered"].includes(p.status) && integer(p.correct,0,1000000) && integer(p.total,0,1000000)
  && p.correct <= p.total && optional(p.lastDate,dateValue) && optional(p.nextReview,dateValue),1000)) return false;
 if (!optional(s.foundationRoute,r=>record(r)&&mapOf(r.steps,(step,id)=>curriculum.skills.some(x=>x.id===id&&["grammar","vocab"].includes(x.group))&&record(step)&&Object.keys(step).every(k=>["theoryAt","examplesAt","completedAt"].includes(k)&&dateValue(step[k])),29))) return false;
 if (!Array.isArray(s.attempts) || s.attempts.length > 2000 || !s.attempts.every(validateAttempt) || !uniqueIds(s.attempts)) return false;
 if (s.official !== null && !(record(s.official) && dateOnly(s.official.date) && skillNames.every(k=>band(s.official[k])) && text(s.official.source,2000,1))) return false;
 if (!Array.isArray(s.external) || s.external.length > 2000 || !s.external.every(x=>record(x) && key(x.id) && dateValue(x.date) && skillNames.includes(x.skill) && optional(x.band,band) && text(x.source,2000,1) && optional(x.feedback,v=>text(v,8000,1)) && optional(x.conditions,v=>text(v,2000,1)) && optional(x.nextObjective,v=>text(v,2000,1)) && optional(x.rawScore,v=>text(v,200,1)) && (x.band!==undefined || typeof x.feedback==="string" && x.feedback.trim().length>0)) || !uniqueIds(s.external)) return false;
 if (!Array.isArray(s.journal) || s.journal.length > 4000 || !s.journal.every(x=>record(x) && key(x.id) && dateValue(x.date) && integer(x.minutes,1,1440) && text(x.note,4000,1)) || !uniqueIds(s.journal)) return false;
 if (!optional(s.learningNotes,notes=>Array.isArray(notes) && notes.length<=4000 && notes.every(validateLearningNote) && uniqueIds(notes))) return false;
 if (!optional(s.learningPlan,validateLearningPlan)) return false;
 if (!optional(s.resourceExposures,rows=>Array.isArray(rows)&&rows.length<=10000&&rows.every(x=>record(x)&&key(x.resourceId)&&dateValue(x.date)&&["opened","solution"].includes(x.reason)))) return false;
 return mapOf(s.drafts,d=>{
  if (!record(d) || !key(d.resourceId)) return false;
  const allowed = resourceTextKeys(d.resourceId);
  return !!allowed && mapOf(d.texts,(v,id)=>allowed.includes(id) && text(v,40000),1000) && finite(d.startedAt,0,8640000000000000) && optional(d.elapsedSeconds,n=>finite(n,0,604800)) && modes.includes(d.mode) && optional(d.parentId,key) && optional(d.transferFrom,key) && optional(d.conditions,validateConditions) && optional(d.plans,plans=>!readingTests.has(d.resourceId) && mapOf(plans,(value,id)=>allowed.includes(id) && text(value,8000),2));
 },20);
}
function validateConditions(v:any):v is AttemptConditions {return record(v)&&["unseen","seen","unknown"].includes(v.exposure)&&["none","allowed","unknown"].includes(v.assistance)&&["continuous","resumed","unknown"].includes(v.timing)&&optional(v.openedAt,dateValue);}
function validateLearningPlan(p:any):p is LearningPlan {
 const skill=(v:any)=>key(v)&&curriculum.skills.some(s=>s.id===v);
 return record(p)&&["current_9h","recommended_12h","intensive_15h"].includes(p.scenario)&&dateValue(p.activatedAt)
 && Array.isArray(p.objectives)&&p.objectives.length<=1000&&uniqueIds(p.objectives)&&p.objectives.every(x=>record(x)&&key(x.id)&&skill(x.skillId)&&dateValue(x.createdAt)&&["active","done"].includes(x.status)&&optional(x.note,v=>text(v,4000)))
 && Array.isArray(p.reviews)&&p.reviews.length<=1000&&uniqueIds(p.reviews)&&p.reviews.every(x=>record(x)&&key(x.id)&&dateValue(x.date)&&["keep","method","increase","redistribute"].includes(x.decision)&&text(x.note,4000,1))
 && Array.isArray(p.evidence)&&p.evidence.length<=4000&&uniqueIds(p.evidence)&&p.evidence.every(x=>record(x)&&key(x.id)&&skill(x.skillId)&&dateValue(x.date)&&["production","transfer"].includes(x.kind)&&optional(x.attemptId,key)&&optional(x.noteId,key)&&optional(x.anchorDate,dateValue)&&optional(x.anchorAttemptId,key)&&optional(x.anchorNoteId,key)&&typeof x.independent==="boolean"&&typeof x.help==="boolean"&&text(x.note,4000,1)&&optional(x.resourceId,key)&&optional(x.exposure,v=>["unseen","seen","unknown"].includes(v))&&optional(x.conditions,v=>["exam","practice","unknown"].includes(v))&&optional(x.outcome,v=>["met","retry"].includes(v)));
}
export function validateReadingFeedback(value:any,resourceId:string):value is ReadingFeedback {
 const allowed=resourceTextKeys(resourceId);
 return !!allowed && record(value) && dateValue(value.date) && text(value.summary,12000,1)
  && stringList(value.priorities,10,4000) && value.priorities.length>0
  && Array.isArray(value.observations) && value.observations.length<=100
  && value.observations.every((item:any)=>record(item)&&allowed.includes(item.questionId)&&text(item.feedback,8000,1))
  && new Set(value.observations.map((item:any)=>item.questionId)).size===value.observations.length;
}
export function validateLearningNote(note:any):note is LearningNote {
 if (!record(note) || !key(note.id) || !dateValue(note.date) || !["reading","grammar","writing-reflection","lesson-application"].includes(note.kind) || !text(note.title,300,1) || !text(note.text,8000,1) || !["independent","assisted"].includes(note.mode)) return false;
 if (!optional(note.reviewOf,key)||!optional(note.revisionOf,key)) return false;
 if (!optional(note.resourceId,key) || !optional(note.attemptId,key) || !optional(note.review,r=>record(r) && dateValue(r.date) && text(r.feedback,12000,1))) return false;
 if (note.kind==="reading") {
  if (!integer(note.minutes,1,480) || !["easy","suitable","hard"].includes(note.difficulty)) return false;
  if (note.url!==undefined) {try {const url=new URL(note.url);if (!text(note.url,2000,1) || !["http:","https:"].includes(url.protocol))return false;}catch{return false;}}
 } else if (note.minutes!==undefined || note.url!==undefined || note.difficulty!==undefined) return false;
 if (note.kind==="grammar" && !curriculum.skills.some(skill=>skill.id===note.resourceId && skill.group==="grammar")) return false;
 if (note.kind==="writing-reflection" && (!key(note.attemptId) || !writingTasks.has(note.resourceId))) return false;
 if (note.kind==="lesson-application" && (!key(note.attemptId) || !curriculum.skills.some(skill=>skill.id===note.resourceId))) return false;
 return true;
}
export const extensiveReadingMinutes=(s:StudyState)=>(s.learningNotes||[]).filter(note=>note.kind==="reading").reduce((sum,note)=>sum+(note.minutes||0),0);
export function daysRemaining(date:string,now=Date.now()) {
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Madrid",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 return Math.max(0,Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(today+"T00:00:00Z"))/86400000));
}
export function reportMarkdown(s:StudyState,cards?:{totalSeconds:number;totalReviews:number}) {
 const seen = new Set<string>();
 const firstAttempts = s.attempts.slice().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date)).filter(a=>{
  if(a.parentId || !a.completed || a.mode!=="exam" || a.conditions?.exposure!=="unseen" || a.conditions.assistance!=="none" || a.conditions.timing!=="continuous")return false;
  if(a.type==="reading"&&!Object.values(a.answers||{}).some(v=>v.trim()))return false;
  if(a.type==="writing"&&(!fullWriting(a)||writingBand(a)===null))return false;
  const resource = `${a.type}:${a.resourceId}`;
  if (seen.has(resource)) return false;
  seen.add(resource);
  return true;
 });
 const reading=firstAttempts.filter(a=>a.type==="reading"&&a.total===40);
 const writing=firstAttempts.filter(a=>a.type==="writing"&&fullWriting(a)&&writingBand(a)!==null);
 const timed=s.attempts.reduce((n,a)=>n+a.elapsedSeconds,0),self=s.journal.reduce((n,j)=>n+j.minutes,0),readingMinutes=extensiveReadingMinutes(s),notes=s.learningNotes||[];
 const learningSection=`\n\n## Práctica de aplicación\n\nLectura extensiva: ${notes.filter(note=>note.kind==="reading").length} textos y ${readingMinutes} minutos declarados. Producción de gramática: ${notes.filter(note=>note.kind==="grammar").length} frases. Reflexiones sobre Writing: ${notes.filter(note=>note.kind==="writing-reflection").length}. Aplicaciones de lecciones: ${notes.filter(note=>note.kind==="lesson-application").length}. Registros revisados por el tutor: ${notes.filter(note=>note.review).length}.\n${cards?`Tarjetas: ${cards.totalReviews} respuestas; ${(cards.totalSeconds/60).toFixed(1)} minutos activos aproximados. Se contabilizan una sola vez y se exportan con su propio respaldo.`:"Tarjetas: consulta su respaldo separado para conservar intervalos, respuestas y aplicaciones."}\nLa gramática y las reflexiones realizadas dentro de una sesión no añaden minutos al total. Las lecturas externas deben excluirse del registro adicional si ya están aquí. Guardar una frase o declarar un acierto no demuestra transferencia independiente; conserva las condiciones y la revisión.\n`;
 const fmt=(a:Attempt|undefined)=>a?`${new Date(a.date).toLocaleDateString("es-ES",{timeZone:"Europe/Madrid"})} — ${a.type==="reading"?a.score+"/"+a.total:writingBand(a)?.toFixed(2)+" (estimación de Writing completo)"}`:"Pendiente";
 const title=(id:string)=>curriculum.skills.find(skill=>skill.id===id)?.title||id;
 const cycle=s.learningPlan?`\n\n## Ciclo por objetivos\n\nActivación: ${s.learningPlan.activatedAt}. Escenario: ${s.learningPlan.scenario}.\n${s.learningPlan.objectives.map(o=>`- ${title(o.skillId)}: ${o.status==="active"?"foco activo":"foco cerrado por decisión del usuario"}. Inicio ${o.createdAt}.`).join("\n")}\n\nEvidencias declaradas y vinculadas: ${s.learningPlan.evidence.length}. No certifican dominio ni banda.\n${s.learningPlan.evidence.map(e=>`- ${e.date} · ${title(e.skillId)} · ${e.kind} · ${e.help?"con ayuda":e.independent?"sin ayuda declarada":"ayuda desconocida"} · material ${e.exposure||"unknown"} · ancla ${e.anchorDate||"desconocida"}. ${e.note}`).join("\n")}\n\nDecisiones semanales:\n${s.learningPlan.reviews.map(r=>`- ${r.date} · ${r.decision}: ${r.note}`).join("\n")}`:"\n\nCiclo por objetivos: pendiente de activación; se conserva el historial previo.";
 const controls=`\n\n## Controles externos\n\n${s.external.length?s.external.map(x=>`- ${x.date} · ${x.skill} · ${x.source} · ${x.band===undefined?"sin banda":`estimación del recurso: ${x.band}`}${x.rawScore?` · bruto: ${x.rawScore}`:""}. ${x.feedback||""} Condiciones: ${x.conditions||"desconocidas"}. Siguiente objetivo: ${x.nextObjective||"pendiente"}.`).join("\n"):"Sin controles registrados."}\nLas estimaciones y el feedback de recursos externos se conservan aparte del resultado oficial.`;
 return `# IELTS Path — informe de aprendizaje\n\nGenerado: ${new Date().toLocaleDateString("es-ES")}\nObjetivo: ${s.profile.target}+ en cada destreza. Fecha prevista: ${s.profile.examDate}.\n\n## Alcance\n\n${s.attempts.length} intentos guardados; ${Object.values(s.skills).filter(x=>x.status==="mastered").length} habilidades marcadas como dominadas.\nTiempo registrado en tareas: ${(timed/3600).toFixed(1)} h. Tiempo adicional declarado: ${(self/60).toFixed(1)} h (puede solaparse si se registra la misma sesión).${learningSection}\n## Primeros intentos con condiciones independientes registradas\n\nReading inicial: ${fmt(reading[0])}\nReading reciente: ${fmt(reading.at(-1))}\nWriting inicial: ${fmt(writing[0])}\nWriting reciente: ${fmt(writing.at(-1))}\n\nLos Reading originales no tienen calibración oficial. Writing usa estimaciones del tutor. Los intentos vacíos o sin condiciones conocidas no establecen esta referencia, pero permanecen en el historial; una entrega parcial sirve para orientar la práctica. Repeticiones, prácticas con ayuda y reescrituras deben analizarse por separado.${cycle}${controls}\n\n## Resultado oficial\n\n${s.official?`Fecha: ${s.official.date}. Listening ${s.official.listening}; Reading ${s.official.reading}; Writing ${s.official.writing}; Speaking ${s.official.speaking}. Fuente declarada: ${s.official.source}.`:"Pendiente: añadir únicamente tras recibir el resultado real."}\n\n## Recursos y aprendizajes\n\nSpeaking: Easy Peasy y una IA de conversación. Añadir horas y otros recursos utilizados antes de compartir.\n\n## Interpretación\n\nEste seguimiento describe un caso personal, no demuestra que el Site causara por sí solo el resultado. Registrar también estudio externo y condiciones de cada prueba.\n\n## Compartir\n\nCódigo reutilizable bajo MIT; materiales originales propios. Los materiales oficiales enlazados y las marcas IELTS conservan sus derechos. Añadir el enlace público al código y la guía antes de publicar. No incluir respuestas personales sin revisar.\n`;
}
