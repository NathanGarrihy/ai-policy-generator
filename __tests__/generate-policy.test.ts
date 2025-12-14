/**
 * Integration Tests for Policy Generation API
 * Tests full API flow with mocked OpenAI responses and edge cases
 */

import { POST } from "@/app/api/generate-policy/route";
import { NextRequest } from "next/server";

// Mock authentication middleware
jest.mock("@/lib/auth-middleware", () => ({
  authenticateRequest: jest.fn(() =>
    Promise.resolve({
      authenticated: true,
      user: { id: "test-user-id", email: "test@example.com" },
      userId: "test-user-id",
    })
  ),
}));

// Mock rate limiting middleware
jest.mock("@/lib/rate-limit", () => ({
  rateLimitMiddleware: jest.fn(() => null),
  logRateLimitViolation: jest.fn(),
}));

// Mock quota middleware
jest.mock("@/lib/quota", () => ({
  checkQuotaMiddleware: jest.fn(() => null),
  incrementQuota: jest.fn(),
}));

// Mock next/headers cookies
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    getAll: jest.fn(() => []),
    get: jest.fn(() => undefined),
    set: jest.fn(),
    delete: jest.fn(),
  })),
}));

// Mock OpenAI API
const mockOpenAIResponse = {
  choices: [
    {
      message: {
        content: `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

## Introduction & Scope

This Privacy Policy applies to Test Company and describes how we collect, use, and protect your personal data (GDPR Art. 13).

## Data Collection Categories & Purposes

We process personal data, including email addresses and names, based on your consent and for the performance of our services (GDPR Art. 6). We ensure that consent is freely given and can be withdrawn (GDPR Art. 7).

## Data Rights & Transparency

You have comprehensive rights regarding your personal data, including the right to access (GDPR Art. 15), rectification (GDPR Art. 16), erasure (GDPR Art. 17), restriction of processing (GDPR Art. 18), data portability (GDPR Art. 20), and objection to processing (GDPR Art. 21).

## Security Measures

We implement technical and organizational security measures to protect your personal data (GDPR Art. 32, ISO 42001 §8.2).

## Mapping Appendix

- Introduction & Scope: GDPR Art. 13
- Data Collection Categories & Purposes: GDPR Art. 6, GDPR Art. 7
- Data Rights & Transparency: GDPR Art. 15, GDPR Art. 16, GDPR Art. 17, GDPR Art. 18, GDPR Art. 20, GDPR Art. 21
- Security Measures: GDPR Art. 32, ISO 42001 §8.2

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----
-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "placeholders_present": false,
  "jurisdictions": ["GDPR_EU"],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": [
    {
      "id": "sec_intro",
      "title": "Introduction & Scope",
      "framework_refs": ["GDPR Art. 13"]
    },
    {
      "id": "sec_data_collection",
      "title": "Data Collection Categories & Purposes",
      "framework_refs": ["GDPR Art. 6", "GDPR Art. 7"]
    },
    {
      "id": "sec_rights",
      "title": "Data Rights & Transparency",
      "framework_refs": ["GDPR Art. 15", "GDPR Art. 16", "GDPR Art. 17", "GDPR Art. 18", "GDPR Art. 20", "GDPR Art. 21"]
    },
    {
      "id": "sec_security",
      "title": "Security Measures",
      "framework_refs": ["GDPR Art. 32", "ISO 42001 §8.2"]
    }
  ]
}
-----END POLICY-METAJSON-----`,
      },
    },
  ],
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
};

describe("POST /api/generate-policy", () => {
  beforeEach(() => {
    // Mock fetch for OpenAI API
    global.fetch = jest.fn((url: string) => {
      if (url.includes("api.openai.com")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockOpenAIResponse),
        } as Response);
      }
      return Promise.reject(new Error("Unexpected fetch call"));
    }) as jest.Mock;
  });

  it("should generate policy with valid questionnaire data", async () => {
    const questionnaireData = {
      company_name: "Test Company",
      jurisdictions: ["GDPR (EU)"],
      data_collected: ["Email", "Name"],
      purpose_of_processing: "Providing services",
      third_parties: "Yes",
      cookies_used: "Yes",
      data_retention: "1 year",
      dpo_contact: "dpo@test.com",
    };

    const request = new NextRequest("http://localhost/api/generate-policy", {
      method: "POST",
      body: JSON.stringify({
        questionnaireData,
        policyType: "privacy_policy",
        qualityTier: "standard",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.content).toBeDefined();
    expect(data.metadata).toBeDefined();
    expect(data.generationMetadata).toBeDefined();
  });

  it("should return validation errors for invalid questionnaire data", async () => {
    const invalidData = {
      company_name: "", // Invalid: empty
      jurisdictions: [], // Invalid: empty array
    };

    const request = new NextRequest("http://localhost/api/generate-policy", {
      method: "POST",
      body: JSON.stringify({
        questionnaireData: invalidData,
        policyType: "privacy_policy",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBeDefined();
    expect(data.details).toBeDefined();
  });

  it("should handle OpenAI API errors gracefully", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () =>
          Promise.resolve({
            error: { message: "Rate limit exceeded" },
          }),
      } as Response)
    ) as jest.Mock;

    const questionnaireData = {
      company_name: "Test Company",
      jurisdictions: ["GDPR (EU)"],
      data_collected: ["Email"],
      purpose_of_processing: "Services",
      third_parties: "No",
      cookies_used: "No",
      data_retention: "1 year",
      dpo_contact: "dpo@test.com",
    };

    const request = new NextRequest("http://localhost/api/generate-policy", {
      method: "POST",
      body: JSON.stringify({
        questionnaireData,
        policyType: "privacy_policy",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should handle malformed OpenAI responses", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [], // Invalid: empty choices
          }),
      } as Response)
    ) as jest.Mock;

    const questionnaireData = {
      company_name: "Test Company",
      jurisdictions: ["GDPR (EU)"],
      data_collected: ["Email"],
      purpose_of_processing: "Services",
      third_parties: "No",
      cookies_used: "No",
      data_retention: "1 year",
      dpo_contact: "dpo@test.com",
    };

    const request = new NextRequest("http://localhost/api/generate-policy", {
      method: "POST",
      body: JSON.stringify({
        questionnaireData,
        policyType: "privacy_policy",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("should retry on low quality with feedback", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First attempt: low quality response
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [
                {
                  message: {
                    content: `-----BEGIN POLICY-MARKDOWN-----
# Privacy Policy

We collect some data.

Last updated: 2024-12-19
-----END POLICY-MARKDOWN-----
-----BEGIN POLICY-METAJSON-----
{
  "policy_type": "privacy",
  "placeholders_present": false,
  "jurisdictions": [],
  "coverage": { "gdpr": 0, "ai_act": 0, "iso_42001": 0 },
  "sections": []
}
-----END POLICY-METAJSON-----`,
                  },
                },
              ],
              usage: { prompt_tokens: 500, completion_tokens: 200, total_tokens: 700 },
            }),
          } as Response);
      }
      // Second attempt: use mock response
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockOpenAIResponse),
      } as Response);
    }) as jest.Mock;

    const questionnaireData = {
      company_name: "Test Company",
      jurisdictions: ["GDPR (EU)"],
      data_collected: ["Email"],
      purpose_of_processing: "Services",
      third_parties: "No",
      cookies_used: "No",
      data_retention: "1 year",
      dpo_contact: "dpo@test.com",
    };

    const request = new NextRequest("http://localhost/api/generate-policy", {
      method: "POST",
      body: JSON.stringify({
        questionnaireData,
        policyType: "privacy_policy",
        qualityTier: "standard",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(callCount).toBeGreaterThan(1); // Should have retried
    expect(data.generationMetadata.attempts.length).toBeGreaterThan(1);
  });

  it("should support premium tier with GPT-4 fallback", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      const model = callCount === 1 ? "gpt-3.5-turbo" : "gpt-4o";
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            ...mockOpenAIResponse,
            model,
          }),
      } as Response);
    }) as jest.Mock;

    const questionnaireData = {
      company_name: "Test Company",
      jurisdictions: ["GDPR (EU)"],
      data_collected: ["Email"],
      purpose_of_processing: "Services",
      third_parties: "No",
      cookies_used: "No",
      data_retention: "1 year",
      dpo_contact: "dpo@test.com",
    };

    const request = new NextRequest("http://localhost/api/generate-policy", {
      method: "POST",
      body: JSON.stringify({
        questionnaireData,
        policyType: "privacy_policy",
        qualityTier: "premium",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Premium tier should use GPT-4o on second attempt if needed
    expect(data.generationMetadata.attempts.length).toBeGreaterThan(0);
  });
});


