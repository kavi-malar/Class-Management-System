import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { RoomBoardComponent } from '../../shared/room-board/room-board.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, RoomBoardComponent],
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
        <div class="user-info">
          <span class="user-name">Admin</span>
          <span class="user-role">System Administrator</span>
        </div>
        <button class="btn-logout" (click)="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </nav>

    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-tachometer-alt"></i> Admin Dashboard</h1>
        <p>System-wide monitoring. You can view all data but <strong>cannot cancel</strong> timetable entries.</p>
      </div>

      <div class="stats-grid" *ngIf="stats">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-users"></i></div>
          <div class="stat-body">
            <div class="stat-num">{{ stats.totalUsers }}</div>
            <div class="stat-lbl">Total Users</div>
            <div class="stat-sub">{{ stats.teachers }} teachers · {{ stats.students }} students</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-layer-group"></i></div>
          <div class="stat-body">
            <div class="stat-num">{{ stats.totalClasses }}</div>
            <div class="stat-lbl">Active Classes</div>
            <div class="stat-sub">{{ stats.crCount }} CRs assigned</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-door-open"></i></div>
          <div class="stat-body">
            <div class="stat-num">{{ stats.freeRooms }} / {{ stats.totalRooms }}</div>
            <div class="stat-lbl">Rooms Free</div>
            <div class="stat-sub">{{ stats.occupiedRooms }} currently occupied</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><i class="fas fa-tv"></i></div>
          <div class="stat-body">
            <div class="stat-num">{{ stats.availableProjectors }} / {{ stats.totalProjectors }}</div>
            <div class="stat-lbl">Projectors Free</div>
            <div class="stat-sub">{{ stats.totalProjectors - stats.availableProjectors }} checked out</div>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <a routerLink="/admin/timetable" class="qa-card"><i class="fas fa-calendar-alt"></i><span>All Timetables</span></a>
        <a routerLink="/admin/classes"   class="qa-card"><i class="fas fa-plus-circle"></i><span>Manage Classes</span></a>
        <a routerLink="/admin/users"     class="qa-card"><i class="fas fa-user-plus"></i><span>Manage Users</span></a>
        <a routerLink="/admin/rooms"     class="qa-card"><i class="fas fa-building"></i><span>Room Board</span></a>
      </div>

      <div class="card mt-2">
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
    .user-avatar{width:34px;height:34px;border-radius:50%;background:#f59e0b;color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;}
    .user-info{display:flex;flex-direction:column;}
    .user-name{font-size:0.82rem;font-weight:600;}
    .user-role{font-size:0.7rem;color:#94a3b8;}
    .btn-logout{background:rgba(255,255,255,.08);border:none;color:#94a3b8;cursor:pointer;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.82rem;display:flex;align-items:center;gap:0.35rem;transition:all .2s;}
    .btn-logout:hover{background:rgba(255,255,255,.15);color:#fff;}
    .page-container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem;}
    .page-header{margin-bottom:1.5rem;}
    .page-header h1{font-size:1.6rem;font-weight:800;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.4rem;}
    .mt-2{margin-top:1.5rem;}
    .card{background:#fff;border-radius:12px;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem;margin-bottom:1.5rem;}
    .stat-card{background:#fff;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;display:flex;align-items:flex-start;gap:1rem;}
    .stat-icon{width:48px;height:48px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;}
    .blue{background:#dbeafe;color:#1d4ed8;}.purple{background:#ede9fe;color:#5b21b6;}.green{background:#d1fae5;color:#065f46;}.orange{background:#fef3c7;color:#92400e;}
    .stat-num{font-size:1.6rem;font-weight:800;line-height:1;}
    .stat-lbl{font-size:0.82rem;font-weight:600;color:#475569;margin-top:0.2rem;}
    .stat-sub{font-size:0.72rem;color:#94a3b8;margin-top:0.15rem;}
    .quick-actions{display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.5rem;}
    .qa-card{display:flex;align-items:center;gap:0.6rem;padding:0.65rem 1.1rem;background:#fff;border:1px solid #e2e8f0;border-radius:10px;text-decoration:none;color:#1e293b;font-size:0.875rem;font-weight:600;transition:all .2s;}
    .qa-card i{color:#4f46e5;}
    .qa-card:hover{background:#4f46e5;color:#fff;border-color:#4f46e5;}
    .qa-card:hover i{color:#c7d2fe;}
  `]
})
export class AdminDashboardComponent implements OnInit {
  stats: any = null;
  classList = ['CSE-A','CSE-B','ECE-A','MECH-A'];
  constructor(private adminSvc: AdminService, private authSvc: AuthService) {}
  ngOnInit(): void { this.adminSvc.getDashboard().subscribe({ next: (r: any) => { this.stats = r.stats; } }); }
  logout(): void { this.authSvc.logout(); }
}
