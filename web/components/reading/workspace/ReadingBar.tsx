"use client";

import Link from "next/link";
import {
  ChevronRight,
  Expand,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  SquarePen,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import Tooltip from "@/shared/ui/Tooltip";
import type { WorkspaceMenuItem } from "@/components/reading/workspace-menu-context";
import { PageToolButtons, ReadAloudButton } from "./ReadAloudButton";
import { WorkspaceMenu } from "./WorkspaceMenu";

const ICON_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-md transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

function BarButton({
  label,
  onClick,
  active = false,
  disabled = false,
  pressed,
  expanded,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        className={`${ICON_BUTTON} ${
          active
            ? "text-[var(--primary)]"
            : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * The reading workspace's one row of chrome, over the document only.
 *
 * Read left to right it is the path to what is open: back to the folder,
 * the contents switch, the collection (rename, add to it), then the document
 * itself — its title, place and bookmark, which the reader pane hands up
 * into `docSlot` — and last what can be done with it. The companion keeps its
 * own controls on its own sheet; only the switch that brings it back lives
 * here, and only while it is away.
 */
export function ReadingBar({
  backHref,
  title,
  renaming,
  onRename,
  onAdd,
  navigatorOpen,
  onToggleNavigator,
  docSlot,
  notice,
  materialReady,
  busy,
  onQuiz,
  learning,
  onToggleLearning,
  menuSections,
  collection,
  companionOpen,
  onOpenCompanion,
}: {
  backHref: string;
  title: string;
  renaming: boolean;
  onRename: () => void;
  onAdd: () => void;
  navigatorOpen: boolean;
  onToggleNavigator: () => void;
  docSlot: (node: HTMLDivElement | null) => void;
  notice?: string | null;
  materialReady: boolean;
  busy: boolean;
  onQuiz: () => void;
  learning: boolean;
  onToggleLearning: () => void;
  menuSections: Parameters<typeof WorkspaceMenu>[0]["sections"];
  collection: WorkspaceMenuItem[];
  companionOpen: boolean;
  onOpenCompanion: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="dt-reading-bar flex h-12 min-w-0 shrink-0 items-center gap-1 bg-[var(--background)] px-3">
      <Link
        href={backHref}
        className={`${ICON_BUTTON} text-[var(--muted-foreground)] hover:text-[var(--foreground)]`}
        aria-label={t("Back to folder")}
      >
        <ChevronRight size={15} className="rotate-180" />
      </Link>
      {/* The outline opens on the left, so its switch lives on the left. */}
      <BarButton
        label={navigatorOpen ? t("Collapse contents") : t("Expand contents")}
        onClick={onToggleNavigator}
        active={navigatorOpen}
        expanded={navigatorOpen}
      >
        {navigatorOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
      </BarButton>
      <span className="ml-1 hidden min-w-0 max-w-[200px] shrink-[2] items-center md:inline-flex">
        <Tooltip label={t("Rename collection")} suppressed={renaming} className="min-w-0">
          <button
            type="button"
            onClick={onRename}
            className="min-w-0 truncate rounded-md px-1.5 py-1 text-[13px] font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {title}
          </button>
        </Tooltip>
      </span>
      <BarButton label={t("Add material")} onClick={onAdd}>
        <Plus size={14} />
      </BarButton>
      <span aria-hidden className="dt-reading-crumb-sep hidden text-[var(--muted-foreground)]/50 md:inline">
        /
      </span>
      {/* The open document's title, place and bookmark render here. */}
      <div ref={docSlot} className="dt-reader-head-slot flex min-w-0 flex-1 items-center gap-1" />

      <div className="flex shrink-0 items-center gap-0.5">
        {notice && (
          <span className="hidden max-w-[220px] truncate px-2 text-[10px] text-[var(--muted-foreground)] 2xl:inline">
            {notice}
          </span>
        )}
        <ReadAloudButton disabled={!materialReady} />
        <PageToolButtons disabled={!materialReady || busy} onQuiz={onQuiz} />
        <BarButton
          label={t(learning ? "Exit learning mode" : "Fullscreen learning")}
          onClick={onToggleLearning}
          active={learning}
          pressed={learning}
        >
          {learning ? <Minimize2 size={14} /> : <Expand size={14} />}
        </BarButton>
        <WorkspaceMenu sections={menuSections} collection={collection} />
        {!companionOpen && (
          <BarButton label={t("Open the companion")} onClick={onOpenCompanion} expanded={false}>
            <PanelRightOpen size={14} />
          </BarButton>
        )}
      </div>
    </header>
  );
}

/**
 * The top of the companion's sheet: what it is, and its own three controls —
 * start over, take the whole width, put it away.
 */
export function CompanionHead({
  title,
  canStartOver,
  onStartOver,
  focus,
  onClose,
}: {
  title?: string;
  canStartOver: boolean;
  onStartOver: () => void;
  /** Present only where the companion can take the reader's width. */
  focus?: { active: boolean; toggle: () => void };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="dt-companion-head flex h-12 shrink-0 items-center gap-1 pl-4 pr-2">
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--foreground)]">
        {title?.trim() || t("Reading companion title")}
      </span>
      <BarButton label={t("New conversation")} onClick={onStartOver} disabled={!canStartOver}>
        <SquarePen size={14} />
      </BarButton>
      {focus && (
        <BarButton
          label={focus.active ? t("Exit companion focus") : t("Focus reading companion")}
          onClick={focus.toggle}
          active={focus.active}
          pressed={focus.active}
        >
          {focus.active ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </BarButton>
      )}
      <BarButton label={t("Put the companion away")} onClick={onClose} expanded>
        <PanelRightClose size={14} />
      </BarButton>
    </div>
  );
}
