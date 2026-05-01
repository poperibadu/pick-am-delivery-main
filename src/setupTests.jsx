/**
 * setupTests.js — Global test setup for Pick-Am
 *
 * Runs before every test file. Configures:
 *  - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 *  - Supabase mock so tests never hit the real DB
 *  - Environment variable stubs
 */

// ── 1. Jest-DOM matchers ──────────────────────────────────────────
import '@testing-library/jest-dom';

// ── 2. Stub env vars so validateEnv() passes in tests ────────────
process.env.REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.REACT_APP_PAYSTACK_PUBLIC_KEY = 'pk_test_stub';

// ── 3. Mock Supabase globally ─────────────────────────────────────
// Prevents any real network calls during tests.
vi.mock('./lib/supabase', () => ({
  __esModule: true,
  default: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

// ── 4. Mock react-router-dom navigation ──────────────────────────
vi.mock('react-router-dom', () => ({
  MemoryRouter: ({ children }) => <div>{children}</div>,
  Navigate: ({ to }) => <div data-testid="navigate">Navigate to {to}</div>,
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}), { virtual: true });

// ── 5. Suppress known noisy console output in tests ──────────────
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    // Suppress React 19 act() warnings and known safe errors
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: An update to') ||
        args[0].includes('not wrapped in act'))
    ) {
      return;
    }
    originalError(...args);
  };
});
afterAll(() => {
  console.error = originalError;
});

