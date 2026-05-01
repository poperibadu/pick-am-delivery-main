/**
 * env.js — Environment Variable Validator
 *
 * Validates all required REACT_APP_* variables at startup.
 * If any are missing, the app throws immediately with a clear message
 * rather than failing silently deep in a Supabase or Paystack call.
 */

const REQUIRED_ENV_VARS = [
  {
    key: 'REACT_APP_SUPABASE_URL',
    label: 'Supabase Project URL',
    hint: 'Found in: Supabase Dashboard → Settings → API → Project URL',
  },
  {
    key: 'REACT_APP_SUPABASE_ANON_KEY',
    label: 'Supabase Anon Key',
    hint: 'Found in: Supabase Dashboard → Settings → API → anon/public key',
  },
  {
    key: 'REACT_APP_PAYSTACK_PUBLIC_KEY',
    label: 'Paystack Public Key',
    hint: 'Found in: Paystack Dashboard → Settings → API Keys & Webhooks',
  },
];

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter(
    ({ key }) => !process.env[key] || process.env[key].trim() === ''
  );

  if (missing.length === 0) return; // All good ✓

  const details = missing
    .map(({ key, label, hint }) => `  ✗ ${key}\n    → ${label}\n    → ${hint}`)
    .join('\n\n');

  const message = [
    '╔══════════════════════════════════════════╗',
    '║   Pick-Am: Missing Environment Variables  ║',
    '╚══════════════════════════════════════════╝',
    '',
    `${missing.length} required variable(s) are not set:\n`,
    details,
    '',
    'Create a .env file in the project root with these values.',
    'See .env.example for a template.',
    '',
  ].join('\n');

  // In development: throw so it shows in the browser error overlay
  // In production: log & throw so it appears in server/deployment logs
  if (process.env.NODE_ENV !== 'test') {
    console.error(message);
  }
  throw new Error(
    `Missing ${missing.length} required env variable(s): ${missing.map((v) => v.key).join(', ')}`
  );
}

// Export individual env vars for convenience (typed access)
export const env = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL,
  supabaseAnonKey: process.env.REACT_APP_SUPABASE_ANON_KEY,
  paystackPublicKey: process.env.REACT_APP_PAYSTACK_PUBLIC_KEY,
};

