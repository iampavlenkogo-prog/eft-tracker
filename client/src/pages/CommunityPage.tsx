import { useEffect, useState, useRef } from 'react'
import { MessageCircle, Trash2, ChevronDown, ChevronUp, CheckCircle, X, Upload, Link as LinkIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'
import api from '../api/axios'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'

type PostType = 'REFLECTION' | 'QUESTION' | 'SUPPORT' | 'RESOURCE'
type FilterType = 'ALL' | PostType

interface Author { id: string; firstName: string; lastName: string; avatarUrl: string | null }
interface Reaction { id: string; emoji: string; user: { id: string } }
interface Comment { id: string; content: string; isUseful: boolean; createdAt: string; author: Author }
interface Post {
  id: string; type: PostType; title: string | null; content: string
  imageUrl: string | null; linkUrl: string | null
  author: Author; reactions: Reaction[]; _count: { comments: number }; createdAt: string
}

const TYPE_META: Record<PostType, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  REFLECTION: { label: 'Роздуми',   color: 'text-[#B5736A]', bg: 'bg-[#FBF4F2]', border: 'border-[#E8CEC8]', emoji: '🌸' },
  QUESTION:   { label: 'Питання',   color: 'text-[#9E7B42]', bg: 'bg-[#FAF6EE]', border: 'border-[#E4D4AD]', emoji: '🌿' },
  SUPPORT:    { label: 'Підтримка', color: 'text-[#7D6C9E]', bg: 'bg-[#F5F3FA]', border: 'border-[#CFC8E8]', emoji: '🤍' },
  RESOURCE:   { label: 'Ресурси',   color: 'text-[#5C8B78]', bg: 'bg-[#F1F8F5]', border: 'border-[#B9D9CC]', emoji: '📖' },
}

const REACTIONS: Record<PostType, { emoji: string; label: string }[]> = {
  REFLECTION: [
    { emoji: '🤍', label: 'Відгукуюсь' },
    { emoji: '✨', label: 'Беру з собою' },
    { emoji: '💎', label: 'Цінне' },
    { emoji: '🙏', label: 'Дякую' },
  ],
  QUESTION: [
    { emoji: '🤔', label: 'Мені теж цікаво' },
    { emoji: '💡', label: 'Маю схожий досвід' },
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

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: 'ALL', label: 'Усі' },
  { key: 'REFLECTION', label: 'Роздуми' },
  { key: 'QUESTION', label: 'Питання' },
  { key: 'SUPPORT', label: 'Підтримка' },
  { key: 'RESOURCE', label: 'Ресурси' },
]

function Avatar({ author, size = 'sm' }: { author: Author; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-rose-light to-rose/60 flex items-center justify-center text-white font-semibold shrink-0 overflow-hidden`}>
      {author.avatarUrl
        ? <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
        : `${author.firstName[0]}${author.lastName[0]}`}
    </div>
  )
}

function ReactionBar({ post, onReact }: { post: Post; onReact: (postId: string, emoji: string) => void }) {
  const { user } = useAuth()
  const reactions = REACTIONS[post.type]
  const counts = reactions.map(r => ({
    ...r,
    count: post.reactions.filter(pr => pr.emoji === r.emoji).length,
    active: post.reactions.some(pr => pr.emoji === r.emoji && pr.user.id === user?.id),
  }))

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {counts.map(r => (
        <button
          key={r.emoji}
          onClick={() => onReact(post.id, r.emoji)}
          title={r.label}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-all ${
            r.active
              ? 'bg-rose text-white border-rose'
              : 'bg-white border-sand text-warm-mid hover:border-rose/40 hover:text-rose'
          }`}
        >
          <span>{r.emoji}</span>
          {r.count > 0 && <span className="font-medium">{r.count}</span>}
          <span className="hidden sm:inline text-[11px]">{r.label}</span>
        </button>
      ))}
    </div>
  )
}

function CommentSection({
  post, currentUserId, onMarkUseful,
}: {
  post: Post; currentUserId: string; onMarkUseful: (postId: string, commentId: string) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
        <div className="h-6 bg-beige rounded animate-pulse" />
      ) : comments.length === 0 ? (
        <p className="text-xs text-warm-light italic">Поки немає коментарів — будьте першим ♡</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className={`flex gap-2.5 group ${c.isUseful ? 'bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5' : ''}`}>
              <Avatar author={c.author} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-warm-dark">{c.author.firstName} {c.author.lastName}</span>
                  <span className="text-[10px] text-warm-light">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: uk })}</span>
                  {c.isUseful && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
                      <CheckCircle size={10} /> Корисна відповідь
                    </span>
                  )}
                </div>
                <p className="text-sm text-warm-mid mt-0.5 leading-relaxed whitespace-pre-line">{c.content}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {post.type === 'QUESTION' && post.author.id === currentUserId && c.author.id !== currentUserId && (
                    <button
                      onClick={() => markUseful(c.id)}
                      className={`text-[11px] flex items-center gap-1 transition ${
                        c.isUseful ? 'text-emerald-600' : 'text-warm-light hover:text-emerald-600'
                      }`}
                    >
                      <CheckCircle size={11} />
                      {c.isUseful ? 'Відзначено корисною' : 'Відповідь була корисною'}
                    </button>
                  )}
                  {(c.author.id === currentUserId) && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="text-[11px] text-warm-light hover:text-red-400 transition opacity-0 group-hover:opacity-100"
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
          className="flex-1 border border-sand rounded-xl px-3 py-2 text-sm text-warm-dark placeholder:text-warm-light focus:outline-none focus:border-rose/50 transition resize-none"
        />
        <button
          onClick={submit}
          disabled={submitting || !text.trim()}
          className="px-4 py-2 bg-rose text-white rounded-xl text-sm font-medium hover:bg-rose/90 transition disabled:opacity-40 self-end"
        >
          {submitting ? '...' : '↑'}
        </button>
      </div>
    </div>
  )
}

function PostCard({
  post, currentUserId, onReact, onDelete, onMarkUseful,
}: {
  post: Post; currentUserId: string
  onReact: (postId: string, emoji: string) => void
  onDelete: (postId: string) => void
  onMarkUseful: (postId: string, commentId: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const meta = TYPE_META[post.type]

  return (
    <div className="bg-white rounded-2xl border border-sand shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between border-b ${meta.border} ${meta.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-warm-light">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: uk })}
          </span>
          {post.author.id === currentUserId && (
            <button onClick={() => onDelete(post.id)} className="text-warm-light hover:text-red-400 transition">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {/* Author */}
        <div className="flex items-center gap-2.5 mb-3">
          <Avatar author={post.author} />
          <span className="text-sm font-medium text-warm-dark">{post.author.firstName} {post.author.lastName}</span>
        </div>

        {post.title && (
          <h3 className="font-cormorant text-lg font-semibold text-warm-dark mb-1.5 leading-snug">{post.title}</h3>
        )}
        <p className="text-sm text-warm-mid leading-relaxed whitespace-pre-line">{post.content}</p>

        {post.linkUrl && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 text-sm text-rose hover:underline"
          >
            <LinkIcon size={13} className="shrink-0" />
            <span className="truncate">{post.linkUrl}</span>
          </a>
        )}

        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt=""
            className="mt-3 w-full rounded-xl object-cover max-h-64"
          />
        )}

        <ReactionBar post={post} onReact={onReact} />

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments(s => !s)}
          className="mt-3 flex items-center gap-1.5 text-xs text-warm-light hover:text-rose transition"
        >
          <MessageCircle size={13} />
          {showComments
            ? 'Сховати коментарі'
            : post._count.comments > 0
              ? `${post._count.comments} коментар${post._count.comments === 1 ? '' : post._count.comments < 5 ? 'і' : 'ів'}`
              : 'Написати коментар'}
          {showComments ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showComments && (
          <CommentSection post={post} currentUserId={currentUserId} onMarkUseful={onMarkUseful} />
        )}
      </div>
    </div>
  )
}

// ── Create Post Modal ────────────────────────────────────────────────────────
function CreatePostModal({
  type, onClose, onCreated,
}: {
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
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className={`px-6 pt-5 pb-4 border-b shrink-0 ${meta.border} ${meta.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className={`font-cormorant text-xl font-semibold ${meta.color}`}>{meta.label}</h2>
            </div>
            <button onClick={onClose} className="text-warm-light hover:text-warm-mid transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
          {error && <p className="text-sm text-red-500">{error}</p>}

          {titlePlaceholders[type] && (
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={titlePlaceholders[type]}
              className="w-full border border-sand rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-warm-light focus:outline-none focus:border-rose/50 transition"
            />
          )}

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={placeholders[type]}
            rows={5}
            className="w-full border border-sand rounded-xl px-4 py-2.5 text-sm text-warm-dark placeholder:text-warm-light focus:outline-none focus:border-rose/50 transition resize-none"
          />

          {(type === 'RESOURCE') && (
            <div className="flex items-center gap-2 border border-sand rounded-xl px-4 py-2.5">
              <LinkIcon size={14} className="text-warm-light shrink-0" />
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 text-sm text-warm-dark placeholder:text-warm-light focus:outline-none"
              />
            </div>
          )}

          {(type === 'REFLECTION' || type === 'RESOURCE') && (
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={e => setImageFile(e.target.files?.[0] ?? null)} />
              {imageFile ? (
                <div className="flex items-center gap-2 border border-sand rounded-xl px-4 py-2.5">
                  <span className="text-sm text-warm-dark flex-1 truncate">{imageFile.name}</span>
                  <button onClick={() => setImageFile(null)} className="text-warm-light hover:text-rose transition">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-warm-light hover:text-rose transition"
                >
                  <Upload size={14} />
                  Додати фото (необов'язково)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-sand shrink-0">
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3 bg-rose text-white rounded-xl font-medium hover:bg-rose/90 transition disabled:opacity-40"
          >
            {submitting ? 'Публікуємо...' : ctaLabels[type]}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Flower UI ────────────────────────────────────────────────────────────────
function FlowerNav({ weeklyCount, onPetalClick }: { weeklyCount: number; onPetalClick: (type: PostType) => void }) {
  const petals: { type: PostType; img: string; label: string; pos: string }[] = [
    { type: 'REFLECTION', img: '/illustrations/rozdumy.png',   label: 'Роздуми',   pos: 'left-1/2 top-0 -translate-x-1/2' },
    { type: 'QUESTION',   img: '/illustrations/putannya.png',  label: 'Питання',   pos: 'right-0 top-1/2 -translate-y-1/2' },
    { type: 'RESOURCE',   img: '/illustrations/resursy.png',   label: 'Ресурси',   pos: 'left-1/2 bottom-0 -translate-x-1/2' },
    { type: 'SUPPORT',    img: '/illustrations/pidtrymka.png', label: 'Підтримка', pos: 'left-0 top-1/2 -translate-y-1/2' },
  ]

  return (
    <div className="flex flex-col items-center py-6">
      <div className="relative w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] md:w-[500px] md:h-[500px]">
        {petals.map(p => (
          <button
            key={p.type}
            onClick={() => onPetalClick(p.type)}
            className={`absolute ${p.pos} w-[120px] h-[120px] sm:w-[150px] sm:h-[150px] md:w-[196px] md:h-[196px] rounded-full overflow-hidden shadow-lg hover:shadow-xl hover:scale-105 transition-all group`}
          >
            <img
              src={p.img}
              alt={p.label}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 py-1.5 bg-white/55 backdrop-blur-[3px] text-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-semibold text-warm-dark tracking-wide">{p.label}</span>
            </div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-warm-light mt-3 text-center">
        {weeklyCount} голосів спільноти цього тижня ♡
      </p>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CommunityPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [weeklyCount, setWeeklyCount] = useState(0)
  const [createType, setCreateType] = useState<PostType | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const LIMIT = 20

  const fetchPosts = async (f: FilterType, p: number, append = false) => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(p), limit: String(LIMIT) }
      if (f !== 'ALL') params.type = f
      const res = await api.get('/community', { params })
      const data: Post[] = res.data
      setPosts(prev => append ? [...prev, ...data] : data)
      setHasMore(data.length === LIMIT)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    api.get('/community/stats').then(r => setWeeklyCount(r.data.weeklyCount)).catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
    fetchPosts(filter, 1)
  }, [filter])

  const handlePetalClick = (type: PostType) => {
    setCreateType(type)
  }

  const handleFilter = (f: FilterType) => {
    setFilter(f)
  }

  const handleReact = async (postId: string, emoji: string) => {
    try {
      const res = await api.post(`/community/${postId}/react`, { emoji })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: res.data } : p))
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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="text-center mb-2">
          <h1 className="font-cormorant text-3xl font-semibold text-warm-dark">Спільнота EFT ♡</h1>
          <p className="text-sm text-warm-light mt-1">Простір професійної підтримки та зростання</p>
        </div>

        {/* Flower navigation */}
        <FlowerNav weeklyCount={weeklyCount} onPetalClick={handlePetalClick} />

        <p className="text-center text-xs text-warm-light -mt-2 mb-5">
          Натисніть на зображення, щоб поділитися з спільнотою
        </p>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 shadow-sm border border-sand mb-5 overflow-x-auto">
          {FILTER_LABELS.map(f => (
            <button
              key={f.key}
              onClick={() => handleFilter(f.key)}
              className={`flex-1 min-w-fit py-2 px-3 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                filter === f.key ? 'bg-rose text-white shadow-sm' : 'text-warm-mid hover:text-warm-dark'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Feed */}
        {loading && page === 1 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-sand p-5 animate-pulse">
                <div className="h-4 bg-beige rounded w-1/4 mb-3" />
                <div className="h-3 bg-beige rounded w-full mb-2" />
                <div className="h-3 bg-beige rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🌸</p>
            <p className="font-cormorant text-xl text-warm-dark mb-1">Тут ще тихо</p>
            <p className="text-sm text-warm-light">Будьте першим, хто поділиться з спільнотою ♡</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
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
                className="w-full py-3 text-sm text-warm-mid hover:text-rose transition border border-sand rounded-2xl bg-white"
              >
                {loading ? 'Завантажуємо...' : 'Завантажити більше'}
              </button>
            )}
          </div>
        )}
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
