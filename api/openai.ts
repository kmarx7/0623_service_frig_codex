import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.replace(/[\s\u2028\u2029]+/g, "");

  if (!apiKey) {
    return null;
  }

  return new OpenAI({ apiKey });
}
