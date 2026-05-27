import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../../src/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/lib/supabase', () => ({
  supabaseAvailable: vi.fn(),
  getSupabase: vi.fn(),
}));

// Mock network requests for the deliverWithRetries logic
// Note: vitest will intercept fetch or we can mock fetch directly
const originalFetch = global.fetch;

import { enqueueWebhook, WebhookEvent } from '../../src/webhooks/dispatcher';
import { logger } from '../../src/lib/logger';
import { supabaseAvailable, getSupabase } from '../../src/lib/supabase';

describe('enqueueWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('handles errors gracefully in the asynchronous execution', async () => {
    // Force fetchEndpoints to throw an error
    vi.mocked(supabaseAvailable).mockImplementation(() => {
      throw new Error('Simulated DB error');
    });

    enqueueWebhook({ userId: 'u1', event: 'otp.sent' as WebhookEvent, data: {} });

    // wait for setImmediate to resolve
    await new Promise(resolve => setImmediate(resolve));

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        event: 'otp.sent'
      }),
      'Webhook dispatcher error'
    );
  });

  it('successfully completes when no endpoints match (success path)', async () => {
    vi.mocked(supabaseAvailable).mockReturnValue(false);

    enqueueWebhook({ userId: 'u1', event: 'otp.sent' as WebhookEvent, data: {} });

    // wait for setImmediate to resolve
    await new Promise(resolve => setImmediate(resolve));

    expect(logger.warn).not.toHaveBeenCalled();
  });
});
