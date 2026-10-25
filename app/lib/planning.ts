import {learningOverview,type LearningState} from "./learning-plan";
import type {StudyState} from "./domain";

export type PlanAssessment = {ready:boolean;title:string;detail:string;availableHours:number;plannedHours:number;minimumWeeklyHours:number;routeLabel:string;prioritySkillIds:string[];breakdown:string[]};

/** Compatibility facade. ready confirms diagnostic conditions, never an IELTS outcome. */
export function assessPlan(state:StudyState,now=Date.now(),cardBudgetMinutes=20):PlanAssessment {
 const o=learningOverview(state as LearningState,now,cardBudgetMinutes),d=o.diagnostics,h=o.horizon,b=o.selectedBudget;
 const confirmed=d.reading.status==="confirmed"&&d.writing.status==="confirmed",expired=h.days===null||h.days<=0;
 const pending=[d.reading.status!=="confirmed"&&"Reading nuevo con condiciones declaradas",d.writing.status!=="confirmed"&&"ambas tareas de Writing con texto y feedback"].filter(Boolean).join("; ");
 const title=expired?(h.days===null?"Revisa la fecha del examen":"El periodo de preparación ha terminado"):confirmed?"Diagnóstico disponible; sigue los objetivos del ciclo":"Ruta parcial disponible; completa las muestras pendientes";
 const detail=expired?"Revisa el calendario antes de distribuir trabajo futuro.":`${pending?"Pendiente: "+pending+". ":""}La evidencia útil ya orienta cada componente. Escenario ${b.totalMinutes/60} h para R/W y Oxford, más 2 h externas L/S propuestas. No garantiza ${state.profile.target}+ en cada destreza.`;
 const breakdown=[
  `Horizonte desde ${h.startDate}: ${h.days===null?"fecha no válida":Math.max(0,h.days)+" días"}, excluyendo el examen. Sin sesiones atrasadas y con último día ligero.`,
  `Perfil actual: ${state.profile.weeklyHours} h/semana. ${o.activated?"Escenario elegido":"Propuesta sin cambiar la configuración"}: ${b.totalMinutes/60} h para Reading/Writing + Oxford.`,
  `Oxford existente: ${b.existingCardsMinutes} min/semana, reservado una vez y sin cambiar tarjetas ni ajustes. Reading/Writing: ${b.readingWritingMinutes} min.`,
  ...b.blocks.map(block=>`${block.label}: ${block.minutes} min/semana.`),
  `Listening/Speaking: ${b.externalMinutes} min externos propuestos; total cuatro destrezas ${b.allSkillsMinutes/60} h. Incluye Easy Peasy/IA existente sin doble cómputo.`,
  `Reading: ${d.reading.score===undefined?"sin respuestas evaluables":d.reading.score+"/"+d.reading.total}; ${d.reading.reason}`,
  `Writing: ${d.writing.reason} ${d.writing.task1?.estimate!=null?"Task 1: "+d.writing.task1.estimate.toFixed(2)+" orientativa. ":""}${d.writing.task2?.estimate!=null?"Task 2: "+d.writing.task2.estimate.toFixed(2)+" orientativa.":"Task 2 sin estimación válida."}`,
  `Vacíos excluidos de la evaluación: ${d.emptyAttempts}. Todo el historial se conserva.`,
  "Prerrequisitos como apoyo condicional: Reading continúa mientras Writing repara bases. No se exige terminar las 58 lecciones.",
  "Reconocimiento, producción, reescritura y transferencia diferida son evidencias distintas. El motor no marca dominio ni convierte quizzes o Reading originales a bandas.",
  "Revisa semanalmente técnica, feedback y carga. Aumenta horas solo si funciona la práctica y la dedicación es sostenible; comunica riesgo si falta evidencia o persiste la brecha."
 ];
 return {ready:confirmed&&!expired,title,detail,availableHours:h.availableHours,plannedHours:h.plannedHours,minimumWeeklyHours:b.totalMinutes/60,routeLabel:o.objectives.length?"Objetivos por evidencia; Reading y Writing en paralelo":"Recoger una muestra nueva y elegir el siguiente objetivo",prioritySkillIds:o.objectives.map(x=>x.skillId),breakdown};
}