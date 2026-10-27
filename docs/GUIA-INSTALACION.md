# IELTS Path — instalación y publicación independiente

Esta versión funciona fuera de ChatGPT Sites. El código se puede compartir en GitHub; la aplicación y su base de datos se ejecutan en Cloudflare Workers y D1. No requiere una suscripción de IA para estudiar o realizar ejercicios cerrados.

**Aplicación publicada:** [Abrir IELTS Path](https://ielts-path.roquemartinezfabra.workers.dev). **Código:** [roquemartinezfabra/ielts-path](https://github.com/roquemartinezfabra/ielts-path). Para probarla, pulsa **Probar como invitado**; tu espacio es individual. El acceso con GitHub es opcional y todavía no está activado en esta publicación. Si vienes del Site original, consulta el apartado 4 para trasladar tus respaldos.

## 1. Probar en tu ordenador

Instala **Node.js 22.13 o posterior**, npm y **Python 3.9 o posterior**. La orden `python --version` debe funcionar; Python genera la descarga del código. Descarga el repositorio o ZIP, abre una terminal en su carpeta y ejecuta:

```sh
npm ci
npm run db:local
npm run dev
```

Abre **http://127.0.0.1:5174/** y pulsa **Probar como invitado**. El inicio de sesión local no necesita una cuenta externa. No introduzcas contraseñas en archivos de configuración.

`db:local` aplica las migraciones pendientes de `drizzle/` y recuerda cuáles se han aplicado. Crean historial, tarjetas, sesiones independientes y el registro de incorporación del mazo Oxford. No repitas el SQL manualmente. Los datos locales se guardan en `.wrangler/state/`; conserva esa carpeta y exporta respaldos desde la aplicación.

Para comprobar el proyecto y probar la compilación final:

```sh
npm run check
npm run build
npm run preview
```

Detén primero el servidor de desarrollo con `Ctrl+C`: ambos usan el puerto 5174. `build` regenera el ZIP limpio y compila; `preview` ejecuta esa compilación solo en tu ordenador. Ninguna de estas órdenes publica la web.

## 2. Publicar en Cloudflare

Necesitas una cuenta de Cloudflare. Revisa sus condiciones, cuotas y precios; la licencia MIT del código no incluye alojamiento. No necesitas comprar un dominio: Workers puede proporcionar una dirección `workers.dev`.

1. Ejecuta `npx wrangler login` en la carpeta del proyecto y autoriza en el navegador el acceso a **tu** cuenta.
2. Crea la base: `npx wrangler d1 create ielts-path`.
3. En `wrangler.json`, sustituye el `database_id` por el identificador de **tu propia base**. El repositorio identifica la instalación publicada del autor; el ZIP descargable usa un identificador de ejemplo. Conserva `"binding": "DB"`. Si eliges otro nombre de base, actualiza `database_name`. El nombre del Worker puede cambiarse en `name`.
4. Aplica las migraciones a esa base nueva y publica:

   ```sh
   npm run db:remote
   npm run deploy
   ```

5. Abre la URL devuelta. Prueba el acceso de invitado, guarda una práctica y recarga. En otro perfil de navegador, confirma que aparece un alumno distinto.

La publicación comprueba que has sustituido el identificador de ejemplo. Las bases local y remota son independientes. Antes de una actualización con migraciones, conserva un respaldo y ejecuta `npm run db:remote` para aplicar únicamente las pendientes.

### Publicación desde GitHub

En Cloudflare Workers, conecta **tu repositorio** mediante Workers Builds. Elige la rama y la carpeta raíz del proyecto. El entorno debe disponer de Node.js 22.13+ y Python 3.9+ con la orden `python`.

- Compilación: `node scripts/check-deploy.mjs && npm run check && npm run build`
- Publicación: `npx wrangler deploy --config dist/server/wrangler.json`

Configura antes la base real y sus migraciones. Los secretos de inicio de sesión pertenecen al Worker de Cloudflare; no los guardes en GitHub. GitHub Actions comprueba el código, pero no publica por sí solo. GitHub Pages no sustituye al servidor y la base de esta aplicación.

## 3. Activar el acceso con GitHub (opcional)

El acceso de invitado ya funciona. Para recuperar el mismo perfil desde distintos dispositivos, registra una **OAuth App de GitHub** con tu dirección pública definitiva:

- Homepage URL: `https://TU-WEB`
- Authorization callback URL: `https://TU-WEB/auth/callback`

Configura los valores en el Worker de Cloudflare desde su panel o con Wrangler:

```sh
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put APP_ORIGIN
```

Introduce en cada orden el valor solicitado. `APP_ORIGIN` es el origen completo, como `https://ielts-path.tu-subdominio.workers.dev`, sin barra final ni ruta. No publiques el secreto del cliente. Cuando los tres valores estén presentes aparecerá **Entrar con GitHub**.

El acceso solicita la identidad pública básica, sin permisos de repositorios ni correo. Usa estado y PKCE. Antes de anunciarlo, prueba el flujo completo en la URL publicada. Para probarlo localmente crea otra OAuth App con callback `http://127.0.0.1:5174/auth/callback`, copia `.dev.vars.example` a `.dev.vars` y rellena esa copia privada.

**Invitado y GitHub son perfiles distintos.** Exporta tu progreso de invitado antes de iniciar sesión con GitHub y restaura el respaldo dentro de la cuenta elegida. No hay una fusión automática que pueda sustituir datos existentes.

## 4. Trasladar tu progreso desde el Site

La copia de código no contiene tu historial ni tus mazos personales. El Site original conserva su propia base.

1. En el Site original, abre **Progreso** y exporta el respaldo JSON.
2. En **Tarjetas didácticas**, exporta su respaldo JSON por separado: conserva contenido, programación y repasos.
3. En la aplicación independiente, entra en la cuenta donde quieras guardar los datos.
4. Si ya hay actividad, exporta una copia antes de importar. En **Progreso**, importa el primer respaldo y revisa la confirmación.
5. Restaura el respaldo de tarjetas desde **Tarjetas didácticas**.
6. Comprueba intentos, correcciones, ruta y próximos repasos después de recargar.

Los respaldos contienen información personal: no los subas al repositorio público. Importar no modifica ni elimina datos del Site de origen.

## 5. Aprender y recibir correcciones

1. Ajusta fecha, objetivo y horas en tu perfil. El objetivo inicial es 7.5 en cada destreza.
2. Sigue **Mi ruta** lección por lección: teoría en inglés con apoyo en español, usos, ejemplos, práctica guiada, comprobaciones y aplicación breve.
3. Empieza produciendo frases y párrafos; avanza a cartas y ensayos al practicar sus fundamentos.
4. Guarda explícitamente. **Salir** ofrece continuar, guardar un borrador o salir sin guardar. Cerrar la pestaña no equivale a entregar.
5. Revisa **Repaso** e **Informes** para volver a la teoría relacionada con tus errores.

Reading y los ejercicios cerrados tienen corrección automática. Writing y las respuestas abiertas necesitan un tutor; la aplicación no inventa una banda ni llama a una IA por sí sola.

### Intercambio con el tutor

En **Informes**, selecciona una entrega y descarga el archivo para el tutor. Incluye esa entrega, contexto y formato esperado. Compártelo con el tutor o la IA que utilices. Introduce después su JSON de corrección en el mismo apartado. La respuesta original se conserva y el feedback queda vinculado al intento o aplicación.

Solo se exportan los datos de la entrega elegida. La revisión debe identificar errores concretos, explicarlos y orientar el repaso. Las bandas de práctica siguen siendo estimaciones.

### Conexión directa opcional

En **Progreso → Cuenta → Conexión de tutor**, genera una clave privada que dura siete días y que puedes revocar. Un cliente MCP compatible puede conectarse a `https://TU-WEB/mcp` con `Authorization: Bearer CLAVE`. La clave permite leer y modificar el perfil que la creó; compártela solo con tu tutor o cliente de confianza.

Esto no registra automáticamente una aplicación en ChatGPT ni cambia la conexión del Site original. Si el cliente no admite esta autenticación, utiliza el intercambio de archivos. No guardes claves en GitHub, capturas públicas o enlaces.

## 6. Tarjetas, exportaciones y sesiones

El módulo incluye el mazo **Oxford 3000 + Oxford 5000**, con 5.535 tarjetas de vocabulario y ejemplos. En **Tarjetas → Estudiar**, pulsa **Añadir Oxford 5000 a mis tarjetas**. Puedes pausar o reanudar sin duplicados. Para bibliotecas nuevas se aplican 6 nuevas de vocabulario/día, 20 minutos y retención objetivo del 90 %; se mantienen los ajustes y repasos de bibliotecas existentes. Consulta [OXFORD-MAZO.md](OXFORD-MAZO.md).

El importador y el programador existentes se conservan. Importa CSV mediante la vista previa y conserva identificadores para actualizar contenido sin reiniciar repasos. Un respaldo JSON restaura también la programación; un CSV de contenido no lo sustituye.

- **Progreso → JSON:** perfil, intentos, correcciones y ruta.
- **Tarjetas → respaldo JSON:** tarjetas, configuración y repasos.
- **Resultados CSV / informe:** análisis de los datos registrados.
- **Proyecto reutilizable ZIP:** código limpio, sin historial ni credenciales.

La sesión de invitado dura como máximo 30 días y depende de su cookie. Antes de salir, limpiar el navegador o cambiar de dispositivo, exporta respaldos o trasládalos a una cuenta GitHub. Cerrar sesión invalida el acceso actual; no elimina por sí mismo los registros del servidor.

## 7. Reutilización y límites

`npm run build` regenera `public/ielts-path-source.zip`. Excluye dependencias, compilaciones, bases locales, secretos y la identidad de hosting original; el identificador de D1 se sustituye por un ejemplo. Incluye el mazo Oxford compartido, sin programación ni respuestas personales. No adjunta respaldos personales ni ejercicios privados. Revisa los recursos que añadas antes de redistribuirlos.

Las aportaciones originales se ofrecen bajo [MIT](../LICENSE). Conserva las licencias de terceros. Enlazar material oficial no concede permiso para redistribuirlo. IELTS Path no está avalado por los organismos examinadores y no garantiza una puntuación.

Consulta [METODOLOGIA.md](METODOLOGIA.md), [INVESTIGACION.md](INVESTIGACION.md) y [RESULTADOS-Y-LINKEDIN.md](RESULTADOS-Y-LINKEDIN.md) para interpretar y presentar resultados reales.
