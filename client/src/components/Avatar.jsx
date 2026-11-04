import { useState } from "react";
import { cx } from "./ui";

const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-24 w-24 text-3xl",
  xl: "h-32 w-32 text-4xl",
};

const initials = (name) =>
  String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";

// Shows the photo when there is one, and the person's initials otherwise
export default function Avatar({ id, v, name, hasPhoto = false, size = "md", className }) {
  const src = id ? `/api/profile/photo/${id}${v ? `?v=${v}` : ""}` : "";
  const [failedSrc, setFailedSrc] = useState(null);
  const showImg = hasPhoto && src && failedSrc !== src;

  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-accent-500 font-extrabold text-white ring-2 ring-white dark:ring-slate-700",
        SIZES[size],
        className
      )}
    >
      {showImg ? (
        <img
          src={src}
          alt={name ? `Photo of ${name}` : "Profile photo"}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
         loading="lazy"
          decoding="async"
        />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </span>
  );
}