import { BrowserWindow } from 'electron'

/**
 * 将 HTML 字符串渲染为 PDF（通过隐藏的 BrowserWindow + printToPDF）
 */
export async function exportHTMLToPDF(html: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    width: 1200,
    height: 1600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  try {
    // 加载 HTML 内容
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

    // 等待页面渲染完成
    await new Promise(resolve => setTimeout(resolve, 500))

    // 生成 PDF
    const pdfData = await win.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        marginType: 'default',
      },
    })

    return Buffer.from(pdfData)
  } finally {
    win.close()
  }
}
