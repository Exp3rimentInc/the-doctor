import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { type CoreMessage, generateText } from 'ai'
import type { Context } from 'hono'
import { timingSafeEqual } from 'node:crypto'

export async function verifyWebhookToken(c: Context<AppEnv>, next: () => Promise<void>) {
  const secretToken = String(c.req.header('x-telegram-bot-api-secret-token'))
  try {
    if (
      !timingSafeEqual(
        Buffer.from(secretToken),
        Buffer.from(c.env.TELEGRAM_BOT_API_SECRET_TOKEN)
      )
    ) {
      return c.text('nope', 403)
    }
  }
  catch {
    return c.text('sorry', 403)
  }
  await next()
}

export async function handleIncomingWebhook(c: Context<AppEnv>) {
  const json = await c.req.raw.clone().json<TelegramWebhookPayload>()
  if (!json.message?.text) {
    return c.text('ghosting non-text messages for now ✌️')
  }

  const chatId = String(json.message.chat.id)
  type StoredConversation = {
    context: CoreMessage[]
  }
  const google = createGoogleGenerativeAI({ apiKey: c.env.GOOGLE_GENERATIVE_AI_API_KEY })

  const convoKey = `chats.telegram.${chatId}.context`
  const conversation = await c.env.KV_DOC_CHATS.get<StoredConversation>(
    convoKey, 'json'
  ) ?? { context: [] }

  const userMsg: CoreMessage = { role: 'user', content: json.message.text }
  const messages: CoreMessage[] = []
  messages.push(...conversation.context, userMsg)

  const result = await generateText({
    model: google('gemini-2.0-flash-001'),
    system: `
You are a helpful AI assistant named "The Doctor" that responds to users on Telegram.
You are friendly, concise, and professional.
In responding to users, you can provide accurate medical information or terminology where relevant but you are not a substitute for professional medical advice, diagnosis, or treatment.
Hence in addition to whatever answers you provide to medical questions, you should always encourage users to seek the advice of their physician or other qualified health provider.
Users can upload images, and you can respond to them with text.
It's currently ${(new Date()).toString()}.
`,
    messages,
  })

  conversation.context.push(userMsg)
  conversation.context.push(...result.response.messages)
  c.env.KV_DOC_CHATS.put(convoKey, JSON.stringify(conversation))

  const telegramApi = `https://api.telegram.org/bot${c.env.TELEGRAM_BOT_AUTH_TOKEN}/sendMessage`
  const response = await fetch(telegramApi, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: result.text,
      parse_mode: 'Markdown',
    }),
  })

  return c.text('ok')
}


type TelegramWebhookPayload = {
  update_id: number
  message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
    }
    chat: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      type: 'private' | 'group' | 'supergroup' | 'channel'
    }
    date: number
    text?: string
    entities?: Array<{
      offset: number
      length: number
      type: 'mention' | 'hashtag' | 'bot_command' | 'url' | 'email' | 'phone_number' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'pre' | 'text_link' | 'custom_emoji'
    }>
    reply_markup?: {
      inline_keyboard?: Array<Array<{
        text: string
        url?: string
        callback_data?: string
        switch_inline_query?: string
        switch_inline_query_current_chat?: string
        pay?: boolean
      }>>
      remove_keyboard?: boolean
      force_reply?: boolean
      selective?: boolean
    }
    audio?: {
      file_id: string
      duration: number
      performer?: string
      title?: string
      mime_type?: string
      file_size?: number
    }
    document?: {
      file_id: string
      thumb?: {
        file_id: string
        file_unique_id: string
        file_size: number
        width: number
        height: number
      }
      file_name?: string
      mime_type?: string
      file_size?: number
    } | {
      file_id: string
      thumb?: {
        file_id: string
        file_unique_id: string
        file_size: number
        width: number
        height: number
      }
      file_name?: string
      mime_type?: string
      file_size?: number
    }
    photo?: Array<{
      file_id: string
      file_unique_id: string
      width: number
      height: number
      file_size?: number
    }>
    voice?: {
      file_id: string
      duration: number
      mime_type?: string
      file_size?: number
    }
    video?: {
      file_id: string
      width: number
      height: number
      duration: number
      thumb?: {
        file_id: string
        file_unique_id: string
        file_size: number
        width: number
        height: number
      }
      mime_type?: string
      file_size?: number
    }
  }
  edited_message?: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      last_name?: string
      username?: string
      language_code?: string
    }
    chat: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      type: 'private' | 'group' | 'supergroup' | 'channel'
    }
    date: number
    text?: string
    entities?: Array<{
      offset: number
      length: number
      type: 'mention' | 'hashtag' | 'bot_command' | 'url' | 'email' | 'phone_number' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'pre' | 'text_link' | 'custom_emoji'
    }>
    reply_markup?: {
      inline_keyboard?: Array<Array<{
        text: string
        url?: string
        callback_data?: string
        switch_inline_query?: string
        switch_inline_query_current_chat?: string
        pay?: boolean
      }>>
      remove_keyboard?: boolean
      force_reply?: boolean
      selective?: boolean
    }
  }
}
