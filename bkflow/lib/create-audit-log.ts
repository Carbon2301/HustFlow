import { auth, currentUser } from "@clerk/nextjs/server"
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

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

const getUserDisplayName = (user: CurrentUser) => {
  const fullName = user.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  if (name) {
    return name;
  }

  const email =
    user.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;

  return email?.trim() || "Unknown user";
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
        userName: getUserDisplayName(user),
      }
    });
  } catch (error) {
    logger.error("[AUDIT_LOG_ERROR]", error, {
      action: "create-audit-log",
      entityId: props.entityId,
      entityType: props.entityType,
      boardId: props.boardId,
      cardId: props.cardId,
    });
  }
}
