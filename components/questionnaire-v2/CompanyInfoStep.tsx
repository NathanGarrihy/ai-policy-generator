type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

export default function CompanyInfoStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block font-semibold">Company Name</label>
        <input
          type="text"
          className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
          value={answers.companyName || ""}
          onChange={(e) => onChange("companyName", e.target.value)}
        />
      </div>
      <div>
        <label className="block font-semibold">Industry</label>
        <input
          type="text"
          className="w-full border border-zinc-300 dark:border-zinc-600 rounded px-3 py-2"
          value={answers.industry || ""}
          onChange={(e) => onChange("industry", e.target.value)}
        />
      </div>
    </div>
  );
}
