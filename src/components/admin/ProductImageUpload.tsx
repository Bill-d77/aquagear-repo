"use client";

import { UploadButton } from "@/utils/uploadthing";
import Image from "next/image";
import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface ProductImageUploadProps {
    defaultValue?: string;
    name: string;
}

export function ProductImageUpload({ defaultValue, name }: ProductImageUploadProps) {
    const [imageUrl, setImageUrl] = useState(defaultValue || "");

    useEffect(() => {
        if (defaultValue) {
            setImageUrl(defaultValue);
        }
    }, [defaultValue]);

    if (imageUrl) {
        return (
            <div className="relative w-full h-64 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
                <Image
                    src={imageUrl}
                    alt="Product image"
                    fill
                    className="object-contain"
                />
                <input type="hidden" name={name} value={imageUrl} />
                <button
                    onClick={() => setImageUrl("")}
                    type="button"
                    className="absolute top-2 right-2 p-1.5 bg-white rounded-full shadow-sm border border-gray-200 text-gray-500 hover:text-red-500 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
            <UploadButton
                endpoint="productImage"
                onClientUploadComplete={(res) => {
                    if (res && res[0]) {
                        setImageUrl(res[0].url);
                    }
                }}
                onUploadError={(error: Error) => {
                    alert(`ERROR! ${error.message}`);
                }}
                appearance={{
                    button: "bg-sky-600 hover:bg-sky-700 text-white text-sm px-4 py-2 rounded-md",
                    allowedContent: "text-gray-500 text-xs mt-2"
                }}
            />
            <input type="hidden" name={name} value={imageUrl} required />
        </div>
    );
}
