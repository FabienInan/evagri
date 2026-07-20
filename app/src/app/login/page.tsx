import { LoginForm } from "@/components/login-form"

export const dynamic = "force-dynamic"

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <span className="text-2xl font-bold text-primary-foreground">E</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Evagri</h1>
          <p className="mt-2 text-muted-foreground">Connectez-vous pour accéder à l'application</p>
        </div>
        <LoginForm />
      </div>
    </main>
  )
}
