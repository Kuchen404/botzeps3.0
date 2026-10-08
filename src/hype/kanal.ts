import { type Api, InputFile } from "grammy";
import type { HypeKanal } from "./hype.js";

/** Hype-Beiträge über die Telegram-API: Trailer als Video, Plakate als Foto, Umfrage öffentlich. */
export function hypeKanal(api: Api): HypeKanal {
  return {
    text: (chatId, text) => api.sendMessage(chatId, text),
    medium: (chatId, datei, medium, beschriftung) =>
      medium.endsWith(".mp4")
        ? api.sendVideo(chatId, new InputFile(datei, medium), { caption: beschriftung, width: 720, height: 1280, supports_streaming: true })
        : api.sendPhoto(chatId, new InputFile(datei, medium), { caption: beschriftung }),
    umfrage: (chatId, frage, antworten) => api.sendPoll(chatId, frage, antworten.map((text) => ({ text })), { is_anonymous: false }),
  };
}
