import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import {
  buildBoardCsv,
  buildBoardWorkbookBuffer,
  getBoardExportData,
} from "@/lib/exports/board-export";
import { buildBoardExportFileName } from "@/lib/exports/filename";
import { requireBoardMemberForUser } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const format = request.nextUrl.searchParams.get("format");

    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json(
        { error: 'Invalid "format" query parameter. Use "csv" or "xlsx".' },
        { status: 400 },
      );
    }

    const permission = await requireBoardMemberForUser({ boardId, userId });

    if (permission.error || !permission.membership) {
      return new NextResponse(permission.error ?? "Forbidden", { status: 403 });
    }

    const data = await getBoardExportData({
      boardId,
      orgId: permission.membership.board.orgId,
    });

    if (!data) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const fileName = buildBoardExportFileName(
      data.title,
      "board-export",
      format,
    );

    if (format === "csv") {
      const csv = buildBoardCsv(data);

      return new NextResponse(`\uFEFF${csv}`, {
        headers: {
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Type": "text/csv; charset=utf-8",
        },
      });
    }

    const buffer = await buildBoardWorkbookBuffer(data);

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    console.error("[BOARD_EXPORT_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
