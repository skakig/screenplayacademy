// Choose the language SceneSmith should use to *explain things to the
// writer* — not the language the screenplay is written in.
//
// Rule of thumb (from language-transfer-bridge-engine):
//   1. If the writer's UI language is closer to the screenplay language
//      than English, use UI language.
//   2. Otherwise prefer the nearest *known* bridge language to the target.
//   3. Fall back to UI language.

import type { LanguageCode, LanguageProfile } from "./types";
import { nearestBridge, transferDistance } from "./transferMatrix";

export type BridgeChoice = {
  scaffoldLanguage: LanguageCode;
  reason:
    | "ui_is_target"
    | "ui_near_target"
    | "known_bridge"
    | "ui_fallback";
};

export function pickScaffoldLanguage(input: {
  profile: LanguageProfile;
  screenplayLanguage: LanguageCode;
}): BridgeChoice {
  const { profile, screenplayLanguage } = input;
  if (profile.uiLanguage === screenplayLanguage) {
    return { scaffoldLanguage: profile.uiLanguage, reason: "ui_is_target" };
  }
  const uiDistance = transferDistance(profile.uiLanguage, screenplayLanguage);
  const bridge = nearestBridge(profile.knownLanguages, screenplayLanguage);
  if (!bridge) {
    return { scaffoldLanguage: profile.uiLanguage, reason: "ui_fallback" };
  }
  const bridgeDistance = transferDistance(bridge, screenplayLanguage);
  if (bridgeDistance < uiDistance) {
    return { scaffoldLanguage: bridge, reason: "known_bridge" };
  }
  return { scaffoldLanguage: profile.uiLanguage, reason: "ui_near_target" };
}
