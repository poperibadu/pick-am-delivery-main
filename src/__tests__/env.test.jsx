/**
 * env.test.js — Unit tests for environment variable validator
 *
 * Tests the validateEnv() function in isolation to ensure it:
 * - Passes silently when all vars are set
 * - Throws with a clear message when vars are missing
 * - Identifies exactly which vars are missing
 */

import { validateEnv } from '../lib/env';

describe('validateEnv()', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Start each test with a fresh copy of env
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('passes without throwing when all required vars are set', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';

    expect(() => validateEnv()).not.toThrow();
  });

  it('passes without throwing when Paystack key is missing', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';
    delete process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;

    expect(() => validateEnv()).not.toThrow();
  });

  it('throws when REACT_APP_SUPABASE_URL is missing', () => {
    delete process.env.REACT_APP_SUPABASE_URL;
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';

    expect(() => validateEnv()).toThrow(/REACT_APP_SUPABASE_URL/);
  });

  it('throws when REACT_APP_SUPABASE_ANON_KEY is missing', () => {
    process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
    process.env.REACT_APP_PAYSTACK_PUBLIC_KEY = 'pk_test_key';

    expect(() => validateEnv()).toThrow(/REACT_APP_SUPABASE_ANON_KEY/);
  });

  it('reports ALL missing vars in a single throw (not just the first one)', () => {
    delete process.env.REACT_APP_SUPABASE_URL;
    delete process.env.REACT_APP_SUPABASE_ANON_KEY;
    delete process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;

    expect(() => validateEnv()).toThrow(/Missing 2 required/);
  });

  it('throws when a var is set to an empty string', () => {
    process.env.REACT_APP_SUPABASE_URL = '   '; // whitespace only
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.REACT_APP_PAYSTACK_PUBLIC_KEY = 'pk_test_key';

    expect(() => validateEnv()).toThrow(/REACT_APP_SUPABASE_URL/);
  });
});

