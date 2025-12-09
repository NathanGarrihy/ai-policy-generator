// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/setupFilesAfterEnv.js
// Learn more: https://jestjs.io/docs/configuration#setupfilesafterenv-array

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.OPENAI_API_KEY = "test-openai-key";

// Suppress console logs in tests unless explicitly enabled
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

global.console = {
  ...console,
  log: (...args) => {
    if (process.env.VERBOSE_TESTS === "true") {
      originalLog(...args);
    }
  },
  error: (...args) => {
    if (process.env.VERBOSE_TESTS === "true") {
      originalError(...args);
    }
  },
  warn: (...args) => {
    if (process.env.VERBOSE_TESTS === "true") {
      originalWarn(...args);
    }
  },
};

