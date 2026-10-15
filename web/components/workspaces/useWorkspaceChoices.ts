'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { useChatWorkspaces } from '@/hooks/useChatWorkspaces'
import { selectWorkspace } from '@/lib/workspace-scope'

/** Switching lands on the section's index: a detail page belongs to the old workspace. */
function switchDestination(pathname: string): string {
  const section = pathname.split('/')[1]
  return section ? `/${section}` : '/chat'
}

/** The workspace this URL is scoped to, the ones it can switch to, and the switch. */
export function useWorkspaceChoices() {
  const { t } = useTranslation()
  const pathname = usePathname() ?? '/'
  const query = useSearchParams()
  const active = query.get('dt_workspace') ?? query.get('workspace') ?? ''
  const { workspaces } = useChatWorkspaces()
  const current = workspaces.find(row => row.workspace_id === active)
  const currentName = active ? (current?.display_name ?? t('Workspace unavailable')) : t('General workspace')
  const choices = [
    { workspace_id: '', display_name: t('General workspace') },
    ...workspaces.filter(row => row.workspace_id === active || (!row.archived && row.status === 'ready')),
  ]
  const choose = (workspaceId: string) => {
    if (workspaceId !== active) void selectWorkspace(workspaceId, switchDestination(pathname))
  }
  return { active, currentName, choices, choose }
}
