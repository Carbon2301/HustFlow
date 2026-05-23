"use client";

import Link from "next/link";
import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { unsplash } from "@/lib/unsplash/unsplash";
import { defaultImages } from "@/constants/images";

import { FormErrors } from "./form-errors";

type BoardImage = {
  id: string;
  urls: {
    thumb: string;
    full: string;
  };
  links: {
    html: string;
  };
  user: {
    name: string;
  };
};

interface FormPickerProps {
  id: string;
  errors?: Record<string, string[] | undefined>;
};

export const FormPicker = ({
  id,
  errors,
}: FormPickerProps) => {
  const { pending } = useFormStatus();

  const [images, setImages] = useState<BoardImage[]>(defaultImages);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(
    defaultImages[0]?.id || null
  );

  useEffect(() => {
    const fetchImages = async () => {
      try {
        const result = await unsplash.photos.getRandom({
          collectionIds: ["317099"],
          count: 9,
        });

        if (result && result.response) {
          const newImages = Array.isArray(result.response)
            ? result.response
            : [result.response];
          setImages(newImages);
          if (newImages.length > 0) {
            setSelectedImageId(newImages[0].id);
          }
        } else {
          console.error("Failed to get images from Unsplash");
        }
      } catch (error) {
        console.log(error);
        setImages(defaultImages);
        if (defaultImages.length > 0) {
          setSelectedImageId(defaultImages[0].id);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, []);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-violet-600 animate-spin" />
      </div>
    );
  }

  const selectedImage = images.find((image) => image.id === selectedImageId);
  const hiddenValue = selectedImage
    ? `${selectedImage.id}|${selectedImage.urls.thumb}|${selectedImage.urls.full}|${selectedImage.links.html}|${selectedImage.user.name}`
    : "";

  return (
    <div className="relative">
      <input 
        type="hidden"
        id={id}
        name={id}
        value={hiddenValue}
      />
      <div className="grid grid-cols-3 gap-2 mb-2">
        {images.map((image) => (
          <div 
            key={image.id}
            className={cn(
              "cursor-pointer relative aspect-video group hover:opacity-75 transition bg-muted",
              pending && "opacity-50 hover:opacity-50 cursor-auto"
            )}
            onClick={() => {
              if (pending) return;
              setSelectedImageId(image.id);
            }}
          >
            <Image
              src={image.urls.thumb}
              alt="Unsplash image"
              className="object-cover rounded-sm"
              fill  
            />
            {selectedImageId === image.id && (
              <div className="absolute inset-y-0 h-full w-full bg-black/30 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
            <Link 
              href={image.links.html}
              target="_blank"
              className="opacity-0 group-hover:opacity-100 absolute bottom-0 w-full text-[10px] truncate text-white hover:underline p-1 bg-black/50"
            >
              {image.user.name}
            </Link>
          </div>
        ))}
      </div>
      <FormErrors
        id="image"
        errors={errors}
      />
    </div>
  );
};
