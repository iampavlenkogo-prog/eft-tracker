const EFT_LABELS: Record<string, string> = {
  BASIC: 'Базовий курс',
  ADVANCED: 'Поглиблений курс',
  STUDENT: 'Студент Інституту',
  CERTIFIED: 'Сертифікований терапевт',
  SUPERVISOR: 'Сертифікований супервізор',
  SUPERVISOR_CANDIDATE: 'Кандидат у супервізори',
}

const TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_PRESENTER: 'Індивідуальна (подача)',
  INDIVIDUAL_LISTENER: 'Індивідуальна (слухач)',
  GROUP_PRESENTER: 'Групова (подача)',
  GROUP_LISTENER: 'Групова (слухач)',
}

function fmtDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (mins === 0) return `${hrs}`
  return `${hrs} год ${mins} хв`
}

function periodLabel(from?: string | null, to?: string | null): string {
  if (from && to) return `${fmtDate(from)} — ${fmtDate(to)}`
  if (from) return `від ${fmtDate(from)}`
  if (to) return `до ${fmtDate(to)}`
  return 'Весь час'
}

function dr(label: string, value: number | string, bold = false): string {
  const cls = bold ? ' class="dl-row dl-bold"' : ' class="dl-row"'
  return `<tr${cls}>
    <td class="dl-label">${label}</td>
    <td class="dl-dots"></td>
    <td class="dl-val">${value}</td>
  </tr>`
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 13px;
    color: #2C2C2C;
    background: #FAFAF8;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: A4;
    margin: 24mm 20mm 20mm 20mm;
  }

  /* ── Header ─────────────────────────────────────────────── */
  .header { margin-bottom: 36px; }

  .header-heart {
    font-size: 20px;
    color: #C4856A;
    margin-bottom: 18px;
    letter-spacing: 4px;
  }

  .header-title {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 36px;
    font-weight: 400;
    color: #2C2C2C;
    line-height: 1.2;
    margin-bottom: 28px;
  }

  .header-info {
    border-collapse: separate;
    border-spacing: 0;
  }

  .hi-icon {
    font-size: 12px;
    color: #C4856A;
    padding: 5px 10px 5px 0;
    vertical-align: middle;
    white-space: nowrap;
  }

  .hi-label {
    font-size: 11px;
    color: #A0A0A0;
    font-weight: 300;
    padding: 5px 20px 5px 0;
    vertical-align: middle;
    white-space: nowrap;
  }

  .hi-value {
    font-size: 13px;
    color: #2C2C2C;
    padding: 5px 0;
    vertical-align: middle;
  }

  .header-rule {
    border: none;
    border-top: 1px solid #E0D9D0;
    margin-top: 24px;
  }

  /* ── Section ─────────────────────────────────────────────── */
  .section { margin-top: 36px; break-inside: avoid-column; }

  .section-title {
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #C4856A;
    margin-bottom: 16px;
    break-after: avoid;
  }

  /* ── Table ───────────────────────────────────────────────── */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
  }

  thead { display: table-header-group; }
  tr { break-inside: avoid; }

  .data-table th {
    font-size: 11px;
    font-weight: 500;
    color: #A0A0A0;
    text-align: left;
    padding: 0 12px 10px 0;
    border-bottom: 1px solid #E0D9D0;
  }

  .data-table th.tc { text-align: center; }
  .data-table th:last-child { padding-right: 0; }

  .data-table td {
    font-size: 13px;
    color: #2C2C2C;
    padding: 11px 12px 11px 0;
    border-bottom: 1px solid #F0EBE3;
    vertical-align: top;
  }

  .data-table td:last-child { padding-right: 0; }
  .data-table tbody tr:last-child td { border-bottom: none; }

  .td-muted { font-size: 12px; color: #7A7A7A; }
  .td-c { text-align: center; }
  .td-nw { white-space: nowrap; }

  .empty-row td {
    color: #A0A0A0;
    font-style: italic;
    font-size: 12px;
    text-align: center;
    padding: 20px 0;
    border: none;
  }

  /* ── Dotted summary list ─────────────────────────────────── */
  .dl {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }

  .dl-row td { padding: 4px 0; }

  .dl-label {
    font-size: 12px;
    color: #7A7A7A;
    font-weight: 300;
    white-space: nowrap;
    padding-right: 6px !important;
    vertical-align: bottom;
  }

  .dl-dots {
    border-bottom: 1px dotted #C8BFB5;
    padding: 0 !important;
    width: 100%;
    vertical-align: bottom;
  }

  .dl-val {
    font-size: 12px;
    color: #2C2C2C;
    font-weight: 400;
    white-space: nowrap;
    text-align: right;
    padding-left: 6px !important;
    vertical-align: bottom;
  }

  .dl-bold .dl-label {
    font-weight: 500;
    color: #2C2C2C;
  }

  .dl-bold .dl-val {
    font-weight: 500;
  }

  /* ── Summary cards block ─────────────────────────────────── */
  .cards-block {
    background: #F0EBE3;
    border-radius: 16px;
    padding: 32px 24px;
    margin-top: 40px;
    break-inside: avoid;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .cards-table {
    width: 100%;
    border-collapse: collapse;
  }

  .card-cell {
    text-align: center;
    padding: 0 20px;
    vertical-align: top;
  }

  .card-cell:not(:last-child) {
    border-right: 1px solid #E8DDD0;
  }

  .card-icon {
    font-size: 18px;
    color: #C4856A;
    display: block;
    margin-bottom: 10px;
  }

  .card-label {
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: #A0A0A0;
    line-height: 1.65;
    display: block;
    margin-bottom: 10px;
  }

  .card-rule {
    width: 20px;
    height: 1px;
    background: #C4856A;
    margin: 0 auto 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .card-number {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 48px;
    font-weight: 400;
    color: #2C2C2C;
    line-height: 1;
    display: block;
  }

  /* ── Footer ──────────────────────────────────────────────── */
  .footer {
    margin-top: 48px;
    text-align: center;
    break-before: avoid;
    break-inside: avoid;
  }

  .footer-tagline {
    font-family: 'EB Garamond', Georgia, serif;
    font-style: italic;
    font-size: 15px;
    color: #C4856A;
    margin-bottom: 8px;
  }

  .footer-meta {
    font-size: 10px;
    color: #A0A0A0;
    font-weight: 300;
    letter-spacing: 0.3px;
  }

  .footer-logo {
    margin-top: 14px;
  }

  .footer-logo img {
    height: 26px;
    width: auto;
    opacity: 0.65;
  }

  @media print {
    .section-title   { break-after: avoid; }
    .cards-block     { break-inside: avoid; }
    .footer          { break-before: avoid; break-inside: avoid; }
  }
`

function cardsBlock(supCount: number, hours: number, points: number): string {
  return `
  <div class="cards-block">
    <table class="cards-table">
      <tr>
        <td class="card-cell">
          <span class="card-icon">♡</span>
          <span class="card-label">Загальна<br>кількість<br>супервізій</span>
          <div class="card-rule"></div>
          <span class="card-number">${supCount}</span>
        </td>
        <td class="card-cell">
          <span class="card-icon">⏱</span>
          <span class="card-label">Загальна<br>кількість<br>годин</span>
          <div class="card-rule"></div>
          <span class="card-number">${hours}</span>
        </td>
        <td class="card-cell">
          <span class="card-icon">✦</span>
          <span class="card-label">Загальна<br>кількість<br>балів</span>
          <div class="card-rule"></div>
          <span class="card-number">${points}</span>
        </td>
      </tr>
    </table>
  </div>`
}

export function buildReportHTML(data: any, reportType: 'full' | 'summary', logoUrl?: string): string {
  const today = new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
  const period = periodLabel(data.period?.from, data.period?.to)
  const therapistName =
    [data.therapist?.lastName, data.therapist?.firstName].filter(Boolean).join(' ') ||
    data.therapist?.name || 'EFT Ukraine'

  // ── Header ─────────────────────────────────────────────────────────────
  const latinName = data.therapist?.latinName
  const eftLevel = data.therapist?.eftLevel
    ? (EFT_LABELS[data.therapist.eftLevel] ?? data.therapist.eftLevel) : null

  const header = `
    <div class="header">
      <div class="header-heart">♡</div>
      <h1 class="header-title">Звіт про процес<br>навчання в ЕФТ</h1>
      <table class="header-info">
        <tr>
          <td class="hi-icon">◦</td>
          <td class="hi-label">Ім'я терапевта</td>
          <td class="hi-value">${therapistName}</td>
        </tr>
        ${latinName ? `<tr>
          <td class="hi-icon">◦</td>
          <td class="hi-label">Ім'я латиницею</td>
          <td class="hi-value">${latinName}</td>
        </tr>` : ''}
        ${eftLevel ? `<tr>
          <td class="hi-icon">◦</td>
          <td class="hi-label">Статус EFT</td>
          <td class="hi-value">${eftLevel}</td>
        </tr>` : ''}
        <tr>
          <td class="hi-icon">◦</td>
          <td class="hi-label">Email</td>
          <td class="hi-value">${data.therapist?.email || '—'}</td>
        </tr>
        <tr>
          <td class="hi-icon">◦</td>
          <td class="hi-label">Період звіту</td>
          <td class="hi-value">${period}</td>
        </tr>
      </table>
      <hr class="header-rule">
    </div>`

  let body = ''

  if (reportType === 'full') {
    // ── Supervisions ──────────────────────────────────────────────────────
    const sups: any[] = data.supervisions || []
    const byType: Record<string, number> = {}
    sups.forEach(s => { byType[s.type] = (byType[s.type] || 0) + 1 })
    const casesCount = (byType['INDIVIDUAL_PRESENTER'] || 0) + (byType['GROUP_PRESENTER'] || 0)
    const totalSupHours = sups.reduce((sum, s) => sum + (s.hours ?? 1), 0)

    const supRows = sups.length
      ? sups.map(s => `<tr>
          <td class="td-nw">${fmtDate(s.date)}</td>
          <td>${s.supervisorName}</td>
          <td class="td-muted">${TYPE_LABELS[s.type] ?? s.type}</td>
          <td class="td-c">${s.hours ?? 1}</td>
        </tr>`).join('')
      : `<tr class="empty-row"><td colspan="4">Немає підтверджених записів</td></tr>`

    body += `
      <div class="section">
        <div class="section-title">Супервізії</div>
        <table class="data-table">
          <thead><tr>
            <th style="width:90px;">Дата</th>
            <th>Супервізор</th>
            <th>Тип</th>
            <th class="tc" style="width:42px;">Год.</th>
          </tr></thead>
          <tbody>${supRows}</tbody>
        </table>
        <table class="dl">
          <tbody>
            ${dr('Індивідуальні (подача випадку)', byType['INDIVIDUAL_PRESENTER'] || 0)}
            ${dr('Індивідуальні (слухач)', byType['INDIVIDUAL_LISTENER'] || 0)}
            ${dr('Групові (подача випадку)', byType['GROUP_PRESENTER'] || 0)}
            ${dr('Групові (слухач)', byType['GROUP_LISTENER'] || 0)}
            ${dr('Супервізії з поданням випадку', casesCount, true)}
            ${dr('Загальна кількість годин', totalSupHours, true)}
            ${dr('Загальна кількість супервізій', sups.length, true)}
          </tbody>
        </table>
      </div>`

    // ── Seminars ──────────────────────────────────────────────────────────
    const sems: any[] = data.seminars || []
    const totalHours = sems.reduce((sum, s) => sum + (s.hours || 0), 0)
    const totalPoints = sems.reduce((sum, s) => sum + (s.points || 0), 0)

    const semRows = sems.length
      ? sems.map(s => `<tr>
          <td>${s.title}</td>
          <td class="td-nw td-muted">${fmtDate(s.date)}</td>
          <td class="td-c">${s.hours}</td>
          <td class="td-c">${s.points}</td>
          <td class="td-c td-muted">${s.certificateUrl ? 'Так' : '—'}</td>
        </tr>`).join('')
      : `<tr class="empty-row"><td colspan="5">Немає підтверджених записів</td></tr>`

    body += `
      <div class="section">
        <div class="section-title">Семінари</div>
        <table class="data-table">
          <thead><tr>
            <th>Назва семінару</th>
            <th style="width:88px;">Дата</th>
            <th class="tc" style="width:42px;">Год.</th>
            <th class="tc" style="width:42px;">Бали</th>
            <th class="tc" style="width:42px;">Серт.</th>
          </tr></thead>
          <tbody>${semRows}</tbody>
        </table>
        <table class="dl">
          <tbody>
            ${dr('Всього годин навчання', totalHours, true)}
            ${dr('Всього балів', totalPoints, true)}
          </tbody>
        </table>
      </div>`

    // ── Skills Groups ─────────────────────────────────────────────────────
    const sgs: any[] = data.skillsGroups || []
    const totalSgHours = sgs.reduce((sum: number, s: any) => sum + (s.hours ?? 1), 0)
    const sgRows = sgs.length
      ? sgs.map(s => `<tr>
          <td class="td-nw">${fmtDate(s.date)}</td>
          <td>${s.supervisorName}</td>
          <td class="td-c td-nw">${fmtHours(s.hours)}</td>
        </tr>`).join('')
      : `<tr class="empty-row"><td colspan="3">Немає підтверджених записів</td></tr>`

    body += `
      <div class="section">
        <div class="section-title">Групи навичок</div>
        <table class="data-table">
          <thead><tr>
            <th style="width:90px;">Дата</th>
            <th>Супервізор</th>
            <th class="tc" style="width:90px;">Год.</th>
          </tr></thead>
          <tbody>${sgRows}</tbody>
        </table>
        <table class="dl">
          <tbody>
            ${dr('Загальна кількість участей', sgs.length, true)}
            ${dr('Загальна кількість годин', fmtHours(totalSgHours), true)}
          </tbody>
        </table>
      </div>`

    body += cardsBlock(sups.length, totalHours, totalPoints)

  } else {
    // ── Summary report ────────────────────────────────────────────────────
    const supT = data.totals?.supervisions || {}
    const semT = data.totals?.seminars || {}
    const bt = supT.byType || {}
    const casesCount = (bt['INDIVIDUAL_PRESENTER'] || 0) + (bt['GROUP_PRESENTER'] || 0)

    body += `
      <div class="section">
        <div class="section-title">Супервізії</div>
        <table class="dl">
          <tbody>
            ${dr('Індивідуальні (подача випадку)', bt['INDIVIDUAL_PRESENTER'] || 0)}
            ${dr('Індивідуальні (слухач)', bt['INDIVIDUAL_LISTENER'] || 0)}
            ${dr('Групові (подача випадку)', bt['GROUP_PRESENTER'] || 0)}
            ${dr('Групові (слухач)', bt['GROUP_LISTENER'] || 0)}
            ${dr('Супервізії з поданням випадку', casesCount, true)}
            ${dr('Загальна кількість годин', supT.totalHours || 0, true)}
            ${dr('Загальна кількість супервізій', supT.total || 0, true)}
          </tbody>
        </table>
      </div>
      <div class="section">
        <div class="section-title">Семінари</div>
        <table class="dl">
          <tbody>
            ${dr('Всього семінарів', semT.total || 0)}
            ${dr('Всього годин навчання', semT.totalHours || 0, true)}
            ${dr('Всього балів', semT.totalPoints || 0, true)}
          </tbody>
        </table>
      </div>`

    const sgT = data.totals?.skillsGroups || {}
    if ((sgT.total || 0) > 0) {
      body += `
        <div class="section">
          <div class="section-title">Групи навичок</div>
          <table class="dl">
            <tbody>
              ${dr('Кількість участей', sgT.total || 0, true)}
              ${dr('Загальна кількість годин', fmtHours(sgT.totalHours || 0), true)}
            </tbody>
          </table>
        </div>`
    }

    body += cardsBlock(supT.total || 0, semT.totalHours || 0, semT.totalPoints || 0)
  }

  const footer = `
    <div class="footer">
      <div class="footer-tagline">Навчання. Ріст. Зв'язок. ♡</div>
      <div class="footer-meta">EFT Ukraine &nbsp;·&nbsp; Звіт сформовано ${today} &nbsp;·&nbsp; ${therapistName}</div>
      ${logoUrl ? `<div class="footer-logo"><img src="${logoUrl}" alt="OBIYMU" /></div>` : ''}
    </div>`

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
  <style>${CSS}</style>
</head>
<body>
  ${header}
  ${body}
  ${footer}
</body>
</html>`
}
