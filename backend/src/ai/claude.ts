import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, CompleteOptions } from './provider';

// Claude (Anthropic) — uses the official @anthropic-ai/sdk (not an OpenAI-compatible
// shim). Default model is the latest capable Opus. The API is stateless; we send a
// single system + user turn and read the returned text blocks.
export const claudeProvider: AIProvider = {
  id: 'claude',
  label: 'Claude (Anthropic)',
  defaultModel: 'claude-opus-4-8',
  async complete(apiKey: string, opts: CompleteOptions) {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: opts.model || this.defaultModel,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) throw new Error('Claude returned an empty response');
    return text;
  },
};
