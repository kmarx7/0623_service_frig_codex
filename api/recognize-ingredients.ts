import { getOpenAIClient } from "./openai";

const ingredientSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ingredients: {
      type: "array",
      minItems: 0,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "Korean ingredient name only, without brand names.",
          },
          confidence: {
            type: "string",
            enum: ["high", "low"],
          },
        },
        required: ["name", "confidence"],
      },
    },
  },
  required: ["ingredients"],
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const client = getOpenAIClient();

  if (!client) {
    return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  const { imageDataUrl } = req.body ?? {};
  if (!imageDataUrl || typeof imageDataUrl !== "string") {
    return res.status(400).json({ error: "imageDataUrl is required" });
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "사진 속 식재료를 한국어 재료명으로만 추출하세요. 냉장고, 포장재, 그릇, 브랜드명은 제외하세요. 확실하지 않은 항목은 confidence를 low로 표시하세요.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "low",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recognized_ingredients",
          schema: ingredientSchema,
          strict: true,
        },
      },
    });

    return res.status(200).json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to recognize ingredients" });
  }
}
