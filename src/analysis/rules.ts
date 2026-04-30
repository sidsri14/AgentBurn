import type { AgentEvent } from '../types.js';

export interface LoopEvaluation {
  isLoopWarning: boolean;
  isHardKill: boolean;
  repeatCount: number;
}

export function evaluateLoop(events: AgentEvent[], nowMs: number, windowMs = 5 * 60_000): LoopEvaluation {
  const windowStart = nowMs - windowMs;
  const inWindow = events.filter((event) => event.timestamp >= windowStart);

  if (inWindow.length === 0) {
    return { isLoopWarning: false, isHardKill: false, repeatCount: 0 };
  }

  const latest = inWindow[inWindow.length - 1];
  const repeatCount = inWindow.filter(
    (event) => event.intentHash !== undefined && event.intentHash === latest.intentHash && event.stepType === latest.stepType
  ).length;

  return {
    isLoopWarning: repeatCount >= 5,
    isHardKill: repeatCount >= 10,
    repeatCount
  };
}
