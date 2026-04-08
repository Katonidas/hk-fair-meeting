// notion-sync.js — HK Fair Meeting
// Sincroniza estado del proyecto con Notion
// Ejecutar: node notion-sync.js

import { Client } from '@notionhq/client'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const notion = new Client({ auth: process.env.NOTION_TOKEN })

const PAGES = {
  estado: process.env.NOTION_PAGE_ESTADO,
  errores: process.env.NOTION_PAGE_ERRORES,
  mejoras: process.env.NOTION_PAGE_MEJORAS,
  arquitectura: process.env.NOTION_PAGE_ARQUITECTURA,
  changelog: process.env.NOTION_PAGE_CHANGELOG,
}

// ── Helpers ──

async function clearPageContent(pageId) {
  const { results } = await notion.blocks.children.list({ block_id: pageId, page_size: 100 })
  for (const block of results) {
    await notion.blocks.delete({ block_id: block.id })
  }
}

function heading2(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ type: 'text', text: { content: text } }] },
  }
}

function paragraph(text) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
  }
}

function bulletItem(text) {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: [{ type: 'text', text: { content: text } }] },
  }
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} }
}

// ── Sync: Estado del Proyecto ──

async function syncEstado() {
  if (!PAGES.estado) return console.log('⏭ NOTION_PAGE_ESTADO no configurado')
  console.log('📊 Sincronizando Estado del Proyecto...')
  await clearPageContent(PAGES.estado)

  const blocks = [
    heading2('Stack Tecnológico'),
    bulletItem('Frontend: React + Vite + TypeScript + Tailwind CSS'),
    bulletItem('Offline: Dexie.js (IndexedDB)'),
    bulletItem('Backend: Supabase (PostgreSQL) — Singapore'),
    bulletItem('Deploy: Vercel — https://hk-fair2026.vercel.app'),
    bulletItem('PWA con Service Worker'),
    divider(),
    heading2('Servicios Activos'),
    bulletItem('Supabase: https://glutewwayemuftmjvbcs.supabase.co'),
    bulletItem('Vercel: hk-fair-meeting (katonidas-projects)'),
    bulletItem('GitHub: Katonidas/hk-fair-meeting'),
    divider(),
    heading2('Variables de Entorno'),
    bulletItem('VITE_SUPABASE_URL — URL del proyecto Supabase'),
    bulletItem('VITE_SUPABASE_ANON_KEY — Clave pública anon'),
    bulletItem('NOTION_TOKEN — Token integración Notion'),
    bulletItem('NOTION_PAGE_* — IDs de páginas Notion (5)'),
    divider(),
    heading2('URLs'),
    bulletItem('Producción: https://hk-fair2026.vercel.app'),
    bulletItem('Repo: https://github.com/Katonidas/hk-fair-meeting'),
    divider(),
    heading2('Equipo'),
    bulletItem('Carlos, Jesús, Tote, Jose Luis (comerciales APPROX)'),
    paragraph(`Última sincronización: ${new Date().toISOString()}`),
  ]

  await notion.blocks.children.append({ block_id: PAGES.estado, children: blocks })
  console.log('✅ Estado sincronizado')
}

// ── Sync: Log de Errores ──

async function syncErrores() {
  if (!PAGES.errores) return console.log('⏭ NOTION_PAGE_ERRORES no configurado')
  console.log('🐛 Sincronizando Log de Errores...')
  await clearPageContent(PAGES.errores)

  let bugs = { bugs: [] }
  try {
    const raw = readFileSync(resolve(__dirname, 'bug-registry.json'), 'utf-8')
    bugs = JSON.parse(raw)
  } catch {
    // empty
  }

  const blocks = []
  if (bugs.bugs.length === 0) {
    blocks.push(paragraph('✅ No hay errores registrados.'))
  } else {
    for (const bug of bugs.bugs) {
      blocks.push(heading2(`${bug.id} — ${bug.title}`))
      blocks.push(bulletItem(`Severidad: ${bug.severity}`))
      blocks.push(bulletItem(`Estado: ${bug.status}`))
      blocks.push(bulletItem(`Detectado: ${bug.detected_at}`))
      blocks.push(bulletItem(`QA Round: ${bug.qa_round}`))
      if (bug.description) blocks.push(paragraph(bug.description))
      if (bug.fix) blocks.push(paragraph(`Fix: ${bug.fix}`))
      blocks.push(divider())
    }
  }

  blocks.push(paragraph(`Última sincronización: ${new Date().toISOString()}`))
  await notion.blocks.children.append({ block_id: PAGES.errores, children: blocks })
  console.log('✅ Errores sincronizados')
}

// ── Sync: Mejoras Futuras ──

async function syncMejoras() {
  if (!PAGES.mejoras) return console.log('⏭ NOTION_PAGE_MEJORAS no configurado')
  console.log('🚀 Sincronizando Mejoras Futuras...')
  await clearPageContent(PAGES.mejoras)

  let content = ''
  try {
    content = readFileSync(resolve(__dirname, 'MEJORAS-FUTURAS.md'), 'utf-8')
  } catch {
    content = 'No se encontró MEJORAS-FUTURAS.md'
  }

  const blocks = content.split('\n').filter(Boolean).map(line => {
    if (line.startsWith('# ')) return heading2(line.replace('# ', ''))
    if (line.startsWith('## ')) return heading2(line.replace('## ', ''))
    if (line.startsWith('- ')) return bulletItem(line.replace('- ', ''))
    return paragraph(line)
  })

  blocks.push(paragraph(`Última sincronización: ${new Date().toISOString()}`))
  await notion.blocks.children.append({ block_id: PAGES.mejoras, children: blocks })
  console.log('✅ Mejoras sincronizadas')
}

// ── Sync: Arquitectura ──

async function syncArquitectura() {
  if (!PAGES.arquitectura) return console.log('⏭ NOTION_PAGE_ARQUITECTURA no configurado')
  console.log('🏗️ Sincronizando Arquitectura...')
  await clearPageContent(PAGES.arquitectura)

  const blocks = [
    heading2('Estructura del Proyecto'),
    paragraph('hk-fair-meeting/'),
    bulletItem('src/pages/ — Pantallas de la app (Home, NewMeeting, MeetingCapture, MeetingEmail, SupplierDetail, Settings)'),
    bulletItem('src/lib/ — Lógica: db.ts (Dexie), supabase.ts, sync.ts, emailGenerator.ts, constants.ts'),
    bulletItem('src/hooks/ — useCurrentUser.ts, useSync.ts'),
    bulletItem('src/types/ — Tipos TypeScript'),
    bulletItem('public/ — Assets estáticos, PWA manifest'),
    divider(),
    heading2('Base de Datos (Supabase)'),
    bulletItem('suppliers — Ficha viva del proveedor (editable por cualquiera)'),
    bulletItem('meetings — Una por visita, FK a suppliers'),
    bulletItem('products — N por reunión, FK a meetings'),
    bulletItem('product_photos — Fotos de productos, FK a products'),
    bulletItem('Storage bucket: photos (público)'),
    divider(),
    heading2('Flujo Principal'),
    paragraph('1. Usuario selecciona "¿Quién eres?" al abrir la app'),
    paragraph('2. Home: ver reuniones de hoy o lista de proveedores'),
    paragraph('3. Nueva reunión → seleccionar/crear proveedor → captura datos'),
    paragraph('4. Registrar productos con precios, MOQ, samples, fotos'),
    paragraph('5. Generar email resumen con plantilla APPROX → mailto:'),
    paragraph('6. Datos sincronizados automáticamente a Supabase'),
    divider(),
    heading2('Sincronización'),
    paragraph('Offline-first: IndexedDB (Dexie.js) → auto-sync cada 30s a Supabase'),
    paragraph('Conflictos: last-write-wins por timestamp (updated_at)'),
    paragraph('Pull: trae cambios remotos más nuevos que locales'),
    paragraph('Push: envía registros sin synced_at o con updated_at > synced_at'),
    divider(),
    heading2('Integraciones'),
    bulletItem('Supabase PostgreSQL — datos centralizados'),
    bulletItem('Supabase Storage — fotos de productos y tarjetas'),
    bulletItem('Vercel — deploy automático en push a main'),
    bulletItem('PWA — instalable en móvil, funciona offline'),
    bulletItem('xlsx — import/export Excel de proveedores y datos'),
    paragraph(`Última sincronización: ${new Date().toISOString()}`),
  ]

  await notion.blocks.children.append({ block_id: PAGES.arquitectura, children: blocks })
  console.log('✅ Arquitectura sincronizada')
}

// ── Sync: Changelog (aditivo) ──

async function syncChangelog() {
  if (!PAGES.changelog) return console.log('⏭ NOTION_PAGE_CHANGELOG no configurado')
  console.log('📝 Sincronizando Changelog...')

  let content = ''
  try {
    content = readFileSync(resolve(__dirname, 'CHANGELOG.md'), 'utf-8')
  } catch {
    content = 'No se encontró CHANGELOG.md'
  }

  // Clear and rewrite (for initial sync; future: prepend only)
  await clearPageContent(PAGES.changelog)

  const blocks = content.split('\n').filter(Boolean).map(line => {
    if (line.startsWith('# ')) return heading2(line.replace('# ', ''))
    if (line.startsWith('## ')) return heading2(line.replace('## ', ''))
    if (line.startsWith('- ')) return bulletItem(line.replace('- ', ''))
    return paragraph(line)
  })

  blocks.push(paragraph(`Última sincronización: ${new Date().toISOString()}`))
  await notion.blocks.children.append({ block_id: PAGES.changelog, children: blocks })
  console.log('✅ Changelog sincronizado')
}

// ── Main ──

async function main() {
  console.log('🔄 Iniciando sincronización con Notion...')
  console.log(`   Proyecto: HK Fair Meeting`)
  console.log(`   Fecha: ${new Date().toISOString()}\n`)

  try {
    await syncEstado()
    await syncErrores()
    await syncMejoras()
    await syncArquitectura()
    await syncChangelog()
    console.log('\n✅ Sincronización completa')
  } catch (err) {
    console.error('\n❌ Error en sincronización:', err.message)
    process.exit(1)
  }
}

main()
