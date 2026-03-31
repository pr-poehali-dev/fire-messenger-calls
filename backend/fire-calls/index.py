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

def handler(event: dict, context) -> dict:
    """История звонков FIRE: запись, получение истории."""
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
        user = get_user_by_token(conn, token)
        if not user:
            return {'statusCode': 401, 'headers': cors_headers(), 'body': json.dumps({'error': 'Не авторизован'}, ensure_ascii=False)}

        # GET /calls — история звонков
        if method == 'GET':
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT c.id, c.caller_id, c.callee_id, c.status, c.duration_sec, c.started_at,
                           u1.name as caller_name, u1.color as caller_color, u1.username as caller_username,
                           u2.name as callee_name, u2.color as callee_color, u2.username as callee_username
                    FROM {SCHEMA}.calls c
                    JOIN {SCHEMA}.users u1 ON u1.id = c.caller_id
                    JOIN {SCHEMA}.users u2 ON u2.id = c.callee_id
                    WHERE c.caller_id = %s OR c.callee_id = %s
                    ORDER BY c.started_at DESC
                    LIMIT 50
                """, (user['id'], user['id']))
                rows = cur.fetchall()

            import datetime
            calls = []
            for r in rows:
                is_caller = str(r[1]) == user['id']
                if is_caller:
                    call_type = 'outgoing'
                    partner = {'id': str(r[2]), 'name': r[9], 'color': r[10], 'username': r[11], 'initials': r[9][:2].upper()}
                else:
                    call_type = 'incoming' if r[3] != 'missed' else 'missed'
                    partner = {'id': str(r[1]), 'name': r[6], 'color': r[7], 'username': r[8], 'initials': r[6][:2].upper()}

                duration_sec = r[4] or 0
                if duration_sec > 0:
                    mins = duration_sec // 60
                    secs = duration_sec % 60
                    duration_str = f"{mins:02d}:{secs:02d}"
                else:
                    duration_str = '—'

                started_at = r[5]
                now = datetime.datetime.now(tz=started_at.tzinfo)
                diff = now - started_at
                if diff.days == 0:
                    time_str = f"Сегодня, {started_at.strftime('%H:%M')}"
                elif diff.days == 1:
                    time_str = f"Вчера, {started_at.strftime('%H:%M')}"
                else:
                    time_str = f"{diff.days} дн. назад"

                calls.append({
                    'id': str(r[0]),
                    'user': partner,
                    'type': call_type,
                    'duration': duration_str,
                    'time': time_str,
                })

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'calls': calls}, ensure_ascii=False)}

        # POST /calls — записать звонок
        if method == 'POST':
            callee_id = body.get('callee_id')
            status = body.get('status', 'missed')
            duration_sec = body.get('duration_sec', 0)

            if not callee_id:
                return {'statusCode': 400, 'headers': cors_headers(), 'body': json.dumps({'error': 'callee_id required'}, ensure_ascii=False)}

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.calls (caller_id, callee_id, status, duration_sec)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (user['id'], callee_id, status, duration_sec))
                call_id = str(cur.fetchone()[0])
                conn.commit()

            return {'statusCode': 200, 'headers': cors_headers(), 'body': json.dumps({'call_id': call_id}, ensure_ascii=False)}

        return {'statusCode': 404, 'headers': cors_headers(), 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}

    finally:
        conn.close()
