import React from 'react';

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
  const formatted =
    displayValue ??
    (step >= 1 ? Math.round(value).toString() : value.toFixed(step < 0.05 ? 2 : 1));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-[#3C3C48] dark:text-[#B6B6C2] font-medium truncate">{label}</span>
        <span className="font-mono-num text-[11px] text-[#6B6B7A] dark:text-[#7D7D8C] shrink-0">
          {formatted}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        aria-label={label}
        className="studio-slider"
      />
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
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-[#3C3C48] dark:text-[#B6B6C2] font-medium truncate">
        {label}
      </span>
      <label className="flex items-center gap-2 cursor-pointer group shrink-0">
        <span className="font-mono-num text-[11px] text-[#6B6B7A] dark:text-[#7D7D8C] group-hover:text-[#14141A] dark:group-hover:text-[#D4D4DC] transition-colors">
          {value.toUpperCase()}
        </span>
        <span
          className="relative w-6 h-6 rounded-md border border-black/15 dark:border-white/15 overflow-hidden shrink-0 transition-transform duration-150 group-hover:scale-105"
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
      </label>
    </div>
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
        <div className="text-[12px] text-[#3C3C48] dark:text-[#B6B6C2] font-medium">{label}</div>
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
              className={`px-2 py-1.5 text-[11.5px] font-medium rounded-md transition-colors duration-150 whitespace-nowrap truncate cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF5C35] ${
                columns ? '' : 'flex-1'
              } ${
                active
                  ? 'bg-white dark:bg-[#222229] text-[#14141A] dark:text-[#F4F4F6] shadow-xs dark:shadow-none'
                  : 'text-[#626272] dark:text-[#848494] hover:text-[#14141A] dark:hover:text-[#D4D4DE]'
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
      <h3 className="text-[13px] font-semibold tracking-tight text-[#14141A] dark:text-[#F4F4F6]">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
};
