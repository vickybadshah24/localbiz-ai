// Backend core configuration (mirrors backend/app/core/config.py in the target monorepo)

export const env = {
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
  whatsappAppSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  whatsappGraphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
  defaultBusinessName: process.env.DEFAULT_BUSINESS_NAME ?? 'LocalBiz Demo',
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(env.whatsappToken && env.whatsappPhoneNumberId)
}

// Slot granularity for availability generation (minutes)
export const SLOT_STEP_MIN = 30
// How many history messages are passed to the LLM for context
export const AI_HISTORY_LIMIT = 10
// Maximum knowledge entries injected into the AI prompt
export const AI_KNOWLEDGE_LIMIT = 4
