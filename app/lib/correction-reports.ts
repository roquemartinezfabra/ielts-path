import curriculum from "../data/curriculum.json";
import type {StudyState} from "./domain";
import {lessonForAttempt,lessonChecks,checkLessonAnswer} from "./lesson-practice";
export type CorrectionReport={id:string;date?:string;submittedAt:string;kind:"writing"|"reading"|"lesson"|"application";title:string;origin:string;summary:string;priorities:string[];observations:{original?:string;corrected?:string;reason:string;skillId?:string;question?:string}[]};
const knownSkill=(id?:string)=>curriculum.skills.some(s=>s.id===id)?id:undefined;
export function correctionReports(state:StudyState):CorrectionReport[]{
 const reports:CorrectionReport[]=[];
 for(const a of state.attempts){
  for(const [taskId,f] of Object.entries(a.feedback||{}))reports.push({id:`writing:${a.id}:${taskId}`,date:f.reviewedAt,submittedAt:a.date,kind:"writing",title:curriculum.writingTasks.find(t=>t.id===taskId)?.title||a.title,origin:"Corrección del tutor · bandas estimadas",summary:f.summary,priorities:f.priorities,observations:(f.errors||[]).map(error=>({...error,reason:error.rule,skillId:knownSkill(error.skillId)}))});
  if(a.readingFeedback)reports.push({id:`reading:${a.id}`,date:a.readingFeedback.date,submittedAt:a.date,kind:"reading",title:a.title,origin:"Revisión del tutor de Reading",summary:a.readingFeedback.summary,priorities:a.readingFeedback.priorities,observations:a.readingFeedback.observations.map(o=>({original:a.answers?.[o.questionId],reason:o.feedback,question:`Pregunta ${o.questionId}`}))});
  if(a.type==="lesson"){
   const lesson=lessonForAttempt(a);if(!lesson||!Object.keys(a.answers||{}).length)continue;
   const errors=lessonChecks(lesson).filter(q=>q.type!=="open"&&a.answers?.[q.id]?.trim()&&checkLessonAnswer(q,a.answers[q.id])===false);
   reports.push({id:`lesson:${a.id}`,date:a.date,submittedAt:a.date,kind:"lesson",title:a.title,origin:"Comprobación automática · fecha de guardado",summary:`Resultado guardado: ${a.score??"—"}/${a.total??"—"}. Las aplicaciones abiertas se revisan por separado.`,priorities:[],observations:errors.map(q=>({original:a.answers![q.id],corrected:q.type==="choice"?q.options?.[q.answer??-1]:q.accepted?.join(" / "),reason:q.feedback?.[q.options?.indexOf(a.answers![q.id])??-1]||q.explanation,skillId:a.resourceId,question:q.prompt}))});
  }
 }
 for(const note of state.learningNotes||[])if(note.review)reports.push({id:`note:${note.id}`,date:note.review.date,submittedAt:note.date,kind:"application",title:note.title,origin:"Revisión del tutor de una aplicación",summary:"Feedback sobre tu producción. Consulta la explicación para distinguir logros y puntos por trabajar.",priorities:[],observations:[{original:note.text,reason:note.review.feedback,skillId:knownSkill(note.resourceId)}]});
 return reports.sort((a,b)=>(b.date||b.submittedAt).localeCompare(a.date||a.submittedAt));
}
