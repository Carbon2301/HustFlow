import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const Footer = () => {
    return (
        <div className="fixed bottom-0 w-full p-4 border-t border-neutral-200 bg-white/95 backdrop-blur-sm">
            <div className="md:max-w-screen-xl mx-auto flex items-center w-full justify-between">
                <Logo />
                <div className="flex items-center gap-x-1">
                    <Button size="sm" variant="ghost" className="text-xs text-neutral-500 hover:text-neutral-700" asChild>
                        <Link href="#">Privacy Policy</Link>
                    </Button>
                    <span className="text-neutral-300 text-xs">·</span>
                    <Button size="sm" variant="ghost" className="text-xs text-neutral-500 hover:text-neutral-700" asChild>
                        <Link href="#">Terms of Service</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
};