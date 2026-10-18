'use client'

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import HeaderActionButton from '@/features/chat/components/HeaderActionButton'
import { addDays, dateKey, formatWeekday, fromDateKey } from '../model/dates'
import { lastDay, withAllDay, type EventDraft } from '../model/draft'
import {
  buildRule,
  defaultRule,
  detectPreset,
  parseRule,
  presetRule,
  type Frequency,
  type RepeatPreset,
} from '../model/recurrence'
import type { CalendarEntry, EditScope } from '../transport/api'
import { calendarName, CALENDAR_COLORS } from './CalendarRail'

function dateValue(date: Date, allDay: boolean) {
  if (allDay) return dateKey(date)
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function EventEditor({
  initial,
  calendars,
  recurring,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: EventDraft
  calendars: CalendarEntry[]
  recurring: boolean
  busy: boolean
  error: string
  onSave: (draft: EventDraft, scope: EditScope) => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [draft, setDraft] = useState(initial)
  const [scope, setScope] = useState<EditScope>('this')
  const [preset, setPreset] = useState<RepeatPreset>(detectPreset(initial.rrule, initial.start))
  const [rule, setRule] = useState(parseRule(initial.rrule) ?? defaultRule('WEEKLY', initial.start))
  const [customReminder, setCustomReminder] = useState(10)
  const change = (patch: Partial<EventDraft>) => setDraft(d => ({ ...d, ...patch }))
  const applyRule = (next: typeof rule) => {
    setRule(next)
    if (recurring) setScope('all')
    change({ rrule: buildRule(next, draft.allDay) })
  }
  const valid = Number.isFinite(draft.start.getTime()) && draft.end > draft.start
  return (
    <form
      className="dt-cal-editor"
      onSubmit={event => {
        event.preventDefault()
        if (valid && !busy)
          onSave(
            draft,
            recurring ? (draft.rrule !== initial.rrule && scope === 'this' ? 'all' : scope) : 'all'
          )
      }}
    >
      <div className="dt-cal-editor-head">
        <strong>{t(recurring ? 'Edit event' : 'Event')}</strong>
        <HeaderActionButton icon={X} label={t('Close')} onClick={onClose} />
      </div>
      <fieldset disabled={busy}>
        <input
          autoFocus
          className="dt-cal-title-input"
          aria-label={t('Event title')}
          placeholder={t('Add a title')}
          maxLength={200}
          value={draft.title}
          onChange={e => change({ title: e.target.value })}
        />
        <label className="dt-cal-check">
          <input
            type="checkbox"
            checked={draft.allDay}
            onChange={e => setDraft(withAllDay(draft, e.target.checked))}
          />
          {t('All day')}
        </label>
        <div className="dt-cal-editor-dates">
          <label>
            {t('Starts')}
            <input
              required
              aria-label={t('Starts')}
              type={draft.allDay ? 'date' : 'datetime-local'}
              value={dateValue(draft.start, draft.allDay)}
              onChange={e => {
                if (!e.target.value) return
                const start = draft.allDay ? fromDateKey(e.target.value) : new Date(e.target.value)
                change({
                  start,
                  end:
                    start >= draft.end
                      ? new Date(start.getTime() + (draft.end.getTime() - draft.start.getTime()))
                      : draft.end,
                })
              }}
            />
          </label>
          <label>
            {t('Ends')}
            <input
              required
              aria-label={t('Ends')}
              type={draft.allDay ? 'date' : 'datetime-local'}
              value={dateValue(lastDay(draft), draft.allDay)}
              onChange={e => {
                if (e.target.value)
                  change({
                    end: draft.allDay
                      ? addDays(fromDateKey(e.target.value), 1)
                      : new Date(e.target.value),
                  })
              }}
            />
          </label>
        </div>
        <label>
          {t('Calendar')}
          <select
            value={draft.calendarId ?? calendars.find(c => c.is_default)?.id ?? ''}
            onChange={e => change({ calendarId: e.target.value })}
          >
            {calendars.map(c => (
              <option key={c.id} value={c.id}>
                {calendarName(c, t)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('Repeat')}
          <select
            value={preset}
            onChange={e => {
              const p = e.target.value as RepeatPreset
              setPreset(p)
              if (recurring) setScope('all')
              change({
                rrule:
                  p === 'custom'
                    ? buildRule(rule, draft.allDay)
                    : presetRule(p, draft.start, draft.allDay),
              })
            }}
          >
            {(
              [
                ['none', 'Does not repeat'],
                ['daily', 'Daily'],
                ['weekdays', 'Every weekday'],
                ['weekly', 'Weekly'],
                ['monthly', 'Monthly'],
                ['monthlyWeekday', 'Monthly on this weekday'],
                ['yearly', 'Yearly'],
                ['custom', 'Custom repeat'],
              ] as const
            ).map(([value, label]) => (
              <option key={value} value={value}>
                {t(label)}
              </option>
            ))}
          </select>
        </label>
        {preset === 'custom' && (
          <div className="dt-cal-repeat-editor">
            <div className="dt-cal-editor-dates">
              <label>
                {t('Every')}
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={rule.interval}
                  onChange={e =>
                    applyRule({ ...rule, interval: Math.max(1, Number(e.target.value)) })
                  }
                />
              </label>
              <label>
                {t('Frequency')}
                <select
                  value={rule.freq}
                  onChange={e => applyRule({ ...rule, freq: e.target.value as Frequency })}
                >
                  {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map(f => (
                    <option key={f} value={f}>
                      {t({ DAILY: 'Days', WEEKLY: 'Weeks', MONTHLY: 'Months', YEARLY: 'Years' }[f])}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {rule.freq === 'WEEKLY' && (
              <div className="dt-cal-weekdays">
                {Array.from({ length: 7 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={rule.byDay.includes(i)}
                    onClick={() =>
                      applyRule({
                        ...rule,
                        byDay: rule.byDay.includes(i)
                          ? rule.byDay.filter(d => d !== i)
                          : [...rule.byDay, i],
                      })
                    }
                  >
                    {formatWeekday(new Date(2026, 9, 18 + i), i18n.language)}
                  </button>
                ))}
              </div>
            )}
            <label>
              {t('Repeat ends')}
              <select
                value={rule.end.kind}
                onChange={e =>
                  applyRule({
                    ...rule,
                    end:
                      e.target.value === 'count'
                        ? { kind: 'count', count: 10 }
                        : e.target.value === 'until'
                          ? { kind: 'until', date: dateKey(addDays(draft.start, 30)) }
                          : { kind: 'never' },
                  })
                }
              >
                <option value="never">{t('Never')}</option>
                <option value="until">{t('On date')}</option>
                <option value="count">{t('After occurrences')}</option>
              </select>
            </label>
            {rule.end.kind === 'count' && (
              <input
                aria-label={t('Occurrence count')}
                type="number"
                min={1}
                max={10000}
                value={rule.end.count}
                onChange={e =>
                  applyRule({
                    ...rule,
                    end: { kind: 'count', count: Math.max(1, Number(e.target.value)) },
                  })
                }
              />
            )}
            {rule.end.kind === 'until' && (
              <input
                aria-label={t('Repeat until')}
                type="date"
                min={dateKey(draft.start)}
                value={rule.end.date}
                onChange={e => applyRule({ ...rule, end: { kind: 'until', date: e.target.value } })}
              />
            )}
          </div>
        )}
        <label>
          {t('Location')}
          <input
            value={draft.location}
            maxLength={300}
            onChange={e => change({ location: e.target.value })}
          />
        </label>
        <label>
          {t('Notes')}
          <textarea
            rows={2}
            maxLength={5000}
            value={draft.notes}
            onChange={e => change({ notes: e.target.value })}
          />
        </label>
        <label>
          {t('Event color')}
          <select
            value={draft.color ?? ''}
            onChange={e => change({ color: e.target.value || null })}
          >
            <option value="">{t('Calendar color')}</option>
            {CALENDAR_COLORS.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="dt-cal-reminders">
          <span>{t('Reminders')}</span>
          {draft.reminders.map(minutes => (
            <label className="dt-cal-check" key={minutes}>
              <input
                type="checkbox"
                checked
                onChange={() => change({ reminders: draft.reminders.filter(n => n !== minutes) })}
              />
              {minutes < 0
                ? t('On the day at 09:00')
                : t('{{minutes}} minutes before', { minutes })}
            </label>
          ))}
          {draft.reminders.length < 5 && (
            <div className="dt-cal-editor-dates">
              <label>
                {t('Minutes before')}
                <input
                  type="number"
                  min={0}
                  max={40320}
                  value={customReminder}
                  onChange={e => setCustomReminder(Number(e.target.value))}
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  change({ reminders: [...new Set([...draft.reminders, customReminder])] })
                }
              >
                {t('Add reminder')}
              </button>
            </div>
          )}
          {draft.allDay && !draft.reminders.includes(-540) && draft.reminders.length < 5 && (
            <button type="button" onClick={() => change({ reminders: [...draft.reminders, -540] })}>
              {t('On the day at 09:00')}
            </button>
          )}
        </div>
        {recurring && (
          <ScopeSelect
            scope={scope}
            onChange={setScope}
            allowThis={draft.rrule === initial.rrule}
          />
        )}
      </fieldset>
      {!valid && <p role="alert">{t('The end must be after the start.')}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="dt-cal-editor-footer">
        <button type="button" onClick={onClose} disabled={busy}>
          {t('Cancel')}
        </button>
        <button className="dt-cal-primary" disabled={busy || !valid} type="submit">
          {t(busy ? 'Saving…' : 'Save')}
        </button>
      </div>
    </form>
  )
}

export function ScopeSelect({
  scope,
  onChange,
  allowThis = true,
}: {
  scope: EditScope
  onChange: (scope: EditScope) => void
  allowThis?: boolean
}) {
  const { t } = useTranslation()
  return (
    <label>
      {t('Apply to')}
      <select value={scope} onChange={e => onChange(e.target.value as EditScope)}>
        <option value="this" disabled={!allowThis}>
          {t('This event')}
        </option>
        <option value="following">{t('This and following events')}</option>
        <option value="all">{t('All events in the series')}</option>
      </select>
    </label>
  )
}
