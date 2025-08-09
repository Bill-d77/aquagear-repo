"use client";
import { signIn, signOut, useSession } from "next-auth/react";
import { useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function Account() {
  return (
    <Suspense fallback={<div className="max-w-xl card">Loading...</div>}>
      <AccountContent />
    </Suspense>
  );
}

function AccountContent() {
  const { data: session } = useSession();
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
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    if ((res as any)?.error) {
      setMessage("Invalid email or password");
    } else {
      router.push(redirect);
    }
    setLoading(false);
  }

  if (session?.user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Hello {session.user.name}</h1>
        <p>Role, {(session.user as any).role}</p>
        <button onClick={()=>signOut()} className="btn-outline">Sign out</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl card">
      <div className="flex gap-4 border-b mb-4">
        <button className={`py-2 ${tab==="signin"?"border-b-2 border-sky-600 text-sky-700":"text-gray-500"}`} onClick={()=>setTab("signin")}>Sign in</button>
        <button className={`py-2 ${tab==="signup"?"border-b-2 border-sky-600 text-sky-700":"text-gray-500"}`} onClick={()=>setTab("signup")}>Sign up</button>
      </div>
      {tab === "signin" ? (
        <form onSubmit={handleSignin} className="space-y-3">
          <input className="border rounded w-full p-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="border rounded w-full p-2" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={loading}>{loading?"Signing in...":"Sign in"}</button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-3">
          <input className="border rounded w-full p-2" type="text" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} />
          <input className="border rounded w-full p-2" type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="border rounded w-full p-2" type="password" placeholder="Password (min 6)" value={password} onChange={e=>setPassword(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
        </form>
      )}
      {message && <p className="text-sm mt-3 text-red-600">{message}</p>}
    </div>
  );
}
