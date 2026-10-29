import ZAI from 'z-ai-web-dev-sdk'

async function main() {
  const zai = await ZAI.create()
  const res = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Always reply with strict JSON only: {"ok": true}' },
      { role: 'user', content: 'test' },
    ],
    thinking: { type: 'disabled' },
  })
  const content = res?.choices?.[0]?.message?.content
  console.log('LLM_TEST_OK content=', String(content).slice(0, 200))
}

main().catch((e) => {
  console.error('LLM_TEST_FAILED:', e?.message || e)
  process.exit(1)
})
