"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";
import { useOrganization, useUser } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion } from "@/components/ui/accordion";

import { NavItem, Organization } from "./nav-item";

interface SidebarProps {
  storageKey?: string;
};

export const Sidebar = ({
  storageKey = "t-sidebar-state",
}: SidebarProps) => {
  const [expanded, setExpanded] = useLocalStorage<Record<string, any>>(
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
    setIsLoadingMemberships(true);
    user
      .getOrganizationMemberships({ limit: 50 })
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
      .catch((error) => {
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
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-10 w-[50%]" />
          <Skeleton className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <NavItem.Skeleton />
          <NavItem.Skeleton />
          <NavItem.Skeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="font-medium text-xs flex items-center mb-1">
        <span className="pl-4">
          Workspaces
        </span>
        <Button
          asChild
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto"
        >
          <Link href="/select-org">
            <Plus
              className="h-4 w-4"
            />
          </Link>
        </Button>
      </div>
      <Accordion
        type="multiple"
        defaultValue={defaultAccordionValue}
        className="space-y-2"
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
          <div className="px-4 py-2 text-xs text-muted-foreground">
            No workspaces found for this account.
          </div>
        )}
      </Accordion>
    </>
  );
};