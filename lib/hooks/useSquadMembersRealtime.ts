// hooks/useSquadMembersRealtime.ts
"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export function useSquadMembersRealtime(opts: {
  projectId: string;
  onChange: (payload: any) => void;
}) {
  const { projectId, onChange } = opts;
  
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`squad_members:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "squad_members",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            onChangeRef.current(payload);
          }, 250);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`Realtime bağlandı: Proje ${projectId}`);
        }
      });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}