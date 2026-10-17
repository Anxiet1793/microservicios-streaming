import { Suspense } from "react";
import { AuthForm } from "../../../features/auth/AuthForm";
export const metadata = { title: "Crear cuenta" };
export default function Page() {
  return (
    <Suspense>
      <AuthForm register />
    </Suspense>
  );
}
