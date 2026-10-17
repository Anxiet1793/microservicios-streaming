import type { Metadata } from "next";
import { Providers } from "../components/Providers";
import "../styles/globals.css";
export const metadata: Metadata = {
  title: { default: "NÉVARO · Tu próxima historia", template: "%s · NÉVARO" },
  description: "Tu espacio para descubrir y continuar historias.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
