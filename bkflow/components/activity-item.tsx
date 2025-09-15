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
    <li className="flex items-start gap-x-3.5">
      <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
        <AvatarImage src={data.userImage} alt={data.userName} />
        <AvatarFallback className="text-sm bg-violet-100 text-violet-700 font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-y-1 min-w-0">
        <p className="text-[15px] text-neutral-700 leading-relaxed">
          <span className="font-semibold text-neutral-900">
            {data.userName}
          </span>{" "}
          {generateLogMessage(data)}
        </p>
        <p className="text-xs text-neutral-400">
          {format(new Date(data.createdAt), "dd/MM/yyyy 'lúc' HH:mm")}
        </p>
      </div>
    </li>
  );
};