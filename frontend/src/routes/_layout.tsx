import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

import { Footer } from "@/components/Common/Footer"
import { MobileTabBar } from "@/components/Navbar/MobileTabBar"
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

      <main className="w-full pt-20 pb-24 md:pb-12">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6">
          <Outlet />
        </div>
      </main>

      <Footer />

      <MobileTabBar />
    </div>
  )
}
