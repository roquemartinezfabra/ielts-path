import curriculum from "../data/curriculum.json";
import {lessonForAttempt} from "./lesson-practice";
import readingData from "../data/reading.json";
import {type Attempt,type SessionDraft,type StudyState,readingMark,wordCount} from "./domain";

const readingTests=[...readingData.tests,...readingData.drills];
export const sessionElapsed=(draft:SessionDraft,now=Date.now())=>Math.max(0,(draft.elapsedSeconds||0)+Math.floor((now-draft.startedAt)/1000));
export function withoutActiveDraft(state:StudyState):StudyState {
 if(!state.drafts.active)return state;
 const drafts={...state.drafts};delete drafts.active;
 return {...state,drafts};
}
export function pausedDraft(draft:SessionDraft,now=Date.now()):SessionDraft {
 return {...draft,conditions:draft.conditions?{...draft.conditions,assistance:"allowed",timing:"resumed"}:undefined,mode:draft.mode==="exam"?"practice":draft.mode,elapsedSeconds:sessionElapsed(draft,now),startedAt:now};
}
export function resumedDraft(draft:SessionDraft,now=Date.now()):SessionDraft {
 return {...draft,conditions:draft.conditions?{...draft.conditions,assistance:"allowed",timing:"resumed"}:undefined,mode:draft.mode==="exam"?"practice":draft.mode,elapsedSeconds:draft.elapsedSeconds??sessionElapsed(draft,now),startedAt:now};
}
export function attemptSummary(attempt:Attempt) {
 return {id:attempt.id,type:attempt.type,resourceId:attempt.resourceId,title:attempt.title,date:attempt.date,mode:attempt.mode,elapsedSeconds:attempt.elapsedSeconds,completed:attempt.completed,conditions:attempt.conditions,parentId:attempt.parentId,transferFrom:attempt.transferFrom,score:attempt.score,total:attempt.total,answered:attempt.answers?Object.values(attempt.answers).filter(text=>text.trim()).length:undefined,writingTasks:attempt.taskTexts?Object.entries(attempt.taskTexts).map(([id,text])=>({id,words:wordCount(text),reviewed:!!attempt.feedback?.[id]})):undefined,readingReviewed:attempt.type==="reading"?!!attempt.readingFeedback:undefined};
}
export function readingAttemptDetail(attempt:Attempt,includePassages=true,questionIds?:string[]) {
 const test=readingTests.find(test=>"reading:"+test.id===attempt.resourceId);
 if(attempt.type!=="reading"||!test)throw new Error("Intento de Reading no encontrado.");
 if(questionIds && (!Array.isArray(questionIds)||!questionIds.length||questionIds.length>100||questionIds.some(id=>typeof id!=="string"||!test.questions.some(q=>q.id===id))))throw new Error("Preguntas no válidas para este intento.");
 const marks=readingMark(test,attempt.answers||{});
 const questions=test.questions.map((q,index)=>({...q,response:attempt.answers?.[q.id]||"",correct:marks[index].correct}));
 return {attempt,test:{id:test.id,title:test.title,minutes:test.minutes,sections:includePassages?test.sections:undefined},questions:questions.filter(q=>!questionIds||questionIds.includes(q.id)),analysis:{storedScore:attempt.score,recalculatedScore:marks.filter((mark:{correct:boolean})=>mark.correct).length,total:marks.length,unanswered:questions.filter(q=>!q.response.trim()).map(q=>q.id),incorrect:questions.filter(q=>!q.correct).map(q=>q.id),bySection:test.sections.map((section,index)=>({title:section.title,correct:questions.filter(q=>q.section===index&&q.correct).length,total:questions.filter(q=>q.section===index).length})),byType:[...new Set(questions.map(q=>q.type))].map(type=>({type,correct:questions.filter(q=>q.type===type&&q.correct).length,total:questions.filter(q=>q.type===type).length}))},interpretation:"Intento guardado del usuario actual. Las respuestas originales, condiciones y puntuación se conservan. Material original sin calibración oficial: no convertir el resultado en una banda IELTS oficial. Las notas de lectura extensiva son registros diferentes."};
}
export function attemptDetail(attempt:Attempt) {
 if(attempt.type==="reading")return readingAttemptDetail(attempt);
 if(attempt.type==="writing")return {attempt,tasks:curriculum.writingTasks.filter(task=>Object.hasOwn(attempt.taskTexts||{},task.id)),rubric:"Task achievement/response (ta), coherence/cohesion (cc), lexical resource (lr), grammatical range/accuracy (gra). Task 2 pesa doble. Justificar las estimaciones con evidencia del texto.",rubricSource:"https://ielts.org/cdn/ielts-guides/ielts-writing-band-descriptors.pdf"};
 return {attempt,lesson:lessonForAttempt(attempt),note:"Las comprobaciones objetivas tienen puntuación; la aplicación abierta se conserva en answers y en el cuaderno para revisión del tutor. Los intentos anteriores pueden usar números de pregunta o no conservar respuestas. Una repetición no demuestra transferencia a un contexto nuevo."};
}
