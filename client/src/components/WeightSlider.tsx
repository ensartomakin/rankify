import { CRITERION_LABELS, type CriterionKey } from '../types';

interface Props {
  index: number;
  criterionKey: CriterionKey;
  weight: number;
  usedKeys: CriterionKey[];
  onKeyChange: (index: number, key: CriterionKey) => void;
  onWeightChange: (index: number, weight: number) => void;
}

const ALL_KEYS: CriterionKey[] = [
  'newness', 'bestSeller', 'reviewScore', 'stockScore', 'availabilityScore',
];

export function WeightSlider({ index, criterionKey, weight, usedKeys, onKeyChange, onWeightChange }: Props) {
  const availableKeys = ALL_KEYS.filter(k => k === criterionKey || !usedKeys.includes(k));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <select
          value={criterionKey}
          onChange={e => onKeyChange(index, e.target.value as CriterionKey)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400"
        >
          {availableKeys.map(k => (
            <option key={k} value={k}>{CRITERION_LABELS[k]}</option>
          ))}
        </select>

        <span className="text-2xl font-bold text-violet-600 w-16 text-right tabular-nums">
          %{weight}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={weight}
        onChange={e => onWeightChange(index, Number(e.target.value))}
        className="w-full accent-violet-500 cursor-pointer"
      />

      <div className="w-full bg-slate-100 rounded-full h-2">
        <div
          className="bg-violet-500 h-2 rounded-full transition-all duration-200"
          style={{ width: `${weight}%` }}
        />
      </div>
    </div>
  );
}
