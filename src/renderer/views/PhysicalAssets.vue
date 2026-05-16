<template>
  <div class="pa-page">
    <!-- Header -->
    <div class="page-header">
      <h2 class="page-title">实物资产</h2>
      <n-button type="primary" @click="showAddModal = true">
        <template #icon><PlusOutlined /></template>
        添加物品
      </n-button>
    </div>

    <!-- Summary Cards -->
    <div class="summary-row">
      <div class="glass-card summary-card">
        <div class="summary-label">物品总价值</div>
        <div class="summary-value">{{ currencyPlain(totalValue) }}</div>
        <div class="summary-sub">{{ items.length }} 件物品</div>
      </div>
      <div class="glass-card summary-card">
        <div class="summary-label">当前估值</div>
        <div class="summary-value" :class="totalDepreciation.isNegative() ? 'text-red' : 'text-green'">
          {{ currencyPlain(totalCurrentValue) }}
        </div>
        <div class="summary-sub">
          累计折旧 {{ currencyPlain(totalDepreciation.abs()) }}
        </div>
      </div>
      <div class="glass-card summary-card">
        <div class="summary-label">日均使用成本</div>
        <div class="summary-value">{{ currencyPlain(avgDailyCost) }}</div>
        <div class="summary-sub">所有物品加权平均</div>
      </div>
    </div>

    <!-- Overview Depreciation Chart -->
    <div class="glass-card overview-chart-card">
      <div class="card-title-row">
        <span class="card-title">实物资产折旧分析</span>
        <div class="title-controls">
          <div class="time-switcher">
            <button
              v-for="opt in overviewTimeOptions"
              :key="opt.value"
              class="time-btn"
              :class="{ active: selectedOverviewRange === opt.value }"
              @click="setOverviewRange(opt.value)"
            >{{ opt.label }}</button>
          </div>
          <div class="asset-selector" ref="selectorRef">
            <button class="selector-btn" @click="showAssetSelector = !showAssetSelector">
              <span>选择资产 ({{ displayAssets.length }})</span>
              <span class="selector-arrow">{{ showAssetSelector ? '▲' : '▼' }}</span>
            </button>
            <Transition name="fade">
              <div v-if="showAssetSelector" class="selector-popover" @click.stop>
                <div class="selector-header">
                  <span class="selector-title">选择要展示的资产</span>
                </div>
                <div class="selector-list">
                  <div
                    v-for="asset in allPhysicalAssetsDepreciation"
                    :key="asset.id"
                    class="selector-item"
                    :class="{ selected: displayAssets.some(a => a.id === asset.id) }"
                    @click="toggleAsset(asset.id)"
                  >
                    <div class="selector-item-left">
                      <span class="selector-emoji">{{ asset.icon }}</span>
                      <span class="selector-name">{{ asset.name }}</span>
                    </div>
                    <div class="selector-check" :class="{ checked: displayAssets.some(a => a.id === asset.id) }">
                      <span v-if="displayAssets.some(a => a.id === asset.id)">✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </div>
      <div ref="overviewChartRef" class="overview-chart-box"></div>
    </div>

    <!-- Category Tabs -->
    <div class="tabs-row">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.emoji }} {{ tab.label }}
        <span class="tab-count">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Asset Cards Grid -->
    <TransitionGroup name="card-grid" tag="div" class="asset-grid">
      <div
        v-for="item in filteredAssets"
        :key="item.id"
        class="glass-card asset-card"
        :class="{ 'card--expanded': expandedId === item.id }"
        @click="toggleExpand(item.id)"
      >
        <!-- Card Top: always visible -->
        <div class="card-top">
          <div class="asset-emoji">{{ item.icon_emoji }}</div>
          <div class="asset-info">
            <div class="asset-name">{{ item.name }}</div>
            <div class="asset-meta">
              <span class="category-badge" :class="'cat--' + item.category">{{ item.category }}</span>
              <span class="status-dot" :class="statusClass(item.status)">{{ item.status }}</span>
            </div>
          </div>
          <div class="asset-stats">
            <div class="stat-primary">
              <span class="stat-num">{{ daysUsed(item) }}</span>
              <span class="stat-unit">天</span>
            </div>
            <div class="stat-secondary">{{ currencyPlain(dailyCost(item)) }}/天</div>
          </div>
        </div>

        <!-- Card Detail: expand on click -->
        <Transition name="expand">
          <div v-if="expandedId === item.id" class="card-detail" @click.stop>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">购买价格</span>
                <span class="detail-value">{{ currencyPlain(item.purchase_price) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">当前估值</span>
                <span class="detail-value" :class="valueColor(item)">
                  {{ currencyPlain(item.current_value) }}
                </span>
              </div>
              <div class="detail-item">
                <span class="detail-label">购买日期</span>
                <span class="detail-value">{{ item.purchase_date }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">已用天数</span>
                <span class="detail-value">{{ daysUsed(item) }} 天</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">日均成本</span>
                <span class="detail-value highlight">{{ currencyPlain(dailyCost(item)) }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">折旧率</span>
                <span class="detail-value" :class="depreciationRate(item) > 30 ? 'text-red' : 'text-muted'">
                  {{ depreciationRate(item).toFixed(1) }}%
                </span>
              </div>
            </div>
            <div v-if="item.notes" class="detail-notes">{{ item.notes }}</div>

            <!-- Depreciation Chart -->
            <div class="detail-chart">
              <div class="chart-title">价值变动趋势</div>
              <div :ref="el => setChartRef(item.id, el)" class="chart-box"></div>
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>

    <!-- Empty State -->
    <div v-if="filteredAssets.length === 0" class="glass-card empty-state">
      <p>暂无{{ activeTab === 'all' ? '' : activeTab }}类物品</p>
    </div>

    <!-- Add Modal -->
    <n-modal v-model:show="showAddModal" preset="card" title="添加实物资产" style="width: 520px;">
      <n-form ref="addFormRef" :model="addForm" label-placement="left" label-width="80">
        <n-form-item label="物品名称" path="name" :rule="{ required: true, message: '请输入名称' }">
          <n-input v-model:value="addForm.name" placeholder="例如：iPhone 16 Pro Max" />
        </n-form-item>
        <n-form-item label="分类" path="category">
          <n-select v-model:value="addForm.category" :options="categoryOptions" placeholder="选择分类" />
        </n-form-item>
        <n-form-item label="图标" path="icon_emoji">
          <n-input v-model:value="addForm.icon_emoji" placeholder="选择一个Emoji" maxlength="4" />
        </n-form-item>
        <n-form-item label="购买价格" path="purchase_price">
          <n-input-number v-model:value="addForm.purchase_price" :min="0" :style="{ width: '100%' }">
            <template #prefix>¥</template>
          </n-input-number>
        </n-form-item>
        <n-form-item label="当前估值" path="current_value">
          <n-input-number v-model:value="addForm.current_value" :min="0" :style="{ width: '100%' }">
            <template #prefix>¥</template>
          </n-input-number>
        </n-form-item>
        <n-form-item label="购买日期" path="purchase_date">
          <n-date-picker v-model:formatted-value="addForm.purchase_date" type="date" :style="{ width: '100%' }" />
        </n-form-item>
        <n-form-item label="备注" path="notes">
          <n-input v-model:value="addForm.notes" placeholder="如：保修期、型号等" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showAddModal = false">取消</n-button>
          <n-button type="primary" @click="handleAdd">确认添加</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import Decimal from 'decimal.js'
import {
  NButton, NModal, NForm, NFormItem, NInput, NInputNumber,
  NSelect, NDatePicker, NSpace, useMessage,
} from 'naive-ui'
import { PlusOutlined } from '@vicons/antd'
import { useFinance } from '../composables/useFinance'
import type { PhysicalAsset, PhysicalAssetCategory, PhysicalAssetStatus } from '@shared/types'
import { useFormatter } from '../composables/useFormatter'
import type { SelectOption } from 'naive-ui'

const { currencyPlain } = useFormatter()
const { state: financeState, addPhysicalAsset: createPhysicalAsset, physicalAssetsDepreciation, allPhysicalAssetsDepreciation } = useFinance()
const message = useMessage()

// ---- Reactive state ----
const items = computed(() => financeState.physicalAssets)
const activeTab = ref<'all' | PhysicalAssetCategory>('all')
const expandedId = ref<number | null>(null)
const showAddModal = ref(false)
const addFormRef = ref()

const today = new Date()
const todayStr = today.toISOString().slice(0, 10)

const addForm = ref({
  name: '',
  category: '数码' as PhysicalAssetCategory,
  icon_emoji: '',
  purchase_price: null as number | null,
  current_value: null as number | null,
  purchase_date: todayStr,
  notes: '',
})

const categoryOptions: SelectOption[] = [
  { label: '家电', value: '家电' },
  { label: '数码', value: '数码' },
  { label: '汽车', value: '汽车' },
  { label: '奢侈品', value: '奢侈品' },
  { label: '房产', value: '房产' },
]

// ---- Tabs ----
const tabs = computed(() => {
  const counts: Record<string, number> = { all: items.value.length }
  items.value.forEach(i => {
    counts[i.category] = (counts[i.category] || 0) + 1
  })
  return [
    { key: 'all' as const, label: '全部', emoji: '📦', count: counts.all || 0 },
    { key: '家电' as const, label: '家电', emoji: '📺', count: counts['家电'] || 0 },
    { key: '数码' as const, label: '数码', emoji: '📱', count: counts['数码'] || 0 },
    { key: '汽车' as const, label: '汽车', emoji: '🚗', count: counts['汽车'] || 0 },
    { key: '奢侈品' as const, label: '奢侈品', emoji: '💎', count: counts['奢侈品'] || 0 },
    { key: '房产' as const, label: '房产', emoji: '🏠', count: counts['房产'] || 0 },
  ]
})

const filteredAssets = computed(() => {
  if (activeTab.value === 'all') return items.value
  return items.value.filter(i => i.category === activeTab.value)
})

// ---- Computed stats ----
const totalValue = computed(() =>
  items.value.reduce((s, i) => s.plus(new Decimal(i.purchase_price)), new Decimal(0))
)
const totalCurrentValue = computed(() =>
  items.value.reduce((s, i) => s.plus(new Decimal(i.current_value)), new Decimal(0))
)
const totalDepreciation = computed(() =>
  totalCurrentValue.value.minus(totalValue.value)
)
const avgDailyCost = computed(() => {
  if (items.value.length === 0) return new Decimal(0)
  let total = new Decimal(0)
  let totalDays = 0
  items.value.forEach(i => {
    const days = calcDays(i.purchase_date)
    if (days > 0) {
      total = total.plus(new Decimal(i.purchase_price))
      totalDays += days
    }
  })
  return totalDays > 0 ? total.div(totalDays) : new Decimal(0)
})

// ---- Helpers ----
function calcDays(dateStr: string): number {
  const d = new Date(dateStr)
  return Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000))
}

function daysUsed(item: PhysicalAsset): number {
  return calcDays(item.purchase_date)
}

function dailyCost(item: PhysicalAsset): Decimal {
  const days = calcDays(item.purchase_date)
  return days > 0 ? new Decimal(item.purchase_price).div(days) : new Decimal(item.purchase_price)
}

function depreciationRate(item: PhysicalAsset): number {
  const price = Number(item.purchase_price)
  const value = Number(item.current_value)
  if (price === 0) return 0
  return ((price - value) / price) * 100
}

function valueColor(item: PhysicalAsset): string {
  const rate = depreciationRate(item)
  if (rate > 30) return 'text-red'
  if (rate > 10) return 'text-orange'
  return 'text-green'
}

function statusClass(status: PhysicalAssetStatus): string {
  return status === '使用中' ? 'dot--active' : status === '已出售' ? 'dot--sold' : 'dot--scrapped'
}

function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}

// ---- Add asset ----
async function handleAdd() {
  addFormRef.value?.validate(async (errors: any) => {
    if (errors) return
    try {
      await createPhysicalAsset({
        name: addForm.value.name,
        category: addForm.value.category,
        icon_emoji: addForm.value.icon_emoji || '📦',
        purchase_price: String(addForm.value.purchase_price ?? 0),
        purchase_date: addForm.value.purchase_date,
        current_value: String(addForm.value.current_value ?? addForm.value.purchase_price ?? 0),
        image_url: '',
        notes: addForm.value.notes,
        status: '使用中',
      })
      message.success('添加成功')
      showAddModal.value = false
      addForm.value = { name: '', category: '数码', icon_emoji: '', purchase_price: null, current_value: null, purchase_date: todayStr, notes: '' }
    } catch {
      message.error('添加失败')
    }
  })
}

// ---- Depreciation Chart ----
const chartRefs: Record<number, HTMLElement | null> = {}
const charts: Record<number, echarts.ECharts> = {}
const observers: ResizeObserver[] = []

function setChartRef(id: number, el: any) { if (el) chartRefs[id] = el }

function isDark() { return document.documentElement.classList.contains('theme-dark') }

// ---- Overview Depreciation Chart ----
const overviewChartRef = ref<HTMLElement | null>(null)
let overviewChart: echarts.ECharts | null = null

const overviewTimeOptions = [
  { label: '近半年', value: '6m' },
  { label: '近1年', value: '1y' },
  { label: '近3年', value: '3y' },
  { label: '全部', value: 'all' },
]
const selectedOverviewRange = ref('all')

function setOverviewRange(range: string) {
  selectedOverviewRange.value = range
  initOverviewDepreciationChart()
}

// ---- Asset Selector ----
const showAssetSelector = ref(false)
const selectorRef = ref<HTMLElement | null>(null)
const selectedAssetIds = ref<number[]>([])
const selectionMade = ref(false)

const displayAssets = computed(() => {
  if (!selectionMade.value) return physicalAssetsDepreciation.value
  const all = allPhysicalAssetsDepreciation.value
  const selected = all.filter(a => selectedAssetIds.value.includes(a.id))
  return selected.length > 0 ? selected : all.slice(0, 5)
})

function toggleAsset(id: number) {
  const idx = selectedAssetIds.value.indexOf(id)
  if (idx >= 0) {
    selectedAssetIds.value.splice(idx, 1)
  } else {
    selectedAssetIds.value.push(id)
  }
  selectionMade.value = true
  initOverviewDepreciationChart()
}

function handleClickOutside(e: MouseEvent) {
  if (selectorRef.value && !selectorRef.value.contains(e.target as Node)) {
    showAssetSelector.value = false
  }
}

function initOverviewDepreciationChart() {
  if (!overviewChartRef.value || overviewChartRef.value.clientWidth === 0) return
  const existing = echarts.getInstanceByDom(overviewChartRef.value)
  if (existing) existing.dispose()

  overviewChart = echarts.init(overviewChartRef.value, isDark() ? 'dark' : undefined)
  const assets = displayAssets.value
  const textColor = isDark() ? '#8B949E' : '#656D76'
  const lineColor = isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const splitColor = isDark() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
  const ttBg = isDark() ? 'rgba(13,17,23,0.95)' : 'rgba(255,255,255,0.95)'
  const ttBorder = isDark() ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
  const colors = ['#60A5FA', '#A78BFA', '#FBBF24', '#F87171', '#34D399']

  // 时间范围过滤
  const now = new Date()
  let cutoffDate = ''
  switch (selectedOverviewRange.value) {
    case '6m': { const d = new Date(now); d.setMonth(d.getMonth() - 6); cutoffDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; break }
    case '1y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); cutoffDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; break }
    case '3y': { const d = new Date(now); d.setFullYear(d.getFullYear() - 3); cutoffDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; break }
    default: cutoffDate = ''
  }

  const allDates = new Set<string>()
  assets.forEach(a => a.points.forEach(p => {
    if (!cutoffDate || p.date >= cutoffDate) allDates.add(p.date)
  }))
  const sortedDates = [...allDates].sort()

  overviewChart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: ttBg,
      borderColor: ttBorder,
      formatter: (params: any) => {
        let html = `<b>${params[0].axisValue}</b><br/>`
        params.forEach((p: any) => {
          if (p.value != null) html += `${p.marker} ${p.seriesName}: ¥${Number(p.value).toLocaleString()}<br/>`
        })
        return html
      },
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

  requestAnimationFrame(() => overviewChart!.resize())
  const obs = new ResizeObserver(() => overviewChart?.resize())
  obs.observe(overviewChartRef.value)
  observers.push(obs)
}

const DEPRECIATION_YEARS: Record<string, number> = {
  '家电': 5, '数码': 3, '汽车': 10, '奢侈品': 20, '房产': 40,
}

function initDepreciationChart(item: PhysicalAsset) {
  const el = chartRefs[item.id]
  if (!el || el.clientWidth === 0 || el.clientHeight === 0) return
  const existing = echarts.getInstanceByDom(el)
  if (existing) existing.dispose()

  const chart = echarts.init(el, isDark() ? 'dark' : undefined)
  const purchaseDate = new Date(item.purchase_date)
  const maxYears = DEPRECIATION_YEARS[item.category] || 5
  const endDate = new Date(purchaseDate)
  endDate.setFullYear(endDate.getFullYear() + maxYears)
  const actualEnd = endDate > today ? today : endDate

  // Generate monthly data points
  const months: string[] = []
  const values: number[] = []
  const dailyCosts: number[] = []
  const price = Number(item.purchase_price)
  const residual = price * 0.05 // 5% residual value
  const totalMonths = maxYears * 12
  const elapsedMonths = Math.max(1, Math.ceil((today.getTime() - purchaseDate.getTime()) / (86400000 * 30.44)))

  let cursor = new Date(purchaseDate)
  for (let m = 0; cursor <= actualEnd; m++) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
    const monthFraction = Math.min(m / totalMonths, 1)
    const value = price - (price - residual) * monthFraction
    values.push(Math.round(value * 100) / 100)

    const daysSoFar = Math.max(1, Math.floor((cursor.getTime() - purchaseDate.getTime()) / 86400000))
    dailyCosts.push(Math.round((price / daysSoFar) * 100) / 100)

    cursor.setMonth(cursor.getMonth() + 1)
  }

  const textColor = isDark() ? '#8B949E' : '#656D76'
  const lineColor = isDark() ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
  const splitColor = isDark() ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'

  chart.setOption({
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark() ? 'rgba(13,17,23,0.95)' : 'rgba(255,255,255,0.95)',
      borderColor: isDark() ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },
    legend: {
      data: ['剩余价值', '日均成本'],
      textStyle: { color: textColor },
      bottom: 0,
    },
    grid: { left: 56, right: 60, top: 16, bottom: 36 },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: { color: textColor, fontSize: 10, rotate: 30 },
      axisLine: { lineStyle: { color: lineColor } },
      axisTick: { show: false },
      interval: Math.max(1, Math.floor(months.length / 8)),
    },
    yAxis: [
      {
        type: 'value',
        name: '价值 (¥)',
        nameTextStyle: { color: textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: splitColor } },
        axisLabel: { color: textColor, formatter: (v: number) => v >= 10000 ? (v / 10000).toFixed(0) + '万' : String(v) },
      },
      {
        type: 'value',
        name: '日均 (¥)',
        nameTextStyle: { color: textColor, fontSize: 11 },
        splitLine: { show: false },
        axisLabel: { color: textColor },
      },
    ],
    series: [
      {
        name: '剩余价值',
        type: 'line',
        data: values,
        smooth: true,
        lineStyle: { color: '#4C9AFF', width: 2.5 },
        itemStyle: { color: '#4C9AFF' },
        symbol: 'none',
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(76,154,255,0.15)' },
            { offset: 1, color: 'rgba(76,154,255,0)' },
          ]),
        },
      },
      {
        name: '日均成本',
        type: 'line',
        yAxisIndex: 1,
        data: dailyCosts,
        smooth: true,
        lineStyle: { color: '#FF8B64', width: 2, type: 'dashed' },
        itemStyle: { color: '#FF8B64' },
        symbol: 'none',
      },
    ],
  })

  requestAnimationFrame(() => chart.resize())
  const obs = new ResizeObserver(() => chart.resize())
  obs.observe(el)
  observers.push(obs)
  charts[item.id] = chart
}

function initAllCharts() {
  initOverviewDepreciationChart()
  filteredAssets.value.forEach(initDepreciationChart)
}

onMounted(() => {
  requestAnimationFrame(() => setTimeout(initAllCharts, 200))
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  observers.forEach(o => o.disconnect())
  Object.values(charts).forEach(c => c.dispose())
  overviewChart?.dispose()
})
</script>

<style scoped>
.pa-page { padding: clamp(16px, 2vw, 32px); width: 100%; box-sizing: border-box; }

.page-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
}
.page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }

/* Summary */
.summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: clamp(12px, 1.2vw, 20px); margin-bottom: 20px; }
.summary-card { padding: 18px 22px; display: flex; flex-direction: column; gap: 6px; }
.summary-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.summary-value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); }
.summary-sub { font-size: 12px; color: var(--text-muted); }

/* Tabs */
.tabs-row { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
.tab-btn {
  display: flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: 10px;
  border: 1px solid var(--border-card); background: var(--bg-card);
  color: var(--text-secondary); font-size: 13px;
  cursor: pointer; transition: all 0.2s ease;
}
.tab-btn:hover { border-color: var(--border-card-hover); color: var(--text-primary); }
.tab-btn.active { background: rgba(76,154,255,0.10); border-color: rgba(76,154,255,0.30); color: #4C9AFF; }
.tab-count { background: var(--border-subtle); border-radius: 6px; padding: 1px 6px; font-size: 11px; color: var(--text-muted); }
.tab-btn.active .tab-count { background: rgba(76,154,255,0.2); color: #4C9AFF; }

/* Asset Grid */
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: clamp(12px, 1vw, 18px); }
.glass-card.asset-card { padding: 16px 20px; cursor: pointer; transition: all 0.25s ease; }
.glass-card.asset-card:hover { transform: translateY(-2px); }

.card-top { display: flex; align-items: center; gap: 14px; }
.asset-emoji { font-size: 32px; width: 50px; height: 50px; border-radius: 12px; background: var(--border-subtle); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.asset-info { flex: 1; min-width: 0; }
.asset-name { font-size: 16px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.asset-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.category-badge { font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 500; }
.cat--家电 { background: rgba(76,154,255,0.1); color: #4C9AFF; }
.cat--数码 { background: rgba(101,84,192,0.1); color: #6554C0; }
.cat--汽车 { background: rgba(54,179,126,0.1); color: #36B37E; }
.cat--奢侈品 { background: rgba(255,139,100,0.1); color: #FF8B64; }
.cat--房产 { background: rgba(251,146,60,0.1); color: #FB923C; }

.status-dot { font-size: 11px; display: flex; align-items: center; gap: 4px; }
.status-dot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; }
.dot--active { color: var(--text-muted); }
.dot--active::before { background: #36B37E; }
.dot--sold { color: #FF8B64; }
.dot--sold::before { background: #FF8B64; }
.dot--scrapped { color: var(--text-muted); }
.dot--scrapped::before { background: var(--text-muted); }

.asset-stats { text-align: right; flex-shrink: 0; }
.stat-primary { display: flex; align-items: baseline; gap: 2px; justify-content: flex-end; }
.stat-num { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary); line-height: 1; }
.stat-unit { font-size: 12px; color: var(--text-muted); }
.stat-secondary { font-size: 13px; color: #4C9AFF; font-weight: 600; margin-top: 2px; }

/* Expanded Detail */
.card-detail { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-subtle); }
.detail-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.detail-item { display: flex; flex-direction: column; gap: 2px; }
.detail-label { font-size: 11px; color: var(--text-muted); }
.detail-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.detail-value.highlight { color: #4C9AFF; }
.detail-notes { font-size: 12px; color: var(--text-secondary); margin-top: 10px; padding: 8px 12px; background: var(--border-subtle); border-radius: 8px; font-style: italic; }

.detail-chart { margin-top: 14px; }
.chart-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; }
.chart-box { width: 100%; height: clamp(200px, 18vh, 320px); min-height: 180px; }

/* Colors */
.text-green { color: #36B37E; }
.text-red { color: #FF5630; }
.text-orange { color: #FF8B64; }
.text-muted { color: var(--text-muted); }

/* Overview Chart Card */
.overview-chart-card { margin-bottom: 20px; padding: 20px 24px; }
.card-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.card-title { font-size: 16px; font-weight: 600; color: var(--text-primary); }
.time-switcher { display: flex; gap: 4px; background: var(--bg-page, #F0F2F5); padding: 3px; border-radius: 10px; }
.time-btn {
  padding: 5px 14px; border-radius: 8px; border: none; background: transparent;
  color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.2s ease;
}
.time-btn:hover { color: var(--text-primary); }
.time-btn.active { background: var(--bg-card, #FFFFFF); color: var(--text-primary); box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.overview-chart-box { width: 100%; height: clamp(300px, 28vh, 480px); }

/* Title Controls & Asset Selector */
.title-controls { display: flex; align-items: center; gap: 10px; }
.asset-selector { position: relative; }
.selector-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-card);
  background: var(--bg-card); color: var(--text-secondary); font-size: 12px; font-weight: 500;
  cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
}
.selector-btn:hover { border-color: var(--border-card-hover); color: var(--text-primary); }
.selector-arrow { font-size: 10px; opacity: 0.6; }
.selector-popover {
  position: absolute; top: calc(100% + 6px); right: 0; z-index: 100;
  width: 260px; max-height: 320px;
  background: var(--bg-card); border: 1px solid var(--border-card);
  border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  overflow: hidden; display: flex; flex-direction: column;
}
.selector-header { padding: 10px 14px; border-bottom: 1px solid var(--border-subtle); }
.selector-title { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.selector-list { overflow-y: auto; padding: 4px; }
.selector-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
  transition: background 0.15s ease;
}
.selector-item:hover { background: var(--border-subtle); }
.selector-item.selected { background: rgba(76,154,255,0.06); }
.selector-item-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
.selector-emoji { font-size: 18px; flex-shrink: 0; }
.selector-name { font-size: 13px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.selector-check {
  width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--border-card);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: transparent; transition: all 0.15s ease; flex-shrink: 0;
}
.selector-check.checked { background: #4C9AFF; border-color: #4C9AFF; color: #fff; }

/* Fade transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* Transitions */
.expand-enter-active, .expand-leave-active { transition: all 0.3s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; max-height: 0; overflow: hidden; }
.expand-enter-to, .expand-leave-from { max-height: 600px; }

.card-grid-enter-active { transition: all 0.35s ease; }
.card-grid-leave-active { transition: all 0.25s ease; position: absolute; }
.card-grid-enter-from { opacity: 0; transform: scale(0.92); }
.card-grid-leave-to { opacity: 0; transform: scale(0.92); }
.card-grid-move { transition: transform 0.3s ease; }

.empty-state { text-align: center; padding: 48px; color: var(--text-muted); }
.glass-card { padding: 20px 24px; }
</style>
