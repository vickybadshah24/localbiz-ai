'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  CalendarDays,
  MessagesSquare,
  Settings2,
  Menu,
  Sun,
  Moon,
  Sparkles,
  Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { api, type Business } from '@/lib/api'
import WebChatDemo from '@/components/chat/WebChatDemo'

export type ViewKey = 'dashboard' | 'bookings' | 'inquiries' | 'settings'

const NAV: Array<{ key: ViewKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'bookings', label: 'Bookings', icon: CalendarDays },
  { key: 'inquiries', label: 'Inquiries', icon: MessagesSquare },
  { key: 'settings', label: 'Settings', icon: Settings2 },
]

const TITLES: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: "Today at a glance — bookings, conversations and revenue" },
  bookings: { title: 'Bookings', subtitle: 'Manage the calendar and confirm or reschedule appointments' },
  inquiries: { title: 'Inquiries', subtitle: 'AI-handled conversations from WhatsApp and the web chat' },
  settings: { title: 'Settings', subtitle: 'Business profile, AI behaviour, knowledge base and integrations' },
}

function NavButtons({
  active,
  onNavigate,
  onAfterClick,
}: {
  active: ViewKey
  onNavigate: (v: ViewKey) => void
  onAfterClick?: () => void
}) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {NAV.map((item) => {
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <button
            key={item.key}
            onClick={() => {
              onNavigate(item.key)
              onAfterClick?.()
            }}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function BusinessCard({ business }: { business: Business | undefined }) {
  if (!business) return null
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Store className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{business.name}</p>
          <p className="truncate text-xs text-muted-foreground">{business.industry}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant={business.whatsappConnected ? 'default' : 'secondary'} className="text-[10px]">
          WhatsApp {business.whatsappConnected ? 'connected' : 'sandbox'}
        </Badge>
        <Badge variant={business.autoReply ? 'default' : 'outline'} className="text-[10px]">
          Auto-reply {business.autoReply ? 'on' : 'off'}
        </Badge>
      </div>
    </div>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Toggle theme">
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

export default function AppShell({
  activeView,
  onNavigate,
  children,
}: {
  activeView: ViewKey
  onNavigate: (v: ViewKey) => void
  children: React.ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const { data } = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 30_000 })
  const business = data?.business

  const meta = TITLES[activeView]

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 sticky top-0 h-screen">
          <div className="flex items-center gap-2 px-2 pt-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">LocalBiz AI</p>
              <p className="text-xs text-muted-foreground">AI front desk</p>
            </div>
          </div>
          <NavButtons active={activeView} onNavigate={onNavigate} />
          <div className="mt-auto pb-2">
            <BusinessCard business={business} />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex-1 min-w-0 flex flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center gap-3 px-4 md:px-6">
              {/* Mobile nav */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-4">
                  <SheetTitle className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    LocalBiz AI
                  </SheetTitle>
                  <NavButtons active={activeView} onNavigate={onNavigate} onAfterClick={() => setMobileOpen(false)} />
                  <div className="mt-6">
                    <BusinessCard business={business} />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base md:text-lg font-semibold leading-tight">{meta.title}</h1>
                <p className="hidden md:block truncate text-xs text-muted-foreground">{meta.subtitle}</p>
              </div>

              <Button variant="outline" size="sm" className="gap-2" onClick={() => setChatOpen(true)}>
                <MessagesSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Try customer chat</span>
              </Button>
              <ThemeToggle />
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-6">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="mx-auto max-w-6xl"
            >
              {children}
            </motion.div>
          </main>

          <footer className="mt-auto border-t">
            <div className="flex h-12 items-center justify-between px-4 md:px-6 text-xs text-muted-foreground">
              <p>LocalBiz AI — demo workspace, data is simulated</p>
              <Link href="/api/dashboard" className="hover:text-foreground">
                API
              </Link>
            </div>
          </footer>
        </div>
      </div>

      <WebChatDemo open={chatOpen} onOpenChange={setChatOpen} business={business} />
    </div>
  )
}
