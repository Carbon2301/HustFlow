"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

const CreateBoardSchema = z.object({
  title: z.string(),
});

export async function create(formData: FormData) {
    const { title } = CreateBoardSchema.parse({
        title: formData.get("title"),
    });

    await db.board.create({
      data: {
        title,
      },
    });

    revalidatePath("/organization/org_3CDNRR8v6xRN9fgH26zz0lgLKBE")
}