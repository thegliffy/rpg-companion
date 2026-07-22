import { useForm, useFieldArray } from "react-hook-form";
import type { Character, SheetField, SheetFieldType } from "shared";
import type { CharacterInput } from "../api/characters";

interface FormValues {
  name: string;
  hpCurrent: string;
  hpMax: string;
  notes: string;
  sheetData: SheetField[];
}

function toFormValues(character?: Character): FormValues {
  return {
    name: character?.name ?? "",
    hpCurrent: character?.hpCurrent != null ? String(character.hpCurrent) : "",
    hpMax: character?.hpMax != null ? String(character.hpMax) : "",
    notes: character?.notes ?? "",
    // generic system stores a flat SheetField[]
    sheetData: (character?.sheetData as SheetField[] | undefined) ?? [],
  };
}

let nextFieldId = 0;

export function CharacterSheetForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Character;
  onSubmit: (input: CharacterInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({ defaultValues: toFormValues(initial) });

  const { fields, append, remove } = useFieldArray({ control, name: "sheetData" });

  async function submit(values: FormValues) {
    const input: CharacterInput = {
      name: values.name,
      hpCurrent: values.hpCurrent === "" ? null : Number(values.hpCurrent),
      hpMax: values.hpMax === "" ? null : Number(values.hpMax),
      notes: values.notes,
      sheetData: values.sheetData,
    };
    await onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit(submit)} style={{ border: "1px solid #ccc", padding: "1rem" }}>
      <div>
        <label>
          Name
          <input {...register("name", { required: true })} />
        </label>
      </div>
      <div>
        <label>
          HP current
          <input type="number" {...register("hpCurrent")} />
        </label>
        <label>
          HP max
          <input type="number" {...register("hpMax")} />
        </label>
      </div>
      <div>
        <label>
          Notes
          <textarea {...register("notes")} />
        </label>
      </div>

      <h4>Custom fields</h4>
      {fields.map((field, index) => (
        <div key={field.id} style={{ display: "flex", gap: "0.5rem" }}>
          <input placeholder="Label" {...register(`sheetData.${index}.label` as const, { required: true })} />
          <select {...register(`sheetData.${index}.type` as const)}>
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="textarea">Long text</option>
          </select>
          <input placeholder="Value" {...register(`sheetData.${index}.value` as const)} />
          <button type="button" onClick={() => remove(index)}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          append({ id: `field-${Date.now()}-${nextFieldId++}`, label: "", type: "text" as SheetFieldType, value: "" })
        }
      >
        Add field
      </button>

      <div style={{ marginTop: "1rem" }}>
        <button type="submit" disabled={isSubmitting}>
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
