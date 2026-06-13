/**
 * Image Recognition Module
 */
import type { RecognitionConfig, RecognitionResult, RecognizedCategory } from '@shared/types'

const RECOGNITION_PROMPT = `你是一个财务数据识别专家API。分析这张图片，识别所有支出分类及其金额。

## 支出分类（必须从以下12个分类中选择）：
1. 居住与房贷 - 房贷月供、房租、物业管理费、取暖费、房屋维修基金
2. 水电燃气与通讯 - 水费、电费、燃气费、宽带费、手机话费
3. 餐饮与食品 - 超市买菜、外卖、下馆子、零食饮料、咖啡奶茶
4. 交通与车辆养护 - 车贷、汽油/充电费、停车费、过路费、保养维修、打车、地铁公交
5. 教育与自我提升 - 孩子学费、兴趣班、辅导班、书籍文具、成人培训、考证费
6. 医疗与健康 - 门诊、买药、体检、配眼镜、保健品、保险费（重疾险/医疗险）、健身卡
7. 服饰与个人形象 - 衣服、鞋子、包包、配饰、理发、美容护肤、化妆品
8. 家居日用与耐用品 - 家具、家电、数码产品、厨房耗材、清洁用品、个人洗护
9. 休闲娱乐与社交 - 电影、演唱会、旅游度假、游戏、爱好装备、请客送礼
10. 宠物支出 - 猫粮狗粮、宠物医疗、宠物用品
11. 金融与保险支出 - 贷款利息、银行手续费、投资亏损、财产险
12. 其他与杂项 - 捐款、罚款、无法归类的小额支出

## 要求：
1. 只识别支出分类的汇总金额
2. 返回JSON格式，包含categories数组
3. 每个分类包含name和amount（纯数字）
4. 如果图片中有总支出金额，也要提取

## 返回格式（纯JSON，无任何其他文本）：
{
  "categories": [
    {"name": "餐饮与食品", "amount": 1500.00},
    {"name": "交通与车辆养护", "amount": 3000.00}
  ],
  "totalAmount": 4500.00
}

## 注意：
- 金额只填数字，不要带货币符号
- 分类名称必须是上述12个分类之一，保持完整名称（如"餐饮与食品"）
- 如果不确定分类，优先归入"其他与杂项"
- 如果金额不清晰，就留空返回0`

export async function recognizeExpenseImage(
  imageDataUrl: string,
  config: RecognitionConfig
): Promise<RecognitionResult> {
  switch (config.provider) {
    case 'openai':
      return callOpenAIAPI(imageDataUrl, config)
    case 'anthropic':
      return callAnthropicAPI(imageDataUrl, config)
    case 'google':
      return callGoogleAPI(imageDataUrl, config)
    case 'ollama':
      return callOllamaAPI(imageDataUrl, config)
    case 'custom':
      return callCustomAPI(imageDataUrl, config)
    default:
      throw new Error('Unsupported provider: ' + config.provider)
  }
}

function extractBase64FromDataUrl(dataUrl: string): string {
  const parts = dataUrl.split(',')
  return parts.length > 1 ? parts[1] : dataUrl
}

function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/data:([^;]+);base64/)
  return match ? match[1] : 'image/jpeg'
}

async function callOpenAIAPI(imageDataUrl: string, config: RecognitionConfig): Promise<RecognitionResult> {
  const baseUrl = config.baseUrl || 'https://api.openai.com/v1'
  const model = config.model || 'gpt-4o'

  const response = await fetch(baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + config.apiKey,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: RECOGNITION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: imageDataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.1,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error('OpenAI API error: ' + response.status + ' - ' + error)
  }

  const data: any = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  return parseRecognitionResult(content)
}

async function callAnthropicAPI(imageDataUrl: string, config: RecognitionConfig): Promise<RecognitionResult> {
  const baseUrl = config.baseUrl || 'https://api.anthropic.com/v1'
  const model = config.model || 'claude-sonnet-4-20250514'
  const imageBase64 = extractBase64FromDataUrl(imageDataUrl)
  const mimeType = getMimeTypeFromDataUrl(imageDataUrl)

  const response = await fetch(baseUrl + '/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64,
              },
            },
            { type: 'text', text: RECOGNITION_PROMPT },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error('Anthropic API error: ' + response.status + ' - ' + error)
  }

  const data: any = await response.json()
  const content = data.content?.[0]?.text || ''
  return parseRecognitionResult(content)
}

async function callGoogleAPI(imageDataUrl: string, config: RecognitionConfig): Promise<RecognitionResult> {
  const baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'
  const model = config.model || 'gemini-1.5-pro'
  const imageBase64 = extractBase64FromDataUrl(imageDataUrl)
  const mimeType = getMimeTypeFromDataUrl(imageDataUrl)

  const response = await fetch(
    baseUrl + '/models/' + model + ':generateContent?key=' + config.apiKey,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: RECOGNITION_PROMPT },
              {
                inlineData: {
                  mimeType,
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1000,
        },
      }),
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error('Google API error: ' + response.status + ' - ' + error)
  }

  const data: any = await response.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return parseRecognitionResult(content)
}

async function callOllamaAPI(imageDataUrl: string, config: RecognitionConfig): Promise<RecognitionResult> {
  const baseUrl = config.baseUrl || 'http://localhost:11434'
  const model = config.model || 'minicpm-v'
  const imageBase64 = extractBase64FromDataUrl(imageDataUrl)

  const response = await fetch(baseUrl + '/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: RECOGNITION_PROMPT,
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.1,
      },
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error('Ollama API error: ' + response.status + ' - ' + error)
  }

  const data: any = await response.json()
  const content = data.response || ''
  return parseRecognitionResult(content)
}

async function callCustomAPI(imageDataUrl: string, config: RecognitionConfig): Promise<RecognitionResult> {
  if (!config.baseUrl) {
    throw new Error('Custom API requires baseUrl')
  }

  const model = config.model || 'default'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.apiKey) {
    const isXiaomiMiMo = config.baseUrl.includes('xiaomimimo') || config.baseUrl.includes('mimo')
    if (isXiaomiMiMo) {
      headers['api-key'] = config.apiKey
    } else {
      headers['Authorization'] = 'Bearer ' + config.apiKey
    }
  }

  const url = config.baseUrl + '/chat/completions'

  const requestBody = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: RECOGNITION_PROMPT },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl,
            },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error('Custom API error: ' + response.status + ' - ' + error)
  }

  const data: any = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  return parseRecognitionResult(content)
}

function parseRecognitionResult(rawResponse: string): RecognitionResult {
  try {
    let jsonStr = rawResponse.trim()

    // Remove markdown code block wrapper if present
    if (jsonStr.startsWith('```')) {
      const firstNewline = jsonStr.indexOf('\n', 3)
      if (firstNewline !== -1) {
        const closingIndex = jsonStr.lastIndexOf('```')
        if (closingIndex > firstNewline) {
          jsonStr = jsonStr.substring(firstNewline + 1, closingIndex).trim()
        }
      }
    }

    // Find JSON object boundaries
    const startIndex = jsonStr.indexOf('{')
    const endIndex = jsonStr.lastIndexOf('}')
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      jsonStr = jsonStr.substring(startIndex, endIndex + 1)
    }

    // Try to parse JSON, fix truncation if needed
    let parsed: any
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      jsonStr = tryFixTruncatedJSON(jsonStr)
      parsed = JSON.parse(jsonStr)
    }

    const categories: RecognizedCategory[] = (parsed.categories || []).map((cat: any) => ({
      name: String(cat.name || '').trim(),
      amount: String(cat.amount || 0),
      confidence: typeof cat.confidence === 'number' ? cat.confidence : 0.8,
    }))

    const totalAmount = categories.reduce(
      (sum, cat) => sum + parseFloat(cat.amount || '0'),
      0
    )

    return {
      categories,
      totalAmount: totalAmount.toFixed(2),
      rawResponse,
    }
  } catch (error) {
    console.error('Parse error:', error)
    throw new Error('Parse error: ' + (error as Error).message)
  }
}

function tryFixTruncatedJSON(jsonStr: string): string {
  let fixed = jsonStr.trim()
  let openBraces = 0, closeBraces = 0
  let openBrackets = 0, closeBrackets = 0
  let inString = false
  let prev = ''

  for (const ch of fixed) {
    if (ch === '"' && prev !== '\\') { inString = !inString }
    if (!inString) {
      if (ch === '{') openBraces++
      if (ch === '}') closeBraces++
      if (ch === '[') openBrackets++
      if (ch === ']') closeBrackets++
    }
    prev = ch
  }

  if (inString) { fixed += '"' }
  fixed = fixed.replace(/,\s*$/, '')
  while (closeBrackets < openBrackets) { fixed += ']'; closeBrackets++ }
  while (closeBraces < openBraces) { fixed += '}'; closeBraces++ }

  return fixed
}
