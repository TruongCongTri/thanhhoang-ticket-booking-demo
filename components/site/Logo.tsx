import Image from "next/image";
import { BRAND } from "@/lib/brand";

/** The logo file is already loaded by the loading screen, so every copy loads eagerly. */
export default function Logo({ className }: { className: string }) {
  return (
    <Image
      src={BRAND.logo.src}
      width={BRAND.logo.width}
      height={BRAND.logo.height}
      alt={BRAND.name}
      loading="eager"
      className={`w-auto ${className}`}
    />
  );
}
