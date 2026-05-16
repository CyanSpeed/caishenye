<template>
  <div class="dashboard">
    <!-- Row 1: 统计卡片 -->
    <div class="stat-row">
      <div class="glass-card stat-card" v-for="stat in statCards" :key="stat.key">
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-value" :class="stat.colorClass" :ref="el => statRefs[stat.key] = el">
          {{ stat.prefix }}{{ stat.displayValue }}
        </div>
        <div class="stat-sub" v-if="stat.sub">{{ stat.sub }}</div>
      </div>
    </div>

    <!-- Row 2: 净资产趋势图（全宽） -->
    <div class="glass-card chart-card">
      <div class="card-title">
        <span>净资产趋势</span>
        <div class="time-switcher">
          <button
            v-for="opt in timeRangeOptions"
            :key="opt.value"
            class="time-btn"
            :class="{ active: selectedTimeRange === opt.value }"
            @click="setTimeRange(opt.value)"
          >{{ opt.label }}</button>
        </div>
      </div>
      <div ref="netWorthChartRef" class="chart-box chart-box--tall"></div>
    </div>

    <!-- Row 3: 资产概览 + 负债概览 -->
    <div class="charts-row">
      <div class="glass-card chart-card">
        <div class="card-title">资产概览</div>
        <div ref="compositionChartRef" class="chart-box"></div>
      </div>
      <div class="glass-card chart-card">
        <div class="card-title">负债概览</div>
        <div ref="liabilityChartRef" class="chart-box"></div>
      </div>
    </div>

    <!-- Row 4: 月度收支对比（全宽） -->
    <div class="glass-card chart-card">
      <div class="card-title">月度收支对比</div>
      <div ref="comparisonChartRef" class="chart-box chart-box--tall"></div>
    </div>

    <!-- Row 5: 收支流向桑基图（全宽） -->
    <div class="glass-card chart-card">
      <div class="card-title">收支流向</div>
      <div ref="sankeyChartRef" class="chart-box chart-box--tall"></div>
    </div>

    <!-- Row 6: 实物资产折旧分析 + 近期动态 -->
    <div class="bottom-row">
      <div class="glass-card chart-card">
        <div class="card-title">
          <span>实物资产折旧分析</span>
          <div class="time-switcher">
            <button
              v-for="opt in depreciationTimeOptions"
              :key="opt.value"
              class="time-btn"
              :class="{ active: selectedDepreciationRange === opt.value }"
              @click="setDepreciationRange(opt.value)"
            >{{ opt.label }}</button>
          </div>
        </div>
        <div ref="depreciationChartRef" class="chart-box"></div>
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
  liabilityOverview,
  recentTransactions,
  netWorthTrend, assetComposition, cashFlowData,
  monthlyComparison, physicalAssetsDepreciation,
  getAccountById, getCategoryById,
} = useFinance()
const { currencyPlain, shortDate } = useFormatter()

// ---- Time Range Switcher ----
const timeRangeOptions = [
  { label: '近半年', value: '6m' },
  { label: '近1年', value: '1y' },
  { label: '近3年', value: '3y' },
  { label: '近5年', value: '5y' },
  { label: '全部', value: 'all' },
]
const selectedTimeRange = ref('1y')

function getDataZoomRange(range: string): { start: number; end: number } {
  const total = netWorthTrend.value.length
  if (total === 0) return { start: 0, end: 100 }
  switch (range) {
    case '6m': return { start: Math.max(0, 100 - (6 / total) * 100), end: 100 }
    case '1y': return { start: Math.max(0, 100 - (12 / total) * 100), end: 100 }
    case '3y': return { start: Math.max(0, 100 - (36 / total) * 100), end: 100 }
    case '5y': return { start: Math.max(0, 100 - (60 / total) * 100), end: 100 }
    case 'all': return { start: 0, end: 100 }
    default: return { start: Math.max(0, 100 - (12 / total) * 100), end: 100 }
  }
}

function setTimeRange(range: string) {
  selectedTimeRange.value = range
  if (!netWorthChart) return
  const { start, end } = getDataZoomRange(range)
  netWorthChart.dispatchAction({
    type: 'dataZoom',
    start,
    end,
  })
}

// ---- Depreciation Time Range ----
const depreciationTimeOptions = [
  { label: '近半年', value: '6m' },
  { label: '近1年', value: '1y' },
  { label: '近3年', value: '3y' },
  { label: '全部', value: 'all' },
]
const selectedDepreciationRange = ref('all')

function setDepreciationRange(range: string) {
  selectedDepreciationRange.value = range
  initDepreciationChart()
}

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
const liabilityChartRef = ref<HTMLElement | null>(null)
const netWorthChartRef = ref<HTMLElement | null>(null)
const compositionChartRef = ref<HTMLElement | null>(null)
const comparisonChartRef = ref<HTMLElement | null>(null)
const sankeyChartRef = ref<HTMLElement | null>(null)
const depreciationChartRef = ref<HTMLElement | null>(null)

let liabilityChart: echarts.ECharts | null = null
let netWorthChart: echarts.ECharts | null = null
let compositionChart: echarts.ECharts | null = null
let comparisonChart: echarts.ECharts | null = null
let sankeyChart: echarts.ECharts | null = null
let depreciationChart: echarts.ECharts | null = null
const observers: ResizeObserver[] = []

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

function initLiabilityChart() {
  liabilityChart = initChart(liabilityChartRef.value, 'liability', (chart) => {
    const data = liabilityOverview.value
    const textColor = chartTextColor()
    const tt = chartTooltipStyle()
    const colors = ['#FBBF24', '#F87171', '#60A5FA', '#A78BFA']
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}: ¥${p.value.toLocaleString()} (${p.percent}%)`,
        ...tt,
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        textStyle: { color: textColor, fontSize: 12 },
      },
      series: [{
        type: 'pie',
        radius: ['40%', '75%'],
        center: ['50%', '42%'],
        roseType: 'area',
        itemStyle: { borderRadius: 10, borderColor: isDarkMode() ? '#1a1a2e' : '#fff', borderWidth: 4 },
        label: { show: false },
        emphasis: {
          scaleSize: 8,
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: textColor },
        },
        data: data.map((d, i) => ({
          name: d.name, value: d.value,
          itemStyle: { color: colors[i % colors.length] },
        })),
      }],
    })
  })
}

function initNetWorthTrendChart() {
  const { start, end } = getDataZoomRange(selectedTimeRange.value)

  netWorthChart = initChart(netWorthChartRef.value, 'netWorth', (chart) => {
    const data = netWorthTrend.value
    const textColor = chartTextColor()
    const lineColor = chartLineColor()
    const splitColor = chartSplitColor()
    const tt = chartTooltipStyle()

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross', lineStyle: { color: 'rgba(96,165,250,0.3)', type: 'dashed' } },
        formatter: (params: any) => {
          const p = params[0]
          const idx = p.dataIndex
          const val = Number(p.value)
          const dateLabel = data[idx]?.month || p.axisValue
          // 环比增长率
          let growthHtml = ''
          if (idx > 0) {
            const prev = Number(data[idx - 1].value)
            if (prev !== 0) {
              const rate = ((val - prev) / Math.abs(prev)) * 100
              const color = rate >= 0 ? '#10B981' : '#F87171'
              const sign = rate >= 0 ? '+' : ''
              growthHtml = `<br/><span style="color:${color}">较上月 ${sign}${rate.toFixed(1)}%</span>`
            }
          }
          return `<div style="font-size:13px">
            <div style="color:#9CA3AF;margin-bottom:4px">${dateLabel}</div>
            <div style="font-weight:600;font-size:16px">¥${val.toLocaleString()}</div>
            ${growthHtml}
          </div>`
        },
        ...tt,
      },
      grid: { left: 70, right: 24, top: 24, bottom: 60 },
      xAxis: {
        type: 'category',
        data: data.map(d => d.month),
        axisLabel: { color: textColor, fontSize: 11 },
        axisLine: { lineStyle: { color: lineColor } },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitColor } },
        axisLabel: {
          color: textColor,
          formatter: (v: number) => v >= 10000 ? (v / 10000).toFixed(1) + '万' : String(v),
        },
      },
      dataZoom: [
        {
          type: 'slider',
          show: true,
          bottom: 8,
          height: 24,
          start,
          end,
          borderColor: 'transparent',
          backgroundColor: isDarkMode() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          fillerColor: isDarkMode() ? 'rgba(96,165,250,0.15)' : 'rgba(96,165,250,0.12)',
          handleIcon: 'path://M10.7,11.9H9.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z',
          handleSize: '80%',
          handleStyle: {
            color: '#60A5FA',
            borderColor: '#60A5FA',
            shadowBlur: 4,
            shadowColor: 'rgba(96,165,250,0.3)',
            shadowOffsetY: 2,
          },
          textStyle: { color: textColor, fontSize: 10 },
          dataBackground: {
            lineStyle: { color: 'rgba(96,165,250,0.3)', width: 1 },
            areaStyle: { color: 'rgba(96,165,250,0.08)' },
          },
          selectedDataBackground: {
            lineStyle: { color: '#60A5FA', width: 1 },
            areaStyle: { color: 'rgba(96,165,250,0.15)' },
          },
          emphasis: {
            handleStyle: { color: '#3B82F6', borderColor: '#3B82F6' },
          },
        },
        {
          type: 'inside',
          start,
          end,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
      ],
      series: [{
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: data.map(d => d.value),
        lineStyle: { color: '#60A5FA', width: 3 },
        itemStyle: { color: '#60A5FA', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(96, 165, 250, 0.35)' },
              { offset: 0.7, color: 'rgba(96, 165, 250, 0.08)' },
              { offset: 1, color: 'rgba(96, 165, 250, 0.01)' },
            ],
          },
        },
        animationDuration: 1500,
        animationEasing: 'cubicOut',
      }],
    })
  })

  // GSAP 生长动画
  if (netWorthChartRef.value) {
    gsap.fromTo(netWorthChartRef.value,
      { clipPath: 'inset(0 100% 0 0)' },
      { clipPath: 'inset(0 0% 0 0)', duration: 1.8, ease: 'power2.out' }
    )
  }
}

function initCompositionChart() {
  compositionChart = initChart(compositionChartRef.value, 'composition', (chart) => {
    const data = assetComposition.value
    const textColor = chartTextColor()
    const tt = chartTooltipStyle()
    const colors = ['#60A5FA', '#A78BFA', '#FBBF24', '#F87171']
    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${p.name}: ¥${p.value.toLocaleString()} (${p.percent}%)`,
        ...tt,
      },
      legend: {
        orient: 'horizontal',
        bottom: 0,
        textStyle: { color: textColor, fontSize: 12 },
      },
      series: [{
        type: 'pie',
        radius: ['40%', '75%'],
        center: ['50%', '42%'],
        roseType: 'area',
        itemStyle: { borderRadius: 10, borderColor: isDarkMode() ? '#1a1a2e' : '#fff', borderWidth: 4 },
        label: { show: false },
        emphasis: {
          scaleSize: 8,
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: textColor },
        },
        data: data.map((d, i) => ({
          name: d.name, value: d.value,
          itemStyle: { color: colors[i % colors.length] },
        })),
      }],
    })
  })
}

function initComparisonChart() {
  comparisonChart = initChart(comparisonChartRef.value, 'comparison', (chart) => {
    const data = monthlyComparison.value
    const textColor = chartTextColor()
    const lineColor = chartLineColor()
    const splitColor = chartSplitColor()
    const tt = chartTooltipStyle()
    chart.setOption({
      tooltip: { trigger: 'axis', ...tt },
      legend: { data: ['收入', '支出'], textStyle: { color: textColor }, bottom: 0 },
      grid: { left: 60, right: 24, top: 20, bottom: 40 },
      xAxis: {
        type: 'category',
        data: data.map(d => d.month + '月'),
        axisLabel: { color: textColor, fontSize: 10, rotate: 30 },
        axisLine: { lineStyle: { color: lineColor } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: splitColor } },
        axisLabel: {
          color: textColor,
          formatter: (v: number) => v >= 10000 ? (v / 10000).toFixed(0) + '万' : String(v),
        },
      },
      series: [
        {
          name: '收入', type: 'bar',
          data: data.map(d => d.income),
          itemStyle: { color: '#10B981', borderRadius: [6, 6, 0, 0] },
          barWidth: '35%',
          barGap: '20%',
          label: {
            show: true, position: 'top', fontSize: 10, color: '#10B981',
            formatter: (p: any) => p.value >= 10000 ? (p.value / 10000).toFixed(1) + '万' : '',
          },
        },
        {
          name: '支出', type: 'bar',
          data: data.map(d => -d.expense),
          itemStyle: { color: '#F87171', borderRadius: [0, 0, 6, 6] },
          barWidth: '35%',
          label: {
            show: true, position: 'bottom', fontSize: 10, color: '#F87171',
            formatter: (p: any) => {
              const v = Math.abs(p.value)
              return v >= 10000 ? '-' + (v / 10000).toFixed(1) + '万' : ''
            },
          },
        },
      ],
    })
  })
}

function initSankeyChart() {
  sankeyChart = initChart(sankeyChartRef.value, 'sankey', (chart) => {
    const { incomeNodes, expenseNodes, links } = cashFlowData.value
    const textColor = chartTextColor()
    const tt = chartTooltipStyle()

    // 构建桑基图节点
    const allNodes: { name: string }[] = []
    incomeNodes.forEach(n => allNodes.push({ name: n.name }))
    expenseNodes.forEach(n => allNodes.push({ name: n.name }))

    // 构建链接
    const sankeyLinks = links.map(l => ({
      source: l.source,
      target: l.target,
      value: l.value,
    }))

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => {
          if (p.dataType === 'edge') {
            return `${p.data.source} → ${p.data.target}<br/>¥${p.data.value.toLocaleString()}`
          }
          return `${p.name}<br/>¥${p.value.toLocaleString()}`
        },
        ...tt,
      },
      series: [{
        type: 'sankey',
        layout: 'none',
        left: 20,
        right: 20,
        top: 20,
        bottom: 20,
        nodeWidth: 20,
        nodeGap: 16,
        orient: 'horizontal',
        draggable: false,
        label: {
          color: textColor,
          fontSize: 12,
          formatter: '{b}\n¥{c}',
        },
        lineStyle: {
          color: 'gradient',
          curveness: 0.5,
          opacity: 0.4,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { opacity: 0.7 },
        },
        itemStyle: { borderWidth: 0 },
        data: allNodes.map(n => {
          const isIncome = incomeNodes.some(i => i.name === n.name)
          return {
            name: n.name,
            itemStyle: { color: isIncome ? '#10B981' : '#F87171' },
          }
        }),
        links: sankeyLinks,
      }],
    })
  })
}

function initDepreciationChart() {
  depreciationChart = initChart(depreciationChartRef.value, 'depreciation', (chart) => {
    const assets = physicalAssetsDepreciation.value
    const textColor = chartTextColor()
    const lineColor = chartLineColor()
    const splitColor = chartSplitColor()
    const tt = chartTooltipStyle()
    const colors = ['#60A5FA', '#A78BFA', '#FBBF24', '#F87171', '#34D399']

    // 根据时间范围过滤数据点
    const now = new Date()
    let cutoffDate = ''
    switch (selectedDepreciationRange.value) {
      case '6m': {
        const d = new Date(now); d.setMonth(d.getMonth() - 6)
        cutoffDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        break
      }
      case '1y': {
        const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
        cutoffDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        break
      }
      case '3y': {
        const d = new Date(now); d.setFullYear(d.getFullYear() - 3)
        cutoffDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        break
      }
      default: cutoffDate = ''
    }

    // 收集所有日期并统一X轴（按时间范围过滤）
    const allDates = new Set<string>()
    assets.forEach(a => a.points.forEach(p => {
      if (!cutoffDate || p.date >= cutoffDate) allDates.add(p.date)
    }))
    const sortedDates = [...allDates].sort()

    chart.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          let html = `<b>${params[0].axisValue}</b><br/>`
          params.forEach((p: any) => {
            if (p.value != null) html += `${p.marker} ${p.seriesName}: ¥${Number(p.value).toLocaleString()}<br/>`
          })
          return html
        },
        ...tt,
      },
      legend: {
        data: assets.map(a => a.icon + ' ' + a.name),
        textStyle: { color: textColor, fontSize: 11 },
        bottom: 0,
        type: 'scroll',
      },
      grid: { left: 60, right: 24, top: 16, bottom: 48 },
      xAxis: {
        type: 'category',
        data: sortedDates.map(d => d.slice(2)),
        axisLabel: { color: textColor, fontSize: 10, rotate: 30 },
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
      series: assets.map((asset, i) => ({
        name: asset.icon + ' ' + asset.name,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: sortedDates.map(date => {
          const point = asset.points.find(p => p.date === date)
          return point ? point.value : null
        }),
        lineStyle: { color: colors[i % colors.length], width: 2 },
        itemStyle: { color: colors[i % colors.length] },
        connectNulls: true,
        animationDuration: 800,
        animationEasing: 'cubicOut',
      })),
    })
  })
}

function initAllCharts() {
  initLiabilityChart()
  initNetWorthTrendChart()
  initCompositionChart()
  initComparisonChart()
  initSankeyChart()
  initDepreciationChart()
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
  liabilityChart?.dispose()
  netWorthChart?.dispose()
  compositionChart?.dispose()
  comparisonChart?.dispose()
  sankeyChart?.dispose()
  depreciationChart?.dispose()
})
</script>

<style scoped>
.dashboard {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1400px;
}

.glass-card { padding: 24px 28px; }

/* Stat Row */
.stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.stat-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: '';
  position: absolute;
  top: -20px;
  right: -20px;
  width: 100px;
  height: 100px;
  border-radius: 50%;
  opacity: 0.1;
  pointer-events: none;
}
.stat-card:nth-child(1)::before { background: linear-gradient(135deg, #60A5FA, #A78BFA); }
.stat-card:nth-child(2)::before { background: linear-gradient(135deg, #10B981, #34D399); }
.stat-card:nth-child(3)::before { background: linear-gradient(135deg, #F87171, #FBBF24); }
.stat-label {
  font-size: 16px;
  color: #1F2937;
  font-weight: 600;
  letter-spacing: 0;
}
.stat-value {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  color: #1F2937;
}
.stat-sub {
  font-size: 13px;
  color: #9CA3AF;
}

.text-green { color: #10B981; }
.text-red { color: #F87171; }
.text-blue { color: #60A5FA; }

/* Charts */
.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.bottom-row { display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px; }
.chart-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #1F2937;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Time Range Switcher (Segmented Control) */
.time-switcher {
  display: flex;
  gap: 2px;
  background: var(--border-subtle);
  border-radius: 10px;
  padding: 3px;
}
.time-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
}
.time-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}
.time-btn.active {
  color: #3B82F6;
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.chart-box { width: 100%; height: 280px; min-height: 200px; }
.chart-box--tall { height: 320px; min-height: 260px; }

/* Recent */
.recent-card { display: flex; flex-direction: column; gap: 16px; }
.recent-list { display: flex; flex-direction: column; gap: 4px; }
.recent-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  transition: background-color 0.2s ease;
}
.recent-item:last-child { border-bottom: none; padding-bottom: 0; }
.recent-item:hover { background-color: rgba(0, 0, 0, 0.02); border-radius: 12px; }
.recent-icon {
  width: 40px; height: 40px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.icon--income { background: rgba(16, 185, 129, 0.1); color: #10B981; }
.icon--expense { background: rgba(248, 113, 113, 0.1); color: #F87171; }
.icon--transfer { background: rgba(96, 165, 250, 0.1); color: #60A5FA; }
.recent-info { flex: 1; min-width: 0; }
.recent-desc {
  font-size: 14px;
  color: #1F2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}
.recent-meta { font-size: 12px; color: #9CA3AF; margin-top: 4px; }
.recent-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
