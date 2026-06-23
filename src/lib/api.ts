import type { Ingredient, Recipe } from "../types";

export type Recommendation = {
  recipe: Recipe;
  missing: string[];
  urgentHits: string[];
};

async function requestJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function recognizeIngredients(imageDataUrl: string): Promise<Ingredient[]> {
  const data = await requestJson<{ ingredients: Ingredient[] }>("/api/recognize-ingredients", { imageDataUrl });
  return data.ingredients;
}

export async function recommendRecipes(ingredients: string[], urgent: string[]): Promise<Recommendation[]> {
  const data = await requestJson<{ recipes: Array<Recipe & { missing: string[] }> }>("/api/recommend-recipes", {
    ingredients,
    urgent,
  });

  return data.recipes.map((recipe) => ({
    recipe,
    missing: recipe.missing,
    urgentHits: recipe.ingredients.filter((item) => urgent.includes(item)),
  }));
}
