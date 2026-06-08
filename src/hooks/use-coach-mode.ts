import { useOnboarding } from "@/hooks/use-onboarding";

export type CoachLevel = "off" | "gentle" | "active" | "teaching";

export function useCoachMode(): { level: CoachLevel; enabled: boolean } {
  const { data } = useOnboarding();
  const level = (data?.coaching_level ?? "gentle") as CoachLevel;
  return { level, enabled: level !== "off" };
}
