"use client";

import { useParams } from "next/navigation";

import NoteWorkspace from "@/features/notes/components/NoteWorkspace";

export default function CoWriterPage() {
  const params = useParams<{ docId?: string | string[] }>();
  const rawDocId = params?.docId;
  const docId = Array.isArray(rawDocId)
    ? (rawDocId[0] ?? "")
    : (rawDocId ?? "");

  return <NoteWorkspace key={docId} docId={docId} />;
}
