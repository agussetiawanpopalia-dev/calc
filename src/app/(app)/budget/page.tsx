"use client";

import { useMemo, useState } from "react";
import { api, ApiError, localToday, useApi } from "@/lib/client";
import type { Backbone, CategoryKind, Overview, Preset } from "@/lib/types";
import { useI18n } from "@/components/i18n-provider";
import { PageHeader } from "@/components/page-header";
import { Button, Card, Chip, EmptyState, Field, ProgressBar, SectionTitle, Spinner, TextInput } from "@/components/ui";
import { PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";

const KINDS: CategoryKind[] = ["needs", "wants", "savings", "debt", "other"];

type EditRow = { id?: number; uid: string; name: string; kind: CategoryKind; percent: string; defaultForFood: boolean };

const uid = () => Math.random().toString(36).slice(2, 9);
const toBp = (percent: string) => {
  const value = Number.parseFloat(percent.replace(",", "."));
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
};

export default function BudgetPage() {
  const { t, money } = useI18n();
  const budget = useApi<{ backbone: Backbone; presets: Preset[] }>("/api/budget");
  const overview = useApi<{ overview: Overview }>(`/api/overview?date=${localToday()}`);

  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [backboneName, setBackboneName] = useState("");
  const [overspendIndex, setOverspendIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  const backbone = budget.data?.backbone;
  const categories = overview.data?.overview.categories ?? [];

  const startEditing = () => {
    if (!backbone) return;
    setBackboneName(backbone.name);
    setRows(
      backbone.categories.map((category) => ({
        id: category.id,
        uid: uid(),
        name: category.name,
        kind: category.kind,
        percent: String(category.percentBp / 100),
        defaultForFood: category.defaultForFood,
      })),
    );
    const index = backbone.categories.findIndex((category) => category.id === backbone.foodOverspendCategoryId);
    setOverspendIndex(index >= 0 ? index : null);
    setError(null);
    setEditing(true);
  };

  const totalBp = useMemo(() => rows.reduce((sum, row) => sum + toBp(row.percent), 0), [rows]);
  const totalOk = totalBp === 10_000;

  const save = async () => {
    setError(null);
    if (rows.some((row) => !row.name.trim())) return setError(t("setup.categoryName"));
    if (!totalOk) {
      return setError(`${t("budget.total", { pct: (totalBp / 100).toFixed(totalBp % 100 ? 2 : 0) })} — ${t("setup.totalHint")}`);
    }
    if (overspendIndex === null) return setError(t("setup.overspendTargetHint"));

    setSaving(true);
    try {
      await api("/api/budget", {
        method: "PUT",
        body: {
          name: backboneName.trim() || backbone?.name,
          categories: rows.map((row) => ({
            id: row.id,
            name: row.name.trim(),
            kind: row.kind,
            percentBp: toBp(row.percent),
            defaultForFood: row.defaultForFood,
          })),
          foodOverspendCategoryIndex: overspendIndex,
        },
      });
      setEditing(false);
      budget.refetch();
      overview.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const switchPreset = async (presetId: number) => {
    if (!window.confirm(t("budget.switchHint"))) return;
    setSwitchingId(presetId);
    try {
      await api("/api/budget/switch", { method: "POST", body: { presetId } });
      setEditing(false);
      budget.refetch();
      overview.refetch();
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setSwitchingId(null);
    }
  };

  if (budget.loading && !backbone) {
    return (
      <>
        <PageHeader title={t("budget.title")} />
        <div className="flex justify-center py-16 text-[var(--color-ink-2)]">
          <Spinner className="h-6 w-6" />
        </div>
      </>
    );
  }

  if (!backbone) {
    return (
      <>
        <PageHeader title={t("budget.title")} />
        <EmptyState title={budget.error ?? t("common.error")} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("budget.title")}
        subtitle={backbone.name}
        right={
          <button
            type="button"
            aria-label={editing ? t("budget.cancelEdit") : t("budget.edit")}
            onClick={() => (editing ? setEditing(false) : startEditing())}
            className="press flex items-center gap-1.5 rounded-full bg-[var(--color-hair)] px-3.5 py-2 text-[14px] font-semibold text-[var(--color-ink)]"
          >
            {editing ? t("budget.cancelEdit") : <PencilIcon size={16} />}
          </button>
        }
      />

      {!editing ? (
        <div className="flex flex-col gap-4">
          {/* financial view */}
          <Card className="divide-y divide-[var(--color-hair)]">
            {categories.map((category) => {
              const pct = category.allocated > 0 ? category.spent / category.allocated : 0;
              return (
                <div key={category.id} className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-[16px] font-medium">{category.name}</span>
                      <span className="text-[13px] font-semibold text-[var(--color-ink-3)]">
                        {category.percentBp / 100}%
                      </span>
                      <Chip>{t(`kind.${category.kind}`)}</Chip>
                      {category.defaultForFood && <Chip tone="green">{t("budget.defaultFood")}</Chip>}
                      {category.isOverspendTarget && <Chip tone="orange">{t("budget.overspendTarget")}</Chip>}
                    </div>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums">
                      {money(category.remaining)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={pct} tone={pct > 1 ? "red" : pct > 0.9 ? "orange" : "accent"} />
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-[var(--color-ink-2)] tabular-nums">
                    {t("budget.allocated")} {money(category.allocated)} · {t("budget.spent")}{" "}
                    {money(category.spent)}
                  </p>
                </div>
              );
            })}
          </Card>

          {/* presets */}
          <section>
            <SectionTitle>{t("budget.switchTitle")}</SectionTitle>
            <p className="mb-3 px-1 text-[14px] text-[var(--color-ink-2)]">{t("budget.switchHint")}</p>
            <div className="flex flex-col gap-3">
              {(budget.data?.presets ?? []).map((preset) => (
                <Card key={preset.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[16px] font-semibold">{preset.name}</h3>
                      <p className="mt-0.5 text-[13.5px] leading-snug text-[var(--color-ink-2)]">
                        {preset.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {preset.categories.map((category) => (
                          <span
                            key={category.name}
                            className="rounded-full bg-[var(--color-hair)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--color-ink-2)]"
                          >
                            {category.name} {category.percentBp / 100}%
                          </span>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      loading={switchingId === preset.id}
                      onClick={() => void switchPreset(preset.id)}
                      className="min-h-[40px] px-4 text-[15px]"
                    >
                      {t("budget.switch")}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </div>
      ) : (
        /* ------------------------------ edit mode ------------------------------ */
        <Card className="p-4">
          <h3 className="mb-3 text-[17px] font-semibold">{backbone.name}</h3>
          <div className="flex flex-col gap-3">
            <Field label={t("setup.backboneName")}>
              <TextInput value={backboneName} onChange={(e) => setBackboneName(e.target.value)} />
            </Field>

            {rows.map((row, index) => (
              <div key={row.uid} className="rounded-2xl bg-[var(--color-canvas)] p-3">
                <div className="flex items-center gap-2">
                  <TextInput
                    value={row.name}
                    className="input min-w-0 flex-1"
                    placeholder={t("setup.categoryNamePlaceholder")}
                    onChange={(e) =>
                      setRows((current) => current.map((r) => (r.uid === row.uid ? { ...r, name: e.target.value } : r)))
                    }
                  />
                  <select
                    className="input w-[118px] appearance-none pr-7 text-[15px]"
                    value={row.kind}
                    onChange={(e) =>
                      setRows((current) =>
                        current.map((r) => (r.uid === row.uid ? { ...r, kind: e.target.value as CategoryKind } : r)),
                      )
                    }
                  >
                    {KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {t(`kind.${kind}`)}
                      </option>
                    ))}
                  </select>
                  <input
                    inputMode="decimal"
                    className="input w-[74px] text-right"
                    value={row.percent}
                    onChange={(e) =>
                      setRows((current) =>
                        current.map((r) => (r.uid === row.uid ? { ...r, percent: e.target.value } : r)),
                      )
                    }
                  />
                  <button
                    type="button"
                    aria-label={t("setup.removeCategory")}
                    disabled={rows.length <= 1}
                    onClick={() => {
                      setRows((current) => current.filter((r) => r.uid !== row.uid));
                      setOverspendIndex((current) => (current === index ? null : current !== null && current > index ? current - 1 : current));
                    }}
                    className="press grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--color-red)] disabled:opacity-30"
                  >
                    <TrashIcon size={18} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((current) => current.map((r) => ({ ...r, defaultForFood: r.uid === row.uid })))
                    }
                    className={`press rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                      row.defaultForFood
                        ? "bg-[var(--color-accent)] text-white"
                        : "bg-[var(--color-hair)] text-[var(--color-ink-2)]"
                    }`}
                  >
                    {t("budget.defaultFood")}
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
                    {t("budget.overspendTarget")}
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
              <PlusIcon size={17} /> {t("budget.addCategory")}
            </button>

            <div
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-[14px] font-semibold ${
                totalOk
                  ? "bg-[color-mix(in_srgb,var(--color-green)_14%,transparent)] text-[var(--color-green)]"
                  : "bg-[color-mix(in_srgb,var(--color-orange)_16%,transparent)] text-[#b26a00]"
              }`}
            >
              <span>{t("budget.total", { pct: (totalBp / 100).toFixed(totalBp % 100 ? 2 : 0) })}</span>
              <span>{totalOk ? `✓ ${t("setup.totalOk")}` : t("setup.totalHint")}</span>
            </div>

            <Field label={t("budget.overspendTarget")} hint={t("setup.overspendTargetHint")}>
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

            {error && <p className="text-[14px] text-[var(--color-red)]">{error}</p>}

            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setEditing(false)}>
                {t("common.cancel")}
              </Button>
              <Button className="flex-1.5" loading={saving} onClick={() => void save()}>
                {saving ? t("common.saving") : t("budget.saveRules")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
