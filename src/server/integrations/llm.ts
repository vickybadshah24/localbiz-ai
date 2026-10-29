// LLM integration (mirrors backend/app/integrations/llm.py)
// Wraps the Z.ai SDK so services never talk to the raw client.

import ZAI from 'z-ai-web-dev-sdk'

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ZaiClient = Awaited<ReturnType<typeof ZAI.create>>

let cached: ZaiClient | null = null

async function client(): Promise<ZaiClient> {
  if (!cached) cached = await ZAI.create()
  return cached
}

export async function llmComplete(
  messages: LlmMessage[],
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const zai = await client()
  const res = await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
    temperature: opts?.temperature ?? 0.4,
    ...(opts?.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  })
  const content = res?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Empty LLM response')
  }
  return content
}

/**
 * Robustly extract the first JSON object from an LLM response.
 * Handles ```json fences, prose around the object, etc.
 */
export function extractJson<T>(raw: string): T | null {
  const withoutFences = raw.replace(/```(?:json)?/gi, '```')
  const fenced = withoutFences.match(/```([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : withoutFences).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T
  } catch {
    return null
  }
}
