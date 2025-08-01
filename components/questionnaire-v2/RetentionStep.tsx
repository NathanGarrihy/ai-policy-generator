type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

export default function RetentionStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block font-semibold">
        How long do you retain personal data?
      </label>
      <input
        type="text"
        className="w-full border rounded px-3 py-2"
        value={answers.retentionPeriod || ""}
        onChange={(e) => onChange("retentionPeriod", e.target.value)}
        placeholder="e.g., 1 year, until account deletion, etc."
      />
    </div>
  );
}
