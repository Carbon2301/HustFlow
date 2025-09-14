import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import localFont from 'next/font/local';

const headingFont = localFont({
    src: "../public/fonts/font.woff2"
});

export const Logo = () => {
    return (
        <Link href="/" >
            <div className="hover:opacity-80 transition items-center gap-x-2 hidden md:flex">
                <Image 
                    src="/logo.svg"
                    alt="BKFlow Logo"
                    height={28}
                    width={28}
                />
                <p className={cn("text-lg font-semibold text-neutral-800 tracking-tight", 
                    headingFont.className)}>
                    BKFlow
                </p>
            </div>
        </Link>
    );
}