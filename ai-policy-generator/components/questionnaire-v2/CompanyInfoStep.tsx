type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

/**
 * Collect high level company information.
 *
 * Tooltips provide additional context for each field to aid the user.
 */
export default function CompanyInfoStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-medium">
          Company Name{" "}
          <span
            className="ml-1 text-sm text-gray-500 cursor-help"
            title="The full legal name of your company or organisation."
          >
            (?)
          </span>
        </span>
        <input
          className="mt-1 block w-full border rounded p-2"
          type="text"
          value={answers.companyName || ""}
          onChange={(e) => onChange("companyName", e.target.value)}
        />
      </label>
      <label className="block">
        <span className="font-medium">
          Industry{" "}
          <span
            className="ml-1 text-sm text-gray-500 cursor-help"
            title="Your primary line of business (e.g., healthcare, SaaS, retail)."
          >
            (?)
          </span>
        </span>
        <input
          className="mt-1 block w-full border rounded p-2"
          type="text"
          value={answers.industry || ""}
          onChange={(e) => onChange("industry", e.target.value)}
        />
      </label>
    </div>
  );
}
