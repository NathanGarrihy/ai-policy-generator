import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey)
    return NextResponse.json({ error: "No API key" }, { status: 500 });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    }),
  });

  const data = await response.json();

  const content = data.choices?.[0]?.message?.content;
  return NextResponse.json({ content });
}
