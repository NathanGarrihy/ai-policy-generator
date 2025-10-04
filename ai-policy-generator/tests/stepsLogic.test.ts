import { BASE_STEPS } from "../app/questionnaire-v2/page";

function computeSteps(answers: Record<string, any>) {
  if (answers.useCookies === "no") {
    return BASE_STEPS.filter((step) => step.id !== "cookies");
  }
  return [...BASE_STEPS];
}

describe("dynamic step logic", () => {
  it("skips cookies step when useCookies is no", () => {
    const steps = computeSteps({ useCookies: "no" });
    const ids = steps.map((s) => s.id);
    expect(ids.includes("cookies")).toBe(false);
  });

  it("includes cookies step otherwise", () => {
    const steps = computeSteps({});
    const ids = steps.map((s) => s.id);
    expect(ids).toContain("cookies");
  });
});
