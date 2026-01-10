import { Button } from "@/components/ui/button";
import { ArrowRight, Kanban } from "lucide-react";
import Link from "next/link";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const headingFont = localFont({
    src: "../../public/fonts/font.woff2",
});

const textFont = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

const MarketingPage = () => {
    return (
        <div className="flex items-center justify-center flex-col gap-y-8 px-4">
            {/* Badge */}
            <div className={cn(
                "flex items-center gap-x-2 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-semibold px-4 py-2 rounded-full uppercase tracking-wider",
                textFont.className
            )}>
                <Kanban className="h-3.5 w-3.5" />
                Quản lý công việc nhóm trực quan & hiệu quả
            </div>

            {/* Headline */}
            <div className={cn(
                "text-center",
                headingFont.className
            )}>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-neutral-900 leading-tight tracking-tight mb-4">
                    HustFlow giúp đội ngũ của bạn
                </h1>
                <div className="text-4xl md:text-6xl lg:text-7xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                    thúc đẩy công việc tiến lên.
                </div>
            </div>

            {/* Subheadline */}
            <p className={cn(
                "text-base md:text-lg text-neutral-500 max-w-xl text-center leading-relaxed",
                textFont.className
            )}>
                Cùng nhau cộng tác, quản lý dự án và đạt những đỉnh cao năng suất mới — từ các nhóm nhỏ đến các tổ chức lớn.
            </p>

            {/* CTA */}
            <div className="flex items-center gap-x-3">
                <Button
                    size="lg"
                    asChild
                    className="bg-violet-600 hover:bg-violet-700 text-white px-8 py-6 text-base rounded-xl shadow-lg shadow-violet-200 hover:shadow-violet-300 transition-all"
                >
                    <Link href="/sign-up" className="flex items-center gap-x-2">
                        Trải nghiệm HustFlow miễn phí
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>

            {/* Social proof */}
            <p className={cn("text-xs text-neutral-400", textFont.className)}>
                Không yêu cầu thẻ tín dụng · Miễn phí trọn đời cho nhóm nhỏ
            </p>
        </div>
    );
};

export default MarketingPage;