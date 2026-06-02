/**
 * Image Recognition Module
 */
import type { RecognitionConfig, RecognitionResult, RecognizedCategory } from '@shared/types'

const RECOGNITION_PROMPT = `You are a financial data recognition expert. Analyze this image and identify all expense categories with their amounts.

Requirements:
1. Only identify summary amounts for expense categories, not individual transactions
2. Return JSON format with categories array
3. Each category contains name and amount (pure number)
4. If there is a total expense amount in the image, extract it too

Return format (JSON only, no other text):
{
  "categories": [
    {"name": "Food", "amount": 1500.00},
    {"name": "Electronics", "amount": 3000.00}
  ],
  "totalAmount": 4500.00
}

Note:
- Amount should be numbers only, no currency symbols
- Category names should be in Chinese, concise (2-4 characters)
- If unclear, still try to recognize but you can reduce precision`

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
    max_tokens: 1000,
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
    // Handle cases like: ```json\n{...}\n``` or ```\n{...}\n```
    if (jsonStr.startsWith('```')) {
      // Find the first newline after opening ```
      const firstNewline = jsonStr.indexOf('\n', 3)
      if (firstNewline !== -1) {
        // Find the closing ```
        const closingIndex = jsonStr.lastIndexOf('```')
        if (closingIndex > firstNewline) {
          jsonStr = jsonStr.substring(firstNewline + 1, closingIndex).trim()
        }
      }
    }

    // Find JSON object boundaries
    const startIndex = jsonStr.indexOf('{')
    const endIndex = jsonStr.lastIndexOf('}')
    if (startIndex !== -1 && endIndex !== -1) {
      jsonStr = jsonStr.substring(startIndex, endIndex + 1)
    }

    const parsed: any = JSON.parse(jsonStr)

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
