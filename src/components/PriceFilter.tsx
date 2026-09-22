import { useState } from "react";
import type { CSSProperties } from "react";

interface PriceFilterProps {
  min: number;
  max: number;
  limit: number;
  onChange: (min: number, max: number) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value) + " ₽";

export default function PriceFilter({
  min,
  max,
  limit,
  onChange,
}: PriceFilterProps) {
  const [minDraft, setMinDraft] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<string | null>(null);

  function commitMin() {
    const parsed = Number(minDraft);
    onChange(
      Math.min(
        max,
        Math.max(0, Number.isFinite(parsed) ? Math.round(parsed) : min),
      ),
      max,
    );
    setMinDraft(null);
  }

  function commitMax() {
    const parsed = Number(maxDraft);
    onChange(
      min,
      Math.max(
        min,
        Math.min(
          limit,
          maxDraft === "" || !Number.isFinite(parsed)
            ? limit
            : Math.round(parsed),
        ),
      ),
    );
    setMaxDraft(null);
  }

  return (
    <fieldset className="filter-section price-filter">
      <legend>Цена, ₽</legend>
      <div className="price-inputs">
        <label>
          <span>от</span>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Минимальная цена"
            min="0"
            max={max}
            value={minDraft ?? min}
            onFocus={() => setMinDraft(String(min))}
            onChange={(event) => setMinDraft(event.target.value)}
            onBlur={commitMin}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        <span className="price-dash">—</span>
        <label>
          <span>до</span>
          <input
            type="number"
            inputMode="numeric"
            aria-label="Максимальная цена"
            min={min}
            max={limit}
            value={maxDraft ?? max}
            onFocus={() => setMaxDraft(String(max))}
            onChange={(event) => setMaxDraft(event.target.value)}
            onBlur={commitMax}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
      </div>
      <input
        type="range"
        className="price-range"
        aria-label="Верхняя граница цены"
        min={min}
        max={limit}
        step="1"
        value={max}
        onChange={(event) => onChange(min, Number(event.target.value))}
        style={
          {
            "--range-progress": `${limit === min ? 100 : ((max - min) / (limit - min)) * 100}%`,
          } as CSSProperties
        }
      />
      <div className="price-range-labels">
        <span>{money(min)}</span>
        <span>{money(limit)}</span>
      </div>
    </fieldset>
  );
}
