"use client";

import Link from "next/link";
import { m, type MotionStyle } from "framer-motion";
import { useEffect, useId, useMemo, useState } from "react";
import { ArrowUpRight, Plug, Plus, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/shared/ui/Tooltip";
import { SPACE_MCP_SURFACE, loadMcpSurface } from "@/components/mcp/surface";
import { mcpRowStatus, type McpServerStatus, type McpStoreState } from "@/lib/mcp-api";
import type { ComposerResourceCatalog } from "@/hooks/useComposerResources";
import type { ResourceSelection } from "@/features/chat/ChatStateAdapter";
import type { WorkspaceResourceOption } from "@/lib/workspaces-api";
import {
  TrayFoot,
  TrayList,
  TrayMenu,
  TrayOption,
  TrayReuse,
  TraySearch,
  type TrayPlacement,
} from "./ComposerTrayMenu";
import AnswerModeMenu, { PartnerLinkMenu, type AnswerModeProps, type PartnerLinkProps } from "./AnswerModeMenu";
import { ConnectorHubIcon, SkillDeckIcon } from "./ComposerIcons";
import { useTrayFold } from "./ComposerTrayFold";

const STATUS_DOT: Record<McpServerStatus, string> = {
  connected: "bg-emerald-500",
  connecting: "bg-amber-400",
  error: "bg-red-500",
  needs_auth: "bg-amber-400",
  disabled: "bg-[var(--border)]",
};

const STATUS_LABEL: Record<McpServerStatus, string> = {
  connected: "Connected",
  connecting: "Connecting",
  error: "Error",
  needs_auth: "Needs authorization",
  disabled: "Disabled",
};

/** Long lists get a search box; short ones are faster to scan. */
const SEARCH_FROM = 7;

interface Connector {
  option: WorkspaceResourceOption;
  status: McpServerStatus;
  tools: number;
  error: string;
}

/** Each catalog server's live state, read from the account's MCP store. */
function useConnectors(options: WorkspaceResourceOption[]): Connector[] {
  const [state, setState] = useState<McpStoreState | null>(null);
  useEffect(() => {
    let alive = true;
    void loadMcpSurface(SPACE_MCP_SURFACE)
      .then((next) => {
        if (alive) setState(next);
      })
      // Without the store the tray still lists the servers, just without state.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return useMemo(
    () =>
      options.map((option) => {
        const [origin, ...rest] = option.id.split(":");
        const name = rest.join(":") || option.name;
        const rows = origin === "deployment" ? state?.user?.deployment.status : state?.status;
        const row = rows?.find((entry) => entry.name === name);
        const config = origin === "account" ? state?.servers[name] : undefined;
        const status: McpServerStatus =
          option.available === false
            ? "disabled"
            : config
              ? mcpRowStatus(config, row)
              : (row?.status ?? "connecting");
        return { option, status, tools: row?.tools.length ?? 0, error: row?.error ?? "" };
      }),
    [options, state],
  );
}

export interface TrayResources {
  catalog: ComposerResourceCatalog;
  selection: ResourceSelection;
  onChange: (selection: ResourceSelection) => void;
}

/**
 * The layer under the composer: what Dito can reach in this conversation,
 * and who answers.
 *
 * Skills and connectors are both narrowing, never granting: the first row of
 * each list is "everything this workspace allows", and picking some limits
 * the conversation to those. What is picked shows at the start of the
 * message itself, so the tray only has to say how many. The far side is
 * about people, not tools: who DeepTutor works with (partners) and who
 * answers at all.
 *
 * A grip at the middle of its lower edge folds it up behind the box, by a
 * drag or a click, until only that edge shows.
 */
export function ComposerTray({
  placement,
  resources,
  partners,
  answer,
}: {
  /** Lists open toward the page's free space: below on the home screen, above in a conversation. */
  placement: TrayPlacement;
  resources?: TrayResources;
  partners?: PartnerLinkProps;
  answer?: AnswerModeProps;
}) {
  const { t } = useTranslation();
  const rowId = useId();
  const fold = useTrayFold(Boolean(answer?.open));
  const gripLabel = fold.away ? t("Expand") : t("Collapse");
  return (
    <m.div
      className="dt-composer-tray"
      data-placement={placement}
      data-folded={fold.away || undefined}
      data-dragging={fold.dragging || undefined}
      style={{ "--dt-tray-reveal": fold.reveal } as MotionStyle}
      {...fold.sheet}
    >
      <Tooltip
        label={gripLabel}
        side={placement === "up" ? "top" : "bottom"}
        suppressed={fold.dragging}
        className="dt-tray-grip-anchor"
      >
        <button
          type="button"
          className="dt-tray-grip"
          aria-label={gripLabel}
          aria-expanded={!fold.away}
          aria-controls={rowId}
          onKeyDown={fold.onGripKeyDown}
        />
      </Tooltip>
      <div id={rowId} className="dt-tray-bar" inert={fold.away}>
        {resources && <SkillsMenu {...resources} placement={placement} />}
        {resources && <ConnectorsMenu {...resources} placement={placement} />}
        {partners && <PartnerLinkMenu {...partners} placement={placement} />}
        {answer && <AnswerModeMenu {...answer} placement={placement} />}
      </div>
    </m.div>
  );
}

function SkillsMenu({ catalog, selection, onChange, placement }: TrayResources & { placement: TrayPlacement }) {
  const { t } = useTranslation();
  const count = selection.skills.length;
  return (
    <TrayMenu
      icon={<Wand2 size={14} strokeWidth={1.7} className="shrink-0" />}
      label={t("Skills")}
      value={count ? t("composer.tray.referenced", { count }) : t("composer.tray.allSkills")}
      active={count > 0}
      placement={placement}
    >
      {(close) => (
        <SkillList
          options={catalog.skills}
          selected={selection.skills}
          onChange={(skills) => onChange({ ...selection, skills })}
          onNavigate={close}
        />
      )}
    </TrayMenu>
  );
}

function SkillList({
  options,
  selected,
  onChange,
  onNavigate,
}: {
  options: WorkspaceResourceOption[];
  selected: string[];
  onChange: (skills: string[]) => void;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase();
  const rows = options.filter((option) =>
    `${option.name} ${option.description ?? ""}`.toLocaleLowerCase().includes(needle),
  );
  return (
    <>
      {options.length >= SEARCH_FROM && (
        <TraySearch value={query} onChange={setQuery} placeholder={t("composer.tray.searchSkills")} />
      )}
      <TrayList label={t("Skills")} multi>
        {!needle && (
          <TrayOption
            selected={!selected.length}
            onSelect={() => onChange([])}
            leading={<SkillDeckIcon size={16} strokeWidth={1.6} />}
            title={t("composer.tray.allSkills")}
            meta={t("composer.tray.allSkillsHint")}
          />
        )}
        {rows.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <TrayOption
              key={option.id}
              selected={checked}
              onSelect={() =>
                onChange(checked ? selected.filter((id) => id !== option.id) : [...selected, option.id])
              }
              leading={<Wand2 size={14} strokeWidth={1.7} />}
              title={option.name}
              meta={option.description}
            />
          );
        })}
        {!rows.length && (
          <p className="dt-tray-empty">{t(options.length ? "navigation.noResults" : "composer.tray.noSkills")}</p>
        )}
      </TrayList>
      <TrayFoot>
        <TrayReuse kinds={["skills"]} />
        <Link href="/space/skills" prefetch={false} onClick={onNavigate}>
          {t("composer.tray.manageSkills")}
          <ArrowUpRight size={13} strokeWidth={1.9} />
        </Link>
      </TrayFoot>
    </>
  );
}

function ConnectorsMenu({ catalog, selection, onChange, placement }: TrayResources & { placement: TrayPlacement }) {
  const { t } = useTranslation();
  const connectors = useConnectors(catalog.mcp);
  const count = selection.mcp.length;
  return (
    <TrayMenu
      icon={<Plug size={14} strokeWidth={1.7} className="shrink-0" />}
      label={t("composer.tray.connectors")}
      // Said the way Skills says it; how each server is doing is the dots' job.
      value={count ? t("composer.tray.referenced", { count }) : t("composer.tray.allConnectors")}
      active={count > 0}
      dots={
        connectors.length > 0 && (
          <span aria-hidden className="dt-tray-dots">
            {connectors.slice(0, 4).map((item) => (
              <span key={item.option.id} className={`dt-tray-status ${STATUS_DOT[item.status]}`} />
            ))}
          </span>
        )
      }
      placement={placement}
    >
      {(close) => (
        <>
          <TrayList label={t("composer.tray.connectors")} multi>
            {connectors.length > 0 && (
              <TrayOption
                selected={!count}
                onSelect={() => onChange({ ...selection, mcp: [] })}
                leading={<ConnectorHubIcon size={16} strokeWidth={1.6} />}
                title={t("composer.tray.allConnectors")}
                meta={t("composer.tray.allConnectorsHint")}
              />
            )}
            {connectors.map((item) => {
              const checked = selection.mcp.includes(item.option.id);
              return (
                <TrayOption
                  key={item.option.id}
                  selected={checked}
                  disabled={item.status === "disabled"}
                  onSelect={() =>
                    onChange({
                      ...selection,
                      mcp: checked
                        ? selection.mcp.filter((id) => id !== item.option.id)
                        : [...selection.mcp, item.option.id],
                    })
                  }
                  leading={
                    <>
                      <Plug size={14} strokeWidth={1.7} />
                      <span className={`dt-tray-lead-status ${STATUS_DOT[item.status]}`} />
                    </>
                  }
                  title={item.option.name}
                  meta={
                    item.status === "connected"
                      ? t("composer.tray.tools", { count: item.tools })
                      : item.status === "error" && item.error
                        ? item.error
                        : t(STATUS_LABEL[item.status])
                  }
                />
              );
            })}
            {!connectors.length && <p className="dt-tray-empty">{t("composer.tray.noConnectors")}</p>}
          </TrayList>
          <TrayFoot>
            <TrayReuse kinds={["mcp"]} />
            <Link href="/space/mcp" prefetch={false} onClick={close}>
              <Plus size={13} strokeWidth={1.9} />
              {t("composer.tray.addConnector")}
            </Link>
          </TrayFoot>
        </>
      )}
    </TrayMenu>
  );
}
