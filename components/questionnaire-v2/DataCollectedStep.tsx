type Props = {
  answers: Record<string, any>;
  onChange: (key: string, value: any) => void;
};

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
    const selected = new Set(answers.dataTypes || []);
    selected.has(option) ? selected.delete(option) : selected.add(option);
    onChange("dataTypes", Array.from(selected));
  };

  return (
    <div className="space-y-4">
      <label className="block font-semibold">
        What types of personal data do you collect?
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggleOption(opt)}
            className={`px-3 py-1 border rounded-full text-sm ${
              answers.dataTypes?.includes(opt)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
