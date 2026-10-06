import type { ContentCategory } from "./enums";

export type ContentTemplate = {
  category: ContentCategory;
  title: string;
  prompt: string;
  starter: string;
};

export const CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    category: "MISSION",
    title: "Mission",
    prompt: "In 2–3 sentences, who do you serve and why?",
    starter: "We serve ",
  },
  {
    category: "ORG_HISTORY",
    title: "History",
    prompt: "When did the organization start, and what changed in the community because of it?",
    starter: "",
  },
  {
    category: "PROGRAM_DESCRIPTION",
    title: "Program",
    prompt:
      "What will you do, where, and over what months? Mention weather or ferry limits if they matter.",
    starter: "",
  },
  {
    category: "NEED_STATEMENT",
    title: "Need",
    prompt: "What problem are you solving, and how do you know? Use numbers you can stand behind.",
    starter: "",
  },
  {
    category: "GOALS_OBJECTIVES",
    title: "Goals",
    prompt: "What will be different when the grant ends? Name a result you can count.",
    starter: "",
  },
  {
    category: "EVALUATION_PLAN",
    title: "Evaluation",
    prompt: "How will you know the work happened? Who writes it down, and how often?",
    starter: "",
  },
  {
    category: "SUSTAINABILITY",
    title: "Sustainability",
    prompt: "What continues after this grant, and who pays for it?",
    starter: "",
  },
  {
    category: "ORG_CAPACITY",
    title: "Capacity",
    prompt: "Who does the work now, and what can they realistically take on?",
    starter: "",
  },
  {
    category: "COMMUNITY_ENGAGEMENT",
    title: "Community",
    prompt: "Who helped shape this, and how will they stay involved?",
    starter: "",
  },
  {
    category: "BUDGET_NARRATIVE",
    title: "Budget narrative",
    prompt:
      "Explain the unusual costs: freight, float plane, ferry, fuel, or a short construction window.",
    starter: "",
  },
  {
    category: "KEY_PERSONNEL",
    title: "People",
    prompt: "Who is responsible, and what have they done that is relevant?",
    starter: "",
  },
  {
    category: "OTHER",
    title: "Other",
    prompt: "A paragraph you expect to reuse.",
    starter: "",
  },
];

export function contentTemplate(category: ContentCategory): ContentTemplate {
  const match = CONTENT_TEMPLATES.find((item) => item.category === category);
  const fallback = CONTENT_TEMPLATES[0];
  if (match) return match;
  if (!fallback) {
    throw new Error("Content templates are missing.");
  }
  return fallback;
}

export function countWords(markdown: string): number {
  const text = markdown.trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}
