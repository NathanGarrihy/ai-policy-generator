import { generatePolicyPreview } from "../app/questionnaire-v2/page";

describe("generatePolicyPreview", () => {
  it("returns a message when no answers are provided", () => {
    expect(generatePolicyPreview({})).toBe("No answers provided.");
  });

  it("includes company name and industry", () => {
    const output = generatePolicyPreview({
      companyName: "Acme Corp",
      industry: "software",
    });
    expect(output).toContain("Acme Corp");
    expect(output).toContain("software");
  });

  it("lists data types", () => {
    const output = generatePolicyPreview({
      dataTypes: ["Email", "Phone"],
    });
    expect(output).toContain("Email, Phone");
  });

  it("handles cookie usage", () => {
    const out1 = generatePolicyPreview({
      useCookies: "no",
    });
    expect(out1.toLowerCase()).toContain("do not use cookies");
    const out2 = generatePolicyPreview({
      useCookies: "yes",
      cookieBanner: "yes",
      trackingTools: "Google Analytics",
    });
    expect(out2).toContain("use cookies");
    expect(out2).toContain("cookie consent banner");
    expect(out2).toContain("Google Analytics");
  });

  it("handles retention period", () => {
    const output = generatePolicyPreview({
      retentionPeriod: "2 years",
    });
    expect(output).toContain("2 years");
  });

  it("handles support rights and DPO", () => {
    const out = generatePolicyPreview({
      supportRights: "gdpr",
      dpo: "John Doe",
    });
    expect(out).toContain("GDPR");
    expect(out).toContain("John Doe");
  });
});
