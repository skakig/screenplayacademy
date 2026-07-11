import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listProjectCharacters, upsertCharacter } from "@/lib/characters.functions";

type Options = {
  projectId: string;
  createName?: string;
  createdTitle?: string;
  createdDescription?: string;
};

export function useOpenCharacterBuilder({
  projectId,
  createName = "New Character",
  createdTitle = "First character created",
  createdDescription = "Let's build them together in the guided builder.",
}: Options) {
  const navigate = useNavigate();
  const listChars = useServerFn(listProjectCharacters);
  const createChar = useServerFn(upsertCharacter);
  const [loading, setLoading] = useState(false);

  const openCharacterBuilder = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const rows = (await listChars({ data: { projectId } })) as Array<{ id: string; name?: string | null }>;
      let characterId = rows?.[0]?.id;
      const createdFresh = !characterId;

      if (!characterId) {
        const created = (await createChar({
          data: { project_id: projectId, patch: { name: createName } },
        })) as { row?: { id?: string }; id?: string } | null;
        characterId = created?.row?.id ?? created?.id;
      }

      if (!characterId) throw new Error("Could not resolve character");

      if (createdFresh) {
        toast.success(createdTitle, { description: createdDescription });
      }

      navigate({
        to: "/characters/$projectId/build/$characterId",
        params: { projectId, characterId },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open character builder");
    } finally {
      setLoading(false);
    }
  };

  return { openCharacterBuilder, loading };
}