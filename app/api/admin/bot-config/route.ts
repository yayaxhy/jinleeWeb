import { isAdminDiscordId } from '@/lib/admin';
import { handleBotConfigRequest } from '@/lib/bot-config-proxy';
import { getInternalBot, postInternalBot } from '@/lib/internal-bot';
import { getServerSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const dependencies = {
  session: getServerSession,
  isAdmin: isAdminDiscordId,
  get: getInternalBot,
  post: postInternalBot,
};

export const GET = (request: Request) => handleBotConfigRequest(request, dependencies);
export const POST = (request: Request) => handleBotConfigRequest(request, dependencies);
