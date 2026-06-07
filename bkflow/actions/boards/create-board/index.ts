"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { InputType, ReturnType } from "./types";
import { CreateBoard } from "./schema";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, BoardMemberRole, ENTITY_TYPE } from "@prisma/client";
import {
  incrementAvailableCount,
  hasAvailableCount,
} from "@/lib/org-limit";
import { checkSubscription } from "@/lib/billing/subscription";
import { isOrganizationAdmin } from "@/lib/organization-permissions";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const canCreate = await hasAvailableCount();
  const isPro = await checkSubscription();

  if (!canCreate && !isPro) {
    const isOrgAdmin = await isOrganizationAdmin(orgId, userId);

    return {
      error: isOrgAdmin
        ? "Tổ chức đã đạt giới hạn số lượng bảng miễn phí. Vui lòng nâng cấp lên Pro để tạo thêm."
        : "Tổ chức đã đạt giới hạn 5 bảng. Vui lòng liên hệ quản trị viên tổ chức để nâng cấp.",
    };
  }

  const { title, image } = data;

  const [
    imageId,
    imageThumbUrl,
    imageFullUrl,
    imageLinkHTML,
    imageUserName,
  ] = image.split("|");

  if (!imageId || !imageThumbUrl || !imageFullUrl || !imageUserName || !imageLinkHTML) {
    return {
      error: "Thiếu thông tin trường dữ liệu. Tạo bảng thất bại.",
    };
  }

  let board;

  try {
    const userName =
      user.fullName ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "Quản trị viên";

    board = await db.board.create({
      data: {
        title,
        orgId,
        imageId,
        imageThumbUrl,
        imageFullUrl,
        imageUserName,
        imageLinkHTML,
        members: {
          create: {
            userId,
            userName,
            userImage: user.imageUrl,
            userEmail: user.primaryEmailAddress?.emailAddress,
            role: BoardMemberRole.ADMIN,
          },
        },
        labels: {
          createMany: {
            data: [
              { color: "#4ade80", title: "" },
              { color: "#facc15", title: "" },
              { color: "#fb923c", title: "" },
              { color: "#f87171", title: "" },
              { color: "#c084fc", title: "" },
              { color: "#60a5fa", title: "" },
            ],
          },
        },
      },
    });

    if (!isPro) {
      await incrementAvailableCount();
    }

    await createAuditLog({
      entityTitle: board.title,
      entityId: board.id,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.CREATE,
      boardId: board.id,
    });
  } catch {
    return {
      error: "Tạo bảng thất bại.",
    };
  }

  revalidatePath(`/board/${board.id}`);
  return { data: board };
};

export const createBoard = createSafeAction(CreateBoard, handler);
