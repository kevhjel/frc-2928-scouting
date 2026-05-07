import { ScoutingField, FieldValue } from "../../lib/configTypes";

interface FieldRendererProps {
  field: ScoutingField;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

function Counter({
  value,
  onChange,
  increment = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  increment?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - increment))}
        className="h-10 w-10 rounded-full bg-slate-700 hover:bg-slate-600 text-xl font-bold flex items-center justify-center transition-colors"
      >
        −
      </button>
      <span className="text-2xl font-bold text-slate-100 min-w-[2.5rem] text-center">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + increment)}
        className="h-10 w-10 rounded-full bg-blue-600 hover:bg-blue-500 text-xl font-bold flex items-center justify-center transition-colors"
      >
        +
      </button>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
        value ? "bg-blue-600" : "bg-slate-700"
      }`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
          value ? "translate-x-9" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function RatingStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition-transform hover:scale-110 ${
            star <= value ? "text-yellow-400" : "text-slate-600"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const selected = value ? value.split(",").map((s) => s.trim()).filter(Boolean) : [];

  function toggle(opt: string) {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.join(","));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            selected.includes(opt)
              ? "bg-blue-600 border-blue-500 text-white"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  return (
    <div className="py-3 border-b border-slate-800 last:border-b-0">
      <label className="block text-sm text-slate-400 mb-2">{field.label}</label>
      {field.type === "counter" && (
        <Counter
          value={Number(value) || 0}
          onChange={onChange}
          increment={field.increment ?? 1}
        />
      )}
      {field.type === "boolean" && (
        <Toggle value={Boolean(value)} onChange={onChange} />
      )}
      {field.type === "rating" && (
        <RatingStars value={Number(value) || 1} onChange={onChange} />
      )}
      {field.type === "number" && (
        <input
          type="number"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 w-full focus:outline-none focus:border-blue-500"
        />
      )}
      {field.type === "text" && (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 w-full focus:outline-none focus:border-blue-500 resize-none"
        />
      )}
      {(field.type === "select" || field.type === "multiselect") && field.options && (
        <>
          {field.type === "multiselect" ? (
            <MultiSelect
              options={field.options}
              value={String(value ?? "")}
              onChange={onChange}
            />
          ) : field.options.length <= 4 ? (
            <div className="flex flex-wrap gap-2">
              {field.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChange(opt)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    value === opt
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <select
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 w-full focus:outline-none focus:border-blue-500"
            >
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
}
