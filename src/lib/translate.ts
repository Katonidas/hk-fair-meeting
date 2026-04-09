// API-based translation: detects Spanish and translates to English, corrects grammar
// Uses free Google Translate endpoint (no API key needed)

export async function translateAndCorrect(text: string): Promise<string> {
  if (!text || !text.trim()) return text

  if (!navigator.onLine) {
    throw new Error('NO_CONNECTION')
  }

  // Split into lines, translate each non-empty line individually to preserve formatting
  const lines = text.split('\n')
  const translatedLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    // Keep empty lines and decorative separators as-is
    if (!trimmed || /^[═─────────────────────]+$/.test(trimmed) || /^[—━═]+$/.test(trimmed)) {
      translatedLines.push(line)
      continue
    }

    // Skip lines that are purely structural/template (all caps headers, email structure)
    if (/^(Hello,|Dear .+ team,|Best regards,|PLEASE |Regarding |Please |Contact |IMPORTANT:)/.test(trimmed)) {
      translatedLines.push(line)
      continue
    }

    // Check if line has Spanish content
    if (hasSpanish(trimmed)) {
      try {
        const translated = await googleTranslate(trimmed, 'es', 'en')
        translatedLines.push(line.replace(trimmed, translated))
      } catch {
        // If translation fails for a line, keep original
        translatedLines.push(line)
      }
    } else {
      // For English text, still run through auto-detect to correct grammar
      try {
        const corrected = await googleTranslate(trimmed, 'auto', 'en')
        // Only use corrected version if it's not drastically different (avoid mangling)
        if (corrected && corrected.length > 0 && corrected.length < trimmed.length * 2) {
          translatedLines.push(line.replace(trimmed, corrected))
        } else {
          translatedLines.push(line)
        }
      } catch {
        translatedLines.push(line)
      }
    }
  }

  return translatedLines.join('\n')
}

// Detect if text contains Spanish words
function hasSpanish(text: string): boolean {
  const spanishIndicators = /\b(necesitamos|queremos|podemos|precio|calidad|envío|entrega|muestra|también|además|por favor|buena|mala|pedido|pago|factura|presupuesto|disponible|incluido|garantía|certificado|embalaje|urgente|importante|obligatorio|opcional|descuento|oferta|reclamación|incidencia|comprobar|confirmar|revisar|colores|tamaños|cantidad|barato|caro|nuevo|viejo|grande|pequeño|negro|blanco|rojo|azul|verde|amarillo|enviar|pendiente|mucho|poco|mejor|peor|bueno|malo|sobre|para|pero|porque|aunque|según|desde|hasta|entre|durante|después|antes|ahora|siempre|nunca|aquí|allí|donde|cuando|como|quien|cual|ese|esta|esos|estas|aquel|ellos|nosotros|vosotros|nuestro|suyo|hemos|tenemos|hacemos|podríamos|deberíamos|habría|sería|estaría|están|estamos|somos|fueron|tiene|hace|puede|debe|quiere|sabe|dice|viene|sale|pone|lleva|trae|busca|encuentra|necesita|falta|sobra)\b/i
  return spanishIndicators.test(text)
}

// Free Google Translate endpoint
async function googleTranslate(text: string, sourceLang: string, targetLang: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`

  const response = await fetch(url)
  if (!response.ok) throw new Error('Translation API error')

  const data = await response.json()

  // Response format: [[["translated text","original text",null,null,10]],null,"es"]
  if (!data || !data[0]) throw new Error('Invalid response')

  // Concatenate all translated segments
  const translated = data[0]
    .filter((segment: unknown[]) => segment && segment[0])
    .map((segment: unknown[]) => segment[0])
    .join('')

  return translated
}
