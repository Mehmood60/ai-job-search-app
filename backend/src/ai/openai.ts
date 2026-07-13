import { AIProvider, CompleteOptions, openAiCompatibleComplete } from './provider';

// OpenAI (ChatGPT) — chat completions API.
export const openaiProvider: AIProvider = {
  id: 'openai',
  label: 'ChatGPT (OpenAI)',
  defaultModel: 'gpt-4o',
  async complete(apiKey: string, opts: CompleteOptions) {
    return openAiCompatibleComplete(
      'https://api.openai.com/v1',
      apiKey,
      opts.model || this.defaultModel,
      opts,
    );
  },
};
