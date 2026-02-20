import { Component, signal } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { HttpClient, HttpClientModule } from '@angular/common/http'

@Component({
  selector: 'app-send-command-page',
  imports: [FormsModule, HttpClientModule],
  templateUrl: './send-command-page.html',
  styleUrl: './send-command-page.css'
})
export class SendCommandPage {

  url = signal('')
  command = signal('')
  isLoading = signal(false)
  showResponseModal = signal(false)
  responseData = signal('')

  constructor(private http: HttpClient) {}

  async sendCommand() {
    if (!this.url().trim() || !this.command().trim()) {
      alert('Please fill both URL and Command fields')
      return
    }

    try {
      this.isLoading.set(true)
      
      // Parse the command as JSON
      let jsonCommand
      try {
        jsonCommand = JSON.parse(this.command())
      } catch (error) {
        alert('Invalid JSON format in Command field')
        return
      }

      // Send POST request
      const response = await this.http.post(this.url(), jsonCommand).toPromise()
      
      this.responseData.set(JSON.stringify(response, null, 2))
      this.showResponseModal.set(true)
      
    } catch (error) {
      console.error('Error sending command:', error)
      alert('Error sending command: ' + (error as any)?.message || 'Unknown error')
    } finally {
      this.isLoading.set(false)
    }
  }

  closeResponseModal() {
    this.showResponseModal.set(false)
    this.responseData.set('')
  }

}
