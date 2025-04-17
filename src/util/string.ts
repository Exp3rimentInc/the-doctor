
export function randomString(len = 16) {
  const source = strShuffle('0123456789ABCDEFGHJKLMNPQRSTVWXYZabcdefghjklmnpqrstvwxyz')

  len = Math.min(len, source.length)

  const [min, max] = [0, source.length - 1 - len]
  const start = Math.floor(Math.random() * (max - min + 1)) + min

  return source.substring(start, start + len)
}

export function strShuffle(str: string) {
  let newStr = ''
  let rand
  let i = str.length

  while (i) {
    rand = Math.floor(Math.random() * i)
    newStr += str.charAt(rand)
    str = str.substring(0, rand) + str.substr(rand + 1)
    i--
  }

  return newStr
}

export async function strDigest(number: string, algo: 'SHA-256' | 'SHA-512' = 'SHA-256') {
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    (new TextEncoder()).encode(number)
  )
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return hashHex
}
