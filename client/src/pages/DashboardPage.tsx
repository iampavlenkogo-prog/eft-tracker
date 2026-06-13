import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Heart, BookOpen, ChevronRight, ChevronDown, Calendar, Clock, User, Star,
  Users, Search, FileText, Banknote,
} from 'lucide-react'
import Layout from '../components/Layout'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'

function endTime(start: string, durationMin: number): string {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + durationMin
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

const MONTHS = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']

function dateParts(dateStr: string) {
  const p = dateStr.split('-')
  return { day: parseInt(p[2]), month: MONTHS[parseInt(p[1]) - 1] }
}

interface Phrase {
  id: string; text: string
  author: { id: string; firstName: string; lastName: string }
  savedByMe: boolean
}
interface AvailableSlot {
  id: string; date: string; time: string; duration: number
  type: 'INDIVIDUAL' | 'GROUP'
  supervisor: { firstName: string; lastName: string }
}
interface Booking {
  id: string; status: string; meetingLink: string | null
  slot: {
    date: string; time: string; duration: number
    supervisor: { firstName: string; lastName: string; telegram: string | null; meetingLink: string | null }
  }
}
interface UpcomingEvent {
  id: string; title: string; description: string
  date: string; startTime: string | null; endTime: string | null
  price: number; currency: string; coverImageUrl: string | null
  zoomLink: string | null; registrationClosed: boolean
  maxParticipants: number | null; status: string
  organizer: { firstName: string; lastName: string; avatarUrl: string | null }
  registrations: { id: string; status: string }[]
  _count: { registrations: number }
}
interface CommunityPostPreview {
  id: string; type: 'REFLECTION' | 'QUESTION' | 'SUPPORT' | 'RESOURCE'
  title: string | null; content: string
  _count: { comments: number }; reactions: { emoji: string }[]
  author: { firstName: string; lastName: string }; createdAt: string
}
interface TherapistRequestPreview {
  id: string; title: string; description: string
  therapyFormats: string[]; workFormat: string | null; city: string | null
  createdAt: string; _count: { responses: number }
}
interface GroupSupervision {
  id: string; title: string; scheduledDate: string; scheduledTime: string
  duration: number; status: string; price: number; currency: string
  supervisor: { firstName: string; lastName: string }
  presenterUser: { firstName: string; lastName: string } | null
  participants: { userId: string; paymentStatus: string; isPresenter: boolean }[]
}
interface EventRegistration {
  id: string; status: string
  event: { id: string; title: string; date: string; startTime: string | null }
}
interface MyGroupParticipation {
  id: string; title: string; scheduledDate: string; scheduledTime: string
  status: string; zoomLink: string | null
  supervisor: { firstName: string; lastName: string }
  myParticipation: { paymentStatus: string; isPresenter: boolean }
}
interface MneItem {
  sortKey: string; kind: 'booking' | 'event' | 'group'
  date: string; time: string; title: string; id: string
  status: string; link?: string | null; supervisorName?: string
}

const POST_META: Record<string, { label: string; color: string; dot: string; bg: string }> = {
  REFLECTION: { label: 'Роздуми',   color: '#F45A34', dot: '#E07858', bg: 'linear-gradient(135deg,#F3DDD1,#ECD4C4)' },
  QUESTION:   { label: 'Питання',   color: '#BF9A77', dot: '#C9A87A', bg: 'linear-gradient(135deg,#FBF1E4,#F2E4C6)' },
  SUPPORT:    { label: 'Підтримка', color: '#5E828E', dot: '#8AAAB4', bg: 'linear-gradient(135deg,#EAF0F2,#D4E6EA)' },
  RESOURCE:   { label: 'Ресурс',    color: '#5E828E', dot: '#8AAAB4', bg: 'linear-gradient(135deg,#EAF0F2,#DCE7EA)' },
}
const GSV_LABEL: Record<string, string> = {
  WAITING_FOR_CASE:    'Шукаємо супервізанта ♡',
  CASE_CONFIRMED:      'Випадок підтверджено',
  REGISTRATION_OPEN:   'Реєстрація відкрита',
  RECORDING_AVAILABLE: 'Запис доступний',
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [phrases, setPhrases]           = useState<Phrase[]>([])
  const [availableSlots, setSlots]      = useState<AvailableSlot[]>([])
  const [mneExpanded, setMneExpanded]   = useState(false)
  const [myBookings, setMyBookings]     = useState<Booking[]>([])
  const [activeGroups, setGroups]       = useState<GroupSupervision[]>([])
  const [upcomingEvents, setEvents]     = useState<UpcomingEvent[]>([])
  const [therapistRequests, setReqs]    = useState<TherapistRequestPreview[]>([])
  const [myEventRegs, setMyEventRegs]   = useState<EventRegistration[]>([])
  const [myGroupParts, setMyGroupParts] = useState<MyGroupParticipation[]>([])
  const [communityPreviews, setCommunity] = useState<CommunityPostPreview[]>([])

  useEffect(() => {
    api.get('/phrases?limit=5&random=true').then(r => setPhrases(r.data)).catch(() => {})
    api.get('/slots/available?limit=3').then(r => setSlots(r.data)).catch(() => {})
    api.get('/bookings/my').then(r => {
      const today = new Date().toISOString().slice(0, 10)
      const upcoming = (r.data as Booking[])
        .filter(b => ['PENDING', 'APPROVED'].includes(b.status) && b.slot.date >= today)
        .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.time.localeCompare(b.slot.time))
      setMyBookings(upcoming)
    }).catch(() => {})
    api.get('/events/my-registrations').then(r => {
      const today = new Date().toISOString().slice(0, 10)
      setMyEventRegs((r.data as EventRegistration[]).filter(reg => reg.status !== 'REJECTED' && reg.event.date >= today))
    }).catch(() => {})
    api.get('/group-supervisions/mine').then(r => {
      const today = new Date().toISOString().slice(0, 10)
      setMyGroupParts((r.data as MyGroupParticipation[]).filter(g => g.scheduledDate >= today && g.myParticipation.paymentStatus !== 'REJECTED'))
    }).catch(() => {})
    api.get('/group-supervisions').then(r => {
      const relevant = (r.data as GroupSupervision[]).filter(g =>
        ['WAITING_FOR_CASE','CASE_CONFIRMED','REGISTRATION_OPEN','RECORDING_AVAILABLE'].includes(g.status)
      ).slice(0, 3)
      setGroups(relevant)
    }).catch(() => {})
    api.get('/events').then(r => {
      const now = new Date()
      const upcoming = (r.data as UpcomingEvent[])
        .filter(e => e.status === 'PUBLISHED' && new Date(e.date) >= now)
        .slice(0, 7)
      setEvents(upcoming)
    }).catch(() => {})
    api.get('/therapist-requests').then(r => {
      setReqs((r.data as TherapistRequestPreview[]).slice(0, 4))
    }).catch(() => {})
    api.get('/community?limit=3').then(r => {
      setCommunity((r.data as CommunityPostPreview[]).slice(0, 3))
    }).catch(() => {})
  }, [])

  const toggleSave = async (phrase: Phrase) => {
    setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: !p.savedByMe } : p))
    try {
      if (phrase.savedByMe) await api.delete(`/phrases/${phrase.id}/save`)
      else await api.post(`/phrases/${phrase.id}/save`)
    } catch {
      setPhrases(prev => prev.map(p => p.id === phrase.id ? { ...p, savedByMe: phrase.savedByMe } : p))
    }
  }

  const ev0 = upcomingEvents[0]
  const reg0 = ev0?.registrations[0]
  const d0 = ev0 ? new Date(ev0.date) : null
  const full0 = ev0?.maxParticipants != null ? ev0.maxParticipants - ev0._count.registrations <= 0 : false
  const closed0 = full0 || !!ev0?.registrationClosed

  const mneItems = useMemo<MneItem[]>(() => {
    const items: MneItem[] = []
    myBookings.forEach(b => {
      items.push({
        sortKey: b.slot.date + b.slot.time,
        kind: 'booking', date: b.slot.date, time: b.slot.time,
        title: 'Індивідуальна супервізія', id: b.id, status: b.status,
        link: b.meetingLink || b.slot.supervisor.meetingLink,
        supervisorName: `${b.slot.supervisor.firstName} ${b.slot.supervisor.lastName}`,
      })
    })
    myEventRegs.forEach(reg => {
      items.push({
        sortKey: reg.event.date + (reg.event.startTime ?? ''),
        kind: 'event', date: reg.event.date, time: reg.event.startTime ?? '',
        title: reg.event.title, id: reg.event.id, status: reg.status,
      })
    })
    myGroupParts.forEach(g => {
      items.push({
        sortKey: g.scheduledDate + g.scheduledTime,
        kind: 'group', date: g.scheduledDate, time: g.scheduledTime,
        title: g.title, id: g.id, status: g.myParticipation.paymentStatus,
        link: g.zoomLink,
        supervisorName: `${g.supervisor.firstName} ${g.supervisor.lastName}`,
      })
    })
    return items.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [myBookings, myEventRegs, myGroupParts])

  return (
    <Layout>

      {/* ══════════════════════════════════════
          1. GREETING BAND
         ══════════════════════════════════════ */}
      <section className="greet-band" style={{ marginBottom: 32 }}>
        <div className="gb-grid">

          {/* LEFT: greeting + pulse */}
          <div className="gb-left">
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(26px,3.4vw,38px)', lineHeight: 1.1, margin: 0 }}>
                Доброго дня, <em style={{ fontStyle: 'italic', color: 'var(--rose-deep)' }}>{user?.firstName}</em> <span style={{ color: '#6A8C9A' }}>♡</span>
              </h1>
              <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18, color: 'var(--ink-2)', marginTop: 6, marginBottom: 0 }}>
                Ваш дім професійного розвитку в ЕФТ
              </p>
            </div>

            <div className="pulse">
              <div className="pulse__head">
                Пульс спільноти
                <span className="pulse__beat">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7 2.7C19 15.6 12 20 12 20z"/></svg>
                </span>
              </div>
              <div className="pulse__row">
                <button className="pnode pn--chat" onClick={() => navigate('/therapist-requests')}>
                  <span className="pnode__ring"><Search /></span>
                  <b>{therapistRequests.length}</b>
                  <small>запити на пошук<br/>терапевта</small>
                </button>
                <button className="pnode pn--doc" onClick={() => navigate('/community')}>
                  <span className="pnode__ring"><FileText /></span>
                  <b>{communityPreviews.length}</b>
                  <small>нові статті<br/>та ресурси</small>
                </button>
                <button className="pnode pn--sup" onClick={() => document.getElementById('supervisions-section')?.scrollIntoView({ behavior: 'smooth' })}>
                  <span className="pnode__ring"><Users /></span>
                  <b>{activeGroups.length}</b>
                  <small>нові<br/>супервізії</small>
                </button>
                <button className="pnode pn--evt" onClick={() => navigate('/events')}>
                  <span className="pnode__ring"><Star /></span>
                  <b>{upcomingEvents.length}</b>
                  <small>нових анонсів<br/>подій спільноти</small>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: next events mini panel */}
          <div>
            <div className="mne">
              <div className="mne__head">
                <h3>Мої найближчі події</h3>
                <Link to="/events" className="dlink">Усі події <ChevronRight size={14} /></Link>
              </div>

              {mneItems.length === 0 ? (
                <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 16, padding: '12px 4px' }}>
                  Поки немає зареєстрованих подій ♡
                </p>
              ) : (
                <div>
                  {(mneExpanded ? mneItems : mneItems.slice(0, 3)).map((item, i) => {
                    const { day, month } = dateParts(item.date)
                    let btn: React.ReactNode = null
                    const btnStyle: React.CSSProperties = { flexShrink: 0 }
                    if (item.kind === 'booking') {
                      if (item.status === 'PENDING') {
                        btn = <span className="btn btn--sky btn--sm" style={{ ...btnStyle, color: 'var(--ink-3)', cursor: 'default' }}>Очікує підтвердження</span>
                      } else if (item.link) {
                        btn = <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn--sky btn--sm" style={btnStyle}>Приєднатися</a>
                      } else {
                        btn = <span className="btn btn--sky btn--sm" style={btnStyle}>✓ Підтверджено</span>
                      }
                    } else if (item.kind === 'event') {
                      const label = item.status === 'CONFIRMED' ? '✓ Підтверджено' : 'Заявку подано'
                      btn = <Link to={`/events/${item.id}`} className="btn btn--sky btn--sm" style={btnStyle}>{label}</Link>
                    } else {
                      if (item.status === 'CONFIRMED' || item.status === 'FREE') {
                        btn = item.link
                          ? <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn--sky btn--sm" style={btnStyle}>Приєднатися</a>
                          : <Link to={`/group-supervisions/${item.id}`} className="btn btn--sky btn--sm" style={btnStyle}>✓ Підтверджено</Link>
                      } else {
                        btn = <Link to={`/group-supervisions/${item.id}`} className="btn btn--sky btn--sm" style={btnStyle}>Заявку подано</Link>
                      }
                    }
                    return (
                      <div
                        key={`${item.kind}-${item.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '8px 4px',
                          borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                        }}
                      >
                        <div className="sdate" style={{ flexShrink: 0 }}><b>{day}</b><span>{month}</span></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700,
                            color: 'var(--ink)', margin: 0, lineHeight: 1.25,
                            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                          }}>{item.title}</h4>
                          <div className="srow__sub" style={{ marginTop: 2 }}>
                            {item.time && <span className="dmeta"><Clock size={12} />{item.time}</span>}
                            {item.supervisorName && <span className="dmeta"><User size={12} />{item.supervisorName}</span>}
                          </div>
                        </div>
                        {btn}
                      </div>
                    )
                  })}
                  {mneItems.length > 3 && (
                    <button
                      onClick={() => setMneExpanded(e => !e)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', marginTop: 10, padding: '8px 0',
                        borderTop: '1px solid var(--line)', border: 'none', background: 'none',
                        color: '#6A8C9A', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
                      }}
                    >
                      {mneExpanded ? 'Сховати' : `Всі мої події (${mneItems.length})`}
                      <ChevronDown
                        size={16}
                        className={mneExpanded ? undefined : 'mne-arrow'}
                        style={{ transition: 'transform .3s', transform: mneExpanded ? 'rotate(180deg)' : 'none' }}
                      />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          2. FEATURED EVENT
         ══════════════════════════════════════ */}
      {ev0 && d0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="hm-head">
            <div>
              <h2>Найближча подія</h2>
              <p className="sub">Не пропустіть реєстрацію</p>
            </div>
            <Link to="/events" className="dlink">Усі події <ChevronRight size={14} /></Link>
          </div>

          {/* Hero card */}
          <article style={{ background: '#F5EDE9', borderRadius: 'var(--r-xl)', boxShadow: 'var(--clay)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', minHeight: 320 } as React.CSSProperties}>
              <div style={{ padding: '34px 36px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,.7)', color: 'var(--rose-ink)', fontWeight: 800, fontSize: 12.5, boxShadow: 'var(--clay-sm)' }}>
                  ♡ Подія тижня · {format(d0, 'd MMM', { locale: uk })}
                </span>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px,2.8vw,32px)', lineHeight: 1.08, margin: 0 }}>{ev0.title}</h3>
                {ev0.description && (
                  <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>
                    {ev0.description.length > 220 ? ev0.description.slice(0, 220) + '…' : ev0.description}
                  </p>
                )}
                <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Calendar size={17} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                    <span><b style={{ display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{format(d0, 'd MMMM, EEE', { locale: uk })}</b><small style={{ fontSize: 11, color: 'var(--ink-3)' }}>дата</small></span>
                  </li>
                  {ev0.startTime && (
                    <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Clock size={17} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                      <span><b style={{ display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{ev0.startTime}{ev0.endTime ? `–${ev0.endTime}` : ''}</b><small style={{ fontSize: 11, color: 'var(--ink-3)' }}>час</small></span>
                    </li>
                  )}
                  <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <User size={17} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                    <span><b style={{ display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>{ev0.organizer.firstName} {ev0.organizer.lastName}</b><small style={{ fontSize: 11, color: 'var(--ink-3)' }}>організатор</small></span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Banknote size={17} style={{ color: 'var(--rose-deep)', flexShrink: 0 }} />
                    <span>
                      <b style={{ display: 'block', fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>
                        {ev0.price === 0 ? 'Безкоштовно' : <>{ev0.price} <span style={{ fontSize: 12, fontWeight: 700 }}>{ev0.currency}</span></>}
                      </b>
                      <small style={{ fontSize: 11, color: 'var(--ink-3)' }}>вартість</small>
                    </span>
                  </li>
                </ul>
              </div>
              <div style={{ background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {ev0.coverImageUrl
                  ? <img src={ev0.coverImageUrl} alt={ev0.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <Star size={72} style={{ color: 'rgba(176,107,126,.15)' }} />
                }
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '18px 36px', borderTop: '1px solid rgba(176,107,126,.14)' }}>
              {reg0 ? (
                <Link to={`/events/${ev0.id}`} className="btn btn--clay" style={{ color: reg0.status === 'CONFIRMED' ? 'var(--sage-deep)' : 'var(--terra)' }}>
                  {reg0.status === 'CONFIRMED' ? '✓ Участь підтверджена' : 'Зареєстровано'}
                </Link>
              ) : closed0 ? (
                <div className="btn btn--clay" style={{ color: 'var(--terra)' }}>Реєстрацію закрито</div>
              ) : (
                <Link to={`/events/${ev0.id}`} className="btn btn--primary">
                  Зареєструватися <ChevronRight size={17} />
                </Link>
              )}
              <Link to={`/events/${ev0.id}`} className="btn btn--clay">Деталі</Link>
            </div>
          </article>

          {/* Secondary event cards */}
          {upcomingEvents.length > 1 && (
            <div className="bev-grid">
              {upcomingEvents.slice(1, 3).map(ev => {
                const dEv = new Date(ev.date)
                const regEv = ev.registrations[0]
                return (
                  <Link key={ev.id} to={`/events/${ev.id}`} className="bev">
                    <div className="bev__media">
                      {ev.coverImageUrl
                        ? <img src={ev.coverImageUrl} alt={ev.title} />
                        : <Star size={52} style={{ color: 'rgba(176,107,126,.15)' }} />
                      }
                      <div className="bev__date"><b>{dEv.getDate()}</b><span>{MONTHS[dEv.getMonth()]}</span></div>
                    </div>
                    <div className="bev__body">
                      <div className="bev__title">{ev.title}</div>
                      {ev.description && (
                        <p className="bev__desc">{ev.description.length > 100 ? ev.description.slice(0,100)+'…' : ev.description}</p>
                      )}
                      <div className="bev__meta">
                        {ev.startTime && <span><Clock size={13} />{ev.startTime}{ev.endTime ? `–${ev.endTime}` : ''}</span>}
                        <span><User size={13} />{ev.organizer.firstName} {ev.organizer.lastName}</span>
                      </div>
                      <div className="bev__foot">
                        <span className="bev__price">{ev.price === 0 ? 'Безкоштовно' : <>{ev.price} <span style={{ fontSize: 13, fontWeight: 700 }}>{ev.currency}</span></>}</span>
                        {regEv ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: regEv.status === 'CONFIRMED' ? 'var(--sage-deep)' : 'var(--terra)' }}>
                            {regEv.status === 'CONFIRMED' ? '✓ Підтверджено' : 'Зареєстровано'}
                          </span>
                        ) : (
                          <span className="btn btn--clay" style={{ padding: '9px 18px', fontSize: 13.5 }}>Деталі</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════════════════════
          3. GROUP SUPERVISIONS + FREE SLOTS
         ══════════════════════════════════════ */}
      <section id="supervisions-section" className="dgrid-2" style={{ marginBottom: 32 }}>

        {/* Group supervisions */}
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <div><span className="panel__kicker">Навчання</span><h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0 }}>Групові супервізії</h3></div>
            <Link to="/supervisions" className="dlink">Усі <ChevronRight size={14} /></Link>
          </div>
          {activeGroups.length === 0
            ? <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 16 }}>Немає активних групових супервізій ♡</p>
            : activeGroups.map(g => {
                const { day, month } = dateParts(g.scheduledDate)
                const spill = g.status === 'WAITING_FOR_CASE' ? 'spill spill--seek' : 'spill spill--open'
                return (
                  <Link key={g.id} to={`/group-supervisions/${g.id}`} className="gsv">
                    <div className="gsv__top">
                      <div className="gsv__date"><b>{day}</b><span>{month}</span></div>
                      <div className="gsv__title">{g.title}</div>
                    </div>
                    <div className="gsv__foot">
                      <span className="gsv__meta"><Clock size={13} />{g.scheduledTime}–{endTime(g.scheduledTime, g.duration)}</span>
                      <span className="gsv__meta"><User size={13} />{g.supervisor.firstName} {g.supervisor.lastName}</span>
                      <span className={spill} style={{ marginLeft: 'auto' }}>{GSV_LABEL[g.status] || g.status}</span>
                    </div>
                  </Link>
                )
              })
          }
        </div>

        {/* Free slots */}
        <div className="panel">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
            <div><span className="panel__kicker">Супервізія</span><h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0 }}>Вільні слоти</h3></div>
            <Link to="/slots" className="dlink">Усі <ChevronRight size={14} /></Link>
          </div>
          {availableSlots.length === 0
            ? <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 16 }}>Поки немає доступних слотів ♡</p>
            : availableSlots.map(slot => {
                const { day, month } = dateParts(slot.date)
                return (
                  <div key={slot.id} className="srow">
                    <div className="sdate"><b>{day}</b><span>{month}</span></div>
                    <div className="srow__main">
                      <span className="slot-time">{slot.time}</span>
                      <div className="srow__sub"><span className="dmeta"><User size={13} />{slot.supervisor.firstName} {slot.supervisor.lastName}</span></div>
                    </div>
                    <Link to="/slots" className="btn btn--clay" style={{ padding: '9px 16px', fontSize: 13, flexShrink: 0 }}>Обрати</Link>
                  </div>
                )
              })
          }
        </div>
      </section>

      {/* ══════════════════════════════════════
          4. THERAPIST REQUESTS
         ══════════════════════════════════════ */}
      {therapistRequests.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="hm-head">
            <div>
              <h2>Пошук терапевта</h2>
              <p className="sub">Колеги шукають, кому передати клієнта — можливо, це ви</p>
            </div>
            <Link to="/therapist-requests" className="dlink">Усі записи <ChevronRight size={14} /></Link>
          </div>
          <div className="dgrid-2">
            {therapistRequests.slice(0, 2).map(req => (
              <Link key={req.id} to={`/therapist-requests/${req.id}`} className="hreq">
                <div className="hreq__head">
                  <span className="hreq__name">{req.title}</span>
                  {req.therapyFormats?.includes('INDIVIDUAL') && <span className="hreq__tag tag-ind">Індивідуальна</span>}
                  {req.therapyFormats?.includes('FAMILY')     && <span className="hreq__tag tag-fam">Сімейна</span>}
                  {req.therapyFormats?.includes('COUPLE')     && <span className="hreq__tag tag-adult">Пара</span>}
                  <span className="hreq__time">{format(new Date(req.createdAt), 'd MMM', { locale: uk })}</span>
                </div>
                <p className="hreq__need">{req.description.length > 160 ? req.description.slice(0,160)+'…' : req.description}</p>
                <div className="hreq__foot">
                  <span className="hreq__resp">
                    {req._count.responses === 0 ? 'Поки без відгуків' : `${req._count.responses} ${req._count.responses === 1 ? 'відгук' : req._count.responses < 5 ? 'відгуки' : 'відгуків'}`}
                  </span>
                  <span className="btn btn--primary" style={{ padding: '9px 18px', fontSize: 13.5 }}>Відгукнутися</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          5. ARTICLES / COMMUNITY POSTS
         ══════════════════════════════════════ */}
      {communityPreviews.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="hm-head">
            <div>
              <h2>Зі спільноти ЕФТ</h2>
              <p className="sub">Досвід, роздуми та практики від колег</p>
            </div>
            <Link to="/community" className="dlink">Усі публікації <ChevronRight size={14} /></Link>
          </div>
          <div className="art-grid">
            {communityPreviews.slice(0, 2).map(post => {
              const meta = POST_META[post.type] || POST_META.REFLECTION
              const initials = `${post.author.firstName[0]}${post.author.lastName[0]}`
              return (
                <Link key={post.id} to="/community" state={{ scrollTo: post.id }} className="art">
                  <div className="art__media" style={{ background: meta.bg }}>
                    <span className="art__tag">{meta.label}</span>
                  </div>
                  <div className="art__body">
                    <div className="art__title">{post.title || post.content.slice(0, 60)}</div>
                    {post.content && (
                      <p className="art__excerpt">{post.content.length > 140 ? post.content.slice(0,140)+'…' : post.content}</p>
                    )}
                    <div className="art__by">
                      <span className="art__av" style={{ background: 'linear-gradient(135deg,#E0A9B6,#C4778C)' }}>{initials}</span>
                      <div>
                        <div className="art__author">{post.author.firstName} {post.author.lastName}</div>
                        <div className="art__role">Учасник спільноти</div>
                      </div>
                    </div>
                    <button className="art__more">Читати далі <ChevronRight size={14} /></button>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════
          6. COMMUNITY BAND + DICTIONARY
         ══════════════════════════════════════ */}
      <section className="dgrid-2 dgrid-2--wide" style={{ marginBottom: 32 }}>

        {/* Community cband */}
        <div className="cband">
          <span className="cband__kicker">♡ Спільнота ЕФТ</span>
          <h3>Думки, питання та підтримка</h3>
          <p className="cband__desc">Натхнення і тепло від спільноти терапевтів</p>
          <div className="cfeed">
            {communityPreviews.map((post) => {
              const meta = POST_META[post.type] || POST_META.REFLECTION
              return (
                <div key={post.id} className="cfeed__item">
                  <div style={{ flex: 1 }}>
                    <span className="cfeed__cat" style={{ color: meta.dot }}>{meta.label}</span>
                    <h4>{post.title || post.content.slice(0, 60)}</h4>
                  </div>
                  <span className="cfeed__author">{post.author.firstName} {post.author.lastName[0]}.</span>
                </div>
              )
            })}
          </div>
          <Link to="/community" className="cband__btn">Перейти до спільноти ♡</Link>
        </div>

        {/* Dictionary panel */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
            <div><span className="panel__kicker">Словник</span><h3 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, margin: 0 }}>Фраза дня ♡</h3></div>
            <Link to="/dictionary" className="dlink">Усі <ChevronRight size={14} /></Link>
          </div>

          {phrases.length === 0
            ? <p style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', color: 'var(--ink-3)', fontSize: 16 }}>Словник ще порожній ♡</p>
            : phrases.slice(0, 2).map(phrase => (
                <div key={phrase.id} className="phrase">
                  <p>«{phrase.text}»<cite>— {phrase.author.firstName} {phrase.author.lastName}</cite></p>
                  <button onClick={() => toggleSave(phrase)} className={`phrase__heart${phrase.savedByMe ? ' is-on' : ''}`} aria-label={phrase.savedByMe ? 'Видалити' : 'Зберегти'}>
                    <Heart size={18} fill={phrase.savedByMe ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))
          }

          <Link to="/profile#eft-dictionary" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 'var(--r)', background: 'var(--blush)', marginTop: 10, textDecoration: 'none' }}>
            <span style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--surface)', boxShadow: 'var(--clay-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6A8C9A', flexShrink: 0 }}>
              <BookOpen size={18} />
            </span>
            <div style={{ flex: 1 }}>
              <b style={{ fontSize: 14.5, color: '#6A8C9A', display: 'block' }}>Мій словник ЕФТ</b>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Ваші терміни, фрази та визначення</span>
            </div>
            <ChevronRight size={17} style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════
          7. REMEMBER
         ══════════════════════════════════════ */}
      <div className="remember">
        <img
          src="/illustrations/therapist-duo.png"
          alt=""
          style={{ width: 130, height: 120, objectFit: 'cover', borderRadius: 'var(--r-lg)', boxShadow: 'var(--clay-sm)', flexShrink: 0 }}
        />
        <div>
          <h3 className="remember__title">Пам'ятай ♡</h3>
          <div className="remember__lines">
            Ти робиш важливу справу.<br/>
            Твоя присутність має значення.<br/>
            Ти допомагаєш іншим знаходити себе через зв'язок.
          </div>
        </div>
      </div>

    </Layout>
  )
}
