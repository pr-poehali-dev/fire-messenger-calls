import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p73754089_fire_messenger_calls')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def get_user_by_token(conn, token: str):
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT u.id, u.username, u.name, u.color, u.status
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None
        return {'id': str(row[0]), 'username': row[1], 'name': row[2], 'color': row[3], 'status': row[4]}

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    }

def handler(event: dict, context) -> dict:
    """Чаты и сообщения FIRE: список чатов, получение/отправка сообщений."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    path = event.get('path', '/')
    method = event.get('httpMethod', 'GET')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    token = (event.get('headers') or {}).get('X-Authorization', '').replace('Bearer ', '')
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    try:
        user = get_user_by_token(conn, token)
        if not user:
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'}, ensure_ascii=False)}

        # GET /chats — список всех чатов пользователя
        if method == 'GET' and path.endswith('/chats'):
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT c.id,
                        CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END as partner_id,
                        u.username, u.name, u.color, u.status,
                        (SELECT text FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_msg,
                        (SELECT created_at FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_time
                    FROM {SCHEMA}.chats c
                    JOIN {SCHEMA}.users u ON u.id = CASE WHEN c.user1_id = %s THEN c.user2_id ELSE c.user1_id END
                    WHERE c.user1_id = %s OR c.user2_id = %s
                    ORDER BY last_time DESC NULLS LAST
                """, (user['id'], user['id'], user['id'], user['id']))
                rows = cur.fetchall()

            chats = []
            for r in rows:
                chats.append({
                    'id': str(r[0]),
                    'partner': {'id': str(r[1]), 'username': r[2], 'name': r[3], 'color': r[4], 'status': r[5]},
                    'lastMsg': r[6] or '',
                    'lastTime': str(r[7]) if r[7] else '',
                })
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'chats': chats}, ensure_ascii=False)}

        # POST /chats — создать или получить чат с пользователем
        if method == 'POST' and path.endswith('/chats'):
            partner_id = body.get('partner_id')
            if not partner_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'partner_id required'}, ensure_ascii=False)}

            uid = user['id']
            u1, u2 = (uid, partner_id) if uid < partner_id else (partner_id, uid)

            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.chats WHERE user1_id = %s AND user2_id = %s", (u1, u2))
                row = cur.fetchone()
                if row:
                    chat_id = str(row[0])
                else:
                    cur.execute(f"INSERT INTO {SCHEMA}.chats (user1_id, user2_id) VALUES (%s, %s) RETURNING id", (u1, u2))
                    chat_id = str(cur.fetchone()[0])
                    conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'chat_id': chat_id}, ensure_ascii=False)}

        # GET /messages?chat_id=... — получить сообщения чата
        if method == 'GET' and '/messages' in path:
            chat_id = params.get('chat_id')
            if not chat_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'chat_id required'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT m.id, m.sender_id, m.text, m.created_at,
                           u.name, u.color, u.username
                    FROM {SCHEMA}.messages m
                    JOIN {SCHEMA}.users u ON u.id = m.sender_id
                    WHERE m.chat_id = %s
                    ORDER BY m.created_at ASC
                    LIMIT 100
                """, (chat_id,))
                rows = cur.fetchall()

            messages = [{
                'id': str(r[0]),
                'senderId': str(r[1]),
                'text': r[2],
                'time': r[3].strftime('%H:%M'),
                'senderName': r[4],
                'senderColor': r[5],
                'mine': str(r[1]) == user['id'],
            } for r in rows]

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'messages': messages}, ensure_ascii=False)}

        # POST /messages — отправить сообщение
        if method == 'POST' and '/messages' in path:
            chat_id = body.get('chat_id')
            text = body.get('text', '').strip()
            if not chat_id or not text:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'chat_id и text обязательны'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text)
                    VALUES (%s, %s, %s)
                    RETURNING id, created_at
                """, (chat_id, user['id'], text))
                row = cur.fetchone()
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
                'message': {
                    'id': str(row[0]),
                    'senderId': user['id'],
                    'text': text,
                    'time': row[1].strftime('%H:%M'),
                    'mine': True,
                    'senderName': user['name'],
                    'senderColor': user['color'],
                }
            }, ensure_ascii=False)}

        return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}

    finally:
        conn.close()
