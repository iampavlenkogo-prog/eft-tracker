import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'Обійми ЕФТ <onboarding@resend.dev>'

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

function emailTemplate(content: string, buttonText?: string, buttonUrl?: string): string {
  const button = buttonText && buttonUrl
    ? `<div style="text-align:center;margin:32px 0;">
        <a href="${buttonUrl}"
           style="background:#C4856A;color:#fff;padding:14px 32px;border-radius:12px;
                  text-decoration:none;font-size:15px;font-weight:500;display:inline-block;
                  font-family:Inter,Arial,sans-serif;">
          ${buttonText}
        </a>
      </div>`
    : ''

  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;background:#FAFAF8;">

    <div style="background:#C4856A;padding:32px;text-align:center;border-radius:16px 16px 0 0;">
      <div style="color:#fff;font-size:28px;font-weight:300;letter-spacing:2px;">
        Обійми ЕФТ
      </div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;">
        Спільнота терапевтів
      </div>
    </div>

    <div style="background:#fff;padding:40px 32px;">
      ${content}
      ${button}
    </div>

    <div style="background:#F2EBE3;padding:20px;text-align:center;border-radius:0 0 16px 16px;">
      <div style="color:#A89E98;font-size:12px;">
        Обійми ЕФТ · З турботою про ваш розвиток
      </div>
      <div style="color:#C4856A;font-size:11px;margin-top:4px;">♡</div>
    </div>

  </div>`
}

function row(label: string, value: string): string {
  return `<p style="margin:0 0 10px;font-size:14px;color:#78716c;">
    <span style="color:#A89E98;">${label}:</span>&nbsp;<strong style="color:#44403c;">${value}</strong>
  </p>`
}

const appUrl = () => process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173'

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
    subject: `📋 Нова заявка на супервізію — Обійми ЕФТ`,
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Нова заявка на супервізію</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         Терапевт <strong>${therapistName}</strong> подав(ла) заявку на супервізію.
       </p>
       ${row('📅 Дата', date)}
       ${row('🔹 Тип', TYPE_LABELS[type] ?? type)}
       <p style="margin:20px 0 0;font-size:14px;color:#A89E98;">Будь ласка, підтвердіть або відхиліть заявку.</p>`,
      'Переглянути заявку',
      `${appUrl()}/supervisor`,
    ),
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
    subject: `✅ Супервізію підтверджено — Обійми ЕФТ`,
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Супервізія підтверджена!</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         Ваша супервізія підтверджена. Дякуємо за вашу відданість розвитку.
       </p>
       ${row('📅 Дата', date)}
       ${row('🔹 Тип', TYPE_LABELS[type] ?? type)}`,
      'Переглянути мої супервізії',
      `${appUrl()}/supervisions`,
    ),
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
    subject: `❌ Супервізія відхилена — Обійми ЕФТ`,
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">На жаль, супервізія відхилена</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         На жаль, ваша супервізія була відхилена.
       </p>
       ${row('📅 Дата', date)}
       ${row('🔹 Тип', TYPE_LABELS[type] ?? type)}
       <p style="margin:20px 0 0;font-size:14px;color:#A89E98;">Зверніться до супервізора для уточнення деталей.</p>`,
      'Переглянути мої супервізії',
      `${appUrl()}/supervisions`,
    ),
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
    subject: `📅 Слот заброньовано — Обійми ЕФТ`,
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Новий запис на слот</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         Терапевт <strong>${therapistName}</strong> забронював(ла) ваш слот.
       </p>
       ${row('📅 Дата', date)}
       ${row('🕐 Час', time)}`,
      'Переглянути в панелі',
      `${appUrl()}/supervisor`,
    ),
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
    subject: `Слот супервізії скасовано — Обійми ЕФТ`,
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Слот скасовано</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         На жаль, супервізор <strong>${supervisorName}</strong> скасував(ла) слот, який ви забронювали.
       </p>
       ${row('📅 Дата', date)}
       ${row('🕐 Час', time)}
       <p style="margin:20px 0 0;font-size:14px;color:#A89E98;">Зверніться до супервізора або оберіть інший слот.</p>`,
    ),
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
    subject: `📚 Новий семінар на підтвердження — Обійми ЕФТ`,
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Новий семінар на перевірку</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         Терапевт <strong>${therapistName}</strong> додав(ла) семінар на підтвердження.
       </p>
       ${row('📖 Назва', seminarTitle)}
       <p style="margin:20px 0 0;font-size:14px;color:#A89E98;">Будь ласка, перевірте та підтвердіть.</p>`,
      'Переглянути в адмін панелі',
      `${appUrl()}/admin`,
    ),
  }).catch(console.error)
}

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  password: string,
): Promise<void> {
  if (!isConfigured()) return
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Ласкаво просимо до Обійми ЕФТ 🤍',
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Вітаємо, ${firstName}!</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         Ви успішно зареєструвались у спільноті терапевтів Обійми ЕФТ.
       </p>
       <div style="background:#F9F4F1;border-radius:12px;padding:20px 24px;margin:0 0 8px;">
         <p style="margin:0 0 6px;font-size:12px;color:#A89E98;text-transform:uppercase;letter-spacing:0.8px;">Ваші дані для входу</p>
         <p style="margin:0 0 10px;font-size:14px;color:#78716c;">
           📧 <span style="color:#A89E98;">Логін:</span>&nbsp;<strong style="color:#3D2B1F;">${email}</strong>
         </p>
         <p style="margin:0;font-size:14px;color:#78716c;">
           🔑 <span style="color:#A89E98;">Пароль:</span>&nbsp;<strong style="color:#3D2B1F;">${password}</strong>
         </p>
       </div>
       <p style="margin:12px 0 0;font-size:12px;color:#A89E98;">Збережіть ці дані у надійному місці.</p>`,
      'Увійти до додатку',
      appUrl(),
    ),
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
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Новий захід: ${title} — Обійми ЕФТ`,
    html: emailTemplate(
      `<p style="margin:0 0 4px;font-size:12px;color:#A89E98;text-transform:uppercase;letter-spacing:1px;">Анонс заходу</p>
       <h2 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#3D2B1F;">${title}</h2>
       <p style="margin:0 0 20px;font-size:15px;color:#78716c;line-height:1.6;">
         Вітаємо, ${firstName}! Опублікований новий захід спільноти ЕФТ-терапевтів.
       </p>
       ${row('📅 Дата', date)}
       ${row('💰 Вартість', price === 0 ? 'Безкоштовно' : `${price} грн`)}`,
      'Зареєструватись на захід',
      `${appUrl()}/dashboard`,
    ),
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
    html: emailTemplate(
      `<p style="margin:0 0 4px;font-size:12px;color:#A89E98;text-transform:uppercase;letter-spacing:1px;">Деталі оплати</p>
       <h2 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#3D2B1F;">${title}</h2>
       <p style="margin:0 0 20px;font-size:15px;color:#78716c;line-height:1.6;">
         Вітаємо, ${firstName}! Дякуємо за реєстрацію. Нижче — реквізити для оплати участі:
       </p>
       <div style="background:#F9F4F1;border:1px solid #E8DDD0;border-radius:12px;padding:20px;
                   margin:0 0 20px;white-space:pre-wrap;font-size:14px;color:#44403c;line-height:1.7;">
         ${paymentInstructions}
       </div>
       <p style="font-size:13px;color:#A89E98;">
         Після оплати завантажте квитанцію у розділі «Мої заходи».
       </p>`,
      'Перейти до Мої заходи',
      `${appUrl()}/my-events`,
    ),
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
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Квитанція завантажена</h2>
       <p style="margin:0 0 24px;font-size:15px;color:#78716c;line-height:1.6;">
         Учасник завантажив(ла) квитанцію про оплату і очікує підтвердження участі.
       </p>
       ${row('👤 Учасник', participantName)}
       ${row('📌 Захід', title)}
       <p style="margin:20px 0 0;font-size:14px;color:#A89E98;">Перевірте квитанцію та підтвердіть участь.</p>`,
      'Переглянути заявки',
      `${appUrl()}/supervisor`,
    ),
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
  const presentation = presentationUrl
    ? `<p style="margin:12px 0 0;font-size:14px;color:#78716c;">
         📎 <a href="${presentationUrl}" style="color:#C4856A;">Завантажити презентацію</a>
       </p>`
    : ''
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `✅ Участь підтверджено: ${title}`,
    html: emailTemplate(
      `<p style="margin:0 0 4px;font-size:12px;color:#A89E98;text-transform:uppercase;letter-spacing:1px;">Участь підтверджено ✓</p>
       <h2 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#3D2B1F;">${title}</h2>
       <p style="margin:0 0 20px;font-size:15px;color:#78716c;line-height:1.6;">
         Вітаємо, ${firstName}! Ваша участь підтверджена. Нижче — посилання для підключення.
       </p>
       <div style="background:#F9F4F1;border:1px solid #E8DDD0;border-radius:12px;padding:20px;margin:0 0 8px;">
         <p style="margin:0 0 6px;font-size:12px;color:#A89E98;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Посилання Zoom</p>
         <a href="${zoomLink}" style="font-size:14px;color:#C4856A;word-break:break-all;">${zoomLink}</a>
       </div>
       ${presentation}`,
      'Перейти до Мої заходи',
      `${appUrl()}/my-events`,
    ),
  }).catch(console.error)
}

export async function sendEventReminder(
  email: string,
  firstName: string,
  title: string,
  date: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `⏰ Нагадування: ${title}`,
    html: emailTemplate(
      `<p style="margin:0 0 4px;font-size:12px;color:#A89E98;text-transform:uppercase;letter-spacing:1px;">Нагадування про захід</p>
       <h2 style="margin:0 0 20px;font-size:22px;font-weight:600;color:#3D2B1F;">${title}</h2>
       <p style="margin:0 0 20px;font-size:15px;color:#78716c;line-height:1.6;">
         Вітаємо, ${firstName}! Нагадуємо про наближення заходу спільноти ЕФТ-терапевтів.
       </p>
       ${row('📅 Дата', date)}`,
      'Переглянути деталі',
      `${appUrl()}/my-events`,
    ),
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
    subject: '🔑 Відновлення пароля — Обійми ЕФТ',
    html: emailTemplate(
      `<h2 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#3D2B1F;">Відновлення пароля</h2>
       <p style="margin:0 0 20px;font-size:15px;color:#78716c;line-height:1.6;">
         Привіт, ${firstName}! Ви запросили відновлення пароля.
         Посилання дійсне <strong>1 годину</strong>.
       </p>
       <p style="margin:0;font-size:13px;color:#A89E98;">
         Якщо ви не запитували відновлення пароля — просто ігноруйте цей лист.
       </p>`,
      'Відновити пароль',
      resetLink,
    ),
  })
  if (error) console.error('[email] sendPasswordResetEmail failed:', error)
  else console.log(`[email] password reset sent → ${email}`)
}
