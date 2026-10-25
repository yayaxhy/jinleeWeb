import { NextResponse } from 'next/server';
import { getCurrentDlmUser } from '@/lib/current-dlm-user';
import { verifyWechatBindToken } from '@/lib/wechat-bind-token';
import { prisma } from '@/lib/prisma';
import { createDiscordChangeProof, encodeDiscordChangeProof } from '@/lib/discord-change-proof';

/** Both source mini-program session and target website token are verified here.
 * The browser displays the shared complete-migration preview and asks for confirmation. */
export async function POST(request: Request) {
 const current=await getCurrentDlmUser(request);
 if(!current||current.sessionSource!=='wechat_program')return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
 const body=await request.json().catch(()=>null) as {bindToken?:unknown}|null;
 const token=verifyWechatBindToken(typeof body?.bindToken==='string'?body.bindToken:null);
 if(!token)return NextResponse.json({ok:false,error:'invalid_bind_token',message:'绑定链接或旧短码已失效，请在网站重新生成绑定链接。'},{status:400});
 const target=await prisma.dlmUser.findUnique({where:{dlmId:token.dlmId},select:{dlmId:true,sessionVersion:true,discordUserId:true}});
 if(!target?.discordUserId||target.sessionVersion!==token.sessionVersion)return NextResponse.json({ok:false,error:'binding_state_changed',message:'目标登录状态已变化，请重新生成链接。'},{status:409});
 if(current.dlmId===target.dlmId)return NextResponse.json({ok:true,alreadyBound:true});
 const proof={...createDiscordChangeProof(current.dlmId,current.dlmUser.sessionVersion),targetDlmId:target.dlmId,targetSessionVersion:target.sessionVersion,targetDiscordId:target.discordUserId};
 const confirmationUrl=new URL('/api/discord/change/import',process.env.NEXTAUTH_URL??new URL(request.url).origin);
 confirmationUrl.searchParams.set('proof',encodeDiscordChangeProof(proof));
 return NextResponse.json({ok:false,error:'binding_confirmation_required',requiresConfirmation:true,targetDlmId:target.dlmId,targetDiscordId:target.discordUserId,confirmationUrl:confirmationUrl.toString(),message:'请打开确认链接，核对两个账号的资产与历史合并预览后确认。此时尚未合并。'},{status:409,headers:{'Cache-Control':'no-store'}});
}
