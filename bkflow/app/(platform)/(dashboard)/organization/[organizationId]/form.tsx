"use client";

import { Button } from "@/components/ui/button";
import { createBoard } from "@/actions/create-board/index";
import { FormInput } from "./form-input";
import { useAction } from "@/hooks/use-action";

export const Form = () => {
    const { execute, fieldErrors } = useAction(createBoard, {
        onSuccess: (data) => {
            console.log("Board created:", data);
        },
        onError: (error) => {
            console.error("Error creating board:", error);
        }
    });

    const onSubmit = (formData: FormData) => {
        const title = formData.get("title") as string;

        execute({ title });
    }

    return (
        <form action={onSubmit}>
            <div className="flex flex-col space-y-2">
                <FormInput errors={fieldErrors} />
            </div>
            <Button type="submit" className="mt-4">
                Submit
            </Button>
        </form>
    );
};