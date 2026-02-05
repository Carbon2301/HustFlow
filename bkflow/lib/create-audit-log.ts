import { auth, currentUser } from "@clerk/nextjs/server"
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";

interface Props {
  entityId: string;
  entityType: ENTITY_TYPE,
  entityTitle: string;
  action: ACTION;
  eventType?: AUDIT_EVENT_TYPE;
  boardId?: string | null;
  cardId?: string | null;
};

const getDefaultEventType = (action: ACTION) => {
  switch (action) {
    case ACTION.CREATE:
      return AUDIT_EVENT_TYPE.CREATE;
    case ACTION.DELETE:
      return AUDIT_EVENT_TYPE.DELETE;
    case ACTION.UPDATE:
    default:
      return AUDIT_EVENT_TYPE.UPDATE;
  }
};

export const createAuditLog = async (props: Props) => {
  try {
    const { orgId } = await auth();
    const user = await currentUser();

    if (!user || !orgId) {
      throw new Error("User not found!");
    }

    const { entityId, entityType, entityTitle, action, eventType, boardId, cardId } = props;

    await db.auditLog.create({
      data: {
        orgId,
        boardId,
        cardId,
        entityId,
        entityType,
        entityTitle,
        action,
        eventType: eventType ?? getDefaultEventType(action),
        userId: user.id,
        userImage: user?.imageUrl,
        userName: user?.firstName + " " + user?.lastName,
      }
    });
  } catch (error) {
    console.log("[AUDIT_LOG_ERROR]", error);
  }
}
