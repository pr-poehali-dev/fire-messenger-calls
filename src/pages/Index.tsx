import { useState, useRef, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import * as api from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'loading' | 'auth' | 'app';
type AuthMode = 'login' | 'register';
type Section = 'chats' | 'calls' | 'channels' | 'contacts' | 'profile' | 'settings';
type CallState = 'idle' | 'calling' | 'incoming' | 'active';
type ChannelRole = 'creator' | 'vip' | 'admin' | 'mod' | 'member' | 'subscriber' | 'none';

interface ApiUser {
  id: string;
  username: string;
  name: string;
  color: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  bio?: string;
}

interface User {
  id: string;
  name: string;
  username: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  initials: string;
  color: string;
}

interface ApiMessage {
  id: string;
  senderId: string;
  text: string;
  time: string;
  mine: boolean;
  senderName: string;
  senderColor: string;
  senderUsername?: string;
  senderRole?: ChannelRole;
}

interface ApiChat {
  id: string;
  partner: {
    id: string;
    username: string;
    name: string;
    color: string;
    status: 'online' | 'offline' | 'busy' | 'away';
  };
  lastMsg: string;
  lastTime: string;
}

interface ApiCallRecord {
  id: string;
  user: {
    id: string;
    name: string;
    color: string;
    username: string;
    initials?: string;
  };
  type: 'incoming' | 'outgoing' | 'missed';
  duration: string;
  time: string;
}

interface ApiChannel {
  id: string;
  name: string;
  description: string;
  subscribers: number;
  likes: number;
  allowMats: boolean;
  whoCanWrite: 'all' | 'mod' | 'admin' | 'vip' | 'creator';
  myRole: ChannelRole;
  subscribed: boolean;
  liked: boolean;
}

interface ApiChannelMember {
  id: string;
  username: string;
  name: string;
  color: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  role: ChannelRole;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string): string =>
  name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const apiUserToUser = (u: ApiUser): User => ({
  id: u.id,
  name: u.name,
  username: u.username,
  status: u.status,
  color: u.color,
  initials: getInitials(u.name),
});

const statusColor = (s: string) => {
  if (s === 'online') return 'var(--fire-online)';
  if (s === 'busy') return 'var(--fire-red)';
  if (s === 'away') return 'var(--fire-amber)';
  return 'var(--fire-offline)';
};

const statusLabel = (s: string) => {
  if (s === 'online') return 'онлайн';
  if (s === 'busy') return 'занят';
  if (s === 'away') return 'отошёл';
  return 'офлайн';
};

const roleLabel: Record<ChannelRole, string> = {
  creator: 'Создатель',
  vip: 'VIP',
  admin: 'Админ',
  mod: 'Модератор',
  member: 'Участник',
  subscriber: 'Подписчик',
  none: '',
};

const RoleBadge = ({ role }: { role: ChannelRole }) => {
  if (role === 'member' || role === 'subscriber' || role === 'none') return null;
  const cls: Record<string, string> = {
    creator: 'fire-role-creator',
    vip: 'fire-role-vip',
    admin: 'fire-role-admin',
    mod: 'fire-role-mod',
  };
  return <span className={`fire-role ${cls[role] || ''}`}>{roleLabel[role]}</span>;
};

const Avatar = ({ user, size = 36, showStatus = false }: { user: User; size?: number; showStatus?: boolean }) => (
  <div
    className="fire-avatar"
    style={{ width: size, height: size, fontSize: size * 0.36, borderColor: user.color + '44', position: 'relative', flexShrink: 0 }}
  >
    <span style={{ color: user.color }}>{user.initials}</span>
    {showStatus && (
      <span style={{
        position: 'absolute', bottom: 0, right: 0,
        width: size * 0.28, height: size * 0.28,
        borderRadius: '50%',
        background: statusColor(user.status),
        border: '2px solid var(--fire-bg)',
        boxShadow: `0 0 6px ${statusColor(user.status)}`,
      }} />
    )}
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center h-full w-full">
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: '3px solid var(--fire-border)',
      borderTopColor: 'var(--fire-orange)',
      animation: 'spin 0.7s linear infinite',
    }} />
  </div>
);

// ─── Auth Screen ──────────────────────────────────────────────────────────────

const AuthScreen = ({ onAuth }: { onAuth: (user: ApiUser) => void }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [form, setForm] = useState({ login: '', password: '', name: '', username: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.login.trim() || !form.password.trim()) {
      setError('Заполните все поля');
      return;
    }
    if (mode === 'register' && (!form.name.trim() || !form.username.trim())) {
      setError('Заполните имя и никнейм');
      return;
    }
    setLoading(true);
    try {
      let data: { token?: string; user?: ApiUser; error?: string };
      if (mode === 'login') {
        data = await api.login(form.login.trim(), form.password);
      } else {
        data = await api.register(form.username.trim(), form.name.trim(), form.password);
      }
      if (data.error) {
        setError(data.error);
      } else if (data.token && data.user) {
        api.setToken(data.token);
        api.storeUser(data.user);
        onAuth(data.user);
      } else {
        setError('Неизвестная ошибка');
      }
    } catch {
      setError('Ошибка сети, попробуйте снова');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fire-auth-bg fire-app flex items-center justify-center">
      <div className="fire-grid-bg" />
      <div className="fire-scanlines" />

      <div className="relative z-10 w-full max-w-[400px] px-6 animate-fire-in">
        <div className="text-center mb-10">
          <div className="fire-logo mb-2" style={{ fontSize: 64, letterSpacing: 12 }}>FIRE</div>
          <div className="text-xs tracking-[4px] uppercase" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>
            голосовые звонки · чаты · каналы
          </div>
        </div>

        <div className="fire-card p-8">
          <div
            className="flex mb-8 rounded-lg overflow-hidden"
            style={{ background: 'var(--fire-surface-2)', border: '1px solid var(--fire-border)' }}
          >
            {(['login', 'register'] as AuthMode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2.5 text-sm transition-all"
                style={{
                  fontFamily: 'Rajdhani',
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  background: mode === m ? 'var(--fire-orange)' : 'transparent',
                  color: mode === m ? '#fff' : 'var(--fire-text-dim)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {m === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Имя</label>
                  <input className="fire-input" placeholder="Как тебя зовут?" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Никнейм</label>
                  <input className="fire-input" placeholder="@username" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
                </div>
              </>
            )}
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Логин</label>
              <input className="fire-input" placeholder="Логин или email" value={form.login} onChange={e => setForm(p => ({ ...p, login: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Пароль</label>
              <input className="fire-input" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>

            {error && (
              <div style={{ color: 'var(--fire-red)', fontSize: 12, fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="fire-btn fire-btn-primary w-full animate-fire-glow"
              style={{ fontSize: 15, padding: '12px 0', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Загрузка...' : mode === 'login' ? 'Войти в систему' : 'Создать аккаунт'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-xs" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>
          FIRE v1.0 · Encrypted · Secure
        </p>
      </div>
    </div>
  );
};

// ─── Chat View ────────────────────────────────────────────────────────────────

const ChatView = ({ chatId, partner, onCall }: { chatId: string; partner: User; onCall: (user: User) => void }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMessages = useCallback(async () => {
    const data = await api.getMessages(chatId);
    if (data.messages) {
      setMessages(data.messages);
    }
  }, [chatId]);

  useEffect(() => {
    setLoading(true);
    loadMessages().finally(() => setLoading(false));

    pollRef.current = setInterval(loadMessages, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [chatId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    const data = await api.sendMessage(chatId, text);
    if (data.message) {
      setMessages(p => [...p, data.message]);
    } else {
      await loadMessages();
    }
  };

  return (
    <div className="flex flex-col h-full animate-fire-slide">
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--fire-border)', background: 'var(--fire-surface)' }}>
        <div className="flex items-center gap-3">
          <Avatar user={partner} size={38} showStatus />
          <div>
            <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 1 }}>{partner.name}</div>
            <div className="text-xs" style={{ color: statusColor(partner.status) }}>{statusLabel(partner.status)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onCall(partner)} className="fire-btn" style={{ padding: '7px 12px', borderColor: 'var(--fire-online)', color: 'var(--fire-online)' }}>
            <Icon name="Phone" size={15} />
          </button>
          <button onClick={() => onCall(partner)} className="fire-btn" style={{ padding: '7px 12px' }}>
            <Icon name="Video" size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 2, fontSize: 13, textTransform: 'uppercase' }}>
            Начните общение
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.mine ? 'flex-row-reverse' : ''}`}>
              {!msg.mine && (
                <div
                  className="fire-avatar"
                  style={{ width: 28, height: 28, fontSize: 28 * 0.36, borderColor: msg.senderColor + '44', position: 'relative', flexShrink: 0 }}
                >
                  <span style={{ color: msg.senderColor }}>{getInitials(msg.senderName)}</span>
                </div>
              )}
              <div className={`fire-msg ${msg.mine ? 'mine' : ''}`}>
                <div>{msg.text}</div>
                <div className="text-right mt-1" style={{ fontSize: 10, color: 'var(--fire-text-muted)' }}>{msg.time}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--fire-border)', background: 'var(--fire-surface)' }}>
        <input
          className="fire-input flex-1"
          placeholder="Сообщение..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
        />
        <button onClick={send} className="fire-btn fire-btn-primary" style={{ padding: '10px 16px', minWidth: 0 }}>
          <Icon name="Send" size={16} />
        </button>
      </div>
    </div>
  );
};

// ─── Chats Section ────────────────────────────────────────────────────────────

const ChatsSection = ({ onCall }: { onCall: (user: User) => void }) => {
  const [chats, setChats] = useState<ApiChat[]>([]);
  const [activeChat, setActiveChat] = useState<ApiChat | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChats().then(data => {
      if (data.chats) setChats(data.chats);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = chats.filter(c =>
    c.partner.name.toLowerCase().includes(search.toLowerCase()) ||
    c.partner.username.toLowerCase().includes(search.toLowerCase())
  );

  const openChat = async (chat: ApiChat) => {
    setActiveChat(chat);
  };

  const partnerToUser = (partner: ApiChat['partner']): User => ({
    id: partner.id,
    name: partner.name,
    username: partner.username,
    status: partner.status,
    color: partner.color,
    initials: getInitials(partner.name),
  });

  return (
    <div className="flex h-full">
      <div className="fire-panel w-72 flex flex-col flex-shrink-0">
        <div className="p-4 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="text-xs uppercase tracking-[3px] mb-3 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Сообщения</div>
          <input className="fire-input" placeholder="Поиск чатов..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
              Нет чатов
            </div>
          ) : (
            filtered.map(chat => (
              <div
                key={chat.id}
                onClick={() => openChat(chat)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b transition-all"
                style={{
                  borderColor: 'var(--fire-border)',
                  background: activeChat?.id === chat.id ? 'rgba(255,69,0,0.08)' : 'transparent',
                }}
              >
                <Avatar user={partnerToUser(chat.partner)} size={40} showStatus />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm truncate" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{chat.partner.name}</span>
                    <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--fire-text-muted)' }}>{chat.lastTime}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-xs truncate" style={{ color: 'var(--fire-text-dim)' }}>{chat.lastMsg}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="fire-main flex-1">
        {activeChat ? (
          <ChatView
            key={activeChat.id}
            chatId={activeChat.id}
            partner={partnerToUser(activeChat.partner)}
            onCall={onCall}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--fire-text-muted)' }}>
            <div className="text-5xl mb-4" style={{ opacity: 0.2 }}>🔥</div>
            <div style={{ fontFamily: 'Rajdhani', textTransform: 'uppercase', letterSpacing: 4, fontSize: 13 }}>Выбери чат</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Calls Section ────────────────────────────────────────────────────────────

const CallsSection = ({ onCall }: { onCall: (user: User) => void }) => {
  const [calls, setCalls] = useState<ApiCallRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    api.getCalls().then(data => {
      if (data.calls) setCalls(data.calls);
    }).finally(() => setLoadingCalls(false));

    api.getUsers().then(data => {
      if (data.users) {
        setUsers(data.users.map((u: ApiUser) => apiUserToUser(u)));
      }
    }).finally(() => setLoadingUsers(false));
  }, []);

  const callRecordUser = (cr: ApiCallRecord): User => ({
    id: cr.user.id,
    name: cr.user.name,
    username: cr.user.username,
    status: 'offline',
    color: cr.user.color,
    initials: cr.user.initials || getInitials(cr.user.name),
  });

  return (
    <div className="flex h-full">
      <div className="fire-panel w-72 flex flex-col flex-shrink-0">
        <div className="p-4 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="text-xs uppercase tracking-[3px] font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>История звонков</div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingCalls ? (
            <Spinner />
          ) : calls.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
              Нет звонков
            </div>
          ) : (
            calls.map(call => (
              <div key={call.id} className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-all" style={{ borderColor: 'var(--fire-border)' }}>
                <Avatar user={callRecordUser(call)} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani' }}>{call.user.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Icon
                      name={call.type === 'missed' ? 'PhoneMissed' : call.type === 'incoming' ? 'PhoneIncoming' : 'PhoneOutgoing'}
                      size={12}
                      style={{ color: call.type === 'missed' ? 'var(--fire-red)' : call.type === 'incoming' ? 'var(--fire-online)' : 'var(--fire-cyan)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--fire-text-dim)' }}>{call.time}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="fire-mono text-xs" style={{ color: call.type === 'missed' ? 'var(--fire-red)' : 'var(--fire-text-muted)' }}>{call.duration}</div>
                  <button className="fire-btn mt-1" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => onCall(callRecordUser(call))}>
                    <Icon name="Phone" size={10} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="fire-main flex-1 flex flex-col">
        <div className="p-5 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="text-xs uppercase tracking-[3px] mb-3 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Контакты</div>

          <div className="fire-card p-4 flex items-center gap-4 mb-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,69,0,0.15)', border: '1px solid rgba(255,69,0,0.3)' }}>
              <Icon name="Users" size={18} style={{ color: 'var(--fire-orange)' }} />
            </div>
            <div className="flex-1">
              <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 1 }}>Групповой звонок</div>
              <div className="text-xs" style={{ color: 'var(--fire-text-dim)' }}>Создай ссылку и пригласи участников</div>
            </div>
            <button className="fire-btn fire-btn-primary" style={{ padding: '7px 16px', fontSize: 12 }}>+ Создать</button>
          </div>

          <div className="fire-card p-3 flex items-center gap-3">
            <Icon name="Link" size={14} style={{ color: 'var(--fire-cyan)' }} />
            <span className="fire-mono text-xs flex-1" style={{ color: 'var(--fire-text-dim)' }}>fire.app/call/x9k2m7p3</span>
            <button className="fire-btn" style={{ padding: '4px 12px', fontSize: 11, borderColor: 'var(--fire-cyan)', color: 'var(--fire-cyan)' }}>Копировать</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loadingUsers ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {users.map(user => (
                <div key={user.id} className="fire-card p-4 flex flex-col items-center gap-3">
                  <Avatar user={user} size={52} showStatus />
                  <div className="text-center">
                    <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{user.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: statusColor(user.status) }}>{statusLabel(user.status)}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onCall(user)}
                      className="fire-btn"
                      style={{ padding: '6px 12px', fontSize: 12, borderColor: 'var(--fire-online)', color: 'var(--fire-online)' }}
                    >
                      <Icon name="Phone" size={13} />
                    </button>
                    <button
                      onClick={() => onCall(user)}
                      className="fire-btn"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                    >
                      <Icon name="Video" size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Channel View ─────────────────────────────────────────────────────────────

const ChannelView = ({
  channel,
  onUpdate,
}: {
  channel: ApiChannel;
  onUpdate: (ch: ApiChannel) => void;
}) => {
  const [tab, setTab] = useState<'chat' | 'members' | 'settings'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [members, setMembers] = useState<ApiChannelMember[]>([]);
  const [ch, setCh] = useState<ApiChannel>(channel);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [settingsName, setSettingsName] = useState(channel.name);
  const [settingsDesc, setSettingsDesc] = useState(channel.description);
  const [savingSettings, setSavingSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myRole = ch.myRole;

  const loadMessages = useCallback(async () => {
    const data = await api.getChannelMessages(ch.id);
    if (data.messages) setMessages(data.messages);
  }, [ch.id]);

  useEffect(() => {
    setCh(channel);
    setSettingsName(channel.name);
    setSettingsDesc(channel.description);
  }, [channel]);

  useEffect(() => {
    setLoadingMsgs(true);
    loadMessages().finally(() => setLoadingMsgs(false));
    pollRef.current = setInterval(loadMessages, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [channel.id, loadMessages]);

  useEffect(() => {
    if (tab === 'members') {
      setLoadingMembers(true);
      api.getChannelMembers(ch.id).then(data => {
        if (data.members) setMembers(data.members);
      }).finally(() => setLoadingMembers(false));
    }
  }, [tab, ch.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canWrite = () => {
    if (myRole === 'creator' || myRole === 'vip' || myRole === 'admin') return true;
    if (myRole === 'mod' && (ch.whoCanWrite === 'all' || ch.whoCanWrite === 'mod')) return true;
    if (myRole === 'member' && ch.whoCanWrite === 'all') return true;
    return false;
  };

  const send = async () => {
    if (!input.trim() || !canWrite()) return;
    const text = input.trim();
    setInput('');
    const data = await api.sendChannelMessage(ch.id, text);
    if (data.message) {
      setMessages(p => [...p, data.message]);
    } else {
      await loadMessages();
    }
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const toggleLike = async () => {
    const newLiked = !ch.liked;
    const updated = { ...ch, liked: newLiked, likes: newLiked ? ch.likes + 1 : ch.likes - 1 };
    setCh(updated);
    onUpdate(updated);
    await api.likeChannel(ch.id, newLiked);
  };

  const toggleSub = async () => {
    const newSub = !ch.subscribed;
    const updated = { ...ch, subscribed: newSub, subscribers: newSub ? ch.subscribers + 1 : ch.subscribers - 1 };
    setCh(updated);
    onUpdate(updated);
    await api.subscribeChannel(ch.id, newSub);
  };

  const canManage = (targetRole: ChannelRole) => {
    const order: ChannelRole[] = ['none', 'subscriber', 'member', 'mod', 'admin', 'vip', 'creator'];
    return order.indexOf(myRole) > order.indexOf(targetRole);
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await api.updateChannelSettings(ch.id, {
      name: settingsName,
      description: settingsDesc,
      allowMats: ch.allowMats,
      whoCanWrite: ch.whoCanWrite,
    });
    const updated = { ...ch, name: settingsName, description: settingsDesc };
    setCh(updated);
    onUpdate(updated);
    setSavingSettings(false);
  };

  const memberToUser = (m: ApiChannelMember): User => ({
    id: m.id,
    name: m.name,
    username: m.username,
    status: m.status,
    color: m.color,
    initials: getInitials(m.name),
  });

  return (
    <div className="flex flex-col h-full animate-fire-slide">
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--fire-border)', background: 'var(--fire-surface)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ background: 'rgba(255,69,0,0.15)', border: '1px solid rgba(255,69,0,0.3)' }}>🔥</div>
            <div>
              <div className="font-bold" style={{ fontFamily: 'Rajdhani', letterSpacing: 1 }}>{ch.name}</div>
              <div className="text-xs" style={{ color: 'var(--fire-text-muted)' }}>{ch.subscribers.toLocaleString()} подписчиков</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLike}
              className="fire-btn flex items-center gap-1.5"
              style={{ padding: '5px 12px', borderColor: ch.liked ? 'var(--fire-red)' : 'var(--fire-border)', color: ch.liked ? 'var(--fire-red)' : 'var(--fire-text-dim)', fontSize: 12 }}
            >
              <Icon name="Heart" size={13} /> {ch.likes.toLocaleString()}
            </button>
            <button
              onClick={toggleSub}
              className={`fire-btn ${ch.subscribed ? '' : 'fire-btn-primary'}`}
              style={{ padding: '5px 14px', fontSize: 12 }}
            >
              {ch.subscribed ? 'Отписаться' : 'Подписаться'}
            </button>
          </div>
        </div>

        <div className="flex gap-1 mt-3">
          {(['chat', 'members', 'settings'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="fire-btn"
              style={{
                padding: '4px 14px', fontSize: 11, letterSpacing: 1,
                fontFamily: 'Rajdhani', textTransform: 'uppercase',
                background: tab === t ? 'rgba(255,69,0,0.15)' : 'transparent',
                borderColor: tab === t ? 'var(--fire-orange)' : 'var(--fire-border)',
                color: tab === t ? 'var(--fire-orange)' : 'var(--fire-text-dim)',
              }}
            >
              {t === 'chat' ? 'Чат' : t === 'members' ? 'Участники' : 'Настройки'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {loadingMsgs ? (
              <Spinner />
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 2, fontSize: 13, textTransform: 'uppercase' }}>
                Нет сообщений
              </div>
            ) : (
              messages.map(msg => (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.mine ? 'flex-row-reverse' : ''}`}>
                  {!msg.mine && (
                    <div
                      className="fire-avatar"
                      style={{ width: 28, height: 28, fontSize: 28 * 0.36, borderColor: msg.senderColor + '44', position: 'relative', flexShrink: 0 }}
                    >
                      <span style={{ color: msg.senderColor }}>{getInitials(msg.senderName)}</span>
                    </div>
                  )}
                  <div className={`fire-msg ${msg.mine ? 'mine' : ''}`}>
                    {!msg.mine && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: msg.senderColor }}>{msg.senderName}</span>
                        {msg.senderRole && <RoleBadge role={msg.senderRole} />}
                      </div>
                    )}
                    <div>{msg.text}</div>
                    <div className="text-right mt-1" style={{ fontSize: 10, color: 'var(--fire-text-muted)' }}>{msg.time}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--fire-border)', background: 'var(--fire-surface)' }}>
            {canWrite() ? (
              <>
                <input className="fire-input flex-1" placeholder="Сообщение..." value={input}
                  onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
                <button onClick={send} className="fire-btn fire-btn-primary" style={{ padding: '10px 16px', minWidth: 0 }}>
                  <Icon name="Send" size={16} />
                </button>
              </>
            ) : (
              <div className="flex-1 text-center text-xs py-2.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
                ⛔ Писать могут только {ch.whoCanWrite === 'admin' ? 'Администраторы' : ch.whoCanWrite === 'mod' ? 'Модераторы' : 'ВИП и выше'}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {loadingMembers ? (
            <Spinner />
          ) : members.length === 0 ? (
            <div className="text-center text-xs py-8" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
              Нет участников
            </div>
          ) : (
            members.map(m => (
              <div key={m.id} className="fire-member-row">
                <Avatar user={memberToUser(m)} size={36} showStatus />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm" style={{ fontFamily: 'Rajdhani' }}>{m.name}</span>
                    <RoleBadge role={m.role} />
                  </div>
                  <div className="text-xs" style={{ color: 'var(--fire-text-dim)' }}>@{m.username}</div>
                </div>
                {canManage(m.role) && (
                  <div className="flex gap-1">
                    <button className="fire-btn fire-btn-danger" style={{ padding: '4px 8px', fontSize: 10 }} title="Заблокировать">
                      <Icon name="Ban" size={12} />
                    </button>
                    {(myRole === 'creator' || myRole === 'vip') && (
                      <button className="fire-btn" style={{ padding: '4px 8px', fontSize: 10 }} title="Назначить роль">
                        <Icon name="Shield" size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (myRole === 'creator' || myRole === 'vip' || myRole === 'admin') && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Название канала</label>
            <input className="fire-input" value={settingsName} onChange={e => setSettingsName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Описание</label>
            <textarea className="fire-input" rows={3} value={settingsDesc} onChange={e => setSettingsDesc(e.target.value)} style={{ resize: 'none' }} />
          </div>
          <div className="fire-card p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani' }}>Разрешить мат</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--fire-text-dim)' }}>Нецензурные выражения</div>
            </div>
            <button onClick={() => setCh(p => ({ ...p, allowMats: !p.allowMats }))}
              className="w-12 h-6 rounded-full relative transition-all" style={{ background: ch.allowMats ? 'var(--fire-orange)' : 'var(--fire-border)' }}>
              <div className="w-4 h-4 rounded-full absolute top-1 transition-all" style={{ background: '#fff', left: ch.allowMats ? '28px' : '4px' }} />
            </button>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Кто может писать</label>
            <div className="space-y-2">
              {(['all', 'mod', 'admin', 'vip', 'creator'] as const).map(opt => (
                <label key={opt} className="fire-member-row cursor-pointer" style={{ userSelect: 'none' }}>
                  <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: ch.whoCanWrite === opt ? 'var(--fire-orange)' : 'var(--fire-border)', background: ch.whoCanWrite === opt ? 'var(--fire-orange)' : 'transparent', cursor: 'pointer' }}
                    onClick={() => setCh(p => ({ ...p, whoCanWrite: opt }))}>
                    {ch.whoCanWrite === opt && <Icon name="Check" size={10} style={{ color: '#fff' }} />}
                  </div>
                  <span className="text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>
                    {opt === 'all' ? 'Все подписчики' : opt === 'mod' ? 'Модераторы и выше' : opt === 'admin' ? 'Администраторы и выше' : opt === 'vip' ? 'ВИП и выше' : 'Только создатель'}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button
            className="fire-btn fire-btn-primary w-full"
            onClick={saveSettings}
            disabled={savingSettings}
            style={{ opacity: savingSettings ? 0.7 : 1 }}
          >
            {savingSettings ? 'Сохранение...' : 'Сохранить настройки'}
          </button>
        </div>
      )}

      {tab === 'settings' && myRole !== 'creator' && myRole !== 'vip' && myRole !== 'admin' && (
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--fire-text-muted)' }}>
          <div className="text-center">
            <Icon name="Lock" size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div className="text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 1 }}>Нет доступа к настройкам</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Channels Section ─────────────────────────────────────────────────────────

const ChannelsSection = () => {
  const [channels, setChannels] = useState<ApiChannel[]>([]);
  const [active, setActive] = useState<ApiChannel | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating_loading, setCreatingLoading] = useState(false);

  useEffect(() => {
    api.getChannels().then(data => {
      if (data.channels) setChannels(data.channels);
    }).finally(() => setLoading(false));
  }, []);

  const createChannel = async () => {
    if (!newName.trim()) return;
    setCreatingLoading(true);
    const data = await api.createChannel(newName.trim(), newDesc.trim());
    if (data.channel_id) {
      const refreshed = await api.getChannels();
      if (refreshed.channels) {
        setChannels(refreshed.channels);
        const created = refreshed.channels.find((c: ApiChannel) => c.id === data.channel_id);
        if (created) setActive(created);
      }
    }
    setCreating(false);
    setNewName('');
    setNewDesc('');
    setCreatingLoading(false);
  };

  return (
    <div className="flex h-full">
      <div className="fire-panel w-72 flex flex-col flex-shrink-0">
        <div className="p-4 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-[3px] font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Каналы</div>
            <button onClick={() => setCreating(true)} className="fire-btn fire-btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>+ Создать</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <Spinner />
          ) : channels.length === 0 ? (
            <div className="p-4 text-center text-xs" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 1 }}>
              Нет каналов
            </div>
          ) : (
            channels.map(ch => (
              <div key={ch.id} onClick={() => { setActive(ch); setCreating(false); }}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b transition-all"
                style={{ borderColor: 'var(--fire-border)', background: active?.id === ch.id && !creating ? 'rgba(255,69,0,0.08)' : 'transparent' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                  style={{ background: 'rgba(255,69,0,0.12)', border: '1px solid rgba(255,69,0,0.25)' }}>🔥</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{ch.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--fire-text-dim)' }}>{ch.subscribers.toLocaleString()} подписчиков</div>
                </div>
                {ch.subscribed && (
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--fire-orange)' }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="fire-main flex-1">
        {creating ? (
          <div className="p-8 max-w-lg animate-fire-in">
            <div className="text-xs uppercase tracking-[3px] mb-6 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Новый канал</div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Название</label>
                <input className="fire-input" placeholder="Название канала" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Описание</label>
                <textarea className="fire-input" rows={3} placeholder="О чём канал?" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ resize: 'none' }} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={createChannel}
                  disabled={creating_loading || !newName.trim()}
                  className="fire-btn fire-btn-primary flex-1"
                  style={{ opacity: creating_loading || !newName.trim() ? 0.6 : 1 }}
                >
                  {creating_loading ? 'Создание...' : 'Создать канал'}
                </button>
                <button onClick={() => { setCreating(false); setNewName(''); setNewDesc(''); }} className="fire-btn">Отмена</button>
              </div>
            </div>
          </div>
        ) : active ? (
          <ChannelView
            key={active.id}
            channel={active}
            onUpdate={updated => setChannels(p => p.map(c => c.id === updated.id ? updated : c))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--fire-text-muted)' }}>
            <div className="text-5xl mb-4" style={{ opacity: 0.2 }}>📡</div>
            <div style={{ fontFamily: 'Rajdhani', textTransform: 'uppercase', letterSpacing: 4, fontSize: 13 }}>Выбери канал</div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Profile Section ──────────────────────────────────────────────────────────

const ProfileSection = () => {
  const storedRaw = api.getStoredUser();
  const stored: ApiUser | null = storedRaw as ApiUser | null;

  const [status, setStatus] = useState<ApiUser['status']>(stored?.status || 'online');
  const [name, setName] = useState(stored?.name || '');
  const [bio, setBio] = useState(stored?.bio || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  const me: User = stored ? apiUserToUser({ ...stored, status }) : {
    id: '', name: name || 'User', username: '', status, color: '#ff4500', initials: getInitials(name || 'U'),
  };

  const handleStatusChange = async (s: ApiUser['status']) => {
    setStatus(s);
    await api.updateStatus(s);
    if (stored) api.storeUser({ ...stored, status: s });
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Имя не может быть пустым'); return; }
    setSaving(true);
    setError('');
    const data = await api.updateProfile(name.trim(), bio.trim());
    if (data.error) {
      setError(data.error);
    } else {
      if (stored) api.storeUser({ ...stored, name: name.trim(), bio: bio.trim() });
      setSavedMsg('Сохранено!');
      setTimeout(() => setSavedMsg(''), 2000);
    }
    setSaving(false);
  };

  return (
    <div className="fire-main flex-1 p-8 overflow-y-auto animate-fire-in">
      <div className="max-w-xl mx-auto">
        <div className="text-xs uppercase tracking-[4px] mb-8 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Мой профиль</div>
        <div className="fire-card p-8 flex flex-col items-center gap-6 mb-6">
          <div className="relative">
            <Avatar user={me} size={96} />
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--fire-orange)', border: '2px solid var(--fire-bg)' }}>
              <Icon name="Camera" size={12} style={{ color: '#fff' }} />
            </button>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ fontFamily: 'Rajdhani', letterSpacing: 2 }}>{me.name}</div>
            <div className="text-sm mt-1" style={{ color: 'var(--fire-text-dim)' }}>@{stored?.username || ''}</div>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            {(['online', 'busy', 'away', 'offline'] as const).map(s => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
                style={{ background: status === s ? 'rgba(255,69,0,0.12)' : 'transparent', border: `1px solid ${status === s ? 'var(--fire-orange)' : 'var(--fire-border)'}`, cursor: 'pointer' }}>
                <div className="w-3 h-3 rounded-full" style={{ background: statusColor(s), boxShadow: `0 0 6px ${statusColor(s)}` }} />
                <span className="text-xs" style={{ fontFamily: 'Rajdhani', color: status === s ? 'var(--fire-text)' : 'var(--fire-text-muted)' }}>{statusLabel(s)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="fire-card p-6 space-y-4">
          <div className="text-xs uppercase tracking-[3px] mb-4 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Редактировать</div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Имя</label>
            <input className="fire-input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Никнейм</label>
            <input className="fire-input" value={stored?.username || ''} disabled style={{ opacity: 0.6 }} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>О себе</label>
            <textarea className="fire-input" rows={3} placeholder="Расскажи о себе..." value={bio} onChange={e => setBio(e.target.value)} style={{ resize: 'none' }} />
          </div>
          {error && <div style={{ color: 'var(--fire-red)', fontSize: 12, fontFamily: 'Rajdhani' }}>{error}</div>}
          {savedMsg && <div style={{ color: 'var(--fire-online)', fontSize: 12, fontFamily: 'Rajdhani' }}>{savedMsg}</div>}
          <button className="fire-btn fire-btn-primary w-full" onClick={handleSave} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Settings Section ─────────────────────────────────────────────────────────

const SettingsSection = ({ onLogout }: { onLogout: () => void }) => (
  <div className="fire-main flex-1 p-8 overflow-y-auto animate-fire-in">
    <div className="max-w-xl mx-auto space-y-4">
      <div className="text-xs uppercase tracking-[4px] mb-8 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Настройки</div>
      {[
        { icon: 'Bell', label: 'Уведомления', desc: 'Звуки, вибрация, баджи' },
        { icon: 'Shield', label: 'Приватность', desc: 'Кто видит твой профиль' },
        { icon: 'Lock', label: 'Безопасность', desc: 'Пароль, двойная аутентификация' },
        { icon: 'Mic', label: 'Микрофон и звук', desc: 'Устройства ввода/вывода' },
        { icon: 'Palette', label: 'Тема', desc: 'Оформление интерфейса' },
        { icon: 'Globe', label: 'Язык', desc: 'Русский' },
      ].map(item => (
        <div key={item.label} className="fire-card p-4 flex items-center gap-4 cursor-pointer transition-all" style={{ transition: 'background 0.2s' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)' }}>
            <Icon name={item.icon} size={18} style={{ color: 'var(--fire-orange)' }} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{item.label}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--fire-text-dim)' }}>{item.desc}</div>
          </div>
          <Icon name="ChevronRight" size={16} style={{ color: 'var(--fire-text-muted)' }} />
        </div>
      ))}
      <div className="pt-4">
        <button onClick={onLogout} className="fire-btn fire-btn-danger w-full flex items-center justify-center gap-2" style={{ padding: '12px 0', fontSize: 14 }}>
          <Icon name="LogOut" size={15} /> Выйти из аккаунта
        </button>
      </div>
    </div>
  </div>
);

// ─── Call Overlay ─────────────────────────────────────────────────────────────

const CallOverlay = ({ state, user, onAccept, onDecline, onEnd }: {
  state: CallState; user: User; onAccept: () => void; onDecline: () => void; onEnd: (duration: number) => void;
}) => {
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);

  useEffect(() => {
    if (state !== 'active') return;
    const t = setInterval(() => setDuration(p => p + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backdropFilter: 'blur(8px)', background: 'rgba(6,10,15,0.85)' }}>
      <div className="fire-call-overlay rounded-2xl p-10 flex flex-col items-center gap-6 animate-scale-in" style={{ minWidth: 320 }}>
        <div className="relative">
          {(state === 'calling' || state === 'incoming') && (
            <>
              <div className="calling-ring" />
              <div className="calling-ring" style={{ animationDelay: '0.5s' }} />
            </>
          )}
          {state === 'active' && (
            <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '2px solid var(--fire-online)', boxShadow: '0 0 16px var(--fire-online)' }} />
          )}
          <Avatar user={user} size={88} />
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold" style={{ fontFamily: 'Rajdhani', letterSpacing: 2 }}>{user.name}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--fire-text-dim)', fontFamily: 'Rajdhani' }}>
            {state === 'calling' ? '⚡ Вызов...' : state === 'incoming' ? '🔥 Входящий звонок' : (
              <span className="fire-mono" style={{ color: 'var(--fire-online)' }}>{fmt(duration)}</span>
            )}
          </div>
        </div>

        {state === 'active' && (
          <div className="flex items-end gap-1 h-6">
            {[...Array(4)].map((_, i) => <div key={i} className="voice-bar" />)}
          </div>
        )}

        <div className="flex items-center gap-4">
          {state === 'incoming' ? (
            <>
              <button onClick={onDecline} className="fire-btn fire-btn-danger animate-fire-glow"
                style={{ width: 60, height: 60, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="PhoneOff" size={22} />
              </button>
              <button onClick={onAccept} style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--fire-online)', border: '1px solid var(--fire-online)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,255,136,0.4)', fontSize: 20 }}>
                <Icon name="Phone" size={22} />
              </button>
            </>
          ) : state === 'calling' ? (
            <button onClick={() => onEnd(0)} className="fire-btn fire-btn-danger animate-fire-glow"
              style={{ width: 60, height: 60, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="PhoneOff" size={22} />
            </button>
          ) : (
            <>
              <button onClick={() => setMuted(p => !p)} className="fire-btn"
                style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: muted ? 'var(--fire-red)' : 'var(--fire-border)', color: muted ? 'var(--fire-red)' : 'var(--fire-text-dim)' }}>
                <Icon name={muted ? 'MicOff' : 'Mic'} size={18} />
              </button>
              <button onClick={() => onEnd(duration)} className="fire-btn fire-btn-danger"
                style={{ width: 56, height: 56, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="PhoneOff" size={20} />
              </button>
              <button onClick={() => setSpeakerOff(p => !p)} className="fire-btn"
                style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: speakerOff ? 'var(--fire-red)' : 'var(--fire-border)', color: speakerOff ? 'var(--fire-red)' : 'var(--fire-text-dim)' }}>
                <Icon name={speakerOff ? 'VolumeX' : 'Volume2'} size={18} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main App Shell ───────────────────────────────────────────────────────────

const AppShell = ({ currentUser, onLogout }: { currentUser: ApiUser; onLogout: () => void }) => {
  const [section, setSection] = useState<Section>('chats');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callUser, setCallUser] = useState<User | null>(null);
  const callStartRef = useRef<number>(0);

  const me: User = apiUserToUser(currentUser);

  const startCall = (user: User) => {
    setCallUser(user);
    setCallState('calling');
    callStartRef.current = Date.now();
    setTimeout(() => setCallState('active'), 2500);
  };

  const handleCallEnd = async (duration: number) => {
    if (callUser) {
      await api.recordCall(callUser.id, 'outgoing', duration);
    }
    setCallState('idle');
    setCallUser(null);
  };

  const handleCallDecline = () => {
    setCallState('idle');
    setCallUser(null);
  };

  type NavItem = { id: Section; icon: 'MessageSquare' | 'Phone' | 'Radio' | 'Users' | 'User' | 'Settings'; label: string };

  const navItems: NavItem[] = [
    { id: 'chats', icon: 'MessageSquare', label: 'Чаты' },
    { id: 'calls', icon: 'Phone', label: 'Звонки' },
    { id: 'channels', icon: 'Radio', label: 'Каналы' },
    { id: 'contacts', icon: 'Users', label: 'Контакты' },
    { id: 'profile', icon: 'User', label: 'Профиль' },
    { id: 'settings', icon: 'Settings', label: 'Настройки' },
  ];

  return (
    <div className="fire-app flex" style={{ height: '100dvh' }}>
      <div className="fire-grid-bg" />
      <div className="fire-scanlines" />

      {/* Sidebar */}
      <div className="fire-sidebar flex flex-col flex-shrink-0" style={{ width: 220 }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="fire-logo" style={{ fontSize: 22, letterSpacing: 6 }}>FIRE</div>
          <div className="text-xs mt-1" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani', letterSpacing: 1.5 }}>v1.0 · ONLINE</div>
        </div>

        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="flex items-center gap-2.5">
            <Avatar user={me} size={34} showStatus />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{me.name}</div>
              <div className="text-xs" style={{ color: 'var(--fire-online)', fontSize: 10 }}>● онлайн</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <div key={item.id} className={`fire-nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
              <Icon name={item.icon} size={17} />
              <span style={{ fontSize: 13 }}>{item.label}</span>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="fire-nav-item" onClick={onLogout} style={{ color: 'var(--fire-red)' }}>
            <Icon name="LogOut" size={16} />
            <span style={{ fontSize: 13 }}>Выйти</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col" style={{ zIndex: 10 }}>
        {section === 'chats' && <ChatsSection onCall={startCall} />}
        {section === 'calls' && <CallsSection onCall={startCall} />}
        {section === 'channels' && <ChannelsSection />}
        {section === 'contacts' && <ContactsSection onCall={startCall} />}
        {section === 'profile' && <ProfileSection />}
        {section === 'settings' && <SettingsSection onLogout={onLogout} />}
      </div>

      {/* Call overlay */}
      {callState !== 'idle' && callUser && (
        <CallOverlay
          state={callState}
          user={callUser}
          onAccept={() => setCallState('active')}
          onDecline={handleCallDecline}
          onEnd={handleCallEnd}
        />
      )}
    </div>
  );
};

// ─── Contacts Section ─────────────────────────────────────────────────────────

const ContactsSection = ({ onCall }: { onCall: (user: User) => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUsers().then(data => {
      if (data.users) setUsers(data.users.map((u: ApiUser) => apiUserToUser(u)));
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="fire-main flex-1 p-8 overflow-y-auto animate-fire-in">
      <div className="text-xs uppercase tracking-[4px] mb-6 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Контакты</div>
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-2 max-w-2xl">
          {users.map(user => (
            <div key={user.id} className="fire-card flex items-center gap-4 p-4">
              <Avatar user={user} size={44} showStatus />
              <div className="flex-1">
                <div className="font-bold" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{user.name}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--fire-text-dim)' }}>@{user.username}</div>
              </div>
              <div className="flex gap-2">
                <button className="fire-btn" style={{ padding: '6px 12px', fontSize: 12, borderColor: 'var(--fire-online)', color: 'var(--fire-online)' }} onClick={() => onCall(user)}>
                  <Icon name="Phone" size={14} />
                </button>
                <button className="fire-btn" style={{ padding: '6px 12px', fontSize: 12 }}>
                  <Icon name="MessageSquare" size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (!token) {
      setScreen('auth');
      return;
    }
    const stored = api.getStoredUser() as ApiUser | null;
    if (stored) {
      setCurrentUser(stored);
      setScreen('app');
    } else {
      api.getMe().then(data => {
        if (data.user) {
          api.storeUser(data.user);
          setCurrentUser(data.user);
          setScreen('app');
        } else {
          api.clearToken();
          setScreen('auth');
        }
      }).catch(() => {
        api.clearToken();
        setScreen('auth');
      });
    }
  }, []);

  const handleAuth = (user: ApiUser) => {
    setCurrentUser(user);
    setScreen('app');
  };

  const handleLogout = async () => {
    await api.logout();
    setCurrentUser(null);
    setScreen('auth');
  };

  if (screen === 'loading') {
    return (
      <div className="fire-app flex items-center justify-center" style={{ height: '100dvh' }}>
        <div className="fire-grid-bg" />
        <div className="fire-scanlines" />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="fire-logo" style={{ fontSize: 48, letterSpacing: 10 }}>FIRE</div>
          <Spinner />
        </div>
      </div>
    );
  }

  if (screen === 'auth') {
    return <AuthScreen onAuth={handleAuth} />;
  }

  if (screen === 'app' && currentUser) {
    return <AppShell currentUser={currentUser} onLogout={handleLogout} />;
  }

  return <AuthScreen onAuth={handleAuth} />;
}
