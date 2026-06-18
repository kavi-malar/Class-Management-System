import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

const ALL_SLOTS = [
  {n:1,s:'09:00',e:'09:45'},{n:2,s:'09:45',e:'10:30'},{n:3,s:'10:45',e:'11:30'},
  {n:4,s:'11:30',e:'12:15'},{n:5,s:'13:00',e:'13:45'},{n:6,s:'13:45',e:'14:30'},
  {n:7,s:'14:30',e:'15:15'},{n:8,s:'15:15',e:'16:00'}
];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

@Component({
  selector: 'app-admin-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
        <h1><i class="fas fa-calendar-alt"></i> Timetable Overview</h1>
        <p>Read-only view across all classes. Use the filter to focus on one class.</p>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar card">
        <label><i class="fas fa-filter"></i> Filter by Class</label>
        <div class="filter-row">
          <select class="form-control" [(ngModel)]="filterClass" (change)="load()">
            <option value="">All Classes</option>
            <option *ngFor="let c of classList" [value]="c">{{ c }}</option>
          </select>
        </div>
      </div>

      <!-- Today's changes banner -->
      <div class="changes-banner" *ngIf="todayChanges.length > 0">
        <div class="cb-title"><i class="fas fa-exclamation-triangle"></i> Today's Changes ({{ todayChanges.length }})</div>
        <div class="cb-list">
          <div *ngFor="let c of todayChanges" class="cb-item"
               [class.cb-cancelled]="c.status === 'cancelled'" [class.cb-available]="c.status === 'available'">
            <strong>{{ c.className }}</strong> — P{{ c.periodNumber }} {{ c.subject?.name }}
            <span class="cb-status">{{ c.status === 'cancelled' ? '❌ CANCELLED' : '✅ RESTORED' }}</span>
            <span class="cb-teacher">({{ c.teacher?.name }})</span>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="loading-center"><div class="spinner"></div></div>

      <!-- Per-class timetable tables -->
      <div *ngIf="!loading">
        <div *ngFor="let cls of classKeys" class="class-section">
          <div class="class-header">
            <h2><i class="fas fa-layer-group"></i> {{ cls }}</h2>
            <span class="badge-info-sm">{{ countEntries(cls) }} periods assigned</span>
          </div>

          <div *ngFor="let day of days" class="card day-card">
            <div class="day-hdr">
              <span class="day-name">{{ day }}</span>
              <span class="day-count">{{ getDayEntries(cls, day).length }} / 8 periods</span>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr><th>#</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Status</th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let slot of allSlots"
                      [class.row-assigned]="getEntry(cls, day, slot.n)"
                      [class.row-free]="!getEntry(cls, day, slot.n)">
                    <td><span class="p-badge" [class.p-free]="!getEntry(cls, day, slot.n)">P{{slot.n}}</span></td>
                    <td class="time-cell">{{slot.s}} – {{slot.e}}</td>
                    <ng-container *ngIf="getEntry(cls, day, slot.n) as e">
                      <td><strong>{{e.subject?.name}}</strong> <span class="code">{{e.subject?.code}}</span></td>
                      <td>{{e.teacher?.name}}</td>
                      <td>
                        <span class="room-pill" [class.room-tbd]="!e.classroomNo || e.classroomNo==='TBD'">
                          <i class="fas fa-map-marker-alt"></i> {{e.classroomNo || 'TBD'}}
                        </span>
                      </td>
                      <td><span class="badge-ok">Scheduled</span></td>
                    </ng-container>
                    <ng-container *ngIf="!getEntry(cls, day, slot.n)">
                      <td colspan="4" class="free-cell"><i class="fas fa-coffee"></i> Free</td>
                    </ng-container>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div *ngIf="classKeys.length === 0" class="empty-state">
          <i class="fas fa-calendar-times"></i>
          <p>No timetable data found{{ filterClass ? ' for ' + filterClass : '' }}.</p>
        </div>
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
    .page-header{margin-bottom:1.5rem;}
    .page-header h1{font-size:1.5rem;font-weight:800;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;}
    .card{background:#fff;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;}
    .filter-bar{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;}
    .filter-bar label{font-size:0.85rem;font-weight:600;color:#475569;display:flex;align-items:center;gap:0.35rem;}
    .filter-row{display:flex;gap:0.5rem;}
    .form-control{border:1.5px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none;font-family:inherit;}
    .form-control:focus{border-color:#4f46e5;}
    .changes-banner{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;}
    .cb-title{font-size:0.85rem;font-weight:700;color:#92400e;margin-bottom:0.5rem;}
    .cb-list{display:flex;flex-direction:column;gap:0.3rem;}
    .cb-item{font-size:0.82rem;color:#1e293b;padding:0.3rem 0.5rem;border-radius:5px;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;}
    .cb-cancelled{background:#fee2e2;}.cb-available{background:#d1fae5;}
    .cb-status{font-weight:700;font-size:0.78rem;}.cb-teacher{color:#64748b;font-size:0.75rem;}
    .class-section{margin-bottom:2rem;}
    .class-header{display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;padding-bottom:0.5rem;border-bottom:2px solid #e2e8f0;}
    .class-header h2{font-size:1.2rem;font-weight:800;color:#4f46e5;display:flex;align-items:center;gap:0.5rem;margin:0;}
    .badge-info-sm{background:#dbeafe;color:#1d4ed8;padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:600;}
    .day-card{margin-bottom:0.75rem;padding:0;overflow:hidden;}
    .day-hdr{display:flex;align-items:center;justify-content:space-between;padding:0.6rem 1rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
    .day-name{font-weight:700;color:#1e293b;font-size:0.9rem;}
    .day-count{font-size:0.75rem;color:#64748b;}
    table{width:100%;border-collapse:collapse;font-size:0.85rem;}
    thead th{padding:0.5rem 0.85rem;text-align:left;font-weight:600;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
    tbody td{padding:0.6rem 0.85rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
    tbody tr:last-child td{border-bottom:none;}
    tr.row-assigned{background:#fff;}tr.row-assigned:hover{background:#f8fafc;}
    tr.row-free{background:#fafafa;opacity:0.75;}
    .p-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;font-size:0.72rem;font-weight:800;color:#fff;background:#4f46e5;}
    .p-free{background:#9ca3af;}
    .time-cell{font-size:0.78rem;color:#64748b;white-space:nowrap;}
    .code{background:#f1f5f9;color:#64748b;padding:0.1rem 0.35rem;border-radius:4px;font-size:0.7rem;margin-left:0.35rem;}
    .room-pill{display:inline-flex;align-items:center;gap:0.25rem;background:#ede9fe;color:#5b21b6;padding:0.15rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;}
    .room-pill.room-tbd{background:#f3f4f6;color:#9ca3af;}
    .badge-ok{background:#d1fae5;color:#065f46;padding:0.15rem 0.5rem;border-radius:6px;font-size:0.72rem;font-weight:600;}
    .free-cell{color:#9ca3af;font-size:0.82rem;}
    .loading-center{display:flex;justify-content:center;padding:4rem;}
    .spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty-state{text-align:center;padding:4rem 2rem;color:#9ca3af;}
    .empty-state i{font-size:3rem;display:block;margin-bottom:1rem;}
  `]
})
export class AdminTimetableComponent implements OnInit {
  allSlots   = ALL_SLOTS;
  days       = DAYS;
  classList  = ['CSE-A','CSE-B','ECE-A','MECH-A'];
  filterClass = '';
  grouped: Record<string, Record<string, any[]>> = {};
  todayChanges: any[] = [];
  loading    = true;

  get classKeys(): string[] { return Object.keys(this.grouped); }

  constructor(private adminSvc: AdminService, private authSvc: AuthService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.adminSvc.getTimetableOverview(this.filterClass || undefined).subscribe({
      next: (r: any) => {
        this.grouped      = r.grouped || {};
        this.todayChanges = r.todayChanges || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  getDayEntries(cls: string, day: string): any[] { return (this.grouped[cls]?.[day] || []); }
  getEntry(cls: string, day: string, n: number): any {
    return this.getDayEntries(cls, day).find((e: any) => e.periodNumber === n) || null;
  }
  countEntries(cls: string): number {
    return Object.values(this.grouped[cls] || {}).reduce((s, arr) => s + arr.length, 0);
  }
  logout(): void { this.authSvc.logout(); }
}
