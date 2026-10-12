'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Tooltip from '@/shared/ui/Tooltip'
import { Dialog } from '@/shared/ui/Dialog'
import { LEARNING_SURFACES } from './surfaces'
import { useChatWorkspaces } from '@/hooks/useChatWorkspaces'
import { useAuthStatus } from '@/hooks/useAuthStatus'
import { activeWorkspaceId, navigateTask, scopedUrl } from '@/lib/workspace-scope'
import { pageActionClass } from '@/components/layout/FeaturePage'
import { useSidebarDrawer } from '@/components/layout/AppShell'

export function LearningCreateMenu({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const router = useRouter()
  const drawer = useSidebarDrawer()
  const [open, setOpen] = useState(false)
  const [destination, setDestination] = useState(activeWorkspaceId)
  const { workspaces, error } = useChatWorkspaces()
  const { learningPolicy } = useAuthStatus()
  const surfaces = LEARNING_SURFACES.filter(
    item =>
      !learningPolicy ||
      learningPolicy.allowedSurfaces.includes(
        item.kind === 'mastery' || item.kind === 'practice' ? 'chat' : item.kind
      )
  )
  return (
    <>
      <Tooltip label={t('navigation.createLearning')} suppressed={open}>
        <button
          type="button"
          aria-label={t('navigation.createLearning')}
          onClick={() => {
            setDestination(activeWorkspaceId())
            setOpen(true)
          }}
          className={compact ? 'dt-nav-icon' : pageActionClass()}
        >
          <Plus size={compact ? 17 : 15} />
          {!compact && t('navigation.createLearning')}
        </button>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t('navigation.createLearning')}
        description={t('navigation.createLearningDescription')}
        closeLabel={t('Close')}
      >
        <div className="mb-5">
          <label
            className="text-xs text-muted-foreground"
            htmlFor={compact ? 'sidebar-create-workspace' : 'page-create-workspace'}
          >
            {t('Save to workspace')}
          </label>
          <select
            id={compact ? 'sidebar-create-workspace' : 'page-create-workspace'}
            value={destination}
            onChange={event => setDestination(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="">{t('Default workspace')}</option>
            {workspaces
              .filter(row => !row.archived && row.status === 'ready')
              .map(row => (
                <option key={row.workspace_id} value={row.workspace_id}>
                  {row.display_name}
                </option>
              ))}
          </select>
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {surfaces.map(item => (
            <button
              key={item.kind}
              type="button"
              className="rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              onClick={() => {
                setOpen(false)
                drawer?.close()
                navigateTask(scopedUrl(`${item.href}?create=1`, destination), router.push)
              }}
            >
              <item.icon size={22} strokeWidth={1.6} className="mb-3 text-muted-foreground" />
              <span className="block text-sm font-medium">{t(item.title)}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {t(item.description)}
              </span>
            </button>
          ))}
        </div>
      </Dialog>
    </>
  )
}
