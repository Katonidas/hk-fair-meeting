# Cómo retomar la conversación — HK Fair Meeting

> Este documento contiene **todo** lo que cualquier futura sesión necesita
> saber para no repetir errores y poder continuar el trabajo donde lo
> dejamos. Léelo enteramente antes de tocar nada del repo.

---

## ⚠️ Lo más importante (no perderse esto)

### 1. Hay 2 ramas: trabaja SIEMPRE en `main`

```
main    ← rama de trabajo real (80+ commits, todo el código de producción)
master  ← rama vieja con un commit huérfano de un experimento. NO USAR.
```

`origin/HEAD` apuntaba mal a `master` y eso causó un desastre el
2026-04-12 cuando inicié trabajando en master sin verlo. Si en algún
momento futuro `git status` te dice que estás en `master`, hay que
hacer `git checkout main` inmediatamente.

Comprobación rápida al empezar cualquier sesión:
```bash
git branch --show-current   # debe imprimir: main
git remote show origin | grep HEAD  # debe decir: HEAD branch: main
```

Si origin/HEAD vuelve a apuntar a master:
```bash
git remote set-head origin main
```

### 2. Deploy a producción NO es automático en push

GitHub está conectado al repo pero **el deploy se hace manualmente** desde
la CLI de Vercel porque el GitHub auto-deploy no está activado en este
proyecto. Cada push a `main` requiere después:

```bash
npx vercel --prod
```

Y **MUY IMPORTANTE**: el dominio limpio `hk-fair2026.vercel.app` NO se
actualiza automáticamente al hacer `--prod`. Hay que hacer alias manual
después de cada deploy:

```bash
# Mira la URL del último deploy con:
npx vercel ls hk-fair-meeting

# Y copia la primera URL listada (la "55s" arriba). Después:
npx vercel alias set hk-fair-meeting-XXXXXXXX-katonidas-projects.vercel.app hk-fair2026.vercel.app
```

Para verificar que el deploy está sirviendo lo correcto:
```bash
curl -sL https://hk-fair2026.vercel.app/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
# Compara el hash con el del último build local en dist/assets/
```

### 3. Service worker en el móvil

A partir del deploy del 2026-04-12, `vite.config.ts` tiene:
- `skipWaiting: true`
- `clientsClaim: true`
- `cleanupOutdatedCaches: true`

Esto significa que **los próximos deploys** sí actualizan automáticamente
el móvil al cerrar/abrir la PWA. Si el usuario reporta que sigue viendo
versión vieja:
1. Cerrar PWA completamente (no minimizar)
2. Abrirla otra vez
3. Si sigue mal: abrir `https://hk-fair2026.vercel.app/?nocache=1` en el
   navegador normal del móvil, comprobar que ahí sí ven los cambios,
   volver a la PWA
4. Último recurso: desinstalar la PWA y reinstalarla

---

## Estado actual al cierre de la conversación 2026-04-12

### Commits añadidos en esta sesión (en `main`)

```
503fb98  SearchedProducts: multi-word search + sortable columns
2690589  Sync searched_products + import fixes + potential products table
```

Ambos pusheados a `origin/main` y desplegados a producción.

### Bundle desplegado actualmente
```
URL:    https://hk-fair2026.vercel.app
Bundle: index-BW8HxrgP.js (al cierre del 2026-04-12)
```

### Verificado por el usuario que funciona
- ✅ Productos deseados sincronizan entre desktop ↔ móvil
- ✅ Buscador multi-palabra y orden por columnas en SearchedProducts

### Pendiente del usuario
Nada bloqueante. El SQL de Supabase ya fue ejecutado.

---

## Infraestructura

### Repo
- **GitHub**: https://github.com/Katonidas/hk-fair-meeting
- **Rama de trabajo**: `main`
- **Rama muerta a ignorar**: `master`
- **Identidad git en este repo** (configurada local, no global):
  - `user.name = Jesus Adan`
  - `user.email = admin@katonidas.com`

### Vercel
- **Proyecto**: `katonidas-projects/hk-fair-meeting`
- **CLI**: ya logado en local, comandos `npx vercel ...` funcionan
- **Producción (alias limpio)**: https://hk-fair2026.vercel.app
- **Alias automático**: https://hk-fair-meeting-katonidas-projects.vercel.app
  (cambia con cada deploy, NO usar para nada)
- **Deployment Protection**: DESACTIVADA (si vuelve a aparecer un 401,
  ir a Settings → Deployment Protection → Disabled)
- **Env vars en Vercel**: ya configuradas (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`)
- **`.env` local**: existe en raíz, está en `.gitignore`. NO commitear.
- **`.env.txt`**: existe en raíz, también en `.gitignore` (lo añadí
  porque contenía credenciales sin querer)

### Supabase
- **Proyecto URL**: https://glutewwayemuftmjvbcs.supabase.co
- **SQL Editor**: https://supabase.com/dashboard/project/glutewwayemuftmjvbcs/sql
- **Schema completo**: `supabase/migration.sql` (idempotente — se puede
  re-ejecutar sin romper nada)
- **Tablas existentes**: `suppliers`, `meetings`, `products`,
  `product_photos`, `searched_products` (todas con RLS permisivo)
- **Storage bucket**: `photos` (público)
- **Sync engine**: `src/lib/sync.ts` — push-then-pull cada 30s,
  last-write-wins por `updated_at`, tombstones para deletes

---

## Arquitectura y archivos clave

### Stack
React 19 + Vite 8 + TypeScript 6 + Tailwind 4 + Dexie 4 (IndexedDB) +
Supabase + vite-plugin-pwa. React Router 7. xlsx (SheetJS) para
import/export Excel.

### Páginas (`src/pages/`)
- `UserSelect.tsx` — pantalla inicial de selección de usuario
- `Home.tsx` — listado de reuniones del día + listado de proveedores
- `NewMeeting.tsx` — crear reunión nueva (seleccionar proveedor o crear
  uno nuevo). Tras seleccionar muestra el listado de **productos
  potenciales** (componente compartido con SupplierDetail).
- `MeetingCapture.tsx` — captura de reunión: notas urgentes, productos
- `MeetingEmail.tsx` — preview del email resumen + botones HTML/texto
- `SupplierDetail.tsx` — detalle de proveedor con reuniones asociadas,
  productos capturados y tabla de Productos Potenciales.
- `Settings.tsx` — import/export Excel, sync, danger zone
- `SearchedProducts.tsx` — productos deseados (importar Excel,
  buscador multi-palabra, tabla ordenable)
- `CapturedProducts.tsx` — vista global de productos capturados en
  reuniones
- `RoutePlanner.tsx` — planificador de ruta de visitas a proveedores

### Lib (`src/lib/`)
- `db.ts` — Dexie schema, migraciones v1..v11
- `sync.ts` — sync engine completo (push/pull/tombstones) para
  suppliers, meetings, products, product_photos y searched_products
- `supabase.ts` — cliente Supabase
- `matching.ts` — `getMatchingSearchedProducts(supplierId)`,
  `getMatchingSuppliers(searchedProduct)`, `countPotentialProducts`
- `synonyms.ts` — `areProductTypesRelated` (matching fuzzy de tipos)
- `emailGenerator.ts` — texto plano del email resumen
- `htmlEmail.ts` — versión HTML del email para Outlook (vía clipboard)
- `format.ts`, `normalize.ts`, `price.ts` — helpers
- `settings.ts` — settings persistidos en localStorage (terms, QOS,
  fórmulas, CC emails)
- `storage.ts` — Supabase Storage helpers para fotos
- `translate.ts` — traducción ES↔EN vía API
- `constants.ts` — `USERS`, `CC_EMAILS`, `getCCEmails`

### Tipos (`src/types/`)
- `index.ts` — `Supplier`, `Meeting`, `Product`, `ProductPhoto`,
  `Relevance`, `UserName`, `SampleStatus`, `MeetingLocation`,
  `MeetingStatus`, `ProductStatus`
- `searchedProduct.ts` — `SearchedProduct`

---

## Comandos rápidos para retomar

```bash
cd /c/Users/jesus/PROYECTOS-IA-CLAUDE/HK-FAIR-MEETING

# 1. Verificar estado
git branch --show-current        # debe ser: main
git status --short               # debe estar limpio
git log --oneline -3             # ver últimos commits

# 2. Tras hacer cambios y commit:
git push origin main
npm run build                    # validar antes del deploy
npx vercel --prod                # deploy

# 3. Aliasear el dominio limpio (CRÍTICO):
npx vercel ls hk-fair-meeting    # copia la primera URL listada
npx vercel alias set <esa-url> hk-fair2026.vercel.app

# 4. Verificar que el deploy está sirviendo el bundle correcto:
curl -sL https://hk-fair2026.vercel.app/ | grep -oE 'index-[A-Za-z0-9_-]+\.js'
# Comparar con dist/assets/index-XXX.js del último build local
```

---

## Errores conocidos / advertencias

1. **`xlsx` (SheetJS) tiene CVEs high sin fix en npm registry**. SheetJS
   dejó de publicar en npm hace años. Vector de ataque bajo (solo se
   importan archivos del propio equipo). Documentado en `bug-registry.json`.

2. **El bundle principal pesa ~1.2 MB** (375 KB gzip). Hay un warning de
   Vite porque pasa de 500 KB. Mejorable con code-splitting de xlsx,
   pero no es bloqueante. Solo afecta primera carga.

3. **Lint NO está corriendo automáticamente**. `npm run lint` existe pero
   no hay pre-commit hook. En la rama main no hay errores de lint
   actualmente.

4. **El SQL `docs/supabase-schema.sql`** es de la rama vieja `master`,
   tiene columnas (`email_to_draft`, `email_subject_draft`, etc) que
   `main` no usa. **Ignorarlo**. El schema bueno es
   `supabase/migration.sql`.

---

## Si retomas la conversación, empieza así

1. Lee este documento entero
2. Ejecuta los 2 comandos de verificación (branch + status)
3. Pregunta al usuario por:
   - Qué quiere hacer
   - Si hay algún bug nuevo que reportar
   - Si han visto problemas con el sync entre dispositivos
4. **NO** hagas `git checkout master` por accidente
5. **NO** confíes en que el deploy es automático — haz `vercel --prod`
   manualmente y aliasea
