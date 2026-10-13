import { z } from "zod";

export const techCategoryEnum = z.enum([
  "LANGUAGE",
  "FRAMEWORK",
  "DATABASE",
  "INFRASTRUCTURE",
  "TOOL",
  "SERVICE",
  "OTHER",
]);
export type TechCategory = z.infer<typeof techCategoryEnum>;

export const TECH_CATEGORY_LABELS: Record<TechCategory, string> = {
  LANGUAGE: "Language",
  FRAMEWORK: "Framework / Library",
  DATABASE: "Database",
  INFRASTRUCTURE: "Infrastructure / DevOps",
  TOOL: "Tool",
  SERVICE: "Service / API",
  OTHER: "Other",
};

export const addTechSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100),
  category: techCategoryEnum.default("TOOL"),
  version: z.string().trim().max(50).optional().or(z.literal("")),
  purpose: z.string().trim().max(500).optional().or(z.literal("")),
  url: z.union([z.literal(""), z.url({ protocol: /^https?$/, error: "Enter a valid http(s) URL" })]).optional(),
});
export type AddTechInput = z.input<typeof addTechSchema>;

export const pinNoteSchema = z.string().trim().max(500);
