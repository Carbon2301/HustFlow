"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type State = {
  errors?:{
    title?: string[];
  },
  message?: string | null;
}

const CreateBoardSchema = z.object({
  title: z.string().min(3, {
    message: "Title must be at least 3 characters long",
  })
});

export async function create(prevState: State, formData: FormData): Promise<State> {
    const validatedFields = CreateBoardSchema.safeParse({
        title: formData.get("title"),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: "Invalid board title.",
        };
    }

    const { title } = validatedFields.data;
    try {
    await db.board.create({
      data: {
        title,
      },
    });
    } catch (error) {
        return {
            message: "Database error",
        }
    }

    revalidatePath("/organization/org_3CDNRR8v6xRN9fgH26zz0lgLKBE")
    redirect("/organization/org_3CDNRR8v6xRN9fgH26zz0lgLKBE");
}