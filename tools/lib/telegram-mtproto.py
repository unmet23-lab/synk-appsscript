"""Private bot sender. Stdio contains no credentials; Telegram deduplicates random_id.

The bot's regular Hermes receiver must keep receiving updates. receive_updates=False
wraps every RPC in invokeWithoutUpdates, including authorization and peer lookup.
https://core.telegram.org/api/updates#updatemessageid-updates
"""
import asyncio
import contextlib
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import sys


class DeliveryError(Exception):
    pass


def settings():
    file = Path(os.environ.get('SYNK_TELEGRAM_MTPROTO_CONFIG', Path.home() / 'SYNK_보안' / '텔레그램_MTProto.json'))
    try:
        cfg = json.loads(file.read_text(encoding='utf-8-sig'))
        api_id, api_hash = cfg['apiId'], cfg['apiHash']
        if type(api_id) is not int or not 0 < api_id < 2**31 or not re.fullmatch(r'[a-fA-F0-9]{32}', api_hash):
            raise ValueError()
        home = Path(os.environ.get('SYNK_HERMES_HOME') or Path(os.environ.get('LOCALAPPDATA', Path.home() / '.local' / 'share')) / 'hermes')
        line = re.search(r'^\s*(?:export\s+)?TELEGRAM_BOT_TOKEN\s*=\s*(.*?)\s*$', home.joinpath('.env').read_text(encoding='utf-8-sig'), re.M)
        token = line.group(1).strip('"\'') if line else ''
        match = re.fullmatch(r'([1-9][0-9]*):[A-Za-z0-9_-]{20,}', token)
        if not match:
            raise ValueError()
        return {'api_id': api_id, 'api_hash': api_hash, 'token': token, 'bot_id': match.group(1)}
    except Exception:
        raise DeliveryError('MTPROTO_CONFIG_REQUIRED') from None


def validate(payload, cfg):
    if payload.get('mode') not in ('check', 'send') or payload.get('botId') != cfg['bot_id']:
        raise DeliveryError('MTPROTO_BOT_MISMATCH')
    target = payload.get('target', '')
    if not isinstance(target, str) or not re.fullmatch(r'telegram:[1-9][0-9]*', target):
        raise DeliveryError('MTPROTO_TARGET_INVALID')
    if payload['mode'] == 'send':
        value = payload.get('randomId', '')
        if not isinstance(value, str) or not re.fullmatch(r'-?[1-9][0-9]{0,18}', value) or not -(2**63) <= int(value) < 2**63:
            raise DeliveryError('MTPROTO_ID_INVALID')
        text = payload.get('text')
        if not isinstance(text, str) or not 0 < len(text.encode('utf-16-le')) // 2 <= 4096:
            raise DeliveryError('MTPROTO_TEXT_INVALID')
    return int(target.split(':')[1])


def message_id(result, random_id, target_id, text, types):
    if isinstance(result, types.UpdateShortSentMessage):
        return result.id
    if isinstance(result, getattr(types, 'UpdateShortMessage', ())):
        if result.out and result.user_id == target_id and result.message == text:
            return result.id
        raise DeliveryError('MTPROTO_RECEIPT_MISSING')
    updates = getattr(result, 'updates', None)
    if updates is None:
        updates = [getattr(result, 'update', None)]
    mapped = {u.id for u in updates if isinstance(u, types.UpdateMessageID) and u.random_id == random_id}
    if len(mapped) == 1:
        return mapped.pop()
    messages = [getattr(u, 'message', None) for u in updates]
    ids = {m.id for m in messages if m is not None and getattr(m, 'out', False)
           and isinstance(getattr(m, 'peer_id', None), types.PeerUser) and m.peer_id.user_id == target_id
           and getattr(m, 'message', None) == text}
    if len(ids) == 1:
        return ids.pop()
    raise DeliveryError('MTPROTO_RECEIPT_MISSING')


async def deliver(payload, cfg, root, sdk=None):
    if sdk is None:
        import telethon
        from telethon import TelegramClient, functions, types
        if telethon.__version__ != '1.45.0':
            raise DeliveryError('MTPROTO_DEPENDENCY_VERSION')
    else:
        TelegramClient, functions, types = sdk
    target_id = validate(payload, cfg)
    client = TelegramClient(str(root / cfg['bot_id']), cfg['api_id'], cfg['api_hash'],
                            receive_updates=False, connection_retries=1, request_retries=1,
                            auto_reconnect=False, flood_sleep_threshold=0, timeout=15)
    try:
        await client.connect()
        if not await client.is_user_authorized():
            await client.sign_in(bot_token=cfg['token'])
        me = await client.get_me()
        if not me.bot or str(me.id) != payload['botId']:
            raise DeliveryError('MTPROTO_BOT_MISMATCH')
        client.session.save()  # 첫 메시지를 보내기 전에 인증 세션을 저장한다.
        peer = await client.get_input_entity(types.PeerUser(target_id))
        if not isinstance(peer, types.InputPeerUser) or peer.user_id != target_id:
            raise DeliveryError('MTPROTO_PEER_MISMATCH')
        receipt = {'ok': True, 'botId': payload['botId'], 'target': payload['target']}
        if payload['mode'] == 'check':
            return {**receipt, 'mode': 'check', 'authorized': True}
        result = await client(functions.messages.SendMessageRequest(peer=peer, message=payload['text'],
                                                                   random_id=int(payload['randomId']), no_webpage=True))
        mid = message_id(result, int(payload['randomId']), target_id, payload['text'], types)
        if type(mid) is not int or mid <= 0:
            raise DeliveryError('MTPROTO_RECEIPT_MISSING')
        return {**receipt, 'messageId': str(mid), 'randomId': payload['randomId']}
    finally:
        with contextlib.suppress(Exception):
            await asyncio.wait_for(client.disconnect(), timeout=5)


def main():
    logging.disable(logging.CRITICAL)
    try:
        payload = json.loads(sys.stdin.read(32768))
        cfg = settings()
        validate(payload, cfg)
        root = Path(os.environ.get('SYNK_TELEGRAM_RUNTIME', Path.home() / '.synk' / 'telegram-mtproto'))
        root.mkdir(parents=True, exist_ok=True)
        # 이 DB는 세션 잠금 전용이다. 네트워크 처리 중에도 알림 outbox에는 기록할 수 있다.
        with contextlib.closing(sqlite3.connect(root / 'send.lock.sqlite', timeout=0)) as lock:
            lock.execute('CREATE TABLE IF NOT EXISTS send_lock(id INTEGER PRIMARY KEY)')
            lock.execute('BEGIN IMMEDIATE')
            try:
                result = asyncio.run(asyncio.wait_for(deliver(payload, cfg, root), timeout=120))
            finally:
                lock.rollback()
        print(json.dumps(result))
        return 0
    except Exception as error:
        if isinstance(error, DeliveryError):
            code = str(error)
        elif isinstance(error, sqlite3.OperationalError) and 'locked' in str(error):
            code = 'MTPROTO_SENDER_BUSY'
        elif isinstance(error, (TimeoutError, asyncio.TimeoutError)):
            code = 'MTPROTO_TIMEOUT'
        else:
            code = getattr(error, 'message', '')
            if not isinstance(code, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,60}', code):
                code = 'MTPROTO_CONNECTION_FAILED'
        # RANDOM_ID_DUPLICATE는 원래 요청이 아직 처리 중이라는 뜻이다. 수신 확인으로 치지 않는다.
        retry_after = getattr(error, 'seconds', 0)
        print(json.dumps({'ok': False, 'code': code, 'retryAfter': retry_after if type(retry_after) is int and retry_after > 0 else 0}))
        return 1


if __name__ == '__main__':
    sys.exit(main())
