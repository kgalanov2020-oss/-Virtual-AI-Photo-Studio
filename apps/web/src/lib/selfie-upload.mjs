export const MAX_SELFIE_BYTES = 10 * 1024 * 1024;

const contentTypeByExtension = new Map([
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["heic", "image/heic"],
  ["heif", "image/heif"],
  ["avif", "image/avif"],
]);

const acceptedContentTypes = new Set(contentTypeByExtension.values());

export function sanitizeSelfieFileName(name) {
  const sanitized = String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");

  return sanitized || "photo.jpg";
}

export function resolveSelfieContentType(name, reportedType) {
  const normalizedType = String(reportedType ?? "").trim().toLowerCase();
  if (acceptedContentTypes.has(normalizedType)) return normalizedType;

  const extension = String(name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return contentTypeByExtension.get(extension) ?? null;
}

export function buildSelfieStoragePath({ userId, jobId, slot, fileName }) {
  if (!Number.isInteger(slot) || slot < 1 || slot > 12) {
    throw new Error("Недопустимый номер фото.");
  }

  return `${userId}/${jobId}/${String(slot).padStart(2, "0")}-${sanitizeSelfieFileName(fileName)}`;
}
