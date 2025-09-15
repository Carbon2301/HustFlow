"use client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { Plus } from "lucide-react";
import { MobileSidebar } from "./mobile-sidebar";
import { FormPopover } from "@/components/form/form-popover";

export const Navbar = () => {
    return (
        <nav className="fixed z-50 top-0 px-4 w-full h-14 border-b border-neutral-200/80 bg-white/95 backdrop-blur-sm flex items-center gap-x-4">
            <MobileSidebar />
            <div className="flex items-center gap-x-4">
                <div className="hidden md:flex">
                    <Logo />
                </div>
                <FormPopover align="start" side="bottom" sideOffset={18}>
                    <Button
                        variant="default"
                        size="sm"
                        className="rounded-lg hidden md:flex items-center gap-x-1.5 bg-violet-600 hover:bg-violet-700 text-white h-8 px-3 text-sm font-medium shadow-sm"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Tạo mới
                    </Button>
                </FormPopover>
                <FormPopover align="start" side="bottom" sideOffset={18}>
                    <Button
                        size="sm"
                        className="rounded-lg flex md:hidden bg-violet-600 hover:bg-violet-700 text-white h-8 w-8 p-0 shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </FormPopover>
            </div>
            <div className="ml-auto flex items-center gap-x-3">
                <OrganizationSwitcher
                    hidePersonal
                    afterCreateOrganizationUrl="/organization/:id"
                    afterSelectOrganizationUrl="/organization/:id"
                    afterLeaveOrganizationUrl="/select-org"
                    appearance={{
                        elements: {
                            rootBox: {
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                            },
                        },
                    }}
                />
                <UserButton
                    appearance={{
                        elements: {
                            avatarBox: {
                                height: 30,
                                width: 30,
                            },
                        },
                    }}
                />
            </div>
        </nav>
    );
};
