import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")
    _client = new Anthropic({ apiKey })
  }
  return _client
}

export type ToolUseResult<T> = T

export async function callWithTool<T>(params: {
  model?: string
  system?: string
  userMessage: string
  toolName: string
  toolDescription: string
  inputSchema: Record<string, unknown>
  maxTokens?: number
}): Promise<T> {
  const client = getAnthropicClient()
  const model = params.model ?? "claude-haiku-4-5-20251001"

  const response = await client.messages.create({
    model,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
    messages: [{ role: "user", content: params.userMessage }],
  })

  const toolBlock = response.content.find((b) => b.type === "tool_use")
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`LLM did not return tool_use block (model=${model})`)
  }
  return toolBlock.input as T
}
