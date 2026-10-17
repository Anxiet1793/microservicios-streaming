"use client";
import { useState } from "react";
export function Picture({
  src,
  children,
}: {
  src?: string;
  children: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : (
    children
  );
}
