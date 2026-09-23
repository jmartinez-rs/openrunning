export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 pt-5 pb-24 bg-background/80 backdrop-blur-md md:pb-5">
      <div className="flex flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row md:px-6">
        <p>OpenRunning — Athletic Running Operating System · {currentYear}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
          Running Performance OS
        </p>
      </div>
    </footer>
  )
}
