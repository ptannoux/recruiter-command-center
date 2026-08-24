import Link from "next/link";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  return <main className="auth-shell"><section className="auth-card"><h1>Something went wrong</h1><p>{params.message || "Please return to the sign-in page and try again."}</p><Link className="button primary" href="/login">Back to sign in</Link></section></main>;
}
