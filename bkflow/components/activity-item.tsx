import { format } from "date-fns";
import { AuditLog } from "@prisma/client"

import { generateLogMessage } from "@/lib/generate-log-message";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ActivityItemProps {
  data: AuditLog;
};

export const ActivityItem = ({
  data,
}: ActivityItemProps) => {
  const initials = data.userName
    ? data.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <li className="flex items-start gap-x-2.5">
      <Avatar className="h-7 w-7 flex-shrink-0 mt-0.5">
        <AvatarImage src={data.userImage} alt={data.userName} />
        <AvatarFallback className="text-xs bg-violet-100 text-violet-700 font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-y-0.5 min-w-0">
        <p className="text-sm text-neutral-600 leading-snug">
          <span className="font-semibold text-neutral-800">
            {data.userName}
          </span>{" "}
          {generateLogMessage(data)}
        </p>
        <p className="text-xs text-neutral-400">
          {format(new Date(data.createdAt), "MMM d, yyyy 'at' h:mm a")}
        </p>
      </div>
    </li>
  );
};