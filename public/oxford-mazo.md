# Oxford 5000 incluido en la versión pública

En **Tarjetas → Estudiar**, pulsa **Añadir Oxford 5000 a mis tarjetas**. No necesitas un CSV ni instalar Anki. Puedes pausar la incorporación o salir y reanudarla; las partes ya incorporadas no se repiten. Después intenta recordar, muestra la respuesta y valora tu recuerdo con **Otra vez / Difícil / Bien / Fácil**.

## Contenido conservado

La versión `2026-10-27-v1` contiene las **5.535 tarjetas** de vocabulario del mazo aportado para IELTS Path: Oxford 3000, ampliación Oxford 5000 y variantes británicas/americanas. Incluye 927 entradas A1, 912 A2, 840 B1, 1.488 B2 y 1.368 C1. Los distintos usos y variantes se conservan; no son necesariamente 5.535 palabras distintas.

Cada tarjeta conserva identificador, pregunta, significado en español, explicación, ejemplo inglés y enlace de consulta. Solo se retira de la atribución el nombre del archivo privado de origen. No se incluyen ejercicios personales de gramática, pronunciación, notas del alumno, intentos ni historial. El Site personal original no se modifica.

Es una adaptación educativa independiente. Las denominaciones Oxford y Anki identifican las listas y la referencia de funcionamiento; no implican afiliación. La licencia del software no concede derechos sobre marcas o recursos enlazados de terceros.

## Repaso y carga

- Para una biblioteca nueva: **6 nuevas de vocabulario/día**, **20 minutos/día**, retención objetivo **90 %**, aprendizaje y reaprendizaje de **10 minutos** mediante FSRS.
- Se conserva la cuota de vocabulario del reparto anterior de 10 nuevas (6 vocabulario + 3 gramática + 1 pronunciación). Este mazo solo aporta vocabulario; no rellena las otras categorías.
- Los repasos vencidos tienen prioridad. Un día o más de atraso pausa las nuevas. Alcanzar el tiempo diario también pausa las nuevas; no oculta los repasos pendientes.
- Las tarjetas de una misma palabra se separan entre días. «Difícil» significa que recordaste correctamente con esfuerzo; un fallo se valora «Otra vez».
- Si ya tienes ajustes o tarjetas, se mantienen. Puedes editar la carga en **Configuración**. Estas cifras son un punto de partida operativo, no una dosis científicamente óptima para todos.
- El balance utiliza recuperaciones diferidas y tiempo, no solo respuestas inmediatamente después de estudiar. Usa **Aplicar** para comprobar una frase nueva; las tarjetas por sí solas no certifican una banda IELTS.

## Historial y reutilización

Cada alumno tiene tarjetas, intervalos y repasos propios. Incorporar el mazo solo añade identidades ausentes: no reemplaza una edición, reinicia un repaso ni quita una suspensión. **Configuración → Respaldo de tarjetas** exporta contenido, fechas, ajustes y registros; conserva también el respaldo de Progreso para las demás actividades. El acceso de invitado continúa sujeto a su caducidad de 30 días.

El catálogo pequeño está en `app/data/oxford-catalog.json`; los 28 archivos versionados están en `public/decks/oxford-5000/`. Se comprueba su integridad antes de añadirlos. La migración `0003_flashcard_packs.sql` permite reanudar cada incorporación. Ejecuta `npm run db:remote` antes de desplegar una actualización existente.

El repositorio y el ZIP incluyen el mazo listo para usar. Los archivos de entrada personales no son necesarios para compilarlo. `scripts/package-oxford.py` permite reproducir el empaquetado desde el contenido convertido original; no exporta programación ni respuestas.
