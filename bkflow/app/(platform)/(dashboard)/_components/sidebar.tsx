"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { useOrganization, useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import localFont from "next/font/local";

import { NavItem, Organization } from "./nav-item";

const headingFont = localFont({
  src: "../../../../public/fonts/font.woff2"
});

interface SidebarProps {
  storageKey?: string;
};

export const Sidebar = ({
  storageKey = "t-sidebar-state",
}: SidebarProps) => {
  const [expanded, setExpanded] = useLocalStorage<Record<string, boolean>>(
    storageKey,
    {}
  );

  const {
    organization: activeOrganization,
    isLoaded: isLoadedOrg
  } = useOrganization();
  const {
    user,
    isLoaded: isLoadedUser,
  } = useUser();
  const [memberships, setMemberships] = useState<Organization[]>([]);
  const [isLoadingMemberships, setIsLoadingMemberships] = useState(true);

  useEffect(() => {
    if (!isLoadedUser || !user) return;

    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoadingMemberships(true);
      }
    });

    user
      .getOrganizationMemberships({ pageSize: 50 })
      .then((result) => {
        if (cancelled) return;
        setMemberships(
          result.data.map((membership) => ({
            id: membership.organization.id,
            slug: membership.organization.slug ?? "",
            imageUrl: membership.organization.imageUrl ?? "",
            name: membership.organization.name,
          }))
        );
        setIsLoadingMemberships(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsLoadingMemberships(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoadedUser, user]);

  const defaultAccordionValue: string[] = Object.keys(expanded)
    .reduce((acc: string[], key: string) => {
      if (expanded[key]) {
        acc.push(key);
      }
      return acc;
  }, []);

  const onExpand = (id: string) => {
    setExpanded((curr) => ({
      ...curr,
      [id]: !expanded[id],
    }));
  };

  const orderedMemberships = useMemo(() => {
    const activeId = activeOrganization?.id;
    if (!activeId) return memberships;

    return [...memberships].sort((left, right) => {
      if (left.id === activeId) return -1;
      if (right.id === activeId) return 1;
      return 0;
    });
  }, [memberships, activeOrganization?.id]);

  if (!isLoadedOrg || !isLoadedUser || isLoadingMemberships) {
    return (
      <>
        <div className="flex items-center justify-between mb-3 px-1">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <NavItem.Skeleton />
          <NavItem.Skeleton />
          <NavItem.Skeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <div className={cn(
        "font-bold text-xl text-[#041a4e] flex items-center mb-2 px-2",
        headingFont.className
      )}>
        <span className="flex-1">Không gian làm việc</span>
        <Button
          asChild
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-neutral-500 hover:text-violet-600 hover:bg-violet-50 rounded-lg"
        >
          <Link href="/select-org" title="Thêm không gian làm việc">
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
      <Accordion
        type="multiple"
        defaultValue={defaultAccordionValue}
        className="space-y-0.5"
      >
        {orderedMemberships.map((organization) => (
          <NavItem
            key={organization.id}
            isActive={activeOrganization?.id === organization.id}
            isExpanded={expanded[organization.id]}
            organization={organization}
            onExpand={onExpand}
          />
        ))}
        {memberships.length === 0 && (
          <div className="px-2 py-4 text-xs text-neutral-400 text-center">
            Chưa có không gian làm việc nào.
            <br />
            <Link href="/select-org" className="text-violet-600 hover:underline mt-1 inline-block">
              Tạo mới →
            </Link>
          </div>
        )}
      </Accordion>
    </>
  );
};
