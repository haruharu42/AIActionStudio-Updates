import type { ImgHTMLAttributes } from "react";

export type DirectRuntimeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt"> & {
  alt: string;
};

export function DirectRuntimeImage({ alt, ...props }: DirectRuntimeImageProps) {
  // eslint-disable-next-line @next/next/no-img-element -- Blob/Object URLs and expiring signed URLs must render directly without an optimizer fetch.
  return <img alt={alt} {...props} />;
}
