import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TimetableService } from '../../../services/timetable.service';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

const ALL_SLOTS = [
  { number: 1, start: '09:00', end: '09:45' },
  { number: 2, start: '09:45', end: '10:30' },
  { number: 3, start: '10:45', end: '11:30' },
  { number: 4, start: '11:30', end: '12:15' },
  { number: 5, start: '13:00', end: '13:45' },
  { number: 6, start: '13:45', end: '14:30' },
  { number: 7, start: '14:30', end: '15:15' },
  { number: 8, start: '15:15', end: '16:00' },
];

@Component({
  selector: 'app-cr-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <!-- Navbar (inline — CR has its own nav) -->
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-chalkboard-teacher"></i> ClassMS</div>
      <div class="nav-links">
        <a routerLink="/cr/dashboard" routerLinkActive="active"><i class="fas fa-home"></i> Dashboard</a>
        <a routerLink="/cr/timetable" routerLinkActive="active"><i class="fas fa-calendar-alt"></i> Timetable</a>
        <a routerLink="/cr/rooms" routerLinkActive="active"><i class="fas fa-building"></i> Rooms</a>
        <a routerLink="/cr/poll" routerLinkActive="active"><i class="fas fa-poll"></i> Launch Poll</a>
        <a routerLink="/cr/polls" routerLinkActive="active"><i class="fas fa-list"></i> My Polls</a>
      </div>
      <div class="nav-user">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-info">
          <span class="user-name">{{ user?.name }}</span>
          <span class="user-role">Class Representative</span>
        </div>
        <button class="btn-logout" (click)="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </nav>

    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-calendar-alt"></i> Class Timetable</h1>
        <p>
          As CR, you can view and update <strong>classroom numbers</strong> for any period.
          Changes instantly notify all students via SMS.
        </p>
      </div>

      <!-- Info banner -->
      <div class="info-banner">
        <i class="fas fa-info-circle"></i>
        Click the <strong><i class="fas fa-pen"></i></strong> icon next to any Room to update it.
        Students will receive an SMS notification automatically.
      </div>

      <!-- Toast -->
      <div class="toast toast-success" *ngIf="toast === 'success'">
        <i class="fas fa-check-circle"></i> Room updated! Students notified via SMS.
      </div>
      <div class="toast toast-error" *ngIf="toast === 'error'">
        <i class="fas fa-times-circle"></i> {{ toastMsg }}
      </div>

      <div *ngIf="loading" class="loading-center"><div class="spinner"></div></div>

      <div *ngIf="!loading">
        <div *ngFor="let day of days" class="card day-card">
          <div class="day-header">
            <h3>{{ day }}</h3>
            <span class="badge badge-info">{{ getAssigned(day) }} of 8 periods assigned</span>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style="width:52px">#</th>
                  <th style="width:130px">Time</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th style="width:200px"><i class="fas fa-door-open"></i> Classroom No.</th>
                  <th style="width:80px">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let slot of allSlots"
                    [class.row-assigned]="!!getEntry(day, slot.number)"
                    [class.row-free]="!getEntry(day, slot.number)">

                  <td>
                    <span class="p-badge" [class.p-free]="!getEntry(day, slot.number)">
                      P{{ slot.number }}
                    </span>
                  </td>

                  <td class="time-cell">{{ slot.start }} – {{ slot.end }}</td>

                  <td>
                    <ng-container *ngIf="getEntry(day, slot.number) as e">
                      <strong>{{ e.subject?.name }}</strong>
                      <span class="code-badge">{{ e.subject?.code }}</span>
                    </ng-container>
                    <span *ngIf="!getEntry(day, slot.number)" class="free-text">
                      <i class="fas fa-coffee"></i> Free Period
                    </span>
                  </td>

                  <td>
                    <span *ngIf="getEntry(day, slot.number)">{{ getEntry(day, slot.number)?.teacher?.name }}</span>
                    <span *ngIf="!getEntry(day, slot.number)" class="free-text">—</span>
                  </td>

                  <!-- Classroom No column — CR can edit any -->
                  <td>
                    <ng-container *ngIf="getEntry(day, slot.number) as e">
                      <div class="room-edit" *ngIf="editingId !== e._id">
                        <span class="room-badge" [class.room-tbd]="!e.classroomNo || e.classroomNo === 'TBD'">
                          <i class="fas fa-map-marker-alt"></i> {{ e.classroomNo || 'TBD' }}
                        </span>
                        <button class="btn-edit-room" (click)="startEdit(e)" title="Edit classroom">
                          <i class="fas fa-pen"></i>
                        </button>
                      </div>
                      <div class="room-edit-form" *ngIf="editingId === e._id">
                        <input class="room-input" [(ngModel)]="editRoomVal"
                               placeholder="e.g. Room-101" (keyup.enter)="saveRoom(e._id)" autofocus />
                        <button class="btn-save-room" (click)="saveRoom(e._id)" [disabled]="saving">
                          <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-cancel-room" (click)="cancelEdit()">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </ng-container>
                    <span *ngIf="!getEntry(day, slot.number)" class="free-text">—</span>
                  </td>

                  <td>
                    <span *ngIf="getEntry(day, slot.number)" class="badge badge-success">Active</span>
                    <span *ngIf="!getEntry(day, slot.number)" class="badge badge-free">Free</span>
                  </td>

                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    /* Navbar (copy of cr-dashboard style) */
    .navbar { display: flex; align-items: center; gap: 1.5rem; padding: 0 2rem;
              height: 60px; background: #1e293b; color: #fff; position: sticky; top: 0; z-index: 100; }
    .nav-brand { font-size: 1.1rem; font-weight: 700; display: flex; align-items: center; gap: 0.5rem; }
    .nav-links { display: flex; gap: 0.25rem; margin-left: auto; }
    .nav-links a { color: #94a3b8; text-decoration: none; padding: 0.4rem 0.8rem;
                   border-radius: 6px; font-size: 0.85rem; display: flex; align-items: center; gap: 0.4rem;
                   transition: all .2s; }
    .nav-links a.active, .nav-links a:hover { color: #fff; background: rgba(255,255,255,.1); }
    .nav-user { display: flex; align-items: center; gap: 0.75rem; margin-left: 1rem; }
    .user-avatar { width: 34px; height: 34px; border-radius: 50%; background: #6366f1;
                   display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; }
    .user-info { display: flex; flex-direction: column; }
    .user-name  { font-size: 0.82rem; font-weight: 600; }
    .user-role  { font-size: 0.7rem; color: #94a3b8; }
    .btn-logout { background: rgba(255,255,255,.08); border: none; color: #94a3b8; cursor: pointer;
                  padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.82rem;
                  display: flex; align-items: center; gap: 0.35rem; transition: all .2s; }
    .btn-logout:hover { background: rgba(255,255,255,.15); color: #fff; }

    .page-container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }

    .info-banner { background: #eff6ff; border: 1px solid #93c5fd; color: #1d4ed8;
                   padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem;
                   display: flex; align-items: center; gap: 0.6rem; font-size: 0.875rem; }

    /* Toast */
    .toast { position: fixed; top: 1.2rem; right: 1.5rem; z-index: 999;
             padding: 0.75rem 1.25rem; border-radius: 8px;
             display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;
             box-shadow: 0 4px 12px rgba(0,0,0,.15); animation: fadeIn .2s ease; }
    .toast-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .toast-error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    @keyframes fadeIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: none; } }

    .day-card { margin-bottom: 1.4rem; padding: 0; overflow: hidden; border-radius: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .day-header { display: flex; align-items: center; justify-content: space-between;
                  padding: 0.85rem 1.25rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .day-header h3 { font-size: 1rem; font-weight: 700; color: #4f46e5; margin: 0; }

    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    thead th { padding: 0.6rem 1rem; text-align: left; font-weight: 600; font-size: 0.72rem;
               text-transform: uppercase; letter-spacing: 0.04em; color: #64748b;
               background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }

    tr.row-assigned { background: #fff; }
    tr.row-assigned:hover { background: #f8fafc; }
    tr.row-free { background: #fafafa; opacity: 0.7; }

    .p-badge { display: inline-flex; align-items: center; justify-content: center;
               width: 32px; height: 32px; border-radius: 8px;
               font-size: 0.75rem; font-weight: 800; color: #fff; background: #4f46e5; }
    .p-free  { background: #9ca3af; }
    .time-cell { font-size: 0.82rem; color: #64748b; white-space: nowrap; }
    .code-badge { background: #f1f5f9; color: #64748b;
                  padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.72rem; margin-left: 0.4rem; }
    .free-text { color: #9ca3af; font-size: 0.83rem; }
    .badge-free { background: #f3f4f6; color: #6b7280; font-size: 0.72rem; padding: 0.18rem 0.5rem; }

    /* Room */
    .room-badge { display: inline-flex; align-items: center; gap: 0.3rem;
                  background: #ede9fe; color: #5b21b6;
                  padding: 0.22rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
    .room-badge.room-tbd { background: #f3f4f6; color: #9ca3af; }
    .room-edit { display: flex; align-items: center; gap: 0.35rem; }
    .btn-edit-room { background: none; border: none; color: #7c3aed; cursor: pointer;
                     font-size: 0.8rem; padding: 0.15rem 0.3rem; border-radius: 4px; transition: background .15s; }
    .btn-edit-room:hover { background: #ede9fe; }
    .room-edit-form { display: flex; align-items: center; gap: 0.25rem; }
    .room-input { border: 1.5px solid #7c3aed; border-radius: 6px; padding: 0.25rem 0.5rem;
                  font-size: 0.82rem; width: 100px; outline: none; font-family: inherit; }
    .btn-save-room { background: #7c3aed; color: #fff; border: none; border-radius: 5px;
                     padding: 0.28rem 0.5rem; cursor: pointer; font-size: 0.78rem; }
    .btn-save-room:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-cancel-room { background: #f3f4f6; color: #6b7280; border: none; border-radius: 5px;
                       padding: 0.28rem 0.5rem; cursor: pointer; font-size: 0.78rem; }

    .loading-center { display: flex; justify-content: center; padding: 3rem; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0;
               border-top-color: #4f46e5; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CrTimetableComponent implements OnInit {
  days     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  allSlots = ALL_SLOTS;
  grouped: Record<string, any[]> = {};
  loading = true;

  user: any = null;
  get initials(): string {
    return (this.user?.name || 'CR').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  editingId   = '';
  editRoomVal = '';
  saving      = false;
  toast: 'success' | 'error' | '' = '';
  toastMsg    = '';

  constructor(
    private timetableService: TimetableService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.user = JSON.parse(localStorage.getItem('user') || '{}');
    this.loadTimetable();
  }

  loadTimetable(): void {
    // CR always sees their own class timetable (backend scopes by user.className automatically)
    this.timetableService.getFixedTimetable(this.user?.className).subscribe({
      next: (res: any) => { this.grouped = res.timetable || {}; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getEntry(day: string, num: number): any {
    return (this.grouped[day] || []).find((e: any) => e.periodNumber === num) || null;
  }

  getAssigned(day: string): number { return (this.grouped[day] || []).length; }

  startEdit(entry: any): void {
    this.editingId   = entry._id;
    this.editRoomVal = entry.classroomNo === 'TBD' ? '' : (entry.classroomNo || '');
  }
  cancelEdit(): void { this.editingId = ''; this.editRoomVal = ''; }

  saveRoom(entryId: string): void {
    if (!this.editRoomVal.trim()) return;
    this.saving = true;
    this.timetableService.updateClassroomNo(entryId, this.editRoomVal.trim()).subscribe({
      next: () => {
        this.saving = false;
        this.editingId = '';
        this.showToast('success', '');
        this.loadTimetable();
      },
      error: (err: any) => {
        this.saving = false;
        this.showToast('error', err?.error?.message || 'Failed to update classroom');
      }
    });
  }

  showToast(type: 'success' | 'error', msg: string): void {
    this.toast    = type;
    this.toastMsg = msg;
    setTimeout(() => { this.toast = ''; }, 3500);
  }

  logout(): void { this.authService.logout(); }
}
