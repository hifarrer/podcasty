"use client";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Navigation() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-[#333333] bg-[#222222]/80 backdrop-blur-sm sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto flex items-center justify-between p-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-white font-bold text-xl group-hover:opacity-80 transition-opacity">
              Podcasty
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/create" className="text-[#cccccc] hover:text-white transition-colors font-medium">
              Create
            </Link>
            <Link href="/episodes" className="text-[#cccccc] hover:text-white transition-colors font-medium">
              Episodes
            </Link>
            <Link href="/pricing" className="text-[#cccccc] hover:text-white transition-colors font-medium">
              Pricing
            </Link>
            <Link href="/profile" className="text-[#cccccc] hover:text-white transition-colors font-medium">
              Profile
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/create" className="btn-primary text-sm px-4 py-2">
            New Episode
          </Link>
          
          {status === "loading" ? (
            <div className="w-6 h-6 bg-gradient-to-r from-[#00c8c8] to-[#007bff] rounded-full animate-pulse"></div>
          ) : session ? (
            <div className="flex items-center gap-3">
              {session.user?.isAdmin && (
                <a href="/admin" className="btn-secondary text-sm px-3 py-2">Admin</a>
              )}
              <span className="text-sm text-[#cccccc] hidden sm:block">
                Hi, {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="btn-ghost text-sm px-3 py-2"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="btn-ghost text-sm px-3 py-2">
                Sign In
              </Link>
              <Link href="/register" className="btn-secondary text-sm px-3 py-2">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}
