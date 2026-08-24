import { login, signup } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const params = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="eyebrow">PRIVATE WORKSPACE</div>
        <h1>Recruiter Command Center</h1>
        <p>Sign in to your private executive-search workspace.</p>
        {params.message ? <div className="flash">{params.message}</div> : null}
        <form className="auth-form">
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required minLength={8} autoComplete="current-password" /></label>
          <div className="auth-actions">
            <button formAction={login} className="button primary">Sign in</button>
            <button formAction={signup} className="button">Create account</button>
          </div>
        </form>
      </section>
    </main>
  );
}
