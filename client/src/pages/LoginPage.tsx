import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@payz/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { toApiError } from '../api/client.js';
import { Logo } from '../components/brand/Logo.js';
import { useAuth } from '../lib/auth.js';

export function LoginPage(): React.JSX.Element {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signIn(values.email, values.password);
      void navigate('/employees', { replace: true });
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={72} />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted mt-1 text-sm">
            Sign in to continue to your workspace.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="border-line bg-raised space-y-4 rounded-lg border p-6"
          noValidate
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-xs font-medium tracking-wide uppercase"
            >
              Work Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="employee@company.com"
              aria-invalid={errors.email !== undefined}
              className="border-line focus:border-metal-700 w-full rounded-md border px-3 py-2 outline-none"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-danger mt-1 text-xs">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-xs font-medium tracking-wide uppercase"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              aria-invalid={errors.password !== undefined}
              className="border-line focus:border-metal-700 w-full rounded-md border px-3 py-2 font-mono outline-none"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-danger mt-1 text-xs">
                {errors.password.message}
              </p>
            )}
          </div>

          {formError !== null && (
            <p
              role="alert"
              className="border-danger/30 bg-danger/5 text-danger rounded-md border px-3 py-2 text-sm"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-metal-900 w-full rounded-md px-3 py-2 font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-muted mt-4 text-center text-xs">
          Accounts are created by an administrator.
        </p>
      </div>
    </main>
  );
}
