// Central catalog of SCX.ai chat models available to the UI.
// Kept in sync with the live SCX /v1/models endpoint and the backend catalog
// at backend/app/models_catalog.py. `label` shows the context / output limits.

export interface ScxModel {
  value: string;
  label: string;
}

export const SCX_MODELS: ScxModel[] = [
  { value: 'gpt-oss-120b', label: 'GPT-OSS 120B (Recommended)' },
  { value: 'MAGPiE', label: 'MAGPiE (AU Sovereign)' },
  { value: 'MiniMax-M2.7', label: 'MiniMax M2.7 (192K context)' },
  { value: 'DeepSeek-V3.1', label: 'DeepSeek V3.1' },
  { value: 'gemma-4-31B-it', label: 'Gemma 4 31B (Vision)' },
  { value: 'Llama-4-Maverick-17B-128E-Instruct', label: 'Llama 4 Maverick (Vision)' },
  { value: 'Meta-Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
  { value: 'coder', label: 'SCX Coder' },
  { value: 'Qwen3-32B', label: 'Qwen3 32B (33K context)' },
];

// Default model used across the app. The previous default (MiniMax-M2.5) was
// removed from the SCX tier; gpt-oss-120b supports the app's large outputs.
export const DEFAULT_MODEL = 'gpt-oss-120b';
