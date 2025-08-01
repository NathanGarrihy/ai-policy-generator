type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

export default function CookiesStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block font-semibold">
        Do you use cookies or tracking technologies?
      </label>
      <select
        className="w-full border rounded px-3 py-2"
        value={answers.useCookies || ""}
        onChange={(e) => onChange("useCookies", e.target.value)}
      >
        <option value="">Select an option</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>

      {answers.useCookies === "yes" && (
        <>
          <label className="block font-semibold">
            Do you display a cookie consent banner?
          </label>
          <select
            className="w-full border rounded px-3 py-2"
            value={answers.cookieBanner || ""}
            onChange={(e) => onChange("cookieBanner", e.target.value)}
          >
            <option value="">Select one</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>

          <label className="block font-semibold">Which tools do you use?</label>
          <input
            type="text"
            placeholder="e.g., Google Analytics, Hotjar"
            className="w-full border rounded px-3 py-2"
            value={answers.trackingTools || ""}
            onChange={(e) => onChange("trackingTools", e.target.value)}
          />
        </>
      )}
    </div>
  );
}
