type Props = {
  answers: Record<string, any>;
};

export default function ReviewStep({ answers }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Review your answers:</h2>
      <ul className="space-y-2 text-sm">
        {Object.entries(answers).map(([key, val]) => (
          <li key={key}>
            <strong className="capitalize">
              {key.replace(/([A-Z])/g, " $1")}:
            </strong>{" "}
            {Array.isArray(val) ? val.join(", ") : val || <em>Not provided</em>}
          </li>
        ))}
      </ul>
    </div>
  );
}
