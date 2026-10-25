import curriculum from "../data/curriculum.json";
import type {StudyState} from "./domain";

/** Resource identifiers preserve the exact prompts used by every saved attempt. */
export function writingTasksForResource(resourceId:string) {
 if(resourceId==="diagnostic-writing")return [curriculum.writingTasks.find(t=>t.type==="task1"),curriculum.writingTasks.find(t=>t.type==="task2")].filter((t):t is typeof curriculum.writingTasks[number]=>!!t);
 if(resourceId.startsWith("writing-pair:")) {
  const ids=resourceId.slice(13).split(":");
  const pair=ids.map(id=>curriculum.writingTasks.find(t=>t.id===id));
  return ids.length===2 && pair[0]?.type==="task1" && pair[1]?.type==="task2" ? pair as typeof curriculum.writingTasks : [];
 }
 return curriculum.writingTasks.filter(t=>t.id===resourceId);
}
export function resourceExposure(state:StudyState,resourceId:string):"unseen"|"seen" {
 const ids=writingTasksForResource(resourceId).map(t=>t.id);
 const overlaps=(other:string)=>other===resourceId || (ids.length>0&&writingTasksForResource(other).some(t=>ids.includes(t.id)));
 const actualExposure=state.attempts.some(a=>{
  if(a.type==="reading")return a.resourceId===resourceId&&Object.values(a.answers||{}).some(v=>v.trim());
  if(a.type==="writing")return Object.entries(a.taskTexts||{}).some(([id,value])=>value.trim()&&(ids.includes(id)||id===resourceId));
  return false;
 });
 return actualExposure || (state.resourceExposures||[]).some(x=>overlaps(x.resourceId)) ? "seen" : "unseen";
}
export function nextWritingPair(state:StudyState) {
 const task1=curriculum.writingTasks.find(t=>t.type==="task1"&&resourceExposure(state,t.id)==="unseen");
 const task2=curriculum.writingTasks.find(t=>t.type==="task2"&&resourceExposure(state,t.id)==="unseen");
 return task1&&task2 ? `writing-pair:${task1.id}:${task2.id}` : null;
}
