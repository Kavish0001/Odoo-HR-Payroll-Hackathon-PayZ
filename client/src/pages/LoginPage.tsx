import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@payz/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';

import { toApiError } from '../api/client.js';
import { Backdrop } from '../components/brand/Backdrop.js';
import { Logo } from '../components/brand/Logo.js';
import { useAuth } from '../lib/auth.js';
import { homePathFor } from '../lib/utils.js';

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
      const signedIn = await signIn(values.email, values.password);
      // Routed on the role that just signed in, not on context state: the
      // provider has not re-rendered this component yet.
      void navigate(homePathFor(signedIn), { replace: true });
    } catch (error) {
      setFormError(toApiError(error).message);
    }
  });

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center px-6">
      <Backdrop density="minimal" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={64} withWordmark />
          <p className="eyebrow mt-8">// System console</p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight">
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
          className="border-steel-300 bg-raised space-y-5 rounded-sm border p-7"
          noValidate
        >
          <div>
            <label htmlFor="email" className="eyebrow mb-1.5 block">
              Work Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="employee@company.com"
              aria-invalid={errors.email !== undefined}
              className="border-steel-300 focus:border-signal w-full rounded-sm border px-3 py-2 text-sm outline-none"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-danger mt-1 text-xs">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="eyebrow mb-1.5 block">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              aria-invalid={errors.password !== undefined}
              className="border-steel-300 focus:border-signal font-mono w-full rounded-sm border px-3 py-2 text-sm outline-none"
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
              className="border-danger-line bg-danger-soft text-ink rounded-sm border px-3 py-2 text-xs"
            >
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-signal font-mono w-full rounded-sm px-3 py-3 text-[11px] tracking-wider text-white uppercase transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="eyebrow mt-6 text-center">
          Accounts are created by an administrator.
        </p>
      </div>
    </main>
  );
}
