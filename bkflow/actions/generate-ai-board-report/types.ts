import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { GenerateAiBoardReport } from "./schema";

export type InputType = z.infer<typeof GenerateAiBoardReport>;

export type AiBoardReport = {
  summary: string;
  completed: string[];
  risks: string[];
  actions: string[];
  metrics: {
    label: string;
    value: string;
  }[];
};

export type ReturnType = ActionState<InputType, AiBoardReport>;
