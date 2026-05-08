# Prompt estándar — Auditoría de coherencia del proyecto

> Pegar este prompt en una sesión NUEVA de Claude Code abierta desde la 
> carpeta del proyecto a auditar. El proyecto debe tener aplicado el 
> estándar Katonidas (si no, ejecutar primero `sync-standards.sh`).

---

## Contexto

Soy el CEO del Holding Katonidas. Esta sesión es una **auditoría 
trimestral de coherencia** del proyecto actual, según el protocolo 
definido en el `CLAUDE.md` del holding (sección "AUDITORÍA PERIÓDICA 
DE COHERENCIA").

Objetivo: detectar **deuda aspiracional** — documentación que afirma X 
cuando el código hace Y. No es sospecha sobre trabajo previo, es 
mantenimiento rutinario.

## Reglas de la sesión

- **Solo diagnóstico en Fase 1**. No tocas código, no arreglas nada, no 
  commiteas. Solo reportas.
- **No inventes hallazgos**. Si algo parece raro pero no puedes 
  verificarlo, regístralo como "posible — necesita verificación manual" 
  en vez de afirmarlo.
- **Cita líneas concretas**. Cada hallazgo debe tener referencia exacta: 
  archivo, número de línea, texto afectado.
- **Checkpoint entre fases**. Al terminar cada fase (Inventario → 
  Clasificación → Reporte), para y espera mi OK antes de continuar.

## Fase 1 — Inventario

Revisa sistemáticamente las 5 áreas definidas en el estándar:

**1. Scripts del proyecto**
- Listar todos los scripts de `package.json` y `scripts/`.
- Por cada uno: ¿hace lo que su nombre/comentarios/doc afirman?
- Flags: hardcoded vs lee archivos, valores fijos vs dinámicos, 
  funciones vacías o stub disfrazadas.

**2. Variables de entorno**
- Extraer todas las `process.env.XXX` del código (todos los lenguajes 
  del proyecto).
- Comparar contra `.env.example`.
- Reportar: variables usadas no listadas, variables listadas no usadas.

**3. Dashboards y sincronizaciones externas**
- Identificar integraciones (Notion, Slack, GitHub Actions, APIs de 
  terceros).
- Por cada una: ¿los datos publicados vienen de archivos del repo o 
  están hardcoded?

**4. Referencias en documentación**
- Scan de `CLAUDE.md`, `README.md`, `docs/ARQUITECTURA.md`, 
  `docs/CREDENCIALES.md`.
- Verificar: comandos citados (¿el archivo existe con ese nombre?), 
  flujos descritos (¿coinciden con el código?), features listadas como 
  implementadas (¿realmente lo están?).

**5. Coherencia con el estándar del holding**
- Comparar estructura actual contra el `CLAUDE.md` del holding.
- Archivos estándar faltantes, archivos con formato obsoleto, 
  divergencias del estándar sin justificación documentada.

Al terminar Fase 1: **informe completo al CEO**. Ejemplo de formato por 
hallazgo:

```
📄 Archivo: scripts/notion_sync.ts (línea 303-365)
   Hallazgo: buildMejorasFuturas() hardcoded, no lee docs/MEJORAS-FUTURAS.md
   Contradice: docs/ARQUITECTURA.md:368 afirma que el script lee del archivo
   Severidad propuesta: 🟡 Relevante (dashboard publica ficción)
```

CHECKPOINT: parar aquí. Esperar OK del CEO para pasar a Fase 2.

## Fase 2 — Clasificación

Con el inventario aprobado, clasificar cada hallazgo en:

- 🔴 **Crítico (INBOX P0)**: seguridad, datos incorrectos publicados, 
  secretos expuestos, rotura en producción.
- 🟡 **Relevante (INBOX P1)**: desalineación que lleva a decisiones 
  erróneas.
- 🟢 **Cosmético (INBOX P2 o MEJORAS-FUTURAS)**: sin impacto inmediato.
- 📋 **Estructural (MEJORAS-FUTURAS, Fase 1)**: refactor mayor, no bug.

Presenta la clasificación al CEO. Él puede reclasificar antes de que 
escribas nada en INBOX/MEJORAS.

CHECKPOINT: esperar OK.

## Fase 3 — Reporte final + Acta

Tras OK del CEO:

1. Añadir al `docs/BUGS_INBOX.md` los hallazgos de INBOX (🔴 🟡 🟢).
2. Añadir al `docs/MEJORAS-FUTURAS.md` los estructurales (📋) en Fase 1.
3. Generar acta de sesión con `tipo: "auditoria_coherencia"`, métricas 
   (archivos revisados, hallazgos por categoría, tiempo empleado), y 
   referencia al trimestre auditado (ej: "Q3 2026").
4. Commit en `develop` con mensaje: 
   `chore(auditoria): auditoría trimestral Q[X] YYYY — [N] hallazgos`.
5. Push.

## Fase 4 — Cierre

Reporte final al CEO con:
- Número de hallazgos por categoría.
- Tiempo total empleado.
- Recomendación sobre próximos pasos (¿resolver INBOX ya? ¿planificar 
  refactors de MEJORAS?).
- Confirmación de que se generó el acta.
