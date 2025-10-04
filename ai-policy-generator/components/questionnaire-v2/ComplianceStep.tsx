type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

/**
 * Determine which data protection regulations the organisation complies with.
 * Additional information is required if GDPR applies.
 */
export default function ComplianceStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-medium">
          Do you support GDPR or CCPA data requests?{" "}
          <span
            title="Specify which regulatory frameworks your organisation complies with for data subject requests."
            className="ml-1 text-sm text-gray-500 cursor-help"
          >
            (?)
          </span>
        </span>
        <select
          value={answers.supportRights || ""}
          onChange={(e) => onChange("supportRights", e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        >
          <option value="" disabled>
            Choose one
          </option>
          <option value="gdpr">GDPR</option>
          <option value="ccpa">CCPA</option>
          <option value="both">Both</option>
          <option value="none">None</option>
        </select>
      </label>
      {(answers.supportRights === "gdpr" ||
        answers.supportRights === "both") && (
        <label className="block">
          <span className="font-medium">
            Who is your Data Protection Officer (DPO)?{" "}
            <span
              title="Provide the name or contact of the person responsible for GDPR compliance."
              className="ml-1 text-sm text-gray-500 cursor-help"
            >
              (?)
            </span>
          </span>
          <input
            type="text"
            value={answers.dpo || ""}
            onChange={(e) => onChange("dpo", e.target.value)}
            placeholder="Name or contact email"
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
      )}
    </div>
  );
}
