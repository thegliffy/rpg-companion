import { z } from "zod";
import { sheetFieldSchema } from "../schemas.js";

export const genericSheetSchema = z.array(sheetFieldSchema).max(100);

export type GenericSheetData = z.infer<typeof genericSheetSchema>;

export const genericSystem = {
  id: "generic" as const,
  name: "Generic / Custom",
  schema: genericSheetSchema,
  emptySheet: (): GenericSheetData => [],
};
