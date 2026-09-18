import { Appearance } from "@/components/Common/Appearance"
import { Footer } from "./Footer"
import { Logo } from "./Logo"

interface AuthLayoutProps {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-svh flex-col bg-slate-950 text-slate-100">
      {/* Tonal accent: subtle radial glow behind the card */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#10b981_0%,transparent_60%)] opacity-10" />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-6 md:p-10">
        <div className="flex justify-end">
          <Appearance />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
              <Logo asLink={false} showSubtitle={true} />
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md md:p-8">
              {children}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
