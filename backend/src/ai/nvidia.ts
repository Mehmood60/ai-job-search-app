import { AIProvider, CompleteOptions, openAiCompatibleComplete } from './provider';

// NVIDIA NIM — OpenAI-compatible API hosting strong open models (DeepSeek V3, Llama
// 3.3 70B, Qwen, …) with large context. Free API key at https://build.nvidia.com.
export const nvidiaProvider: AIProvider = {
  id: 'nvidia',
  label: 'NVIDIA NIM (DeepSeek)',
  defaultModel: 'deepseek-ai/deepseek-v4-flash', // fast; -pro reasoning can time out (504)
  async complete(apiKey: string, opts: CompleteOptions) {
    return openAiCompatibleComplete(
      'https://integrate.api.nvidia.com/v1',
      apiKey,
      opts.model || this.defaultModel,
      opts,
    );
  },
};
