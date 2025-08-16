import { z } from "zod";

export const CreateBoard = z.object({
    title: z.string({
        required_error: "Title is required",
        invalid_type_error: "Title must be a string",
    }).trim().min(3, {
        message: "Title is too short."
    }),
});