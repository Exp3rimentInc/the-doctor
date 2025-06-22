import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { type CoreMessage, generateText } from 'ai'
import { type Context } from 'hono'
import * as WA from '../wa'
import { tryCatch } from '../util/tryCatch'
import { strDigest } from '../util/string'

export async function onMessage(ctx: Context<AppEnv>) {

  const json = await ctx.req.raw.clone().json<WA.Payloads.Event>()
  const messageList = json.entry[0].changes[0].value.messages
  if (!messageList?.length) {
    return ctx.text('ghosting non-message hooks for now ✌️')
  }

  const waMessage = messageList[0]
  const number = waMessage.from

  const chatId = await strDigest(number, 'SHA-512')

  const waApi = WA.api({
    phoneNumberId: ctx.env.WA_BUSINESS_PHONE_ID,
    accessToken: ctx.env.META_APP_ACCESS_TOKEN,
  })
  const { data: userMsg, error } = await tryCatch(createLLMMessage(waMessage, waApi))
  if (error) {
    return ctx.text('eyah')
  }
  type StoredConversation = {
    context: CoreMessage[]
  }
  const google = createGoogleGenerativeAI({ apiKey: ctx.env.GOOGLE_GENERATIVE_AI_API_KEY })

  const convoKey = `chats.${chatId}.context`
  const conversation = await ctx.env.KV_DOC_CHATS.get<StoredConversation>(
    convoKey, 'json'
  ) ?? { context: [] }

  const messages: CoreMessage[] = []
  messages.push(...conversation.context, userMsg)

  const result = await generateText({
    model: google('gemini-2.0-flash-001'),
    system: `
You are a general purpose AI assistant named "The Doctor" that responds to users on WhatsApp.
Assist the user with whatever they want. Keep your responses helpful but concise.
It's currently ${(new Date()).toString()}.
`,
    messages,
  })

  if (waMessage.type === 'text') {
    conversation.context.push(userMsg)
  }
  conversation.context.push(...result.response.messages)
  ctx.env.KV_DOC_CHATS.put(convoKey, JSON.stringify(conversation))

  await waApi.sendText(number, result.text)

  return ctx.text('ok')
}

async function createLLMMessage(
  msg: WA.Payloads.Message,
  waApi: WA.Api
): Promise<CoreMessage> {
  if (msg.type === 'text') {
    return { role: 'user', content: msg.text.body }
  }

  if (msg.type === 'audio') {
    const supportedMimeTypes = [
      'audio/wav',
      'audio/mp3',
      'audio/aiff',
      'audio/aac',
      'audio/ogg',
      'audio/flac'
    ]
    const validMime = supportedMimeTypes.find(
      type => msg.audio.mime_type.startsWith(type)
    )
    if (!validMime) {
      throw new Error('Unsupported audio type')
    }
    const media = await waApi.getMediaUrl(msg.audio.id)
    if (!media) {
      throw new Error('Audio not found')
    }
    if (Number(media?.file_size) > 750 * 1024) {
      throw new Error('Audio too large')
    }
    const audio = await waApi.downloadMedia(media.url)
    if (!audio.ok) {
      throw new Error('Audio failed to load')
    }

    return {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Here is an audio message',
        },
        {
          type: 'file',
          mimeType: validMime,
          data: Buffer.from(await audio.arrayBuffer()),
        },
      ]
    }
  }

  if (msg.type === 'image' && msg.image.caption) {
    const supportedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
    ]
    const validMime = supportedMimeTypes.find(
      type => msg.image.mime_type.startsWith(type)
    )
    if (!validMime) {
      throw new Error('Unsupported image type')
    }
    const media = await waApi.getMediaUrl(msg.image.id)
    if (!media) {
      throw new Error('Image not found')
    }
    if (Number(media?.file_size) > 750 * 1024) {
      throw new Error('Image too large')
    }
    const audio = await waApi.downloadMedia(media.url)
    if (!audio.ok) {
      throw new Error('Image failed to load')
    }

    return {
      role: 'user',
      content: [
        {
          type: 'text',
          text: msg.image.caption,
        },
        {
          type: 'file',
          mimeType: validMime,
          data: Buffer.from(await audio.arrayBuffer()),
        },
      ]
    }
  }

  throw new Error('Unsupported message type')
}
