import { useQuery } from "@tanstack/react-query";

import {
  fetchSuggestions,
  suggestionKeys,
  type SuggestionStatus,
} from "@/lib/suggestions";

export function useProjectSuggestions(
  projectId: string,
  status: SuggestionStatus,
) {
  return useQuery({
    queryKey: suggestionKeys.status(projectId, status),
    queryFn: () => fetchSuggestions(projectId, status),
  });
}
