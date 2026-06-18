import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { RoomBoardComponent } from '../../shared/room-board/room-board.component';

@Component({
  selector: 'app-admin-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, RoomBoardComponent],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-shield-alt"></i> ClassMS Admin</div>
      <div class="nav-links">
        <a routerLink="/admin/dashboard" routerLinkActive="active"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
        <a routerLink="/admin/rooms"     routerLinkActive="active"><i class="fas fa-building"></i> Rooms</a>
        <a routerLink="/admin/timetable" routerLinkActive="active"><i class="fas fa-calendar-alt"></i> Timetable</a>
        <a routerLink="/admin/classes"   routerLinkActive="active"><i class="fas fa-layer-group"></i> Classes</a>
        <a routerLink="/admin/users"     routerLinkActive="active"><i class="fas fa-users"></i> Users</a>
      </div>
      <div class="nav-user">
        <div class="user-avatar">A</div>
        <button class="btn-logout" (click)="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </nav>
    <main class="page-container">
      <div class="page-header">
        <div>
          <h1><i class="fas fa-building"></i> Room Allocation Board</h1>
          <p>Live view of all classrooms (101–130). Admin view is <strong>read-only</strong>.</p>
        </div>
        <!-- Projector total update -->
        <div class="proj-admin-box">
          <label><i class="fas fa-tv"></i> Total Projectors</label>
          <div class="proj-row">
            <input type="number" class="form-control proj-input" [(ngModel)]="newTotal" min="1" max="50" />
            <button class="btn btn-primary" (click)="updateProjectors()" [disabled]="savingProj">
              {{ savingProj ? 'Saving…' : 'Update' }}
            </button>
          </div>
          <small *ngIf="projMsg" [class.ok]="projOk" [class.err]="!projOk">{{ projMsg }}</small>
        </div>
      </div>
      <div class="card">
        <app-room-board [classList]="classList"></app-room-board>
      </div>
    </main>
  `,
  styles: [`
    .navbar{display:flex;align-items:center;gap:1.5rem;padding:0 2rem;height:60px;background:#0f172a;color:#fff;position:sticky;top:0;z-index:100;}
    .nav-brand{font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:0.5rem;color:#f59e0b;}
    .nav-links{display:flex;gap:0.25rem;margin-left:auto;}
    .nav-links a{color:#94a3b8;text-decoration:none;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;transition:all .2s;}
    .nav-links a.active,.nav-links a:hover{color:#fff;background:rgba(255,255,255,.1);}
    .nav-user{display:flex;align-items:center;gap:0.75rem;margin-left:1rem;}
    .user-avatar{width:34px;height:34px;border-radius:50%;background:#f59e0b;color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;}
    .btn-logout{background:rgba(255,255,255,.08);border:none;color:#94a3b8;cursor:pointer;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.82rem;display:flex;align-items:center;gap:0.35rem;transition:all .2s;}
    .btn-logout:hover{background:rgba(255,255,255,.15);color:#fff;}
    .page-container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem;}
    .page-header{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1.5rem;margin-bottom:1.5rem;}
    .page-header h1{font-size:1.5rem;font-weight:800;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;}
    .card{background:#fff;border-radius:12px;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;}
    .proj-admin-box{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:1rem 1.25rem;min-width:220px;}
    .proj-admin-box label{font-size:0.82rem;font-weight:600;color:#475569;display:flex;align-items:center;gap:0.35rem;margin-bottom:0.5rem;}
    .proj-row{display:flex;gap:0.5rem;}
    .proj-input{width:80px;}
    small.ok{color:#065f46;font-size:0.75rem;}
    small.err{color:#991b1b;font-size:0.75rem;}
    .form-control{border:1.5px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none;font-family:inherit;}
    .form-control:focus{border-color:#4f46e5;}
    .btn{padding:0.5rem 1rem;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.4rem;}
    .btn-primary{background:#4f46e5;color:#fff;}
    .btn-primary:hover{background:#4338ca;}
    .btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
  `]
})
export class AdminRoomsComponent implements OnInit {
  classList = ['CSE-A','CSE-B','ECE-A','MECH-A'];
  newTotal  = 10;
  savingProj = false;
  projMsg    = '';
  projOk     = false;
  constructor(private adminSvc: AdminService, private authSvc: AuthService) {}
  ngOnInit(): void {
    this.adminSvc.getDashboard().subscribe({ next: (r: any) => { this.newTotal = r.stats?.totalProjectors || 10; } });
  }
  updateProjectors(): void {
    this.savingProj = true; this.projMsg = '';
    this.adminSvc.updateProjectorCount(this.newTotal).subscribe({
      next: () => { this.savingProj = false; this.projOk = true; this.projMsg = 'Updated successfully!'; setTimeout(() => this.projMsg = '', 3000); },
      error: (e: any) => { this.savingProj = false; this.projOk = false; this.projMsg = e?.error?.message || 'Failed'; }
    });
  }
  logout(): void { this.authSvc.logout(); }
}
