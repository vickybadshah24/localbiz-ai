'use client'

import { useState } from 'react'
import AppShell, { type ViewKey } from '@/components/layout/AppShell'
import DashboardView from '@/components/dashboard/DashboardView'
import BookingsView from '@/components/calendar/BookingsView'
import InquiriesView from '@/components/chat/InquiriesView'
import SettingsView from '@/components/settings/SettingsView'

export default function Home() {
  const [view, setView] = useState<ViewKey>('dashboard')
  const [focusInquiryId, setFocusInquiryId] = useState<string | null>(null)

  const goToInquiry = (id: string) => {
    setFocusInquiryId(id)
    setView('inquiries')
  }

  return (
    <AppShell activeView={view} onNavigate={(v) => setView(v)}>
      {view === 'dashboard' && <DashboardView onSelectInquiry={goToInquiry} />}
      {view === 'bookings' && <BookingsView />}
      {view === 'inquiries' && <InquiriesView focusId={focusInquiryId} />}
      {view === 'settings' && <SettingsView />}
    </AppShell>
  )
}
