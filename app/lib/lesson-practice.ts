import type {Attempt, LearningNote, StudyState,LessonSupport} from "./domain";
import pilot from "../data/foundation-word-order-v1.json";
import curriculum from "../data/curriculum.json";
import archive from "../data/lesson-archive.json";
import archiveV2 from "../data/lesson-archive-v2.json";
import grammarDepth from "../data/lesson-depth-grammar.json";
import readingVocabDepth from "../data/lesson-depth-reading-vocab.json";
import writingDepth from "../data/lesson-depth-writing.json";

export const LESSON_VERSION=3;
export type LessonDepth={skillId:string;why:string;decisions:{cue:string;action:string;en:string;reason:string}[];worked:{scenario:string;task:string;model:string;reasoning:{quote:string;explanation:string}[];alternative:{text:string;why:string}};checks:LessonCheck[];retrieval:LessonCheck;sources:{title:string;url:string}[]};
export const lessonDepths=[...grammarDepth,...readingVocabDepth,...writingDepth] as LessonDepth[];
const depthById=new Map(lessonDepths.map(depth=>[depth.skillId,depth]));
export function enrichLesson(skill:LessonSkill):LessonSkill {
 const depth=depthById.get(skill.id);
 if(!depth||skill.lesson.depth)return skill;
 return {...skill,lesson:{...skill.lesson,depth},checks:[...(skill.checks||[]),...depth.checks,depth.retrieval]};
}
// Older attempts must retain the questions and keys that accompanied their answers.
export function lessonForAttempt(attempt:Pick<Attempt,"resourceId"|"lessonVersion"|"lessonVariant">){
 const current=curriculum.skills.find(skill=>skill.id===attempt.resourceId);
 if(attempt.lessonVariant&&current)return withLessonVariant(enrichLesson(current as LessonSkill),attempt.lessonVariant);
 if(attempt.lessonVersion===LESSON_VERSION)return current?enrichLesson(current as LessonSkill):undefined;
 if(attempt.lessonVersion===2)return archiveV2.skills.find(skill=>skill.id===attempt.resourceId) as LessonSkill|undefined;
 return (archive.skills.find(skill=>skill.id===attempt.resourceId)||archiveV2.skills.find(skill=>skill.id===attempt.resourceId)) as LessonSkill|undefined;
}

export type LessonCheck = {id:string;type:"choice"|"input"|"open";prompt:string;explanation:string;options?:string[];answer?:number;accepted?:string[];model?:string;minWords?:number;checklist?:string[];feedback?:string[];hints?:string[];followup?:{prompt:string;accepted:string[];explanation:string}|null};
export type LessonSkill = {id:string;title:string;group:string;description:string;lesson:{explanation:string;tip:string;goal?:string;steps?:{title:string;body:string}[];examples:{en:string;es:string;note?:string}[];pitfalls?:{wrong:string;right:string;why:string}[];takeaway?:string;sources?:{title:string;url:string}[];depth?:LessonDepth};quiz:{question:string;options:string[];answer:number;explanation:string}[];checks?:LessonCheck[];practice?:{resourceId:string;title:string}[]};
export type LessonSubmission = {answers:Record<string,string>;assisted:boolean;selfChecks:string[];elapsedSeconds:number;variantId?:string;support?:LessonSupport;openedAt?:string;exposure?:"seen"|"unseen"|"unknown"};
export const wordOrderPilot=pilot;
export function withLessonVariant(skill:LessonSkill,variantId?:string):LessonSkill{
 if(!variantId)return skill;
 const bank=pilot.banks.find(x=>x.id===variantId);
 if(skill.id!==pilot.skillId||!bank)throw new Error("Variante de lección no válida.");
 return {...skill,quiz:[],checks:[...bank.checks,...bank.applications] as LessonCheck[]};
}
export function nextLessonVariant(attempts:Attempt[],skillId:string,exposures:{resourceId:string}[]=[]){
 if(skillId!==pilot.skillId)return undefined;
 const previous=attempts.filter(a=>a.resourceId===skillId&&a.lessonVariant).at(-1)?.lessonVariant;
 return pilot.banks.find(b=>!attempts.some(a=>a.lessonVariant===b.id)&&!exposures.some(e=>e.resourceId===`lesson:${b.id}`))?.id||pilot.banks.find(b=>b.id!==previous)?.id||pilot.banks[0].id;
}
export const lessonChecks=(skill:LessonSkill):LessonCheck[]=>[
 ...skill.quiz.map((q,i)=>({id:`quiz-${i+1}`,type:"choice" as const,prompt:q.question,options:q.options,answer:q.answer,explanation:q.explanation})),
 ...(skill.checks||[])
];
// Preserve articles, apostrophes and internal punctuation; they may be the target.
export const normalizeLessonAnswer=(value:string)=>value.normalize("NFC").trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").replace(/(?<=[a-z0-9])[.!?]$/i,"");
export function checkLessonAnswer(check:LessonCheck,answer:string):boolean|null {
 if(check.type==="open")return null;
 const accepted=check.type==="choice"?[check.options?.[check.answer??-1]??""]:check.accepted||[];
 return !!answer.trim()&&accepted.some(value=>normalizeLessonAnswer(value)===normalizeLessonAnswer(answer));
}
export function lessonResult(skill:LessonSkill,answers:Record<string,string>){
 const checks=lessonChecks(skill).filter(check=>check.type!=="open");
 return {score:checks.filter(check=>checkLessonAnswer(check,answers[check.id]||"")).length,total:checks.length,complete:checks.every(check=>!!answers[check.id]?.trim())};
}
export function recordLessonPractice(state:StudyState,skill:LessonSkill,submission:LessonSubmission,attemptId:string,noteId:string,now=new Date()):StudyState {
 if(state.attempts.some(attempt=>attempt.id===attemptId))return state;
 skill=withLessonVariant(skill,submission.variantId);
 const result=lessonResult(skill,submission.answers);
 if(!result.complete)throw new Error("Responde las comprobaciones antes de guardar.");
 const checks=lessonChecks(skill),allowed=new Set(checks.map(check=>check.id));
 if(Object.keys(submission.answers).some(id=>!allowed.has(id))||Object.values(submission.answers).some(value=>value.length>4000))throw new Error("Respuesta de lección no válida.");
 const support=submission.support;
 if(support&&(Object.entries(support.hints).some(([id,n])=>!allowed.has(id)||!Number.isInteger(n)||n<0||n>2)||Object.keys(support.corrections).some(id=>!allowed.has(id))||Object.keys(support.followups).some(id=>!allowed.has(id))||Object.keys(support.diagnostic).some(id=>!pilot.diagnostic.some(q=>q.id===id))||[support.corrections,support.diagnostic,support.followups].some(map=>Object.values(map).some(v=>typeof v!=="string"||v.length>4000))))throw new Error("Registro de ayudas no válido.");
 const assisted=submission.assisted||!!support&&(Object.values(support.hints).some(n=>n>0)||[support.corrections,support.diagnostic,support.followups].some(map=>Object.values(map).some(v=>v.trim())));
 const previous=state.attempts.filter(attempt=>attempt.type==="lesson"&&attempt.resourceId===skill.id).at(-1);
 const attempt:Attempt={id:attemptId,type:"lesson",resourceId:skill.id,lessonVersion:LESSON_VERSION,title:skill.title,date:now.toISOString(),mode:"practice",elapsedSeconds:Math.min(604800,Math.max(0,submission.elapsedSeconds)),score:result.score,total:result.total,answers:{...submission.answers},completed:true,...(previous?{parentId:previous.id}:{})};
 if(submission.variantId)attempt.lessonVariant=submission.variantId;
 if(support)attempt.lessonSupport=structuredClone(support);
 if(submission.openedAt)attempt.conditions={exposure:submission.exposure||"unknown",assistance:assisted?"allowed":"none",timing:"continuous",openedAt:submission.openedAt};
 const old=state.skills[skill.id]||{status:"pending",correct:0,total:0};
 const applications=checks.filter(check=>check.type==="open"&&submission.answers[check.id]?.trim());
 const notes:LearningNote[]=applications.map(check=>({id:applications.length===1?noteId:noteId+"."+check.id,date:now.toISOString(),kind:"lesson-application",resourceId:skill.id,attemptId,title:skill.title+(applications.length>1?check.id==="stretch"?" · Contexto nuevo":" · Primera aplicación":""),mode:assisted?"assisted":"independent",text:`Consigna: ${check.prompt}\n\nMi respuesta: ${submission.answers[check.id]}\n\nAutoevaluación (no validada por el tutor):\n${(check.checklist||[]).map((item,i)=>`${submission.selfChecks.includes(check.id+":"+i)?"[x]":"[ ]"} ${item}`).join("\n")}`}));
 return {...state,skills:{...state.skills,[skill.id]:{...old,status:"learning",correct:old.correct+result.score,total:old.total+result.total,lastDate:now.toISOString(),nextReview:new Date(now.getTime()+3*86400000).toISOString()}},attempts:[...state.attempts,attempt],learningNotes:[...(state.learningNotes||[]),...notes]};
}
