
type MediaUrlResponse = {
  messaging_product: string
  url: string
  mime_type: string
  sha256: string
  file_size: string
  id: string
}

type ApiFnArgs = {
  phoneNumberId: string
  accessToken: string
}
export type Api = ReturnType<typeof api>

export function api({ phoneNumberId, accessToken }: ApiFnArgs) {
  function sendRequest(path: string, init?: RequestInit) {
    const url = path.startsWith('https://')
      ? path
      : path.startsWith('/')
        ? `https://graph.facebook.com/v21.0${path}`
        : `https://graph.facebook.com/v21.0/${phoneNumberId}/${path}`

    const mergedInit: RequestInit = {
      method: 'get',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      ...init,
    }
    return fetch(url, mergedInit)
  }

  function sendText(number: string, text: string) {
    return sendRequest('messages', {
      method: 'post',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: `${number}`,
        type: 'text',
        text: {
          body: text,
        },
      })
    })
  }

  async function getMediaUrl(id: string) {
    const res = await sendRequest(`/${id}`)
    if (!res.ok) {
      return null
    }

    return await res.json<MediaUrlResponse>()
  }

  function downloadMedia(mediaUrl: string) {
    return sendRequest(mediaUrl)
  }

  return {
    downloadMedia,
    getMediaUrl,
    sendText,
  }
}

export namespace Payloads {
  export interface Event {
    object: 'whatsapp_business_account'
    entry: Entry[]
  }

  type Entry = {
    id: string
    changes: Change[]
  }

  type Change = {
    value: Value
    field: string
  }

  type Value = {
    messaging_product: 'whatsapp'
    metadata: Metadata
    contacts: Contact[]
    messages: Message[]
  }

  type Contact = {
    profile: Profile
    wa_id: string
  }

  type Profile = {
    name: string
  }

  export type Message = {
    from: string
    id: string
    timestamp: string
  } & (
    | {
      text: { body: string }
      type: 'text'
    }
    | {
      image: {
        id: string
        caption?: string
        mime_type: string
        sha_256: string
      }
      type: 'image' | 'video'
    }
    | {
      audio: {
        id: string
        mime_type: string
      }
      type: 'audio'
    }
  )

  type Metadata = {
    display_phone_number: string
    phone_number_id: string
  }
}
