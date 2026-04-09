import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Backup window: April 11 15:00 CST → April 17 03:00 CST
// CST = UTC+8, so: April 11 07:00 UTC → April 16 19:00 UTC
const BACKUP_START = new Date('2026-04-11T07:00:00Z')
const BACKUP_END = new Date('2026-04-16T19:00:00Z')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret (Vercel sends this automatically for cron invocations)
  const authHeader = req.headers['authorization']
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Check if we're within the backup window
  const now = new Date()
  if (now < BACKUP_START || now > BACKUP_END) {
    return res.status(200).json({
      message: 'Outside backup window',
      now: now.toISOString(),
      window: { start: BACKUP_START.toISOString(), end: BACKUP_END.toISOString() },
    })
  }

  // Initialize Supabase
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Fetch all tables
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

    // Generate filename with CST timestamp
    const cstDate = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const dateStr = cstDate.toISOString().slice(0, 16).replace('T', '_').replace(':', '-')
    const fileName = `backup-${dateStr}-CST.json`

    // Upload to Supabase Storage (bucket: backups)
    const jsonContent = JSON.stringify(backup, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })

    const { error: uploadError } = await supabase.storage
      .from('backups')
      .upload(fileName, blob, {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadError) {
      // If bucket doesn't exist, try to give useful error
      console.error('Upload error:', uploadError)
      return res.status(500).json({
        error: 'Failed to upload backup',
        detail: uploadError.message,
        hint: 'Make sure a "backups" bucket exists in Supabase Storage',
      })
    }

    return res.status(200).json({
      success: true,
      fileName,
      timestamp_cst: backup.timestamp_cst,
      summary: backup.summary,
    })
  } catch (err) {
    console.error('Backup error:', err)
    return res.status(500).json({
      error: 'Backup failed',
      detail: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
