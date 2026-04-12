# Changelog — HK Fair Meeting

## 2026-04-13 — Protección anti-pérdida de datos + QA completo (4 agentes)

### Causa raíz de la pérdida de productos (ARREGLADO)
- `pullProducts`, `pullMeetings`, `pullSuppliers` y `pullSearchedProducts`
  tenían lógica de auto-eliminación: si un registro existía local pero no en
  Supabase, lo borraban asumiendo "borrado en otro dispositivo". Pero si el
  push fallaba por red inestable, el producto nunca llegaba a Supabase y 30s
  después el pull lo eliminaba localmente. **Eliminada toda auto-eliminación.**
- Los borrados en páginas (`MeetingCapture`, `CapturedProducts`,
  `SearchedProducts`, `SupplierDetail`) llamaban a `db.xxx.delete()`
  directamente sin tombstones — los registros reaparecían en el siguiente
  sync. **Centralizado todo en funciones de `sync.ts`** (`deleteProduct`,
  `deleteMeeting`, `deleteSearchedProduct`, etc.) que hacen backup +
  tombstone + delete remoto.
- Tabla `backups` (Dexie v12) guarda copia de todo registro antes de borrarse.

### Version gate automático
- Timestamp de build inyectado por Vite en cada deploy.
- Primer dispositivo que carga la nueva versión actualiza Supabase; los demás
  quedan bloqueados con pantalla "ACTUALIZAR AHORA" que limpia SW + cachés.
- Cache de `min_app_version` en localStorage para bloquear offline.
- `app_config` excluida del cache del service worker (`NetworkOnly`).
- `Cache-Control: no-store` en `index.html` y `registerSW.js` (vercel.json).

### Email backup en Supabase Storage
- Cada previsualización y envío guarda un `.txt` en Supabase Storage
  (`email-backups/fecha_hora_proveedor_tipo.txt`).

### Bugs arreglados por QA (4 agentes en paralelo)
- `handleOpenEmail` / `handlePrepareEmail`: ahora hacen `await` de la
  persistencia ANTES de `window.open`.
- `handleTranslate`: traducción atómica con `Promise.all` y rollback si falla.
- `MeetingCapture` notes `useEffect`: guard `notesInitialized` para que Dexie
  re-emissions no machaquen lo que el usuario está tecleando.
- Botón "Volver" en MeetingCapture: ahora hace `autoSave()` antes de navegar.
- `fromSupabaseSearchedProduct` relevance: `Number()` + `includes()` en vez de
  `===` estricto (soporta strings de Supabase).
- NewMeeting "INICIAR REUNION": guard `creatingMeeting` contra doble-click.

## 2026-04-12 — Sync productos deseados + buscador multi-palabra + tabla potenciales rediseñada

### Bug crítico arreglado: sync de `searched_products`
- `src/lib/sync.ts` ahora **sincroniza la tabla `searched_products`** entre
  Dexie y Supabase. Antes de este fix, los productos deseados importados
  en el desktop **nunca llegaban al móvil** porque `pushSearchedProducts`
  y `pullSearchedProducts` no existían. Era literalmente imposible que
  el móvil viera lo importado en otro dispositivo.
- Añadido push, pull, mappers (`toSupabaseSearchedProduct` /
  `fromSupabaseSearchedProduct`), tombstones (`deletedSearchedProductIds`),
  `deleteSearchedProduct` y `deleteAllSearchedProducts`.
- `supabase/migration.sql`: añadida tabla `searched_products` con todas
  las columnas, RLS permisivo y `ALTER TABLE ADD COLUMN IF NOT EXISTS`
  para instalaciones que ya tenían una versión antigua.

### Bugs y mejoras del importador (SearchedProducts.tsx)
- **Bug porcentaje** arreglado: el Excel guarda celdas con formato
  porcentaje como decimal (60% → 0.6) y el importador las dejaba como
  string "0.6". Nuevo helper `normalizeMarginToWholePercent` que
  multiplica por 100 cuando el valor es decimal. La migración Dexie v11
  también arregla los registros viejos del IndexedDB local.
- **Columna prioridad** añadida: la última columna del Excel se lee como
  prioridad (1=imprescindible, 2=importante, 3=opcional). Acepta también
  nombres `prioridad`/`priority`/`relevance`/`relevancia`.
- Nuevo campo `relevance: 1|2|3` en `SearchedProduct`.
- **Buscador multi-palabra**: el filtro acepta varias palabras separadas
  por espacios y exige que TODAS aparezcan (substring) en el haystack
  concatenado de marca + tipo + ref + modelo + specs. Ej: "approx audio"
  filtra productos con ambas palabras en cualquier campo.
- **Tabla ordenable**: las cabeceras (Marca / Tipo / Ref / Specs / Target /
  Margen / PVPR / Modelo) son clicables y alternan A↔Z o menor↔mayor.

### Productos Potenciales — tabla rediseñada (SupplierDetail + NewMeeting)
- `PotentialProductsSection` reescrito como tabla ordenable:
  Marca / Tipo / Referencia / Specs / PVPR € / Target $ + acciones.
- Cabeceras clickables para ordenar.
- **Menú ⋮ por fila**: Ver detalle / Eliminar de la lista.
  - Eliminar funciona para links manuales (`candidate_supplier_ids`).
  - Para matches automáticos por tipo se explica al usuario que no se
    puede excluir sin editar el tipo de producto.
- Botón **"+ Añadir manual"** que abre un picker con todos los searched
  products no enlazados, click → vincula al supplier.
- La sección **siempre se muestra** (incluso con 0 matches) para que el
  usuario pueda añadir manualmente.
- Componente exportado y reutilizado en `NewMeeting` tras seleccionar
  proveedor — misma UX en ambos flujos.

### Service Worker más agresivo
- `vite.config.ts` workbox: `skipWaiting: true`, `clientsClaim: true`,
  `cleanupOutdatedCaches: true`. El SW nuevo toma control inmediato sin
  esperar a cerrar pestañas. Imprescindible para que las actualizaciones
  lleguen a la PWA instalada en el móvil sin tener que desinstalar.

### Migraciones Dexie nuevas
- v11: añade `relevance` a `searched_products` (default 2) y normaliza
  `margin_target` decimal a entero en registros existentes.

### Notas operativas (deploy)
- El proyecto tiene **2 ramas** en GitHub: `main` (trabajo real) y
  `master` (tiene un commit huérfano de un experimento que no debe usarse).
  TRABAJAR SIEMPRE en `main`.
- Vercel está vinculado al directorio. `npx vercel --prod` desde la raíz
  despliega.
- **IMPORTANTE**: el alias `hk-fair2026.vercel.app` NO se actualiza
  automáticamente al hacer deploy. Tras cada `vercel --prod` hay que
  ejecutar manualmente:
  `npx vercel alias set <new-deployment-url> hk-fair2026.vercel.app`

## 2026-04-08 — Funcionalidad completa
- Todas las pantallas implementadas y funcionales
- Sync engine Dexie.js → Supabase (auto-sync cada 30s, push/pull)
- Indicador de estado de sincronización en Home
- Subida de fotos a Supabase Storage (tarjetas de visita + productos)
- Compresión de imágenes antes de subir (max 1200px, JPEG 80%)
- Notion sync configurado y funcional (5 páginas)
- Tablas creadas en Supabase con RLS + políticas permisivas
- Bucket "photos" público creado en Supabase Storage

## 2026-04-08 — Inicio del proyecto
- Proyecto creado bajo Holding Katonidas
- Stack: React + Vite + TypeScript + Tailwind CSS + Dexie.js + Supabase
- PWA configurada para instalación en móvil
- Deploy en Vercel configurado
