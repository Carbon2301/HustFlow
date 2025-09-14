import { z } from "zod";

export const CreateBoard = z.object({
  title: z.string("Title is required").min(3, {
    message: "Title is too short."
  }),
  image: z.string("Image is required"),
});
