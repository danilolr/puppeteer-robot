import { Component, OnInit, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { JsonPipe, NgClass } from '@angular/common'
import { ApisService } from '../../service/apis.service'
import { WsService } from '../../service/ws.service'
import { RobotInfo } from '../../api/puppeteer-robot-api'

interface CommandExample {
  description: string
  command: string
}

@Component({
  selector: 'app-start-page',
  imports: [FormsModule, JsonPipe, NgClass],
  templateUrl: './start-page.html',
  styleUrl: './start-page.css'
})
export class StartPage implements OnInit {

  recs = signal<RobotInfo[]>([])
  hasIa = signal<boolean>(false)
  isLoading = signal(true)
  showCommandModal = signal(false)
  selectedRobotId = signal('')
  commandText = signal('')
  showScreenshotModal = signal(false)
  screenshotData = signal('')
  processingScreenshot = signal('')
  processingCommand = signal(false)
  processingQueryIa = signal(false)
  showQueryIaModal = signal(false)
  queryIaText = signal('')
  selectedModel = signal('gemma2:9b')
  showQueryIaResponseModal = signal(false)
  queryIaResponse = signal('')
  queryIaHtml = signal('')
  activeResponseTab = signal<'response' | 'html'>('response')
  // Command response modal
  showCommandResponseModal = signal(false)
  commandResponseText = signal('')
  // New robot modal
  showNewRobotModal = signal(false)
  poolName = signal('')
  processingNewRobot = signal(false)
  // Toast notification
  showToast = signal(false)
  toastMessage = signal('')
  toastType = signal<'success' | 'error'>('success')
  iaModels = signal<string[]>([])
  // Error modal
  showErrorModal = signal(false)
  selectedErrorInfo = signal<object | undefined>(undefined)

  commandExamples: CommandExample[] = [
    { description: 'Navigate to a website', command: "await page.goto('https://google.com')" },
    { description: 'Set field value', command: "await page.type('input[name=\"senha\"]', '123456')" },
    { description: 'Button click', command: "await page.click('button[type=\"submit\"]')" },
    { description: 'Wait for navigaton', command: "await page.waitForNavigation()" },
    { description: 'Get HTML', command: "const data = await page.evaluate(() => document.querySelector('*').outerHTML);\nreturn data;\n" },
    { description: 'Get Uploaded File Path', command: "var fp = filePath('3467be4be524b5151d060be3b6db03273ee77f2b');\nconsole.log(fp);\nreturn fp;"},
    { description: 'Set field on page context', command: "return await page.evaluate(() => {\n  document.getElementsByName('q')[0].value = 'cefip';\n  return {ok: true};\n})"},
  ]

  constructor(private readonly apisService: ApisService, private readonly wsService:WsService) {
    wsService.onEvent('updateList', async (msg) => {
      console.log("Mensagem recebida via WebSocket:", msg);
      await this.loadRobots()
    })
  }

  async ngOnInit() {
    await this.loadHasIa()
    await this.loadRobots()
  }

  openErrorModal(errorInfo: object | undefined) {
    if (errorInfo) {
      this.selectedErrorInfo.set(errorInfo)
      this.showErrorModal.set(true)
    }
  }

  closeErrorModal() {
    this.showErrorModal.set(false)
    this.selectedErrorInfo.set(undefined)
  }

  async loadHasIa() {
    try {
      const api = this.apisService.getIaApi()
      const status = await api.robotControllerIaModels()
      this.hasIa.set(status.models?.length! > 0)
      this.iaModels.set(status.models || [])
      // Set default model to first available model
      if (status.models && status.models.length > 0) {
        this.selectedModel.set(status.models[0])
      }
    } catch (error) {
      console.error('Error checking IA status:', error)
      this.hasIa.set(false)
    }
  }

  async loadRobots() {
    try {
      this.isLoading.set(true)
      const api = this.apisService.getPuppeteerRobotApi()
      const robots = await api.robotControllerList()
      this.recs.set(robots)
    } catch (error) {
      console.error('Error loading robots:', error)
      this.recs.set([])
    } finally {
      this.isLoading.set(false)
    }
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString()
  }

  async takeScreenshot(info: RobotInfo) {
      try {
        this.processingScreenshot.set(info.robotId)
        const api = this.apisService.getPuppeteerRobotApi()
        const screenshot = await api.robotControllerScreenshot({id: info.robotId})

        if (screenshot.status === "OK") {
          if (screenshot.data && typeof screenshot.data === 'string') {
            this.screenshotData.set(screenshot.data)
            this.showScreenshotModal.set(true)
          } else {
            alert('Screenshot was successful but no image data was received.')
          }
        } else {
          alert(`Screenshot failed: ${screenshot.message || 'Unknown error'}`)
        }
      } catch (error) {
        console.error('Error taking screenshot:', error)
        alert('Error taking screenshot. Please try again.')
      } finally {
        this.processingScreenshot.set('')
      }
  }

  async deleteRobot(info: RobotInfo) {
      const api = this.apisService.getPuppeteerRobotApi()
      await api.robotControllerDelete({id: info.robotId})
  }

  async queryIa(info: RobotInfo, query: string) {
      try {
        const api = this.apisService.getIaApi()
        const resp = await api.robotControllerRunIa({iaReq: {robotId: info.robotId, query: query, model: this.selectedModel()}})
        console.log(resp)
        
        if (resp) {
          if (resp.ok) {
            // Show response in modal
            this.queryIaResponse.set(resp.response || '')
            this.queryIaHtml.set(resp.html || '')
            this.activeResponseTab.set('response')
            this.showQueryIaResponseModal.set(true)
          } else {
            // Show error message
            alert(`Query failed: ${resp.message || 'Unknown error'}`)
          }
        }
        return resp
      } catch (error) {
        console.error('Error in queryIa:', error)
        alert('Error executing query. Please try again.')
        return null
      } finally {
        this.processingQueryIa.set(false)
      }
  }

  openNewRobotModal() {
    this.poolName.set('')
    this.showNewRobotModal.set(true)
  }

  closeNewRobotModal() {
    this.showNewRobotModal.set(false)
    this.poolName.set('')
    this.processingNewRobot.set(false)
  }

  async createNewRobot() {
    try {
      this.processingNewRobot.set(true)
      const api = this.apisService.getPuppeteerRobotApi()
      const poolNameValue = this.poolName().trim()
      const r = await api.robotControllerCreate({pool: poolNameValue === "" ? "none" : poolNameValue})
      
      if (!r.ok) {
        let errorMsg = 'Could not create robot.'
        if (r.message) errorMsg += `\nReason: ${r.message}`
        if (r.errorCode) errorMsg += `\nError code: ${r.errorCode}`
        this.showToastMessage(errorMsg, 'error')
      } else {
        let successMsg = `Robot created successfully!`
        if (r.robotId) successMsg += `\nIRobot D: ${r.robotId}`
        successMsg += r.isFromPool ? `\n(Reused instance from pool ${poolNameValue}).` : '\nCreated new robot instance.'
        if (poolNameValue != "") successMsg += `\nPool: ${poolNameValue}`
        if (r.message) successMsg += `\n${r.message}`
        this.showToastMessage(successMsg, 'success')
      }

      this.closeNewRobotModal()
      await this.loadRobots()
    } catch (error) {
      console.error('Error creating new robot:', error)
    } finally {
      this.processingNewRobot.set(false)
    }
  }

  openCommandModal(info: RobotInfo) {
    this.selectedRobotId.set(info.robotId)
    this.commandText.set('')
    this.showCommandModal.set(true)
  }

  closeCommandModal() {
    this.showCommandModal.set(false)
    this.selectedRobotId.set('')
    this.commandText.set('')
    this.processingCommand.set(false)
  }

  onCommandExampleChange(event: Event) {
    const select = event.target as HTMLSelectElement
    const selectedIndex = parseInt(select.value)
    if (selectedIndex >= 0 && selectedIndex < this.commandExamples.length) {
      this.commandText.set(this.commandExamples[selectedIndex].command)
    }
  }

  openQueryIaModal(info: RobotInfo) {
    this.selectedRobotId.set(info.robotId)
    this.queryIaText.set('')
    this.showQueryIaModal.set(true)
  }

  closeQueryIaModal() {
    this.showQueryIaModal.set(false)
    this.selectedRobotId.set('')
    this.queryIaText.set('')
    // Keep the selected model, don't reset it
    this.processingQueryIa.set(false)
  }

  closeQueryIaResponseModal() {
    this.showQueryIaResponseModal.set(false)
    this.queryIaResponse.set('')
    this.queryIaHtml.set('')
    this.activeResponseTab.set('response')
  }

  setActiveResponseTab(tab: 'response' | 'html') {
    this.activeResponseTab.set(tab)
  }

  async executeCommand() {
    if (this.commandText().trim() && this.selectedRobotId()) {
      const robotId = this.selectedRobotId()
      const command = this.commandText()
      
      try {
        this.processingCommand.set(true)
        const resp = await this.sendCommand(robotId, command)
        
        if (resp) {
          if (resp.status === "OK") {
            const data = JSON.stringify(resp, null, 2)
            this.commandResponseText.set(data)
            this.showCommandResponseModal.set(true)
          } else {
            // Show error message
            // alert(`Command failed: ${resp.message || 'Unknown error'}`)
            const data = JSON.stringify(resp, null, 2)
            this.commandResponseText.set(data)
            this.showCommandResponseModal.set(true)
          }
        }
        
        this.closeCommandModal()
      } catch (error) {
        this.processingCommand.set(false)
        console.error('Error in executeCommand:', error)
      }
    }
  }
  //await page.goto("http://n8n.io");

  closeScreenshotModal() {
    this.showScreenshotModal.set(false)
    this.screenshotData.set('')
  }

  getScreenshotFilename(): string {
    return `robot-screenshot-${new Date().getTime()}.png`
  }

  async sendCommand(robotId: string, command: string) {
      try {
        const api = this.apisService.getPuppeteerRobotApi()
        const resp = await api.robotControllerRun({robotCommandReq: {robotId: robotId, command}})
        
        // Log the response for debugging
        if (resp.status === "OK") {
          console.log('Command executed successfully:', resp.message || 'Success', resp.data)
        } else {
          console.error('Command failed:', resp.message || 'Unknown error')
        }
        
        return resp
      } catch (error) {
        console.error('Error sending command:', error)
        alert('Error sending command. Please try again.')
        return null
      }
  }

  async executeQueryIa() {
    if (this.queryIaText().trim() && this.selectedRobotId()) {
      const robotId = this.selectedRobotId()
      const query = this.queryIaText()
      
      try {
        this.processingQueryIa.set(true)
        // Find the robot info
        const robot = this.recs().find(r => r.robotId === robotId)
        if (robot) {
          await this.queryIa(robot, query)
        }
        this.closeQueryIaModal()
      } catch (error) {
        this.processingQueryIa.set(false)
        console.error('Error in executeQueryIa:', error)
      }
    }
  }

  closeCommandResponseModal() {
    this.showCommandResponseModal.set(false)
    this.commandResponseText.set('')
  }

  formatDate(date: Date): string {
    if (!date) return '-'
    const d = new Date(date)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  formatTime(date: Date): string {
    if (!date) return '-'
    const d = new Date(date)
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      console.log('Copied to clipboard:', text)
      this.showToastMessage('ID copied to clipboard!', 'success')
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      this.showToastMessage('Error copying ID', 'error')
    }
  }

  showToastMessage(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set(message)
    this.toastType.set(type)
    this.showToast.set(true)
    setTimeout(() => {
      this.showToast.set(false)
    }, 5000)
  }

}
