import { useState } from "react";
import { ScoutingConfig, EntryData, getDefaultData, FieldValue } from "../../lib/configTypes";
import FieldRenderer from "./FieldRenderer";
import Button from "../ui/Button";

interface Props {
  config: ScoutingConfig;
  formType: "match" | "pit";
  initialData?: EntryData;
  onSubmit: (data: EntryData) => Promise<void>;
  submitLabel?: string;
  sectionExtras?: Record<string, React.ReactNode>;
}

export default function DynamicScoutingForm({
  config,
  formType,
  initialData,
  onSubmit,
  submitLabel = "Submit",
  sectionExtras,
}: Props) {
  const fields = formType === "match" ? config.matchFields : config.pitFields;
  const sections = formType === "match" ? config.matchSections : config.pitSections;

  const [activeSection, setActiveSection] = useState(sections[0]);
  const [data, setData] = useState<EntryData>(initialData ?? getDefaultData(fields));
  const [submitting, setSubmitting] = useState(false);

  const sectionFields = fields.filter((f) => f.section === activeSection);

  function handleChange(fieldId: string, value: FieldValue) {
    setData((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section tabs */}
      <div className="flex overflow-x-auto gap-1 px-4 py-2 bg-slate-900 border-b border-slate-800 scrollbar-hide">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeSection === section
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {section.charAt(0).toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-4">
        {sectionFields.length === 0 && !sectionExtras?.[activeSection] ? (
          <p className="text-slate-500 text-sm py-8 text-center">
            No fields in this section.
          </p>
        ) : (
          <>
            {sectionFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={data[field.id] ?? null}
                onChange={(v) => handleChange(field.id, v)}
              />
            ))}
            {sectionExtras?.[activeSection] && (
              <div className="py-4 border-t border-slate-800 mt-2">
                {sectionExtras[activeSection]}
              </div>
            )}
          </>
        )}
      </div>

      {/* Submit */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
          size="lg"
        >
          {submitting ? "Submitting…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
