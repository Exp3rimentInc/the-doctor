import { Hono } from 'hono'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import signatureVerification from './middleware/signatureVerification'
import * as whatsAppWebhooksHandlers from './handlers/whatsAppWebhooks'
import zodValidation from './middleware/zodValidation'
import * as telegramWebhooksHandlers from './handlers/telegramWebhooks'

const app = new Hono<AppEnv>()

app.get('/', (c) => {
  return c.text('Hello World!')
})

const MetaVerificationSchema = z.object({
  'hub.verify_token': z.string().min(160).max(192),
  'hub.challenge': z.string().min(5).max(30),
  'hub.mode': z.enum(['subscribe']),
})

app.get('/meta/hub', zodValidation('query', MetaVerificationSchema), (ctx) => {
  const v = ctx.req.valid('query')

  try {
    if (
      timingSafeEqual(
        Buffer.from(v['hub.verify_token']),
        Buffer.from(ctx.env.META_APP_VERIFY_TOKEN)
      )
    ) {
      return ctx.text(v['hub.challenge'])
    }
  }
  catch {}

  return ctx.text('Bad Request', 400)
})

app.use('/meta/hub', signatureVerification)
app.post('/meta/hub', whatsAppWebhooksHandlers.onMessage)

app.use('/telegram/webhook', telegramWebhooksHandlers.verifyWebhookToken)
app.post('/telegram/webhook', telegramWebhooksHandlers.handleIncomingWebhook)

export default app
