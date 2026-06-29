import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { RoomBoardComponent } from './room-board.component';

@Component({
  selector: 'app-room-board-page',
  standalone: true,
  imports: [CommonModule, NavbarComponent, RoomBoardComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-building"></i> Room Allocation Board</h1>
        <p>Live classroom status. Teachers and CR can mark rooms occupied/free and manage projectors.</p>
      </div>
      <div class="card">
        <app-room-board [classList]="classList"></app-room-board>
      </div>
    </main>
  `,
  styles: [`
    .page-container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem;}
    .page-header{margin-bottom:1.5rem;}
    .page-header h1{font-size:1.5rem;font-weight:800;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;}
    .card{background:#fff;border-radius:12px;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;}
  `]
})
export class RoomBoardPageComponent {
  classList = ['CSE-A','CSE-B','ECE-A','MECH-A'];
}
