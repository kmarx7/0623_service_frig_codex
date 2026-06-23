import { getOpenAIClient } from "./openai";

const recipeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    recipes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          minutes: { type: "number" },
          difficulty: { type: "string", enum: ["쉬움", "보통"] },
          tool: { type: "string", enum: ["프라이팬", "냄비", "전자레인지"] },
          ingredients: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: { type: "string" },
          },
          optional: {
            type: "array",
            maxItems: 5,
            items: { type: "string" },
          },
          missing: {
            type: "array",
            maxItems: 4,
            items: { type: "string" },
          },
          steps: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: { type: "string" },
          },
          reason: { type: "string" },
          substitutes: {
            type: "object",
            additionalProperties: {
              type: "array",
              maxItems: 3,
              items: { type: "string" },
            },
          },
        },
        required: ["id", "title", "minutes", "difficulty", "tool", "ingredients", "optional", "missing", "steps", "reason", "substitutes"],
      },
    },
  },
  required: ["recipes"],
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

  const { ingredients, urgent } = req.body ?? {};
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: "ingredients is required" });
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "당신은 한국 집밥 MVP 웹앱의 레시피 추천 엔진입니다. 사용자가 가진 재료를 최우선으로 쓰고, 1인분 기준, 15분 이내, 5단계 이하의 현실적인 간단식을 추천하세요. 부족 재료가 있으면 최소화하고 대체 재료를 제안하세요.",
        },
        {
          role: "user",
          content: JSON.stringify({
            availableIngredients: ingredients,
            useFirstIngredients: Array.isArray(urgent) ? urgent : [],
            constraints: {
              servings: 1,
              maxMinutes: 15,
              maxRecipes: 3,
              allowedTools: ["프라이팬", "냄비", "전자레인지"],
            },
          }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "recipe_recommendations",
          schema: recipeSchema,
          strict: true,
        },
      },
    });

    return res.status(200).json(JSON.parse(response.output_text));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to recommend recipes" });
  }
}
