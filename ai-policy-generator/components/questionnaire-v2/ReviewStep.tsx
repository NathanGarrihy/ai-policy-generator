import { generatePolicyPreview } from "@/app/questionnaire-v2/page";

type Props = {
  answers: Record<string, any>;
};

/**
 * Display a summary of all answers and a simple policy preview.
 *
 * The preview is generated using the helper exported from the page component.
 * In a future version this could call the backend to produce a polished
 * policy document.
 */
export default function ReviewStep({ answers }: Props) {
  const preview = generatePolicyPreview(answers);
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium">Review your answers:</h2>
      <ul className="space-y-2">
        {Object.entries(answers).map(([key, val]) => (
          <li key={key}>
            <span className="font-semibold">
              {key.replace(/([A-Z])/g, " $1")}:
            </span>{" "}
            {Array.isArray(val)
              ? val.join(", ")
              : val || "Not provided"}
          </li>
        ))}
      </ul>
      <h3 className="text-lg font-medium mt-4">Policy Preview</h3>
      <p className="border p-3 rounded bg-gray-50 whitespace-pre-wrap">
        {preview}
      </p>
      <p className="text-sm text-gray-500">
        This preview is a basic summary. The final policy will include
        more detail.
      </p>
    </div>
  );
}
