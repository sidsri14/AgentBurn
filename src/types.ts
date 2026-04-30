export type StepType = 'reasoning' | 'tool' | 'llm' | 'retry' | 'other';

export interface AgentEvent {
  eventId: string;
  userId: string;
  agentId: string;
  jobId: string;
  stepId: string;
  stepType: StepType;
  timestamp: number;
  input?: string;
  output?: string;
  tokens?: number;
  costUsd?: number;
  latencyMs?: number;
  intentHash?: string;
  status?: 'started' | 'in_progress' | 'completed' | 'failed';
}
