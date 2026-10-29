'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, type KnowledgeCategory, type KnowledgeEntry } from '@/lib/api'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CATEGORIES: KnowledgeCategory[] = ['pricing', 'policy', 'faq', 'services', 'general']

interface FormState {
  id?: string
  title: string
  content: string
  category: KnowledgeCategory
}

const EMPTY: FormState = { title: '', content: '', category: 'general' }

export default function KnowledgePanel() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState | null>(null)

  const entriesQuery = useQuery({ queryKey: ['knowledge'], queryFn: api.knowledge })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['knowledge'] })

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form) throw new Error('Nothing to save')
      const payload = { title: form.title.trim(), content: form.content.trim(), category: form.category }
      return form.id ? api.updateKnowledge(form.id, payload) : api.createKnowledge(payload)
    },
    onSuccess: () => {
      invalidate()
      setForm(null)
      toast.success('Knowledge entry saved — the AI will use it immediately')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: (entry: KnowledgeEntry) => api.updateKnowledge(entry.id, { active: !entry.active }),
    onSuccess: () => {
      invalidate()
      toast.success('Entry updated')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteKnowledge(id),
    onSuccess: () => {
      invalidate()
      toast.success('Entry deleted')
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const entries = entriesQuery.data ?? []

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4 text-primary" /> Knowledge base
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Everything the AI assistant knows beyond services & hours. Entries are matched by relevance to each question.
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...EMPTY })}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </CardHeader>
      <CardContent>
        {entriesQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No entries yet — add policies, prices or FAQs so the AI can answer accurately.
          </p>
        ) : (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{entry.title}</p>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wide">{entry.category}</Badge>
                      {!entry.active && <Badge variant="secondary" className="text-[9px]">disabled</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.content}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={entry.active}
                      onCheckedChange={() => toggleMutation.mutate(entry)}
                      aria-label={`Toggle ${entry.title}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit ${entry.title}`}
                      onClick={() => setForm({ id: entry.id, title: entry.title, content: entry.content, category: entry.category })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => {
                        if (window.confirm(`Delete "${entry.title}"?`)) deleteMutation.mutate(entry.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Add / edit dialog */}
      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit entry' : 'New knowledge entry'}</DialogTitle>
            <DialogDescription>The AI cites this information when customers ask related questions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                value={form?.title ?? ''}
                onChange={(e) => setForm((f) => (f ? { ...f, title: e.target.value } : f))}
                placeholder="e.g. Cancellation policy"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select
                value={form?.category ?? 'general'}
                onValueChange={(v) => setForm((f) => (f ? { ...f, category: v as KnowledgeCategory } : f))}
              >
                <SelectTrigger aria-label="Category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="kb-content">Content</Label>
              <Textarea
                id="kb-content"
                rows={5}
                value={form?.content ?? ''}
                onChange={(e) => setForm((f) => (f ? { ...f, content: e.target.value } : f))}
                placeholder="What should the assistant know?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form?.title.trim() || !form?.content.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
