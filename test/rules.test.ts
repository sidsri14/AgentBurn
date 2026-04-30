import { describe, expect, it } from 'vitest';
import { evaluateLoop } from '../src/analysis/rules.js';
import type { AgentEvent } from '../src/types.js';

const base = {
  userId: 'u1',
  agentId: 'a1',
  jobId: 'j1',
  stepType: 'reasoning' as const,
  intentHash: 'same-intent'
};

function buildEvent(i: number): AgentEvent {
  return {
    ...base,
    eventId: `e${i}`,
    stepId: `s${i}`,
    timestamp: 1_000 + i * 1_000
  };
}

describe('evaluateLoop', () => {
  it('returns warning at 5 repeats', () => {
    const events = [1, 2, 3, 4, 5].map(buildEvent);
    const result = evaluateLoop(events, 10_000);
    expect(result.isLoopWarning).toBe(true);
    expect(result.isHardKill).toBe(false);
    expect(result.repeatCount).toBe(5);
  });

  it('returns hard kill at 10 repeats', () => {
    const events = Array.from({ length: 10 }, (_, i) => buildEvent(i + 1));
    const result = evaluateLoop(events, 12_000);
    expect(result.isHardKill).toBe(true);
    expect(result.repeatCount).toBe(10);
  });

  it('ignores events outside time window', () => {
    const old = {
      ...buildEvent(1),
      timestamp: 0
    };
    const recent = [2, 3, 4, 5].map(buildEvent);
    const result = evaluateLoop([old, ...recent], 7_000, 3_000);
    expect(result.repeatCount).toBe(3);
    expect(result.isLoopWarning).toBe(false);
  });
});
