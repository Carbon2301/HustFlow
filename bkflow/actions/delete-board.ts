"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/dist/server/web/spec-extension/revalidate";

export async function deleteBoard(id: string) {
    await db.board.delete({
        where: {
            id
        },
    });

    revalidatePath("/organization/org_3CDNRR8v6xRN9fgH26zz0lgLKBE")
}