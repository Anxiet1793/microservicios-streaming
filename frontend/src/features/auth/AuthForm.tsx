"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { api, ApiError } from "../../lib/api/client";
import { safeReturn } from "../../lib/models";
import s from "./auth.module.css";
const schema = z.object({
  email: z.email("Introduce un correo válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
  displayName: z.string().optional(),
});
type Values = z.infer<typeof schema>;
export function AuthForm({
  register: creating = false,
}: {
  register?: boolean;
}) {
  const router = useRouter(),
    params = useSearchParams();
  const [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [done, setDone] = useState(false),
    [cooldown, setCooldown] = useState(0);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", displayName: "" },
  });
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const submit = handleSubmit(async (values) => {
    setError("");
    if (
      creating &&
      (!values.displayName?.trim() ||
        values.password.length < 12 ||
        values.password.length > 128)
    ) {
      setError("Escribe tu nombre y una contraseña de 12 a 128 caracteres.");
      return;
    }
    try {
      await api(
        creating ? "auth/register" : "auth/login",
        "POST",
        creating ? values : { email: values.email, password: values.password },
      );
      if (creating) setDone(true);
      else {
        router.replace(safeReturn(params.get("next")));
        router.refresh();
      }
    } catch (e) {
      if (e instanceof ApiError && e.retryAfter) setCooldown(e.retryAfter);
      setError(
        e instanceof Error
          ? e.message
          : "No pudimos conectar. Inténtalo otra vez.",
      );
    }
  });
  if (done)
    return (
      <>
        <span className="eyebrow">BIENVENIDO A NÉVARO</span>
        <h1>Tu cuenta está lista.</h1>
        <p className="muted">Inicia sesión y encuentra tu próxima historia.</p>
        <Link className="button" href="/login">
          Iniciar sesión <ArrowRight size={17} />
        </Link>
      </>
    );
  return (
    <>
      <span className="eyebrow">TU SALA PERSONAL</span>
      <h1>
        {creating ? "Empieza una nueva historia." : "Vuelve a tus historias."}
      </h1>
      <p className={s.intro}>
        {creating
          ? "Crea tu cuenta. El resto empieza con una buena película."
          : "Entra, encuentra algo que te mueva y continúa donde lo dejaste."}
      </p>
      {params.get("logout") === "local" && (
        <p className="error">
          Cerramos la sesión en este dispositivo. No pudimos confirmar el cierre
          remoto.
        </p>
      )}
      <form onSubmit={submit} noValidate>
        {creating && (
          <label className="field">
            <span>Nombre visible</span>
            <input
              {...register("displayName")}
              autoComplete="nickname"
              maxLength={100}
              required
            />
          </label>
        )}
        <label className="field">
          <span>Correo electrónico</span>
          <input
            {...register("email")}
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            maxLength={254}
          />
          {errors.email && (
            <span className="hint" id="email-error">
              {errors.email.message}
            </span>
          )}
        </label>
        <label className="field">
          <span>Contraseña</span>
          <span className={s.password}>
            <input
              {...register("password")}
              aria-label="Contraseña"
              type={show ? "text" : "password"}
              autoComplete={creating ? "new-password" : "current-password"}
              maxLength={128}
              aria-invalid={!!errors.password}
              aria-describedby="password-hint"
            />
            <button
              type="button"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </span>
          <span className="hint" id="password-hint">
            {errors.password?.message ||
              (creating
                ? "Entre 12 y 128 caracteres. Puedes pegar tu contraseña."
                : "Tu cuenta, tus historias, tu ritmo.")}
          </span>
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className={`button ${s.submit}`}
          disabled={isSubmitting || cooldown > 0}
          aria-busy={isSubmitting}
        >
          {cooldown > 0
            ? `Espera ${cooldown} s`
            : isSubmitting
              ? "Un momento…"
              : creating
                ? "Crear cuenta"
                : "Entrar"}
          <ArrowRight size={17} />
        </button>
      </form>
      <p className={s.switch}>
        {creating ? "¿Ya tienes una cuenta?" : "¿Primera vez por aquí?"}{" "}
        <Link href={creating ? "/login" : "/register"}>
          {creating ? "Inicia sesión" : "Crea tu cuenta"}
        </Link>
      </p>
    </>
  );
}
