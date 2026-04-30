import type { AgentEvent } from '../types.js';

const STEP_TYPES = new Set(['reasoning', 'tool', 'llm', 'retry', 'other']);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAgentEvent(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['payload must be an object'] };
  }

  const event = input as Partial<AgentEvent>;
  const requiredFields: (keyof AgentEvent)[] = ['eventId', 'userId', 'agentId', 'jobId', 'stepId', 'stepType', 'timestamp'];

  for (const field of requiredFields) {
    if (event[field] === undefined || event[field] === null || event[field] === '') {
      errors.push(`missing required field: ${field}`);
    }
  }

  if (event.stepType && !STEP_TYPES.has(event.stepType)) {
    errors.push('invalid stepType');
  }

  if (event.timestamp !== undefined && (!Number.isFinite(event.timestamp) || event.timestamp <= 0)) {
    errors.push('timestamp must be a positive number');
  }

  if (event.tokens !== undefined && (!Number.isFinite(event.tokens) || event.tokens < 0)) {
    errors.push('tokens must be a non-negative number');
  }

  if (event.costUsd !== undefined && (!Number.isFinite(event.costUsd) || event.costUsd < 0)) {
    errors.push('costUsd must be a non-negative number');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
