import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

cloudinary.config({
  cloud_name: env.cloudinaryCloudName,
  api_key: env.cloudinaryApiKey,
  api_secret: env.cloudinaryApiSecret,
});

export const CLOUDINARY_FOLDER = "idiom-bot";

function uploadBuffer(buffer: Buffer): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CLOUDINARY_FOLDER,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error("Cloudinary upload returned no secure_url."));
          return;
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export async function uploadImage(buffer: Buffer): Promise<string> {
  try {
    return await uploadBuffer(buffer);
  } catch (firstError) {
    return await uploadBuffer(buffer).catch(() => {
      throw firstError;
    });
  }
}
