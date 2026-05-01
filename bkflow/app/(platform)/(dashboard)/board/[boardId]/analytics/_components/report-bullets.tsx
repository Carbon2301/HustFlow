"use client";

export const ReportBullets = ({
  title,
  items,
}: {
  title: string;
  items: string[];
}) => (
  <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
    <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</h3>
    <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2 leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);
