/** Client-side types mirroring the API payloads. */

export type CategoryKind = "needs" | "wants" | "savings" | "debt" | "other";

export type PublicUser = {
  id: number;
  phone: string;
  displayName: string | null;
  role: "user" | "admin";
  locale: "en" | "id";
  onboarded: boolean;
  settings: {
    monthlyIncome: number;
    dailyFoodBudget: number;
    currency: string;
  };
};

export type OverviewCategory = {
  id: number;
  name: string;
  kind: CategoryKind;
  percentBp: number;
  defaultForFood: boolean;
  isOverspendTarget: boolean;
  allocated: number;
  spent: number;
  remaining: number;
};

export type FoodSummary = {
  dailyBudget: number;
  /** Month budget = dailyBudget × days in month. 0 only when dailyBudget is unset. */
  budget: number;
  spent: number;
  todaySpent: number;
  /** Unspent allowance carried into today (month-scoped). */
  carry: number;
  /** What today's food can spend: dailyBudget + carry. */
  availableToday: number;
  /** Month over-budget food, re-booked to the overspend target. */
  overspend: number;
  overspendToday: number;
  targetCategoryId: number | null;
  targetCategoryName: string | null;
};

export type RecentTx = {
  id: number;
  name: string;
  amount: number;
  kind: string;
  isFood: boolean;
  spentOn: string;
  categoryId: number;
  categoryName: string;
};

export type Overview = {
  month: string;
  today: string;
  income: number;
  daysInMonth: number;
  daysElapsed: number;
  daysLeft: number;
  totals: { budget: number; spent: number; remaining: number };
  categories: OverviewCategory[];
  food: FoodSummary;
  recent: RecentTx[];
  backbone: { id: number; name: string; foodOverspendCategoryId: number | null };
};

export type FoodEntry = {
  id: number;
  name: string;
  amount: number;
  spentOn: string;
  note: string | null;
  categoryId: number;
  categoryName: string;
};

export type FoodPage = FoodSummary & {
  month: string;
  today: string;
  days: Array<{ date: string; spent: number; available: number; over: number }>;
  entries: FoodEntry[];
  categoryOptions: Array<{ id: number; name: string; isDefault: boolean }>;
};

export type ExpenseItem = {
  id: number;
  name: string;
  amount: number;
  kind: string;
  isFood: boolean;
  spentOn: string;
  note: string | null;
  categoryId: number;
  categoryName: string;
};

export type BackboneCategory = {
  id?: number;
  name: string;
  kind: CategoryKind;
  percentBp: number;
  defaultForFood: boolean;
  sortOrder?: number;
};

export type Backbone = {
  id: number;
  name: string;
  description?: string | null;
  foodOverspendCategoryId: number | null;
  categories: BackboneCategory[];
};

export type Preset = {
  id: number;
  slug: string | null;
  name: string;
  description: string | null;
  categories: Array<{ name: string; kind: CategoryKind; percentBp: number }>;
};
