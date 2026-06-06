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
              <span class="label-desc">添加家庭成员信息，点击头像可上传照片</span>
            </div>
            <div class="members-list">
              <div v-for="(member, idx) in familyInfo.members" :key="idx" class="member-row">
                <div class="avatar-upload" @click="handleAvatarUpload(idx)" :title="member.avatar ? '点击更换头像' : '点击上传头像'">
                  <img v-if="member.avatar" :src="member.avatar" class="avatar-img" />
                  <span v-else class="avatar-placeholder">👤</span>
                  <div class="avatar-overlay">📷</div>
                </div>
                <n-input v-model:value="member.name" placeholder="姓名" style="width: 100px" />
                <n-select v-model:value="member.role" :options="roleOptions" placeholder="角色" style="width: 100px" />
                <n-input-number v-model:value="member.age" :min="0" :max="150" placeholder="年龄" style="width: 80px" />
                <n-button text type="error" @click="familyInfo.members.splice(idx, 1)">删除</n-button>
              </div>
              <n-button dashed @click="familyInfo.members.push({ name: '', role: '', age: 0, avatar: '' })" style="width: 100%">
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
              <span class="label-text">图表动画</span>
              <span class="label-desc">启用或禁用图表动画效果</span>
            </div>
            <n-switch v-model:value="settings.chartAnimation" />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">涨跌配色</span>
              <span class="label-desc">设置盈利/亏损的显示颜色</span>
            </div>
            <n-select
              :value="colorMode"
              :options="colorModeOptions"
              placeholder="选择配色"
              style="width: 200px"
              @update:value="handleColorModeChange"
            />
          </div>
        </div>
      </div>

      <!-- 图像识别配置 -->
      <div class="glass-card settings-section">
        <div class="section-title">
          <CameraOutlined :size="20" />
          <span>图像识别配置</span>
        </div>

        <div class="settings-group">
          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">识别服务提供商</span>
              <span class="label-desc">选择用于识别记账截图的AI服务</span>
            </div>
            <n-select
              v-model:value="recognitionConfig.provider"
              :options="providerOptions"
              placeholder="选择提供商"
              style="width: 200px"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">API密钥</span>
              <span class="label-desc">用于访问识别服务的密钥</span>
            </div>
            <n-input
              v-model:value="recognitionConfig.apiKey"
              type="password"
              show-password-on="click"
              placeholder="输入API密钥"
              style="width: 300px"
            />
          </div>

          <div class="setting-item" v-if="recognitionConfig.provider === 'custom' || recognitionConfig.provider === 'ollama'">
            <div class="setting-label">
              <span class="label-text">API端点</span>
              <span class="label-desc">自定义API端点地址</span>
            </div>
            <n-input
              v-model:value="recognitionConfig.baseUrl"
              placeholder="如：https://api.xiaomimimo.com/v1"
              style="width: 300px"
            />
          </div>

          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">模型名称</span>
              <span class="label-desc">使用的模型（留空使用默认模型）</span>
            </div>
            <n-input
              v-model:value="recognitionConfig.model"
              placeholder="如：mimo-v2.5"
              style="width: 200px"
            />
          </div>

          <div class="config-hint" v-if="recognitionConfig.provider === 'custom'">
            <p><strong>自定义端点配置示例：</strong></p>
            <p>API端点：<code>https://api.example.com/v1</code></p>
            <p>模型名称：<code>your-model-name</code></p>
          </div>

          <div class="setting-item" style="justify-content: flex-end; gap: 12px;">
            <n-button @click="testRecognitionConfig" :loading="testing">
              测试连接
            </n-button>
            <n-button type="primary" @click="saveRecognitionConfig">保存识别配置</n-button>
          </div>
        </div>
      </div>

      <!-- 数据管理 -->
      <div class="glass-card settings-section">
        <div class="section-title">
          <DatabaseOutlined :size="20" />
          <span>数据管理</span>
        </div>

        <div class="settings-group">
          <!-- 数据库导出备份 -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">导出数据库备份</span>
              <span class="label-desc">将整个数据库文件导出到指定位置进行备份</span>
            </div>
            <n-button type="primary" @click="handleExportDatabase" :loading="exporting">
              导出数据库
            </n-button>
          </div>

          <!-- 自动备份 -->
          <div class="setting-item" style="flex-direction: column; align-items: flex-start; gap: 12px;">
            <div class="setting-label">
              <span class="label-text">自动备份</span>
              <span class="label-desc">启用后将在应用退出时自动备份数据库</span>
            </div>
            <div class="backup-config">
              <div class="backup-row">
                <span class="backup-label">启用自动备份</span>
                <n-switch v-model:value="backupConfig.enabled" @update:value="saveBackupConfig" />
              </div>
              <div class="backup-row" v-if="backupConfig.enabled">
                <span class="backup-label">备份目录</span>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <n-input v-model:value="backupConfig.directory" placeholder="选择备份目录..." readonly style="width: 250px" />
                  <n-button size="small" @click="handleSelectBackupDir">选择目录</n-button>
                </div>
              </div>
              <div class="backup-row" v-if="backupConfig.enabled">
                <span class="backup-label">立即备份</span>
                <n-button size="small" @click="handleRunBackup" :loading="backingUp">执行备份</n-button>
              </div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div style="border-top: 1px solid var(--border-subtle); margin: 8px 0;"></div>

          <!-- 重置数据 -->
          <div class="setting-item">
            <div class="setting-label">
              <span class="label-text">重置交易记账数据</span>
              <span class="label-desc">清空所有交易记录、余额快照、净资产快照和投资快照，并重置分类为新的12种分类。账户和资产数据不受影响。</span>
            </div>
            <n-popconfirm @positive-click="handleResetTransactions">
              <template #trigger>
                <n-button type="error" :loading="resetting">
                  重置交易数据
                </n-button>
              </template>
              <div style="max-width: 300px;">
                <p style="font-weight: 600; margin-bottom: 8px;">⚠️ 确认重置？</p>
                <p style="font-size: 13px; color: #666;">此操作将：</p>
                <ul style="font-size: 13px; color: #666; margin: 8px 0; padding-left: 20px;">
                  <li>删除所有交易记录</li>
                  <li>删除所有余额快照</li>
                  <li>删除所有净资产快照</li>
                  <li>删除所有投资市值快照</li>
                  <li>重置分类为新的12种分类</li>
                </ul>
                <p style="font-size: 13px; color: #666;">账户和资产数据将保留。此操作不可撤销。</p>
              </div>
            </n-popconfirm>
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
import { NSelect, NSwitch, NInput, NInputNumber, NButton, NPopconfirm, useMessage } from 'naive-ui'
import {
  WalletOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  CameraOutlined,
  DatabaseOutlined,
} from '@vicons/antd'
import type { FamilyInfo, FamilyMember, RecognitionConfig } from '@shared/types'
import { useColorMode } from '../composables/useColorMode'
import type { ColorMode } from '../composables/useColorMode'

const message = useMessage()
const { colorMode, setColorMode } = useColorMode()

const colorModeOptions = [
  { label: '🔴 红涨绿跌（中国惯例）', value: 'cn' },
  { label: '🟢 绿涨红跌（国际惯例）', value: 'west' },
]

function handleColorModeChange(val: ColorMode) {
  setColorMode(val)
}

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
      // 兼容旧数据：为没有 avatar 字段的成员补充默认值
      if (parsed.members) {
        parsed.members = parsed.members.map((m: any) => ({
          ...m,
          avatar: m.avatar || '',
        }))
      }
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

// 头像上传
async function handleAvatarUpload(idx: number) {
  try {
    const base64 = await window.electronAPI.selectImageFile()
    if (base64) {
      familyInfo.members[idx].avatar = base64
    }
  } catch (err: any) {
    message.error(`头像上传失败：${err.message || '未知错误'}`)
  }
}

onMounted(() => {
  loadFamilyInfo()
  loadRecognitionConfig()
  loadBackupConfig()
})

// 图像识别配置
const recognitionConfig = reactive<RecognitionConfig>({
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
})

const providerOptions = [
  { label: 'OpenAI (GPT-4o)', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: 'Google (Gemini)', value: 'google' },
  { label: 'Ollama (本地模型)', value: 'ollama' },
  { label: '自定义端点', value: 'custom' },
]

async function loadRecognitionConfig() {
  try {
    const configStr = localStorage.getItem('recognition_config')
    if (configStr) {
      const config = JSON.parse(configStr) as RecognitionConfig
      Object.assign(recognitionConfig, config)
    }
  } catch {
    // 忽略加载错误
  }
}

async function saveRecognitionConfig() {
  try {
    localStorage.setItem('recognition_config', JSON.stringify(recognitionConfig))
    message.success('识别配置已保存')
  } catch (err: any) {
    message.error(`保存失败：${err.message || '未知错误'}`)
  }
}

async function handleResetTransactions() {
  resetting.value = true
  try {
    const result = await window.electronAPI.resetTransactionData() as {
      transactionsDeleted: number
      snapshotsDeleted: number
      netWorthDeleted: number
      investmentDeleted: number
    }
    message.success(
      `重置成功！已删除 ${result.transactionsDeleted} 条交易记录、` +
      `${result.snapshotsDeleted} 条余额快照、` +
      `${result.netWorthDeleted} 条净资产快照、` +
      `${result.investmentDeleted} 条投资快照。分类已更新为新的12种分类。`
    )
  } catch (err: any) {
    message.error(`重置失败：${err.message || '未知错误'}`)
  } finally {
    resetting.value = false
  }
}

// 备份配置
const backupConfig = reactive({
  enabled: false,
  directory: '',
  frequency: 'weekly',
})

async function loadBackupConfig() {
  try {
    const config = await window.electronAPI.getBackupConfig() as {
      enabled: boolean
      directory: string
      frequency: string
    }
    if (config) {
      Object.assign(backupConfig, config)
    }
  } catch {
    // 忽略加载错误
  }
}

async function saveBackupConfig() {
  try {
    await window.electronAPI.updateBackupConfig({
      enabled: backupConfig.enabled,
      directory: backupConfig.directory,
      frequency: backupConfig.frequency,
    })
    message.success('备份配置已保存')
  } catch (err: any) {
    message.error(`保存备份配置失败：${err.message || '未知错误'}`)
  }
}

async function handleSelectBackupDir() {
  try {
    const dir = await window.electronAPI.selectDirectory()
    if (dir) {
      backupConfig.directory = dir
      await saveBackupConfig()
    }
  } catch {
    // 用户取消
  }
}

async function handleExportDatabase() {
  exporting.value = true
  try {
    const result = await window.electronAPI.exportDatabase() as { canceled: boolean; filePath?: string }
    if (!result.canceled && result.filePath) {
      message.success(`数据库已导出到：${result.filePath}`)
    }
  } catch (err: any) {
    message.error(`导出失败：${err.message || '未知错误'}`)
  } finally {
    exporting.value = false
  }
}

async function handleRunBackup() {
  backingUp.value = true
  try {
    const result = await window.electronAPI.runBackup() as { success: boolean; reason?: string; filePath?: string }
    if (result.success) {
      message.success(`备份完成：${result.filePath}`)
    } else {
      message.error(result.reason || '备份失败')
    }
  } catch (err: any) {
    message.error(`备份失败：${err.message || '未知错误'}`)
  } finally {
    backingUp.value = false
  }
}

const testing = ref(false)
const resetting = ref(false)
const exporting = ref(false)
const backingUp = ref(false)

async function testRecognitionConfig() {
  if (!recognitionConfig.apiKey) {
    message.error('请先输入API密钥')
    return
  }

  if ((recognitionConfig.provider === 'custom' || recognitionConfig.provider === 'ollama') && !recognitionConfig.baseUrl) {
    message.error('请先输入API端点')
    return
  }

  testing.value = true
  try {
    // 创建一个简单的测试图片（1x1像素的白色PNG）
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    await window.electronAPI.recognizeExpenseImage(testImage, recognitionConfig)
    message.success('API连接测试成功！')
  } catch (error) {
    const errorMsg = (error as Error).message
    if (errorMsg.includes('401') || errorMsg.includes('Invalid API Key')) {
      message.error('API密钥无效，请检查后重试')
    } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      message.error('网络连接失败，请检查API端点地址')
    } else {
      message.error(`连接测试失败：${errorMsg}`)
    }
  } finally {
    testing.value = false
  }
}

// 设置数据（精简后仅保留实际使用的字段）
const settings = reactive({
  currency: 'CNY',
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

/* 头像上传样式 */
.avatar-upload {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  overflow: hidden;
  border: 2px dashed var(--border-subtle);
  transition: border-color 0.2s;
}

.avatar-upload:hover {
  border-color: var(--accent-blue);
}

.avatar-upload:hover .avatar-overlay {
  opacity: 1;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--bg-hover);
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s;
  font-size: 14px;
  color: #fff;
}

/* 备份配置样式 */
.backup-config {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.backup-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.backup-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.config-hint {
  background: var(--bg-hover);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-card);
}

.config-hint p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.config-hint p:last-child {
  margin-bottom: 0;
}

.config-hint code {
  background: var(--bg-card);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--accent-blue);
}
</style>
