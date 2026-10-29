// Knowledge base service (mirrors backend/app/services/knowledge_service.py)
import { db } from '@/lib/db'
import { ApiError } from '../core/api'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'you', 'your', 'with', 'what', 'when', 'how', 'are',
  'can', 'does', 'did', 'have', 'has', 'was', 'were', 'will', 'would', 'this',
  'that', 'from', 'about', 'our', 'his', 'her', 'them', 'they', 'there', 'here',
])

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((t) => !STOP_WORDS.has(t))
}

export async function listEntries(businessId: string) {
  return db.knowledgeEntry.findMany({ where: { businessId }, orderBy: [{ updatedAt: 'desc' }] })
}

export async function createEntry(
  businessId: string,
  input: { title: string; content: string; category: string }
) {
  return db.knowledgeEntry.create({
    data: { businessId, title: input.title, content: input.content, category: input.category },
  })
}

export async function updateEntry(
  businessId: string,
  id: string,
  patch: { title?: string; content?: string; category?: string; active?: boolean }
) {
  const existing = await db.knowledgeEntry.findFirst({ where: { id, businessId } })
  if (!existing) throw new ApiError('Knowledge entry not found', 404)
  return db.knowledgeEntry.update({ where: { id }, data: patch })
}

export async function deleteEntry(businessId: string, id: string) {
  const existing = await db.knowledgeEntry.findFirst({ where: { id, businessId } })
  if (!existing) throw new ApiError('Knowledge entry not found', 404)
  await db.knowledgeEntry.delete({ where: { id } })
}

/**
 * Lightweight keyword-overlap retrieval over the knowledge base.
 * (Production monorepo swaps this for pgvector / embedding search.)
 */
export async function retrieveKnowledge(
  businessId: string,
  query: string,
  limit = 4
): Promise<Array<{ id: string; title: string; content: string; category: string }>> {
  const entries = await db.knowledgeEntry.findMany({
    where: { businessId, active: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!entries.length) return []

  const tokens = tokenize(query)
  if (!tokens.length) return entries.slice(0, Math.min(2, limit))

  const scored = entries
    .map((entry) => {
      const haystack = tokenize(`${entry.title} ${entry.category} ${entry.content}`)
      const titleTokens = new Set(tokenize(entry.title))
      let score = 0
      for (const token of tokens) {
        if (titleTokens.has(token)) score += 3
        else if (haystack.includes(token)) score += 1
      }
      return { entry, score }
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, limit).map((s) => s.entry)
  if (top.length === 0 && entries.length <= 6) {
    // Small knowledge base: give the assistant everything rather than nothing.
    return entries.slice(0, limit)
  }
  return top
}
