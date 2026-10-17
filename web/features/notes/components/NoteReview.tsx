'use client'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Link from 'next/link'
import { noteRequest } from '@/lib/notes-api'
import PickerShell from '@/components/common/PickerShell'
interface Card {
  page_id: string
  page_title: string
  block_id: string
  card_id: string
  front: string
  back: string
}
export default function NoteReview() {
  const { t } = useTranslation()
  const [cards, setCards] = useState<Card[]>([])
  const [open, setOpen] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void noteRequest<{ cards: Card[] }>('/review/due')
      .then(r => setCards(r.cards))
      .catch(e => setError(String(e)))
  }, [])
  const card = cards[0]
  const grade = async (remembered: boolean) => {
    setBusy(true)
    try {
      await noteRequest(`/${card.page_id}/review`, { card_id: card.card_id, remembered })
      setCards(c => c.slice(1))
      setRevealed(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--secondary)]"
        onClick={() => setOpen(true)}
      >
        {t('Review flashcards')}{' '}
        <span className="text-[var(--muted-foreground)]">{cards.length}</span>
      </button>
      <PickerShell open={open} onClose={() => setOpen(false)} ariaLabel={t('Review flashcards')}>
        <div className="w-[min(520px,90vw)] rounded-xl bg-[var(--card)] p-6 text-center">
          {card ? (
            <>
              <Link
                href={`/co-writer/${card.page_id}#${card.block_id}`}
                className="text-xs text-[var(--muted-foreground)]"
              >
                {card.page_title} ↗
              </Link>
              <p className="my-8 text-lg">{card.front}</p>
              {revealed ? (
                <>
                  <p className="mb-8 text-base">{card.back}</p>
                  <div className="flex justify-center gap-4">
                    <button disabled={busy} onClick={() => void grade(false)}>
                      {t('Again')}
                    </button>
                    <button disabled={busy} onClick={() => void grade(true)}>
                      {t('Remembered')}
                    </button>
                  </div>
                </>
              ) : (
                <button onClick={() => setRevealed(true)}>{t('Show answer')}</button>
              )}
            </>
          ) : (
            <p>{t('All caught up')}</p>
          )}
          {error && <p role="alert">{error}</p>}
          <button
            className="mt-5 text-sm text-[var(--muted-foreground)]"
            onClick={() => setOpen(false)}
          >
            {t('Close')}
          </button>
        </div>
      </PickerShell>
    </>
  )
}
