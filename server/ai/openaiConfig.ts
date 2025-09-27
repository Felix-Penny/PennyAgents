/**
 * Centralized OpenAI model configuration
 * Default: GPT-5-Codex (Preview) for all clients, overridable via OPENAI_DEFAULT_MODEL
 */

export const AI_MODELS = {
  // Preferred default (can be overridden by env)
  GPT_5_CODEX_PREVIEW: "gpt-5-codex-preview",

  // Other supported/legacy identifiers kept for compatibility
  GPT_5: "gpt-5",
  GPT_4O: "gpt-4o",
  GPT_4_TURBO: "gpt-4-turbo",
  GPT_4_VISION: "gpt-4-vision-preview",
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS] | string;

// Environment-driven default with sensible fallback
export const DEFAULT_OPENAI_MODEL: string =
  process.env.OPENAI_DEFAULT_MODEL?.trim() || AI_MODELS.GPT_5_CODEX_PREVIEW;

/**
 * Resolve the model to use, preferring provided value, else env default, else fallback.
 */
export function resolveModel(model?: string): string {
  return model && model.trim() ? model : DEFAULT_OPENAI_MODEL;
}
