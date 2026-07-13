import { AIProvider, CompleteOptions, openAiCompatibleComplete } from './provider';

// Groq — OpenAI-compatible chat completions API hosting fast open models (LLaMA etc.).
// Note: distinct from Grok (x.ai). Free tier at https://console.groq.com (gsk_ keys).
export const groqProvider: AIProvider = {
  id: 'groq',
  label: 'Groq (LLaMA)',
  defaultModel: 'llama-3.1-8b-instant',
  async complete(apiKey: string, opts: CompleteOptions) {
    return openAiCompatibleComplete(
      'https://api.groq.com/openai/v1',
      apiKey,
      opts.model || this.defaultModel,
      opts,
    );
  },
};
