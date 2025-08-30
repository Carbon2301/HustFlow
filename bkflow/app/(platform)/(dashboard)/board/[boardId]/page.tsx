import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";

interface BoardIdPageProps {
  params: {
    boardId: string;
  };
};

const BoardIdPage = async ({
  params,
}: BoardIdPageProps) => {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/select-org");
  }
  

  return (
    <div className="p-4 h-full overflow-x-auto">
        boardId={params.boardId}
    </div>
  );
};

export default BoardIdPage;