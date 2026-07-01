export function preferWebpAsset(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  return url.replace(/\.(png|jpe?g)$/i, ".webp");
}
