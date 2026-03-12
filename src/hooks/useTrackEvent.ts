import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type TrackableEvent =
  | "login_success"
  | "report_viewed"
  | "report_created"
  | "report_downloaded"
  | "csv_uploaded_for_report";

interface TrackEventPayload {
  report_id?: string;
  report_name?: string;
  report_type?: "predefined" | "custom";
  source_type?: "base_pim" | "csv";
}

export function useTrackEvent() {
  const { user } = useAuth();

  return useCallback(
    async (eventType: TrackableEvent, payload?: TrackEventPayload) => {
      if (!user || user.track_insights === false) return;
      try {
        await supabase.from("usage_events").insert({
          event_type: eventType,
          user_id: user.id,
          user_email: user.email,
          user_role: user.role,
          report_id: payload?.report_id ?? null,
          report_name: payload?.report_name ?? null,
          report_type: payload?.report_type ?? null,
          source_type: payload?.source_type ?? null,
        });
      } catch {
        // Silent fail — analytics should never break the app
      }
    },
    [user]
  );
}

/**
 * Fire-and-forget tracker for use outside React components (e.g. login flow).
 */
export async function trackEventDirect(
  userId: string,
  email: string,
  role: string,
  eventType: TrackableEvent,
  payload?: TrackEventPayload,
  trackInsights: boolean = true
) {
  if (!trackInsights) return;
  try {
    await supabase.from("usage_events").insert({
      event_type: eventType,
      user_id: userId,
      user_email: email,
      user_role: role,
      report_id: payload?.report_id ?? null,
      report_name: payload?.report_name ?? null,
      report_type: payload?.report_type ?? null,
      source_type: payload?.source_type ?? null,
    });
  } catch {
    // Silent fail
  }
}
