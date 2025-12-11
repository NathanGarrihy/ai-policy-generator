// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/setupFilesAfterEnv.js
// Learn more: https://jestjs.io/docs/configuration#setupfilesafterenv-array

// Polyfill TextEncoder/TextDecoder for undici (required before requiring undici)
// Guard: Only set up if not already set up
if ((typeof globalThis !== "undefined" && !globalThis.TextEncoder) || 
    (typeof global !== "undefined" && !global.TextEncoder)) {
  const { TextEncoder, TextDecoder } = require("util");
  
  if (typeof globalThis !== "undefined") {
    if (!globalThis.TextEncoder) globalThis.TextEncoder = TextEncoder;
    if (!globalThis.TextDecoder) globalThis.TextDecoder = TextDecoder;
  }
  
  // Also set on global for compatibility
  if (typeof global !== "undefined") {
    if (!global.TextEncoder) global.TextEncoder = TextEncoder;
    if (!global.TextDecoder) global.TextDecoder = TextDecoder;
  }
}

// Polyfill ReadableStream for undici (required before requiring undici)
// Guard: Only set up if not already set up
if ((typeof globalThis !== "undefined" && !globalThis.ReadableStream) || 
    (typeof global !== "undefined" && !global.ReadableStream)) {
  try {
    // Node.js 18+ has ReadableStream in stream/web
    const { ReadableStream } = require("stream/web");
    
    if (typeof globalThis !== "undefined") {
      if (!globalThis.ReadableStream) globalThis.ReadableStream = ReadableStream;
    }
    
    // Also set on global for compatibility
    if (typeof global !== "undefined") {
      if (!global.ReadableStream) global.ReadableStream = ReadableStream;
    }
  } catch (e) {
    // Fallback: If stream/web is not available, undici should provide it
    // but we need to handle the case where it's not available yet
    console.warn("ReadableStream polyfill: stream/web not available, undici may provide it");
  }
}

// Provide fetch/Request/Response in the jsdom test environment
// This must be done early to ensure Request is available when Next.js modules are imported
// Guard: Only set up if not already set up (since this file runs in both setupFiles and setupFilesAfterEnv)
if ((typeof globalThis !== "undefined" && !globalThis.Request) || 
    (typeof global !== "undefined" && !global.Request)) {
  const { fetch, Request, Response, Headers } = require("undici");
  
  if (typeof globalThis !== "undefined") {
    if (!globalThis.fetch) globalThis.fetch = fetch;
    if (!globalThis.Request) globalThis.Request = Request;
    if (!globalThis.Response) globalThis.Response = Response;
    if (!globalThis.Headers) globalThis.Headers = Headers;
  }
  
  // Also set on global for compatibility
  if (typeof global !== "undefined") {
    if (!global.fetch) global.fetch = fetch;
    if (!global.Request) global.Request = Request;
    if (!global.Response) global.Response = Response;
    if (!global.Headers) global.Headers = Headers;
  }
}

// Mock environment variables (idempotent - safe to run multiple times)
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.OPENAI_API_KEY = "test-openai-key";

// Suppress console logs in tests unless explicitly enabled
// Guard: Only mock console if not already mocked (check if console._originalLog exists as a marker)
if (!global.console._originalLog) {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  global.console._originalLog = originalLog;
  global.console._originalError = originalError;
  global.console._originalWarn = originalWarn;

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
}
