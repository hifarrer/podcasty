"use client";
import { useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      if (res.ok) {
        setResult({ ok: true });
        setName("");
        setEmail("");
        setMessage("");
      } else {
        const data = await res.json().catch(() => ({} as any));
        setResult({ ok: false, error: data?.error || "Failed to send" });
      }
    } catch (e: any) {
      setResult({ ok: false, error: e?.message || "Network error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-[#cccccc]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold gradient-text mb-6">Contact Us</h1>
        <p className="mb-8 text-[#aaaaaa]">Have a question or feedback? Send us a message and we’ll get back to you.</p>

        {result?.ok && (
          <div className="mb-6 rounded-lg p-3 bg-[#66cc66]/10 border border-[#66cc66]/20 text-[#66cc66]">Message sent successfully.</div>
        )}
        {result?.error && (
          <div className="mb-6 rounded-lg p-3 bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444]">{result.error}</div>
        )}

        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">Name</label>
            <input
              className="input-field w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">Email</label>
            <input
              type="email"
              className="input-field w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm text-[#cccccc] mb-1">Message</label>
            <textarea
              className="input-field w-full min-h-[160px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>
          <div>
            <button type="submit" className="btn-primary" disabled={sending}>{sending ? "Sending..." : "Send Message"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


