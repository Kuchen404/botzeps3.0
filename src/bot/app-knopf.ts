import { InlineKeyboard } from "grammy";
import type { Chat, UserFromGetMe } from "grammy/types";

export const APP_KNOPF = "📊 Botzeps-App";

/**
 * Link, der die Mini App aus jedem Chat heraus öffnet. Ist beim BotFather eine Haupt-Mini-App
 * eingerichtet, startet sie direkt (mit der Gruppe als start_param), sonst geht's über den Privatchat.
 */
export function appLink(me: UserFromGetMe, chatId?: number): string {
  if (me.has_main_web_app) return `https://t.me/${me.username}?startapp${chatId === undefined ? "" : `=g${chatId}`}`;
  return `https://t.me/${me.username}?start=app`;
}

/**
 * Knopf zur Mini App: privat als Web-App-Knopf, in Gruppen als Link,
 * weil Telegram Web-App-Knöpfe nur im Privatchat erlaubt. Ohne Mini App kein Knopf.
 */
export function appKnopf(me: UserFromGetMe, chat: Pick<Chat, "id" | "type">, miniAppUrl: string | undefined): InlineKeyboard | undefined {
  if (!miniAppUrl) return undefined;
  if (chat.type === "private") return new InlineKeyboard().webApp(APP_KNOPF, miniAppUrl);
  return new InlineKeyboard().url(APP_KNOPF, appLink(me, chat.id));
}
