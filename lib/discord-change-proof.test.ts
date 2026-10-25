import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDiscordChangeProof, encodeDiscordChangeProof, decodeDiscordChangeProof } from './discord-change-proof';
const secret='offline-test-secret'; const now=1_800_000_000_000;
test('source proof binds account, version, one request id and CSRF',()=>{
 const proof=createDiscordChangeProof('DLM-A',7,now); const encoded=encodeDiscordChangeProof(proof,secret);
 assert.deepEqual(decodeDiscordChangeProof(encoded,secret,now),proof);
 assert.notEqual(createDiscordChangeProof('DLM-A',7,now).requestId,proof.requestId);
});
test('proof tampering, multibyte signatures and extra token parts fail closed',()=>{
 const proof=createDiscordChangeProof('DLM-A',1,now); const token=encodeDiscordChangeProof(proof,secret);
 assert.equal(decodeDiscordChangeProof(token.replace('ey','eA'),secret,now),null);
 assert.equal(decodeDiscordChangeProof(token.split('.')[0]+'.'+'中'.repeat(43),secret,now),null);
 assert.equal(decodeDiscordChangeProof(token+'.extra',secret,now),null);
});
test('expired proof and malformed target verification are not accepted',()=>{
 const proof=createDiscordChangeProof('DLM-A',1,now);
 assert.equal(decodeDiscordChangeProof(encodeDiscordChangeProof(proof,secret),secret,now+600_000),null);
 assert.equal(decodeDiscordChangeProof(encodeDiscordChangeProof({...proof,targetDlmId:'B'},secret),secret,now),null);
 assert.equal(decodeDiscordChangeProof(encodeDiscordChangeProof({...proof,targetDlmId:'B',targetSessionVersion:1,targetDiscordId:'detached:A'},secret),secret,now),null);
});
test('verified target identity is part of the signature',()=>{
 const proof={...createDiscordChangeProof('A',1,now),targetDlmId:'B',targetSessionVersion:4,targetDiscordId:'123456789123456789'};
 assert.deepEqual(decodeDiscordChangeProof(encodeDiscordChangeProof(proof,secret),secret,now),proof);
});
