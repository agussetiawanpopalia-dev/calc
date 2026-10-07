"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/client";
import { useI18n } from "@/components/i18n-provider";
import { Button, Field, TextInput } from "@/components/ui";
import { AmountKeypad } from "@/components/amount-keypad";
import { Sheet } from "@/components/sheet";

/** Shared "add a general expense" sheet (requirement: home entry point too). */
export function AddExpenseSheet({
  open,
  onClose,
  categories,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: Array<{ id: number; name: string }>;
  defaultDate: string;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [isFood, setIsFood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError(t("exp.formName"));
    if (!amount) return setError(t("exp.formAmount"));
    if (categoryId === "") return setError(t("exp.formCategory"));
    setSaving(true);
    try {
      await api("/api/expenses", {
        method: "POST",
        body: {
          name: name.trim(),
          amount: Number(amount),
          spentOn: date,
          categoryId,
          isFood,
        },
      });
      setName("");
      setAmount("");
      setIsFood(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("exp.add")}>
      <div className="flex flex-col gap-4">
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("exp.formNamePlaceholder")}
          aria-label={t("exp.formName")}
        />
        <AmountKeypad value={amount} onChange={setAmount} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("exp.formDate")}>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label={t("exp.formCategory")} hint={t("exp.formCategoryHint")}>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value === "" ? "" : Number(e.target.value))}>
              <option value="">—</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <button
          type="button"
          onClick={() => setIsFood((value) => !value)}
          className={`press rounded-2xl px-4 py-3 text-left text-[15px] font-medium ${
            isFood
              ? "bg-[color-mix(in_srgb,var(--color-green)_16%,transparent)] text-[var(--color-green)]"
              : "bg-[var(--color-hair)] text-[var(--color-ink-2)]"
          }`}
        >
          {t("exp.formFood")} {isFood ? "✓" : ""}
        </button>
        {error && <p className="text-[14px] text-[var(--color-red)]">{error}</p>}
        <Button full loading={saving} onClick={() => void save()}>
          {t("exp.save")}
        </Button>
      </div>
    </Sheet>
  );
}