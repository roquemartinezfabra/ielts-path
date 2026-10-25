import grammar from "../data/foundation-grammar-en.json";
import vocabulary from "../data/foundation-vocab-en.json";
import type {StudyState} from "./domain";
import {lessonForAttempt,lessonChecks,checkLessonAnswer} from "./lesson-practice";

export type FoundationContent={skillId:string;title:string;goal:string;explanation:string;explanationEs:string;uses:{title:string;when:string;form:string;why:string;es:string;examples:{en:string;es:string;note:string}[]}[];glossary:{term:string;definition:string;es:string}[];takeaway:string;writingBridge:{prompt:string;checklist:string[]};sources:{title:string;url:string}[]};
export const foundations=[...grammar,...vocabulary] as FoundationContent[];
export const foundationById=new Map(foundations.map(item=>[item.skillId,item]));
export const courseBlocks=[
 {title:"1. Construir frases",goal:"Identificar quién hace qué y escribir mensajes sencillos.",output:"3–5 frases propias",ids:["g-word-order","g-be-auxiliaries","g-agreement-pronouns","g-present","g-countability","g-articles","g-prepositions","v-everyday"]},
 {title:"2. Elegir palabras y precisar",goal:"Combinar palabras, describir y puntuar con claridad.",output:"Frases conectadas y un párrafo breve",ids:["g-modifiers","v-word-families","v-collocations","v-patterns","g-verb-patterns","g-punctuation"]},
 {title:"3. Expresar tiempo e intención",goal:"Explicar lo ocurrido, hacer planes y formular peticiones.",output:"Un párrafo o una petición breve",ids:["g-past","g-perfect","g-future","g-modals","v-workplace","v-register"]},
 {title:"4. Conectar y desarrollar ideas",goal:"Dar razones, condiciones y detalles relevantes.",output:"Párrafos con idea, razón y ejemplo",ids:["g-subordination","g-conditionals","g-relative-clauses","g-passive","v-essay-topics"]},
 {title:"5. Afinar el mensaje",goal:"Reformular, elegir matices y revisar la precisión.",output:"Revisar párrafos antes de integrar textos completos",ids:["g-indirect-language","g-range-precision","v-paraphrase","v-accuracy"]}
];
export const foundationOrder=courseBlocks.flatMap(block=>block.ids);
export const foundationIndex=(id:string)=>foundationOrder.indexOf(id);
export function nextFoundation(state:StudyState){return foundationOrder.find(id=>!state.foundationRoute?.steps[id]?.completedAt)||foundationOrder[0];}
export function routeStage(state:StudyState,id:string){const p=state.foundationRoute?.steps[id];return p?.completedAt?"Recorrido completado":p?.examplesAt?"Practicar y comprobar":p?.theoryAt?"Usos y ejemplos":"Aprender la teoría";}
export function markFoundation(state:StudyState,id:string,stage:"theoryAt"|"examplesAt"|"completedAt",now=new Date()):StudyState{
 if(!foundationOrder.includes(id))throw new Error("Lección de fundamentos no válida.");
 const previous=state.foundationRoute?.steps[id]||{};
 if(stage==="examplesAt"&&!previous.theoryAt)throw new Error("Primero recorre la teoría.");
 if(stage==="completedAt"&&(!previous.theoryAt||!previous.examplesAt||!state.attempts.some(a=>a.type==="lesson"&&a.resourceId===id&&a.completed&&Object.values(a.answers||{}).some(x=>x.trim()))||!(state.learningNotes||[]).some(n=>n.kind==="lesson-application"&&n.resourceId===id)))throw new Error("Guarda las comprobaciones y una aplicación antes de cerrar el recorrido.");
 return {...state,foundationRoute:{steps:{...(state.foundationRoute?.steps||{}),[id]:{...previous,[stage]:now.toISOString()}}}};
}

export type ReviewItem={id:string;date:string;skillId:string;title:string;original:string;corrected?:string;reason:string;prompt:string;attemptId?:string;noteId?:string;practised:boolean};
export function recentMistakes(state:StudyState):ReviewItem[]{
 const items:Omit<ReviewItem,"practised">[]=[];
 const writing=state.attempts.filter(a=>a.type==="writing"&&Object.keys(a.feedback||{}).length).sort((a,b)=>b.date.localeCompare(a.date))[0];
 if(writing)for(const [taskId,feedback] of Object.entries(writing.feedback||{}))for(const [i,error] of (feedback.errors||[]).entries())if(error.skillId&&foundationOrder.includes(error.skillId))items.push({id:`writing:${writing.id}:${taskId}:${i}:${Date.parse(feedback.reviewedAt||writing.date)}`,date:feedback.reviewedAt||writing.date,skillId:error.skillId,title:foundationById.get(error.skillId)?.title||error.skillId,original:error.original,corrected:error.corrected,reason:error.rule,prompt:"Write a new sentence in a different situation using this pattern. Then explain the choice in one short sentence.",attemptId:writing.id});
 const latestBySkill=new Map<string,typeof state.attempts[number]>();
 for(const attempt of [...state.attempts].sort((a,b)=>a.date.localeCompare(b.date)))if(attempt.type==="lesson"&&foundationOrder.includes(attempt.resourceId))latestBySkill.set(attempt.resourceId,attempt);
 for(const attempt of latestBySkill.values()){
  const lesson=lessonForAttempt(attempt);if(!lesson)continue;
  for(const q of lessonChecks(lesson))if(q.type!=="open"&&attempt.answers?.[q.id]?.trim()&&checkLessonAnswer(q,attempt.answers[q.id])===false)items.push({id:`lesson:${attempt.id}:${q.id}`,date:attempt.date,skillId:attempt.resourceId,title:foundationById.get(attempt.resourceId)?.title||attempt.title,original:attempt.answers[q.id],corrected:q.type==="choice"?q.options?.[q.answer??-1]:q.accepted?.join(" / "),reason:`${q.prompt}\n\n${q.explanation}`,prompt:"Explain the rule, then write a different example of your own. Do not copy the corrected answer.",attemptId:attempt.id});
 }
 const latestNotes=new Map<string,NonNullable<StudyState["learningNotes"]>[number]>();
 for(const note of [...(state.learningNotes||[])].sort((a,b)=>a.date.localeCompare(b.date)))if(note.review&&note.resourceId&&foundationOrder.includes(note.resourceId)&&!note.reviewOf)latestNotes.set(note.resourceId,note);
 for(const note of latestNotes.values())items.push({id:`feedback:${note.id}:${Date.parse(note.review!.date)}`,date:note.review!.date,skillId:note.resourceId!,title:`Feedback · ${foundationById.get(note.resourceId!)?.title}`,original:note.text,reason:note.review!.feedback,prompt:foundationById.get(note.resourceId!)!.writingBridge.prompt,attemptId:note.attemptId,noteId:note.id});
 return items.sort((a,b)=>b.date.localeCompare(a.date)).map(item=>({...item,practised:!!state.learningNotes?.some(note=>note.reviewOf===item.id)}));
}
