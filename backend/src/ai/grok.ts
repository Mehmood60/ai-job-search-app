import { AIProvider, CompleteOptions, openAiCompatibleComplete } from './provider';

// Grok (x.ai) — OpenAI-compatible chat completions API. This is the default
// provider slot: the app falls back to Grok when the user hasn't set another key.
export const grokProvider: AIProvider = {
  id: 'grok',
  label: 'Grok (x.ai)',
  defaultModel: 'grok-2-latest',
  async complete(apiKey: string, opts: CompleteOptions) {
    return openAiCompatibleComplete(
      'https://api.x.ai/v1',
      apiKey,
      opts.model || this.defaultModel,
      opts,
    );
  },
};
