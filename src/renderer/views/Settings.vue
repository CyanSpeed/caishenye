<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1>设置</h1>
      <p class="subtitle">财务管理配置与软件信息</p>
    </div>

    <div class="settings-content">
      <!-- 家庭信息 -->
      <div class="glass-card settings-section">
        <div class="section-title">
          <span style="font-size: 20px;">🏠</span>
          <span>家庭信息</span>
        </div>

        <div class="settings-group">
          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">家庭名称</span>
              <span class="label-desc">显示在财务报告标题中</span>
            </div>
            <n-input v-model:value="familyInfo.familyName" placeholder="如：张先生家庭" style="width: 200px" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">城市</span>
              <span class="label-desc">家庭所在城市</span>
            </div>
            <n-input v-model:value="familyInfo.city" placeholder="如：上海" style="width: 200px" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">编制人</span>
              <span class="label-desc">报告编制人姓名</span>
            </div>
            <n-input v-model:value="familyInfo.preparer" placeholder="如：李女士" style="width: 200px" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">审核人</span>
              <span class="label-desc">报告审核人姓名</span>
            </div>
            <n-input v-model:value="familyInfo.reviewer" placeholder="如：张先生" style="width: 200px" />
          </div>

          <div class="setting-item" style="flex-direction: column; align-items: flex-start; gap: 12px;">
            <div class="setting-label">
              <span class="label-text">家庭成员</span>
              <span class="label-desc">添加家庭成员信息</span>
            </div>
            <div class="members-list">
              <div v-for="(member, idx) in familyInfo.members" :key="idx" class="member-row">
                <n-input v-model:value="member.name" placeholder="姓名" style="width: 120px" />
                <n-select v-model:value="member.role" :options="roleOptions" placeholder="角色" style="width: 100px" />
                <n-input-number v-model:value="member.age" :min="0" :max="150" placeholder="年龄" style="width: 100px" />
                <n-button text type="error" @click="familyInfo.members.splice(idx, 1)">删除</n-button>
              </div>
              <n-button dashed @click="familyInfo.members.push({ name: '', role: '', age: 0 })" style="width: 100%">
                + 添加成员
              </n-button>
            </div>
          </div>

          <div class="setting-item" style="justify-content: flex-end;">
            <n-button type="primary" @click="saveFamilyInfo">保存家庭信息</n-button>
          </div>
        </div>
      </div>

      <!-- 财务管理配置 -->
      <div class="glass-card settings-section">
        <div class="section-title">
          <WalletOutlined :size="20" />
          <span>财务管理配置</span>
        </div>

        <div class="settings-group">
          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">默认货币</span>
              <span class="label-desc">选择主要使用的货币单位</span>
            </div>
            <n-select
              v-model:value="settings.currency"
              :options="currencyOptions"
              placeholder="选择货币"
              style="width: 200px"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">财务年度开始月</span>
              <span class="label-desc">设置财务年度的起始月份</span>
            </div>
            <n-select
              v-model:value="settings.fiscalYearStart"
              :options="monthOptions"
              placeholder="选择月份"
              style="width: 200px"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">自动备份</span>
              <span class="label-desc">定期自动备份财务数据</span>
            </div>
            <n-switch v-model:value="settings.autoBackup" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">数据保留期限</span>
              <span class="label-desc">设置交易数据保留时间</span>
            </div>
            <n-select
              v-model:value="settings.dataRetention"
              :options="retentionOptions"
              placeholder="选择期限"
              style="width: 200px"
            />
          </div>
        </div>
      </div>

      <!-- 显示设置 -->
      <div class="glass-card settings-section">
        <div class="section-title">
          <EyeOutlined :size="20" />
          <span>显示设置</span>
        </div>

        <div class="settings-group">
          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">数字格式</span>
              <span class="label-desc">设置金额的显示格式</span>
            </div>
            <n-select
              v-model:value="settings.numberFormat"
              :options="numberFormatOptions"
              placeholder="选择格式"
              style="width: 200px"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">日期格式</span>
              <span class="label-desc">设置日期的显示格式</span>
            </div>
            <n-select
              v-model:value="settings.dateFormat"
              :options="dateFormatOptions"
              placeholder="选择格式"
              style="width: 200px"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">图表动画</span>
              <span class="label-desc">启用或禁用图表动画效果</span>
            </div>
            <n-switch v-model:value="settings.chartAnimation" />
          </div>
        </div>
      </div>

      <!-- 软件信息 -->
      <div class="glass-card settings-section">
        <div class="section-title">
          <InfoCircleOutlined :size="20" />
          <span>软件信息</span>
        </div>

        <div class="software-info">
          <div class="info-logo">
            <div class="logo-icon">财</div>
            <div class="logo-text">财神爷</div>
          </div>

          <div class="info-details">
            <div class="info-item">
              <span class="info-label">版本号</span>
              <span class="info-value">v1.0.0</span>
            </div>
            <div class="info-item">
              <span class="info-label">构建日期</span>
              <span class="info-value">2026-05-31</span>
            </div>
            <div class="info-item">
              <span class="info-label">技术栈</span>
              <span class="info-value">Electron + Vue 3 + TypeScript</span>
            </div>
            <div class="info-item">
              <span class="info-label">开发者</span>
              <span class="info-value">CyanSpeed</span>
            </div>
          </div>

          <div class="info-description">
            <p>财神爷是一款专业的个人财务管理软件，帮助您轻松管理账户、记录交易、分析投资和追踪实物资产。</p>
            <p>通过直观的仪表盘和详细的报表，让您的财务状况一目了然。</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { NSelect, NSwitch, NInput, NInputNumber, NButton, useMessage } from 'naive-ui'
import {
  WalletOutlined,
  EyeOutlined,
  InfoCircleOutlined,
} from '@vicons/antd'
import type { FamilyInfo } from '@shared/types'

const message = useMessage()

// 家庭信息
const familyInfo = reactive<FamilyInfo>({
  familyName: '',
  members: [],
  city: '',
  preparer: '',
  reviewer: '',
})

const roleOptions = [
  { label: '户主', value: '户主' },
  { label: '配偶', value: '配偶' },
  { label: '子女', value: '子女' },
  { label: '父母', value: '父母' },
]

async function loadFamilyInfo() {
  try {
    const settings = await window.electronAPI.getSettings() as { key: string; value: string }[]
    const info = settings.find(s => s.key === 'family_info')
    if (info) {
      const parsed = JSON.parse(info.value) as FamilyInfo
      Object.assign(familyInfo, parsed)
    }
  } catch {
    // 忽略加载错误
  }
}

async function saveFamilyInfo() {
  try {
    await window.electronAPI.updateSetting('family_info', JSON.stringify(familyInfo))
    message.success('家庭信息已保存')
  } catch (err: any) {
    message.error(`保存失败：${err.message || '未知错误'}`)
  }
}

onMounted(() => {
  loadFamilyInfo()
})

// 设置数据
const settings = reactive({
  currency: 'CNY',
  fiscalYearStart: 1,
  autoBackup: true,
  dataRetention: '2years',
  numberFormat: '1,234.56',
  dateFormat: 'YYYY-MM-DD',
  chartAnimation: true,
})

// 选项配置
const currencyOptions = [
  { label: '人民币 (CNY)', value: 'CNY' },
  { label: '美元 (USD)', value: 'USD' },
  { label: '欧元 (EUR)', value: 'EUR' },
  { label: '日元 (JPY)', value: 'JPY' },
  { label: '英镑 (GBP)', value: 'GBP' },
]

const monthOptions = [
  { label: '1月', value: 1 },
  { label: '2月', value: 2 },
  { label: '3月', value: 3 },
  { label: '4月', value: 4 },
  { label: '5月', value: 5 },
  { label: '6月', value: 6 },
  { label: '7月', value: 7 },
  { label: '8月', value: 8 },
  { label: '9月', value: 9 },
  { label: '10月', value: 10 },
  { label: '11月', value: 11 },
  { label: '12月', value: 12 },
]

const retentionOptions = [
  { label: '1年', value: '1year' },
  { label: '2年', value: '2years' },
  { label: '3年', value: '3years' },
  { label: '5年', value: '5years' },
  { label: '永久保留', value: 'forever' },
]

const numberFormatOptions = [
  { label: '1,234.56', value: '1,234.56' },
  { label: '1.234,56', value: '1.234,56' },
  { label: '1 234.56', value: '1 234.56' },
]

const dateFormatOptions = [
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
]
</script>

<style scoped>
.settings-page {
  padding: 0;
  max-width: 800px;
  margin: 0 auto;
}

.settings-header {
  margin-bottom: 32px;
}

.settings-header h1 {
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

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-section {
  padding: 24px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.section-title svg,
.section-title .n-icon {
  width: 20px;
  height: 20px;
  color: var(--accent-blue);
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.label-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.software-info {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-logo {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--border-subtle);
}

.logo-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #60A5FA, #A78BFA);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.logo-text {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.info-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.info-description {
  padding-top: 24px;
  border-top: 1px solid var(--border-subtle);
}

.info-description p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0 0 12px 0;
}

.info-description p:last-child {
  margin-bottom: 0;
}

.members-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
