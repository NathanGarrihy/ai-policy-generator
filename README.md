# PolicyPilot - AI-Powered Compliance Platform

PolicyPilot is an AI-powered compliance platform for EU/UK B2B SaaS startups. It generates GDPR, AI Act, and ISO 42001-aligned policies with buyer-ready evidence packs.

> **Disclaimer:** PolicyPilot is a portfolio project. Generated policies and compliance scores are drafts to support your own review — they are not legal advice. Have a qualified professional review any policy before you rely on it.

**North Star**: "Generate, monitor, and prove EU-grade privacy & AI governance — turning AI Act + ISO 42001 duties into live policies, evidence, and buyer-ready compliance reports for startups."

## Table of Contents

- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Architecture

### Tech Stack

- **Framework**: Next.js 15.4.1 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI API (GPT-3.5-turbo, GPT-4o)
- **Export**: PDF (pdf-lib), DOCX (docx)
- **Validation**: Zod

### Key Components

1. **Policy Generation Engine** (`app/api/generate-policy/route.ts`)
   - Orchestrates policy generation with retry logic
   - Handles model selection (GPT-3.5 vs GPT-4o)
   - Implements quality validation and feedback loops

2. **PolicyCop Compliance Engine** (`lib/policycop.ts`)
   - Analyzes policy content against legal frameworks
   - Calculates coverage scores (GDPR, AI Act, ISO 42001)
   - Provides actionable feedback on missing clauses

3. **Parser Module** (`lib/parser.ts`)
   - Extracts structured content from AI responses
   - Validates policy structure and format
   - Handles placeholder replacement

4. **Prompt Engineering** (`lib/prompts.ts`)
   - Builds model-specific prompts
   - Ensures structured output format (MARKDOWN + METAJSON)

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- OpenAI API key
- Supabase account (for authentication and data storage)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-policy-gen
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Required

```env
# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional

```env
# Model Selection (defaults shown)
OPENAI_STANDARD_MODEL=gpt-3.5-turbo
OPENAI_PREMIUM_BASE_MODEL=gpt-3.5-turbo
OPENAI_PREMIUM_FALLBACK_MODEL=gpt-4o

# Rate Limiting (defaults shown)
RATE_LIMIT_STANDARD_REQUESTS=10
RATE_LIMIT_PREMIUM_REQUESTS=50
RATE_LIMIT_WINDOW_SECONDS=60
```

## API Documentation

### POST `/api/generate-policy`

Generates a compliance policy based on questionnaire data.

#### Request Body

```typescript
{
  questionnaireData: PrivacyQuestionnaire | AIUsageQuestionnaire | AIGovernanceQuestionnaire;
  policyType: "privacy_policy" | "ai_usage_policy" | "ai_governance_policy";
  qualityTier?: "standard" | "premium"; // Default: "standard"
  model?: string; // Optional override
}
```

#### Response

```typescript
{
  content: string; // Generated policy markdown
  metadata: PolicyMetadata; // Structured metadata
  generationMetadata: {
    attempts: GenerationAttempt[];
    totalTokens: number;
    estimatedCost: number;
    qualityScore: number;
  };
}
```

#### Example Request

```bash
curl -X POST http://localhost:3000/api/generate-policy \
  -H "Content-Type: application/json" \
  -d '{
    "questionnaireData": {
      "company_name": "Example Corp",
      "jurisdictions": ["GDPR (EU)"],
      "data_collected": ["Email", "Name"],
      "purpose_of_processing": "Providing services",
      "third_parties": "Yes",
      "cookies_used": "Yes",
      "data_retention": "1 year",
      "dpo_contact": "dpo@example.com"
    },
    "policyType": "privacy_policy",
    "qualityTier": "standard"
  }'
```

#### Error Responses

- `400 Bad Request`: Invalid questionnaire data or missing required fields
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: OpenAI API error or generation failure

## Project Structure

```
ai-policy-gen/
├── app/
│   ├── api/
│   │   └── generate-policy/
│   │       └── route.ts          # Main API endpoint
│   ├── questionnaire/            # Questionnaire pages
│   └── page.tsx                  # Landing page
├── lib/
│   ├── constants.ts              # Centralized constants
│   ├── types.ts                  # TypeScript types and Zod schemas
│   ├── prompts.ts                # Prompt engineering
│   ├── parser.ts                 # Content parsing and validation
│   ├── policycop.ts              # Compliance analysis engine
│   ├── compliance-rules.ts       # Legal framework rules
│   └── rate-limit.ts             # Rate limiting middleware
├── components/                   # React components
├── __tests__/                    # Test files
│   ├── parser.test.ts
│   ├── policycop.test.ts
│   ├── prompts.test.ts
│   ├── compliance-rules.test.ts
│   └── generate-policy.test.ts
└── documentation/                # Project documentation
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test full API flow with mocked OpenAI responses
- **Edge Cases**: Test error handling, malformed responses, and edge cases

### Writing Tests

Tests are located in `__tests__/` directory. Follow these patterns:

```typescript
describe("Module Name", () => {
  it("should do something", () => {
    // Test implementation
  });
});
```

## Troubleshooting

### Common Issues

#### 1. OpenAI API Errors

**Problem**: `OpenAI API key not configured`

**Solution**: Ensure `OPENAI_API_KEY` is set in `.env.local`

**Problem**: `Rate limit exceeded`

**Solution**: 
- Check rate limiting configuration
- Use premium tier for higher limits
- Wait for rate limit window to reset

#### 2. Policy Generation Failures

**Problem**: Low quality scores or generation failures

**Solution**:
- Check questionnaire data completeness
- Review quality validation feedback
- Try premium tier for better quality
- Check OpenAI API status

#### 3. Parsing Errors

**Problem**: `Failed to parse policy output`

**Solution**:
- Check OpenAI response format
- Review parser fallback logic logs
- Ensure METAJSON block is present

#### 4. Rate Limiting Issues

**Problem**: `429 Too Many Requests`

**Solution**:
- Check rate limit configuration
- Review rate limit logs
- Adjust `RATE_LIMIT_*` environment variables

### Debug Mode

Enable debug logging by setting:

```env
DEBUG=true
```

This will log:
- OpenAI API requests/responses
- PolicyCop analysis results
- Parser operations
- Rate limit events

## Contributing

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for exported functions
- Write tests for new features

### Pull Request Process

1. Create a feature branch
2. Make your changes
3. Add/update tests
4. Ensure all tests pass
5. Update documentation if needed
6. Submit pull request

### Code Review Checklist

- [ ] Code follows project conventions
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No linter errors
- [ ] TypeScript types correct

## License

[Add your license here]

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review troubleshooting section

## Acknowledgments

- OpenAI for GPT models
- Supabase for backend infrastructure
- Next.js team for the framework
