<template>
  <div class="dashboard">
    <div class="stat-row">
      <div class="glass-card stat-card" v-for="stat in statCards" :key="stat.key">
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-value" :class="stat.colorClass" :ref="el => statRefs[stat.key] = el">
          {{ stat.prefix }}{{ stat.displayValue }}
        </div>
        <div class="stat-sub" v-if="stat.sub">{{ stat.sub }}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="glass-card chart-card">
        <div class="card-title">资产分布</div>
        <div ref="assetChartRef" class="chart-box"></div>
      </div>
      <div class="glass-card chart-card">
        <div class="card-title">负债概览</div>
        <div ref="liabilityChartRef" class="chart-box"></div>
      </div>
    </div>

    <div class="bottom-row">
      <div class="glass-card chart-card chart-card--wide">
        <div class="card-title">近6个月收支趋势</div>
        <div ref="trendChartRef" class="chart-box"></div>
      </div>
      <div class="glass-card recent-card">
        <div class="card-title">近期动态</div>
        <div class="recent-list">
          <div v-for="tx in recentTransactions" :key="tx.id" class="recent-item">
            <div class="recent-icon" :class="'icon--' + tx.type">
              <component :is="txIcon(tx.type)" :size="14" />
            </div>
            <div class="recent-info">
              <div class="recent-desc">{{ tx.description || getCategoryById(tx.category_id ?? 0)?.name || '—' }}</div>
              <div class="recent-meta">{{ shortDate(tx.date) }} · {{ getAccountById(tx.from_account_id ?? 0)?.name || '—' }}</div>
            </div>
            <div class="recent-amount" :class="amountClass(tx)">{{ amountText(tx) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import gsap from 'gsap'
import { useFinance } from '../composables/useFinance'
import { useFormatter } from '../composables/useFormatter'
import { ArrowUpOutlined, ArrowDownOutlined, SwapOutlined } from '@vicons/antd'

const {
  netWorth, monthlyIncome, monthlyExpense,
  totalAssets, totalLiabilities,
  assetAllocation, liabilityOverview,
  recentTransactions, monthlyTrend,
  getAccountById, getCategoryById,
} = useFinance()
const { currencyPlain, shortDate } = useFormatter()

// ---- Stat Cards ----
const statRefs: Record<string, HTMLElement | null> = { netWorth: null, monthlyIncome: null, monthlyExpense: null }

const statCards = computed(() => [
  {
    key: 'netWorth', label: '净资产', prefix: '',
    displayValue: currencyPlain(netWorth.value),
    sub: `${currencyPlain(totalAssets.value)} - ${currencyPlain(totalLiabilities.value)}`,
    colorClass: netWorth.value.isNegative() ? 'text-red' : 'text-green',
  },
  {
    key: 'monthlyIncome', label: '本月收入', prefix: '+',
    displayValue: currencyPlain(monthlyIncome.value),
    sub: `${recentTransactions.value.filter(t => t.type === 'income').length} 笔`,
    colorClass: 'text-green',
  },
  {
    key: 'monthlyExpense', label: '本月支出', prefix: '-',
    displayValue: currencyPlain(monthlyExpense.value),
    sub: `${recentTransactions.value.filter(t => t.type === 'expense').length} 笔`,
    colorClass: 'text-red',
  },
])

function animateNumbers() {
  const targets: { ref: HTMLElement; value: number; decimals: number }[] = []
  if (statRefs.netWorth) targets.push({ ref: statRefs.netWorth, value: netWorth.value.abs().toNumber(), decimals: 2 })
  if (statRefs.monthlyIncome) targets.push({ ref: statRefs.monthlyIncome, value: monthlyIncome.value.toNumber(), decimals: 2 })
  if (statRefs.monthlyExpense) targets.push({ ref: statRefs.monthlyExpense, value: monthlyExpense.value.toNumber(), decimals: 2 })

  targets.forEach(({ ref, value, decimals }) => {
    gsap.fromTo(ref, { textContent: 0 }, {
      textContent: value,
      duration: 1.2,
      ease: 'power2.out',
      snap: { textContent: 1 },
      onUpdate() {
        const current = Number(ref.textContent)
        ref.textContent = '¥' + current.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      },
    })
  })
}

// ---- Transaction helpers ----
function txIcon(type: string) {
  return type === 'income' ? ArrowUpOutlined : type === 'expense' ? ArrowDownOutlined : SwapOutlined
}
function amountClass(tx: import('@shared/types').Transaction) {
  if (tx.type === 'income') return 'text-green'
  if (tx.type === 'expense') return 'text-red'
  return 'text-blue'
}
function amountText(tx: import('@shared/types').Transaction) {
  const prefix = tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''
  return prefix + currencyPlain(tx.amount)
}

// ---- Charts (robust init with ResizeObserver) ----
const assetChartRef = ref<HTMLElement | null>(null)
const liabilityChartRef = ref<HTMLElement | null>(null)
const trendChartRef = ref<HTMLElement | null>(null)

let assetChart: echarts.ECharts | null = null
let liabilityChart: echarts.ECharts | null = null
let trendChart: echarts.ECharts | null = null
const observers: ResizeObserver[] = []

const CHART_COLORS = { cash: '#4C9AFF', bank: '#36B37E', investment: '#6554C0', loan: '#FF8B64', credit: '#FF5630' }

function isDarkMode() {
  return document.documentElement.classList.contains('theme-dark')
}

function chartTooltipStyle() {
  return isDarkMode()
    ? { backgroundColor: 'rgba(13,17,23,0.95)', borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'rgba(0,0,0,0.08)' }
}

function chartTextColor() { return isDarkMode() ? '#8B949E' : '#656D76' }
function chartLineColor() { return isDarkMode() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }
function chartSplitColor() { return isDarkMode() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }

function initChart(
  refEl: HTMLElement | null,
  key: string,
  setupFn: (chart: echarts.ECharts) => void,
): echarts.ECharts | null {
  if (!refEl) return null
  if (refEl.clientWidth === 0 || refEl.clientHeight === 0) return null

  const existing = echarts.getInstanceByDom(refEl)
  if (existing) existing.dispose()

  const chart = echarts.init(refEl, isDarkMode() ? 'dark' : undefined)
  setupFn(chart)
  // Force resize after options to ensure proper fit
  requestAnimationFrame(() => chart.resize())

  const obs = new ResizeObserver(() => chart.resize())
  obs.observe(refEl)
  observers.push(obs)

  return chart
}

function initAssetChart() {
  assetChart = initChart(assetChartRef.value, 'asset', (chart) => {
    const tt = chartTooltipStyle()
    const textColor = chartTextColor()
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}: ¥${p.value.toLocaleString()}`,
        ...tt,
      },
      series: [{
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '52%'],
        itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 0 },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{d}%',
          color: textColor,
          fontSize: 12,
        },
        emphasis: { scaleSize: 4 },
        data: assetAllocation.value.map(d => ({
          name: d.name, value: d.value,
          itemStyle: { color: CHART_COLORS[d.sub_type] },
        })),
      }],
    })
  })
}

function initLiabilityChart() {
  liabilityChart = initChart(liabilityChartRef.value, 'liability', (chart) => {
    const tt = chartTooltipStyle()
    const textColor = chartTextColor()
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}: ¥${p.value.toLocaleString()}`,
        ...tt,
      },
      series: [{
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['50%', '52%'],
        roseType: 'area',
        itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 0 },
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n¥{c}',
          color: textColor,
          fontSize: 12,
        },
        emphasis: { scaleSize: 4 },
        data: liabilityOverview.value.map(d => ({
          name: d.name, value: d.value,
          itemStyle: { color: CHART_COLORS[d.sub_type] },
        })),
      }],
    })
  })
}

function initTrendChart() {
  trendChart = initChart(trendChartRef.value, 'trend', (chart) => {
    const data = monthlyTrend.value
    const textColor = chartTextColor()
    const lineColor = chartLineColor()
    const splitColor = chartSplitColor()
    const tt = chartTooltipStyle()
    chart.setOption({
      tooltip: { trigger: 'axis', ...tt },
      legend: { data: ['收入', '支出'], textStyle: { color: textColor }, bottom: 0 },
      grid: { left: 56, right: 24, top: 16, bottom: 36 },
      xAxis: {
        type: 'category',
        data: data.map(d => d.month + '月'),
        axisLabel: { color: textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: lineColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitColor } },
        axisLabel: {
          color: textColor,
          formatter: (v: number) => v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(v),
        },
      },
      series: [
        {
          name: '收入', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
          data: data.map(d => d.income),
          lineStyle: { color: '#36B37E', width: 2 },
          itemStyle: { color: '#36B37E' },
        },
        {
          name: '支出', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
          data: data.map(d => d.expense),
          lineStyle: { color: '#FF5630', width: 2 },
          itemStyle: { color: '#FF5630' },
        },
      ],
    })
  })
}

function initAllCharts() {
  initAssetChart()
  initLiabilityChart()
  initTrendChart()
}

onMounted(() => {
  // Wait for layout to fully stabilize before initializing charts
  requestAnimationFrame(() => {
    setTimeout(() => {
      initAllCharts()
      animateNumbers()
    }, 150)
  })
})

onUnmounted(() => {
  observers.forEach(o => o.disconnect())
  assetChart?.dispose()
  liabilityChart?.dispose()
  trendChart?.dispose()
})
</script>

<style scoped>
.dashboard {
  padding: 28px 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 1400px;
}

.glass-card { padding: 20px 24px; }

/* Stat Row */
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.stat-card { display: flex; flex-direction: column; gap: 8px; }
.stat-label { font-size: 14px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 34px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
.stat-sub { font-size: 13px; color: var(--text-muted); }

.text-green { color: #36B37E; }
.text-red { color: #FF5630; }
.text-blue { color: #4C9AFF; }

/* Charts */
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.bottom-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; }
.chart-card { display: flex; flex-direction: column; gap: 12px; }
.card-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.chart-box { width: 100%; height: 260px; min-height: 200px; }

/* Recent */
.recent-card { display: flex; flex-direction: column; gap: 12px; }
.recent-list { display: flex; flex-direction: column; }
.recent-item { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-subtle); }
.recent-item:last-child { border-bottom: none; padding-bottom: 0; }
.recent-icon {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.icon--income { background: rgba(54, 179, 126, 0.15); color: #36B37E; }
.icon--expense { background: rgba(255, 86, 48, 0.15); color: #FF5630; }
.icon--transfer { background: rgba(76, 154, 255, 0.15); color: #4C9AFF; }
.recent-info { flex: 1; min-width: 0; }
.recent-desc { font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recent-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.recent-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
