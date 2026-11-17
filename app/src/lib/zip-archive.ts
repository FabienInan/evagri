/**
 * Lecture et écriture d'archives ZIP (format de base du .xlsx), sans dépendance : la compression passe par les flux
 * natifs du navigateur (deflate-raw). Les noms de fichiers sont en UTF-8.
 */

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

const decoder = new TextDecoder("utf-8")
const encoder = new TextEncoder()

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter()
  // Copie dans un tampon non partagé : exigé par les flux du navigateur.
  writer.write(new Uint8Array(bytes))
  writer.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}

export type ZipEntries = Map<string, Uint8Array>

/** Lit toutes les entrées d'une archive ZIP (méthodes stockée et deflate). */
export async function readZip(bytes: Uint8Array): Promise<ZipEntries> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("Archive ZIP invalide : fin de répertoire introuvable.")

  const count = view.getUint16(eocd + 10, true)
  let offset = view.getUint32(eocd + 16, true)
  const entries: ZipEntries = new Map()

  for (let n = 0; n < count; n++) {
    if (view.getUint32(offset, true) !== SIG_CENTRAL) throw new Error("Archive ZIP invalide : répertoire corrompu.")
    const method = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localOffset = view.getUint32(offset + 42, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))

    const localNameLength = view.getUint16(localOffset + 26, true)
    const localExtraLength = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const data = bytes.subarray(dataStart, dataStart + compressedSize)

    if (method === 0) entries.set(name, new Uint8Array(data))
    else if (method === 8) entries.set(name, await transform(data, new DecompressionStream("deflate-raw")))
    else throw new Error(`Méthode de compression ZIP non prise en charge : ${method}.`)

    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** Écrit une archive ZIP (entrées compressées en deflate). */
export async function writeZip(entries: ZipEntries): Promise<Uint8Array> {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const [name, data] of entries) {
    const nameBytes = encoder.encode(name)
    const compressed = await transform(data, new CompressionStream("deflate-raw"))
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, SIG_LOCAL, true)
    local.setUint16(4, 20, true) // version requise
    local.setUint16(6, 0x0800, true) // noms UTF-8
    local.setUint16(8, 8, true) // deflate
    local.setUint32(14, crc, true)
    local.setUint32(18, compressed.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(new Uint8Array(local.buffer), nameBytes, compressed)

    const dir = new DataView(new ArrayBuffer(46))
    dir.setUint32(0, SIG_CENTRAL, true)
    dir.setUint16(4, 20, true)
    dir.setUint16(6, 20, true)
    dir.setUint16(8, 0x0800, true)
    dir.setUint16(10, 8, true)
    dir.setUint32(16, crc, true)
    dir.setUint32(20, compressed.length, true)
    dir.setUint32(24, data.length, true)
    dir.setUint16(28, nameBytes.length, true)
    dir.setUint32(42, offset, true)
    central.push(new Uint8Array(dir.buffer), nameBytes)

    offset += 30 + nameBytes.length + compressed.length
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, SIG_EOCD, true)
  end.setUint16(8, entries.size, true)
  end.setUint16(10, entries.size, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const total = all.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const part of all) {
    out.set(part, pos)
    pos += part.length
  }
  return out
}
