import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow manual trigger (no cron secret needed, but could add app-level auth)
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const now = new Date()

  try {
    const [suppliers, meetings, products, productPhotos, searchedProducts] = await Promise.all([
      supabase.from('suppliers').select('*'),
      supabase.from('meetings').select('*'),
      supabase.from('products').select('*'),
      supabase.from('product_photos').select('*'),
      supabase.from('searched_products').select('*'),
    ])

    const backup = {
      timestamp: now.toISOString(),
      timestamp_cst: new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('Z', ' CST'),
      type: 'manual',
      tables: {
        suppliers: { count: suppliers.data?.length || 0, data: suppliers.data || [] },
        meetings: { count: meetings.data?.length || 0, data: meetings.data || [] },
        products: { count: products.data?.length || 0, data: products.data || [] },
        product_photos: { count: productPhotos.data?.length || 0, data: productPhotos.data || [] },
        searched_products: { count: searchedProducts.data?.length || 0, data: searchedProducts.data || [] },
      },
      summary: {
        total_suppliers: suppliers.data?.length || 0,
        total_meetings: meetings.data?.length || 0,
        total_products: products.data?.length || 0,
        total_photos: productPhotos.data?.length || 0,
        total_searched: searchedProducts.data?.length || 0,
      },
    }

    const cstDate = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const dateStr = cstDate.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const fileName = `backup-manual-${dateStr}-CST.json`

    // Try upload to Supabase Storage
    const jsonContent = JSON.stringify(backup, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })

    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, blob, { contentType: 'application/json', upsert: true })

    if (uploadError) {
      // If storage fails, return the backup as downloadable JSON
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      return res.status(200).send(jsonContent)
    }

    return res.status(200).json({
      success: true,
      fileName,
      timestamp_cst: backup.timestamp_cst,
      summary: backup.summary,
      storage: 'supabase',
    })
  } catch (err) {
    return res.status(500).json({
      error: 'Backup failed',
      detail: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
