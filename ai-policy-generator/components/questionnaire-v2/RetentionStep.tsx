type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

/**
 * Ask about data retention period. A free text field allows flexibility.
 */
export default function RetentionStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-medium">
          How long do you retain personal data?{" "}
          <span
            title="Specify the period you keep personal data before deletion or anonymisation."
            className="ml-1 text-sm text-gray-500 cursor-help"
          >
            (?)
          </span>
        </span>
        <input
          type="text"
          value={answers.retentionPeriod || ""}
          onChange={(e) => onChange("retentionPeriod", e.target.value)}
          placeholder="e.g., 1 year, until account deletion, etc."
          className="mt-1 block w-full border rounded p-2"
        />
      </label>
    </div>
  );
}
