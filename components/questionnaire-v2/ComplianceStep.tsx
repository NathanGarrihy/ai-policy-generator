type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

export default function ComplianceStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block font-semibold">
        Do you support GDPR or CCPA data requests?
      </label>
      <select
        className="w-full border rounded px-3 py-2"
        value={answers.supportRights || ""}
        onChange={(e) => onChange("supportRights", e.target.value)}
      >
        <option value="">Choose one</option>
        <option value="gdpr">GDPR</option>
        <option value="ccpa">CCPA</option>
        <option value="both">Both</option>
        <option value="none">None</option>
      </select>

      {(answers.supportRights === "gdpr" ||
        answers.supportRights === "both") && (
        <div>
          <label className="block font-semibold">
            Who is your Data Protection Officer (DPO)?
          </label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={answers.dpo || ""}
            onChange={(e) => onChange("dpo", e.target.value)}
            placeholder="Name or contact email"
          />
        </div>
      )}
    </div>
  );
}
