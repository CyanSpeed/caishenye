import type { QuarterlyReportData } from '@shared/types'

/** 格式化金额：千分位 + 保留整数 */
function fmtAmount(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

/** 格式化金额为万元 */
function fmtWan(n: number): string {
  if (Math.abs(n) >= 10000) {
    return `¥${(n / 10000).toFixed(1)}万`
  }
  return `¥${fmtAmount(n)}`
}

/** 格式化百分比 */
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

/** 格式化变动百分比（带箭头） */
function fmtChange(n: number): string {
  if (n > 0) return `▲ +${n.toFixed(1)}% vs 上季`
  if (n < 0) return `▼ ${n.toFixed(1)}% vs 上季`
  return '— 持平'
}

export function renderReportHTML(data: QuarterlyReportData, colorMode: 'cn' | 'west' = 'west'): string {
  // 根据颜色模式决定盈利/亏损配色
  const profitColor = colorMode === 'cn' ? '#EF4444' : '#10B981'
  const lossColor = colorMode === 'cn' ? '#10B981' : '#EF4444'
  const profitColorDark = colorMode === 'cn' ? '#DC2626' : '#059669'
  const lossColorDark = colorMode === 'cn' ? '#059669' : '#DC2626'
  const profitBg = colorMode === 'cn' ? '#FEF2F2' : '#F0FDF4'
  const lossBg = colorMode === 'cn' ? '#F0FDF4' : '#FEF2F2'
  const { meta, summary, balanceSheet, incomeStatement, cashFlow, kpis, assetStructure } = data

  // 家庭成员信息
  const membersHTML = meta.members.map(m =>
    `<div><span>${m.role}：</span><strong>${m.name})</strong></div>`
  ).join('\n')

  // 资产负债表 - 流动资产
  const liquidRowsHTML = balanceSheet.assets.liquid.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount">${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 资产负债表 - 投资资产
  const investRowsHTML = balanceSheet.assets.investment.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount">${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 资产负债表 - 固定资产
  const fixedRowsHTML = balanceSheet.assets.fixed.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount">${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 负债 - 短期
  const shortTermRowsHTML = balanceSheet.liabilities.shortTerm.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount">${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 负债 - 长期
  const longTermRowsHTML = balanceSheet.liabilities.longTerm.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount">${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 收入明细
  const incomeRowsHTML = incomeStatement.income.categories.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount">${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td></tr>`
  ).join('\n')

  // 固定支出明细
  const fixedExpRowsHTML = incomeStatement.expense.fixed.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount negative">-${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td></tr>`
  ).join('\n')

  // 弹性支出明细
  const varExpRowsHTML = incomeStatement.expense.variable.map(item =>
    `<tr class="sub-item"><td>${item.name}</td><td class="amount negative">-${fmtAmount(item.amount)}</td><td class="pct">${fmtPct(item.percentage)}</td></tr>`
  ).join('\n')

  // 现金流 - 经营性
  const cfOperatingHTML = cashFlow.operating.map(item =>
    `<tr><td>${item.name}</td><td class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">${item.amount >= 0 ? '+' : ''}${fmtAmount(item.amount)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 现金流 - 投资性
  const cfInvestingHTML = cashFlow.investing.map(item =>
    `<tr><td>${item.name}</td><td class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">${item.amount >= 0 ? '+' : ''}${fmtAmount(item.amount)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // 现金流 - 融资性
  const cfFinancingHTML = cashFlow.financing.map(item =>
    `<tr><td>${item.name}</td><td class="amount ${item.amount >= 0 ? 'positive' : 'negative'}">${item.amount >= 0 ? '+' : ''}${fmtAmount(item.amount)}</td><td class="note">${item.note}</td></tr>`
  ).join('\n')

  // KPI 卡片
  const kpiCardsHTML = kpis.map(kpi => {
    const barColor = kpi.status === 'good' ? 'var(--green)' : kpi.status === 'warn' ? 'var(--orange)' : 'var(--accent)'
    return `
      <div class="kpi-item">
        <div class="kpi-label">${kpi.formula}</div>
        <div class="kpi-value" style="color:${barColor};">${kpi.displayValue}</div>
        <div class="kpi-bar"><div class="kpi-bar-fill" style="width:${kpi.barPercentage}%;background:${barColor};"></div></div>
        <div class="kpi-range"><span>0</span><span>${kpi.name}</span><span>100%</span></div>
        <div class="kpi-verdict ${kpi.status}">${kpi.verdict}</div>
      </div>`
  }).join('\n')

  // 资产构成条形图
  const assetBarsHTML = assetStructure.assetComposition.map(item => `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>${item.name}</span><span style="font-weight:600;">${fmtPct(item.percentage)}</span></div>
      <div style="height:24px;background:#edf2f7;border-radius:4px;overflow:hidden;"><div style="width:${Math.max(item.percentage, 15)}%;height:100%;background:linear-gradient(90deg,#4299e1,#3182ce);border-radius:4px;display:flex;align-items:center;padding-left:8px;color:white;font-size:0.8em;white-space:nowrap;min-width:fit-content;">${fmtWan(item.value)}</div></div>
    </div>`).join('\n')

  // 支出构成条形图
  const expenseBarsHTML = assetStructure.expenseComposition.slice(0, 6).map(item => {
    const colors = [lossColor, '#dd6b20', '#3182ce', '#805ad5', profitColor, '#718096']
    const idx = assetStructure.expenseComposition.indexOf(item)
    const color = colors[idx % colors.length]
    return `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>${item.name}</span><span style="font-weight:600;">${fmtPct(item.percentage)} | ¥${fmtAmount(item.value)}</span></div>
      <div style="height:20px;background:#edf2f7;border-radius:4px;overflow:hidden;"><div style="width:${Math.max(item.percentage, 3)}%;height:100%;background:${color};border-radius:4px;"></div></div>
    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${meta.familyName} ${meta.quarterLabel}财报</title>
    <style>
        :root {
            --primary: #1a365d;
            --primary-light: #2c5282;
            --accent: ${lossColor};
            --green: ${profitColor};
            --orange: #dd6b20;
            --bg: #f7fafc;
            --card-bg: #ffffff;
            --text: #2d3748;
            --text-light: #718096;
            --border: #e2e8f0;
            --shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
            background: var(--bg); color: var(--text); line-height: 1.6;
        }
        .report-header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            color: white; padding: 40px 0; text-align: center; position: relative; overflow: hidden;
        }
        .report-header::before {
            content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%);
        }
        .report-header h1 { font-size: 2.2em; font-weight: 700; margin-bottom: 8px; position: relative; }
        .report-header .subtitle { font-size: 1.1em; opacity: 0.9; position: relative; }
        .report-header .period {
            display: inline-block; margin-top: 12px; padding: 4px 16px;
            border: 1px solid rgba(255,255,255,0.4); border-radius: 20px;
            font-size: 0.9em; position: relative;
        }
        .container { max-width: 1100px; margin: 0 auto; padding: 30px 20px; }
        .summary-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px; margin-bottom: 35px; margin-top: 50px; position: relative; z-index: 10;
        }
        .summary-card {
            background: var(--card-bg); border-radius: 12px; padding: 24px;
            box-shadow: var(--shadow); text-align: center; border-top: 4px solid var(--primary);
            transition: transform 0.2s;
        }
        .summary-card:hover { transform: translateY(-2px); }
        .summary-card.green { border-top-color: var(--green); }
        .summary-card.orange { border-top-color: var(--orange); }
        .summary-card.red { border-top-color: var(--accent); }
        .summary-card .label { font-size: 0.85em; color: var(--text-light); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
        .summary-card .value { font-size: 1.8em; font-weight: 700; color: var(--primary); }
        .summary-card.green .value { color: var(--green); }
        .summary-card.orange .value { color: var(--orange); }
        .summary-card.red .value { color: var(--accent); }
        .summary-card .change { font-size: 0.8em; margin-top: 6px; }
        .summary-card .change.up { color: var(--green); }
        .summary-card .change.down { color: var(--accent); }
        .section {
            background: var(--card-bg); border-radius: 12px; box-shadow: var(--shadow);
            margin-bottom: 30px; overflow: hidden;
        }
        .section-header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
            color: white; padding: 18px 28px; display: flex; align-items: center; gap: 12px;
        }
        .section-header .icon { font-size: 1.4em; }
        .section-header h2 { font-size: 1.2em; font-weight: 600; }
        .section-header .desc { font-size: 0.85em; opacity: 0.8; margin-left: auto; }
        .section-body { padding: 28px; }
        .fin-table { width: 100%; border-collapse: collapse; }
        .fin-table th, .fin-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border); }
        .fin-table th { font-weight: 600; color: var(--text-light); font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.5px; background: #f8fafc; }
        .fin-table tr:last-child td { border-bottom: none; }
        .fin-table .amount { text-align: right; font-family: "SF Mono", "Fira Code", monospace; font-weight: 500; }
        .fin-table .pct { text-align: right; color: var(--text-light); font-size: 0.9em; }
        .fin-table .category-row td { font-weight: 700; background: #edf2f7; color: var(--primary); }
        .fin-table .total-row td { font-weight: 700; background: var(--primary); color: white; font-size: 1.05em; }
        .fin-table .subtotal-row td { font-weight: 600; border-top: 2px solid var(--primary); }
        .fin-table .sub-item td { padding-left: 36px; color: var(--text-light); }
        .fin-table .positive { color: var(--green); }
        .fin-table .negative { color: var(--accent); }
        .fin-table .note { font-size: 0.8em; color: var(--text-light); }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .kpi-item { border: 1px solid var(--border); border-radius: 10px; padding: 20px; position: relative; }
        .kpi-item .kpi-label { font-size: 0.85em; color: var(--text-light); margin-bottom: 4px; }
        .kpi-item .kpi-value { font-size: 1.5em; font-weight: 700; margin-bottom: 8px; }
        .kpi-item .kpi-bar { height: 8px; background: #edf2f7; border-radius: 4px; overflow: hidden; }
        .kpi-item .kpi-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
        .kpi-item .kpi-range { display: flex; justify-content: space-between; font-size: 0.75em; color: var(--text-light); margin-top: 4px; }
        .kpi-item .kpi-verdict { font-size: 0.82em; margin-top: 8px; padding: 4px 10px; border-radius: 4px; display: inline-block; }
        .kpi-verdict.good { background: #f0fff4; color: var(--green); }
        .kpi-verdict.warn { background: #fffaf0; color: var(--orange); }
        .kpi-verdict.bad { background: #fff5f5; color: var(--accent); }
        .family-info {
            display: flex; gap: 30px; flex-wrap: wrap; margin-bottom: 20px;
            padding: 16px 20px; background: #f8fafc; border-radius: 8px; font-size: 0.9em;
        }
        .family-info span { color: var(--text-light); }
        .family-info strong { color: var(--text); }
        .report-footer {
            text-align: center; padding: 30px; color: var(--text-light);
            font-size: 0.85em; border-top: 1px solid var(--border); margin-top: 20px;
        }
        @media (max-width: 768px) { .two-col { grid-template-columns: 1fr; } }
        @media (max-width: 600px) {
            .summary-grid { grid-template-columns: 1fr 1fr; }
            .report-header h1 { font-size: 1.6em; }
            .section-body { padding: 16px; }
            .fin-table th, .fin-table td { padding: 8px 10px; font-size: 0.9em; }
        }
        @media print {
            body { background: white; }
            .summary-grid { margin-top: 20px; }
            .section { box-shadow: none; border: 1px solid #ddd; }
        }
    </style>
</head>
<body>

<div class="report-header">
    <h1>🏠 ${meta.familyName} ${meta.quarterLabel}财报</h1>
    <div class="subtitle">Family Financial Report</div>
    <div class="period">📅 报告期：${meta.quarterLabel} (${meta.dateRange})</div>
</div>

<div class="container">

    <div class="family-info">
        ${membersHTML}
        <div><span>城市：</span><strong>${meta.city}</strong></div>
        <div><span>编制日期：</span><strong>${meta.generatedAt.slice(0, 10)}</strong></div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">总资产</div>
            <div class="value">${fmtWan(summary.totalAssets)}</div>
            <div class="change ${summary.totalAssetsChange >= 0 ? 'up' : 'down'}">${fmtChange(summary.totalAssetsChange)}</div>
        </div>
        <div class="summary-card red">
            <div class="label">总负债</div>
            <div class="value">${fmtWan(summary.totalLiabilities)}</div>
            <div class="change ${summary.totalLiabilitiesChange <= 0 ? 'up' : 'down'}">${fmtChange(summary.totalLiabilitiesChange)}</div>
        </div>
        <div class="summary-card green">
            <div class="label">净资产</div>
            <div class="value">${fmtWan(summary.netWorth)}</div>
            <div class="change ${summary.netWorthChange >= 0 ? 'up' : 'down'}">${fmtChange(summary.netWorthChange)}</div>
        </div>
        <div class="summary-card orange">
            <div class="label">本季净结余</div>
            <div class="value">${fmtWan(summary.quarterlyNetSavings)}</div>
            <div class="change up">储蓄率 ${fmtPct(summary.savingsRate)}</div>
        </div>
    </div>

    <!-- 资产负债表 -->
    <div class="section">
        <div class="section-header">
            <span class="icon">📋</span>
            <h2>一、资产负债表 (Balance Sheet)</h2>
            <span class="desc">截至 ${meta.dateRange.split('—')[1]?.trim() || ''}</span>
        </div>
        <div class="section-body">
            <table class="fin-table">
                <thead><tr><th style="width:45%">资产项目</th><th class="amount" style="width:25%">金额 (¥)</th><th class="pct" style="width:15%">占比</th><th style="width:15%">备注</th></tr></thead>
                <tbody>
                    <tr class="category-row"><td colspan="4">💰 一、流动资产（现金及等价物）</td></tr>
                    ${liquidRowsHTML}
                    <tr class="subtotal-row"><td>流动资产小计</td><td class="amount">${fmtAmount(balanceSheet.assets.liquidTotal)}</td><td class="pct">${fmtPct(balanceSheet.assets.liquidTotal / balanceSheet.assets.grandTotal * 100)}</td><td></td></tr>

                    <tr class="category-row"><td colspan="4">📈 二、投资性资产</td></tr>
                    ${investRowsHTML}
                    <tr class="subtotal-row"><td>投资性资产小计</td><td class="amount">${fmtAmount(balanceSheet.assets.investmentTotal)}</td><td class="pct">${fmtPct(balanceSheet.assets.investmentTotal / balanceSheet.assets.grandTotal * 100)}</td><td></td></tr>

                    <tr class="category-row"><td colspan="4">🏠 三、固定资产（实物资产）</td></tr>
                    ${fixedRowsHTML}
                    <tr class="subtotal-row"><td>固定资产小计</td><td class="amount">${fmtAmount(balanceSheet.assets.fixedTotal)}</td><td class="pct">${fmtPct(balanceSheet.assets.fixedTotal / balanceSheet.assets.grandTotal * 100)}</td><td></td></tr>

                    <tr class="total-row"><td>🏦 资产总计</td><td class="amount">${fmtAmount(balanceSheet.assets.grandTotal)}</td><td class="pct">100%</td><td></td></tr>
                </tbody>
            </table>

            <br>

            <table class="fin-table">
                <thead><tr><th style="width:45%">负债项目</th><th class="amount" style="width:25%">金额 (¥)</th><th class="pct" style="width:15%">占比</th><th style="width:15%">备注</th></tr></thead>
                <tbody>
                    <tr class="category-row"><td colspan="4">💳 一、短期负债（流动负债）</td></tr>
                    ${shortTermRowsHTML}
                    <tr class="subtotal-row"><td>短期负债小计</td><td class="amount">${fmtAmount(balanceSheet.liabilities.shortTermTotal)}</td><td class="pct">${fmtPct(balanceSheet.liabilities.shortTermTotal / balanceSheet.liabilities.grandTotal * 100)}</td><td></td></tr>

                    <tr class="category-row"><td colspan="4">🏦 二、长期负债（非流动负债）</td></tr>
                    ${longTermRowsHTML}
                    <tr class="subtotal-row"><td>长期负债小计</td><td class="amount">${fmtAmount(balanceSheet.liabilities.longTermTotal)}</td><td class="pct">${fmtPct(balanceSheet.liabilities.longTermTotal / balanceSheet.liabilities.grandTotal * 100)}</td><td></td></tr>

                    <tr class="total-row"><td>📉 负债总计</td><td class="amount">${fmtAmount(balanceSheet.liabilities.grandTotal)}</td><td class="pct">100%</td><td></td></tr>

                    <tr style="background:${profitBg};"><td style="font-weight:700;font-size:1.1em;">✨ 净资产（总资产 - 总负债）</td><td class="amount" style="font-weight:700;font-size:1.1em;color:${profitColor};">${fmtAmount(summary.netWorth)}</td><td class="pct" style="font-weight:700;">—</td><td class="note">家庭真实财富</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 收支表 -->
    <div class="section">
        <div class="section-header">
            <span class="icon">💹</span>
            <h2>二、家庭收支表 (Income Statement)</h2>
            <span class="desc">${meta.dateRange}</span>
        </div>
        <div class="section-body">
            <div class="two-col">
                <div>
                    <table class="fin-table">
                        <thead><tr><th>收入项目</th><th class="amount">金额 (¥)</th><th class="pct">占比</th></tr></thead>
                        <tbody>
                            <tr class="category-row"><td colspan="3">📥 收入明细</td></tr>
                            ${incomeRowsHTML}
                            <tr class="total-row"><td>💰 收入总计</td><td class="amount">${fmtAmount(incomeStatement.income.total)}</td><td class="pct">100%</td></tr>
                        </tbody>
                    </table>
                </div>
                <div>
                    <table class="fin-table">
                        <thead><tr><th>支出项目</th><th class="amount">金额 (¥)</th><th class="pct">占比</th></tr></thead>
                        <tbody>
                            <tr class="category-row"><td colspan="3">📤 一、固定支出</td></tr>
                            ${fixedExpRowsHTML}
                            <tr class="subtotal-row"><td>固定支出小计</td><td class="amount negative">-${fmtAmount(incomeStatement.expense.fixedTotal)}</td><td class="pct">${fmtPct(incomeStatement.expense.fixedTotal / incomeStatement.expense.total * 100)}</td></tr>

                            <tr class="category-row"><td colspan="3">📤 二、弹性支出</td></tr>
                            ${varExpRowsHTML}
                            <tr class="subtotal-row"><td>弹性支出小计</td><td class="amount negative">-${fmtAmount(incomeStatement.expense.variableTotal)}</td><td class="pct">${fmtPct(incomeStatement.expense.variableTotal / incomeStatement.expense.total * 100)}</td></tr>

                            <tr class="total-row"><td>💸 支出总计</td><td class="amount negative">-${fmtAmount(incomeStatement.expense.total)}</td><td class="pct">100%</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <br>
            <table class="fin-table">
                <tbody>
                    <tr class="total-row" style="background: linear-gradient(135deg, ${profitColor}, ${profitColorDark});">
                        <td style="font-size:1.1em;">✨ 本季度净结余（收入 - 支出）</td>
                        <td class="amount" style="font-size:1.3em;">${fmtWan(incomeStatement.income.total - incomeStatement.expense.total)}</td>
                        <td class="pct" style="font-size:1em;">储蓄率 ${fmtPct(incomeStatement.savingsRate)}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- 现金流量表 -->
    <div class="section">
        <div class="section-header">
            <span class="icon">🔄</span>
            <h2>三、现金流量表 (Cash Flow Statement)</h2>
            <span class="desc">${meta.quarterLabel} 季度汇总</span>
        </div>
        <div class="section-body">
            <table class="fin-table">
                <thead><tr><th>现金流项目</th><th class="amount">金额 (¥)</th><th style="width:30%">说明</th></tr></thead>
                <tbody>
                    <tr class="category-row"><td colspan="3">🟢 一、经营性现金流（日常收支）</td></tr>
                    ${cfOperatingHTML}
                    <tr class="subtotal-row"><td>经营性净现金流</td><td class="amount ${cashFlow.operatingTotal >= 0 ? 'positive' : 'negative'}">${cashFlow.operatingTotal >= 0 ? '+' : ''}${fmtAmount(cashFlow.operatingTotal)}</td><td class="note">${cashFlow.operatingTotal >= 0 ? '✅ 正向' : '⚠️ 负向'}</td></tr>

                    <tr class="category-row"><td colspan="3">🔵 二、投资性现金流</td></tr>
                    ${cfInvestingHTML}
                    <tr class="subtotal-row"><td>投资性净现金流</td><td class="amount ${cashFlow.investingTotal >= 0 ? 'positive' : 'negative'}">${cashFlow.investingTotal >= 0 ? '+' : ''}${fmtAmount(cashFlow.investingTotal)}</td><td class="note">${cashFlow.investingTotal >= 0 ? '✅ 正向' : '持续积累投资'}</td></tr>

                    <tr class="category-row"><td colspan="3">🔴 三、融资性现金流（还贷）</td></tr>
                    ${cfFinancingHTML}
                    <tr class="subtotal-row"><td>融资性净现金流</td><td class="amount ${cashFlow.financingTotal >= 0 ? 'positive' : 'negative'}">${cashFlow.financingTotal >= 0 ? '+' : ''}${fmtAmount(cashFlow.financingTotal)}</td><td class="note">${cashFlow.financingTotal >= 0 ? '新增融资' : '持续降负债'}</td></tr>

                    <tr class="total-row" style="background: linear-gradient(135deg, #2c5282, #2b6cb0);">
                        <td>💰 本季度现金净变动</td>
                        <td class="amount" style="font-size:1.2em;">${cashFlow.netCashFlow >= 0 ? '+' : ''}${fmtAmount(cashFlow.netCashFlow)}</td>
                        <td class="note" style="color:rgba(255,255,255,0.8);">季度现金变动合计</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- KPI 仪表盘 -->
    <div class="section">
        <div class="section-header">
            <span class="icon">📊</span>
            <h2>四、财务健康指标仪表盘 (KPI Dashboard)</h2>
            <span class="desc">量化评估家庭财务健康度</span>
        </div>
        <div class="section-body">
            <div class="kpi-grid">
                ${kpiCardsHTML}
            </div>
        </div>
    </div>

    <!-- 资产结构分析 -->
    <div class="section">
        <div class="section-header">
            <span class="icon">🍩</span>
            <h2>五、资产结构分析</h2>
            <span class="desc">资产配置可视化</span>
        </div>
        <div class="section-body">
            <div class="two-col">
                <div>
                    <h3 style="margin-bottom:16px;color:var(--primary);">资产构成</h3>
                    ${assetBarsHTML}
                </div>
                <div>
                    <h3 style="margin-bottom:16px;color:var(--primary);">支出构成</h3>
                    ${expenseBarsHTML}
                </div>
            </div>
        </div>
    </div>

    <div class="report-footer">
        <p>📄 ${meta.familyName} ${meta.quarterLabel}财报 </p>
        <p>编制人：${meta.preparer} | 审核人：${meta.reviewer} | 编制日期：${meta.generatedAt.slice(0, 10)}</p>
        <p style="margin-top:8px;font-size:0.8em;color:#a0aec0;">本报告仅供家庭内部财务决策参考，所有数据为家庭实际财务数据的汇总。</p>
    </div>

</div>

</body>
</html>`
}
