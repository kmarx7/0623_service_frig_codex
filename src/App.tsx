import {
  ArrowLeft,
  Camera,
  Check,
  ChefHat,
  Clock3,
  History,
  Flame,
  ImageUp,
  Minus,
  Plus,
  ShoppingCart,
  Search,
  Sparkles,
  Timer,
  Utensils,
  Wand2,
  X,
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { readFileAsDataUrl, recognizeIngredients, recommendRecipes, type Recommendation } from "./lib/api";
import type { Ingredient, Recipe } from "./types";

type Step = "input" | "review" | "recommendations" | "recipe" | "cook";
type PhotoMode = "camera" | "upload";
type RecipeSubstitutions = Record<string, Record<string, string>>;

const RECENT_INGREDIENTS_KEY = "fridge-menu:recent-ingredients";

const quickIngredients = [
  "계란",
  "김치",
  "두부",
  "양파",
  "대파",
  "밥",
  "참치",
  "우유",
  "버섯",
  "애호박",
  "치즈",
  "고추장",
];

const mockDetected: Ingredient[] = [
  { name: "계란", confidence: "high" },
  { name: "김치", confidence: "high" },
  { name: "두부", confidence: "high" },
  { name: "대파", confidence: "low" },
  { name: "양파", confidence: "low" },
];

const recipes: Recipe[] = [
  {
    id: "kimchi-tofu",
    title: "김치두부볶음",
    minutes: 10,
    difficulty: "쉬움",
    tool: "프라이팬",
    ingredients: ["김치", "두부", "대파"],
    optional: ["간장", "참기름"],
    reason: "두부와 김치를 바로 소진할 수 있어요.",
    substitutes: { 대파: ["양파", "마늘", "쪽파"] },
    steps: [
      "두부는 한입 크기로 자르고 키친타월로 물기를 가볍게 눌러요.",
      "팬에 기름을 두르고 김치를 2분 정도 볶아요.",
      "두부와 대파를 넣고 중불에서 함께 볶아요.",
      "간이 약하면 간장 반 숟갈을 넣어요.",
      "참기름을 살짝 두르고 불을 끄면 완성입니다.",
    ],
  },
  {
    id: "egg-onion-rice",
    title: "계란양파덮밥",
    minutes: 12,
    difficulty: "쉬움",
    tool: "프라이팬",
    ingredients: ["계란", "양파", "밥"],
    optional: ["간장", "설탕"],
    reason: "계란과 양파만으로 든든한 한 끼를 만들 수 있어요.",
    substitutes: { 밥: ["즉석밥", "식빵", "면"] },
    steps: [
      "양파를 얇게 썰고 계란은 가볍게 풀어요.",
      "팬에 양파를 넣고 투명해질 때까지 볶아요.",
      "간장 한 숟갈과 물 세 숟갈을 넣고 끓여요.",
      "계란물을 둘러 반쯤 익힌 뒤 불을 꺼요.",
      "밥 위에 올리면 완성입니다.",
    ],
  },
  {
    id: "tofu-egg",
    title: "두부계란부침",
    minutes: 15,
    difficulty: "쉬움",
    tool: "프라이팬",
    ingredients: ["두부", "계란", "대파"],
    optional: ["소금", "후추"],
    reason: "두부를 먼저 쓰면서 단백질 한 끼로 먹기 좋아요.",
    substitutes: { 대파: ["양파", "부추", "마늘"] },
    steps: [
      "두부를 납작하게 썰고 소금을 아주 조금 뿌려요.",
      "계란을 풀고 다진 대파를 섞어요.",
      "두부에 계란물을 입혀 달군 팬에 올려요.",
      "앞뒤로 노릇하게 2분씩 부쳐요.",
      "후추를 살짝 뿌려 마무리합니다.",
    ],
  },
  {
    id: "mushroom-egg-soup",
    title: "버섯계란국",
    minutes: 13,
    difficulty: "쉬움",
    tool: "냄비",
    ingredients: ["버섯", "계란", "대파"],
    optional: ["국간장", "마늘"],
    reason: "빨리 시드는 버섯을 따뜻한 국으로 처리할 수 있어요.",
    substitutes: { 버섯: ["양파", "애호박"], 대파: ["마늘", "양파"] },
    steps: [
      "버섯은 먹기 좋게 찢고 대파는 송송 썰어요.",
      "냄비에 물을 붓고 버섯을 넣어 끓여요.",
      "국간장으로 간을 맞추고 계란물을 천천히 둘러요.",
      "대파를 넣고 1분 더 끓여요.",
      "불을 끄고 바로 담아냅니다.",
    ],
  },
  {
    id: "kimchi-rice",
    title: "김치참치볶음밥",
    minutes: 14,
    difficulty: "쉬움",
    tool: "프라이팬",
    ingredients: ["김치", "참치", "밥"],
    optional: ["계란", "대파"],
    reason: "김치와 밥만 있으면 부족 재료가 적은 메뉴예요.",
    substitutes: { 참치: ["계란", "두부", "햄"], 밥: ["즉석밥", "면"] },
    steps: [
      "김치는 잘게 자르고 참치는 기름을 살짝 빼요.",
      "팬에 김치를 먼저 볶아 신맛을 날려요.",
      "참치와 밥을 넣고 골고루 섞어요.",
      "대파나 계란이 있으면 함께 넣어요.",
      "밥알이 고슬해지면 완성입니다.",
    ],
  },
];

function scoreRecipe(recipe: Recipe, owned: string[], urgent: string[]) {
  const missing = recipe.ingredients.filter((item) => !owned.includes(item));
  const urgentHits = recipe.ingredients.filter((item) => urgent.includes(item));
  return urgentHits.length * 12 + (recipe.ingredients.length - missing.length) * 4 - missing.length * 8 - recipe.minutes / 5;
}

function loadRecentIngredients(): Ingredient[] {
  if (typeof window === "undefined") return [];

  try {
    const saved = window.localStorage.getItem(RECENT_INGREDIENTS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as Ingredient[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.name).slice(0, 16) : [];
  } catch {
    return [];
  }
}

function saveRecentIngredients(items: Ingredient[]) {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Map(items.map((item) => [item.name, { ...item, confidence: "high" as const }])).values()).slice(0, 16);
  window.localStorage.setItem(RECENT_INGREDIENTS_KEY, JSON.stringify(unique));
}

function applySubstitutions(recipe: Recipe, replacements: Record<string, string> = {}) {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((item) => replacements[item] ?? item),
    steps: recipe.steps.map((step) =>
      Object.entries(replacements).reduce((text, [from, to]) => text.split(from).join(to), step),
    ),
    reason:
      Object.keys(replacements).length > 0
        ? `${recipe.reason} 대체 재료 ${Object.entries(replacements)
            .map(([from, to]) => `${from}→${to}`)
            .join(", ")}를 반영했어요.`
        : recipe.reason,
  };
}

export function App() {
  const [step, setStep] = useState<Step>("input");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [urgent, setUrgent] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState("kimchi-tofu");
  const [aiRecipes, setAiRecipes] = useState<Recommendation[]>([]);
  const [recentIngredients, setRecentIngredients] = useState<Ingredient[]>(loadRecentIngredients);
  const [recipeSubstitutions, setRecipeSubstitutions] = useState<RecipeSubstitutions>({});
  const [checkedShoppingItems, setCheckedShoppingItems] = useState<string[]>([]);
  const [photoMode, setPhotoMode] = useState<PhotoMode>("camera");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isRecommending, setIsRecommending] = useState(false);
  const [notice, setNotice] = useState("");
  const [cookStep, setCookStep] = useState(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const ownedNames = ingredients.map((item) => item.name);
  const allRecipes = [...aiRecipes.map((item) => item.recipe), ...recipes];
  const selectedRecipeBase = allRecipes.find((recipe) => recipe.id === selectedRecipeId) ?? recipes[0];
  const selectedRecipe = applySubstitutions(selectedRecipeBase, recipeSubstitutions[selectedRecipeBase.id]);

  const fallbackRecipes = useMemo(() => {
    return [...recipes]
      .map((recipe) => ({
        recipe,
        missing: recipe.ingredients.filter((item) => !ownedNames.includes(item)),
        urgentHits: recipe.ingredients.filter((item) => urgent.includes(item)),
        score: scoreRecipe(recipe, ownedNames, urgent),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [ownedNames.join(","), urgent.join(",")]);
  const displayedRecipes = aiRecipes.length > 0 ? aiRecipes : fallbackRecipes;
  const adjustedRecipes = displayedRecipes.map((item) => {
    const replacements = recipeSubstitutions[item.recipe.id] ?? {};
    const adjustedRecipe = applySubstitutions(item.recipe, replacements);
    const adjustedMissing = item.missing.filter((missingItem) => !replacements[missingItem]);

    return {
      ...item,
      recipe: adjustedRecipe,
      missing: adjustedMissing,
      appliedSubstitutions: replacements,
    };
  });
  const shoppingItems = Array.from(new Set(adjustedRecipes.flatMap((item) => item.missing))).filter(Boolean);

  function addIngredient(name: string, confidence: Ingredient["confidence"] = "high") {
    const cleanName = name.trim();
    if (!cleanName || ingredients.some((item) => item.name === cleanName)) return;
    setIngredients((current) => [...current, { name: cleanName, confidence }]);
  }

  function replaceIngredients(nextIngredients: Ingredient[]) {
    setIngredients(nextIngredients);
    setUrgent((current) => current.filter((item) => nextIngredients.some((ingredient) => ingredient.name === item)));
    setAiRecipes([]);
    setRecipeSubstitutions({});
    setCheckedShoppingItems([]);
  }

  function removeIngredient(name: string) {
    setIngredients((current) => current.filter((item) => item.name !== name));
    setUrgent((current) => current.filter((item) => item !== name));
    setAiRecipes([]);
    setRecipeSubstitutions({});
    setCheckedShoppingItems([]);
  }

  function toggleUrgent(name: string) {
    setUrgent((current) => (current.includes(name) ? current.filter((item) => item !== name) : [...current, name]));
  }

  function openSelectedPhotoInput() {
    if (photoMode === "camera") {
      cameraInputRef.current?.click();
      return;
    }

    uploadInputRef.current?.click();
  }

  async function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageUrl(URL.createObjectURL(file));
    setIsRecognizing(true);
    setNotice("");
    setStep("review");
    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const detected = await recognizeIngredients(imageDataUrl);
      setIngredients(detected.length > 0 ? detected : mockDetected);
      if (detected.length === 0) {
        setNotice("사진에서 재료를 찾지 못해 예시 재료를 넣었어요. 직접 수정해 주세요.");
      }
    } catch {
      setIngredients(mockDetected);
      setNotice("AI 인식에 실패해 예시 재료를 넣었어요. 직접 수정한 뒤 추천받을 수 있습니다.");
    } finally {
      setIsRecognizing(false);
      event.target.value = "";
    }
  }

  function addTyped() {
    addIngredient(typed);
    setTyped("");
  }

  function loadRecent() {
    if (recentIngredients.length === 0) return;
    replaceIngredients(recentIngredients);
    setNotice("최근 저장한 재료를 불러왔어요.");
    setStep("review");
  }

  function applySubstitute(recipeId: string, missingItem: string, substitute: string) {
    setRecipeSubstitutions((current) => ({
      ...current,
      [recipeId]: {
        ...(current[recipeId] ?? {}),
        [missingItem]: substitute,
      },
    }));

    setCheckedShoppingItems((current) => current.filter((item) => item !== missingItem));
  }

  function toggleShoppingItem(item: string) {
    setCheckedShoppingItems((current) => (current.includes(item) ? current.filter((name) => name !== item) : [...current, item]));
  }

  async function handleRecommend() {
    setIsRecommending(true);
    setNotice("");
    saveRecentIngredients(ingredients);
    setRecentIngredients(loadRecentIngredients());
    setRecipeSubstitutions({});
    setCheckedShoppingItems([]);
    try {
      const recommendations = await recommendRecipes(ownedNames, urgent);
      setAiRecipes(recommendations);
    } catch {
      setAiRecipes([]);
      setNotice("AI 추천에 실패해 기본 레시피 매칭으로 보여드려요.");
    } finally {
      setIsRecommending(false);
      setStep("recommendations");
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="icon-button" onClick={() => setStep(step === "input" ? "input" : "input")} aria-label="처음으로">
          {step === "input" ? <ChefHat size={21} /> : <ArrowLeft size={21} />}
        </button>
        <div>
          <p className="eyebrow">냉장고 기반 1인분 추천</p>
          <h1>오늘 뭐 해먹지</h1>
        </div>
      </header>

      {step === "input" && (
        <section className="screen input-screen">
          <div className="hero-copy">
            <h2>가진 재료로 바로 만들 수 있는 메뉴만 골라드려요.</h2>
            <p>사진을 올리거나 재료를 몇 개 선택하면 15분 이내 메뉴 3가지를 추천합니다.</p>
          </div>

          <div className="photo-picker">
            <div className="segmented-control" role="tablist" aria-label="사진 입력 방식">
              <button type="button" className={photoMode === "camera" ? "active" : ""} onClick={() => setPhotoMode("camera")}>
                <Camera size={17} />
                사진 찍기
              </button>
              <button type="button" className={photoMode === "upload" ? "active" : ""} onClick={() => setPhotoMode("upload")}>
                <ImageUp size={17} />
                이미지 업로드
              </button>
            </div>

            <input ref={cameraInputRef} className="hidden-file-input" type="file" accept="image/*" capture="environment" onChange={handleImage} />
            <input ref={uploadInputRef} className="hidden-file-input" type="file" accept="image/*" onChange={handleImage} />

            <button type="button" className="photo-action" onClick={openSelectedPhotoInput}>
              <span className={`upload-icon ${photoMode === "upload" ? "secondary" : ""}`}>{photoMode === "camera" ? <Camera size={30} /> : <ImageUp size={27} />}</span>
              <strong>{photoMode === "camera" ? "냉장고 사진 찍기" : "이미지 선택하기"}</strong>
              <small>{photoMode === "camera" ? "휴대폰 카메라로 바로 촬영해서 재료를 인식합니다." : "이미 찍어둔 냉장고나 재료 사진을 업로드합니다."}</small>
            </button>
          </div>

          {recentIngredients.length > 0 && (
            <div className="recent-box">
              <div>
                <strong>
                  <History size={16} />
                  최근 재료
                </strong>
                <p>{recentIngredients.map((item) => item.name).join(", ")}</p>
              </div>
              <button type="button" className="inline-action" onClick={loadRecent}>
                불러오기
              </button>
            </div>
          )}

          <div className="manual-entry">
            <div className="input-wrap">
              <Search size={18} />
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addTyped();
                }}
                placeholder="재료 직접 입력"
              />
            </div>
            <button className="small-action" onClick={addTyped} aria-label="재료 추가">
              <Plus size={18} />
            </button>
          </div>

          <div className="chip-section">
            <div className="section-title">자주 쓰는 재료</div>
            <div className="chip-grid">
              {quickIngredients.map((item) => (
                <button
                  key={item}
                  className={`chip ${ownedNames.includes(item) ? "selected" : ""}`}
                  onClick={() => (ownedNames.includes(item) ? removeIngredient(item) : addIngredient(item))}
                >
                  {ownedNames.includes(item) && <Check size={14} />}
                  {item}
                </button>
              ))}
            </div>
          </div>

          <button className="primary-action" disabled={ingredients.length === 0} onClick={() => setStep("review")}>
            <Sparkles size={19} />
            이 재료로 시작하기
          </button>
        </section>
      )}

      {step === "review" && (
        <section className="screen">
          <ScreenHeading title="인식된 재료를 확인해 주세요" description="잘못 들어간 재료는 지우고, 빠르게 써야 하는 재료를 표시하세요." />

          {imageUrl && (
            <div className="photo-preview">
              <img src={imageUrl} alt="업로드한 냉장고 사진" />
              <span>
                <Camera size={15} /> 사진 1장 분석
              </span>
            </div>
          )}

          {isRecognizing && <div className="notice">사진 속 재료를 인식하고 있어요.</div>}
          {notice && <div className="notice warn">{notice}</div>}

          <div className="ingredient-list">
            {ingredients.map((item) => (
              <button key={item.name} className={`ingredient-pill ${item.confidence === "low" ? "needs-check" : ""}`} onClick={() => removeIngredient(item.name)}>
                {item.name}
                {item.confidence === "low" && <em>확인</em>}
                <X size={15} />
              </button>
            ))}
          </div>

          <div className="manual-entry compact">
            <div className="input-wrap">
              <Plus size={18} />
              <input
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addTyped();
                }}
                placeholder="누락된 재료 추가"
              />
            </div>
            <button className="small-action" onClick={addTyped} aria-label="재료 추가">
              <Plus size={18} />
            </button>
          </div>

          <div className="priority-box">
            <div>
              <strong>먼저 써야 할 재료</strong>
              <p>유통기한이 임박했거나 시들기 쉬운 재료를 선택하세요.</p>
            </div>
            <div className="chip-grid">
              {ingredients.map((item) => (
                <button key={item.name} className={`chip urgent ${urgent.includes(item.name) ? "selected" : ""}`} onClick={() => toggleUrgent(item.name)}>
                  {urgent.includes(item.name) ? <Flame size={14} /> : <Plus size={14} />}
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <button className="primary-action sticky-action" disabled={isRecognizing || ingredients.length === 0 || isRecommending} onClick={handleRecommend}>
            <Utensils size={19} />
            {isRecommending ? "AI가 메뉴 추천 중" : "메뉴 3개 추천받기"}
          </button>
        </section>
      )}

      {step === "recommendations" && (
        <section className="screen">
          <ScreenHeading title="지금 만들기 좋은 메뉴예요" description="부족 재료가 적고, 먼저 써야 할 재료가 포함된 순서로 정렬했습니다." />
          {notice && <div className="notice warn">{notice}</div>}

          {shoppingItems.length > 0 && (
            <div className="shopping-box">
              <div className="section-title with-icon">
                <ShoppingCart size={16} />
                장보기 리스트
              </div>
              <div className="shopping-list">
                {shoppingItems.map((item) => (
                  <button key={item} className={`shopping-item ${checkedShoppingItems.includes(item) ? "checked" : ""}`} onClick={() => toggleShoppingItem(item)}>
                    {checkedShoppingItems.includes(item) && <Check size={14} />}
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="result-stack">
            {adjustedRecipes.map(({ recipe, missing, urgentHits, appliedSubstitutions }, index) => (
              <article className="recipe-card" key={recipe.id}>
                <div className="card-rank">{index + 1}</div>
                <div className="card-content">
                  <div className="card-title-row">
                    <h3>{recipe.title}</h3>
                    <span className={missing.length === 0 ? "status good" : "status warn"}>
                      {missing.length === 0 ? "바로 가능" : `${missing.length}개 부족`}
                    </span>
                  </div>
                  <div className="meta-row">
                    <span>
                      <Clock3 size={15} /> {recipe.minutes}분
                    </span>
                    <span>{recipe.difficulty}</span>
                    <span>{recipe.tool}</span>
                  </div>
                  <p className="reason">{urgentHits.length > 0 ? `${urgentHits.join(", ")}를 먼저 쓸 수 있어요.` : recipe.reason}</p>
                  <div className="mini-list">
                    <span>필요: {recipe.ingredients.join(", ")}</span>
                    <span>부족: {missing.length ? missing.join(", ") : "없음"}</span>
                  </div>
                  {missing.length > 0 && (
                    <div className="substitute-panel">
                      <div className="substitute-title">
                        <Wand2 size={14} />
                        대체 재료로 조정
                      </div>
                      {missing.map((item) => (
                        <div className="substitute-row" key={item}>
                          <span>{item}</span>
                          <div>
                            {(recipe.substitutes[item] ?? []).slice(0, 3).map((substitute) => (
                              <button key={substitute} onClick={() => applySubstitute(recipe.id, item, substitute)}>
                                {substitute}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {Object.keys(appliedSubstitutions).length > 0 && (
                    <div className="applied-line">
                      적용됨: {Object.entries(appliedSubstitutions).map(([from, to]) => `${from}→${to}`).join(", ")}
                    </div>
                  )}
                  <button
                    className="secondary-action"
                    onClick={() => {
                      setSelectedRecipeId(recipe.id);
                      setStep("recipe");
                    }}
                  >
                    바로 만들기
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {step === "recipe" && (
        <section className="screen">
          <button className="text-back" onClick={() => setStep("recommendations")}>
            <ArrowLeft size={17} /> 추천으로
          </button>
          <div className="recipe-detail-head">
            <h2>{selectedRecipe.title}</h2>
            <div className="meta-row large">
              <span>
                <Clock3 size={16} /> {selectedRecipe.minutes}분
              </span>
              <span>{selectedRecipe.difficulty}</span>
              <span>{selectedRecipe.tool}</span>
            </div>
          </div>

          <div className="detail-section">
            <h3>필요 재료</h3>
            <div className="ingredient-list compact-list">
              {[...selectedRecipe.ingredients, ...selectedRecipe.optional].map((item) => (
                <span key={item} className={`ingredient-pill static ${selectedRecipe.optional.includes(item) ? "optional" : ""}`}>
                  {item}
                  {selectedRecipe.optional.includes(item) && <em>선택</em>}
                </span>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h3>조리 순서</h3>
            <ol className="step-list">
              {selectedRecipe.steps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <button
            className="primary-action sticky-action"
            onClick={() => {
              setCookStep(0);
              setStep("cook");
            }}
          >
            <Timer size={19} />
            조리 모드 시작
          </button>
        </section>
      )}

      {step === "cook" && (
        <section className="cook-screen">
          <button className="text-back light" onClick={() => setStep("recipe")}>
            <ArrowLeft size={17} /> 레시피로
          </button>
          <div className="cook-progress">
            <span>
              {cookStep + 1} / {selectedRecipe.steps.length}
            </span>
            <div>
              {selectedRecipe.steps.map((item, index) => (
                <i key={item} className={index <= cookStep ? "on" : ""} />
              ))}
            </div>
          </div>
          <div className="cook-card">
            <p>{selectedRecipe.steps[cookStep]}</p>
          </div>
          <div className="timer-strip">
            <Timer size={18} />
            타이머가 필요한 단계에서는 휴대폰 기본 타이머를 바로 켜두세요.
          </div>
          <div className="cook-controls">
            <button className="control-button" disabled={cookStep === 0} onClick={() => setCookStep((current) => Math.max(0, current - 1))}>
              <Minus size={20} />
              이전
            </button>
            <button
              className="control-button next"
              onClick={() => {
                if (cookStep === selectedRecipe.steps.length - 1) {
                  setStep("recommendations");
                  return;
                }
                setCookStep((current) => current + 1);
              }}
            >
              {cookStep === selectedRecipe.steps.length - 1 ? "완성" : "다음"}
              <Plus size={20} />
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function ScreenHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="screen-heading">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
