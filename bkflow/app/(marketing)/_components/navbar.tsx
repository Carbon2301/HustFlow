import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const Navbar = () => {
    return (
        <div className="fixed top-0 w-full h-16 px-6 border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm shadow-sm z-50">
            <div className="md:max-w-screen-xl mx-auto flex items-center w-full h-full justify-between">
                <Logo />
                <div className="flex items-center gap-x-3">
                    <Button size="sm" variant="ghost" asChild className="text-neutral-600 hover:text-neutral-900">
                        <Link href="/sign-in">
                            Sign in
                        </Link>
                    </Button>
                    <Button size="sm" asChild className="bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg px-4">
                        <Link href="/sign-up">
                            Get started free
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
};