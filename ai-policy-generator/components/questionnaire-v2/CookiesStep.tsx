type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

/**
 * Gather information about the use of cookies and tracking technologies.
 * Subsequent questions appear only when cookies are used.
 */
export default function CookiesStep({ answers, onChange }: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="font-medium">
          Do you use cookies or tracking technologies?{" "}
          <span
            title="Cookies and similar technologies store information on a user's device to track their interactions."
            className="ml-1 text-sm text-gray-500 cursor-help"
          >
            (?)
          </span>
        </span>
        <select
          value={answers.useCookies || ""}
          onChange={(e) => onChange("useCookies", e.target.value)}
          className="mt-1 block w-full border rounded p-2"
        >
          <option value="" disabled>
            Select an option
          </option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </label>
      {answers.useCookies === "yes" && (
        <>
          <label className="block">
            <span className="font-medium">
              Do you display a cookie consent banner?{" "}
              <span
                title="A banner that informs users about cookie usage and allows them to consent."
                className="ml-1 text-sm text-gray-500 cursor-help"
              >
                (?)
              </span>
            </span>
            <select
              value={answers.cookieBanner || ""}
              onChange={(e) => onChange("cookieBanner", e.target.value)}
              className="mt-1 block w-full border rounded p-2"
            >
              <option value="" disabled>
                Select one
              </option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium">
              Which tools do you use?{" "}
              <span
                title="List any analytics or advertising platforms you use to track user behaviour (e.g., Google Analytics, Mixpanel)."
                className="ml-1 text-sm text-gray-500 cursor-help"
              >
                (?)
              </span>
            </span>
            <input
              type="text"
              value={answers.trackingTools || ""}
              onChange={(e) => onChange("trackingTools", e.target.value)}
              placeholder="e.g., Google Analytics, Mixpanel"
              className="mt-1 block w-full border rounded p-2"
            />
          </label>
        </>
      )}
    </div>
  );
}
