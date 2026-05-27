import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { AnalyzeSmartCapture } from "./schema";

export type SmartCaptureBoardList = {
  id: string;
  title: string;
};

export type SmartCaptureBoardMember = {
  id: string;
  userName: string;
  userEmail: string | null;
  role: string;
};

export type SmartCaptureBoardLabel = {
  id: string;
  title: string;
  color: string;
};

export type SmartCaptureDraft = {
  title: string;
  description: string;
  checklistItems: string[];
  dueDateIso: string | null;
  assigneeBoardMemberIds: string[];
  labelIds: string[];
  listId: string;
  assigneeWarnings: string[];
  suggestedAssigneeBoardMemberIds: string[];
  suggestedLabelIds: string[];
};

export type InputType = z.infer<typeof AnalyzeSmartCapture>;
export type ReturnType = ActionState<InputType, SmartCaptureDraft>;
