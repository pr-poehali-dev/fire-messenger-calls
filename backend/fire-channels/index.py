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
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    }

def get_my_role(conn, channel_id: str, user_id: str) -> str:
    with conn.cursor() as cur:
        cur.execute(f"SELECT role FROM {SCHEMA}.channel_members WHERE channel_id = %s AND user_id = %s", (channel_id, user_id))
        row = cur.fetchone()
        return row[0] if row else 'none'

def role_rank(role: str) -> int:
    return {'none': 0, 'subscriber': 1, 'member': 2, 'mod': 3, 'admin': 4, 'vip': 5, 'creator': 6}.get(role, 0)

def handler(event: dict, context) -> dict:
    """Каналы FIRE: список, создание, подписка, сообщения, модерация."""
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

        # GET /channels — список всех каналов
        if method == 'GET' and path.endswith('/channels'):
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT c.id, c.name, c.description, c.subscribers_count, c.likes_count,
                           c.allow_mats, c.who_can_write, c.creator_id,
                           (SELECT role FROM {SCHEMA}.channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = %s) as my_role,
                           EXISTS(SELECT 1 FROM {SCHEMA}.channel_likes cl WHERE cl.channel_id = c.id AND cl.user_id = %s) as liked
                    FROM {SCHEMA}.channels c
                    ORDER BY c.subscribers_count DESC
                """, (user['id'], user['id']))
                rows = cur.fetchall()

            channels = [{
                'id': str(r[0]),
                'name': r[1],
                'description': r[2],
                'subscribers': r[3],
                'likes': r[4],
                'allowMats': r[5],
                'whoCanWrite': r[6],
                'creatorId': str(r[7]),
                'myRole': r[8] or 'none',
                'subscribed': bool(r[8]),
                'liked': bool(r[9]),
            } for r in rows]
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'channels': channels}, ensure_ascii=False)}

        # POST /channels — создать канал
        if method == 'POST' and path.endswith('/channels'):
            name = body.get('name', '').strip()
            description = body.get('description', '').strip()
            if not name:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Название обязательно'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.channels (name, description, creator_id, subscribers_count)
                    VALUES (%s, %s, %s, 1)
                    RETURNING id
                """, (name, description, user['id']))
                channel_id = str(cur.fetchone()[0])
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.channel_members (channel_id, user_id, role)
                    VALUES (%s, %s, 'creator')
                """, (channel_id, user['id']))
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'channel_id': channel_id}, ensure_ascii=False)}

        # POST /channels/subscribe
        if method == 'POST' and '/subscribe' in path:
            channel_id = body.get('channel_id')
            subscribe = body.get('subscribe', True)
            if not channel_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id required'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                if subscribe:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.channel_members (channel_id, user_id, role)
                        VALUES (%s, %s, 'subscriber')
                        ON CONFLICT (channel_id, user_id) DO NOTHING
                    """, (channel_id, user['id']))
                    cur.execute(f"UPDATE {SCHEMA}.channels SET subscribers_count = subscribers_count + 1 WHERE id = %s AND subscribers_count >= 0", (channel_id,))
                else:
                    my_role = get_my_role(conn, channel_id, user['id'])
                    if my_role != 'creator':
                        cur.execute(f"UPDATE {SCHEMA}.channel_members SET role = 'none' WHERE channel_id = %s AND user_id = %s", (channel_id, user['id']))
                        cur.execute(f"UPDATE {SCHEMA}.channels SET subscribers_count = GREATEST(subscribers_count - 1, 0) WHERE id = %s", (channel_id,))
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        # POST /channels/like
        if method == 'POST' and '/like' in path:
            channel_id = body.get('channel_id')
            like = body.get('like', True)
            if not channel_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id required'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                if like:
                    cur.execute(f"INSERT INTO {SCHEMA}.channel_likes (channel_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (channel_id, user['id']))
                    cur.execute(f"UPDATE {SCHEMA}.channels SET likes_count = likes_count + 1 WHERE id = %s", (channel_id,))
                else:
                    cur.execute(f"UPDATE {SCHEMA}.channel_likes SET channel_id = channel_id WHERE channel_id = %s AND user_id = %s", (channel_id, user['id']))
                    cur.execute(f"UPDATE {SCHEMA}.channels SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = %s", (channel_id,))
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        # GET /channels/messages?channel_id=...
        if method == 'GET' and '/channel-messages' in path:
            channel_id = params.get('channel_id')
            if not channel_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id required'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT m.id, m.sender_id, m.text, m.created_at,
                           u.name, u.color, u.username,
                           COALESCE(cm.role, 'subscriber') as role
                    FROM {SCHEMA}.channel_messages m
                    JOIN {SCHEMA}.users u ON u.id = m.sender_id
                    LEFT JOIN {SCHEMA}.channel_members cm ON cm.channel_id = m.channel_id AND cm.user_id = m.sender_id
                    WHERE m.channel_id = %s
                    ORDER BY m.created_at ASC
                    LIMIT 100
                """, (channel_id,))
                rows = cur.fetchall()

            messages = [{
                'id': str(r[0]),
                'senderId': str(r[1]),
                'text': r[2],
                'time': r[3].strftime('%H:%M'),
                'senderName': r[4],
                'senderColor': r[5],
                'senderUsername': r[6],
                'senderRole': r[7],
                'mine': str(r[1]) == user['id'],
            } for r in rows]

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'messages': messages}, ensure_ascii=False)}

        # POST /channel-messages — отправить сообщение в канал
        if method == 'POST' and '/channel-messages' in path:
            channel_id = body.get('channel_id')
            text = body.get('text', '').strip()
            if not channel_id or not text:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id и text обязательны'}, ensure_ascii=False)}

            my_role = get_my_role(conn, channel_id, user['id'])
            with conn.cursor() as cur:
                cur.execute(f"SELECT who_can_write FROM {SCHEMA}.channels WHERE id = %s", (channel_id,))
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Канал не найден'}, ensure_ascii=False)}
                who = row[0]

            can_write = (
                role_rank(my_role) >= 4 or  # admin+
                (who == 'all' and role_rank(my_role) >= 1) or
                (who == 'mod' and role_rank(my_role) >= 3) or
                (who == 'admin' and role_rank(my_role) >= 4) or
                (who == 'vip' and role_rank(my_role) >= 5) or
                (who == 'creator' and role_rank(my_role) >= 6)
            )
            if not can_write:
                return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нет прав писать в канал'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.channel_messages (channel_id, sender_id, text)
                    VALUES (%s, %s, %s)
                    RETURNING id, created_at
                """, (channel_id, user['id'], text))
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
                    'senderRole': my_role,
                }
            }, ensure_ascii=False)}

        # GET /channel-members?channel_id=...
        if method == 'GET' and '/channel-members' in path:
            channel_id = params.get('channel_id')
            if not channel_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id required'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT u.id, u.username, u.name, u.color, u.status, cm.role
                    FROM {SCHEMA}.channel_members cm
                    JOIN {SCHEMA}.users u ON u.id = cm.user_id
                    WHERE cm.channel_id = %s AND cm.role != 'none'
                    ORDER BY CASE cm.role
                        WHEN 'creator' THEN 1
                        WHEN 'vip' THEN 2
                        WHEN 'admin' THEN 3
                        WHEN 'mod' THEN 4
                        ELSE 5
                    END, u.name
                """, (channel_id,))
                rows = cur.fetchall()

            members = [{'id': str(r[0]), 'username': r[1], 'name': r[2], 'color': r[3], 'status': r[4], 'role': r[5]} for r in rows]
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'members': members}, ensure_ascii=False)}

        # PUT /channel-settings
        if method == 'PUT' and '/channel-settings' in path:
            channel_id = body.get('channel_id')
            if not channel_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id required'}, ensure_ascii=False)}

            my_role = get_my_role(conn, channel_id, user['id'])
            if role_rank(my_role) < 4:
                return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нет прав'}, ensure_ascii=False)}

            allow_mats = body.get('allowMats')
            who_can_write = body.get('whoCanWrite')
            name = body.get('name', '').strip()
            description = body.get('description', '').strip()

            updates = []
            vals = []
            if allow_mats is not None:
                updates.append('allow_mats = %s')
                vals.append(allow_mats)
            if who_can_write:
                updates.append('who_can_write = %s')
                vals.append(who_can_write)
            if name:
                updates.append('name = %s')
                vals.append(name)
            if description is not None:
                updates.append('description = %s')
                vals.append(description)

            if updates:
                vals.append(channel_id)
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE {SCHEMA}.channels SET {', '.join(updates)} WHERE id = %s", vals)
                    conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        # POST /assign-role
        if method == 'POST' and '/assign-role' in path:
            channel_id = body.get('channel_id')
            target_user_id = body.get('user_id')
            new_role = body.get('role')

            if not all([channel_id, target_user_id, new_role]):
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'channel_id, user_id, role required'}, ensure_ascii=False)}

            my_role = get_my_role(conn, channel_id, user['id'])
            target_role = get_my_role(conn, channel_id, target_user_id)

            if role_rank(my_role) <= role_rank(target_role) or role_rank(my_role) < 5:
                return {'statusCode': 403, 'headers': cors_headers(), 'body': json.dumps({'error': 'Нет прав назначать эту роль'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.channel_members (channel_id, user_id, role)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (channel_id, user_id) DO UPDATE SET role = %s
                """, (channel_id, target_user_id, new_role, new_role))
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}

    finally:
        conn.close()
