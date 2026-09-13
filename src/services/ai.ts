import { config } from '../config.js';

export function guardedAiCall(prompt: string): string {
  if (!config.aiEnabled) {
    return `AI is disabled. Fallback path used for: ${prompt}`;
  }

  return `AI would process: ${prompt}`;
}
