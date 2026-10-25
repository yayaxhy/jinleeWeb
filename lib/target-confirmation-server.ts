import { prisma } from './prisma';
import { isAdminDiscordId } from './admin';
import { createTargetConfirmationCodec } from './target-confirmation';
import { createTargetConfirmationService } from './target-confirmation-service';

export const targetConfirmationService = () => createTargetConfirmationService({
  client: prisma, isAdmin: isAdminDiscordId,
  codec: createTargetConfirmationCodec({ secret: process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET ?? '' }),
});
