# HK Fair Meeting — APPROX

App web (PWA) para gestionar visitas a stands en la feria HK Sources (11-14 abril 2026). Permite al equipo comercial de APPROX capturar datos de reuniones con fabricantes, registrar productos, y generar emails resumen directamente desde el móvil.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Offline storage:** Dexie.js (IndexedDB)
- **Backend/DB:** Supabase (PostgreSQL) — región Singapore
- **Deploy:** Vercel (auto-deploy en push a main)
- **PWA:** Instalable en móvil con service worker

## Variables de entorno

Ver `.env.example` para la lista completa.

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anon de Supabase |
| `NOTION_TOKEN` | Token de integración Notion |
| `NOTION_PAGE_*` | IDs de páginas Notion para sync |

## Instalación

```bash
npm install
cp .env.example .env
# Rellenar las variables en .env
npm run dev
```

## Comandos

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Preview del build |
| `npm run lint` | Linter |

## Equipo

- Carlos, Jesús, Tote, Jose Luis (comerciales APPROX)

## Producción

- URL: https://hk-fair2026.vercel.app
