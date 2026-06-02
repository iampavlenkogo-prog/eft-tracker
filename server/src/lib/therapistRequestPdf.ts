interface ResponseWithTherapist {
  presentation: string
  links: string | null
  therapist: {
    firstName: string
    lastName: string
    avatarUrl: string | null
    telegram: string | null
    email: string
  }
}

function buildHtml(responses: ResponseWithTherapist[]): string {
  const therapistCards = responses.map(r => {
    const links: string[] = r.links ? JSON.parse(r.links) : []
    const linksHtml = links.length
      ? `<div class="links">${links.map(l => `<a href="${l}" target="_blank">${l}</a>`).join('')}</div>`
      : ''
    const avatar = r.therapist.avatarUrl
      ? `<img class="avatar" src="${r.therapist.avatarUrl}" alt="${r.therapist.firstName}" />`
      : `<div class="avatar-placeholder">${r.therapist.firstName[0]}${r.therapist.lastName[0]}</div>`

    return `
      <div class="card">
        <div class="card-header">
          ${avatar}
          <div class="card-info">
            <h2>${r.therapist.firstName} ${r.therapist.lastName}</h2>
            <div class="contacts">
              ${r.therapist.email ? `<span><svg class="contact-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4h14a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z" stroke="#9B7E74" stroke-width="1.4"/><path d="M2 5l8 6 8-6" stroke="#9B7E74" stroke-width="1.4" stroke-linecap="round"/></svg>${r.therapist.email}</span>` : ''}
              ${r.therapist.telegram ? `<span><svg class="contact-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64-6.8l-3.36 15.86c-.25 1.11-1.58 1.38-2.27.48l-3.15-4.12-1.5 1.45c-.16.15-.41.1-.5-.1L4.7 7.28c-.16-.4.28-.75.67-.56l15.2 6.04c1.06.42.98 1.97-.1 2.27z" fill="#29B5E8"/></svg>${r.therapist.telegram}</span>` : ''}
            </div>
          </div>
        </div>
        <p class="presentation">${r.presentation.replace(/\n/g, '<br/>')}</p>
        ${linksHtml}
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Georgia', serif; background: #FAF7F4; color: #3A2E2E; padding: 48px 56px; }
  .header { text-align: center; border-bottom: 1px solid #D6C5BB; padding-bottom: 28px; margin-bottom: 36px; }
  .logo { font-size: 13px; letter-spacing: 3px; color: #9B7E74; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 22px; font-weight: normal; color: #3A2E2E; margin-bottom: 6px; }
  .subtitle { font-size: 12px; color: #9B7E74; font-style: italic; }
  .card { background: #fff; border: 1px solid #E8DDD7; border-radius: 12px; padding: 24px; margin-bottom: 20px; page-break-inside: avoid; }
  .card-header { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 14px; }
  .avatar { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #E8DDD7; flex-shrink: 0; }
  .avatar-placeholder { width: 64px; height: 64px; border-radius: 50%; background: #F0E8E3; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #9B7E74; flex-shrink: 0; border: 2px solid #E8DDD7; }
  .card-info h2 { font-size: 17px; font-weight: normal; color: #3A2E2E; margin-bottom: 6px; }
  .contacts { display: flex; flex-direction: column; gap: 3px; }
  .contacts span { font-size: 12px; color: #7A6057; display: flex; align-items: center; gap: 5px; }
  .contact-icon { width: 13px; height: 13px; flex-shrink: 0; }
  .presentation { font-size: 13px; line-height: 1.7; color: #5A4A44; border-top: 1px solid #F0E8E3; padding-top: 14px; }
  .links { margin-top: 12px; display: flex; flex-direction: column; gap: 4px; }
  .links a { font-size: 11px; color: #C4856A; text-decoration: none; word-break: break-all; }
</style>
</head>
<body>
  <div class="header">
    <div class="logo">OBIYMU · EFT Space</div>
    <h1>Рекомендовані терапевти</h1>
    <div class="subtitle">Список сформовано платформою Обійму ЕФТ Space · ${new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>
  ${therapistCards}
</body>
</html>`
}

export async function generateTherapistRequestPdf(responses: ResponseWithTherapist[]): Promise<Buffer> {
  const html = buildHtml(responses)

  let browser: import('puppeteer-core').Browser
  if (process.env.NODE_ENV === 'production') {
    const chromium = require('@sparticuz/chromium')
    const puppeteerCore = require('puppeteer-core') as typeof import('puppeteer-core')
    browser = await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  } else {
    const puppeteer = require('puppeteer') as typeof import('puppeteer')
    browser = await puppeteer.launch({ headless: true }) as unknown as import('puppeteer-core').Browser
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
