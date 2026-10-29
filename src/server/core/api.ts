import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data as unknown as Record<string, unknown>, { status })
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) return fail(error.message, error.status)
  if (error instanceof ZodError) {
    const first = error.issues[0]
    const path = first?.path?.join('.') ?? ''
    return fail(`Invalid input${path ? ` at "${path}"` : ''}: ${first?.message ?? 'validation failed'}`, 422)
  }
  console.error('[api] unhandled error:', error)
  return fail('Internal server error', 500)
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new ApiError('Request body must be valid JSON', 400)
  }
  return schema.parse(json)
}
