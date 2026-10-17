import { Suspense } from "react";
import { AuthForm } from "../../../features/auth/AuthForm";
export const metadata = { title: "Iniciar sesión" };
export default function Page() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
