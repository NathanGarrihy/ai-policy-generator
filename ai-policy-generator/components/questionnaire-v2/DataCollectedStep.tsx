type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

/**
 * Allow the user to select multiple categories of personal data they collect.
 * Chips can be toggled on and off. A tooltip explains the question context.
 */
export default function DataCollectedStep({ answers, onChange }: Props) {
  const options = [
    "Email address",
    "Full name",
    "Phone number",
    "Payment info",
    "Health data",
    "Browsing behavior",
  ];

  const toggleOption = (option: string) => {
    const selected = new Set<string>(answers.dataTypes || []);
    selected.has(option) ? selected.delete(option) : selected.add(option);
    onChange("dataTypes", Array.from(selected));
  };

  return (
    <div className="space-y-4">
      <div className="font-medium">
        What types of personal data do you collect?{" "}
        <span
          title="Select all categories of personal information your organisation gathers from users."
          className="ml-1 text-sm text-gray-500 cursor-help"
        >
          (?)
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = (answers.dataTypes || []).includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggleOption(opt)}
              className={`px-3 py-1 border rounded-full text-sm ${
                selected
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
