export type FieldType =
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "text"
  | "counter"
  | "rating";

export interface ScoutingField {
  id: string;
  label: string;
  type: FieldType;
  options?: string[];
  section: string;
  defaultValue?: string | number | boolean;
  aggregatable: boolean;
  higherIsBetter?: boolean;
  required?: boolean;
  increment?: number;
  conditionalOnField?: string;
}

export interface ScoutingConfig {
  year: number;
  name: string;
  matchSections: string[];
  pitSections: string[];
  matchFields: ScoutingField[];
  pitFields: ScoutingField[];
}

export type FieldValue = string | number | boolean | null;
export type EntryData = Record<string, FieldValue>;

export function getDefaultData(fields: ScoutingField[]): EntryData {
  const data: EntryData = {};
  for (const field of fields) {
    data[field.id] =
      field.defaultValue !== undefined
        ? field.defaultValue
        : field.type === "boolean"
          ? false
          : field.type === "counter" || field.type === "number"
            ? 0
            : field.type === "rating"
              ? 3
              : (field.type === "select" || field.type === "multiselect") && field.options?.length
                ? field.type === "multiselect" ? "" : field.options[0]
                : "";
  }
  return data;
}
