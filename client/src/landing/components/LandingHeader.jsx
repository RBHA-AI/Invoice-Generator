import { Link } from 'react-router-dom';

export function LandingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#e5e7eb]/80 bg-[#f3f4f6]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 no-underline">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111827] text-xs font-bold text-[#d4af37]">
            IC
          </span>
          <span className="inv-display text-lg font-semibold tracking-tight text-[#111827]">
            Invoice Creation
          </span>
        </Link>
        <Link
          to="/login"
          className="inv-btn-primary inline-flex items-center rounded-xl px-5 py-2.5 text-sm font-semibold no-underline"
        >
          Login
        </Link>
      </div>
    </header>
  );
}
