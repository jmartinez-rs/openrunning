import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { BarChart3, CalendarDays, Flame, Home, Trophy } from "lucide-react"

import { Footer } from "@/components/Common/Footer"
import TopNavbar from "@/components/Navbar/TopNavbar"
import { isLoggedIn } from "@/hooks/useAuth"

export const Route = createFileRoute("/_layout")({
  component: Layout,
  beforeLoad: async () => {
    if (!isLoggedIn()) {
      throw redirect({
        to: "/login",
      })
    }
  },
})

function Layout() {
  return (
    <div className="relative w-full min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950">
      <TopNavbar />

      <main className="w-full pt-20 pb-20 md:pb-12">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6">
          <Outlet />
        </div>
      </main>

      <Footer />

      <MobileBottomNav />
    </div>
  )
}

function MobileBottomNav() {
  const items = [
    { icon: Home, label: "Inicio", to: "/" },
    { icon: CalendarDays, label: "Actividades", to: "/activities" },
    { icon: Flame, label: "Planes", to: "/routines" },
    { icon: Trophy, label: "Carreras", to: "/races" },
    { icon: BarChart3, label: "Analítica", to: "/analytics" },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md md:hidden">
      <div className="grid h-full grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center gap-1 text-slate-400 transition-colors hover:text-emerald-400"
              activeProps={{
                className:
                  "flex flex-col items-center justify-center gap-1 text-emerald-400 font-bold",
              }}
            >
              <Icon className="size-5" strokeWidth={2} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
