import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

const CardAttachmentUploadInput = z.object({
  cardId: z.string().min(1),
  boardId: z.string().min(1),
});

export const ourFileRouter = {
  cardAttachmentUploader: f(
    {
      image: {
        maxFileSize: "8MB",
        maxFileCount: 10,
      },
      pdf: {
        maxFileSize: "16MB",
        maxFileCount: 10,
      },
      blob: {
        maxFileSize: "16MB",
        maxFileCount: 10,
      },
    },
    {
      awaitServerData: false,
    },
  )
    .input(CardAttachmentUploadInput)
    .middleware(async ({ input }) => {
      const { userId, orgId } = await auth();

      if (!userId || !orgId) {
        throw new UploadThingError("Không có quyền truy cập.");
      }

      const permission = await requireBoardMember({
        boardId: input.boardId,
        orgId,
        userId,
      });

      if (permission.error) {
        throw new UploadThingError(permission.error);
      }

      const card = await db.card.findUnique({
        where: {
          id: input.cardId,
          list: {
            board: {
              id: input.boardId,
              orgId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!card) {
        throw new UploadThingError("Không tìm thấy thẻ.");
      }

      return {
        userId,
        orgId,
        cardId: card.id,
        boardId: input.boardId,
      };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.info("[UPLOADTHING_CARD_ATTACHMENT_UPLOADED]", {
        cardId: metadata.cardId,
        boardId: metadata.boardId,
        fileKey: file.key,
        fileName: file.name,
      });
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
