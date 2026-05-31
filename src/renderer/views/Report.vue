<template>
  <div class="report-page">
    <div class="report-header-bar">
      <div class="header-left">
        <h1>财务报告</h1>
        <p class="subtitle">生成季度家庭财务报告</p>
      </div>
      <div class="header-actions">
        <n-select
          v-model:value="selectedYear"
          :options="yearOptions"
          placeholder="年份"
          style="width: 120px"
        />
        <n-select
          v-model:value="selectedQuarter"
          :options="quarterOptions"
          placeholder="季度"
          style="width: 120px"
        />
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

    <div class="report-preview-container">
      <div v-if="!reportHTML && !loading" class="empty-state glass-card">
        <div class="empty-icon">📊</div>
        <h3>选择年份和季度，点击"生成报告"</h3>
        <p>系统将根据您的财务数据自动生成季度财务报告</p>
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
import { ref } from 'vue'
import { NSelect, NButton, NSpin, useMessage } from 'naive-ui'
import { FileTextOutlined, DownloadOutlined } from '@vicons/antd'
import type { QuarterlyReportData } from '@shared/types'
import { renderReportHTML } from '../utils/reportTemplate'

const message = useMessage()

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const currentQuarter = Math.ceil(currentMonth / 3)
// 默认选择上一季度
const defaultQuarter = currentQuarter > 1 ? currentQuarter - 1 : 4
const defaultYear = currentQuarter > 1 ? currentYear : currentYear - 1

const selectedYear = ref(defaultYear)
const selectedQuarter = ref(defaultQuarter)
const loading = ref(false)
const reportHTML = ref('')

const yearOptions = Array.from({ length: 5 }, (_, i) => ({
  label: `${currentYear - i}年`,
  value: currentYear - i,
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
    const data = await window.electronAPI.generateReport(selectedYear.value, selectedQuarter.value) as QuarterlyReportData
    reportHTML.value = renderReportHTML(data)
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
    const result = await window.electronAPI.exportReportPDF(reportHTML.value)
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
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
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
