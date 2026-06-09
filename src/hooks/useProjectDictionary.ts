import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  addDictionaryTerm,
  listProjectDictionary,
  removeDictionaryTerm,
  type DictionaryEntry,
} from "@/lib/dictionary.functions";

export function useProjectDictionary(projectId: string | undefined) {
  const qc = useQueryClient();
  const list = useServerFn(listProjectDictionary);
  const add = useServerFn(addDictionaryTerm);
  const remove = useServerFn(removeDictionaryTerm);

  const query = useQuery({
    queryKey: ["project_dictionary", projectId],
    queryFn: () => list({ data: { projectId: projectId! } }),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  const entries: DictionaryEntry[] = query.data?.entries ?? [];

  const termSet = useMemo(() => {
    const s = new Set<string>();
    for (const e of entries) s.add(e.normalized_term);
    return s;
  }, [entries]);

  const addMutation = useMutation({
    mutationFn: (vars: {
      term: string;
      category?: DictionaryEntry["category"] extends infer C ? string : string;
      createdFrom?: string;
      notes?: string;
    }) =>
      add({
        data: {
          projectId: projectId!,
          term: vars.term,
          category: (vars.category ?? "custom") as never,
          createdFrom: (vars.createdFrom ?? "manual") as never,
          notes: vars.notes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_dictionary", projectId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project_dictionary", projectId] });
    },
  });

  return {
    entries,
    termSet,
    isLoading: query.isLoading,
    addTerm: addMutation.mutate,
    addTermAsync: addMutation.mutateAsync,
    removeTerm: removeMutation.mutate,
  };
}
