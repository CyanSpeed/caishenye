<template>
  <div class="report-page">
    <div class="report-header-bar">
      <div class="header-left">
        <h1>财务报告</h1>
        <p class="subtitle">{{ subtitleText }}</p>
      </div>
    </div>

    <!-- 报告类型选择 -->
    <div class="report-form glass-card">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">报告类型</label>
          <div class="period-segmented">
            <button
              v-for="opt in periodOptions"
              :key="opt.value"
              class="seg-btn"
              :class="{ active: selectedPeriod === opt.value }"
              @click="selectedPeriod = opt.value"
            >{{ opt.emoji }} {{ opt.label }}</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">年份</label>
          <n-select
            v-model:value="selectedYear"
            :options="yearOptions"
            style="width: 140px"
          />
        </div>

        <div class="form-group" v-if="selectedPeriod === 'monthly'">
          <label class="form-label">月份</label>
          <n-select
            v-model:value="selectedMonth"
            :options="monthOptions"
            style="width: 140px"
          />
        </div>

        <div class="form-group" v-if="selectedPeriod === 'quarterly'">
          <label class="form-label">季度</label>
          <n-select
            v-model:value="selectedQuarter"
            :options="quarterOptions"
            style="width: 140px"
          />
        </div>

        <div class="form-actions">
          <n-button type="primary" :loading="loading" @click="generateReport">
            <template #icon><FileTextOutlined /></template>
            生成报告
          </n-button>
          <n-button :disabled="!reportHTML" @click="exportPDF">
            <template #icon><DownloadOutlined /></template>
            导出 PDF
          </n-button>
        </div>
      </div>
    </div>

    <div class="report-preview-container">
      <div v-if="!reportHTML && !loading" class="empty-state glass-card">
        <div class="empty-icon">📊</div>
        <h3>选择报告类型和时间，点击"生成报告"</h3>
        <p>支持月报、季报、年报，系统将根据您的财务数据自动生成</p>
      </div>

      <n-spin v-if="loading" size="large" class="loading-spin">
        <template #description>正在生成报告...</template>
      </n-spin>

      <div
        v-if="reportHTML && !loading"
        class="report-preview glass-card"
        v-html="reportHTML"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NSelect, NButton, NSpin, useMessage } from 'naive-ui'
import { FileTextOutlined, DownloadOutlined } from '@vicons/antd'
import type { ReportData, ReportPeriod } from '@shared/types'
import { renderReportHTML } from '../utils/reportTemplate'
import { useColorMode } from '../composables/useColorMode'

const message = useMessage()
const { colorMode } = useColorMode()

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const currentQuarter = Math.ceil(currentMonth / 3)

// ---- 报告类型 ----
const periodOptions: { label: string; value: ReportPeriod; emoji: string }[] = [
  { label: '月报', value: 'monthly', emoji: '📅' },
  { label: '季报', value: 'quarterly', emoji: '📊' },
  { label: '年报', value: 'yearly', emoji: '📈' },
]

const selectedPeriod = ref<ReportPeriod>('quarterly')
const selectedYear = ref(currentQuarter > 1 ? currentYear : currentYear - 1)
const selectedMonth = ref(currentMonth > 1 ? currentMonth - 1 : 12)
const selectedQuarter = ref(currentQuarter > 1 ? currentQuarter - 1 : 4)
const loading = ref(false)
const reportHTML = ref('')

const subtitleText = computed(() => {
  switch (selectedPeriod.value) {
    case 'monthly': return '生成月度家庭财务报告'
    case 'quarterly': return '生成季度家庭财务报告'
    case 'yearly': return '生成年度家庭财务报告'
  }
})

const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  label: `${currentYear - i}年`,
  value: currentYear - i,
}))

const monthOptions = Array.from({ length: 12 }, (_, i) => ({
  label: `${i + 1}月`,
  value: i + 1,
}))

const quarterOptions = [
  { label: '第一季度 (Q1)', value: 1 },
  { label: '第二季度 (Q2)', value: 2 },
  { label: '第三季度 (Q3)', value: 3 },
  { label: '第四季度 (Q4)', value: 4 },
]

async function generateReport() {
  loading.value = true
  reportHTML.value = ''
  try {
    const periodValue = selectedPeriod.value === 'monthly'
      ? selectedMonth.value
      : selectedPeriod.value === 'quarterly'
        ? selectedQuarter.value
        : selectedYear.value
    const data = await window.electronAPI.generateReport(
      selectedPeriod.value,
      selectedYear.value,
      periodValue,
    ) as ReportData
    reportHTML.value = renderReportHTML(data, colorMode.value)
    message.success('报告生成成功')
  } catch (err: any) {
    message.error(`生成失败：${err.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

async function exportPDF() {
  if (!reportHTML.value) return
  try {
    let suffix = ''
    if (selectedPeriod.value === 'monthly') suffix = `${selectedMonth.value}月`
    else if (selectedPeriod.value === 'quarterly') suffix = `Q${selectedQuarter.value}`
    else suffix = '年度'
    const defaultName = `财务报告_${selectedYear.value}年${suffix}.pdf`
    const result = await window.electronAPI.exportReportPDF(reportHTML.value, defaultName)
    if (result.canceled) return
    message.success(`PDF 已保存到：${result.filePath}`)
  } catch (err: any) {
    message.error(`导出失败：${err.message || '未知错误'}`)
  }
}
</script>

<style scoped>
.report-page {
  padding: 0;
}

.report-header-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 16px;
}

/* ---- Report Form ---- */
.report-form {
  padding: 24px 28px;
  margin-bottom: 24px;
}

.form-row {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.form-actions {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding-bottom: 2px;
}

/* Period Segmented Control */
.period-segmented {
  display: flex;
  gap: 2px;
  background: var(--border-subtle);
  border-radius: 10px;
  padding: 3px;
}

.seg-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.seg-btn:hover {
  color: var(--text-primary);
  background: var(--bg-card-hover);
}

.seg-btn.active {
  color: #3B82F6;
  background: var(--bg-card);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.header-left h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.report-preview-container {
  min-height: 400px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 24px;
}

.empty-state h3 {
  font-size: 18px;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.empty-state p {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
}

.loading-spin {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}

.report-preview {
  padding: 0;
  overflow: hidden;
  border-radius: 20px;
}

/* 让 v-html 内容正确显示 */
.report-preview :deep(body) {
  margin: 0;
}

.report-preview :deep(.report-header) {
  border-radius: 20px 20px 0 0;
}

.report-preview :deep(.report-footer) {
  border-radius: 0 0 20px 20px;
}
</style>
