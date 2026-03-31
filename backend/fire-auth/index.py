import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p73754089_fire_messenger_calls')

COLORS = ['#ff4500', '#00d4ff', '#ffaa00', '#ff00aa', '#00ff88', '#aa44ff', '#ff6644', '#44ffcc']

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_user_by_token(conn, token: str):
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT u.id, u.username, u.name, u.color, u.status, u.bio
            FROM {SCHEMA}.sessions s
            JOIN {SCHEMA}.users u ON u.id = s.user_id
            WHERE s.token = %s AND s.expires_at > NOW()
        """, (token,))
        row = cur.fetchone()
        if not row:
            return None
        return {'id': str(row[0]), 'username': row[1], 'name': row[2], 'color': row[3], 'status': row[4], 'bio': row[5]}

def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    }

def handler(event: dict, context) -> dict:
    """Авторизация FIRE: регистрация, вход, профиль, выход, обновление статуса."""
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

    conn = get_conn()

    try:
        # POST /register
        if method == 'POST' and path.endswith('/register'):
            username = body.get('username', '').strip().lower()
            name = body.get('name', '').strip()
            password = body.get('password', '')

            if not username or not name or not password:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Заполни все поля'}, ensure_ascii=False)}
            if len(username) < 3:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Никнейм минимум 3 символа'}, ensure_ascii=False)}
            if len(password) < 4:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Пароль минимум 4 символа'}, ensure_ascii=False)}

            import random
            color = random.choice(COLORS)
            pw_hash = hash_password(password)

            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
                if cur.fetchone():
                    conn.rollback()
                    return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'Никнейм уже занят'}, ensure_ascii=False)}

                cur.execute(f"""
                    INSERT INTO {SCHEMA}.users (username, name, password_hash, color, status)
                    VALUES (%s, %s, %s, %s, 'online')
                    RETURNING id
                """, (username, name, pw_hash, color))
                user_id = str(cur.fetchone()[0])

                session_token = secrets.token_hex(32)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.sessions (user_id, token)
                    VALUES (%s, %s)
                """, (user_id, session_token))
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
                'token': session_token,
                'user': {'id': user_id, 'username': username, 'name': name, 'color': color, 'status': 'online', 'bio': ''}
            }, ensure_ascii=False)}

        # POST /login
        if method == 'POST' and path.endswith('/login'):
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            pw_hash = hash_password(password)

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT id, username, name, color, bio FROM {SCHEMA}.users
                    WHERE username = %s AND password_hash = %s
                """, (username, pw_hash))
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Неверный логин или пароль'}, ensure_ascii=False)}

                user_id = str(row[0])
                session_token = secrets.token_hex(32)

                cur.execute(f"UPDATE {SCHEMA}.users SET status = 'online', last_seen = NOW() WHERE id = %s", (user_id,))
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)", (user_id, session_token))
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({
                'token': session_token,
                'user': {'id': user_id, 'username': row[1], 'name': row[2], 'color': row[3], 'status': 'online', 'bio': row[4] or ''}
            }, ensure_ascii=False)}

        # POST /logout
        if method == 'POST' and path.endswith('/logout'):
            if token:
                with conn.cursor() as cur:
                    cur.execute(f"UPDATE {SCHEMA}.users SET status = 'offline', last_seen = NOW() WHERE id = (SELECT user_id FROM {SCHEMA}.sessions WHERE token = %s)", (token,))
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE token = %s", (token,))
                    conn.commit()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        # GET /me
        if method == 'GET' and path.endswith('/me'):
            user = get_user_by_token(conn, token)
            if not user:
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'}, ensure_ascii=False)}
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'user': user}, ensure_ascii=False)}

        # PUT /status
        if method == 'PUT' and path.endswith('/status'):
            user = get_user_by_token(conn, token)
            if not user:
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'}, ensure_ascii=False)}
            new_status = body.get('status', 'online')
            if new_status not in ('online', 'offline', 'busy', 'away'):
                new_status = 'online'
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.users SET status = %s WHERE id = %s", (new_status, user['id']))
                conn.commit()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        # PUT /profile
        if method == 'PUT' and path.endswith('/profile'):
            user = get_user_by_token(conn, token)
            if not user:
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'}, ensure_ascii=False)}
            name = body.get('name', user['name']).strip()
            bio = body.get('bio', '').strip()
            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.users SET name = %s, bio = %s WHERE id = %s", (name, bio, user['id']))
                conn.commit()
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'ok': True}, ensure_ascii=False)}

        # GET /users — список всех пользователей
        if method == 'GET' and path.endswith('/users'):
            user = get_user_by_token(conn, token)
            if not user:
                return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'}, ensure_ascii=False)}
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT id, username, name, color, status, last_seen
                    FROM {SCHEMA}.users WHERE id != %s
                    ORDER BY status = 'online' DESC, name ASC
                """, (user['id'],))
                rows = cur.fetchall()
            users = [{'id': str(r[0]), 'username': r[1], 'name': r[2], 'color': r[3], 'status': r[4], 'lastSeen': str(r[5])} for r in rows]
            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'users': users}, ensure_ascii=False)}

        return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}

    finally:
        conn.close()
