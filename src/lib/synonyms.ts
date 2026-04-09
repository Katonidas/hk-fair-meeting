// Product type synonym dictionary for matching suppliers ↔ searched products
// Groups of words that mean the same product category

const SYNONYM_GROUPS: string[][] = [
  // Audio
  ['headset', 'auricular', 'auriculares', 'earbuds', 'earphones', 'headphones', 'cascos', 'audifonos'],
  ['altavoz', 'altavoces', 'speaker', 'speakers', 'parlante', 'parlantes', 'soundbar', 'barra de sonido'],
  ['microfono', 'microfonos', 'microphone', 'mic'],

  // PC cases & components
  ['caja ordenador', 'cajas', 'cajas pc', 'pc case', 'pc cases', 'tower', 'torres', 'torre pc', 'chasis', 'chassis', 'case'],
  ['fuente alimentacion', 'fuente', 'psu', 'power supply', 'fuentes'],
  ['ventilador', 'ventiladores', 'fan', 'fans', 'cooler', 'coolers', 'refrigeracion', 'cooling', 'disipador', 'heatsink'],
  ['placa base', 'motherboard', 'mainboard', 'placa madre'],
  ['tarjeta grafica', 'gpu', 'graphics card', 'vga'],
  ['memoria ram', 'ram', 'memory', 'memoria'],
  ['disco duro', 'hdd', 'hard drive', 'hard disk'],
  ['ssd', 'disco solido', 'solid state', 'nvme', 'm2', 'm.2'],

  // Peripherals - input
  ['teclado', 'teclados', 'keyboard', 'keyboards', 'keycaps'],
  ['raton', 'ratones', 'mouse', 'mice', 'gaming mouse'],
  ['alfombrilla', 'alfombrillas', 'mousepad', 'mouse pad', 'desk pad', 'desk mat'],
  ['mando', 'mandos', 'gamepad', 'controller', 'joystick', 'control', 'controles', 'joypad'],
  ['volante', 'steering wheel', 'racing wheel', 'volantes'],

  // Displays & video
  ['monitor', 'monitores', 'pantalla', 'pantallas', 'display', 'displays', 'screen'],
  ['webcam', 'camara web', 'web camera'],
  ['proyector', 'proyectores', 'projector'],
  ['soporte monitor', 'brazo monitor', 'monitor arm', 'monitor stand', 'monitor mount'],

  // Cables & connectivity
  ['cable', 'cables', 'cable usb', 'cable hdmi', 'cableado', 'wiring'],
  ['hub', 'hubs', 'hub usb', 'usb hub', 'docking', 'docking station', 'dock'],
  ['adaptador', 'adaptadores', 'adapter', 'adapters', 'conversor', 'converter'],
  ['cargador', 'cargadores', 'charger', 'chargers', 'charging'],
  ['powerbank', 'power bank', 'bateria externa', 'bateria portatil', 'portable battery'],

  // Networking
  ['router', 'routers', 'punto acceso', 'access point', 'ap'],
  ['switch', 'switches', 'switch red', 'network switch'],
  ['repetidor', 'extensor', 'range extender', 'wifi extender', 'amplificador wifi'],
  ['antena', 'antenas', 'antenna', 'wifi antenna'],

  // Storage
  ['pendrive', 'usb stick', 'usb drive', 'memoria usb', 'flash drive', 'usb flash'],
  ['tarjeta memoria', 'sd card', 'micro sd', 'memory card', 'tarjeta sd'],
  ['nas', 'network storage', 'almacenamiento red'],

  // Chairs & furniture
  ['silla', 'sillas', 'chair', 'chairs', 'silla gaming', 'gaming chair', 'silla oficina', 'office chair'],
  ['mesa', 'mesas', 'desk', 'desks', 'escritorio', 'mesa gaming', 'gaming desk'],
  ['soporte', 'soportes', 'stand', 'stands', 'bracket', 'mount'],

  // Gaming accessories
  ['auricular gaming', 'gaming headset', 'headset gaming'],
  ['teclado gaming', 'gaming keyboard', 'teclado mecanico', 'mechanical keyboard'],
  ['raton gaming', 'gaming mouse'],
  ['silla gaming', 'gaming chair'],
  ['streaming', 'capturadora', 'capture card', 'stream deck'],

  // Wearables & mobile
  ['smartwatch', 'reloj inteligente', 'smart watch', 'reloj', 'watch'],
  ['pulsera', 'smart band', 'fitness band', 'band', 'fitness tracker'],
  ['funda', 'fundas', 'case movil', 'phone case', 'cover', 'protector'],
  ['tablet', 'tablets', 'tableta'],

  // Printing
  ['impresora', 'impresoras', 'printer', 'printers'],
  ['tinta', 'toner', 'cartucho', 'cartridge', 'ink'],
  ['escaner', 'scanner'],

  // LED & lighting
  ['led', 'leds', 'tira led', 'led strip', 'rgb', 'iluminacion', 'lighting', 'luz', 'luces'],
  ['lampara', 'lamparas', 'lamp', 'desk lamp', 'flexo'],

  // Laptop accessories
  ['cooler portatil', 'coolers portatil', 'laptop cooler', 'base refrigeradora', 'cooling pad', 'notebook cooler'],
  ['mochila', 'mochilas', 'backpack', 'bag', 'bolsa', 'bolsa portatil', 'laptop bag', 'funda portatil', 'laptop sleeve'],

  // Other electronics
  ['calculadora', 'calculator'],
  ['bascula', 'scale', 'peso'],
  ['camara', 'camaras', 'camera', 'action camera', 'camara accion', 'camara deportiva'],
  ['dron', 'drone', 'drones'],
]

// Build lookup: word → group index
const wordToGroup = new Map<string, number>()

function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

SYNONYM_GROUPS.forEach((group, idx) => {
  group.forEach(term => {
    wordToGroup.set(norm(term), idx)
  })
})

/**
 * Check if two product type strings are synonymous.
 * Splits each into words/phrases and checks if any synonym group overlaps.
 */
export function areProductTypesRelated(typeA: string, typeB: string): boolean {
  if (!typeA || !typeB) return false

  const a = norm(typeA)
  const b = norm(typeB)

  // Direct substring match
  if (a.includes(b) || b.includes(a)) return true

  // Check full phrases first
  const groupA = wordToGroup.get(a)
  const groupB = wordToGroup.get(b)
  if (groupA !== undefined && groupA === groupB) return true

  // Split into parts and check each combination
  const partsA = a.split(/[,;/]+/).map(s => s.trim()).filter(Boolean)
  const partsB = b.split(/[,;/]+/).map(s => s.trim()).filter(Boolean)

  for (const pa of partsA) {
    for (const pb of partsB) {
      // Direct match
      if (pa.includes(pb) || pb.includes(pa)) return true

      // Synonym match
      const gA = wordToGroup.get(pa)
      const gB = wordToGroup.get(pb)
      if (gA !== undefined && gA === gB) return true

      // Try individual words within multi-word terms
      const wordsA = pa.split(/\s+/).filter(w => w.length > 2)
      const wordsB = pb.split(/\s+/).filter(w => w.length > 2)

      for (const wa of wordsA) {
        for (const wb of wordsB) {
          if (wa === wb) return true
          const gwA = wordToGroup.get(wa)
          const gwB = wordToGroup.get(wb)
          if (gwA !== undefined && gwA === gwB) return true
        }
      }
    }
  }

  return false
}
