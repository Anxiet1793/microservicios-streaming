"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
export function SearchField({ value, base }: { value: string; base: string }) {
  const router = useRouter(),
    params = useSearchParams(),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <input
      name="q"
      value={text}
      maxLength={100}
      placeholder="Título o palabra clave"
      onChange={(e) => {
        const q = e.target.value;
        setText(q);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          const next = new URLSearchParams(params.toString());
          if (q.trim()) next.set("q", q.trim());
          else next.delete("q");
          next.delete("page");
          router.replace(`${base}?${next}`, { scroll: false });
        }, 300);
      }}
    />
  );
}
