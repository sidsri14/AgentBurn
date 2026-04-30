import type { AgentEvent } from '../types.js';

export interface AgentBurnConfig {
  endpoint: string;
  apiKey: string;
  timeoutMs?: number;
  emergencyStopCheck?: () => Promise<boolean>;
}

export class AgentBurnEmergencyStopError extends Error {
  constructor(message = 'AgentBurn emergency stop is enabled for this API key.') {
    super(message);
    this.name = 'AgentBurnEmergencyStopError';
  }
}

export class AgentBurnClient {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly emergencyStopCheck?: () => Promise<boolean>;

  constructor(config: AgentBurnConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 1200;
    this.emergencyStopCheck = config.emergencyStopCheck;
  }

  async trackStep(event: AgentEvent): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      await fetch(`${this.endpoint}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify(event)
      });
    } catch {
      // non-blocking by design
    } finally {
      clearTimeout(timeout);
    }
  }

  async wrap<T>(event: AgentEvent, fn: () => Promise<T>): Promise<T> {
    if (this.emergencyStopCheck && (await this.emergencyStopCheck())) {
      void this.trackStep({ ...event, status: 'failed', output: 'emergency_stop_triggered' });
      throw new AgentBurnEmergencyStopError();
    }

    void this.trackStep({ ...event, status: 'started' });
    try {
      const result = await fn();
      void this.trackStep({ ...event, status: 'completed' });
      return result;
    } catch (error) {
      void this.trackStep({ ...event, status: 'failed' });
      throw error;
    }
  }
}
