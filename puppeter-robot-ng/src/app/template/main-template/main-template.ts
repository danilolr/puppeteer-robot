import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { WsService } from '../../service/ws.service';

@Component({
  selector: 'app-main-template',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-template.html',
  styleUrl: './main-template.css'
})
export class MainTemplate {
  // Using modern Angular signal for reactive state
  isSidebarCollapsed = signal(false)

  constructor(public readonly wsService: WsService) {}

  // Navigation menu items using signal
  menuItems = signal([
    { label: 'Robots', path: '', icon: '🤖' },
    { label: 'Command', path: 'command', icon: '⚙️' },
    { label: 'About', path: 'about', icon: 'ℹ️' }
  ])

  toggleSidebar() {
    this.isSidebarCollapsed.update(collapsed => !collapsed);
  }
}
