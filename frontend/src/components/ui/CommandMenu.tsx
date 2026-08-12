import React, { useEffect } from "react"
import { Command } from "cmdk"
import { useRouter } from "next/navigation"
import { Search, LayoutDashboard, User, Settings, PlusCircle } from "lucide-react"

interface CommandMenuProps {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

export function CommandMenu({ isOpen, setIsOpen }: CommandMenuProps) {
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  const handleSelect = (path: string) => {
    router.push(path)
    setIsOpen(false)
  }

  return (
    <div
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 bg-[#020617]/70 backdrop-blur-md z-50 flex items-start justify-center pt-[15vh] px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#090f1e] border border-white/10 rounded-2xl shadow-[0_24px_50px_rgba(0,0,0,0.4)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <Command label="Global Command Menu" className="w-full flex flex-col">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 bg-white/2">
            <Search className="h-5 w-5 text-slate-400 shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Type a command or search page... (Ctrl+K)"
              className="w-full bg-transparent text-sm text-white placeholder-slate-500 border-none outline-none focus:ring-0 focus:outline-none"
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-2.5 space-y-1">
            <Command.Empty className="text-xs text-slate-500 p-4 text-center">No results found.</Command.Empty>
            
            <Command.Group heading="Navigation" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2.5 py-1.5">
              <Command.Item
                onSelect={() => handleSelect("/dashboard")}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <LayoutDashboard className="h-4.5 w-4.5 text-indigo-400" />
                <span>Go to Dashboard</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("/create-quiz")}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <PlusCircle className="h-4.5 w-4.5 text-cyan-400" />
                <span>Create a New Quiz</span>
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Account" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2.5 py-1.5 mt-2">
              <Command.Item
                onSelect={() => handleSelect("/profile")}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <User className="h-4.5 w-4.5 text-slate-400" />
                <span>My Profile Identity</span>
              </Command.Item>
              <Command.Item
                onSelect={() => handleSelect("/settings")}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors"
              >
                <Settings className="h-4.5 w-4.5 text-slate-400" />
                <span>Platform Settings</span>
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
