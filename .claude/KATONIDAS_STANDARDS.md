# gstack

Use the `/browse` skill from gstack for all web navigation and browsing tasks.

Never use `mcp__claude-in-chrome__*` tools.

## Available gstack skills

- `/office-hours` — Interactive planning and advice session
- `/plan-ceo-review` — CEO-level plan review
- `/plan-eng-review` — Engineering plan review
- `/plan-design-review` — Design plan review
- `/design-consultation` — Design consultation
- `/design-shotgun` — Rapid design exploration
- `/design-html` — HTML/CSS design implementation
- `/review` — Code review
- `/ship` — Ship a feature end-to-end
- `/land-and-deploy` — Land and deploy changes
- `/canary` — Canary deployment
- `/benchmark` — Performance benchmarking
- `/browse` — Web browsing and navigation (use this for ALL web tasks)
- `/connect-chrome` — Connect to Chrome browser
- `/qa` — Full QA pass
- `/qa-only` — QA without implementation
- `/design-review` — Design review
- `/setup-browser-cookies` — Set up browser cookies
- `/setup-deploy` — Set up deployment
- `/retro` — Retrospective
- `/investigate` — Investigate a bug or issue
- `/document-release` — Document a release
- `/codex` — Codex agent tasks
- `/cso` — CSO security review
- `/autoplan` — Automatic planning
- `/careful` — Careful/cautious mode for risky changes
- `/freeze` — Freeze a branch/deployment
- `/guard` — Guard mode for protected branches
- `/unfreeze` — Unfreeze a branch/deployment
- `/gstack-upgrade` — Upgrade gstack to the latest version
- `/learn` — Learn about a codebase or topic

If gstack skills are not working, run the following to compile the binary and register the skills:

```
cd .claude/skills/gstack && ./setup
```

## Cuándo usar gstack en el flujo del holding

gstack es la **caja de herramientas técnica** que ejecuta partes concretas del flujo
de trabajo del holding. No sustituye al proceso del holding (Fases -2/-1/0/1..N,
actas, BUGS_INBOX, MEJORAS-FUTURAS, modos de autonomía): se invoca **dentro** de
ese proceso. Si un skill de gstack contradice una regla del holding, manda la
regla del holding.

### Mapeo: momento del flujo → skill

| Momento del trabajo | Skill recomendado | Obligatorio |
|---|---|---|
| Idea ambigua o feature nueva sin diseño claro | `/office-hours` | No, recomendado |
| Feature grande (≥5 archivos o cambio arquitectónico) | `/autoplan` (orquesta CEO+design+eng review automáticamente) | **Sí, recomendado** |
| Plan de feature ya redactado, validar a alto nivel | `/plan-ceo-review` | Opcional |
| Plan de feature, validar arquitectura | `/plan-eng-review` | Opcional |
| Plan de feature con UI relevante | `/plan-design-review` | Opcional |
| Bug complejo o no reproducible directamente | `/investigate` | **Sí, antes del fix** |
| Implementar fix o feature ya planificada | (codificación normal de Claude Code) | — |
| Al cerrar fase: revisión técnica del código | `/review` | **Sí, en modo `autonomo`** |
| Al cerrar fase: QA con navegador real | `/qa` (con browser) o `/qa-only` (solo report) | **Sí, en modo `autonomo`** |
| Bug o cambio con implicaciones de seguridad | `/cso` (auditoría OWASP/STRIDE) | **Sí, si toca auth/datos sensibles** |
| Abrir PR con tests y coverage audit | `/ship` | **Sí, sustituye al `git push + PR manual`** |
| Merge del PR + deploy + verificación producción | `/land-and-deploy` | **Sí, en proyectos con `/setup-deploy` configurado** |
| Post-deploy: monitorización en caliente | `/canary` | Opcional, recomendado tras release crítica |
| Documentar lo que se acaba de shippear | `/document-release` | Recomendado al cerrar feature |
| Retrospectiva semanal/quincenal | `/retro` | Opcional |
| Toda navegación web del agente | `/browse` | **Sí, único modo permitido** |

### Skills opcionales con coste/decisión adicional

- **`/codex`** — segunda opinión de OpenAI Codex. Requiere cuenta y crédito de
  OpenAI. Útil cuando un cambio tiene riesgo alto y se quiere "second pair of
  eyes" de un modelo distinto. **No es obligatorio en el flujo del holding**.
- **`/careful`, `/freeze`, `/guard`, `/unfreeze`** — guardarraíles de seguridad.
  Activar cuando se trabaja con producción, datos reales, o ramas protegidas.
  Ver sección "Excepciones que rompen la autonomía" del MODO DE TRABAJO.
- **`/benchmark`** — útil antes/después de optimizaciones de rendimiento. No
  por defecto.

### Comportamiento según modo de autonomía del proyecto

El holding define tres modos de autonomía (ver sección SISTEMA DE GESTIÓN DE
BUGS). gstack los respeta:

- **`autonomo`**: al cerrar fase, lanzar `/review` y `/qa` automáticamente sin
  preguntar. Si fallan, aplicar el ciclo de autocorrección (TESTING).
- **`semi_autonomo`**: al cerrar fase, ofrecer al CEO "¿lanzar /review y /qa
  ahora?" en una sola pregunta. Tras el "sí", ejecución sin más interrupciones.
- **`supervisado`**: ningún skill de gstack se lanza sin confirmación explícita
  del CEO en cada caso.

### Cómo se cuenta gstack en las actas

Cuando se ejecuta un skill significativo, se registra en el acta de sesión bajo
`trabajo_realizado` con `tipo: "test"` (para `/qa`, `/review`, `/cso`) o
`tipo: "infra"` (para `/ship`, `/land-and-deploy`). El campo `descripcion`
incluye el nombre del skill y el resultado.

---

# HOLDING KATONIDAS — Instrucciones globales
# Jesús Adán — CEO
# Estas instrucciones aplican a TODOS los proyectos sin excepción.

---

## MODO DE TRABAJO — LEER ESTO PRIMERO

### Fase -2 — Higiene de Git (SIEMPRE, antes de cualquier otra cosa)

Antes incluso de leer actas o tocar código, comprobar el estado del
working tree del repositorio:

1. Ejecutar `git status` y `git diff --stat`.
2. Si el árbol está limpio: pasar a Fase -1 sin más.
3. Si hay cambios no commiteados, **detenerse** y reportar al CEO:

   ```
   ⚠️  TRABAJO NO COMMITEADO DETECTADO

   Rama actual: [branch]
   Archivos modificados: [N]
   Archivos sin trackear: [N]

   [resumen por archivo: +X líneas, -Y líneas]

   Estos cambios NO son míos (de esta sesión). ¿Cómo procedemos?
     1. Commitear como trabajo del CEO — necesito que me indiques
        el mensaje apropiado o autor/intención.
     2. Descartar (git restore / git clean).
     3. Stash temporal mientras trabajamos.
     4. Ignorar y dejar en el working tree — a tu cuenta y riesgo.

   No continúo con Fase -1 hasta que decidas.
   ```

4. Esperar decisión del CEO por cada archivo o grupo de archivos. No
   asumir que cambios "parecen benignos" = deben commitearse.
5. Una vez el working tree queda en el estado que el CEO quiera (limpio,
   stasheado, o con cambios conservados conscientemente), pasar a Fase
   -1.

### Reglas inviolables de commit

Estas reglas aplican siempre, no solo en el chequeo inicial:

- **Nunca commitear trabajo que no es mío en un commit con mensaje mío.**
  Si detecto cambios en un archivo que contienen mi trabajo + trabajo
  ajeno no commiteado, pedir al CEO que persista primero lo suyo en un
  commit aparte con autoría y mensaje correctos. Luego aplico mis
  cambios en otro commit atómico.

- **Nunca inventar mensajes de commit para cambios que no entiendo.**
  Si no sé qué hace un cambio que voy a commitear, preguntar antes.

- **Nunca hacer `git add .` sin revisar qué entra.** Usar `git add`
  selectivo con rutas explícitas. Evita arrastrar archivos que no
  pertenecen al commit.

- **Nunca sobrescribir un commit ya pusheado** (`git commit --amend`
  tras push, `git push --force`) sin autorización explícita del CEO.

### Fase -1 — Continuidad de memoria (SIEMPRE, antes de cualquier otra cosa salvo Fase -2)

Antes incluso de Preflight, comprobar si el proyecto ya existe y tiene
memoria previa:

1. Verificar si existe la carpeta `.katonidas/actas/` en el proyecto.
2. Si existe:
   - Listar los ficheros de actas ordenados por fecha descendente.
   - Leer las **3 actas más recientes**.
   - Identificar bloqueos abiertos (actas tipo `bloqueo` sin resolución
     posterior registrada).
   - Identificar tareas pendientes heredadas de la última acta de sesión.
   - Presentar al CEO un resumen breve:
     "Última sesión el <fecha>. Pendiente: [...]. Bloqueos activos: [...].
      ¿Continuamos con [X] o prefieres otra cosa?"
3. Si no existe: se trata de un proyecto nuevo → pasar a Fase 0 (Preflight).
   La carpeta se creará en el paso de estructura base.

Ver sección **ACTAS ESTRUCTURADAS DE DESARROLLO** más abajo para el detalle
completo del sistema de actas.

### Fase 0 — Preflight (única fase con interacción)

Antes de escribir una sola línea de código, recopilar TODO
lo necesario en UN SOLO mensaje. Nunca pedir credenciales
o información una a una durante el build.

**Antes de la lista de Preflight**: si el alcance del proyecto o feature no
está claro, lanzar `/office-hours` para reformular el problema antes de pedir
credenciales. Si el alcance ya está claro y validado, saltar este paso y pasar
directamente al recopilatorio.

Al iniciar cualquier proyecto, presentar al CEO una lista
completa y ordenada con:

1. CREDENCIALES NECESARIAS — con instrucciones exactas
   de dónde obtener cada una:
   Ejemplo:
   - SUPABASE_URL → supabase.com → tu proyecto →
     Settings → Data API → Project URL
   - SUPABASE_ANON_KEY → mismo lugar → anon public key
   - NOTION_TOKEN → notion.so/my-integrations →
     tu integración → Internal Integration Token
   - (todas las que el proyecto necesite)

2. DECISIONES DE NEGOCIO — preguntar solo las ambigüedades
   reales que bloquean el diseño técnico. Máximo 3 preguntas,
   cada una con opciones concretas para elegir.

3. CONFIRMACIÓN FINAL — presentar resumen de lo que se va
   a construir y pedir un único "OK" para arrancar.

Una vez recibido el OK con todas las credenciales:
→ Ejecución 100% autónoma hasta completar el proyecto.
→ Sin interrupciones. Sin preguntas. Sin pausas para validar.

### Fase 1..N — Ejecución autónoma

Durante el build autónomo:
- Para features grandes (≥5 archivos o cambio arquitectónico): lanzar
  `/autoplan` antes de empezar a codificar. Orquesta CEO+design+eng review
  automáticamente y entrega un plan revisado. Aprobar o ajustar antes de
  ejecutar.
- Para bugs complejos o no reproducibles: lanzar `/investigate` antes del fix.
  No tocar código sin diagnóstico (Iron Law de gstack: "no fixes without
  investigation").
- Completar todas las fases del proyecto en orden
- Si surge un error: intentar resolverlo de forma autónoma
  hasta 3 veces antes de escalar
- Si tras 3 intentos el error persiste: parar, documentar
  el problema con detalle, generar acta de bloqueo y
  notificar al CEO
- Hacer commit al final de cada fase estable
- Lanzar el ciclo de testing y autocorrección al terminar
  cada fase (ver sección TESTING)
- Generar acta de hito al completar cada fase estable
  (ver sección ACTAS)
- Notificar al CEO SOLO al completar el proyecto entero
  o ante un bloqueo total que requiera intervención humana

### Única excepción que rompe la autonomía:

Pedir confirmación explícita antes de:
- Ejecutar migraciones destructivas en base de datos de producción
- Eliminar datos reales
- Cambiar variables de entorno en producción

Para todo lo demás: proceder sin preguntar.

### Al cerrar cualquier sesión de trabajo:

Generar obligatoriamente acta de sesión (ver sección ACTAS), commitearla,
hacer push, y mostrar resumen final al CEO.

---

## GOBIERNO TÉCNICO — CONFIGURACIÓN CRÍTICA EN BD DESDE EL DÍA 1

**Standard obligatorio del holding.** Aplica a todos los proyectos del
holding sin excepción.

### Principio

Toda configuración del sistema susceptible de cambio sin redespliegue
vive en base de datos, gestionada desde el panel de admin del proyecto,
**desde el primer despliegue**. No se hardcodea "para empezar". No se
difiere a "Fase 2". No se justifica por velocidad de implementación
inicial.

### Definición de "configuración crítica"

Está sujeto a este principio cualquier valor que cumpla **al menos una**
de estas condiciones:

- Define una taxonomía o clasificación del producto (ej: tipos de
  consulta, categorías, estados de pedido).
- Define umbrales o reglas de negocio variables (ej: rate limits,
  scoring weights, días de validez).
- Determina el comportamiento del sistema ante el usuario (ej: mensajes
  visibles, textos de chatbot, reglas de notificación).
- Puede necesitar ajuste sin que cambie el código (ej: lista de palabras
  prohibidas, días festivos, horarios especiales).
- Está sujeto a iteración basada en datos reales (ej: pesos de scoring,
  criterios de matching, prioridades).

### Excepciones legítimas

Hay tres casos en los que un valor puede vivir como constante en código
sin violar el principio:

1. **Datos estables de proveedores externos**: tarifas de APIs (Claude,
   OpenAI), identificadores de servicios (UUIDs de Vercel, IDs de
   Supabase), endpoints públicos. Cambian raras veces y no son
   configuración del producto.
2. **Constantes técnicas estructurales**: timeouts de red, tamaños de
   buffer, versiones mínimas. Tienen valor "correcto" determinado por
   contexto técnico, no por decisión de producto.
3. **Pre-seed inicial de tablas dinámicas**: el SQL de migración que
   crea la tabla puede contener valores iniciales (un INSERT con datos
   de partida). Esto NO es hardcoding porque el sistema lee de la
   tabla, no del código fuente del seed.

Cualquier excepción que no encaje en estas tres categorías debe
documentarse explícitamente con justificación.

### Anti-patrones prohibidos

**Anti-patrón 1**: "Lo dejamos hardcoded de momento, en Fase 2 lo
movemos a BD". La "Fase 2" se difiere indefinidamente porque el sistema
funciona. La configuración hardcoded acaba siendo el sitio donde la
realidad del producto y el código divergen — exactamente el patrón de
deuda aspiracional que el holding combate.

**Anti-patrón 2**: tabla creada pero código que ignora la tabla. Peor
que no tener la tabla. Da impresión de que la configuración es dinámica
cuando no lo es. Doble fuente de verdad: tabla + constante en código.

**Anti-patrón 3**: configuración crítica en variables de entorno cuando
debería estar en BD. Las env vars son apropiadas para credenciales,
URLs de servicios y entornos. No para configuración de producto que
necesita audit trail y acceso desde admin.

**Anti-patrón 4**: configuración en archivos de código fuente "fáciles
de editar" (ej: `lib/config/categories.ts`). Requieren commit, PR,
despliegue, y no son accesibles para perfiles no técnicos.

### Patrón correcto de implementación

Cualquier configuración crítica debe tener:

1. Tabla en BD con esquema versionado (migración).
2. Seed inicial en la migración con valores razonables de partida.
3. Lectura desde el código de producto vía cliente de BD, con cache en
   memoria de TTL corto (5-15 minutos según frecuencia esperada).
4. CRUD en panel de admin del proyecto, accesible para el responsable
   de producto.
5. Audit trail: campos `updated_at`, idealmente `updated_by`.

### Aplicación retroactiva

Para proyectos existentes con configuración crítica hardcoded:

1. Identificar en auditoría los valores que cumplen los criterios.
2. Priorizar según frecuencia esperada de cambio.
3. Migrar en bloques durante las auditorías trimestrales del holding.
4. Documentar la migración en `MEJORAS-FUTURAS.md` del proyecto con
   condiciones explícitas de cuándo abordarla.

No se exige migración inmediata de proyectos legacy, pero **toda nueva
configuración** que se introduzca en cualquier proyecto debe cumplir el
principio.

### Verificación durante auditorías trimestrales

1. Búsqueda automatizada: grep por patrones tipo `const TIPOS = [...]`,
   arrays exportados con valores de negocio.
2. Revisión del panel de admin: ¿están todas las entidades dinámicas
   accesibles? ¿Hay cosas en código que deberían estar en admin?
3. Coherencia código-BD: ¿hay tablas creadas pero no leídas?
4. Documentación: ¿el `CLAUDE.md` del proyecto referencia este
   standard cuando lo aplique?

### Origen del standard

Detectado en sesión de diseño del Agente de Usuarios de BarQLu
(2026-05-07), donde la propuesta inicial postergaba editorialización a
Fase 2, contradiciendo el patrón anti-deuda aspiracional del propio
diseño. Formalizado como standard transversal del holding.

### Documentación completa

Esta sección es la versión operativa para Claude Code. La versión
completa, con ejemplos SQL/TypeScript, política de aplicación
retroactiva, mecanismo de verificación detallado y versionado del
propio standard, vive en:

```
governance/configuracion-critica-en-bd.md
```

Cuando se actualice el standard, se actualizan ambos sitios a la vez.
La versión de `governance/` es la canónica.

---

## TESTING Y AUTOCORRECCIÓN AUTÓNOMA

Al terminar cada fase del build, ejecutar este ciclo completo
sin intervención humana:

### Ciclo de calidad por fase:

1. LINT — ejecutar el linter del proyecto (eslint, tsc --noEmit)
   → Si hay errores: corregir y repetir hasta 0 errores

2. TESTS UNITARIOS — ejecutar npm test o el runner configurado
   → Si hay fallos: analizar, corregir, volver a ejecutar
   → Repetir hasta que todos los tests pasen

3. BUILD — ejecutar npm run build
   → Si falla: corregir errores de compilación y repetir
   → El build debe ser exitoso antes de continuar

4. REVISIÓN DE CÓDIGO con `/review` — lanzar gstack `/review` sobre los
   cambios de la fase. El skill identifica:
   - Bugs que pasan CI pero fallan en producción
   - Race conditions, error paths sin cubrir, completitud
   - Auto-fix de issues obvios; flags para issues que requieren juicio
   → Si /review devuelve issues con `[ASK]`: aplicar criterio del modo de
     autonomía del proyecto (autonomo: Claude Code resuelve; supervisado:
     preguntar al CEO).
   → Si toca código de auth, datos sensibles, o infra de seguridad: lanzar
     adicionalmente `/cso` (auditoría OWASP/STRIDE).

5. TESTS DE INTEGRACIÓN con `/qa` — lanzar gstack `/qa` para verificar
   end-to-end con navegador real:
   - Conexión a Supabase correcta
   - Variables de entorno cargadas
   - Rutas principales responden
   - Formularios guardan datos correctamente
   - Flujos de usuario completos funcionan en el navegador
   → `/qa` encuentra bugs, los arregla con commits atómicos, y genera test
     de regresión por cada fix.
   → Si solo se quiere reporte sin tocar código: `/qa-only`.

6. REVISIÓN DE CONSOLA — verificar que no hay errores ni
   warnings críticos en consola al cargar la app

7. AUTOCORRECCIÓN EN BUCLE:
   → Si cualquier paso falla: corregir el problema
   → Volver al paso 1 y repetir el ciclo completo
   → Máximo 5 iteraciones por fase
   → Si tras 5 iteraciones hay fallos sin resolver:
     documentar en bug-registry.json, generar acta de bloqueo
     y notificar al CEO

8. ACTA DE HITO — si la fase completada es significativa
   (feature terminada, release, migración, cambio arquitectónico
   mayor, bug crítico resuelto), generar acta de hito antes
   de continuar.

### Al finalizar el proyecto completo:
- Ejecutar /qa para un pase de QA completo (si no se hizo en la última fase)
- Lanzar `/document-release` para actualizar README, ARCHITECTURE,
  CHANGELOG y demás docs con lo shippeado
- Actualizar bug-registry.json con cualquier issue conocido
- Actualizar CHANGELOG.md con todo lo construido
- Generar acta de hito tipo `release` con resumen del proyecto
- Generar acta de sesión final
- Ejecutar node notion-sync.js para sincronizar documentación
- Hacer push final a main vía `/ship` o `/land-and-deploy`
- Notificar al CEO con resumen: qué se construyó, URL de
  producción, variables de entorno que hay que configurar,
  issues conocidos si los hay

---

## GIT + GITHUB — OBLIGATORIO EN CADA PROYECTO NUEVO

Al iniciar cualquier proyecto nuevo:
1. Inicializar repositorio Git local
2. Crear repositorio en GitHub bajo la cuenta de Holding Katonidas
3. Nombre del repo: nombre-del-proyecto (kebab-case, sin mayúsculas)
4. Primer commit con estructura base antes de continuar
5. Push a main antes de instalar dependencias o escribir código
6. Crear rama develop para trabajo en curso
   — main solo recibe merges estables

### Flujo estándar de PR y deploy con gstack

Para abrir Pull Requests y desplegar a producción, usar siempre los skills
de gstack en lugar del flujo manual de `git push + crear PR`:

- **`/ship`** — flujo completo: sincroniza con main, ejecuta tests, audita
  coverage, push, abre PR. Bootstrap automático de framework de tests si el
  proyecto no tenía. Output: URL del PR. **Sustituye al `git push + PR
  manual`.**
- **`/land-and-deploy`** — merge del PR aprobado, espera de CI, deploy a
  Vercel, verificación de salud en producción. Una sola orden de "aprobado"
  a "verificado en producción". Requiere haber ejecutado `/setup-deploy`
  previamente para configurar URLs y comandos de deploy del proyecto.
- **`/canary`** (opcional) — tras un release crítico, monitorización
  post-deploy: errores de consola, regresiones de rendimiento, fallos de
  página.

Excepción: para fixes triviales de bugs P2 sobre `develop` que no abren PR
(ver SISTEMA DE GESTIÓN DE BUGS), el commit directo y push manual sigue
siendo válido.

Nunca subir al repositorio:
- Archivos .env
- node_modules
- Archivos de build (/dist, /.next, /build)
- Logs locales

Sí subir al repositorio (importante):
- La carpeta `.katonidas/actas/` completa. Las actas son parte de la
  trazabilidad del proyecto y se versionan con el código.

Crear siempre en el primer commit:
- .env.example con todas las variables documentadas y comentadas
- .gitignore completo
- README.md con: descripción, stack, variables de entorno,
  comandos de instalación y arranque

---

## STACK ESTÁNDAR DE HOLDING KATONIDAS

Salvo que el proyecto indique explícitamente otro stack:

Frontend:
- React + Vite + TypeScript
- Tailwind CSS
- Deploy en Vercel (auto-deploy en push a main)

Backend / Base de datos:
- Supabase (PostgreSQL) — región Frankfurt (Europa Central) por defecto.
  Motivo del default: mayoría de proyectos del holding sirven a usuarios
  europeos (principalmente España), optimización de latencia y cumplimiento
  RGPD simplificado al mantener datos en UE.

  Excepciones documentadas:
  - HK_FAIR → Singapore. Motivo: proyecto diseñado para uso desde Hong Kong,
    Singapore es la región Supabase más cercana geográficamente.

  Para crear un proyecto nuevo en región distinta a Frankfurt: justificar
  en Preflight (Fase 0) antes de crear el proyecto Supabase. Registrar la
  excepción en esta sección del CLAUDE_GENERAL al cerrar la sesión.

- Para apps con necesidad offline: Dexie.js (IndexedDB)
  como capa local + sync a Supabase

Automatización:
- N8N en VPS Hetzner para flujos internos de agentes
- Make.com para flujos de negocio externos

Comunicación:
- WhatsApp vía Evolution API (auto-hospedada o cloud según proyecto)
- Email vía Google Workspace (katonidas.com)

Pagos (fase futura):
- Stripe

---

## VERCEL — DEPLOY AUTOMÁTICO

En cada proyecto nuevo:
1. Ejecutar: vercel --prod para el primer deploy
2. Conectar al repositorio de GitHub
3. Configurar variables de entorno en Vercel dashboard
4. Confirmar que auto-deploy está activo en push a main
5. Dominio por defecto: nombre-proyecto.vercel.app
   (luego se mapea a subdominio de katonidas.com si procede)
6. Ejecutar `/setup-deploy` (gstack) para registrar URL de producción y
   comandos de deploy del proyecto. Habilita `/land-and-deploy` para
   merge + deploy + verificación end-to-end.

---

## SINCRONIZACIÓN CON NOTION — OBLIGATORIO

Cada proyecto incluye el sistema de sync a Notion desde el
primer día. Estándar establecido en BarConnect.

### Archivos que crear en cada proyecto:

**notion-sync.js** — script de sincronización
Actualiza estas 5 páginas en Notion al ejecutarse:

- 📊 Estado del Proyecto
  Stack tecnológico, servicios activos, endpoints,
  URLs de producción, variables de entorno (sin valores
  sensibles), tareas pendientes para el CEO.

- 🐛 Log de Errores
  Lee bug-registry.json. Incluye: ID, título, severidad
  (critical/high/medium/low), estado (open/in-progress/closed),
  fecha de detección, ronda de QA.

- 🚀 Mejoras Futuras
  Lee MEJORAS-FUTURAS.md. Organizado por fases y prioridad.

- 🏗️ Arquitectura
  Estructura de archivos, diagrama de capas, tablas de base de
  datos, integraciones activas, flujos principales,
  design system si aplica.

- 📝 Changelog
  Historial completo de cambios por fecha. Cada entrada incluye:
  fecha, descripción del cambio, quién lo realizó.
  IMPORTANTE: única página que NO se reescribe completa.
  Se hace prepend de la nueva entrada al inicio.
  Nunca se borra el historial acumulado.

Las 4 primeras páginas son destructivas: borra y reescribe.
El Changelog es aditivo: solo añade al principio.

### Cuándo se ejecuta el sync:
- Al arrancar la app (15 segundos de delay tras el boot)
- Cada día a las 3:00 AM vía cron
- Manual en cualquier momento: node notion-sync.js

### Variables de entorno para Notion (añadir a .env.example):
NOTION_TOKEN=
NOTION_PAGE_ESTADO=
NOTION_PAGE_ERRORES=
NOTION_PAGE_MEJORAS=
NOTION_PAGE_ARQUITECTURA=
NOTION_PAGE_CHANGELOG=

---

## ACTAS ESTRUCTURADAS DE DESARROLLO — OBLIGATORIO

Sistema de memoria persistente del holding. Cada sesión de Claude Code
genera actas en JSON que dan continuidad entre sesiones, alimentan a los
directivos Claude.ai del holding, y servirán de input al MCP Katonidas
(fase B) y al auditor semanal (fase C).

**Regla de oro: ninguna sesión termina sin acta de sesión. Los hitos y
bloqueos generan actas adicionales en el momento en que ocurren.**

### Ubicación y organización

Dentro de cada proyecto, crear (si no existe) la carpeta:

```
<proyecto>/.katonidas/actas/
```

Cada acta es un fichero JSON independiente con nombre:

```
<YYYY-MM-DD>-<HHMM>-<tipo>-<slug_corto>.json
```

Ejemplos:
- 2026-04-21-0930-sesion-rls-bares.json
- 2026-04-21-1400-hito-deploy-beta.json
- 2026-04-22-1015-bloqueo-supabase-quota.json

### Versionado

Las actas se **commitean al repositorio del proyecto** como parte del
trabajo. Mensaje de commit estándar:

```
chore(actas): <tipo> <slug_corto>
```

Nunca incluir secretos en las actas (credenciales, tokens, contenido
sensible). Si hay que referenciar un secreto, referirlo como
`${NOMBRE_ENV_VAR}`.

### Los tres tipos de acta

**1. Acta de sesión (`tipo: "sesion"`)** — OBLIGATORIA al cerrar cualquier
sesión de trabajo, incluso si fue corta. Es el cierre de jornada.

**2. Acta de hito (`tipo: "hito"`)** — OBLIGATORIA al completar:
- Feature terminada y mergeada a main
- Deploy a producción exitoso
- Bug crítico resuelto
- Release cerrada
- Migración de datos completada
- Cambio arquitectónico mayor aplicado

Puede haber varias en una misma sesión.

**3. Acta de bloqueo (`tipo: "bloqueo"`)** — OBLIGATORIA cuando:
- Hay una decisión que requiere intervención del CEO
- Hay una decisión que corresponde a un directivo (Estrategia, Tecnología,
  Financiero, Legal, Chief of Staff)
- Hay un problema externo que impide continuar (API caída, quota excedida,
  credencial inválida no reemplazable autónomamente)
- Hay una ambigüedad en los requisitos que no puede resolverse por
  inferencia razonable

Tras escribir un acta de bloqueo, detener ese flujo y continuar con trabajo
paralelo si es posible; si no, cerrar sesión con acta de sesión.

### Schema común (todos los tipos)

```json
{
  "id": "acta-YYYY-MM-DD-HHMM-proyecto-NNN",
  "tipo": "sesion | hito | bloqueo",
  "proyecto": "nombre canónico del proyecto",
  "fecha_inicio": "ISO8601 con timezone",
  "fecha_fin": "ISO8601 con timezone",
  "duracion_minutos": 0,
  "sesion_anterior_id": "id del acta de sesión previa o null",
  "actas_contexto_leidas": ["ids de actas leídas al iniciar"]
}
```

### Schema específico — tipo `sesion`

```json
{
  // ... campos comunes ...
  "tipo": "sesion",
  "objetivo_sesion": "qué se pretendía hacer",
  "contexto_inicial": "estado de partida",
  "trabajo_realizado": [
    {
      "descripcion": "",
      "tipo": "feature | fix | refactor | chore | docs | test | infra",
      "archivos": ["paths relativos"],
      "commit": "hash corto o null"
    }
  ],
  "decisiones_tecnicas": [
    {
      "decision": "",
      "rationale": "",
      "alternativas_descartadas": [],
      "impacto": "local | proyecto | holding"
    }
  ],
  "tests": {
    "ejecutados": 0,
    "pasados": 0,
    "fallados": 0,
    "detalles_fallos": []
  },
  "deploys": [
    {
      "entorno": "vercel-preview | vercel-prod | vps | ...",
      "url": "o null",
      "estado": "success | failed | partial",
      "notas": ""
    }
  ],
  "pendiente": ["tareas claras que quedan abiertas"],
  "bloqueos": ["ids de actas de bloqueo generadas en esta sesión"],
  "dependencias_externas": [
    "cosas que dependen de otra persona/directivo/servicio"
  ],
  "notas_para_directivos": {
    "estrategia": "string o null",
    "tecnologia": "string o null",
    "financiero": "string o null",
    "legal": "string o null",
    "chief_of_staff": "string o null"
  },
  "metricas_sesion": {
    "lineas_anadidas": 0,
    "lineas_eliminadas": 0,
    "archivos_tocados": 0,
    "commits_creados": 0
  }
}
```

### Schema específico — tipo `hito`

```json
{
  // ... campos comunes ...
  "tipo": "hito",
  "hito": "nombre del hito",
  "categoria": "feature | release | migracion | arquitectura | bug_critico",
  "descripcion": "",
  "impacto_negocio": "cómo afecta al proyecto o al usuario final",
  "impacto_holding": "cómo afecta a otros proyectos del holding o null",
  "commits_relacionados": ["hashes"],
  "pull_requests": ["URLs"],
  "deploys_asociados": ["entornos"],
  "validacion": {
    "tests_pasados": true,
    "validacion_manual": "string o null",
    "metricas_post_hito": "string o null"
  },
  "notas_para_directivos": {
    "estrategia": "string o null",
    "tecnologia": "string o null",
    "financiero": "string o null",
    "legal": "string o null",
    "chief_of_staff": "string o null"
  }
}
```

### Schema específico — tipo `bloqueo`

```json
{
  // ... campos comunes ...
  "tipo": "bloqueo",
  "severidad": "baja | media | alta | critica",
  "categoria": "decision_ceo | decision_directivo | problema_externo | ambiguedad_requisitos",
  "titulo": "resumen de una línea",
  "descripcion": "explicación completa",
  "contexto": "qué intentaba hacerse cuando surgió",
  "opciones_identificadas": [
    {
      "opcion": "",
      "pros": [],
      "contras": [],
      "recomendacion_claude_code": false
    }
  ],
  "destinatario": "ceo | estrategia | tecnologia | financiero | legal | externo",
  "urgencia": "para cuándo se necesita respuesta",
  "impacto_si_no_se_resuelve": "",
  "trabajo_paralelo_posible": ["qué se puede hacer mientras tanto"]
}
```

### Flujo operativo

**Al iniciar sesión** (ya cubierto en Fase -1):
- Leer las 3 actas más recientes del proyecto
- Identificar bloqueos abiertos y pendientes heredados
- Presentar resumen al CEO antes de preguntar qué hacer

**Durante la sesión**:
- Registrar decisiones técnicas para incluirlas en el acta final
- Si aparece un bloqueo: generar acta de bloqueo inmediatamente y detener
  ese flujo
- Si se completa un hito: generar acta de hito en el momento, no al final

**Al cerrar sesión**:
1. Generar acta de sesión con todos los campos
2. Commitear todas las actas generadas (`chore(actas): ...`)
3. Push al remoto
4. Ejecutar notion-sync.js incluyendo referencia a nuevas actas
5. Mostrar resumen al CEO: "Sesión cerrada. Acta: <path>. Pendiente para
   próxima: [...]. Bloqueos generados: [...]."

**Validación antes de guardar cada acta**:
- JSON sintácticamente válido
- Todos los campos obligatorios presentes
- Campos `notas_para_directivos`: si no hay nota, valor `null`, no string
  vacío
- `duracion_minutos` coherente con fechas
- `id` único (no existe ya en la carpeta)

### Principios editoriales

Las actas las leerán (a) el propio Claude Code en sesiones futuras,
(b) los directivos Claude.ai, (c) el auditor automático (fase C). Por tanto:

- **Prosa útil, no verbosa.** Cada campo de texto lo más conciso posible
  sin perder información.
- **Sin relleno.** Si no hay decisiones técnicas, `decisiones_tecnicas: []`,
  no inventar.
- **Nombres concretos.** Ficheros, funciones, tablas por su nombre real.
- **Notas para directivos, quirúrgicas.** Solo rellenar el campo del
  directivo si hay algo que le concierne específicamente. Por defecto:
  `null`.
- **Rationale siempre.** Toda decisión técnica lleva su "por qué", no solo
  el "qué".

### Migración futura al MCP Katonidas

Las actas JSON locales son temporales por diseño. Cuando el MCP Katonidas
esté desplegado (Fase B del plan del holding), un script de migración
recorrerá todas las carpetas `.katonidas/actas/` y las insertará en las
tablas del MCP. Los ficheros JSON se mantienen como backup versionado.

No cambia el formato de generación; cambia solo dónde viven además.
Escribir actas ahora con este schema es inversión, no trabajo desechable.

---

## SISTEMA DE GESTIÓN DE BUGS — OBLIGATORIO

Estándar del holding para la detección, resolución y trazabilidad de bugs
en todos los proyectos. Se integra con el sistema de actas y con el sync
a Notion.

### Arquitectura de archivos

Cada proyecto mantiene dos archivos complementarios:

- **`docs/BUGS_INBOX.md`** — Bandeja de entrada en Markdown. La rellena el
  CEO al detectar bugs durante testing. Claude Code lee, resuelve y vacía
  este archivo. El CEO nunca ve aquí lo ya resuelto.

- **`bug-registry.json`** — Log oficial del proyecto (formato estándar del
  holding, ver sección ARCHIVOS ESTÁNDAR). Lo mantiene Claude Code.
  Alimenta la página "🐛 Log de Errores" de Notion vía `notion-sync.js`.

**Regla de oro:** cuando un bug se resuelve, se ELIMINA de `BUGS_INBOX.md`
y se AÑADE a `bug-registry.json` con `status: closed`. Nunca debe aparecer
en los dos sitios simultáneamente.

### Formato de `BUGS_INBOX.md`

Plantilla estándar:

```markdown
# [Proyecto] — Bugs Inbox

> Bandeja de entrada. CEO escribe, Claude Code resuelve y vacía.

## Severidades
- P0 — Crítico. Bloquea uso.
- P1 — Alto. Molesta pero hay workaround.
- P2 — Medio. Nice to have.

## Bugs pendientes

### Bug 1
- **Ruta**:
- **Tipo**: Bug / Mejora / UX
- **Prioridad**: P0 / P1 / P2
- **Navegador/Dispositivo**:
- **Qué pasa**:
- **Qué debería pasar**:
- **Pasos para reproducir**:
- **Captura**:
- **Notas**:
```

### Mapeo de severidades INBOX → bug-registry

- INBOX `P0` → registry `critical`
- INBOX `P1` → registry `high`
- INBOX `P2` → registry `medium`
- (no usado en INBOX) → registry `low`

### Modo de autonomía de bugs (configurable por proyecto)

Cada proyecto declara en su `CLAUDE.md` uno de estos tres modos. Si el
`CLAUDE.md` no lo declara explícitamente, el default del holding es
`autonomo` (coherente con la filosofía de ejecución sin interrupciones).

**Modo `autonomo`** (default del holding)
- Claude Code resuelve los bugs del INBOX sin preguntar al CEO.
- Se ejecuta automáticamente al inicio de sesión tras la Fase -1 de
  continuidad, o bajo demanda durante la sesión.
- Coherente con la filosofía "recibido OK → ejecución sin pausas".
- Uso recomendado: proyectos en mantenimiento, proyectos maduros,
  proyectos con bugs bien tipificados.

**Modo `semi_autonomo`**
- Al iniciar sesión (tras Fase -1), Claude Code lee el INBOX y
  pregunta UNA VEZ si resolver los bugs pendientes.
- Tras el "sí" del CEO: ejecución sin interrupciones hasta terminar.
- Uso recomendado: proyectos en fase de testing activo donde el CEO
  está detectando bugs manualmente y quiere supervisar qué entra en
  cada tanda.

**Modo `supervisado`**
- Claude Code pregunta al CEO antes de cada bug individual.
- Uso recomendado: solo proyectos en contextos muy sensibles (datos
  regulados, producción crítica). No debería ser común.

### Protocolo de resolución autónoma (aplica a los tres modos)

Los bugs se resuelven de forma **secuencial** (nunca en paralelo, para
evitar conflictos de merge), ordenados por prioridad P0 → P1 → P2.

El trabajo se hace directamente sobre la rama `develop` (convención del
holding, ver sección GIT + GITHUB). Sin ramas `fix/bug-XXX` separadas.
Sin PRs por bug. El CEO decide cuándo `develop` se promociona a `main`.

Cada bug resuelto = un commit atómico con formato:
```
fix: [descripción corta] (BUG-XXX)
```

**Para CADA bug:**

**Fase 1 — Agente de resolución**

1. Lanzar subagente con `/investigate` para analizar el bug.
2. Evaluar si el bug es resoluble automáticamente:
   - Si falta información crítica: añadir nota al ticket en INBOX con
     `⚠️ NECESITO INFO: [qué necesitas]` y pasar al siguiente.
   - Si entra en casos de REVISIÓN MANUAL (ver lista abajo): añadir
     nota `🔧 REVISION MANUAL: [motivo]`, no tocar código, pasar al
     siguiente.
   - Si es resoluble: continuar.
3. Usar `/ship` para implementar el fix sobre `develop`.
4. Commit atómico: `fix: [descripción] (BUG-XXX)`.

**Fase 2 — Agente de testing**

5. Lanzar subagente separado con `/qa-only` para verificar:
   - Testear el escenario exacto del bug.
   - Verificar que no hay regresión en funcionalidades relacionadas.
6. Si el test FALLA:
   - Revertir el commit (`git revert`).
   - Marcar bug en INBOX como `❌ FIX FALLIDO — REVISION MANUAL` con
     log del error.
   - No reintentar automáticamente. Pasar al siguiente.
7. Si el test PASA:
   - Asignar ID correlativo (BUG-XXX, continuando desde el último de
     `bug-registry.json`).
   - Añadir entrada a `bug-registry.json` con status `closed`.
   - Eliminar ticket de `BUGS_INBOX.md`.
   - Actualizar `last_updated` en `bug-registry.json`.

### Casos que SIEMPRE requieren revisión manual

Estos casos NUNCA se resuelven autónomamente, aunque el modo sea
`autonomo`:

- Cambios en schema SQL (migraciones)
- Cambios en políticas RLS de Supabase
- Cambios en configuración de Stripe, OAuth, dominios, DNS
- Cualquier bug que implique borrar datos de producción
- Cambios en system prompts de agentes IA
- Cambios en variables de entorno o secrets
- Cualquier fix que requiera más de 3 archivos tocados simultáneamente
  (posible refactor, no bug)

### Bugs de seguridad — protocolo especial

Si un bug toca autenticación, autorización, manejo de secretos, sanitización
de inputs, o cualquier vector con implicaciones de seguridad:

1. **Lanzar `/cso` antes de tocar código**. Audita OWASP Top 10 + STRIDE
   threat model con confidence gate 8/10+ y cero ruido por falsos positivos.
2. Si `/cso` identifica el bug como vector real de ataque: el fix pasa por
   revisión manual, **no se aplica autónomamente** aunque el modo sea
   `autonomo`.
3. Generar acta de bloqueo con severidad `alta` o `critica` según hallazgo
   de `/cso`, destinatario `ceo`.

### Integración con el sistema de actas

- **Bug crítico (P0) resuelto autónomamente**: generar acta de tipo
  `hito` con `categoria: "bug_critico"`.
- **Fix fallido o caso de revisión manual**: generar acta de tipo
  `bloqueo` con severidad correspondiente y `destinatario: "ceo"`.
- **Bugs P1/P2 resueltos**: se agregan al `trabajo_realizado` del acta
  de `sesion` normal al cerrar la sesión (no generan acta individual).

### Integración con Notion

`bug-registry.json` se actualiza continuamente durante la sesión.
`notion-sync.js` se ejecuta al cerrar la sesión (ya previsto en el
flujo estándar) → actualiza la página "🐛 Log de Errores" en Notion
automáticamente.

### Reporte final al CEO tras la sesión de bugs

Formato obligatorio:

```
✅ SESIÓN DE BUGS COMPLETADA

Resueltos automáticamente: [N]
  - [BUG-X] [descripción corta]

⚠️ Requieren info adicional: [N]
  - [BUG-Z] [qué falta]

🔧 Requieren revisión manual: [N]
  - [BUG-W] [motivo]

❌ Fixes fallidos (revertidos): [N]
  - [BUG-V] [error detectado]

Commits en develop: [N]
Tests ejecutados: [N] ([N] OK, [N] KO)
Actas generadas: [lista de ids]

Siguiente acción recomendada: [qué haría Claude Code en lugar del CEO]
```

---

## SISTEMA DE BACKLOG ESTRATÉGICO — `MEJORAS-FUTURAS.md`

Estándar del holding para gestionar ideas, features y mejoras que no son
urgentes pero merecen capturarse. Complementa el sistema de bugs: los
bugs se arreglan ya, las mejoras esperan su momento.

### Diferencia crítica con BUGS_INBOX

| | BUGS_INBOX.md | MEJORAS-FUTURAS.md |
|---|---|---|
| Contiene | Cosas rotas o urgentes | Ideas y visión a futuro |
| Urgencia | Resolver ahora | Cuando toque |
| Gestión | Claude Code lo vacía | Se acumula y se prioriza |
| Horizonte | Días | Semanas / meses |

Regla práctica: si una idea te hace pensar "debería hacerse esta semana",
va a BUGS_INBOX. Si piensas "molaría tener esto algún día", va a
MEJORAS-FUTURAS.

### Ubicación

`docs/MEJORAS-FUTURAS.md` (dentro de la carpeta docs, junto a BUGS_INBOX).

### Estructura obligatoria

```markdown
# Mejoras Futuras — [Nombre Proyecto]

## Fase 1 — Estabilización
Mejoras que conviene hacer antes del lanzamiento o en las primeras
semanas post-lanzamiento.

## Fase 2 — Crecimiento
Mejoras que tienen sentido cuando el producto tenga tracción.
Criterio de activación: definir métrica concreta (ej: >100 usuarios
activos, >10 bares registrados, >X€ MRR).

## Fase 3 — Monetización / Escala
Features premium, optimizaciones de infraestructura, expansión.
Solo tras validar el modelo.

## Ideas / largo plazo
Cosas que suenan bien pero aún no se sabe si tienen sentido.
Permitido "tirar ideas" sin filtro aquí.
```

### Reglas operativas

**Quién añade entradas:**

- **CEO**: siempre, en cualquier fase. Solo apunta la idea, sin filtro.
- **Claude Code**: solo cuando detecta durante un fix algo que merece
  mejora pero queda fuera de scope del bug. En ese caso, **no edita el
  archivo directamente**: lo propone al CEO en el reporte final con
  formato `💡 PROPUESTA PARA BACKLOG: [idea]`. El CEO decide si añadir.

Esta restricción evita que Claude Code infle el backlog con ideas
tangenciales detectadas en cada sesión.

**Cada cuánto se revisa:**

- **Revisión mensual obligatoria**: primer día hábil de cada mes, 15
  minutos. El CEO repasa el backlog y:
  - Promociona ideas de una fase posterior a anterior si ha llegado el
    momento.
  - Degrada ideas que ya no tienen sentido (moverlas a "Descartadas" o
    borrarlas).
  - Extrae ideas maduras y las convierte en tickets de BUGS_INBOX para
    implementación inmediata.

- **Revisión ad-hoc**: tras cada hito significativo (release, pivote,
  nueva ronda de feedback de usuarios). Las ideas envejecen mal si no
  se revisan con cierta cadencia.

**Criterio de promoción (idea → BUGS_INBOX):**

Una idea está lista para pasar a implementación cuando cumple las tres:
1. Está en Fase 1 del backlog (o se ha promovido a ella).
2. Tiene descripción suficientemente concreta para ejecutarse sin
   ambigüedad.
3. El CEO decide que es el momento — no depende de Claude Code.

**Formato de una entrada en el backlog:**

```markdown
- **[Título breve]** — [descripción de 1-3 líneas]
  - Motivación: [por qué tendría valor]
  - Dependencias: [nada / requiere X / requiere validar Y]
  - Añadido: YYYY-MM-DD
```

La fecha de añadido es importante: ideas con más de 6 meses sin mover
son candidatas a revisión crítica (¿sigue teniendo sentido?).

### Integración con Notion

`notion-sync.js` lee `docs/MEJORAS-FUTURAS.md` (antes estaba en raíz, si
un proyecto legacy lo tiene ahí, ajustar la ruta en el script al migrar)
y actualiza la página "🚀 Mejoras Futuras" en Notion, organizada por
fases.

### Integración con actas

Cuando se promueve una idea del backlog a implementación (paso a
BUGS_INBOX o se empieza a construir como feature):
- Registrar la decisión en el acta de sesión de ese día, en
  `decisiones_tecnicas`, con rationale del por qué ahora.
- Si es una feature mayor: al completarse, generar acta de `hito` con
  referencia a la entrada original del backlog.

### Principio editorial

Este archivo **no es decoración**. Si el equipo no lo revisa en 3 meses,
es mejor borrarlo y empezar de cero que mantener un cementerio de ideas
muertas que dan falsa sensación de planificación.

---

## GITHUB ACTIONS / CI — OBLIGATORIO

Estándar del holding para automatizar calidad de código en todos los
proyectos. Se configura en el primer commit tras crear el repositorio.

### Relación con `/ship` (gstack)

`/ship` y GitHub Actions son **complementarios, no excluyentes**:

- `/ship` se ejecuta **antes** del PR: corre tests localmente, audita
  coverage, valida que todo pasa, y abre el PR. Reduce el ruido de PRs
  rotos en GitHub.
- GitHub Actions se ejecuta **después** del PR (y en cada push a develop/
  main): valida en entorno limpio que todo sigue pasando.

Si `/ship` deja un PR limpio, GitHub Actions lo confirma. Si `/ship` se
salta (por ejemplo en un fix manual urgente), GitHub Actions sigue siendo
la red de seguridad obligatoria.

### Estructura

Cada proyecto incluye, en su primer push:

```
.github/
└── workflows/
    └── ci.yml
```

### Qué hace el workflow estándar

En cada `push` a `develop` o `main`, y en cada Pull Request contra
`main`, ejecutar:

1. **Lint** — `npm run lint` (ESLint + Prettier si configurado).
2. **Type check** — `npx tsc --noEmit` (TypeScript sin emitir archivos).
3. **Build** — `npm run build` (verificar que compila).
4. **Tests** — `npm test` (tests unitarios si existen).

Si cualquier paso falla: el commit queda marcado como rojo en GitHub
y se envía email al CEO (admin@katonidas.com) automáticamente por el
sistema de notificaciones nativo de GitHub.

### Plantilla de `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Lint, Build, Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Type check
        run: npx tsc --noEmit --if-present
        continue-on-error: false

      - name: Build
        run: npm run build

      - name: Test
        run: npm test --if-present
```

### Configuración de notificaciones

En GitHub → Settings de la cuenta admin@katonidas.com → Notifications:
- **Actions** → marcar "Send notifications for failed workflows only"
- **Email** → admin@katonidas.com

Así el CEO solo recibe email cuando algo falla. Los commits exitosos
no generan ruido.

### Scripts npm que deben existir en `package.json`

Para que el CI funcione, asegurar que cada proyecto tiene estos scripts
definidos en `package.json`:

```json
{
  "scripts": {
    "lint": "eslint .",
    "build": "vite build",
    "test": "vitest run"
  }
}
```

Si alguno de estos no aplica al proyecto (ej: proyecto sin tests
todavía), usar el flag `--if-present` en el workflow (ya está en la
plantilla) para que GitHub Actions no falle por pasos ausentes.

### Archivos que NO activan CI

El CI ignora cambios que solo afectan a documentación. Para ello, en
el workflow se pueden excluir paths si el volumen de commits solo de
actas/docs llega a ser ruidoso. Regla pragmática: si en 1 mes hay más
de 20 builds innecesarios por commits de solo actas, añadir filtro
`paths-ignore` al workflow.

---

## ARCHIVOS ESTÁNDAR DE CADA PROYECTO

**bug-registry.json**
{
  "project": "nombre-del-proyecto",
  "last_updated": "",
  "bugs": [
    {
      "id": "BUG-001",
      "title": "",
      "severity": "critical|high|medium|low",
      "status": "open|in-progress|closed",
      "detected_at": "",
      "qa_round": 1,
      "description": "",
      "fix": ""
    }
  ]
}

**docs/BUGS_INBOX.md** (bandeja de entrada del CEO — ver sección
SISTEMA DE GESTIÓN DE BUGS para el formato completo y el flujo)

# [Nombre Proyecto] — Bugs Inbox

> Bandeja de entrada. CEO escribe, Claude Code resuelve y vacía.

## Bugs pendientes

(vacío al inicio del proyecto)

**docs/MEJORAS-FUTURAS.md** (backlog estratégico — ver sección
SISTEMA DE BACKLOG ESTRATÉGICO para la operativa completa)

# Mejoras Futuras — [Nombre Proyecto]

## Fase 1 — Estabilización
-

## Fase 2 — Crecimiento
-

## Fase 3 — Monetización / Escala
-

## Ideas / largo plazo
-

**CHANGELOG.md**
# Changelog — [Nombre Proyecto]

## [fecha] — Inicio del proyecto
- Proyecto creado bajo Holding Katonidas
- Stack inicial configurado

---

## ESTRUCTURA DE CARPETAS ESTÁNDAR

nombre-proyecto/
├── .github/
│   └── workflows/
│       └── ci.yml              # CI: lint + build + tests (ver sección GITHUB ACTIONS)
├── src/                        # código fuente
├── public/                     # assets estáticos
├── docs/
│   ├── BUGS_INBOX.md           # bandeja de entrada de bugs del CEO
│   └── MEJORAS-FUTURAS.md      # backlog estratégico — ver SISTEMA DE BACKLOG
├── .katonidas/
│   └── actas/                  # actas estructuradas (JSON) — ver sección ACTAS
├── notion-sync.js              # sync a Notion
├── bug-registry.json           # registro oficial de errores — ver SISTEMA DE GESTIÓN DE BUGS
├── CHANGELOG.md                # historial de cambios (raíz, convención Keep a Changelog)
├── .env                        # variables locales (no subir a Git)
├── .env.example                # plantilla de variables (sí subir)
├── .gitignore
├── README.md
└── package.json

---

## DIRECTORIO DE PROYECTOS

Todos los proyectos se crean en esta ruta por defecto:
%USERPROFILE%\PROYECTOS-IA\nombre-del-proyecto

Si la carpeta PROYECTOS-IA no existe, crearla automáticamente.
Nunca crear proyectos en otra ubicación salvo indicación explícita.

Nota histórica: hasta el 2026-05-06 la ruta estándar era
PROYECTOS-CLAUDE-IA. Proyectos legacy en esa carpeta siguen siendo
válidos; no migrar masivamente. Solo proyectos nuevos van a PROYECTOS-IA.

En terminal Windows (PowerShell o CMD):
cd $env:USERPROFILE\PROYECTOS-IA
mkdir nombre-del-proyecto
cd nombre-del-proyecto

---

## ORDEN DE TRABAJO EN CADA PROYECTO NUEVO

1. Fase -2 — Higiene de Git: comprobar working tree limpio antes de tocar
   nada (ver MODO DE TRABAJO).
2. Fase -1 — Continuidad: si el proyecto existe, leer las 3 actas más
   recientes y presentar resumen de continuidad al CEO. Si es nuevo,
   pasar directamente a Fase 0.
3. Fase 0 — Preflight: si el alcance está poco claro, lanzar `/office-hours`.
   Después, recopilar todas las credenciales y decisiones en un solo
   mensaje. Esperar OK del CEO.
4. Crear estructura base + Git + GitHub + primer push (vía `/ship` cuando
   ya haya código que validar; manual para el commit inicial vacío).
5. Crear archivos estándar:
   notion-sync.js, bug-registry.json, CHANGELOG.md,
   .env.example, README.md,
   docs/BUGS_INBOX.md (bandeja de entrada vacía),
   docs/MEJORAS-FUTURAS.md (backlog con 4 fases vacías),
   .github/workflows/ci.yml (CI con lint + build + tests),
   carpeta .katonidas/actas/ (con un .gitkeep dentro)
6. Configurar Supabase si el proyecto lo requiere
7. Configurar `/setup-deploy` para habilitar `/land-and-deploy`
8. Para features grandes: lanzar `/autoplan` antes de codificar.
   Para bugs complejos: lanzar `/investigate` antes del fix.
9. Desarrollar funcionalidad en el orden indicado en el prompt
10. Ciclo de testing y autocorrección al terminar cada fase, integrando
    `/review` (código) y `/qa` (browser real). Para temas de seguridad,
    `/cso`.
11. Generar acta de hito al completar cada fase significativa
12. Deploy en Vercel vía `/land-and-deploy` (si configurado) o flujo manual
13. Verificar que notion-sync.js funciona correctamente
14. `/qa` final completo + `/document-release` para actualizar docs
15. Generar acta de hito tipo release + acta de sesión final
16. Notificar al CEO con resumen final
