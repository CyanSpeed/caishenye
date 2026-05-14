<template>
  <div class="invest-page">
    <div class="page-header">
      <h2 class="page-title">投资分析</h2>
    </div>

    <!-- Summary Cards -->
    <div class="invest-summary">
      <div class="glass-card invest-stat" v-for="stat in summaryCards" :key="stat.label">
        <div class="invest-stat-label">{{ stat.label }}</div>
        <div class="invest-stat-value" :class="stat.colorClass">{{ stat.value }}</div>
        <div class="invest-stat-sub" v-if="stat.sub">{{ stat.sub }}</div>
      </div>
    </div>

    <!-- Performance Detail -->
    <div class="invest-detail" v-for="perf in investmentPerformance" :key="perf.account.id">
      <div class="glass-card detail-header-card">
        <div class="detail-account-name">
          <span class="dot" :style="{ background: perf.returnAmount.isNegative() ? '#FF5630' : '#36B37E' }" />
          {{ perf.account.name }}
        </div>
        <div class="detail-metrics">
          <div class="metric">
            <span class="metric-label">当前市值</span>
            <span class="metric-value">{{ currencyPlain(perf.latestValue) }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">持仓成本</span>
            <span class="metric-value">{{ currencyPlain(perf.costBasis) }}</span>
          </div>
          <div class="metric">
            <span class="metric-label">累计收益</span>
            <span class="metric-value" :class="perf.returnAmount.isNegative() ? 'text-red' : 'text-green'">
              {{ perf.returnAmount.isNegative() ? '' : '+' }}{{ currencyPlain(perf.returnAmount) }}
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">收益率</span>
            <span class="metric-value metric--highlight" :class="perf.returnRate.isNegative() ? 'text-red' : 'text-green'">
              {{ perf.returnRate.isNegative() ? '' : '+' }}{{ (perf.returnRate.toNumber() * 100).toFixed(2) }}%
            </span>
          </div>
        </div>
      </div>

      <!-- Growth Chart -->
      <div class="glass-card chart-card">
        <div class="card-title">资产净值增长曲线</div>
        <div :ref="el => setChartRef(perf.account.id, el)" class="chart-container"></div>
      </div>

      <!-- Snapshot Table -->
      <div class="glass-card snapshot-table-card">
        <div class="card-title">历史快照</div>
        <n-data-table
          :columns="snapshotColumns"
          :data="perf.snapshots"
          :bordered="false"
          size="small"
        />
      </div>
    </div>

    <div v-if="investmentPerformance.length === 0" class="glass-card empty-state">
      <p>暂无投资账户数据</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import Decimal from 'decimal.js'
import { NDataTable } from 'naive-ui'
import type { DataTableColumn } from 'naive-ui'
import { useFinance } from '../composables/useFinance'
import { useFormatter } from '../composables/useFormatter'

const { investmentPerformance } = useFinance()
const { currencyPlain } = useFormatter()

const chartRefs: Record<number, HTMLElement | null> = {}
const charts: Record<number, echarts.ECharts> = {}
const observers: ResizeObserver[] = []

function setChartRef(accountId: number, el: any) {
  if (el) chartRefs[accountId] = el
}

function isDarkMode() { return document.documentElement.classList.contains('theme-dark') }
function chartTT() {
  return isDarkMode()
    ? { backgroundColor: 'rgba(13,17,23,0.95)', borderColor: 'rgba(255,255,255,0.12)' }
    : { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: 'rgba(0,0,0,0.08)' }
}
function axisStyle() {
  return {
    labelColor: isDarkMode() ? '#8B949E' : '#656D76',
    lineColor: isDarkMode() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    splitColor: isDarkMode() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
  }
}

const summaryCards = computed(() => {
  let totalValue = new Decimal(0)
  let totalCost = new Decimal(0)
  investmentPerformance.value.forEach(p => {
    totalValue = totalValue.plus(p.latestValue)
    totalCost = totalCost.plus(p.costBasis)
  })
  const totalReturn = totalValue.minus(totalCost)
  const totalRate = totalCost.eq(0) ? new Decimal(0) : totalReturn.div(totalCost)
  return [
    { label: '总市值', value: currencyPlain(totalValue), colorClass: '' },
    { label: '总成本', value: currencyPlain(totalCost), colorClass: '' },
    { label: '累计收益', value: (totalReturn.isNegative() ? '' : '+') + currencyPlain(totalReturn), colorClass: totalReturn.isNegative() ? 'text-red' : 'text-green' },
    { label: '总收益率', value: (totalRate.isNegative() ? '' : '+') + totalRate.mul(100).toFixed(2) + '%', colorClass: totalRate.isNegative() ? 'text-red' : 'text-green' },
  ]
})

const snapshotColumns: DataTableColumn[] = [
  { title: '日期', key: 'date', width: 120 },
  { title: '市值', key: 'market_value', width: 140, align: 'right', render: (row: any) => currencyPlain(row.market_value) },
  { title: '成本', key: 'cost_basis', width: 140, align: 'right', render: (row: any) => currencyPlain(row.cost_basis) },
  { title: '备注', key: 'note', ellipsis: { tooltip: true } },
]

function initChart(perf: ReturnType<typeof useFinance>['investmentPerformance']['value'][number]) {
  const el = chartRefs[perf.account.id]
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return

  const existing = echarts.getInstanceByDom(el)
  if (existing) existing.dispose()

  const chart = echarts.init(el, isDarkMode() ? 'dark' : undefined)
  const snapshots = [...perf.snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const ax = axisStyle()
  const tt = chartTT()
  chart.setOption({
    tooltip: { trigger: 'axis', ...tt, formatter: (params: any) => `${params[0].axisValue}<br/>市值: ¥${Number(params[0].data).toLocaleString()}` },
    grid: { left: 56, right: 24, top: 16, bottom: 28 },
    xAxis: {
      type: 'category', data: snapshots.map(s => s.date),
      axisLabel: { color: ax.labelColor, fontSize: 11 },
      axisLine: { lineStyle: { color: ax.lineColor } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: ax.splitColor } },
      axisLabel: { color: ax.labelColor, formatter: (v: number) => '¥' + (v / 10000).toFixed(0) + '万' },
    },
    series: [{
      type: 'line', data: snapshots.map(s => Number(s.market_value)), smooth: true,
      lineStyle: { color: '#4C9AFF', width: 2.5 }, itemStyle: { color: '#4C9AFF' },
      symbol: 'circle', symbolSize: 6,
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(76,154,255,0.2)' },
          { offset: 1, color: 'rgba(76,154,255,0.01)' },
        ]),
      },
    }],
  })
  requestAnimationFrame(() => chart.resize())

  const obs = new ResizeObserver(() => chart.resize())
  obs.observe(el)
  observers.push(obs)

  charts[perf.account.id] = chart
}

onMounted(() => {
  requestAnimationFrame(() => {
    setTimeout(() => investmentPerformance.value.forEach(initChart), 150)
  })
})

onUnmounted(() => {
  observers.forEach(o => o.disconnect())
  Object.values(charts).forEach(c => c.dispose())
})
</script>

<style scoped>
.invest-page { padding: 28px 32px; max-width: 1400px; }
.page-header { margin-bottom: 24px; }
.page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }

.glass-card { padding: 20px 24px; }
.invest-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.invest-stat { display: flex; flex-direction: column; gap: 6px; }
.invest-stat-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.invest-stat-value { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.invest-stat-sub { font-size: 12px; color: var(--text-muted); }

.invest-detail { display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px; }
.detail-header-card { display: flex; flex-direction: column; gap: 16px; }
.detail-account-name { font-size: 16px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; }
.detail-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.metric { display: flex; flex-direction: column; gap: 4px; }
.metric-label { font-size: 12px; color: var(--text-secondary); }
.metric-value { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.metric--highlight { font-size: 22px; }

.chart-card { display: flex; flex-direction: column; gap: 12px; }
.card-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.chart-container { width: 100%; height: 280px; min-height: 200px; }
.snapshot-table-card { display: flex; flex-direction: column; gap: 12px; }

.text-green { color: #36B37E; }
.text-red { color: #FF5630; }
.empty-state { text-align: center; padding: 48px; color: var(--text-muted); }
</style>
