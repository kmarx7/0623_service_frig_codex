export type Ingredient = {
  name: string;
  confidence?: "high" | "low";
};

export type Recipe = {
  id: string;
  title: string;
  minutes: number;
  difficulty: "쉬움" | "보통";
  tool: "프라이팬" | "냄비" | "전자레인지";
  ingredients: string[];
  optional: string[];
  steps: string[];
  reason: string;
  substitutes: Record<string, string[]>;
  missing?: string[];
};
