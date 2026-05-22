import { Resend } from 'resend'
import { format } from 'date-fns'
import { uk } from 'date-fns/locale'

const FROM = process.env.EMAIL_FROM || 'OBIYMU EFT Space <onboarding@resend.dev>'

function getResend(): Resend {
  return new Resend(process.env.RESEND_API_KEY)
}

function isConfigured(): boolean {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY не налаштовано — листи не відправляються')
    return false
  }
  return true
}

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна · Подання випадку',
  INDIVIDUAL_LISTENER: 'Індивідуальна · Слухач',
  GROUP_PRESENTER: 'Групова · Подання випадку',
  GROUP_LISTENER: 'Групова · Слухач',
}

const appUrl = () => process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InfoRow { icon: string; label: string; value: string }

interface TemplateProps {
  greeting: string
  subtitle: string
  title?: string
  titleSub?: string
  titleIcon?: string
  infoRows?: InfoRow[]
  content?: string
  buttonText?: string
  buttonUrl?: string
  illustrationUrl?: string
  supportNote?: string
  footerDisclaimer?: string
}

// ─── Main template ────────────────────────────────────────────────────────────

function emailTemplate(props: TemplateProps): string {
  const {
    greeting,
    subtitle,
    title,
    titleSub = 'Деталі нижче.',
    titleIcon = '👤',
    infoRows,
    content,
    buttonText,
    buttonUrl,
    illustrationUrl,
    supportNote = 'Якщо у вас виникнуть запитання — ми з радістю допоможемо.',
    footerDisclaimer = 'Ви отримали цей лист, тому що є учасником спільноти OBIYMU EFT Space.',
  } = props

  const illustrationCell = illustrationUrl
    ? `<td width="100" valign="top" style="padding-left:20px;">
        <img src="${illustrationUrl}" alt="" width="90"
             style="display:block;border:0;outline:none;opacity:0.85;" />
      </td>`
    : ''

  const infoBlock = infoRows ? `
    <div style="background:#F8F5F2;border-radius:14px;padding:20px 24px;margin-bottom:28px;">

      ${title ? `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid #EDE8E3;">
        <tr>
          <td width="44" valign="middle">
            <div style="width:36px;height:36px;background:#C4856A;border-radius:50%;
                        text-align:center;line-height:36px;font-size:16px;color:#fff;">
              ${titleIcon}
            </div>
          </td>
          <td valign="middle" style="padding-left:12px;">
            <div style="font-weight:600;color:#3D3530;font-size:15px;
                        font-family:Georgia,serif;">${title}</div>
            <div style="color:#A89E98;font-size:13px;margin-top:2px;">${titleSub}</div>
          </td>
        </tr>
      </table>` : ''}

      ${infoRows.map(r => `
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="border-bottom:1px solid #EDE8E3;">
        <tr>
          <td style="padding:10px 0;color:#7A6E68;font-size:14px;
                     font-family:Georgia,serif;">
            ${r.icon}&nbsp; ${r.label}
          </td>
          <td style="padding:10px 0;color:#3D3530;font-size:14px;
                     font-weight:600;text-align:right;font-family:Georgia,serif;">
            ${r.value}
          </td>
        </tr>
      </table>`).join('')}
    </div>` : ''

  const contentBlock = content
    ? `<div style="color:#7A6E68;font-size:15px;line-height:1.7;
                   margin-bottom:24px;font-family:Georgia,serif;">${content}</div>`
    : ''

  const buttonBlock = buttonText && buttonUrl
    ? `<div style="text-align:center;margin:32px 0 8px;">
        <a href="${buttonUrl}"
           style="background:#C4856A;color:#ffffff;padding:16px 48px;
                  border-radius:50px;text-decoration:none;font-size:16px;
                  font-weight:500;display:inline-block;letter-spacing:0.5px;
                  font-family:Georgia,serif;">
          ${buttonText} →
        </a>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>OBIYMU EFT Space</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F4;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;font-family:Georgia,serif;">

  <!-- Logo -->
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:32px;font-weight:700;color:#C4856A;letter-spacing:4px;">
      OBIYMU
    </div>
    <div style="font-size:11px;color:#A89E98;letter-spacing:3px;margin-top:2px;">
      EFT Space
    </div>
  </div>

  <!-- Main card -->
  <div style="background:#ffffff;border-radius:20px;padding:40px 36px 32px;
              margin-bottom:16px;">

    <!-- Greeting + illustration -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:28px;">
      <tr>
        <td valign="top">
          <h1 style="font-family:Georgia,serif;font-size:26px;color:#3D3530;
                     margin:0 0 12px;font-weight:400;line-height:1.3;">
            ${greeting} ♡
          </h1>
          <p style="color:#7A6E68;font-size:15px;line-height:1.7;margin:0;
                    font-family:Georgia,serif;">
            ${subtitle}
          </p>
        </td>
        ${illustrationCell}
      </tr>
    </table>

    ${infoBlock}
    ${contentBlock}
    ${buttonBlock}
  </div>

  <!-- Support block -->
  <div style="background:#ffffff;border-radius:20px;padding:20px 28px;
              margin-bottom:16px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="36" valign="top" style="padding-right:14px;font-size:22px;
                                           color:#C4856A;line-height:1;">♡</td>
        <td valign="top">
          <div style="font-weight:600;color:#3D3530;font-size:15px;
                      margin-bottom:4px;font-family:Georgia,serif;">
            Ми поруч на кожному кроці.
          </div>
          <div style="color:#7A6E68;font-size:13px;line-height:1.6;
                      font-family:Georgia,serif;">
            ${supportNote}
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Footer -->
  <div style="background:#F2EBE3;border-radius:20px;padding:24px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="margin-bottom:16px;">
      <tr>
        <td valign="top">
          <div style="font-size:16px;font-weight:700;color:#C4856A;
                      letter-spacing:2px;font-family:Georgia,serif;">
            OBIYMU
          </div>
          <div style="font-size:10px;color:#A89E98;letter-spacing:2px;
                      margin-top:2px;">
            EFT Space
          </div>
        </td>
        <td valign="top" style="text-align:center;">
          <div style="color:#7A6E68;font-size:13px;font-style:italic;
                      line-height:1.6;font-family:Georgia,serif;">
            З повагою та турботою,<br/>
            команда OBIYMU EFT Space ♡
          </div>
        </td>
        <td valign="top" width="80" style="text-align:right;">
          <span style="display:inline-block;width:30px;height:30px;
                       background:#C4856A;border-radius:8px;text-align:center;
                       line-height:30px;font-size:15px;">📷</span>
          <span style="display:inline-block;width:30px;height:30px;
                       background:#C4856A;border-radius:8px;text-align:center;
                       line-height:30px;font-size:15px;margin-left:6px;">✈️</span>
        </td>
      </tr>
    </table>
    <div style="border-top:1px solid #E8DDD0;padding-top:16px;text-align:center;">
      <p style="color:#A89E98;font-size:11px;margin:0;line-height:1.7;
                font-family:Georgia,serif;">
        ${footerDisclaimer}<br/>
        <a href="${appUrl()}" style="color:#C4856A;text-decoration:none;">
          obiymu.com
        </a>
      </p>
    </div>
  </div>

</div>
</body>
</html>`
}

// ─── Email functions ──────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  email: string,
  firstName: string,
  _password: string,
  createdAt?: Date,
): Promise<void> {
  if (!isConfigured()) return
  const dateStr = format(createdAt ?? new Date(), 'd MMMM yyyy', { locale: uk })
  const { error } = await getResend().emails.send({
    from: FROM,
    to: email,
    subject: 'Ласкаво просимо до OBIYMU EFT Space 🤍',
    html: emailTemplate({
      greeting: `Вітаємо, ${firstName}!`,
      subtitle: 'Дякуємо за довіру та реєстрацію в OBIYMU EFT Space. Ми раді, що ви з нами на шляху до змін та зцілення.',
      title: 'Ваш акаунт успішно створено',
      titleSub: 'Тепер ви можете увійти у свій простір.',
      titleIcon: '👤',
      infoRows: [
        { icon: '✉️', label: 'Електронна пошта', value: email },
        { icon: '📅', label: 'Дата реєстрації', value: dateStr },
      ],
      buttonText: 'Увійти у свій простір',
      buttonUrl: appUrl(),
      illustrationUrl: `${appUrl()}/illustrations/chairs.png`,
      footerDisclaimer: 'Ви отримали цей лист, тому що зареєструвались на сайті obiymu.com\nЯкщо ви не створювали акаунт — проігноруйте цей лист.',
    }),
  })
  if (error) console.error('[email] sendWelcomeEmail failed:', error)
  else console.log(`[email] welcome sent → ${email}`)
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
    subject: `Нова заявка на супервізію — ${therapistName}`,
    html: emailTemplate({
      greeting: 'Нова заявка на супервізію',
      subtitle: `Терапевт <strong>${therapistName}</strong> подав(ла) заявку на супервізію.`,
      title: 'Деталі супервізії',
      titleSub: 'Будь ласка, підтвердіть або відхиліть заявку.',
      titleIcon: '📋',
      infoRows: [
        { icon: '📅', label: 'Дата', value: date },
        { icon: '🔹', label: 'Тип', value: TYPE_LABELS[type] ?? type },
      ],
      buttonText: 'Переглянути заявку',
      buttonUrl: `${appUrl()}/supervisor`,
      illustrationUrl: `${appUrl()}/illustrations/chairs.png`,
    }),
  }).catch(console.error)
}

export async function sendSupervisionApproved(
  therapistEmail: string,
  date: string,
  type: string,
  supervisorName?: string,
): Promise<void> {
  if (!isConfigured()) return
  const rows: InfoRow[] = []
  if (supervisorName) rows.push({ icon: '👤', label: 'Супервізор', value: supervisorName })
  rows.push({ icon: '📅', label: 'Дата', value: date })
  rows.push({ icon: '🔹', label: 'Тип', value: TYPE_LABELS[type] ?? type })

  await getResend().emails.send({
    from: FROM,
    to: therapistEmail,
    subject: '✅ Супервізію підтверджено — OBIYMU EFT Space',
    html: emailTemplate({
      greeting: 'Супервізію підтверджено ✓',
      subtitle: 'Вітаємо! Ваша заявка на супервізію була успішно підтверджена.',
      title: 'Деталі супервізії',
      titleSub: 'Деталі підтвердженої сесії.',
      titleIcon: '✅',
      infoRows: rows,
      buttonText: 'Переглянути мої супервізії',
      buttonUrl: `${appUrl()}/supervisions`,
      illustrationUrl: `${appUrl()}/illustrations/chairs.png`,
    }),
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
    subject: 'Щодо вашої заявки на супервізію — OBIYMU EFT Space',
    html: emailTemplate({
      greeting: 'Щодо вашої заявки',
      subtitle: 'На жаль, заявка на супервізію була відхилена. Зверніться до супервізора для уточнення деталей.',
      title: 'Деталі супервізії',
      titleSub: 'Відхилена заявка.',
      titleIcon: '📋',
      infoRows: [
        { icon: '📅', label: 'Дата', value: date },
        { icon: '🔹', label: 'Тип', value: TYPE_LABELS[type] ?? type },
      ],
      buttonText: 'Переглянути супервізії',
      buttonUrl: `${appUrl()}/supervisions`,
    }),
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
    subject: `Новий запис на слот — ${therapistName}`,
    html: emailTemplate({
      greeting: 'Новий запис на слот',
      subtitle: `Терапевт <strong>${therapistName}</strong> забронював(ла) ваш слот супервізії.`,
      title: 'Деталі запису',
      titleSub: 'Слот успішно заброньовано.',
      titleIcon: '📅',
      infoRows: [
        { icon: '📅', label: 'Дата', value: date },
        { icon: '🕐', label: 'Час', value: time },
      ],
      buttonText: 'Переглянути в панелі',
      buttonUrl: `${appUrl()}/supervisor`,
      illustrationUrl: `${appUrl()}/illustrations/chairs.png`,
    }),
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
    subject: 'Слот супервізії скасовано — OBIYMU EFT Space',
    html: emailTemplate({
      greeting: 'Слот скасовано',
      subtitle: `На жаль, супервізор <strong>${supervisorName}</strong> скасував(ла) слот, який ви забронювали.`,
      infoRows: [
        { icon: '📅', label: 'Дата', value: date },
        { icon: '🕐', label: 'Час', value: time },
      ],
      supportNote: 'Оберіть інший слот або зверніться до супервізора напряму.',
    }),
  }).catch(console.error)
}

export async function sendSeminarRequest(
  adminEmail: string,
  therapistName: string,
  seminarTitle: string,
  hours?: number,
): Promise<void> {
  if (!isConfigured()) return
  const rows: InfoRow[] = [
    { icon: '📚', label: 'Назва семінару', value: seminarTitle },
  ]
  if (hours) rows.push({ icon: '🕐', label: 'Кількість годин', value: `${hours} год` })

  await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Новий семінар на підтвердження — ${therapistName}`,
    html: emailTemplate({
      greeting: 'Новий семінар на підтвердження',
      subtitle: `Терапевт <strong>${therapistName}</strong> додав(ла) семінар для підтвердження.`,
      title: 'Деталі семінару',
      titleSub: 'Будь ласка, перевірте та підтвердіть.',
      titleIcon: '📚',
      infoRows: rows,
      buttonText: 'Переглянути в адмін панелі',
      buttonUrl: `${appUrl()}/admin`,
      illustrationUrl: `${appUrl()}/illustrations/books-coffee.png`,
    }),
  }).catch(console.error)
}

export async function sendAdminNewUserNotification(
  adminEmail: string,
  therapistName: string,
  therapistEmail: string,
  eftLevel: string,
): Promise<void> {
  if (!isConfigured()) return
  await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Нова реєстрація — ${therapistName}`,
    html: emailTemplate({
      greeting: 'Новий учасник спільноти',
      subtitle: 'На платформі OBIYMU EFT Space зареєструвався новий терапевт.',
      title: 'Дані учасника',
      titleSub: 'Новий обліковий запис.',
      titleIcon: '👤',
      infoRows: [
        { icon: '👤', label: "Ім'я", value: therapistName },
        { icon: '✉️', label: 'Email', value: therapistEmail },
        { icon: '🎓', label: 'Рівень ЕФТ', value: eftLevel },
      ],
      buttonText: 'Переглянути в адмін панелі',
      buttonUrl: `${appUrl()}/admin`,
    }),
  }).catch(console.error)
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
    subject: `Новий захід: ${title}`,
    html: emailTemplate({
      greeting: `${firstName}, новий захід для вас!`,
      subtitle: 'Спільнота OBIYMU EFT Space запрошує вас на новий захід.',
      title,
      titleSub: 'Деталі заходу.',
      titleIcon: '🗓',
      infoRows: [
        { icon: '📅', label: 'Дата', value: date },
        { icon: '💰', label: 'Вартість', value: price === 0 ? 'Безкоштовно' : `${price} грн` },
      ],
      buttonText: 'Зареєструватись на захід',
      buttonUrl: `${appUrl()}/my-events`,
      illustrationUrl: `${appUrl()}/illustrations/chairs.png`,
    }),
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
    html: emailTemplate({
      greeting: `${firstName}, дякуємо за реєстрацію!`,
      subtitle: `Ви зареєструвались на захід <strong>${title}</strong>. Нижче — реквізити для оплати участі.`,
      content: `<div style="background:#F8F5F2;border-radius:12px;padding:20px;
                             white-space:pre-wrap;font-size:14px;color:#3D3530;
                             line-height:1.7;font-family:Georgia,serif;">
                  ${paymentInstructions}
                </div>
                <p style="font-size:13px;color:#A89E98;margin-top:12px;
                          font-family:Georgia,serif;">
                  Після оплати завантажте квитанцію у розділі «Мої заходи».
                </p>`,
      buttonText: 'Перейти до Мої заходи',
      buttonUrl: `${appUrl()}/my-events`,
    }),
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
    html: emailTemplate({
      greeting: 'Квитанція завантажена',
      subtitle: 'Учасник завантажив(ла) квитанцію про оплату і очікує підтвердження участі.',
      title: 'Деталі заявки',
      titleSub: 'Перевірте та підтвердіть.',
      titleIcon: '📎',
      infoRows: [
        { icon: '👤', label: 'Учасник', value: participantName },
        { icon: '📌', label: 'Захід', value: title },
      ],
      buttonText: 'Переглянути заявки',
      buttonUrl: `${appUrl()}/supervisor`,
    }),
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
  const presentationRow: InfoRow[] = presentationUrl
    ? [{ icon: '📎', label: 'Презентація', value: `<a href="${presentationUrl}" style="color:#C4856A;">Завантажити</a>` }]
    : []

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `✅ Участь підтверджено: ${title}`,
    html: emailTemplate({
      greeting: `${firstName}, участь підтверджено! ✓`,
      subtitle: `Ваша участь у заході <strong>${title}</strong> підтверджена. Нижче — посилання для підключення.`,
      title: 'Посилання для входу',
      titleSub: 'Збережіть ці дані.',
      titleIcon: '🎥',
      infoRows: [
        { icon: '🔗', label: 'Zoom', value: `<a href="${zoomLink}" style="color:#C4856A;word-break:break-all;">${zoomLink}</a>` },
        ...presentationRow,
      ],
      buttonText: 'Мої заходи',
      buttonUrl: `${appUrl()}/my-events`,
    }),
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
    html: emailTemplate({
      greeting: `${firstName}, нагадуємо про захід`,
      subtitle: `Незабаром відбудеться захід, на який ви зареєструвались.`,
      title,
      titleSub: 'Не пропустіть!',
      titleIcon: '⏰',
      infoRows: [
        { icon: '📅', label: 'Дата', value: date },
      ],
      buttonText: 'Переглянути деталі',
      buttonUrl: `${appUrl()}/my-events`,
      illustrationUrl: `${appUrl()}/illustrations/chairs.png`,
    }),
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
    subject: 'Відновлення пароля — OBIYMU EFT Space',
    html: emailTemplate({
      greeting: `${firstName}, відновлення пароля`,
      subtitle: 'Ви запросили відновлення пароля. Посилання дійсне <strong>1 годину</strong>.',
      content: '<p style="color:#A89E98;font-size:13px;font-family:Georgia,serif;">Якщо ви не запитували відновлення пароля — просто проігноруйте цей лист.</p>',
      buttonText: 'Відновити пароль',
      buttonUrl: resetLink,
      footerDisclaimer: 'Ви отримали цей лист, тому що запросили відновлення пароля на obiymu.com',
    }),
  })
  if (error) console.error('[email] sendPasswordResetEmail failed:', error)
  else console.log(`[email] password reset sent → ${email}`)
}
