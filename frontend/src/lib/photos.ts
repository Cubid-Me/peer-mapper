import { getSupabaseClient } from "./supabaseClient";

const STORAGE_BUCKET = "profile-pictures";

function buildFilePath(userId: string, extension?: string) {
  const sanitizedExtension = extension?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const suffix = sanitizedExtension ? `.${sanitizedExtension}` : "";
  const random = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();
  return `${userId}/${timestamp}-${random}${suffix}`;
}

async function uploadBlob({
  blob,
  userId,
  extension,
  contentType,
}: {
  blob: Blob;
  userId: string;
  extension?: string;
  contentType?: string;
}): Promise<string> {
  if (!userId) {
    throw new Error("A valid Supabase user ID is required to upload photos");
  }

  const supabase = getSupabaseClient();
  const path = buildFilePath(userId, extension);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    cacheControl: "3600",
    upsert: false,
    contentType: contentType ?? blob.type ?? "image/jpeg",
  });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Could not generate a public URL for the uploaded photo");
  }

  return data.publicUrl;
}

export async function saveProfilePhotoFromFile(file: File, userId: string): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be uploaded as profile photos");
  }

  const extension = file.name.split(".").pop();
  return uploadBlob({
    blob: file,
    userId,
    extension,
    contentType: file.type,
  });
}

export async function saveProfilePhotoFromUrl(url: string, userId: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("We could not fetch that photo. Check the link and try again.");
  }

  const blob = await response.blob();
  const contentType = response.headers.get("content-type") ?? blob.type;
  if (!contentType.startsWith("image/")) {
    throw new Error("The provided link does not point to an image");
  }

  const extension = contentType.split("/")[1]?.split(";")[0];
  return uploadBlob({
    blob,
    userId,
    extension,
    contentType,
  });
}
