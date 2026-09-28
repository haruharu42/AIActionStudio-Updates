import type { SupabaseClient } from "@supabase/supabase-js";
import { isNoteScheduleDate, normalizeNoteScheduleTime, noteMonthBounds } from "@/lib/note-schedule-core";
import type { NoteScheduleItem } from "@/lib/note-schedule-types";

/** Never fall back to client-side delete/insert: that can lose the existing plan. */
export async function replaceNoteScheduleAtomically(
  client: SupabaseClient,
  userId: string,
  items: NoteScheduleItem[],
  targetMonth?: string,
): Promise<Record<string, unknown>[]> {
  if (targetMonth) noteMonthBounds(targetMonth);
  const limit = targetMonth ? 200 : 500;
  if (!userId || items.length < 1 || items.length > limit) throw new Error(`予定は1〜${limit}件で指定してください。`);
  for (const item of items) {
    if (!isNoteScheduleDate(item.scheduledDate) || !item.title.trim()
      || (targetMonth && (!item.scheduledDate.startsWith(`${targetMonth}-`)
        || !["free_note", "paid_note"].includes(item.itemType)))) {
      throw new Error("予定の日付・記事種別・タイトルを確認してください。既存の予定は変更していません。");
    }
  }
  const { data, error } = await client.rpc("replace_my_note_schedule_v1", {
    p_expected_user_id: userId,
    p_target_month: targetMonth ? `${targetMonth}-01` : null,
    p_items: items.map((item) => ({
      scheduled_date: item.scheduledDate,
      scheduled_time: normalizeNoteScheduleTime(item.scheduledTime, "20:00"),
      item_type: item.itemType,
      title: item.title.trim().slice(0, 240),
      theme: item.theme.trim().slice(0, 500),
      status: item.status,
      source: targetMonth ? "imported" : item.source,
      notes: item.notes.trim().slice(0, 1200),
    })),
  });
  if (error) throw new Error("スケジュールを保存できませんでした。通信状態を確認し、予定を再読み込みしてください。");
  return Array.isArray(data) ? data as Record<string, unknown>[] : [];
}
