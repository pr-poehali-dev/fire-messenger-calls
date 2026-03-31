
CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    color VARCHAR(20) DEFAULT '#ff4500',
    status VARCHAR(20) DEFAULT 'offline',
    bio TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    user2_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.chats(id),
    sender_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    creator_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    allow_mats BOOLEAN DEFAULT FALSE,
    who_can_write VARCHAR(20) DEFAULT 'all',
    subscribers_count INT DEFAULT 1,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.channels(id),
    user_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    role VARCHAR(20) DEFAULT 'subscriber',
    banned_until TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.channels(id),
    sender_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.channel_likes (
    channel_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.channels(id),
    user_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    PRIMARY KEY(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS t_p73754089_fire_messenger_calls.calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    callee_id UUID NOT NULL REFERENCES t_p73754089_fire_messenger_calls.users(id),
    status VARCHAR(20) DEFAULT 'missed',
    duration_sec INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON t_p73754089_fire_messenger_calls.messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ch_messages ON t_p73754089_fire_messenger_calls.channel_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p73754089_fire_messenger_calls.sessions(token);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON t_p73754089_fire_messenger_calls.calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON t_p73754089_fire_messenger_calls.calls(callee_id);
