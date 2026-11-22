import React, { useState } from 'react';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  displayValue?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}

export const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step = 0.01,
  displayValue,
  onChange,
  onCommit,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const formatted =
    displayValue ??
    (step >= 1 ? Math.round(value).toString() : value.toFixed(step < 0.05 ? 2 : 1));

  const span = Math.max(1e-6, max - min);
  const pct = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  const clampedBubblePct = Math.max(10, Math.min(90, pct));

  const finishDrag = () => {
    setIsDragging(false);
    onCommit?.();
  };

  return (
    <div className="space-y-0.5 md:space-y-1">
      <div className="flex items-center justify-between gap-2 text-[13px] md:text-[12px]">
        <span className="text-[#3C3C48] dark:text-[#B6B6C2] font-medium truncate">{label}</span>
        <span
          className={`font-mono-num text-[12px] md:text-[11px] shrink-0 transition-colors ${
            isDragging
              ? 'text-[#FF5C35] font-semibold'
              : 'text-[#6B6B7A] dark:text-[#7D7D8C]'
          }`}
        >
          {formatted}
        </span>
      </div>
      <div className="relative flex items-center">
        {/* Live floating thumb value bubble visible while dragging on mobile */}
        {isDragging && (
          <div
            aria-hidden="true"
            style={{ left: `${clampedBubblePct}%` }}
            className="md:hidden pointer-events-none absolute -top-7 -translate-x-1/2 z-10 px-2 py-0.5 rounded-md bg-[#14141A] dark:bg-[#F4F4F6] text-white dark:text-[#14141A] font-mono-num text-[11px] font-medium shadow-md whitespace-nowrap"
          >
            {formatted}
          </div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onBlur={() => setIsDragging(false)}
          onTouchMove={(e) => e.stopPropagation()}
          onKeyUp={onCommit}
          aria-label={label}
          className="studio-slider"
        />
      </div>
    </div>
  );
};

interface ColorControlProps {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}

export const ColorControl: React.FC<ColorControlProps> = ({ label, value, onChange }) => {
  return (
    <label className="flex items-center justify-between gap-3 min-h-[44px] md:min-h-0 py-1 cursor-pointer group active:opacity-80 md:active:opacity-100 transition-opacity">
      <span className="text-[13px] md:text-[12px] text-[#3C3C48] dark:text-[#B6B6C2] font-medium truncate">
        {label}
      </span>
      <span className="flex items-center gap-2.5 md:gap-2 shrink-0">
        <span className="font-mono-num text-[12px] md:text-[11px] text-[#6B6B7A] dark:text-[#7D7D8C] md:group-hover:text-[#14141A] md:dark:group-hover:text-[#D4D4DC] transition-colors">
          {value.toUpperCase()}
        </span>
        <span
          className="relative w-9 h-9 md:w-6 md:h-6 rounded-lg md:rounded-md border border-black/15 dark:border-white/15 overflow-hidden shrink-0 transition-transform duration-150 active:scale-95 md:group-hover:scale-105"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </span>
      </span>
    </label>
  );
};

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label?: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  columns?: number;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
}: SegmentedControlProps<T>) {
  const gridCols =
    columns === 2
      ? 'grid-cols-2'
      : columns === 3
        ? 'grid-cols-3'
        : columns === 4
          ? 'grid-cols-4'
          : columns === 5
            ? 'grid-cols-5'
            : 'flex';

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="text-[13px] md:text-[12px] text-[#3C3C48] dark:text-[#B6B6C2] font-medium">
          {label}
        </div>
      )}
      <div
        className={`${columns ? `grid ${gridCols}` : 'flex'} gap-1 p-1 rounded-lg bg-[#EAEBF0] dark:bg-[#0A0A0C] border border-black/[0.06] dark:border-white/[0.06]`}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`min-h-[44px] md:min-h-0 px-2 py-2 md:py-1.5 text-[12px] md:text-[11.5px] font-medium rounded-md transition-all duration-150 whitespace-nowrap truncate cursor-pointer active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                columns ? '' : 'flex-1'
              } ${
                active
                  ? 'bg-white dark:bg-[#222229] text-[#14141A] dark:text-[#F4F4F6] shadow-xs dark:shadow-none'
                  : 'text-[#626272] dark:text-[#848494] md:hover:text-[#14141A] md:dark:hover:text-[#D4D4DE] active:bg-black/[0.05] dark:active:bg-white/[0.06]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface SectionBlockProps {
  title: string;
  children: React.ReactNode;
}

export const SectionBlock: React.FC<SectionBlockProps> = ({ title, children }) => {
  return (
    <section className="py-4 border-b border-black/[0.07] dark:border-white/[0.06] last:border-b-0 space-y-3.5">
      <h3 className="text-[13.5px] md:text-[13px] font-semibold tracking-tight text-[#14141A] dark:text-[#F4F4F6]">
        {title}
      </h3>
      <div className="space-y-3.5 md:space-y-3">{children}</div>
    </section>
  );
};
