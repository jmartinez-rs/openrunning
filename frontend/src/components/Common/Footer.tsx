export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-slate-800/60 py-5 bg-slate-950/80 backdrop-blur-md">
      <div className="flex flex-col items-center justify-between gap-3 px-4 text-xs text-slate-400 sm:flex-row md:px-6">
        <p>OpenRunning — Athletic Running Operating System · {currentYear}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
          Running Performance OS
        </p>
      </div>
    </footer>
  )
}
