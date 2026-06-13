<template>
  <div class="accounts-page">
    <div class="page-header">
      <h2 class="page-title">账户管理</h2>
      <div class="header-right">
        <div class="summary-pills">
          <div class="pill pill--asset">
            <span class="pill-label">总资产</span>
            <span class="pill-value">{{ currencyPlain(totalAssets) }}</span>
          </div>
          <div class="pill pill--liability">
            <span class="pill-label">总负债</span>
            <span class="pill-value">{{ currencyPlain(totalLiabilities) }}</span>
          </div>
          <div class="pill" :class="netWorth.isNegative() ? 'pill--liability' : 'pill--asset'">
            <span class="pill-label">净资产</span>
            <span class="pill-value">{{ currencyPlain(netWorth) }}</span>
          </div>
          <div class="pill pill--account">
            <span class="pill-label">账户资产</span>
            <span class="pill-value">{{ currencyPlain(accountAssetsTotal) }}</span>
          </div>
          <div class="pill pill--physical">
            <span class="pill-label">实物资产</span>
            <span class="pill-value">{{ currencyPlain(physicalAssetsTotal) }}</span>
          </div>
        </div>
        <n-button type="primary" @click="openAdd">
          <template #icon><PlusOutlined /></template>
          添加账户
        </n-button>
      </div>
    </div>

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

    <TransitionGroup name="card-grid" tag="div" class="account-grid">
      <div
        v-for="account in filteredAccounts"
        :key="account.id"
        class="glass-card account-card"
        :class="{ 'card--expanded': expandedId === account.id, 'card--liability': account.type === 'liability' }"
        @click="expandedId = expandedId === account.id ? null : account.id"
      >
        <!-- Row 1: Icon + Type Badge -->
        <div class="card-head">
          <div class="account-icon" :class="'icon--' + account.type">
            <component :is="accountIcon(account.sub_type)" :size="22" />
          </div>
          <span class="type-badge" :class="'type-badge--' + account.type">
            {{ account.type === 'asset' ? '资产' : '负债' }}
            <span class="status-dot" :class="account.is_active ? 'dot--active' : 'dot--inactive'" />
          </span>
        </div>

        <!-- Row 2: Name + Balance (prominent) -->
        <div class="card-body">
          <p class="account-name">{{ account.name }}</p>
          <p class="account-balance" :class="account.type === 'asset' ? 'text-profit' : 'text-loss'">
            {{ account.type === 'liability' ? '-' : '' }}{{ currencyPlain(account.balance) }}
          </p>
        </div>

        <!-- Row 3: Sync info + Actions -->
        <div class="card-foot" @click.stop>
          <div class="account-sync-info">
            <span v-if="account.sync_mode === 'exact'" class="sync-badge sync-badge--exact">精确同步</span>
            <span v-else class="sync-badge sync-badge--approx">近似记账</span>
            <span v-if="account.last_synced_at" class="sync-time">上次: {{ formatDate(account.last_synced_at) }}</span>
          </div>
          <div class="card-actions">
            <n-button text size="tiny" type="primary" @click="openSync(account)" class="action-btn" title="同步余额">
              <template #icon><SyncOutlined /></template>
            </n-button>
            <n-button text size="tiny" @click="openEdit(account)" class="action-btn" title="编辑">
              <template #icon><EditOutlined /></template>
            </n-button>
            <n-button text size="tiny" type="error" @click="handleDelete(account)" class="action-btn" title="删除">
              <template #icon><DeleteOutlined /></template>
            </n-button>
          </div>
        </div>

        <!-- Expand Detail -->
        <Transition name="expand">
          <div v-if="expandedId === account.id" class="card-detail">
            <div class="detail-row">
              <span class="detail-label">子类型</span>
              <span class="detail-value">{{ subTypeLabel(account.sub_type) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">币种</span>
              <span class="detail-value">{{ account.currency }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">记账模式</span>
              <span class="detail-value">
                <n-select
                  :value="account.sync_mode"
                  :options="syncModeOptions"
                  size="tiny"
                  style="width: 100px"
                  @update:value="(val: string) => handleSyncModeChange(account, val)"
                />
              </span>
            </div>
            <div v-if="account.sub_type === 'investment' && investmentReturn(account.id)" class="detail-row">
              <span class="detail-label">投资收益率</span>
              <span class="detail-value" :class="investmentReturn(account.id)! >= 0 ? 'text-profit' : 'text-loss'">
                {{ investmentReturn(account.id)! >= 0 ? '+' : '' }}{{ (investmentReturn(account.id)! * 100).toFixed(2) }}%
              </span>
            </div>
            <div v-if="account.notes" class="detail-row detail-row--notes">
              <span class="detail-label">备注</span>
              <span class="detail-value detail-notes">{{ account.notes }}</span>
            </div>
            <!-- 负债还债进度 -->
            <div v-if="account.type === 'liability' && account.original_amount && Number(account.original_amount) > 0" class="debt-progress">
              <div class="debt-progress-header">
                <span class="debt-progress-label">还债进度</span>
                <span class="debt-progress-percent">{{ debtProgress(account) }}%</span>
              </div>
              <div class="debt-progress-bar">
                <div class="debt-progress-fill" :style="{ width: debtProgress(account) + '%' }" />
              </div>
              <div class="debt-progress-detail">
                <span>总债务：{{ currencyPlain(account.original_amount) }}</span>
                <span>已还：{{ currencyPlain(debtPaid(account)) }}</span>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </TransitionGroup>

    <!-- Add / Edit Modal -->
    <n-modal v-model:show="showModal" preset="card" :title="editingId ? '编辑账户' : '添加账户'" style="width: 460px;">
      <n-form ref="formRef" :model="accountForm" label-placement="left" label-width="70">
        <n-form-item label="名称" path="name">
          <n-input v-model:value="accountForm.name" placeholder="账户名称" />
        </n-form-item>
        <n-form-item label="类型" path="type">
          <n-select v-model:value="accountForm.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="子类型" path="sub_type">
          <n-select v-model:value="accountForm.sub_type" :options="subTypeOptions" />
        </n-form-item>
        <n-form-item label="余额" path="balance">
          <CalculatorInput v-model:value="accountForm.balance">
            <template #prefix>¥</template>
          </CalculatorInput>
        </n-form-item>
        <n-form-item label="币种" path="currency">
          <n-input v-model:value="accountForm.currency" placeholder="CNY" />
        </n-form-item>
        <n-form-item label="启用" path="is_active">
          <n-switch v-model:value="accountForm.is_active" />
        </n-form-item>
        <n-form-item label="备注" path="notes">
          <n-input v-model:value="accountForm.notes" type="textarea" placeholder="添加备注信息..." :rows="2" />
        </n-form-item>
        <n-form-item v-if="accountForm.type === 'liability'" label="总债务" path="original_amount">
          <CalculatorInput v-model:value="accountForm.original_amount" placeholder="原始借款总额">
            <template #prefix>¥</template>
          </CalculatorInput>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showModal = false">取消</n-button>
          <n-button type="primary" @click="handleSave">{{ editingId ? '保存' : '添加' }}</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- Sync Balance Modal -->
    <n-modal v-model:show="showSyncModal" preset="card" title="同步余额" style="width: 420px;">
      <div v-if="syncAccount" class="sync-modal-content">
        <div class="sync-account-info">
          <div class="sync-account-name">{{ syncAccount.name }}</div>
          <div class="sync-account-current">
            当前记录余额：<span class="text-bold">{{ currencyPlain(syncAccount.balance) }}</span>
          </div>
        </div>

        <n-form label-placement="top">
          <n-form-item label="真实余额（从银行APP/账单核对）">
            <CalculatorInput v-model:value="syncForm.new_balance" placeholder="输入真实余额">
              <template #prefix>¥</template>
            </CalculatorInput>
          </n-form-item>

          <div v-if="syncDiff !== null" class="sync-diff-info">
            <div class="sync-diff-label">差额：</div>
            <div class="sync-diff-value" :class="syncDiff >= 0 ? 'text-profit' : 'text-loss'">
              {{ syncDiff >= 0 ? '+' : '' }}{{ currencyPlain(syncDiff) }}
            </div>
          </div>

          <n-form-item v-if="syncDiff !== null && syncDiff !== 0" label="差额处理方式">
            <n-radio-group v-model:value="syncForm.diff_handling">
              <n-space>
                <n-radio value="expense">记为支出（日常开销遗漏）</n-radio>
                <n-radio value="income">记为收入（收入遗漏）</n-radio>
                <n-radio value="ignore">忽略（仅更新余额）</n-radio>
              </n-space>
            </n-radio-group>
          </n-form-item>

          <n-form-item label="备注">
            <n-input v-model:value="syncForm.note" placeholder="可选，添加备注..." />
          </n-form-item>
        </n-form>
      </div>
      <template #footer>
        <n-space justify="end">
          <n-button @click="showSyncModal = false">取消</n-button>
          <n-button type="primary" :loading="syncLoading" @click="handleSync">确认同步</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NButton, NModal, NForm, NFormItem, NInput, NSelect, NSwitch, NSpace,
  NRadioGroup, NRadio, useMessage, useDialog,
} from 'naive-ui'
import CalculatorInput from '../components/CalculatorInput.vue'
import type { SelectOption } from 'naive-ui'
import { useFinance } from '../composables/useFinance'
import { useFormatter } from '../composables/useFormatter'
import {
  BankOutlined, CreditCardOutlined, HomeOutlined, EditOutlined, DeleteOutlined,
  MoneyCollectOutlined, StockOutlined, WalletOutlined, PlusOutlined, SyncOutlined,
  TransactionOutlined, TeamOutlined,
} from '@vicons/antd'
import type { Account } from '@shared/types'
import Decimal from 'decimal.js'

const {
  assetAccounts, liabilityAccounts,
  accountAssetsTotal, physicalAssetsTotal,
  totalAssets, totalLiabilities,
  netWorth, investmentPerformance, addAccount, updateAccount, deleteAccount, syncBalance,
} = useFinance()
const { currencyPlain } = useFormatter()
const message = useMessage()
const dialog = useDialog()

const activeTab = ref<'all' | 'asset' | 'liability'>('all')
const expandedId = ref<number | null>(null)

const tabs = computed(() => [
  { key: 'all' as const, label: '全部', emoji: '🏦', count: assetAccounts.value.length + liabilityAccounts.value.length },
  { key: 'asset' as const, label: '资产', emoji: '💰', count: assetAccounts.value.length },
  { key: 'liability' as const, label: '负债', emoji: '💳', count: liabilityAccounts.value.length },
])

const filteredAccounts = computed(() => {
  if (activeTab.value === 'asset') return assetAccounts.value
  if (activeTab.value === 'liability') return liabilityAccounts.value
  return [...assetAccounts.value, ...liabilityAccounts.value]
})

function accountIcon(subType: string) {
  const map: Record<string, any> = {
    cash: MoneyCollectOutlined,
    bank: BankOutlined,
    investment: StockOutlined,
    receivable: TransactionOutlined,
    mortgage: HomeOutlined,
    consumer_loan: CreditCardOutlined,
    private_loan: TeamOutlined,
  }
  return map[subType] || WalletOutlined
}

function subTypeLabel(subType: string) {
  const map: Record<string, string> = {
    cash: '现金', bank: '银行卡', investment: '投资', receivable: '债权',
    mortgage: '房贷', consumer_loan: '消费贷/信用卡', private_loan: '民间借款',
  }
  return map[subType] || subType
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '从未'
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  return `${month}月${day}日`
}

function investmentReturn(accountId: number): number | null {
  const perf = investmentPerformance.value.find(p => p.account.id === accountId)
  if (!perf || perf.costBasis.eq(0)) return null
  return perf.returnRate.toNumber()
}

// 计算已还金额 = 总债务 - 当前余额
function debtPaid(account: Account): string {
  if (!account.original_amount) return '0.00'
  const original = Number(account.original_amount)
  const balance = Number(account.balance)
  return String(Math.max(0, original - balance))
}

// 计算还债进度百分比
function debtProgress(account: Account): number {
  if (!account.original_amount || Number(account.original_amount) <= 0) return 0
  const original = Number(account.original_amount)
  const balance = Number(account.balance)
  const paid = original - balance
  return Math.min(100, Math.max(0, Math.round((paid / original) * 100)))
}

// ---- Sync Mode Options ----
const syncModeOptions: SelectOption[] = [
  { label: '精确同步', value: 'exact' },
  { label: '近似记账', value: 'approximate' },
]

async function handleSyncModeChange(account: Account, mode: string) {
  try {
    await updateAccount(account.id, { sync_mode: mode as 'exact' | 'approximate' })
    message.success('记账模式已更新')
  } catch {
    message.error('更新失败')
  }
}

// ---- Account Modal (Add / Edit) ----
const showModal = ref(false)
const editingId = ref<number | null>(null)
const formRef = ref()
const accountForm = ref({ name: '', type: 'asset' as 'asset' | 'liability', sub_type: 'bank' as string, balance: null as number | null, currency: 'CNY', is_active: true, notes: '', original_amount: null as number | null })

const typeOptions: SelectOption[] = [
  { label: '资产', value: 'asset' },
  { label: '负债', value: 'liability' },
]
const subTypeOptions = computed<SelectOption[]>(() =>
  accountForm.value.type === 'asset'
    ? [{ label: '现金', value: 'cash' }, { label: '银行卡', value: 'bank' }, { label: '投资', value: 'investment' }, { label: '债权', value: 'receivable' }]
    : [{ label: '房贷', value: 'mortgage' }, { label: '消费贷/信用卡', value: 'consumer_loan' }, { label: '民间借款', value: 'private_loan' }]
)

function openAdd() {
  editingId.value = null
  accountForm.value = { name: '', type: 'asset', sub_type: 'bank', balance: null, currency: 'CNY', is_active: true, notes: '', original_amount: null }
  showModal.value = true
}

function openEdit(account: Account) {
  editingId.value = account.id
  accountForm.value = {
    name: account.name,
    type: account.type,
    sub_type: account.sub_type,
    balance: Number(account.balance),
    currency: account.currency,
    is_active: account.is_active,
    notes: account.notes || '',
    original_amount: account.original_amount ? Number(account.original_amount) : null,
  }
  showModal.value = true
}

async function handleSave() {
  try {
    const baseData = {
      name: accountForm.value.name,
      type: accountForm.value.type,
      sub_type: accountForm.value.sub_type,
      balance: String(accountForm.value.balance ?? 0),
      currency: accountForm.value.currency,
      is_active: accountForm.value.is_active,
      notes: accountForm.value.notes || '',
      original_amount: accountForm.value.type === 'liability' ? String(accountForm.value.original_amount ?? 0) : '',
    }
    if (editingId.value) {
      await updateAccount(editingId.value, baseData)
      message.success('更新成功')
    } else {
      await addAccount(baseData)
      message.success('添加成功')
    }
    showModal.value = false
  } catch {
    message.error('操作失败')
  }
}

function handleDelete(account: Account) {
  dialog.warning({
    title: '删除账户',
    content: `确定要删除「${account.name}」吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await deleteAccount(account.id)
        message.success('已删除')
      } catch {
        message.error('删除失败')
      }
    },
  })
}

// ---- Sync Balance Modal ----
const showSyncModal = ref(false)
const syncAccount = ref<Account | null>(null)
const syncLoading = ref(false)
const syncForm = ref({
  new_balance: null as number | null,
  diff_handling: 'expense' as 'expense' | 'income' | 'ignore',
  note: '',
})

const syncDiff = computed(() => {
  if (!syncAccount.value || syncForm.value.new_balance === null) return null
  return new Decimal(syncForm.value.new_balance).minus(new Decimal(syncAccount.value.balance)).toNumber()
})

function openSync(account: Account) {
  syncAccount.value = account
  syncForm.value = {
    new_balance: Number(account.balance),
    diff_handling: 'expense',
    note: '',
  }
  showSyncModal.value = true
}

async function handleSync() {
  if (!syncAccount.value || syncForm.value.new_balance === null) return

  syncLoading.value = true
  try {
    await syncBalance({
      account_id: syncAccount.value.id,
      new_balance: String(syncForm.value.new_balance),
      diff_handling: syncForm.value.diff_handling,
      note: syncForm.value.note,
    })
    message.success('余额已同步')
    showSyncModal.value = false
  } catch {
    message.error('同步失败')
  } finally {
    syncLoading.value = false
  }
}
</script>

<style scoped>
.accounts-page { padding: clamp(16px, 2vw, 32px); width: 100%; box-sizing: border-box; }
.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
.page-title { margin: 0; font-size: 24px; font-weight: 700; color: var(--text-primary); }
.header-right { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.card-actions { display: flex; gap: 4px; flex-shrink: 0; }
.action-btn { opacity: 0.5; transition: opacity 0.2s; }
.action-btn:hover { opacity: 1; }

.summary-pills { display: flex; gap: 12px; }
.pill {
  display: flex; flex-direction: column; align-items: flex-end;
  background: var(--bg-card);
  border: 1px solid var(--border-card);
  border-radius: 12px; padding: 10px 16px; min-width: 140px;
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
}
.pill--asset { border-left: 3px solid var(--color-profit); }
.pill--liability { border-left: 3px solid var(--color-loss); }
.pill--account { border-left: 3px solid #4C9AFF; }
.pill--physical { border-left: 3px solid #FBBF24; }
.pill-label { font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; }
.pill-value { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px; color: var(--text-primary); }

.tabs-row { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
.tab-btn {
  display: flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 10px;
  border: 1px solid var(--border-card);
  background: var(--bg-card); color: var(--text-secondary); font-size: 14px;
  cursor: pointer; transition: all 0.2s ease; white-space: nowrap;
}
.tab-btn:hover { border-color: var(--border-card-hover); color: var(--text-primary); }
.tab-btn.active { background: rgba(76,154,255,0.10); border-color: rgba(76,154,255,0.30); color: #4C9AFF; }
.tab-count { background: var(--border-subtle); border-radius: 6px; padding: 1px 7px; font-size: 12px; color: var(--text-muted); }
.tab-btn.active .tab-count { background: rgba(76,154,255,0.2); color: #4C9AFF; }

.card-grid-enter-active { transition: all 0.35s ease; }
.card-grid-leave-active { transition: all 0.25s ease; position: absolute; }
.card-grid-enter-from { opacity: 0; transform: scale(0.92); }
.card-grid-leave-to { opacity: 0; transform: scale(0.92); }
.card-grid-move { transition: transform 0.3s ease; }

.account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: clamp(14px, 1.2vw, 20px); }
.glass-card.account-card {
  padding: 20px 24px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
}
.glass-card.account-card::after {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 140px; height: 140px;
  border-radius: 50%;
  transform: translate(40px, -40px);
  opacity: 0.1;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.glass-card.account-card:hover::after { opacity: 0.12; }
.glass-card.account-card::after { background: var(--color-profit); }
.glass-card.account-card.card--liability::after { background: var(--color-loss); }

.glass-card.account-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.08);
}

/* Row 1: Head — icon + type badge */
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.account-icon {
  width: 42px; height: 42px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}
.icon--asset {
  background: linear-gradient(135deg, rgba(var(--color-profit-rgb), 0.22), rgba(var(--color-profit-rgb), 0.12));
  color: var(--color-profit);
}
.icon--liability {
  background: linear-gradient(135deg, rgba(var(--color-loss-rgb), 0.22), rgba(var(--color-loss-rgb), 0.12));
  color: var(--color-loss);
}
.type-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
  letter-spacing: 0.5px;
}
.type-badge--asset { background: rgba(var(--color-profit-rgb), 0.16); color: var(--color-profit); }
.type-badge--liability { background: rgba(var(--color-loss-rgb), 0.16); color: var(--color-loss); }
.status-dot { width: 5px; height: 5px; border-radius: 50%; display: inline-block; }
.dot--active { background: currentColor; }
.dot--inactive { background: var(--text-muted); }

/* Row 2: Body — name + big balance */
.card-body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.account-name {
  font-size: 15px; font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 55%;
}
.account-balance {
  font-size: 26px; font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.5px;
  margin: 0;
  line-height: 1.1;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Row 3: Foot — sync left, actions right */
.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
}
.account-sync-info { display: flex; align-items: center; gap: 6px; }
.sync-badge { font-size: 10px; padding: 2px 8px; border-radius: 5px; font-weight: 600; letter-spacing: 0.3px; }
.sync-badge--exact { background: rgba(76,154,255,0.15); color: #3B82F6; }
.sync-badge--approx { background: rgba(245,158,11,0.15); color: #D97706; }
.sync-time { font-size: 11px; color: var(--text-muted); }
.card-actions { display: flex; gap: 2px; align-items: center; }
.action-btn { opacity: 0.55; transition: opacity 0.2s; }
.action-btn:hover { opacity: 1; }
.glass-card.account-card:hover .action-btn { opacity: 0.75; }

/* Expanded detail */
.card-detail {
  margin-top: 4px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.detail-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.detail-row--notes { align-items: flex-start; }
.detail-label { color: var(--text-muted); font-size: 12px; }
.detail-value { color: var(--text-primary); display: flex; align-items: center; gap: 6px; font-weight: 500; }
.detail-notes { font-size: 13px; max-width: 200px; word-break: break-all; text-align: right; }

.text-green { color: var(--color-profit); }
.text-red { color: var(--color-loss); }
.text-bold { font-weight: 600; }

.account-notes {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.detail-notes {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: right;
  max-width: 200px;
  word-break: break-all;
}

.debt-progress {
  margin-top: 8px;
  padding: 10px 12px;
  background: rgba(var(--color-loss-rgb), 0.10);
  border-radius: 8px;
  border: 1px solid rgba(var(--color-loss-rgb), 0.18);
}

.debt-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.debt-progress-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.debt-progress-percent {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-profit);
  font-variant-numeric: tabular-nums;
}

.debt-progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(var(--color-loss-rgb), 0.12);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.debt-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-profit), color-mix(in srgb, var(--color-profit) 70%, white));
  border-radius: 4px;
  transition: width 0.6s ease;
  min-width: 2px;
}

.debt-progress-detail {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-muted);
}

/* Sync Modal */
.sync-modal-content { display: flex; flex-direction: column; gap: 16px; }
.sync-account-info { padding: 12px; background: var(--bg-hover); border-radius: 8px; }
.sync-account-name { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
.sync-account-current { font-size: 14px; color: var(--text-secondary); }
.sync-diff-info { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--bg-hover); border-radius: 8px; }
.sync-diff-label { font-size: 14px; color: var(--text-secondary); }
.sync-diff-value { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }

.expand-enter-active, .expand-leave-active { transition: all 0.3s ease; }
.expand-enter-from, .expand-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 768px) {
  .summary-pills { flex-wrap: wrap; }
  .pill { min-width: 100px; padding: 8px 12px; }
}
</style>
