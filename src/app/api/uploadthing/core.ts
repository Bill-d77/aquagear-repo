import { createUploadthing, type FileRouter } from "uploadthing/server";
import { isAdmin } from "@/lib/admin";

const f = createUploadthing();

export const ourFileRouter = {
  productImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      if (!(await isAdmin())) {
        throw new Error("Unauthorized");
      }
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
