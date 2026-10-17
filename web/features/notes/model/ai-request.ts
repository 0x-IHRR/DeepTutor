export interface NoteAIRequest {
  id: number
  prompt: string
  knowledgeRef?: string
  mode?: string
  blockId?: string
  instructions?: string
  autoSend?: boolean
  config?: Record<string, unknown>
}

/** Context is sent to the model, but stays out of restored chat bubbles. */
export function visibleNotePrompt(content: string): string {
  return content
    .split(
      /\n(?:\n)?(?:<note-generation-context>|<notebook-source>|Learning block kind:|Use note_read then note_suggest|Target block:)/
    )[0]
    .trim()
}
export function learningMode(kind: string): string {
  return (
    (
      {
        research: 'deep_research',
        quiz: 'deep_question',
        animation: 'math_animator',
        audio: 'audio_overview',
      } as Record<string, string>
    )[kind] || 'chat'
  )
}
