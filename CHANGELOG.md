# Changelog — HK Fair Meeting

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
