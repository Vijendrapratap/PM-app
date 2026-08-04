const MODEL_ALIASES: Record<string, string> = {
  '~deepseek/deepseek-v4-flash-latest': 'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-v4-flash-latest': 'deepseek/deepseek-v4-flash',
};

export const normalizeOpenRouterModelId = (model: string) =>
  MODEL_ALIASES[model.trim()] || model.trim().replace(/^~/, '');
