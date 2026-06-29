import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';
import { RoomService } from '../../../services/room.service';

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
  selector: 'app-teacher-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent, RouterModule],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <div class="page-header">
        <h1><i class="fas fa-calendar-alt"></i> Weekly Timetable</h1>
        <p>
          Full 8-period schedule. Your assigned periods are highlighted.
          You can update the <strong>classroom number</strong> for your own periods.
        </p>
      </div>

      <!-- Class selector banner -->
      <div class="class-banner" *ngIf="activeClassName">
        <i class="fas fa-users"></i>
        Viewing timetable for: <strong>{{ activeClassName }}</strong>
        <a routerLink="/teacher/timetable" class="switch-link" *ngIf="allTeacherClasses.length > 1">
          <i class="fas fa-exchange-alt"></i> Switch class
        </a>
      </div>

      <!-- ── Feature 3: Today's cancellations inline banner ── -->
      <div class="cancel-banner" *ngIf="todayCancellations.length > 0">
        <div class="cancel-banner-title">
          <i class="fas fa-ban"></i> Cancelled Today ({{ todayDayName }})
        </div>
        <div class="cancel-chips">
          <span class="cancel-chip" *ngFor="let c of todayCancellations">
            🔴 P{{ c.periodNumber }} {{ c.subject?.name }} — cancelled by {{ c.teacher?.name }}
            <span *ngIf="c.classroomNo && c.classroomNo !== 'TBD'"> · Room {{ c.classroomNo }}</span>
          </span>
        </div>
      </div>

      <!-- Legend -->
      <div class="legend card">
        <div class="legend-item"><span class="dot dot-purple"></span> Your assigned period</div>
        <div class="legend-item"><span class="dot dot-blue"></span> Other teacher's period</div>
        <div class="legend-item"><span class="dot dot-grey"></span> Free period (no class)</div>
        <div class="legend-item"><span class="dot dot-red"></span> Cancelled today</div>
      </div>

      <!-- Success/Error toast -->
      <div class="toast toast-success" *ngIf="toast === 'success'">
        <i class="fas fa-check-circle"></i> Classroom updated! Students notified via SMS.
      </div>
      <div class="toast toast-error" *ngIf="toast === 'error'">
        <i class="fas fa-times-circle"></i> {{ toastMsg }}
      </div>

      <div *ngIf="loading" class="loading-center">
        <div class="spinner"></div><p>Loading timetable…</p>
      </div>

      <div *ngIf="!loading">
        <div *ngFor="let day of days" class="card day-card">

          <div class="day-header">
            <h3>{{ day }}</h3>
            <div class="day-stats">
              <span class="badge badge-primary">{{ myCount(day) }} yours</span>
              <span class="badge badge-info">{{ assignedCount(day) }} of 8 filled</span>
            </div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style="width:52px">#</th>
                  <th style="width:130px">Time</th>
                  <th>Subject</th>
                  <th>Teacher</th>
                  <th style="width:160px"><i class="fas fa-door-open"></i> Room</th>
                  <th style="width:90px">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let slot of allSlots"
                    [class.row-mine]="isMine(day, slot.number)"
                    [class.row-other]="isOther(day, slot.number)"
                    [class.row-free]="isFree(day, slot.number)">

                  <td>
                    <span class="p-badge"
                          [class.p-mine]="isMine(day, slot.number)"
                          [class.p-other]="isOther(day, slot.number)"
                          [class.p-free]="isFree(day, slot.number)">
                      P{{ slot.number }}
                    </span>
                  </td>

                  <td class="time-cell">{{ slot.start }} – {{ slot.end }}</td>

                  <td>
                    <ng-container *ngIf="getEntry(day, slot.number) as e">
                      <strong>{{ e.subject?.name }}</strong>
                      <span class="code-badge">{{ e.subject?.code }}</span>
                    </ng-container>
                    <span *ngIf="isFree(day, slot.number)" class="free-text">
                      <i class="fas fa-coffee"></i> Free Period
                    </span>
                  </td>

                  <td>
                    <ng-container *ngIf="getEntry(day, slot.number) as e">
                      {{ e.teacher?.name }}
                      <span *ngIf="isMine(day, slot.number)" class="badge badge-primary you-tag">You</span>
                    </ng-container>
                    <span *ngIf="isFree(day, slot.number)" class="free-text">—</span>
                  </td>

                  <!-- ── Classroom column ── -->
                  <td>
                    <ng-container *ngIf="isMine(day, slot.number) && getEntry(day, slot.number) as e">
                      <!-- Inline edit for teacher's own periods -->
                      <div class="room-edit" *ngIf="editingId !== e._id">
                        <span class="room-badge" [class.room-tbd]="!e.classroomNo || e.classroomNo === 'TBD'">
                          <i class="fas fa-map-marker-alt"></i> {{ e.classroomNo || 'TBD' }}
                        </span>
                        <button class="btn-edit-room" (click)="startEdit(e)" title="Edit room">
                          <i class="fas fa-pen"></i>
                        </button>
                      </div>
                      <div class="room-edit-form" *ngIf="editingId === e._id">
                        <input class="room-input" [(ngModel)]="editRoomVal"
                               placeholder="e.g. Lab-3" (keyup.enter)="saveRoom(e._id)" />
                        <button class="btn-save-room" (click)="saveRoom(e._id)" [disabled]="saving">
                          <i class="fas fa-check"></i>
                        </button>
                        <button class="btn-cancel-room" (click)="cancelEdit()">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                    </ng-container>
                    <ng-container *ngIf="isOther(day, slot.number) && getEntry(day, slot.number) as e">
                      <!-- Read-only for other teachers -->
                      <span class="room-badge" [class.room-tbd]="!e.classroomNo || e.classroomNo === 'TBD'">
                        <i class="fas fa-map-marker-alt"></i> {{ e.classroomNo || 'TBD' }}
                      </span>
                    </ng-container>
                    <span *ngIf="isFree(day, slot.number)" class="free-text">—</span>
                  </td>

                  <td>
                    <span *ngIf="isMine(day, slot.number)"  class="badge badge-primary">Assigned</span>
                    <span *ngIf="isOther(day, slot.number)" class="badge badge-info">Other</span>
                    <span *ngIf="isFree(day, slot.number)"  class="badge badge-free">Free</span>
                    <span *ngIf="isCancelledToday(day, slot.number)" class="badge badge-cancelled">CANCELLED</span>
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
    .page-container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }

    .legend { display: flex; gap: 1.5rem; align-items: center; flex-wrap: wrap;
              padding: 0.75rem 1.25rem; margin-bottom: 1.5rem; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.83rem; color: var(--text-muted); }
    .dot { width: 12px; height: 12px; border-radius: 50%; }
    .dot-purple { background: #7c3aed; }
    .dot-blue   { background: #3b82f6; }
    .dot-grey   { background: #9ca3af; }
    .dot-red    { background: #dc2626; }

    /* Cancellations banner */
    .cancel-banner { background: #fff5f5; border: 2px solid #fca5a5; border-radius: 10px;
                     padding: 0.85rem 1.1rem; margin-bottom: 1.25rem; }
    .cancel-banner-title { font-size: 0.88rem; font-weight: 700; color: #b91c1c;
                           margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem; }
    .cancel-chips { display: flex; flex-direction: column; gap: 0.35rem; }
    .cancel-chip  { font-size: 0.82rem; color: #7f1d1d; padding: 0.3rem 0;
                    border-bottom: 1px dashed #fecaca; }
    .cancel-chip:last-child { border-bottom: none; }
    .badge-cancelled { background: #dc2626; color: #fff; }

    /* Toast */
    .toast { position: fixed; top: 1.2rem; right: 1.5rem; z-index: 999;
             padding: 0.75rem 1.25rem; border-radius: var(--radius-sm);
             display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;
             box-shadow: 0 4px 12px rgba(0,0,0,.15); animation: fadeIn .2s ease; }
    .toast-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .toast-error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    @keyframes fadeIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform: none; } }

    .day-card { margin-bottom: 1.4rem; padding: 0; overflow: hidden; }
    .day-header { display: flex; align-items: center; justify-content: space-between;
                  padding: 0.85rem 1.25rem; background: #f8fafc; border-bottom: 1px solid var(--border); }
    .day-header h3 { font-size: 1rem; font-weight: 700; color: var(--primary); margin: 0; }
    .day-stats { display: flex; gap: 0.4rem; }

    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    thead th { padding: 0.6rem 1rem; text-align: left; font-weight: 600;
               font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em;
               color: var(--text-muted); background: #f8fafc; border-bottom: 1px solid var(--border); }
    tbody td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); vertical-align: middle; }
    tbody tr:last-child td { border-bottom: none; }

    tr.row-mine  { background: #ede9fe; }
    tr.row-other { background: #fff; }
    tr.row-other:hover { background: #f8fafc; }
    tr.row-free  { background: #fafafa; opacity: 0.75; }

    .p-badge { display: inline-flex; align-items: center; justify-content: center;
               width: 32px; height: 32px; border-radius: 8px;
               font-size: 0.75rem; font-weight: 800; color: #fff; }
    .p-mine  { background: #7c3aed; }
    .p-other { background: #3b82f6; }
    .p-free  { background: #9ca3af; }

    .time-cell { font-size: 0.82rem; color: var(--text-muted); white-space: nowrap; }
    .code-badge { background: var(--bg); color: var(--text-muted);
                  padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.72rem; margin-left: 0.4rem; }
    .you-tag  { margin-left: 0.4rem; font-size: 0.7rem; }
    .free-text { color: #9ca3af; font-size: 0.83rem; display: flex; align-items: center; gap: 0.35rem; }
    .badge-free { background: #f3f4f6; color: #6b7280; font-size: 0.72rem; padding: 0.18rem 0.5rem; }

    /* Room */
    .room-badge { display: inline-flex; align-items: center; gap: 0.3rem;
                  background: #ede9fe; color: #5b21b6;
                  padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; }
    .room-badge.room-tbd { background: #f3f4f6; color: #9ca3af; }
    .room-edit { display: flex; align-items: center; gap: 0.35rem; }
    .btn-edit-room { background: none; border: none; color: #7c3aed; cursor: pointer;
                     font-size: 0.8rem; padding: 0.15rem 0.3rem; border-radius: 4px;
                     transition: background .15s; }
    .btn-edit-room:hover { background: #ede9fe; }
    .room-edit-form { display: flex; align-items: center; gap: 0.25rem; }
    .room-input { border: 1.5px solid #7c3aed; border-radius: 6px; padding: 0.25rem 0.5rem;
                  font-size: 0.82rem; width: 90px; outline: none; font-family: inherit; }
    .btn-save-room { background: #7c3aed; color: #fff; border: none; border-radius: 5px;
                     padding: 0.28rem 0.5rem; cursor: pointer; font-size: 0.78rem; }
    .btn-save-room:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-cancel-room { background: #f3f4f6; color: #6b7280; border: none; border-radius: 5px;
                       padding: 0.28rem 0.5rem; cursor: pointer; font-size: 0.78rem; }

    /* Class banner */
    .class-banner { background:#ede9fe; color:#4f46e5; border:1px solid #c4b5fd;
                    border-radius:10px; padding:0.75rem 1.25rem; margin-bottom:1.25rem;
                    display:flex; align-items:center; gap:0.6rem; font-size:0.9rem; font-weight:500; }
    .switch-link  { margin-left:auto; color:#7c3aed; font-size:0.82rem; text-decoration:none;
                    display:flex; align-items:center; gap:0.35rem; font-weight:600; }
    .switch-link:hover { text-decoration:underline; }
  `]
})
export class TeacherTimetableComponent implements OnInit {
  days     = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  allSlots = ALL_SLOTS;
  grouped: Record<string, any[]> = {};
  loading = true;
  userId  = '';

  activeClassName    = '';
  allTeacherClasses: string[] = [];

  editingId   = '';
  editRoomVal = '';
  saving      = false;
  toast: 'success' | 'error' | '' = '';
  toastMsg    = '';

  // Feature 3: Today's cancellations
  todayCancellations: any[] = [];
  todayDayName = '';
  // Map: periodNumber → true (for current day only)
  private cancelledPeriods: Set<number> = new Set();

  constructor(
    private timetableService: TimetableService,
    private route: ActivatedRoute,
    private roomService: RoomService
  ) {}

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.userId = user._id;

    const today = new Date();
    this.todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' });

    // Fetch this teacher's classes so we can show the switch link if needed
    this.timetableService.getTeacherClasses().subscribe({
      next: (r: any) => { this.allTeacherClasses = r.classes || []; }
    });

    // React to ?className= query param (also handles later navigation)
    this.route.queryParamMap.subscribe(params => {
      const cn = params.get('className') || user.className || '';
      this.activeClassName = cn;
      this.loadTimetable(cn);
    });

    // Load today's cancellations for all teachers
    this.roomService.getTodayCancellations().subscribe({
      next: (res: any) => {
        this.todayCancellations = res.cancellations || [];
        this.cancelledPeriods = new Set(this.todayCancellations.map((c: any) => c.periodNumber));
      },
      error: () => {}
    });
  }

  loadTimetable(className?: string): void {
    this.loading = true;
    this.timetableService.getFixedTimetable(className || undefined).subscribe({
      next: (res: any) => { this.grouped = res.timetable || {}; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getEntry(day: string, num: number): any {
    return (this.grouped[day] || []).find((e: any) => e.periodNumber === num) || null;
  }

  isMine(day: string, num: number): boolean {
    const e = this.getEntry(day, num);
    return !!e && (e.teacher?._id === this.userId || e.teacher === this.userId);
  }
  isOther(day: string, num: number): boolean {
    const e = this.getEntry(day, num);
    return !!e && e.teacher?._id !== this.userId && e.teacher !== this.userId;
  }
  isFree(day: string, num: number): boolean { return !this.getEntry(day, num); }

  /** Only show CANCELLED badge for today's day and matching periods */
  isCancelledToday(day: string, num: number): boolean {
    return day === this.todayDayName && this.cancelledPeriods.has(num) && !this.isFree(day, num);
  }

  myCount(day: string): number {
    return (this.grouped[day] || []).filter(
      (e: any) => e.teacher?._id === this.userId || e.teacher === this.userId
    ).length;
  }
  assignedCount(day: string): number { return (this.grouped[day] || []).length; }

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
        this.loadTimetable(this.activeClassName);
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
}
