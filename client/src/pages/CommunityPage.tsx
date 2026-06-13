import { useEffect, useState, useRef, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  MessageCircle, Trash2, CheckCircle, X, Upload,
  Link as LinkIcon, Plus, Bookmark, Sparkles, HelpCircle, BookOpen,
  Heart, BookText, SlidersHorizontal, Users, ArrowRight,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

// ── Types ────────────────────────────────────────────────────────────────────
type PostType = 'REFLECTION' | 'QUESTION' | 'SUPPORT' | 'RESOURCE'
type FilterType = 'ALL' | PostType | 'SAVED'
type SortType = 'NEW' | 'UNANSWERED' | 'TOP'

interface Author { id: string; firstName: string; lastName: string; avatarUrl: string | null }
interface Reaction { id: string; emoji: string; user: { id: string } }
interface Comment { id: string; content: string; isUseful: boolean; createdAt: string; author: Author }
interface Post {
  id: string; type: PostType; title: string | null; content: string
  imageUrl: string | null; linkUrl: string | null
  author: Author; reactions: Reaction[]; _count: { comments: number }; createdAt: string
}
interface Phrase { text: string; author: { firstName: string; lastName: string } }

// ── Metadata ─────────────────────────────────────────────────────────────────
const TYPE_META: Record<PostType, {
  label: string; catLabel: string
  pillBg: string; pillColor: string
  chipBg: string; chipColor: string
  composerColor: string
}> = {
  REFLECTION: {
    label: 'Роздуми', catLabel: 'Професійні роздуми',
    pillBg: '#F6E7D4', pillColor: '#C57E66',
    chipBg: '#F3E0C8', chipColor: '#C57E66',
    composerColor: '#C57E66',
  },
  QUESTION: {
    label: 'Питання', catLabel: 'Запитати спільноту',
    pillBg: '#C7D8DD', pillColor: '#5E828E',
    chipBg: '#D6E8EC', chipColor: '#5E828E',
    composerColor: '#5E828E',
  },
  SUPPORT: {
    label: 'Підтримка', catLabel: 'Від колеги до колеги',
    pillBg: '#F3DDD1', pillColor: '#C9401E',
    chipBg: '#EDD8CE', chipColor: '#F0502E',
    composerColor: '#F0502E',
  },
  RESOURCE: {
    label: 'Ресурси', catLabel: 'Корисні знахідки',
    pillBg: '#DCE7EA', pillColor: '#5E828E',
    chipBg: '#D4E6EA', chipColor: '#5E828E',
    composerColor: '#5E828E',
  },
}

const REACTIONS: Record<PostType, { emoji: string; label: string }[]> = {
  REFLECTION: [
    { emoji: '🤍', label: 'Відгукуюсь' },
    { emoji: '✨', label: 'Беру з собою' },
    { emoji: '💎', label: 'Зберігаю' },
    { emoji: '🙏', label: 'Дякую' },
  ],
  QUESTION: [
    { emoji: '💡', label: 'Маю думку' },
    { emoji: '🙌', label: 'Гарне питання' },
    { emoji: '🙏', label: 'Дякую' },
  ],
  SUPPORT: [
    { emoji: '🫂', label: 'Поруч' },
    { emoji: '🤍', label: 'Відгукуюсь' },
    { emoji: '💪', label: 'Підтримую' },
    { emoji: '💗', label: 'Обіймаю серцем' },
    { emoji: '🙏', label: 'Дякую за щирість' },
  ],
  RESOURCE: [
    { emoji: '🔖', label: 'Зберегла' },
    { emoji: '👁', label: 'Хочу переглянути' },
    { emoji: '🙏', label: 'Дякую' },
  ],
}

// ── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ author, size = 'md', gradient }: {
  author: Author; size?: 'sm' | 'md'; gradient?: string
}) {
  const cls = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-11 h-11 text-sm'
  const bg = gradient ?? 'linear-gradient(135deg,#E3A88F,#F0502E)'
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0 overflow-hidden`}
      style={{ background: bg, boxShadow: 'var(--clay-sm)' }}
    >
      {author.avatarUrl
        ? <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
        : `${author.firstName[0]}${author.lastName[0]}`}
    </div>
  )
}

// ── ReactionBar ──────────────────────────────────────────────────────────────
function ReactionBar({ post, onReact }: { post: Post; onReact: (postId: string, emoji: string) => void }) {
  const { user } = useAuth()
  const reactions = REACTIONS[post.type]

  return (
    <div className="flex flex-wrap gap-2 mt-4">
      {reactions.map(r => {
        const count = post.reactions.filter(pr => pr.emoji === r.emoji).length
        const active = post.reactions.some(pr => pr.emoji === r.emoji && pr.user.id === user?.id)
        return (
          <button
            key={r.emoji}
            onClick={() => onReact(post.id, r.emoji)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-[13.5px] font-semibold transition-all duration-150 hover:-translate-y-px"
            style={{
              background: active ? 'var(--blush)' : 'var(--surface-2)',
              color: active ? 'var(--rose-ink)' : 'var(--ink-2)',
            }}
          >
            <span>{r.emoji}</span>
            <span>{r.label}</span>
            {count > 0 && (
              <span style={{ color: active ? 'var(--rose-ink)' : 'var(--ink-3)', fontWeight: 800 }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── CommentSection ────────────────────────────────────────────────────────────
function CommentSection({ post, currentUserId, onMarkUseful }: {
  post: Post; currentUserId: string
  onMarkUseful: (postId: string, commentId: string) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { user } = useAuth()
  const isAdmin = !!user?.roles?.includes('ADMIN')

  useEffect(() => {
    setLoading(true)
    api.get(`/community/${post.id}/comments`)
      .then(r => setComments(r.data))
      .finally(() => setLoading(false))
  }, [post.id])

  const submit = async () => {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await api.post(`/community/${post.id}/comments`, { content: text.trim() })
      setComments(prev => [...prev, res.data])
      setText('')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteComment = async (commentId: string) => {
    await api.delete(`/community/${post.id}/comments/${commentId}`)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  const markUseful = async (commentId: string) => {
    const res = await api.post(`/community/${post.id}/comments/${commentId}/mark-useful`)
    setComments(prev => prev.map(c => c.id === commentId ? res.data : c))
    onMarkUseful(post.id, commentId)
  }

  return (
    <div className="mt-4 space-y-3">
      {loading ? (
        <div className="h-6 rounded-xl animate-pulse" style={{ background: 'var(--surface-2)' }} />
      ) : comments.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--ink-3)' }}>Поки немає коментарів — будьте першим ♡</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div
              key={c.id}
              className={`flex gap-2.5 group ${c.isUseful ? 'rounded-2xl px-3 py-2.5' : ''}`}
              style={c.isUseful ? { background: 'rgba(110,138,114,.08)', border: '1px solid rgba(110,138,114,.2)' } : {}}
            >
              <Avatar author={c.author} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                    {c.author.firstName} {c.author.lastName}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--ink-3)' }}>
                    {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: uk })}
                  </span>
                  {c.isUseful && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#5E828E' }}>
                      <CheckCircle size={10} /> Корисна відповідь
                    </span>
                  )}
                </div>
                <p className="text-sm mt-0.5 leading-relaxed whitespace-pre-line" style={{ color: 'var(--ink-2)' }}>
                  {c.content}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {post.type === 'QUESTION' && post.author.id === currentUserId && c.author.id !== currentUserId && (
                    <button
                      onClick={() => markUseful(c.id)}
                      className="text-[11px] flex items-center gap-1 transition"
                      style={{ color: c.isUseful ? '#5E828E' : 'var(--ink-3)' }}
                    >
                      <CheckCircle size={11} />
                      {c.isUseful ? 'Відзначено корисною' : 'Відповідь була корисною'}
                    </button>
                  )}
                  {(c.author.id === currentUserId || isAdmin) && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="text-[11px] hover:opacity-70 transition opacity-0 group-hover:opacity-100"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Ваш коментар..."
          rows={2}
          className="neu-input flex-1 rounded-xl px-3 py-2 text-sm resize-none"
          style={{ border: '1px solid rgba(150,120,100,.28)', color: 'var(--ink)' }}
        />
        <button
          onClick={submit}
          disabled={submitting || !text.trim()}
          className="neu-btn-primary px-4 py-2 rounded-xl text-sm font-semibold self-end disabled:opacity-40"
        >
          {submitting ? '...' : '↑'}
        </button>
      </div>
    </div>
  )
}

// ── PostCard ──────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, onReact, onDelete, onMarkUseful }: {
  post: Post; currentUserId: string
  onReact: (postId: string, emoji: string) => void
  onDelete: (postId: string) => void
  onMarkUseful: (postId: string, commentId: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const { user } = useAuth()
  const isAdmin = !!user?.roles?.includes('ADMIN')
  const meta = TYPE_META[post.type]
  const isSaved = post.reactions.some(r => (r.emoji === '🔖' || r.emoji === '💎') && r.user.id === user?.id)
  const totalReactions = post.reactions.length
  const needsAnswer = post.type === 'QUESTION' && post._count.comments === 0

  return (
    <article
      id={`post-${post.id}`}
      className="rounded-[var(--r-lg)] transition-all duration-300"
      style={{ background: 'var(--surface)', boxShadow: 'var(--clay)', padding: '28px 32px' }}
    >
      {/* Header: avatar + name + category pill + time */}
      <div className="flex items-start gap-3">
        <Avatar author={post.author} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-bold text-[15px]" style={{ color: 'var(--ink)' }}>
              {post.author.firstName} {post.author.lastName}
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11.5px] font-bold"
              style={{ background: meta.pillBg, color: meta.pillColor }}
            >
              {post.type === 'REFLECTION' && <Sparkles size={12} />}
              {post.type === 'QUESTION' && <HelpCircle size={12} />}
              {post.type === 'SUPPORT' && <Heart size={12} />}
              {post.type === 'RESOURCE' && <BookOpen size={12} />}
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: uk })}
            </span>
            {needsAnswer && (
              <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: 'var(--terra)' }}>
                <HelpCircle size={12} />Чекає відповіді
              </span>
            )}
          </div>
        </div>
        {(post.author.id === currentUserId || isAdmin) && (
          <button
            onClick={() => onDelete(post.id)}
            className="opacity-40 hover:opacity-80 transition shrink-0 mt-1"
            style={{ color: 'var(--ink-3)' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      {post.title && (
        <h3
          className="font-cormorant mt-4 leading-snug"
          style={{ fontSize: '23px', fontWeight: 600, color: 'var(--ink)' }}
        >
          {post.title}
        </h3>
      )}
      <p
        className={`mt-2 leading-[1.65] whitespace-pre-line ${!post.title ? 'mt-4' : ''} ${post.type === 'SUPPORT' && !post.title ? 'font-cormorant italic' : ''}`}
        style={{
          fontSize: (post.type === 'SUPPORT' && !post.title) ? '19px' : '15.5px',
          color: 'var(--ink)',
        }}
      >
        {post.content}
      </p>

      {post.linkUrl && (
        <a
          href={post.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 mt-3 px-4 py-3 rounded-[var(--r)] max-w-full overflow-hidden"
          style={{ background: 'var(--surface-2)', color: 'var(--rose-deep)', fontWeight: 600, fontSize: '14px' }}
        >
          <LinkIcon size={16} className="shrink-0" />
          <span className="truncate">{post.linkUrl}</span>
        </a>
      )}

      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="mt-4 w-full rounded-2xl object-cover max-h-64" />
      )}

      <ReactionBar post={post} onReact={onReact} />

      {/* Footer */}
      <div
        className="flex items-center gap-4 mt-4 pt-4"
        style={{ borderTop: '1px solid var(--line)' }}
      >
        <button
          onClick={() => setShowComments(s => !s)}
          className="inline-flex items-center gap-2 font-bold text-[13.5px] transition hover:opacity-70"
          style={{ color: 'var(--ink-3)' }}
        >
          <MessageCircle size={17} />
          {showComments
            ? 'Сховати'
            : post.type === 'QUESTION'
              ? 'Відповісти'
              : 'Коментувати'}
        </button>

        <button
          onClick={() => onReact(post.id, '🔖')}
          className="inline-flex items-center gap-2 font-bold text-[13.5px] transition hover:opacity-70"
          style={{ color: isSaved ? 'var(--rose-deep)' : 'var(--ink-3)' }}
        >
          <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} />
          {isSaved ? 'Збережено' : 'Зберегти'}
        </button>

        <span className="ml-auto text-[13px] font-bold" style={{ color: 'var(--ink-3)' }}>
          {post._count.comments > 0
            ? `${post._count.comments} коментар${post._count.comments === 1 ? '' : post._count.comments < 5 ? 'і' : 'ів'}`
            : totalReactions > 0
              ? `${totalReactions} реакц${totalReactions === 1 ? 'ія' : totalReactions < 5 ? 'ії' : 'ій'}`
              : ''}
        </span>
      </div>

      {showComments && (
        <CommentSection post={post} currentUserId={currentUserId} onMarkUseful={onMarkUseful} />
      )}
    </article>
  )
}

// ── CreatePostModal ───────────────────────────────────────────────────────────
function CreatePostModal({ type, onClose, onCreated }: {
  type: PostType; onClose: () => void; onCreated: (post: Post) => void
}) {
  const meta = TYPE_META[type]
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const placeholders: Record<PostType, string> = {
    REFLECTION: 'Поділіться своїм роздумом, інсайтом або спостереженням…',
    QUESTION:   'Опишіть своє питання до спільноти…',
    SUPPORT:    'Поділіться з колегами — радістю, труднощами або вдячністю…',
    RESOURCE:   'Короткий опис ресурсу…',
  }
  const titlePlaceholders: Record<PostType, string> = {
    REFLECTION: 'Заголовок (необов\'язково)',
    QUESTION:   'Заголовок питання',
    SUPPORT:    '',
    RESOURCE:   'Назва ресурсу',
  }
  const ctaLabels: Record<PostType, string> = {
    REFLECTION: 'Поділитися роздумом ♡',
    QUESTION:   'Поставити запитання ♡',
    SUPPORT:    'Поділитися ♡',
    RESOURCE:   'Поділитися ресурсом ♡',
  }

  const submit = async () => {
    if (!content.trim() && type !== 'RESOURCE') { setError('Заповніть текст'); return }
    if (type === 'RESOURCE' && !linkUrl.trim()) { setError('Додайте посилання'); return }
    setSubmitting(true); setError('')
    try {
      const fd = new FormData()
      fd.append('type', type)
      if (title.trim()) fd.append('title', title.trim())
      fd.append('content', content.trim())
      if (linkUrl.trim()) fd.append('linkUrl', linkUrl.trim())
      if (imageFile) fd.append('image', imageFile)
      const res = await api.post('/community', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      onCreated(res.data)
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.error || 'Помилка')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-lg sm:rounded-[var(--r-lg)] rounded-t-[var(--r-lg)] flex flex-col max-h-[90vh]"
        style={{ background: 'var(--surface)', boxShadow: 'var(--clay)' }}
      >
        <div
          className="px-6 pt-5 pb-4 shrink-0 flex items-center justify-between rounded-t-[var(--r-lg)]"
          style={{ borderBottom: '1px solid var(--line)', background: meta.pillBg }}
        >
          <h2
            className="font-cormorant text-xl font-semibold"
            style={{ color: meta.pillColor }}
          >
            {meta.catLabel}
          </h2>
          <button onClick={onClose} className="hover:opacity-60 transition" style={{ color: 'var(--ink-3)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
          {error && <p className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}

          {titlePlaceholders[type] && (
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={titlePlaceholders[type]}
              className="neu-input w-full rounded-xl px-4 py-2.5 text-sm"
              style={{ border: '1px solid rgba(150,120,100,.28)', color: 'var(--ink)' }}
            />
          )}

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={placeholders[type]}
            rows={5}
            className="neu-input w-full rounded-xl px-4 py-2.5 text-sm resize-none"
            style={{ border: '1px solid rgba(150,120,100,.28)', color: 'var(--ink)' }}
          />

          {type === 'RESOURCE' && (
            <div
              className="flex items-center gap-2 rounded-xl px-4 py-2.5"
              style={{ border: '1px solid rgba(150,120,100,.28)', background: 'var(--surface)' }}
            >
              <LinkIcon size={14} className="shrink-0" style={{ color: 'var(--ink-3)' }} />
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 text-sm bg-transparent focus:outline-none"
                style={{ color: 'var(--ink)' }}
              />
            </div>
          )}

          {(type === 'REFLECTION' || type === 'RESOURCE') && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => setImageFile(e.target.files?.[0] ?? null)} />
              {imageFile ? (
                <div
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5"
                  style={{ border: '1px solid rgba(150,120,100,.28)', background: 'var(--surface)' }}
                >
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--ink)' }}>{imageFile.name}</span>
                  <button onClick={() => setImageFile(null)} style={{ color: 'var(--ink-3)' }} className="hover:opacity-60 transition">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-sm transition hover:opacity-70"
                  style={{ color: 'var(--ink-3)' }}
                >
                  <Upload size={14} />
                  Додати фото (необов'язково)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--line)' }}>
          <button
            onClick={submit}
            disabled={submitting}
            className="neu-btn-primary w-full py-3 rounded-xl font-semibold disabled:opacity-40"
          >
            {submitting ? 'Публікуємо...' : ctaLabels[type]}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const scrollTarget = (location.state as { scrollTo?: string } | null)?.scrollTo
  const scrolledRef = useRef(false)
  const feedRef = useRef<HTMLDivElement>(null)

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [sort, setSort] = useState<SortType>('NEW')
  const [weeklyCount, setWeeklyCount] = useState(0)
  const [unansweredPosts, setUnansweredPosts] = useState<Post[]>([])
  const [phrase, setPhrase] = useState<Phrase | null>(null)
  const [createType, setCreateType] = useState<PostType | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 20

  const fetchPosts = async (f: FilterType, p: number, append = false) => {
    setLoading(true)
    try {
      let data: Post[]
      if (f === 'SAVED') {
        const res = await api.get('/community/saved')
        data = res.data
      } else {
        const params: Record<string, string> = { page: String(p), limit: String(LIMIT) }
        if (f !== 'ALL') params.type = f
        const res = await api.get('/community', { params })
        data = res.data
      }
      setPosts(prev => append ? [...prev, ...data] : data)
      setHasMore(f !== 'SAVED' && data.length === LIMIT)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!scrollTarget) window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!scrollTarget || posts.length === 0 || scrolledRef.current) return
    scrolledRef.current = true
    const timer = setTimeout(() => {
      const el = document.getElementById(`post-${scrollTarget}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(timer)
  }, [posts, scrollTarget])

  useEffect(() => {
    api.get('/community/stats').then(r => setWeeklyCount(r.data.weeklyCount)).catch(() => {})
    api.get('/community', { params: { type: 'QUESTION', limit: '20' } })
      .then(r => setUnansweredPosts((r.data as Post[]).filter(p => p._count.comments === 0)))
      .catch(() => {})
    api.get('/phrases', { params: { random: 'true', limit: '1' } })
      .then(r => r.data?.[0] && setPhrase(r.data[0]))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
    fetchPosts(filter, 1)
  }, [filter])

  const handleReact = async (postId: string, emoji: string) => {
    try {
      const res = await api.post(`/community/${postId}/react`, { emoji })
      setPosts(prev => {
        const updated = prev.map(p => p.id === postId ? { ...p, reactions: res.data } : p)
        if (filter === 'SAVED') {
          return updated.filter(p => {
            if (p.id !== postId) return true
            return p.reactions.some((r: Reaction) => (r.emoji === '🔖' || r.emoji === '💎') && r.user.id === user?.id)
          })
        }
        return updated
      })
    } catch {}
  }

  const handleDelete = async (postId: string) => {
    if (!confirm('Видалити публікацію?')) return
    try {
      await api.delete(`/community/${postId}`)
      setPosts(prev => prev.filter(p => p.id !== postId))
    } catch {}
  }

  const handleCreated = (post: Post) => {
    setPosts(prev => [post, ...prev])
    setWeeklyCount(c => c + 1)
  }

  const loadMore = () => {
    const next = page + 1
    setPage(next)
    fetchPosts(filter, next, true)
  }

  const scrollToFeed = () => {
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const displayedPosts = useMemo(() => {
    let result = [...posts]
    if (sort === 'UNANSWERED') result = result.filter(p => p._count.comments === 0)
    else if (sort === 'TOP') result = result.sort((a, b) => b.reactions.length - a.reactions.length)
    return result
  }, [posts, sort])

  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() : '?'

  const activeAuthors = useMemo(() => {
    const seen = new Set<string>()
    return posts.filter(p => {
      if (seen.has(p.author.id)) return false
      seen.add(p.author.id)
      return true
    }).slice(0, 4).map(p => p.author)
  }, [posts])

  return (
    <Layout>
      <div className="max-w-[1120px] mx-auto">

        {/* ── PULSE HERO ──────────────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr] gap-8 items-center"
          style={{
            background: 'linear-gradient(150deg,#FBEFEF,#F3DEE6 55%,#ECE0F2)',
            borderRadius: 'var(--r-xl)',
            boxShadow: 'var(--clay)',
            padding: '40px 46px',
          }}
        >
          {/* decorative blob */}
          <div
            className="absolute rounded-full pointer-events-none opacity-50"
            style={{ width: 220, height: 220, right: '8%', top: -90, background: 'radial-gradient(circle at 35% 30%,rgba(255,255,255,.7),rgba(221,212,240,.4))' }}
          />

          {/* Left: text content */}
          <div className="relative z-10">
            <span
              className="inline-flex items-center gap-2 text-[12px] font-extrabold tracking-[.14em] uppercase"
              style={{ color: 'var(--rose-ink)' }}
            >
              ♡ Спільнота EFT
            </span>

            <h1
              className="font-cormorant mt-3 leading-[1.06]"
              style={{ fontSize: 'clamp(28px,3.6vw,40px)', color: 'var(--ink)' }}
            >
              Тут ви ніколи не{' '}
              <em className="italic" style={{ color: 'var(--rose-deep)' }}>наодинці</em>
            </h1>
            <p
              className="font-cormorant italic mt-1.5"
              style={{ fontSize: '18px', color: 'var(--ink-2)' }}
            >
              Простір підтримки, питань і теплих знахідок
            </p>

            {/* Stats */}
            <div className="flex gap-6 mt-5 flex-wrap">
              <div>
                <b
                  className="font-cormorant flex items-center gap-2"
                  style={{ fontSize: '30px', fontWeight: 700, color: 'var(--rose-deep)', lineHeight: 1 }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: 'var(--sage-deep)', animation: 'ping-soft 2s ease-out infinite' }}
                  />
                  {weeklyCount}
                </b>
                <span className="block text-[12.5px] font-semibold mt-1" style={{ color: 'var(--ink-2)' }}>
                  дописів за тиждень
                </span>
              </div>
              <div>
                <b
                  className="font-cormorant"
                  style={{ fontSize: '30px', fontWeight: 700, color: 'var(--rose-deep)', lineHeight: 1 }}
                >
                  {unansweredPosts.length}
                </b>
                <span className="block text-[12.5px] font-semibold mt-1" style={{ color: 'var(--ink-2)' }}>
                  питань без відповіді
                </span>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="flex gap-3 mt-7 flex-wrap">
              <button
                onClick={() => setCreateType('REFLECTION')}
                className="neu-btn-primary inline-flex items-center gap-2 px-5 py-3 rounded-pill font-semibold text-[15px]"
              >
                Новий допис <Plus size={16} />
              </button>
              <button
                onClick={() => setFilter('SAVED')}
                className="neu-btn inline-flex items-center gap-2 px-5 py-3 rounded-pill font-semibold text-[15px]"
                style={{ color: 'var(--ink-2)' }}
              >
                Мої збережені ♡
              </button>
            </div>
          </div>

          {/* Right: 3D scene (desktop only) */}
          <div className="relative hidden lg:block" style={{ minHeight: 320 }}>
            {/* Spheres */}
            <div
              className="absolute rounded-full"
              style={{
                width: 200, height: 200, right: 24, top: 34,
                background: 'radial-gradient(circle at 32% 28%,#FBEBEC,#ECC9CC 55%,#DDA9AE)',
                boxShadow: '-16px -16px 36px rgba(255,255,255,.6),22px 26px 52px rgba(190,140,150,.4)',
                animation: 'floaty 7s ease-in-out infinite',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 116, height: 116, left: 18, top: 18,
                background: 'radial-gradient(circle at 32% 28%,#EAF0F2,#C7D8DD 55%,#A7C5CE)',
                boxShadow: '-12px -12px 26px rgba(255,255,255,.6),16px 20px 40px rgba(150,130,190,.4)',
                animation: 'floaty2 6s ease-in-out infinite',
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                width: 74, height: 74, left: 64, bottom: 18,
                background: 'radial-gradient(circle at 32% 28%,#EAF2EA,#DCE7EA 55%,#C2D2C4)',
                boxShadow: '-8px -8px 18px rgba(255,255,255,.7),12px 14px 28px rgba(140,165,145,.4)',
                animation: 'floaty 5.5s ease-in-out infinite',
              }}
            />
            {/* Cylinder */}
            <div
              className="absolute"
              style={{
                left: 48, top: 150, width: 92, height: 128, borderRadius: 46,
                background: 'linear-gradient(145deg,#FBE2D6,#F4C3AC)',
                boxShadow: '-12px -12px 26px rgba(255,255,255,.55),16px 20px 40px rgba(190,140,120,.4)',
                animation: 'floaty2 8s ease-in-out infinite',
              }}
            />

            {/* Floating cards */}
            <button
              onClick={() => { setSort('UNANSWERED'); scrollToFeed() }}
              className="absolute flex items-center gap-3 rounded-[20px] p-3 text-left transition-all hover:-translate-y-1"
              style={{
                left: -14, top: 148, maxWidth: 230,
                background: 'rgba(252,248,245,.94)',
                boxShadow: 'var(--float)',
                backdropFilter: 'blur(6px)',
                animation: 'floaty2 7.5s ease-in-out infinite',
              }}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#D6E8EC', color: 'var(--plum)', boxShadow: 'var(--clay-sm)' }}
              >
                <HelpCircle size={18} />
              </span>
              <span>
                <span className="block font-extrabold text-[13.5px]" style={{ color: 'var(--ink)' }}>
                  {unansweredPosts.length} питань чекають
                </span>
                <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  допоможіть колегам ↗
                </span>
              </span>
            </button>

            <button
              onClick={() => { setFilter('SAVED'); scrollToFeed() }}
              className="absolute flex items-center gap-3 rounded-[20px] p-3 text-left transition-all hover:-translate-y-1"
              style={{
                right: 6, bottom: 14,
                background: 'rgba(252,248,245,.94)',
                boxShadow: 'var(--float)',
                backdropFilter: 'blur(6px)',
                animation: 'floaty 6s ease-in-out infinite .4s',
              }}
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: '#EDD8CE', color: 'var(--rose-deep)', boxShadow: 'var(--clay-sm)' }}
              >
                <Bookmark size={18} />
              </span>
              <span>
                <span className="block font-extrabold text-[13.5px]" style={{ color: 'var(--ink)' }}>
                  Мої збережені
                </span>
                <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  ваша колекція ♡
                </span>
              </span>
            </button>
          </div>
        </section>

        {/* ── CATEGORY CHIPS ──────────────────────────────────────────────── */}
        <div
          className="flex gap-3.5 mt-9 pb-2 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {([
            {
              key: 'ALL' as FilterType,
              label: 'Усі записи',
              iconBg: 'linear-gradient(135deg,#E3A88F,#F0502E)',
              iconColor: '#fff',
              Icon: Plus,
            },
            {
              key: 'REFLECTION' as FilterType,
              label: TYPE_META.REFLECTION.catLabel,
              iconBg: TYPE_META.REFLECTION.chipBg,
              iconColor: TYPE_META.REFLECTION.chipColor,
              Icon: Sparkles,
            },
            {
              key: 'SUPPORT' as FilterType,
              label: TYPE_META.SUPPORT.catLabel,
              iconBg: TYPE_META.SUPPORT.chipBg,
              iconColor: TYPE_META.SUPPORT.chipColor,
              Icon: Heart,
            },
            {
              key: 'QUESTION' as FilterType,
              label: TYPE_META.QUESTION.catLabel,
              iconBg: TYPE_META.QUESTION.chipBg,
              iconColor: TYPE_META.QUESTION.chipColor,
              Icon: HelpCircle,
            },
            {
              key: 'RESOURCE' as FilterType,
              label: TYPE_META.RESOURCE.catLabel,
              iconBg: TYPE_META.RESOURCE.chipBg,
              iconColor: TYPE_META.RESOURCE.chipColor,
              Icon: BookOpen,
            },
          ]).map(chip => {
            const isActive = filter === chip.key
            const count = chip.key === 'ALL'
              ? posts.length
              : posts.filter(p => p.type === chip.key).length
            return (
              <button
                key={chip.key}
                onClick={() => { setFilter(chip.key); setSort('NEW') }}
                className="flex-none flex items-center gap-3 rounded-pill transition-all duration-200"
                style={{
                  padding: '12px 18px 12px 14px',
                  background: 'var(--surface)',
                  boxShadow: isActive ? 'var(--clay-hover)' : 'var(--clay-sm)',
                  transform: isActive ? 'translateY(-2px)' : '',
                }}
              >
                <span
                  className="w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0 transition-transform duration-200"
                  style={{
                    background: chip.iconBg,
                    color: chip.iconColor,
                    transform: isActive ? 'scale(1.05)' : '',
                  }}
                >
                  <chip.Icon size={20} />
                </span>
                <span className="text-left">
                  <span
                    className="block font-extrabold text-[14.5px] whitespace-nowrap"
                    style={{ color: isActive ? 'var(--rose-ink)' : 'var(--ink)' }}
                  >
                    {chip.label}
                  </span>
                  {count > 0 && (
                    <span className="block text-[12px] font-semibold mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      {count} {count === 1 ? 'допис' : count < 5 ? 'дописи' : 'дописів'}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── BODY: FEED + RAIL ────────────────────────────────────────────── */}
        <div
          ref={feedRef}
          className="mt-9 grid gap-9 grid-cols-1 lg:grid-cols-[1fr_312px]"
        >

          {/* ── MAIN FEED ── */}
          <div>

            {/* Composer */}
            {filter !== 'SAVED' && (
              <div
                className="rounded-[var(--r-lg)] mb-8"
                style={{ background: 'var(--surface)', boxShadow: 'var(--clay)', padding: '22px 26px' }}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-[13px] shrink-0"
                    style={{ background: 'linear-gradient(135deg,#E3A88F,#F0502E)', boxShadow: 'var(--clay-sm)' }}
                  >
                    {initials}
                  </div>
                  <button
                    onClick={() => setCreateType('REFLECTION')}
                    className="flex-1 min-w-0 px-5 py-3 rounded-pill text-[15px] text-left transition-all hover:opacity-70"
                    style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
                  >
                    Поділіться роздумами, запитайте чи підтримайте колегу…
                  </button>
                </div>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {([
                    { type: 'REFLECTION' as PostType, label: 'Роздум',    Icon: Sparkles },
                    { type: 'QUESTION'   as PostType, label: 'Питання',   Icon: HelpCircle },
                    { type: 'SUPPORT'    as PostType, label: 'Підтримка', Icon: Heart },
                    { type: 'RESOURCE'   as PostType, label: 'Ресурс',    Icon: BookOpen },
                  ]).map(t => (
                    <button
                      key={t.type}
                      onClick={() => setCreateType(t.type)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-[13px] font-bold transition-all hover:-translate-y-0.5"
                      style={{ background: 'var(--surface-2)', color: TYPE_META[t.type].composerColor }}
                    >
                      <t.Icon size={15} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sort bar */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-[13px] font-bold mr-1"
                style={{ color: 'var(--ink-3)' }}
              >
                <SlidersHorizontal size={16} />Показати:
              </span>
              {([
                { key: 'NEW'        as SortType, label: 'Нові' },
                { key: 'UNANSWERED' as SortType, label: 'Без відповіді' },
                { key: 'TOP'        as SortType, label: 'Найбільше підтримки' },
              ]).map(s => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className="px-4 py-2 rounded-pill font-bold text-[13.5px] transition-all"
                  style={sort === s.key
                    ? { background: 'var(--rose-ink)', color: '#fff', border: 'none' }
                    : { background: 'transparent', color: 'var(--ink-2)', border: '1.5px solid var(--line)' }
                  }
                >
                  {s.label}
                </button>
              ))}
              <span className="ml-auto text-[13px] font-bold" style={{ color: 'var(--ink-3)' }}>
                {displayedPosts.length} {displayedPosts.length === 1 ? 'допис' : displayedPosts.length < 5 ? 'дописи' : 'дописів'}
              </span>
            </div>

            {/* Feed */}
            {loading && page === 1 ? (
              <div className="space-y-5">
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="animate-pulse rounded-[var(--r-lg)]"
                    style={{ background: 'var(--surface)', boxShadow: 'var(--clay)', padding: '28px 32px' }}
                  >
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-11 h-11 rounded-full" style={{ background: 'var(--surface-2)' }} />
                      <div className="space-y-2">
                        <div className="h-3.5 rounded-full w-32" style={{ background: 'var(--surface-2)' }} />
                        <div className="h-3 rounded-full w-20" style={{ background: 'var(--surface-2)' }} />
                      </div>
                    </div>
                    <div className="h-5 rounded-full w-3/4 mb-3" style={{ background: 'var(--surface-2)' }} />
                    <div className="h-3.5 rounded-full w-full mb-2" style={{ background: 'var(--surface-2)' }} />
                    <div className="h-3.5 rounded-full w-2/3" style={{ background: 'var(--surface-2)' }} />
                  </div>
                ))}
              </div>
            ) : displayedPosts.length === 0 ? (
              <div className="text-center py-16">
                {filter === 'SAVED' ? (
                  <>
                    <Bookmark size={44} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--ink-3)' }} />
                    <p className="font-cormorant text-xl mb-1" style={{ color: 'var(--ink)' }}>
                      Збережених записів поки немає
                    </p>
                    <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                      Натискайте «Зберегти» на публікаціях ♡
                    </p>
                  </>
                ) : (
                  <>
                    <Heart size={44} className="mx-auto mb-3 opacity-40" style={{ color: 'var(--ink-3)' }} />
                    <p className="font-cormorant text-xl mb-1" style={{ color: 'var(--ink)' }}>Тут ще тихо</p>
                    <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                      Будьте першим, хто поділиться з спільнотою ♡
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {displayedPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id ?? ''}
                    onReact={handleReact}
                    onDelete={handleDelete}
                    onMarkUseful={() => {}}
                  />
                ))}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="w-full py-3 text-sm font-semibold transition rounded-[var(--r-lg)] hover:-translate-y-0.5"
                    style={{
                      background: 'var(--surface)',
                      boxShadow: 'var(--clay-sm)',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {loading ? 'Завантажуємо...' : 'Завантажити більше'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT RAIL ── */}
          <aside className="hidden lg:flex flex-col gap-5 sticky top-24 self-start">

            {/* Unanswered questions widget */}
            <div
              className="rounded-[var(--r-lg)]"
              style={{
                background: 'linear-gradient(150deg,#FBEDE4,#F6DECF)',
                boxShadow: 'var(--clay)',
                padding: '24px 28px',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Heart size={18} style={{ color: 'var(--rose-deep)' }} />
                <h3 className="font-cormorant text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Потребують відповіді
                </h3>
              </div>
              {unansweredPosts.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>Поки всі питання мають відповіді ♡</p>
              ) : (
                unansweredPosts.slice(0, 3).map((p, i) => (
                  <div
                    key={p.id}
                    className="py-3 cursor-pointer group"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)', paddingTop: i === 0 ? 2 : 12 }}
                    onClick={() => { setFilter('QUESTION'); setSort('UNANSWERED'); scrollToFeed() }}
                  >
                    <p
                      className="text-[14px] leading-[1.4] font-semibold transition group-hover:opacity-70"
                      style={{ color: 'var(--ink)' }}
                    >
                      {p.title || p.content.slice(0, 60) + (p.content.length > 60 ? '…' : '')}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
                      <span>{p.author.firstName} {p.author.lastName[0]}.</span>
                      <span>·</span>
                      <span className="font-bold" style={{ color: 'var(--rose-deep)' }}>Відповісти →</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Phrase of the day widget */}
            <div
              className="rounded-[var(--r-lg)]"
              style={{ background: 'var(--surface)', boxShadow: 'var(--clay)', padding: '24px 28px' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <BookText size={18} style={{ color: 'var(--rose-deep)' }} />
                <h3 className="font-cormorant text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>
                  Фраза дня
                </h3>
              </div>
              {phrase ? (
                <div>
                  <p className="font-cormorant italic leading-[1.45]" style={{ fontSize: '18px', color: 'var(--ink)' }}>
                    «{phrase.text}»
                  </p>
                  <cite className="block not-italic font-mulish text-[12.5px] mt-2.5" style={{ color: 'var(--ink-3)' }}>
                    — {phrase.author.firstName} {phrase.author.lastName}
                  </cite>
                </div>
              ) : (
                <p className="font-cormorant italic text-[17px]" style={{ color: 'var(--ink-3)' }}>
                  Фраз поки немає…
                </p>
              )}
              <button
                onClick={() => navigate('/dictionary')}
                className="inline-flex items-center gap-1.5 mt-4 text-[13.5px] font-bold transition hover:opacity-70"
                style={{ color: 'var(--rose-deep)' }}
              >
                До словника <ArrowRight size={14} />
              </button>
            </div>

            {/* Active users widget */}
            {activeAuthors.length > 0 && (
              <div
                className="rounded-[var(--r-lg)]"
                style={{ background: 'var(--surface)', boxShadow: 'var(--clay)', padding: '24px 28px' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Users size={18} style={{ color: 'var(--rose-deep)' }} />
                  <h3 className="font-cormorant text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>
                    Активні зараз
                  </h3>
                </div>
                <div className="flex items-center">
                  {activeAuthors.map((a, i) => (
                    <div
                      key={a.id}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-[12px] overflow-hidden border-[3px]"
                      style={{
                        marginLeft: i === 0 ? 0 : -10,
                        borderColor: 'var(--surface)',
                        background: 'linear-gradient(135deg,#E3A88F,#F0502E)',
                        boxShadow: 'var(--clay-sm)',
                      }}
                    >
                      {a.avatarUrl
                        ? <img src={a.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : `${a.firstName[0]}${a.lastName[0]}`}
                    </div>
                  ))}
                  <span className="ml-3.5 text-[13px] font-semibold" style={{ color: 'var(--ink-2)' }}>
                    у спільноті
                  </span>
                </div>
              </div>
            )}

          </aside>
        </div>
      </div>

      {/* Create post modal */}
      {createType && (
        <CreatePostModal
          type={createType}
          onClose={() => setCreateType(null)}
          onCreated={handleCreated}
        />
      )}
    </Layout>
  )
}
