import { describe, expect, it } from 'vitest';
import { validateAgentEvent } from '../src/ingest/validate.js';

describe('validateAgentEvent', () => {
  it('accepts a valid event payload', () => {
    const result = validateAgentEvent({
      eventId: 'e1',
      userId: 'u1',
      agentId: 'a1',
      jobId: 'j1',
      stepId: 's1',
      stepType: 'reasoning',
      timestamp: 123
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects malformed payloads', () => {
    const result = validateAgentEvent({
      eventId: 'e1',
      stepType: 'bad',
      timestamp: -1
    });

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
