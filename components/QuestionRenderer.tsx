"use client";

import { useState } from "react";

type QuestionProps = {
  question: any;
  value: any;
  onChange: (value: any) => void;
};

export function QuestionRenderer({ question, value, onChange }: QuestionProps) {
  if (question.type === "text") {
    return (
      <input
        type="text"
        className="border rounded p-2 w-full"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.label}
      />
    );
  }

  if (question.type === "dropdown") {
    return (
      <select
        className="w-full bg-white dark:bg-zinc-800 text-black dark:text-white border border-zinc-300 dark:border-zinc-600 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select an option...
        </option>
        {question.options.map((opt: string) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (question.type === "multi-select") {
    return (
      <div className="flex flex-col gap-1">
        {question.options.map((opt: string) => (
          <label key={opt} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value?.includes(opt) || false}
              onChange={(e) => {
                const newValue = value ? [...value] : [];
                if (e.target.checked) {
                  newValue.push(opt);
                } else {
                  const index = newValue.indexOf(opt);
                  if (index > -1) newValue.splice(index, 1);
                }
                onChange(newValue);
              }}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "yes-no") {
    return (
      <div className="flex gap-4">
        {["Yes", "No"].map((opt) => (
          <label key={opt} className="flex items-center gap-2">
            <input
              type="radio"
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            {opt}
          </label>
        ))}
      </div>
    );
  }

  return null;
}
