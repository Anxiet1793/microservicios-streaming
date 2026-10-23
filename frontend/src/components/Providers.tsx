"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            gcTime: 300000,
            retry: false,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  useEffect(() => {
    const expired = () => {
      client.clear();
      window.location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
    };
    window.addEventListener("nevaro:expired", expired);
    return () => window.removeEventListener("nevaro:expired", expired);
  }, [client]);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
