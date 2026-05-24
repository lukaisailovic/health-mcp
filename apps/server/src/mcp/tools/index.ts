import type { AnyToolDef } from '../tool-registry.js';
import { biomarkerTools } from './biomarkers.js';
import { buildDiscoverTool, pingTool } from './discover.js';
import { foodTools } from './food.js';
import { intakeTools } from './intake.js';
import { logTools } from './logs.js';
import { recipeTools } from './recipes.js';
import { rememberedTools } from './remembered.js';
import { summaryTools } from './summaries.js';
import { wearableTools } from './wearables.js';

export const buildAllTools = (): AnyToolDef[] => {
  const tools: AnyToolDef[] = [
    pingTool,
    ...foodTools,
    ...intakeTools,
    ...logTools,
    ...summaryTools,
    ...recipeTools,
    ...rememberedTools,
    ...biomarkerTools,
    ...wearableTools,
  ];
  tools.push(buildDiscoverTool(() => tools));
  return tools;
};
