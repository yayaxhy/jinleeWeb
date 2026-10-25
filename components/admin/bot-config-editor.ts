import { copyFromSettings, presentationFromSettings, parseBotSettings, type BotConfigState, type BotSettings } from '@/lib/bot-config';
import { validateOrderRequestCopy, type OrderRequestCopy } from '@/lib/order-request-copy';

import { validateRuntimePresentation, type RuntimePresentation } from '@/lib/runtime-presentation';

export type Editor = { broadcast: string; anonymous: string; publicAccept: string } & OrderRequestCopy & RuntimePresentation;

export function toEditor(settings: BotSettings): Editor {
  return {
    broadcast: settings.orderBroadcastChannelIds.join(', '),
    anonymous: settings.orderAnonChannelId,
    publicAccept: settings.orderPublicAcceptChannelIds.join(', '),
    ...copyFromSettings(settings),
    ...presentationFromSettings(settings),
  };
}

export function editorSettings(editor: Editor): BotSettings | null {
  const ids = (text: string) => text.split(/[,，\n]/).map((id) => id.trim()).filter(Boolean);
  return parseBotSettings({
    schemaVersion: 3,
    orderBroadcastChannelIds: ids(editor.broadcast),
    orderAnonChannelId: editor.anonymous.trim(),
    orderPublicAcceptChannelIds: ids(editor.publicAccept),
    orderRequestCopy: editorCopy(editor),
    presentation: editorPresentation(editor),
  });
}

export function editorCopy(editor: Editor): OrderRequestCopy {
  const { requestHint, selectedHint, endedHint, closedHint, dispatchTitle, dispatchDescription } = editor;
  return { requestHint, selectedHint, endedHint, closedHint, dispatchTitle, dispatchDescription };
}

export function editorPresentation(editor: Editor): RuntimePresentation {
  const { dispatchImageUrl, accentColor, welcomeGreeting, welcomeIntro, completionNote } = editor;
  return { dispatchImageUrl, accentColor, welcomeGreeting, welcomeIntro, completionNote };
}

export function presentationValidationError(editor: Editor): string | null {
  try { validateRuntimePresentation(editorPresentation(editor)); return null; }
  catch (error) { return error instanceof Error ? error.message : '展示配置未通过校验'; }
}

export function copyValidationError(editor: Editor): string | null {
  try { validateOrderRequestCopy(editorCopy(editor)); return null; }
  catch (error) { return error instanceof Error ? error.message : '派单文案未通过校验'; }
}

export function editableSettings(state: BotConfigState) {
  return state.draft ?? state.active?.settings ?? state.effective;
}

export function editorAfterState(current: Editor | null, state: BotConfigState, replaceEditor: boolean) {
  return replaceEditor || !current ? toEditor(editableSettings(state)) : current;
}

export function editorIsDirty(editor: Editor, state: BotConfigState) {
  const saved = toEditor(editableSettings(state));
  return (Object.keys(saved) as Array<keyof Editor>).some((key) => editor[key] !== saved[key]);
}

export function canSaveAndPublish(state: BotConfigState, editor: Editor, reason: string) {
  const length = reason.trim().length;
  return Boolean(state.enabled && Number.isSafeInteger(state.revision) && Number(state.revision) >= 0 && Number(state.revision) <= Number.MAX_SAFE_INTEGER - 2 && editorSettings(editor) && length <= 300);
}
