"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, useApi } from "@/lib/client";
import type { CategoryKind, Preset, PublicUser } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { Button, Card, Field, Segmented, TextInput } from "@/components/ui";
import { CheckIcon, PlusIcon, TrashIcon } from "@/components/icons";

const KINDS: CategoryKind[] = ["needs", "wants", "savings", "debt", "other"];

type Row = { uid: string; name: string; kind: CategoryKind; percent: string; defaultForFood: boolean };

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultRows = (): Row[] => [
  { uid: uid(), name: "", kind: "needs", percent: "50", defaultForFood: true },
  { uid: uid(), name: "", kind: "wants", percent: "30", defaultForFood: false },
  { uid: uid(), name: "", kind: "savings", percent: "20", defaultForFood: false },
];

function toBp(percent: string): number {
  const value = Number.parseFloat(percent.replace(",", "."));
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export function OnboardingForm({ initialName, initialPhone }: { initialName: string; initialPhone: string }) {
  const { t, locale, setLocale, money } = useI18n();
  const router = useRouter();
  const presets = useApi<{ presets: Preset[] }>("/api/presets");

  const [name, setName] = useState(initialName);
  const [income, setIncome] = useState("");
  const [dailyFoodBudget, setDailyFoodBudget] = useState("");
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  // Nothing picked yet -> the first (most popular) preset is the implicit default.
  const [pickedPresetId, setPickedPresetId] = useState<number | null>(null);
  const presetId = pickedPresetId ?? presets.data?.presets[0]?.id ?? null;
  const [backboneName, setBackboneName] = useState("");
  const [rows, setRows] = useState<Row[]>(defaultRows);
  const [overspendIndex, setOverspendIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalBp = useMemo(() => rows.reduce((sum, row) => sum + toBp(row.percent), 0), [rows]);
  const totalOk = totalBp === 10_000;

  const updateRow = (rowUid: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.uid === rowUid ? { ...row, ...patch } : row)));

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError(t("setup.nameLabel"));

    const parsedIncome = Number(income.replace(/\D/g, "")) || 0;
    const parsedDailyFood = Number(dailyFoodBudget.replace(/\D/g, "")) || 0;

    const backbone =
      mode === "preset"
        ? { presetId: presetId ?? undefined }
        : {
            name: backboneName.trim() || t("setup.customTitle"),
            categories: rows.map((row) => ({
              name: row.name.trim() || t(`kind.${row.kind}`),
              kind: row.kind,
              percentBp: toBp(row.percent),
              defaultForFood: row.defaultForFood,
            })),
            foodOverspendCategoryIndex: overspendIndex ?? undefined,
          };

    if (mode === "custom") {
      if (rows.some((row) => !row.name.trim())) return setError(t("setup.categoryName"));
      if (!totalOk) return setError(`${t("setup.total", { pct: (totalBp / 100).toFixed(totalBp % 100 ? 2 : 0) })} — ${t("setup.totalHint")}`);
      if (overspendIndex === null) return setError(t("setup.overspendTargetHint"));
    } else if (presetId === null) {
      return setError(t("setup.backboneHint"));
    }

    setLoading(true);
    try {
      await api<{ user: PublicUser }>("/api/onboarding", {
        method: "POST",
        body: {
          displayName: name.trim(),
          locale,
          monthlyIncome: parsedIncome,
          dailyFoodBudget: parsedDailyFood,
          backbone,
        },
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-xl px-5 pt-[calc(env(safe-area-inset-top) + 24px)] pb-16">
      <p className="text-[13px] font-semibold tracking-[0.08em] text-[var(--color-accent)] uppercase">
        {t("app.name")}
      </p>
      <h1 className="mt-2 text-[30px] leading-tight font-bold tracking-[-0.02em]">{t("setup.title")}</h1>
      <p className="mt-1 text-[16px] text-[var(--color-ink-2)]">{t("setup.subtitle")}</p>

      {/* 1. profile */}
      <section className="mt-7 flex flex-col gap-4">
        <Field label={t("setup.nameLabel")}>
          <TextInput
            autoFocus
            value={name}
            placeholder={t("setup.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div>
          <span className="mb-1.5 block px-1 text-[15px] font-medium text-[var(--color-ink-2)]">
            {t("setup.language")}
          </span>
          <Segmented
            options={[
              { value: "en", label: "English" },
              { value: "id", label: "Bahasa Indonesia" },
            ]}
            value={locale}
            onChange={(value) => setLocale(value)}
          />
        </div>
      </section>

      {/* 2. numbers */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label={t("setup.income")} hint={t("setup.incomeHint")}>
          <TextInput
            inputMode="numeric"
            placeholder="6000000"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
          />
        </Field>
        <Field label={t("setup.dailyFoodBudget")} hint={t("setup.dailyFoodBudgetHint")}>
          <TextInput
            inputMode="numeric"
            placeholder="40000"
            value={dailyFoodBudget}
            onChange={(e) => setDailyFoodBudget(e.target.value)}
          />
        </Field>
      </section>

      {/* 3. backbone */}
      <section className="mt-8">
        <h2 className="text-[20px] font-bold tracking-[-0.01em]">{t("setup.backboneTitle")}</h2>
        <p className="mt-1 mb-3 text-[15px] text-[var(--color-ink-2)]">{t("setup.backboneHint")}</p>

        <Segmented
          options={[
            { value: "preset", label: t("setup.usePreset") },
            { value: "custom", label: t("setup.buildOwn") },
          ]}
          value={mode}
          onChange={setMode}
        />

        {mode === "preset" ? (
          <div className="mt-4 flex flex-col gap-3">
            {presets.loading && <Card className="h-28 animate-pulse" />}
            {presets.data?.presets.map((preset) => {
              const selected = presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setPickedPresetId(preset.id)}
                  className={`material material-regular rounded-[20px] press w-full p-4 text-left transition ${
                    selected ? "ring-[2.5px] ring-[var(--color-accent)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[17px] font-semibold">{preset.name}</h3>
                    {selected && (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-accent)] text-white">
                        <CheckIcon size={14} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[14px] leading-snug text-[var(--color-ink-2)]">{preset.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {preset.categories.map((category) => (
                      <span
                        key={category.name}
                        className="rounded-full bg-[var(--color-hair)] px-2.5 py-1 text-[12px] font-semibold text-[var(--color-ink-2)]"
                      >
                        {category.name} {category.percentBp / 100}%
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
            <p className="px-1 text-[13px] text-[var(--color-ink-2)]">{t("setup.presetOverspend")}</p>
          </div>
        ) : (
          <Card className="mt-4 p-5">
            <h3 className="mb-3 text-[17px] font-semibold">{t("setup.customTitle")}</h3>

            <div className="flex flex-col gap-3">
              <Field label={t("setup.backboneName")}>
                <TextInput
                  value={backboneName}
                  placeholder={t("setup.backboneNamePlaceholder")}
                  onChange={(e) => setBackboneName(e.target.value)}
                />
              </Field>

              {rows.map((row, index) => (
                <div key={row.uid} className="rounded-2xl bg-[var(--color-canvas)] p-3">
                  <div className="flex items-center gap-2">
                    <TextInput
                      value={row.name}
                      placeholder={t("setup.categoryNamePlaceholder")}
                      className="input min-w-0 flex-1"
                      onChange={(e) => updateRow(row.uid, { name: e.target.value })}
                    />
                    <div className="relative">
                      <select
                        className="input w-[118px] appearance-none pr-7 text-[15px]"
                        value={row.kind}
                        onChange={(e) => updateRow(row.uid, { kind: e.target.value as CategoryKind })}
                      >
                        {KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`kind.${kind}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      inputMode="decimal"
                      className="input w-[74px] text-right"
                      value={row.percent}
                      onChange={(e) => updateRow(row.uid, { percent: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label={t("setup.removeCategory")}
                      className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--color-red)]"
                      onClick={() => setRows((current) => current.filter((r) => r.uid !== row.uid))}
                    >
                      <TrashIcon size={18} />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((current) =>
                          current.map((r) => ({ ...r, defaultForFood: r.uid === row.uid })),
                        )
                      }
                      className={`press rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        row.defaultForFood
                          ? "bg-[var(--color-accent)] text-white"
                          : "bg-[var(--color-hair)] text-[var(--color-ink-2)]"
                      }`}
                    >
                      {t("setup.foodDefault")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverspendIndex(index)}
                      className={`press rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                        overspendIndex === index
                          ? "bg-[var(--color-orange)] text-white"
                          : "bg-[var(--color-hair)] text-[var(--color-ink-2)]"
                      }`}
                    >
                      {t("setup.overspendTarget")}
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="press flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--color-hair)] py-3 text-[15px] font-semibold text-[var(--color-accent)]"
                onClick={() =>
                  setRows((current) => [
                    ...current,
                    { uid: uid(), name: "", kind: "other", percent: "", defaultForFood: false },
                  ])
                }
              >
                <PlusIcon size={17} /> {t("setup.addCategory")}
              </button>

              <div
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-[14px] font-semibold ${
                  totalOk
                    ? "bg-[color-mix(in_srgb,var(--color-green)_14%,transparent)] text-[var(--color-green)]"
                    : "bg-[color-mix(in_srgb,var(--color-orange)_16%,transparent)] text-[#b26a00]"
                }`}
              >
                <span>
                  {t("setup.total", { pct: (totalBp / 100).toFixed(totalBp % 100 ? 2 : 0) })}
                </span>
                <span>{totalOk ? `✓ ${t("setup.totalOk")}` : t("setup.totalHint")}</span>
              </div>

              <Field label={t("setup.overspendTarget")} hint={t("setup.overspendTargetHint")}>
                <select
                  className="input"
                  value={overspendIndex ?? ""}
                  onChange={(e) => setOverspendIndex(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="" disabled>
                    —
                  </option>
                  {rows.map((row, index) => (
                    <option key={row.uid} value={index}>
                      {row.name.trim() || `#${index + 1} ${t(`kind.${row.kind}`)}`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
        )}
      </section>

      {error && <p className="mt-4 text-[14px] text-[var(--color-red)]">{error}</p>}

      <div className="mt-6">
        <Button full loading={loading} onClick={() => void submit()}>
          {loading ? t("setup.creating") : t("setup.create")}
        </Button>
        <p className="mt-3 text-center text-[13px] text-[var(--color-ink-3)]">
          {initialPhone} · {income ? money(Number(income.replace(/\D/g, "")) || 0) : t("setup.income")}
        </p>
      </div>
    </main>
  );
}
