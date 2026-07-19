export const MAX_SELFIE_BYTES: number;

export function sanitizeSelfieFileName(name: string): string;

export function resolveSelfieContentType(
  name: string,
  reportedType: string,
): string | null;

export function buildSelfieStoragePath(options: {
  userId: string;
  jobId: string;
  slot: number;
  fileName: string;
}): string;
