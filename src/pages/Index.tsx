import { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/icon';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'auth' | 'app';
type AuthMode = 'login' | 'register';
type Section = 'chats' | 'calls' | 'channels' | 'contacts' | 'profile' | 'settings';
type CallState = 'idle' | 'calling' | 'incoming' | 'active';
type ChannelRole = 'creator' | 'vip' | 'admin' | 'mod' | 'member' | 'subscriber';

interface User {
  id: string;
  name: string;
  username: string;
  status: 'online' | 'offline' | 'busy' | 'away';
  initials: string;
  color: string;
}

interface Message {
  id: string;
  userId: string;
  text: string;
  time: string;
  mine?: boolean;
}

interface Chat {
  id: string;
  user: User;
  lastMsg: string;
  time: string;
  unread: number;
  messages: Message[];
}

interface CallRecord {
  id: string;
  user: User;
  type: 'incoming' | 'outgoing' | 'missed';
  duration: string;
  time: string;
}

interface ChannelMember {
  user: User;
  role: ChannelRole;
}

interface Channel {
  id: string;
  name: string;
  description: string;
  subscribers: number;
  likes: number;
  liked: boolean;
  subscribed: boolean;
  allowMats: boolean;
  whoCanWrite: 'all' | 'mod' | 'admin' | 'vip' | 'creator';
  members: ChannelMember[];
  messages: Message[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Артём Коваль', username: 'artem_k', status: 'online', initials: 'АК', color: '#ff4500' },
  { id: 'u2', name: 'Вика Нова', username: 'vika_n', status: 'online', initials: 'ВН', color: '#00d4ff' },
  { id: 'u3', name: 'Игорь Зайцев', username: 'igorzay', status: 'offline', initials: 'ИЗ', color: '#ffaa00' },
  { id: 'u4', name: 'Марина Лис', username: 'marina_l', status: 'busy', initials: 'МЛ', color: '#ff00aa' },
  { id: 'u5', name: 'Денис Крот', username: 'dkrot', status: 'away', initials: 'ДК', color: '#00ff88' },
];

const ME: User = { id: 'me', name: 'Игрок', username: 'player_one', status: 'online', initials: 'ИГ', color: '#ff4500' };

const MOCK_CHATS: Chat[] = [
  {
    id: 'c1', user: MOCK_USERS[0], lastMsg: 'Погнали на звонок!', time: '21:44', unread: 3,
    messages: [
      { id: 'm1', userId: 'u1', text: 'Привет! Как дела?', time: '21:40' },
      { id: 'm2', userId: 'me', text: 'Отлично, в игре был 😄', time: '21:41', mine: true },
      { id: 'm3', userId: 'u1', text: 'Погнали на звонок!', time: '21:44' },
    ]
  },
  {
    id: 'c2', user: MOCK_USERS[1], lastMsg: 'Видела новый канал?', time: '20:11', unread: 1,
    messages: [
      { id: 'm4', userId: 'u2', text: 'Видела новый канал?', time: '20:11' },
    ]
  },
  {
    id: 'c3', user: MOCK_USERS[2], lastMsg: 'ок пока', time: 'Вчера', unread: 0,
    messages: [
      { id: 'm5', userId: 'me', text: 'Завтра созвонимся?', time: '18:30', mine: true },
      { id: 'm6', userId: 'u3', text: 'ок пока', time: '18:31' },
    ]
  },
  {
    id: 'c4', user: MOCK_USERS[3], lastMsg: 'хаха 😂', time: 'Вчера', unread: 0,
    messages: [
      { id: 'm7', userId: 'u4', text: 'хаха 😂', time: '15:00' },
    ]
  },
];

const MOCK_CALLS: CallRecord[] = [
  { id: 'cr1', user: MOCK_USERS[0], type: 'incoming', duration: '12:34', time: 'Сегодня, 21:30' },
  { id: 'cr2', user: MOCK_USERS[1], type: 'outgoing', duration: '05:20', time: 'Сегодня, 19:15' },
  { id: 'cr3', user: MOCK_USERS[2], type: 'missed', duration: '—', time: 'Вчера, 14:00' },
  { id: 'cr4', user: MOCK_USERS[3], type: 'incoming', duration: '02:11', time: 'Вчера, 10:30' },
  { id: 'cr5', user: MOCK_USERS[4], type: 'outgoing', duration: '08:44', time: '2 дня назад' },
];

const MOCK_CHANNELS: Channel[] = [
  {
    id: 'ch1',
    name: 'FIRE Official',
    description: 'Официальный канал FIRE — новости, обновления, анонсы',
    subscribers: 12840,
    likes: 3421,
    liked: false,
    subscribed: true,
    allowMats: false,
    whoCanWrite: 'admin',
    members: [
      { user: ME, role: 'creator' },
      { user: MOCK_USERS[0], role: 'admin' },
      { user: MOCK_USERS[1], role: 'vip' },
      { user: MOCK_USERS[2], role: 'mod' },
      { user: MOCK_USERS[3], role: 'member' },
    ],
    messages: [
      { id: 'cm1', userId: 'me', text: '🔥 Добро пожаловать в FIRE! Это официальный канал.', time: '12:00', mine: true },
      { id: 'cm2', userId: 'u1', text: 'Крутой канал! Жду новостей', time: '12:05' },
    ]
  },
  {
    id: 'ch2',
    name: 'Гейминг клуб',
    description: 'Для всех геймеров — стримы, гайды, ивенты',
    subscribers: 5621,
    likes: 1200,
    liked: true,
    subscribed: true,
    allowMats: true,
    whoCanWrite: 'all',
    members: [
      { user: MOCK_USERS[0], role: 'creator' },
      { user: ME, role: 'member' },
      { user: MOCK_USERS[2], role: 'admin' },
    ],
    messages: [
      { id: 'cm3', userId: 'u1', text: '🎮 Турнир в эту субботу!', time: '10:00' },
      { id: 'cm4', userId: 'me', text: 'Буду! Записался', time: '10:05', mine: true },
    ]
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
};

const RoleBadge = ({ role }: { role: ChannelRole }) => {
  if (role === 'member' || role === 'subscriber') return null;
  const cls: Record<string, string> = {
    creator: 'fire-role-creator',
    vip: 'fire-role-vip',
    admin: 'fire-role-admin',
    mod: 'fire-role-mod',
  };
  return <span className={`fire-role ${cls[role]}`}>{roleLabel[role]}</span>;
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

// ─── Auth Screen ──────────────────────────────────────────────────────────────

const AuthScreen = ({ onAuth }: { onAuth: () => void }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [form, setForm] = useState({ login: '', password: '', name: '', username: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.login.trim() && form.password.trim()) onAuth();
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
                onClick={() => setMode(m)}
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

            <button type="submit" className="fire-btn fire-btn-primary w-full animate-fire-glow" style={{ fontSize: 15, padding: '12px 0' }}>
              {mode === 'login' ? 'Войти в систему' : 'Создать аккаунт'}
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

const ChatView = ({ chat, onCall }: { chat: Chat; onCall: (user: User) => void }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(chat.messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    if (!input.trim()) return;
    const msg: Message = {
      id: Date.now().toString(),
      userId: 'me',
      text: input.trim(),
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      mine: true,
    };
    setMessages(p => [...p, msg]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full animate-fire-slide">
      <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'var(--fire-border)', background: 'var(--fire-surface)' }}>
        <div className="flex items-center gap-3">
          <Avatar user={chat.user} size={38} showStatus />
          <div>
            <div className="font-bold text-sm" style={{ fontFamily: 'Rajdhani', letterSpacing: 1 }}>{chat.user.name}</div>
            <div className="text-xs" style={{ color: statusColor(chat.user.status) }}>{statusLabel(chat.user.status)}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onCall(chat.user)} className="fire-btn" style={{ padding: '7px 12px', borderColor: 'var(--fire-online)', color: 'var(--fire-online)' }}>
            <Icon name="Phone" size={15} />
          </button>
          <button onClick={() => onCall(chat.user)} className="fire-btn" style={{ padding: '7px 12px' }}>
            <Icon name="Video" size={15} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.mine ? 'flex-row-reverse' : ''}`}>
            {!msg.mine && <Avatar user={chat.user} size={28} />}
            <div className={`fire-msg ${msg.mine ? 'mine' : ''}`}>
              <div>{msg.text}</div>
              <div className="text-right mt-1" style={{ fontSize: 10, color: 'var(--fire-text-muted)' }}>{msg.time}</div>
            </div>
          </div>
        ))}
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
  const [active, setActive] = useState<Chat | null>(null);
  const [search, setSearch] = useState('');

  const filtered = MOCK_CHATS.filter(c => c.user.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-full">
      <div className="fire-panel w-72 flex flex-col flex-shrink-0">
        <div className="p-4 border-b" style={{ borderColor: 'var(--fire-border)' }}>
          <div className="text-xs uppercase tracking-[3px] mb-3 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Сообщения</div>
          <input className="fire-input" placeholder="Поиск чатов..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(chat => (
            <div
              key={chat.id}
              onClick={() => setActive(chat)}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all border-b"
              style={{ borderColor: 'var(--fire-border)', background: active?.id === chat.id ? 'rgba(255,69,0,0.08)' : 'transparent' }}
            >
              <Avatar user={chat.user} size={42} showStatus />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm truncate" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{chat.user.name}</span>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: 'var(--fire-text-muted)' }}>{chat.time}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-xs truncate" style={{ color: 'var(--fire-text-dim)' }}>{chat.lastMsg}</span>
                  {chat.unread > 0 && <span className="fire-badge ml-1 flex-shrink-0">{chat.unread}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fire-main flex-1">
        {active ? (
          <ChatView chat={active} onCall={onCall} />
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

const CallsSection = ({ onCall }: { onCall: (user: User) => void }) => (
  <div className="flex h-full">
    <div className="fire-panel w-72 flex flex-col flex-shrink-0">
      <div className="p-4 border-b" style={{ borderColor: 'var(--fire-border)' }}>
        <div className="text-xs uppercase tracking-[3px] font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>История звонков</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {MOCK_CALLS.map(call => (
          <div key={call.id} className="flex items-center gap-3 px-4 py-3 border-b cursor-pointer transition-all" style={{ borderColor: 'var(--fire-border)' }}>
            <Avatar user={call.user} size={40} />
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
              <button className="fire-btn mt-1" style={{ padding: '3px 8px', fontSize: 10 }} onClick={() => onCall(call.user)}>
                <Icon name="Phone" size={10} />
              </button>
            </div>
          </div>
        ))}
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
        <div className="grid grid-cols-2 gap-3">
          {MOCK_USERS.map(user => (
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
      </div>
    </div>
  </div>
);

// ─── Channel View ─────────────────────────────────────────────────────────────

const ChannelView = ({ channel, myRole, onUpdate }: { channel: Channel; myRole: ChannelRole; onUpdate: (ch: Channel) => void }) => {
  const [tab, setTab] = useState<'chat' | 'members' | 'settings'>('chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(channel.messages);
  const [ch, setCh] = useState(channel);
  const bottomRef = useRef<HTMLDivElement>(null);

  const canWrite = () => {
    if (myRole === 'creator' || myRole === 'vip' || myRole === 'admin') return true;
    if (myRole === 'mod' && (ch.whoCanWrite === 'all' || ch.whoCanWrite === 'mod')) return true;
    if (myRole === 'member' && ch.whoCanWrite === 'all') return true;
    return false;
  };

  const send = () => {
    if (!input.trim() || !canWrite()) return;
    const msg: Message = {
      id: Date.now().toString(),
      userId: 'me',
      text: input.trim(),
      time: new Date().toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }),
      mine: true,
    };
    setMessages(p => [...p, msg]);
    setInput('');
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const toggleLike = () => {
    const updated = { ...ch, liked: !ch.liked, likes: ch.liked ? ch.likes - 1 : ch.likes + 1 };
    setCh(updated);
    onUpdate(updated);
  };

  const toggleSub = () => {
    const updated = { ...ch, subscribed: !ch.subscribed, subscribers: ch.subscribed ? ch.subscribers - 1 : ch.subscribers + 1 };
    setCh(updated);
    onUpdate(updated);
  };

  const canManage = (targetRole: ChannelRole) => {
    const order: ChannelRole[] = ['subscriber', 'member', 'mod', 'admin', 'vip', 'creator'];
    return order.indexOf(myRole) > order.indexOf(targetRole);
  };

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
            <button onClick={toggleLike} className="fire-btn flex items-center gap-1.5"
              style={{ padding: '6px 12px', fontSize: 12, borderColor: ch.liked ? 'var(--fire-red)' : 'var(--fire-border)', color: ch.liked ? 'var(--fire-red)' : 'var(--fire-text-dim)' }}>
              <Icon name="Heart" size={13} /> {ch.likes}
            </button>
            <button onClick={toggleSub} className={`fire-btn ${ch.subscribed ? '' : 'fire-btn-primary'}`} style={{ padding: '6px 14px', fontSize: 12 }}>
              {ch.subscribed ? 'Отписаться' : 'Подписаться'}
            </button>
            <RoleBadge role={myRole} />
          </div>
        </div>
        <div className="flex mt-3">
          {(['chat', 'members', 'settings'] as const).map(t => (
            <button key={t} className={`fire-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'chat' ? 'Чат' : t === 'members' ? 'Участники' : 'Настройки'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'chat' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map(msg => {
              const sender = ch.members.find(m => m.user.id === msg.userId);
              const user = sender?.user || ME;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${msg.mine ? 'flex-row-reverse' : ''}`}>
                  {!msg.mine && <Avatar user={user} size={28} />}
                  <div className={`fire-msg ${msg.mine ? 'mine' : ''}`}>
                    {!msg.mine && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-bold" style={{ fontFamily: 'Rajdhani', color: user.color }}>{user.name}</span>
                        {sender && <RoleBadge role={sender.role} />}
                      </div>
                    )}
                    <div>{msg.text}</div>
                    <div className="text-right mt-1" style={{ fontSize: 10, color: 'var(--fire-text-muted)' }}>{msg.time}</div>
                  </div>
                </div>
              );
            })}
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
          {ch.members.map(({ user, role }) => (
            <div key={user.id} className="fire-member-row">
              <Avatar user={user} size={36} showStatus />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ fontFamily: 'Rajdhani' }}>{user.name}</span>
                  <RoleBadge role={role} />
                </div>
                <div className="text-xs" style={{ color: 'var(--fire-text-dim)' }}>@{user.username}</div>
              </div>
              {canManage(role) && (
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
          ))}
        </div>
      )}

      {tab === 'settings' && (myRole === 'creator' || myRole === 'vip' || myRole === 'admin') && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Название канала</label>
            <input className="fire-input" defaultValue={ch.name} />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Описание</label>
            <textarea className="fire-input" rows={3} defaultValue={ch.description} style={{ resize: 'none' }} />
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
          <button className="fire-btn fire-btn-primary w-full">Сохранить настройки</button>
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
  const [channels, setChannels] = useState(MOCK_CHANNELS);
  const [active, setActive] = useState<Channel | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const myRole = (ch: Channel): ChannelRole => ch.members.find(m => m.user.id === 'me')?.role || 'subscriber';

  const createChannel = () => {
    if (!newName.trim()) return;
    const ch: Channel = {
      id: Date.now().toString(),
      name: newName.trim(),
      description: newDesc.trim(),
      subscribers: 1,
      likes: 0,
      liked: false,
      subscribed: true,
      allowMats: false,
      whoCanWrite: 'all',
      members: [{ user: ME, role: 'creator' }],
      messages: [],
    };
    setChannels(p => [ch, ...p]);
    setActive(ch);
    setCreating(false);
    setNewName('');
    setNewDesc('');
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
          {channels.map(ch => (
            <div key={ch.id} onClick={() => { setActive(ch); setCreating(false); }}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b transition-all"
              style={{ borderColor: 'var(--fire-border)', background: active?.id === ch.id && !creating ? 'rgba(255,69,0,0.08)' : 'transparent' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: 'rgba(255,69,0,0.1)', border: '1px solid rgba(255,69,0,0.2)' }}>🔥</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm truncate" style={{ fontFamily: 'Rajdhani' }}>{ch.name}</span>
                  <RoleBadge role={myRole(ch)} />
                </div>
                <div className="text-xs" style={{ color: 'var(--fire-text-dim)' }}>{ch.subscribers.toLocaleString()} подп.</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fire-main flex-1">
        {creating ? (
          <div className="flex flex-col items-center justify-center h-full animate-scale-in">
            <div className="fire-card p-8 w-full max-w-md mx-8">
              <div className="text-lg font-bold mb-6" style={{ fontFamily: 'Rajdhani', letterSpacing: 2, color: 'var(--fire-orange)' }}>НОВЫЙ КАНАЛ</div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Название</label>
                  <input className="fire-input" placeholder="Название канала" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Описание</label>
                  <textarea className="fire-input" rows={3} placeholder="О чём этот канал?" value={newDesc} onChange={e => setNewDesc(e.target.value)} style={{ resize: 'none' }} />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setCreating(false)} className="fire-btn flex-1" style={{ fontSize: 13 }}>Отмена</button>
                  <button onClick={createChannel} className="fire-btn fire-btn-primary flex-1" style={{ fontSize: 13 }}>Создать</button>
                </div>
              </div>
            </div>
          </div>
        ) : active ? (
          <ChannelView channel={active} myRole={myRole(active)} onUpdate={updated => setChannels(p => p.map(c => c.id === updated.id ? updated : c))} />
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
  const [status, setStatus] = useState<User['status']>('online');
  return (
    <div className="fire-main flex-1 p-8 overflow-y-auto animate-fire-in">
      <div className="max-w-xl mx-auto">
        <div className="text-xs uppercase tracking-[4px] mb-8 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Мой профиль</div>
        <div className="fire-card p-8 flex flex-col items-center gap-6 mb-6">
          <div className="relative">
            <Avatar user={ME} size={96} />
            <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--fire-orange)', border: '2px solid var(--fire-bg)' }}>
              <Icon name="Camera" size={12} style={{ color: '#fff' }} />
            </button>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ fontFamily: 'Rajdhani', letterSpacing: 2 }}>Игрок</div>
            <div className="text-sm mt-1" style={{ color: 'var(--fire-text-dim)' }}>@player_one</div>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            {(['online', 'busy', 'away', 'offline'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
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
            <input className="fire-input" defaultValue="Игрок" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>Никнейм</label>
            <input className="fire-input" defaultValue="@player_one" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: 'var(--fire-text-muted)', fontFamily: 'Rajdhani' }}>О себе</label>
            <textarea className="fire-input" rows={3} placeholder="Расскажи о себе..." style={{ resize: 'none' }} />
          </div>
          <button className="fire-btn fire-btn-primary w-full">Сохранить</button>
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
  state: CallState; user: User; onAccept: () => void; onDecline: () => void; onEnd: () => void;
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
            <button onClick={onDecline} className="fire-btn fire-btn-danger animate-fire-glow"
              style={{ width: 60, height: 60, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="PhoneOff" size={22} />
            </button>
          ) : (
            <>
              <button onClick={() => setMuted(p => !p)} className="fire-btn"
                style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderColor: muted ? 'var(--fire-red)' : 'var(--fire-border)', color: muted ? 'var(--fire-red)' : 'var(--fire-text-dim)' }}>
                <Icon name={muted ? 'MicOff' : 'Mic'} size={18} />
              </button>
              <button onClick={onEnd} className="fire-btn fire-btn-danger"
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

const AppShell = ({ onLogout }: { onLogout: () => void }) => {
  const [section, setSection] = useState<Section>('chats');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callUser, setCallUser] = useState<User>(MOCK_USERS[0]);

  const totalUnread = MOCK_CHATS.reduce((a, c) => a + c.unread, 0);

  const startCall = (user: User) => {
    setCallUser(user);
    setCallState('calling');
    setTimeout(() => setCallState('active'), 2500);
  };

  const navItems: { id: Section; icon: string; label: string; badge?: number }[] = [
    { id: 'chats', icon: 'MessageSquare', label: 'Чаты', badge: totalUnread },
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
            <Avatar user={ME} size={34} showStatus />
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{ME.name}</div>
              <div className="text-xs" style={{ color: 'var(--fire-online)', fontSize: 10 }}>● онлайн</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <div key={item.id} className={`fire-nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}>
              <Icon name={item.icon} size={17} />
              <span style={{ fontSize: 13 }}>{item.label}</span>
              {item.badge ? <span className="fire-badge ml-auto">{item.badge}</span> : null}
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
        {section === 'contacts' && (
          <div className="fire-main flex-1 p-8 overflow-y-auto animate-fire-in">
            <div className="text-xs uppercase tracking-[4px] mb-6 font-bold" style={{ color: 'var(--fire-orange)', fontFamily: 'Rajdhani' }}>Контакты</div>
            <div className="space-y-2 max-w-2xl">
              {MOCK_USERS.map(user => (
                <div key={user.id} className="fire-card flex items-center gap-4 p-4">
                  <Avatar user={user} size={44} showStatus />
                  <div className="flex-1">
                    <div className="font-bold" style={{ fontFamily: 'Rajdhani', letterSpacing: 0.5 }}>{user.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--fire-text-dim)' }}>@{user.username}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="fire-btn" style={{ padding: '6px 12px', fontSize: 12, borderColor: 'var(--fire-online)', color: 'var(--fire-online)' }} onClick={() => startCall(user)}>
                      <Icon name="Phone" size={14} />
                    </button>
                    <button className="fire-btn" style={{ padding: '6px 12px', fontSize: 12 }}>
                      <Icon name="MessageSquare" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {section === 'profile' && <ProfileSection />}
        {section === 'settings' && <SettingsSection onLogout={onLogout} />}
      </div>

      {/* Call overlay */}
      {callState !== 'idle' && (
        <CallOverlay
          state={callState}
          user={callUser}
          onAccept={() => setCallState('active')}
          onDecline={() => setCallState('idle')}
          onEnd={() => setCallState('idle')}
        />
      )}
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const [screen, setScreen] = useState<Screen>('auth');
  return screen === 'auth'
    ? <AuthScreen onAuth={() => setScreen('app')} />
    : <AppShell onLogout={() => setScreen('auth')} />;
}