import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'EFT Tracker <onboarding@resend.dev>'

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна • Подання випадку',
  INDIVIDUAL_LISTENER: 'Індивідуальна • Слухач',
  GROUP_PRESENTER: 'Групова • Подання випадку',
  GROUP_LISTENER: 'Групова • Слухач',
}

function isConfigured(): boolean {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY не налаштовано — листи не відправляються')
    return false
  }
  return true
}

function card(content: string): string {
  return `
  <div style="font-family:'Inter',sans-serif;max-width:560px;margin:0 auto;background:#fafaf9;padding:40px 16px;">
    <div style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 1px 4px rgba(0,0,0,.06);">
      <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#44403c;">EFT Tracker</p>
      <p style="margin:0 0 24px;font-size:13px;color:#a8a29e;font-style:italic;">Система обліку навчання</p>
      <hr style="border:none;border-top:1px solid #f5f5f4;margin:0 0 24px;">
      ${content}
    </div>
  </div>`
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 8px;font-size:14px;color:#78716c;">
    <span style="color:#a8a29e;">${label}:</span> <strong style="color:#44403c;">${value}</strong>
  </p>`
}

function blueCard(content: string): string {
  return `
  <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#EEF3FA;padding:40px 16px;">
    <div style="background:#1B3A6B;padding:26px 32px 20px;border-radius:16px 16px 0 0;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">EFT Tracker</p>
      <p style="margin:4px 0 0;font-size:11px;color:#7B9CC8;letter-spacing:1.5px;text-transform:uppercase;">Система обліку навчання</p>
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:32px;box-shadow:0 2px 12px rgba(27,58,107,.10);">
      ${content}
    </div>
    <p style="text-align:center;font-size:11px;color:#94a3b8;margin:20px 0 0;">EFT Ukraine · EFT Tracker</p>
  </div>`
}

function blueButton(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#1B3A6B;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:13px 30px;border-radius:10px;margin-top:20px;">${text}</a>`
}

export async function sendSupervisionRequest(
  supervisorEmail: string,
  therapistName: string,
  date: string,
  type: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: supervisorEmail,
    subject: `${therapistName} подав(ла) заявку на супервізію`,
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">Терапевт подав(ла) нову заявку на супервізію.</p>
      ${row('Терапевт', therapistName)}
      ${row('Дата сесії', date)}
      ${row('Тип', TYPE_LABELS[type] ?? type)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Будь ласка, підтвердіть або відхиліть заявку у панелі супервізора.</p>
    `),
  }).catch(console.error)
}

export async function sendSupervisionApproved(
  therapistEmail: string,
  date: string,
  type: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: therapistEmail,
    subject: 'Ваша заявка на супервізію підтверджена ✓',
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">Супервізор підтвердив(ла) вашу заявку.</p>
      ${row('Дата сесії', date)}
      ${row('Тип', TYPE_LABELS[type] ?? type)}
      ${row('Статус', '✓ Підтверджено')}
    `),
  }).catch(console.error)
}

export async function sendSupervisionRejected(
  therapistEmail: string,
  date: string,
  type: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: therapistEmail,
    subject: 'Заявку на супервізію відхилено',
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">На жаль, супервізор відхилив(ла) вашу заявку.</p>
      ${row('Дата сесії', date)}
      ${row('Тип', TYPE_LABELS[type] ?? type)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Зверніться до супервізора для уточнення деталей.</p>
    `),
  }).catch(console.error)
}

export async function sendSlotBooked(
  supervisorEmail: string,
  therapistName: string,
  date: string,
  time: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: supervisorEmail,
    subject: `${therapistName} забронював(ла) слот супервізії`,
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">Терапевт забронював(ла) ваш слот.</p>
      ${row('Терапевт', therapistName)}
      ${row('Дата', date)}
      ${row('Час', time)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Деталі доступні у панелі супервізора.</p>
    `),
  }).catch(console.error)
}

export async function sendSlotCancelled(
  therapistEmail: string,
  supervisorName: string,
  date: string,
  time: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: therapistEmail,
    subject: 'Слот супервізії скасовано',
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">На жаль, супервізор скасував(ла) слот, який ви забронювали.</p>
      ${row('Супервізор', supervisorName)}
      ${row('Дата', date)}
      ${row('Час', time)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Зверніться до супервізора або оберіть інший слот.</p>
    `),
  }).catch(console.error)
}

export async function sendSeminarRequest(
  adminEmail: string,
  therapistName: string,
  seminarTitle: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `${therapistName} додав(ла) новий семінар`,
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">Терапевт додав(ла) запис про семінар, що очікує підтвердження.</p>
      ${row('Терапевт', therapistName)}
      ${row('Семінар', seminarTitle)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Перевірте деталі та підтвердіть або відхиліть у панелі адміна.</p>
    `),
  }).catch(console.error)
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  password: string,
): Promise<void> {
  if (!isConfigured()) return
  const loginUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Ласкаво просимо до EFT Tracker!',
    html: blueCard(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1B3A6B;">Вітаємо, ${firstName}!</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
        Ви успішно зареєструвались у системі обліку навчання EFT.
      </p>
      <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#1B3A6B;text-transform:uppercase;letter-spacing:0.8px;">Ваші дані для входу</p>
      <div style="background:#F0F5FF;border-radius:10px;padding:18px 20px;border-left:3px solid #1B3A6B;">
        <p style="margin:0 0 10px;font-size:13px;color:#64748b;">
          <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;">Логін (email)</span>
          <strong style="font-size:15px;color:#1B3A6B;">${email}</strong>
        </p>
        <p style="margin:0;font-size:13px;color:#64748b;">
          <span style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:3px;">Пароль</span>
          <strong style="font-size:15px;color:#1B3A6B;">${password}</strong>
        </p>
      </div>
      <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">Збережіть ці дані у надійному місці.</p>
      ${blueButton('Увійти до EFT Tracker', loginUrl)}
    `),
  })
  if (error) console.error('[email] sendWelcomeEmail failed:', error)
  else console.log(`[email] welcome sent → ${email}`)
}

export async function sendEventAnnouncement(
  email: string,
  firstName: string,
  title: string,
  date: string,
  price: number,
): Promise<void> {
  if (!isConfigured()) return
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Новий захід: ${title}`,
    html: card(`
      <p style="margin:0 0 6px;font-size:13px;color:#a8a29e;text-transform:uppercase;letter-spacing:1px;">Анонс заходу</p>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#44403c;">${title}</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#78716c;">Вітаємо, ${firstName}! Опублікований новий захід спільноти EFT-терапевтів.</p>
      ${row('Дата', date)}
      ${row('Вартість', price === 0 ? 'Безкоштовно' : `${price} грн`)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Щоб зареєструватись, перейдіть на головну сторінку EFT Tracker.</p>
      <a href="${clientUrl}/dashboard" style="display:inline-block;background:#C4856A;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;margin-top:16px;">Перейти до платформи</a>
    `),
  }).catch(console.error)
}

export async function sendPaymentDetails(
  email: string,
  firstName: string,
  title: string,
  paymentInstructions: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Реквізити для оплати: ${title}`,
    html: card(`
      <p style="margin:0 0 6px;font-size:13px;color:#a8a29e;text-transform:uppercase;letter-spacing:1px;">Деталі оплати</p>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#44403c;">${title}</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#78716c;">Вітаємо, ${firstName}! Дякуємо за реєстрацію. Нижче — реквізити для оплати участі:</p>
      <div style="background:#fafaf9;border:1px solid #f5f5f4;border-radius:12px;padding:20px;margin:0 0 20px;white-space:pre-wrap;font-size:14px;color:#44403c;line-height:1.7;">${paymentInstructions}</div>
      <p style="margin:0;font-size:13px;color:#a8a29e;">Після оплати, будь ласка, завантажте квитанцію у розділі «Мої заходи» на платформі EFT Tracker.</p>
    `),
  }).catch(console.error)
}

export async function sendReceiptUploaded(
  organizerEmail: string,
  participantName: string,
  title: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: organizerEmail,
    subject: `${participantName} завантажив(ла) квитанцію — ${title}`,
    html: card(`
      <p style="margin:0 0 20px;font-size:15px;color:#44403c;">Учасник завантажив(ла) квитанцію про оплату і очікує підтвердження участі.</p>
      ${row('Учасник', participantName)}
      ${row('Захід', title)}
      <p style="margin:24px 0 0;font-size:13px;color:#a8a29e;">Перевірте квитанцію та підтвердіть участь у розділі «Заходи» на платформі.</p>
    `),
  }).catch(console.error)
}

export async function sendEventConfirmation(
  email: string,
  firstName: string,
  title: string,
  zoomLink: string,
  presentationUrl?: string | null,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Участь підтверджено: ${title}`,
    html: card(`
      <p style="margin:0 0 6px;font-size:13px;color:#a8a29e;text-transform:uppercase;letter-spacing:1px;">Участь підтверджено ✓</p>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#44403c;">${title}</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#78716c;">Вітаємо, ${firstName}! Ваша участь у заході підтверджена. Нижче — посилання для підключення:</p>
      <div style="background:#fafaf9;border:1px solid #f5f5f4;border-radius:12px;padding:20px;margin:0 0 16px;">
        <p style="margin:0 0 8px;font-size:13px;color:#a8a29e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Посилання Zoom</p>
        <a href="${zoomLink}" style="font-size:14px;color:#C4856A;word-break:break-all;">${zoomLink}</a>
      </div>
      ${presentationUrl ? `<p style="margin:0 0 8px;font-size:14px;color:#78716c;">📎 <a href="${presentationUrl}" style="color:#C4856A;">Завантажити презентацію</a></p>` : ''}
      <p style="margin:16px 0 0;font-size:13px;color:#a8a29e;">Посилання також доступне у розділі «Мої заходи» на платформі EFT Tracker.</p>
    `),
  }).catch(console.error)
}

export async function sendEventReminder(
  email: string,
  firstName: string,
  title: string,
  date: string,
): Promise<void> {
  if (!isConfigured()) return
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `⏰ Нагадування: ${title}`,
    html: card(`
      <p style="margin:0 0 6px;font-size:13px;color:#a8a29e;text-transform:uppercase;letter-spacing:1px;">Нагадування про захід</p>
      <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#44403c;">${title}</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#78716c;">Вітаємо, ${firstName}! Нагадуємо про наближення заходу спільноти EFT-терапевтів.</p>
      ${row('Дата', date)}
      <a href="${clientUrl}/dashboard" style="display:inline-block;background:#C4856A;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;margin-top:16px;">Переглянути захід</a>
    `),
  }).catch(console.error)
}

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetLink: string,
): Promise<void> {
  if (!isConfigured()) return
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Відновлення пароля EFT Tracker',
    html: blueCard(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#1B3A6B;">Відновлення пароля</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
        Привіт, ${firstName}! Ви запросили відновлення пароля для вашого облікового запису EFT Tracker.
      </p>
      <p style="margin:0 0 8px;font-size:14px;color:#475569;">
        Натисніть кнопку нижче, щоб встановити новий пароль. Посилання дійсне <strong>1 годину</strong>.
      </p>
      ${blueButton('Відновити пароль', resetLink)}
      <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
        Якщо ви не запитували відновлення пароля — просто ігноруйте цей лист. Ваш пароль не буде змінено.
      </p>
    `),
  })
  if (error) console.error('[email] sendPasswordResetEmail failed:', error)
  else console.log(`[email] password reset sent → ${email}`)
}
