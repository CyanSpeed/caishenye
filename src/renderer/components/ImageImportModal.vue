<template>
  <n-modal :show="show" preset="card" title="AI 识别导入" style="width: 1100px; max-height: 90vh;"
    :bordered="false" :mask-closable="false" @update:show="$emit('update:show', $event)">
    <div class="image-import-container">
      <!-- Step 1: Upload -->
      <div v-if="step === 'upload'" class="upload-section">
        <div class="upload-area" :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput">
          <input ref="fileInput" type="file" accept="image/*" style="display: none;" @change="handleFileSelect">
          <div class="upload-icon">📸</div>
          <div class="upload-text">点击或拖拽图片到此处</div>
          <div class="upload-hint">支持 PNG、JPG、WebP，最大 10MB</div>
        </div>
      </div>

      <!-- Step 2: Recognizing -->
      <div v-else-if="step === 'recognizing'" class="recognizing-section">
        <div class="preview-container">
          <img :src="imagePreviewUrl" alt="Preview" class="preview-image">
        </div>
        <div class="recognizing-status">
          <n-spin size="large" />
          <div class="status-text">正在识别...</div>
        </div>
      </div>

      <!-- Step 3: Confirm -->
      <div v-else-if="step === 'confirm'" class="confirm-section">
        <div class="confirm-layout">
          <!-- Left: Image Preview -->
          <div class="preview-container-small">
            <img :src="imagePreviewUrl" alt="Preview" class="preview-image-small">
          </div>

          <!-- Right: Results with Tabs -->
          <div class="result-container">
            <n-tabs v-model:value="activeTab" type="segment" size="small">
              <n-tab-pane name="result" tab="识别结果">
                <div class="result-header">
                  <h3>识别的分类</h3>
                  <n-button size="small" @click="resetToUpload">重新识别</n-button>
                </div>

                <div class="category-list">
                  <div v-for="(item, index) in recognizedCategories" :key="index" class="category-item">
                    <div class="category-info">
                      <n-input v-model:value="item.name" size="small" style="width: 110px;" placeholder="分类名称" />
                      <n-input-number v-model:value="item.amount" size="small" style="width: 130px;"
                        :precision="2" :min="0" placeholder="金额" />
                    </div>
                    <div class="category-match">
                      <span class="match-label">&rarr;</span>
                      <n-select v-model:value="item.matchedCategoryId" size="small" style="width: 140px;"
                        :options="categoryOptions" placeholder="选择分类" />
                    </div>
                    <n-button size="small" type="error" @click="removeCategory(index)">删除</n-button>
                  </div>
                </div>

                <n-button size="small" @click="addCategory" style="margin-top: 8px;">+ 添加</n-button>

                <div class="total-amount">
                  <span>合计：</span>
                  <span class="amount">¥{{ totalAmount.toLocaleString() }}</span>
                </div>

                <div class="import-settings">
                  <div class="setting-item">
                    <span class="setting-label">账户：</span>
                    <n-select v-model:value="selectedAccountId" size="small" style="width: 180px;"
                      :options="accountOptions" placeholder="选择账户" />
                  </div>
                  <div class="setting-item">
                    <span class="setting-label">日期：</span>
                    <n-date-picker v-model:value="selectedDate" size="small" type="date"
                      style="width: 180px;" />
                  </div>
                  <div class="setting-item">
                    <span class="setting-label">成员：</span>
                    <n-select v-model:value="selectedMember" size="small" style="width: 180px;"
                      :options="memberOpts" placeholder="选择成员" clearable />
                  </div>
                </div>

                <div class="action-buttons">
                  <n-button @click="resetToUpload">取消</n-button>
                  <n-button type="primary" :disabled="!canImport" :loading="importing" @click="handleImport">
                    导入
                  </n-button>
                </div>
              </n-tab-pane>

              <n-tab-pane name="raw" tab="原始数据">
                <div class="raw-data-container">
                  <n-input
                    type="textarea"
                    :value="rawResponse"
                    readonly
                    :autosize="{ minRows: 10, maxRows: 20 }"
                    style="font-family: monospace; font-size: 12px;"
                  />
                </div>
              </n-tab-pane>
            </n-tabs>
          </div>
        </div>
      </div>

      <!-- Step 4: Done -->
      <div v-else-if="step === 'done'" class="done-section">
        <div class="done-icon">完成！</div>
        <div class="done-text">导入成功</div>
        <div class="done-detail">已导入 {{ importedCount }} 条记录</div>
        <n-button type="primary" @click="resetToUpload" style="margin-top: 16px;">继续导入</n-button>
        <n-button @click="$emit('update:show', false)" style="margin-top: 8px;">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NButton, NInput, NInputNumber, NSelect, NDatePicker, NSpin, NTabs, NTabPane, useMessage } from 'naive-ui'
import { useFinance } from '../composables/useFinance'
import type { RecognitionConfig, RecognizedCategory, RecognitionResult, BatchImportParams } from '@shared/types'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'imported': []
}>()

const message = useMessage()
const { assetAccounts, expenseCategories, memberOptions, addBatchTransactions } = useFinance()

// State
type Step = 'upload' | 'recognizing' | 'confirm' | 'done'
const step = ref<Step>('upload')
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const imagePreviewUrl = ref('')
const importing = ref(false)
const importedCount = ref(0)
const activeTab = ref('result')

// Recognition result
const recognizedCategories = ref<(RecognizedCategory & { amount: number })[]>([])
const rawResponse = ref('')

// Import settings
const selectedAccountId = ref<number | null>(null)
const selectedDate = ref(Date.now())
const selectedMember = ref<string | null>(null)

// Computed
const categoryOptions = computed(() =>
  (expenseCategories.value || []).map(c => ({
    label: c.name,
    value: c.id,
  }))
)

const accountOptions = computed(() =>
  (assetAccounts.value || []).map(a => ({
    label: a.name + ' (' + (a.sub_type === 'cash' ? '现金' : a.sub_type === 'bank' ? '银行' : a.sub_type) + ')',
    value: a.id,
  }))
)

const memberOpts = computed(() =>
  (memberOptions.value || []).map((m: any) => ({
    label: m.label,
    value: m.value,
  }))
)

const totalAmount = computed(() =>
  recognizedCategories.value.reduce((sum, item) => sum + (item.amount || 0), 0)
)

const canImport = computed(() =>
  selectedAccountId.value !== null &&
  recognizedCategories.value.length > 0 &&
  recognizedCategories.value.every(item => item.matchedCategoryId && item.amount > 0)
)

// Watch show to reset
watch(() => props.show, (newVal) => {
  if (newVal) {
    resetToUpload()
  }
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) processFile(file)
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) {
    processFile(file)
  } else {
    message.error('请上传图片文件')
  }
}

async function processFile(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    message.error('图片大小不能超过 10MB')
    return
  }
  imagePreviewUrl.value = URL.createObjectURL(file)
  const dataUrl = await fileToDataUrl(file)
  step.value = 'recognizing'
  await recognizeImage(dataUrl)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function recognizeImage(base64: string) {
  try {
    const configStr = localStorage.getItem('recognition_config')
    if (!configStr) {
      message.error('请先在设置中配置 AI 识别')
      step.value = 'upload'
      return
    }
    const config: RecognitionConfig = JSON.parse(configStr)
    if (!config.apiKey) {
      message.error('请在设置中配置 API 密钥')
      step.value = 'upload'
      return
    }
    if ((config.provider === 'custom' || config.provider === 'ollama') && !config.baseUrl) {
      message.error('请在设置中配置 API 端点')
      step.value = 'upload'
      return
    }

    const result: RecognitionResult = await window.electronAPI.recognizeExpenseImage(base64, config)

    recognizedCategories.value = result.categories.map(cat => ({
      ...cat,
      amount: parseFloat(cat.amount) || 0,
      matchedCategoryId: matchCategory(cat.name),
    }))
    rawResponse.value = result.rawResponse || ''
    activeTab.value = 'result'

    step.value = 'confirm'
  } catch (error) {
    console.error('Recognition failed:', error)
    const errorMsg = (error as Error).message
    if (errorMsg.includes('401') || errorMsg.includes('Invalid API Key')) {
      message.error('API 密钥无效，请检查设置')
    } else if (errorMsg.includes('403')) {
      message.error('API 访问被拒绝，请检查 API 密钥权限')
    } else if (errorMsg.includes('429')) {
      message.error('API 请求频率超限，请稍后再试')
    } else if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
      message.error('API 服务暂时不可用')
    } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      message.error('网络错误，请检查网络连接')
    } else {
      message.error('识别失败：' + errorMsg)
    }
    step.value = 'upload'
  }
}

function matchCategory(name: string): number | undefined {
  const exactMatch = expenseCategories.value.find(c => c.name === name)
  if (exactMatch) return exactMatch.id
  const fuzzyMatch = expenseCategories.value.find(c =>
    c.name.includes(name) || name.includes(c.name)
  )
  if (fuzzyMatch) return fuzzyMatch.id
  const keywordMap: Record<string, string> = {
    '房贷': '居住与房贷', '房租': '居住与房贷', '物业': '居住与房贷', '居住': '居住与房贷',
    '水电': '水电燃气与通讯', '燃气': '水电燃气与通讯', '通讯': '水电燃气与通讯', '话费': '水电燃气与通讯', '宽带': '水电燃气与通讯',
    '餐饮': '餐饮与食品', '吃饭': '餐饮与食品', '外卖': '餐饮与食品', '美食': '餐饮与食品', '食材': '餐饮与食品', '超市': '餐饮与食品',
    '交通': '交通与车辆养护', '出行': '交通与车辆养护', '打车': '交通与车辆养护', '加油': '交通与车辆养护', '车贷': '交通与车辆养护', '停车': '交通与车辆养护',
    '教育': '教育与自我提升', '学习': '教育与自我提升', '培训': '教育与自我提升', '学费': '教育与自我提升', '兴趣班': '教育与自我提升', '书籍': '教育与自我提升',
    '医疗': '医疗与健康', '看病': '医疗与健康', '药品': '医疗与健康', '体检': '医疗与健康', '健身': '医疗与健康', '保险': '医疗与健康',
    '服饰': '服饰与个人形象', '衣服': '服饰与个人形象', '鞋子': '服饰与个人形象', '美容': '服饰与个人形象', '理发': '服饰与个人形象', '化妆品': '服饰与个人形象',
    '家居': '家居日用与耐用品', '家具': '家居日用与耐用品', '家电': '家居日用与耐用品', '数码': '家居日用与耐用品', '日用': '家居日用与耐用品', '清洁': '家居日用与耐用品',
    '娱乐': '休闲娱乐与社交', '休闲': '休闲娱乐与社交', '电影': '休闲娱乐与社交', '旅游': '休闲娱乐与社交', '游戏': '休闲娱乐与社交', '社交': '休闲娱乐与社交',
    '宠物': '宠物支出', '猫粮': '宠物支出', '狗粮': '宠物支出', '宠物医': '宠物支出',
    '金融': '金融与保险支出', '利息': '金融与保险支出', '手续费': '金融与保险支出', '投资': '金融与保险支出',
    '杂项': '其他与杂项', '捐款': '其他与杂项', '罚款': '其他与杂项',
  }
  const keyword = Object.keys(keywordMap).find(k => name.includes(k))
  if (keyword) {
    const matched = expenseCategories.value.find(c => c.name === keywordMap[keyword])
    if (matched) return matched.id
  }
  return undefined
}

function addCategory() {
  recognizedCategories.value.push({
    name: '',
    amount: 0,
    confidence: 0.8,
    matchedCategoryId: undefined,
  })
}

function removeCategory(index: number) {
  recognizedCategories.value.splice(index, 1)
}

function resetToUpload() {
  step.value = 'upload'
  imagePreviewUrl.value = ''
  recognizedCategories.value = []
  rawResponse.value = ''
  activeTab.value = 'result'
  selectedAccountId.value = null
  selectedDate.value = Date.now()
  selectedMember.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function handleImport() {
  if (!canImport.value || !selectedAccountId.value) return
  importing.value = true
  try {
    const params: BatchImportParams = {
      items: recognizedCategories.value
        .filter(item => item.matchedCategoryId && item.amount > 0)
        .map(item => ({
          category_id: item.matchedCategoryId!,
          amount: item.amount.toFixed(2),
          description: '截图导入 - ' + item.name,
          member_name: selectedMember.value || '',
        })),
      date: new Date(selectedDate.value).toISOString().split('T')[0],
      from_account_id: selectedAccountId.value,
    }
    await addBatchTransactions(params)
    importedCount.value = params.items.length
    step.value = 'done'
    emit('imported')
    message.success('成功导入 ' + params.items.length + ' 条记录')
  } catch (error) {
    console.error('Import failed:', error)
    message.error('导入失败：' + (error as Error).message)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.image-import-container { min-height: 400px; }

.upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.upload-area {
  width: 100%;
  max-width: 500px;
  padding: 60px 40px;
  border: 2px dashed var(--border-color, #ddd);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: var(--accent-blue, #4C9AFF);
  background: var(--hover-bg, #f5f5f5);
}

.upload-icon { font-size: 48px; margin-bottom: 16px; }
.upload-text { font-size: 16px; font-weight: 500; margin-bottom: 8px; }
.upload-hint { font-size: 14px; color: #999; }

.recognizing-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 40px;
}

.preview-container {
  max-width: 400px;
  max-height: 300px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recognizing-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.status-text { font-size: 16px; color: #666; }

.confirm-section { padding: 0; }
.confirm-layout { display: flex; gap: 24px; }

.preview-container-small {
  flex: 0 0 280px;
  max-height: 480px;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.preview-image-small {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.result-container {
  flex: 1;
  min-width: 0;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.result-header h3 { margin: 0; font-size: 15px; }

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.category-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--bg-card, #fff);
  border-radius: 6px;
  border: 1px solid var(--border-color, #eee);
}

.category-info { display: flex; gap: 8px; }
.category-match { display: flex; align-items: center; gap: 8px; }
.match-label { color: #999; }

.total-amount {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border-color, #eee);
  font-size: 16px;
  margin-top: 12px;
}

.total-amount .amount {
  font-weight: 600;
  color: var(--accent-red, #F87171);
  font-size: 18px;
}

.import-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card, #f9f9f9);
  border-radius: 8px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.setting-label {
  width: 70px;
  font-size: 14px;
  color: #666;
  text-align: right;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.raw-data-container {
  padding: 8px 0;
}

.done-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.done-icon { font-size: 64px; }
.done-text { font-size: 24px; font-weight: 600; }
.done-detail { font-size: 16px; color: #666; }
</style>
