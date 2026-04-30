import { describe, expect, it, vi } from 'vitest';
import { AgentBurnClient, AgentBurnEmergencyStopError } from '../src/sdk/client.js';
import type { AgentEvent } from '../src/types.js';

const event: AgentEvent = {
  eventId: 'e1',
  userId: 'u1',
  agentId: 'a1',
  jobId: 'j1',
  stepId: 's1',
  stepType: 'reasoning',
  timestamp: Date.now()
};

describe('AgentBurnClient', () => {
  it('throws emergency stop when enabled', async () => {
    const client = new AgentBurnClient({
      endpoint: 'https://example.com',
      apiKey: 'k',
      emergencyStopCheck: async () => true
    });

    await expect(client.wrap(event, async () => 'ok')).rejects.toBeInstanceOf(AgentBurnEmergencyStopError);
  });

  it('runs wrapped function when emergency stop disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const client = new AgentBurnClient({
      endpoint: 'https://example.com',
      apiKey: 'k',
      emergencyStopCheck: async () => false
    });

    const value = await client.wrap(event, async () => 'ok');
    expect(value).toBe('ok');
    expect(fetchMock).toHaveBeenCalled();
  });
});
