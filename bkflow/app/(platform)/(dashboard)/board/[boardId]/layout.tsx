import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";

import { BoardNavbar } from "./_components/board-navbar";

export async function generateMetadata({ 
  params
 }: {
  params: Promise<{ boardId: string; }>;
 }) {
  const { boardId } = await params;
  const { orgId } = await auth();

  if (!orgId) {
    return {
      title: "Bảng",
    };
  }

  const board = await db.board.findUnique({
    where: {
      id: boardId,
      orgId
    }
  });

  return {
    title: board?.title || "Bảng",
  };
}

const BoardIdLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boardId: string; }>;
}) => {
  const { boardId } = await params;
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/select-org");
  }

  const board = await db.board.findUnique({
    where: {
      id: boardId,
      orgId,
    },
  });

  if (!board) {
    notFound();
  }

  return (
    <div
      className="relative min-h-screen bg-no-repeat bg-cover bg-center"
      style={{ backgroundImage: `url(${board.imageFullUrl})` }}
    >
      <BoardNavbar data={board} />
      <div className="absolute inset-0 bg-black/10" />
      <main className="relative pt-28 min-h-screen">
        {children}
      </main>
    </div>
  );
};

export default BoardIdLayout;