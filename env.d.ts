
type WorkerBindings = {
  META_APP_VERIFY_TOKEN: string
  META_APP_SECRET: string
  META_APP_ACCESS_TOKEN: string
  WA_BUSINESS_PHONE_ID: string
  GOOGLE_GENERATIVE_AI_API_KEY: string
  KV_DOC_CHATS: KVNamespace
}

interface AppEnv {
  Bindings: WorkerBindings
}

declare module 'cloudflare:test' {
  interface ProvidedEnv extends WorkerBindings {}
}
