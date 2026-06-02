<template>
  <n-modal :show="show" preset="card" title="从截图导入" style="width: 900px; max-height: 80vh;"
    :bordered="false" :mask-closable="false" @update:show="$emit('update:show', $event)">
    <div class="image-import-container">
      <!-- 步骤1: 上传截图 -->
      <div v-if="step === 'upload'" class="upload-section">
        <div class="upload-area" :class="{ 'drag-over': isDragOver }"
          @dragover.prevent="isDragOver = true"
          @dragleave="isDragOver = false"
          @drop.prevent="handleDrop"
          @click="triggerFileInput">
          <input ref="fileInput" type="file" accept="image/*" style="display: none;" @change="handleFileSelect">
          <div class="upload-icon">📸</div>
          <div class="upload-text">点击或拖拽图片到此处</div>
          <div class="upload-hint">支持 PNG、JPG、WebP 格式，最大 10MB</div>
        </div>
      </div>

      <!-- 步骤2: 识别中 -->
      <div v-else-if="step === 'recognizing'" class="recognizing-section">
        <div class="preview-container">
          <img :src="imagePreviewUrl" alt="预览" class="preview-image">
        </div>
        <div class="recognizing-status">
          <n-spin size="large" />
          <div class="status-text">正在识别中，请稍候...</div>
        </div>
      </div>

      <!-- 步骤3: 确认识别结果 -->
      <div v-else-if="step === 'confirm'" class="confirm-section">
        <div class="confirm-layout">
          <!-- 左侧：图片预览 -->
          <div class="preview-container-small">
            <img :src="imagePreviewUrl" alt="预览" class="preview-image-small">
          </div>

          <!-- 右侧：识别结果 -->
          <div class="result-container">
            <div class="result-header">
              <h3>识别结果</h3>
              <n-button size="small" @click="resetToUpload">重新识别</n-button>
            </div>

            <!-- 分类支出列表 -->
            <div class="category-list">
              <div v-for="(item, index) in recognizedCategories" :key="index" class="category-item">
                <div class="category-info">
                  <n-input v-model:value="item.name" size="small" style="width: 100px;" placeholder="类别名" />
                  <n-input-number v-model:value="item.amount" size="small" style="width: 120px;"
                    :precision="2" :min="0" placeholder="金额" />
                </div>
                <div class="category-match">
                  <span class="match-label">→</span>
                  <n-select v-model:value="item.matchedCategoryId" size="small" style="width: 120px;"
                    :options="categoryOptions" placeholder="选择分类" />
                </div>
                <n-button size="small" type="error" @click="removeCategory(index)">删除</n-button>
              </div>
            </div>

            <n-button size="small" @click="addCategory" style="margin-top: 8px;">+ 添加分类</n-button>

            <!-- 总金额 -->
            <div class="total-amount">
              <span>总金额：</span>
              <span class="amount">¥{{ totalAmount.toLocaleString() }}</span>
            </div>

            <!-- 导入设置 -->
            <div class="import-settings">
              <div class="setting-item">
                <span class="setting-label">导入账户：</span>
                <n-select v-model:value="selectedAccountId" size="small" style="width: 200px;"
                  :options="accountOptions" placeholder="选择支出账户" />
              </div>
              <div class="setting-item">
                <span class="setting-label">记账日期：</span>
                <n-date-picker v-model:value="selectedDate" size="small" type="date"
                  style="width: 200px;" />
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="action-buttons">
              <n-button @click="resetToUpload">取消</n-button>
              <n-button type="primary" :disabled="!canImport" :loading="importing" @click="handleImport">
                确认导入
              </n-button>
            </div>
          </div>
        </div>
      </div>

      <!-- 步骤4: 导入完成 -->
      <div v-else-if="step === 'done'" class="done-section">
        <div class="done-icon">✅</div>
        <div class="done-text">导入成功！</div>
        <div class="done-detail">已导入 {{ importedCount }} 条支出记录</div>
        <n-button type="primary" @click="resetToUpload" style="margin-top: 16px;">继续导入</n-button>
        <n-button @click="$emit('update:show', false)" style="margin-top: 8px;">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { NModal, NButton, NInput, NInputNumber, NSelect, NDatePicker, NSpin, useMessage } from 'naive-ui'
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
const { assetAccounts, expenseCategories, addBatchTransactions } = useFinance()

// 状态
type Step = 'upload' | 'recognizing' | 'confirm' | 'done'
const step = ref<Step>('upload')
const isDragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const imagePreviewUrl = ref('')
const importing = ref(false)
const importedCount = ref(0)

// 识别结果
const recognizedCategories = ref<(RecognizedCategory & { amount: number })[]>([])

// 导入设置
const selectedAccountId = ref<number | null>(null)
const selectedDate = ref(Date.now())

// 计算属性
const categoryOptions = computed(() =>
  (expenseCategories.value || []).map(c => ({
    label: c.name,
    value: c.id,
  }))
)

const accountOptions = computed(() =>
  (assetAccounts.value || [])
    .map(a => ({
      label: `${a.name} (${a.sub_type === 'cash' ? '现金' : a.sub_type === 'bank' ? '银行' : a.sub_type})`,
      value: a.id,
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

// 监听show变化，重置状态
watch(() => props.show, (newVal) => {
  if (newVal) {
    resetToUpload()
  }
})

// 触发文件选择
function triggerFileInput() {
  fileInput.value?.click()
}

// 处理文件选择
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    processFile(file)
  }
}

// 处理拖拽
function handleDrop(event: DragEvent) {
  isDragOver.value = false
  const file = event.dataTransfer?.files[0]
  if (file && file.type.startsWith('image/')) {
    processFile(file)
  } else {
    message.error('请上传图片文件')
  }
}

// 处理文件
async function processFile(file: File) {
  // 验证文件大小
  if (file.size > 10 * 1024 * 1024) {
    message.error('图片大小不能超过10MB')
    return
  }

  // 创建预览URL
  imagePreviewUrl.value = URL.createObjectURL(file)

  // 转换为Base64（保留data URL格式）
  const dataUrl = await fileToDataUrl(file)

  // 开始识别
  step.value = 'recognizing'
  await recognizeImage(dataUrl)
}

// 文件转Data URL（包含MIME类型）
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 识别图像
async function recognizeImage(base64: string) {
  try {
    // 从设置中获取识别配置
    const configStr = localStorage.getItem('recognition_config')
    if (!configStr) {
      message.error('请先在设置中配置图像识别服务')
      step.value = 'upload'
      return
    }

    const config: RecognitionConfig = JSON.parse(configStr)

    // 检查配置是否完整
    if (!config.apiKey) {
      message.error('请先在设置中配置API密钥')
      step.value = 'upload'
      return
    }

    if ((config.provider === 'custom' || config.provider === 'ollama') && !config.baseUrl) {
      message.error('请先在设置中配置API端点')
      step.value = 'upload'
      return
    }

    const result: RecognitionResult = await window.electronAPI.recognizeExpenseImage(base64, config)

    // 处理识别结果
    recognizedCategories.value = result.categories.map(cat => ({
      ...cat,
      amount: parseFloat(cat.amount) || 0,
      // 自动匹配分类
      matchedCategoryId: matchCategory(cat.name),
    }))

    step.value = 'confirm'
  } catch (error) {
    console.error('识别失败:', error)
    const errorMsg = (error as Error).message

    // 提供更友好的错误提示
    if (errorMsg.includes('401') || errorMsg.includes('Invalid API Key')) {
      message.error('API密钥无效，请在设置中检查并重新配置')
    } else if (errorMsg.includes('403')) {
      message.error('API访问被拒绝，请检查API密钥权限')
    } else if (errorMsg.includes('429')) {
      message.error('API调用频率过高，请稍后再试')
    } else if (errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
      message.error('API服务暂时不可用，请稍后再试')
    } else if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      message.error('网络连接失败，请检查网络设置')
    } else {
      message.error(`识别失败: ${errorMsg}`)
    }

    step.value = 'upload'
  }
}

// 匹配分类
function matchCategory(name: string): number | undefined {
  // 精确匹配
  const exactMatch = expenseCategories.value.find(c => c.name === name)
  if (exactMatch) return exactMatch.id

  // 模糊匹配
  const fuzzyMatch = expenseCategories.value.find(c =>
    c.name.includes(name) || name.includes(c.name)
  )
  if (fuzzyMatch) return fuzzyMatch.id

  // 关键词映射
  const keywordMap: Record<string, string> = {
    '餐饮': '餐饮', '吃饭': '餐饮', '外卖': '餐饮', '美食': '餐饮',
    '交通': '交通', '出行': '交通', '打车': '交通',
    '购物': '购物', '消费': '购物', '网购': '购物',
    '水电': '物业水电', '物业': '物业水电', '燃': '物业水电',
    '娱乐': '娱乐', '休闲': '娱乐',
    '医疗': '医疗', '看病': '医疗', '药品': '医疗',
    '教育': '子女教育', '学习': '子女教育',
    '通讯': '通讯费', '话费': '通讯费',
    '保险': '保险费',
  }

  const keyword = Object.keys(keywordMap).find(k => name.includes(k))
  if (keyword) {
    const matched = expenseCategories.value.find(c => c.name === keywordMap[keyword])
    if (matched) return matched.id
  }

  return undefined
}

// 添加分类
function addCategory() {
  recognizedCategories.value.push({
    name: '',
    amount: 0,
    confidence: 0.8,
    matchedCategoryId: undefined,
  })
}

// 删除分类
function removeCategory(index: number) {
  recognizedCategories.value.splice(index, 1)
}

// 重置到上传状态
function resetToUpload() {
  step.value = 'upload'
  imagePreviewUrl.value = ''
  recognizedCategories.value = []
  selectedAccountId.value = null
  selectedDate.value = Date.now()
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

// 处理导入
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
          description: `截图导入 - ${item.name}`,
        })),
      date: new Date(selectedDate.value).toISOString().split('T')[0],
      from_account_id: selectedAccountId.value,
    }

    await addBatchTransactions(params)
    importedCount.value = params.items.length
    step.value = 'done'
    emit('imported')
    message.success(`成功导入 ${params.items.length} 条记录`)
  } catch (error) {
    console.error('导入失败:', error)
    message.error(`导入失败: ${(error as Error).message}`)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.image-import-container {
  min-height: 400px;
}

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

.upload-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 14px;
  color: #999;
}

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

.status-text {
  font-size: 16px;
  color: #666;
}

.confirm-section {
  padding: 16px;
}

.confirm-layout {
  display: flex;
  gap: 24px;
}

.preview-container-small {
  flex: 0 0 300px;
  max-height: 400px;
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
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-header h3 {
  margin: 0;
  font-size: 16px;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
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

.category-info {
  display: flex;
  gap: 8px;
}

.category-match {
  display: flex;
  align-items: center;
  gap: 8px;
}

.match-label {
  color: #999;
}

.total-amount {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid var(--border-color, #eee);
  font-size: 16px;
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
  width: 80px;
  font-size: 14px;
  color: #666;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.done-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
}

.done-icon {
  font-size: 64px;
}

.done-text {
  font-size: 24px;
  font-weight: 600;
}

.done-detail {
  font-size: 16px;
  color: #666;
}
</style>
