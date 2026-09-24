import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import methanovaLogo from "../../assets/methanova-logo-full.png";
import { useAuth } from "../providers";

const loginFormSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type LoginForm = z.infer<typeof loginFormSchema>;

export function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginFormSchema) });

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate("/app", { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  });

  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm ring-1 ring-slate-200/70"
      >
        <div>
          <img src={methanovaLogo} alt="Methanova CRM" className="h-14 w-auto" />
          <p className="mt-2 text-sm text-slate-500">Sign in to continue</p>
        </div>
        <Field label="Email" htmlFor="email" error={errors.email?.message} required>
          <input id="email" type="email" autoComplete="username" {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} required>
          <input id="password" type="password" autoComplete="current-password" {...register("password")} />
        </Field>
        {serverError && (
          <p role="alert" className="text-sm text-rose-600">
            {serverError}
          </p>
        )}
        <Button type="submit" className="w-full" isPending={isSubmitting} pendingLabel="Signing in…">
          Sign in
        </Button>
      </form>
    </div>
  );
}
