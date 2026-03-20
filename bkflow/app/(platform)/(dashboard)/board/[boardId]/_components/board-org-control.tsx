"use client";

import { useEffect } from "react";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";

type BoardOrgControlProps = {
  orgId: string;
};

export const BoardOrgControl = ({ orgId }: BoardOrgControlProps) => {
  const { organization, isLoaded } = useOrganization();
  const { setActive } = useOrganizationList();

  useEffect(() => {
    if (!isLoaded || !setActive || organization?.id === orgId) {
      return;
    }

    setActive({
      organization: orgId,
    });
  }, [isLoaded, organization?.id, orgId, setActive]);

  return null;
};
