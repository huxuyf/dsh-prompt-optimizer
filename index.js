/**
 * Host half of the @local/prompt-optimizer bundle.
 *
 * Registers one human command `/prompt-optimize` whose handler sends the draft
 * prompt to the Host `llm` service with an optimization system prompt and
 * returns the rewritten text as the command result. The composer icon (Client
 * half) executes the command through `ctx.remote.commands.execute()` and
 * replaces the draft with `result.text`.
 */

/** Instruction for the one-shot optimization request. */
const OPTIMIZER_SYSTEM_PROMPT = [
  'You are a prompt optimizer inside DeepSeek Harness, a coding-agent workspace.',
  'Rewrite the user message into one clear, effective prompt for an AI coding agent.',
  '',
  'Rules:',
  '- Keep the original language of the message (Chinese stays Chinese, English stays English, mixed stays mixed).',
  '- Preserve every concrete detail: file paths, identifiers, commands, constraints, examples, quantities, and priority order.',
  '- Make the intent, expected output, and success criteria explicit; resolve vague wording without inventing new requirements.',
  '- Use short sentences or bullet points when that improves clarity; keep the result compact.',
  '- Do not answer the request; do not add commentary, headings, quotes, or code fences around the result.',
  '- Return ONLY the rewritten prompt text.',
].join('\n');

/** Strip a wrapping code fence or quotes a model may add around the result. */
function stripWrapping(text) {
  let out = text.trim();
  const fence = /^```[^\n]*\n([\s\S]*?)\n?```$/.exec(out);
  if (fence !== null) out = fence[1].trim();
  if (out.length >= 2 && ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'")))) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

/**
 * Run one optimization request through the Host llm service.
 * @param llm - the Host llm service (adapter registry + streaming model-call API).
 * @param defaultModel - the agentDefaultModel service owning the default selection.
 * @param invocation - the command invocation: rawInput is the draft prompt, signal the UI request.
 * @returns the normalized CommandResult for the command registry.
 */
async function optimize(llm, defaultModel, invocation) {
  const prompt = invocation.rawInput.replace(/^\r?\n/, '');
  if (prompt.trim() === '') {
    return { kind: 'error', text: '没有可优化的内容：提示词为空' };
  }
  const selection = defaultModel.currentSelection();
  const chunks = llm.stream({
    provider: selection.provider,
    model: selection.model,
    messages: [
      { role: 'system', content: [{ type: 'text', text: OPTIMIZER_SYSTEM_PROMPT }] },
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ],
    signal: invocation.signal,
  });
  let text = '';
  for await (const chunk of chunks) {
    if (chunk.type === 'text-delta') {
      text += chunk.text;
      continue;
    }
    if (chunk.type !== 'finish') continue;
    const reason = chunk.reason;
    if (reason.kind === 'stop') {
      const optimized = stripWrapping(text);
      if (optimized === '') return { kind: 'error', text: '模型返回了空结果，请重试' };
      return { kind: 'success', text: optimized };
    }
    if (reason.kind === 'max-tokens') return { kind: 'error', text: '优化结果达到输出长度上限，请缩短提示词后重试' };
    return { kind: 'error', text: reason?.failure?.message || '模型调用失败，请稍后重试' };
  }
  return { kind: 'error', text: '模型调用未返回结果，请稍后重试' };
}

export function apply(ctx) {
  // Optional services: the plugin stays inactive in profiles without them.
  ctx.inject(['llm', 'agentDefaultModel', 'commands'], (child) => {
    const llm = child.llm;
    const defaultModel = child.agentDefaultModel;
    child.effect(() => child.commands.register({
      name: 'prompt-optimize',
      description: '把输入框中的提示词交给默认模型优化，返回优化后的提示词文本。',
      // The draft stays out of the lifecycle log; the optimized result is logged as the outcome.
      recordInput: false,
      input: { hint: '要优化的提示词文本' },
      handler: (invocation) => optimize(llm, defaultModel, invocation),
    }), 'prompt-optimizer: command');
  });
}
