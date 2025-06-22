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

export function handleIncomingWebhook(c: Context<AppEnv>) {
  return c.text('Telegram webhook handler is not implemented yet.', 501)
}
