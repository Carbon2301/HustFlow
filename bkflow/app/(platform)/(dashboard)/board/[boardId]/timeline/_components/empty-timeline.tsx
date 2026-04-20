"use client";

import { CalendarClock } from "lucide-react";

export const EmptyTimeline = ({ hasCards }: { hasCards: boolean }) => (
  <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
    <div>
      <CalendarClock className="mx-auto h-10 w-10 text-neutral-300" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">
        {hasCards ? "Chưa có thẻ có mốc thời gian" : "Chưa có thẻ để hiển thị"}
      </h2>
      <p className="mt-1 max-w-md text-sm text-neutral-500">
        {hasCards
          ? "Các thẻ chưa lên lịch được gom ở phần bên dưới để chuẩn bị kéo vào timeline ở phase sau."
          : "Khi board có thẻ, timeline sẽ dùng dữ liệu ngày, nhãn, thành viên và phụ thuộc tại đây."}
      </p>
    </div>
  </div>
);
