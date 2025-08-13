"use client";

import { create } from "@/actions/create-board";
import { Button } from "@/components/ui/button";
import { useActionState } from "react";
import { FormInput } from "./form-input";

export const Form = () => {
    const initialState = { message: null, errors: {} };
    const [state, dispatch, isPending] = useActionState(create, initialState);
    return (
        <form action={dispatch}>
            <div className="flex flex-col space-y-2">
                <FormInput errors={state?.errors} />
            </div>
          <Button type="submit" disabled={isPending}>
            Submit
          </Button>
        </form>
    )
}