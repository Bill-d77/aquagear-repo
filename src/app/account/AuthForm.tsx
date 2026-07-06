"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function AuthForm() {
  const search = useSearchParams();
  const router = useRouter();
  const redirect = search.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sign up");
      await signIn("credentials", { email, password, redirect: false });
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) {
      setMessage("Invalid email or password");
    } else {
      router.push(redirect);
      router.refresh();
    }
    setLoading(false);
  }

  const inputCls = "border rounded-lg w-full p-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="max-w-xl card">
      <div className="flex gap-4 border-b mb-4">
        <button className={`py-2 ${tab === "signin" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-500"}`} onClick={() => setTab("signin")}>Sign in</button>
        <button className={`py-2 ${tab === "signup" ? "border-b-2 border-sky-600 text-sky-700" : "text-gray-500"}`} onClick={() => setTab("signup")}>Sign up</button>
      </div>
      {tab === "signin" ? (
        <form onSubmit={handleSignin} className="space-y-3">
          <div>
            <label htmlFor="signin-email" className={labelCls}>Email</label>
            <input id="signin-email" className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="signin-password" className={labelCls}>Password</label>
            <input id="signin-password" className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-3">
          <div>
            <label htmlFor="signup-name" className={labelCls}>Name</label>
            <input id="signup-name" className={inputCls} type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="signup-email" className={labelCls}>Email</label>
            <input id="signup-email" className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="signup-password" className={labelCls}>Password (min 8 characters)</label>
            <input id="signup-password" className={inputCls} type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
        </form>
      )}
      {message && <p className="text-sm mt-3 text-red-600">{message}</p>}
    </div>
  );
}
