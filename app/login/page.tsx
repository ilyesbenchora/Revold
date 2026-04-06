import { RevoldLogo } from "@/components/revold-logo";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <RevoldLogo tone="dark" />
        <h1 className="mt-6 text-2xl font-semibold text-white">Connexion</h1>
        <p className="mt-2 text-sm text-slate-400">
          Accédez à votre plateforme d&apos;intelligence revenue.
        </p>

        <LoginForm />
      </section>
    </main>
  );
}
