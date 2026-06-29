import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';
import { NotificationService } from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">
      <div class="page-header">
        <h1>Student Dashboard</h1>
        <p>Welcome, <strong>{{ user?.name }}</strong>! Here is your class status for today.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue"><i class="fas fa-book-open"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ todayAssigned }}</span>
            <span class="stat-label">Classes Today</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-red"><i class="fas fa-times-circle"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ todayCancelled }}</span>
            <span class="stat-label">Cancelled Today</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-green"><i class="fas fa-plus-circle"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ todayExtra }}</span>
            <span class="stat-label">Extra Classes Today</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-purple"><i class="fas fa-bell"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ notifCount }}</span>
            <span class="stat-label">Notifications</span>
          </div>
        </div>
      </div>

      <!-- Today's full schedule -->
      <div class="card section-card">
        <div class="card-header">
          <h2><i class="fas fa-calendar-day"></i> Today — {{ todayName }}</h2>
          <span class="today-badge">{{ todayDate }}</span>
        </div>

        <div *ngIf="loadingToday" class="loading-center"><div class="spinner"></div></div>

        <div *ngIf="!loadingToday" class="schedule-list">
          <div *ngFor="let slot of allSlots" class="sched-row"
               [class.sched-active]="isActive(slot.number)"
               [class.sched-cancelled]="isCancelled(slot.number)"
               [class.sched-extra]="hasExtra(slot.number)"
               [class.sched-free]="isFree(slot.number)">

            <span class="sched-num"
                  [class.num-active]="isActive(slot.number)"
                  [class.num-cancelled]="isCancelled(slot.number)"
                  [class.num-extra]="hasExtra(slot.number)"
                  [class.num-free]="isFree(slot.number)">
              P{{ slot.number }}
            </span>

            <div class="sched-info">
              <span class="sched-subj" *ngIf="isActive(slot.number) || isCancelled(slot.number)">
                {{ getPeriod(slot.number)?.subject?.name }}
              </span>
              <span class="sched-subj extra-subj" *ngIf="hasExtra(slot.number)">
                {{ getFreeSlot(slot.number)?.subject?.name }}
                <span class="extra-tag">EXTRA</span>
              </span>
              <span class="sched-subj free-subj" *ngIf="isFree(slot.number)">
                <i class="fas fa-coffee"></i> Free Period
              </span>
              <span class="sched-time">{{ slot.start }} – {{ slot.end }}</span>
              <span class="cancel-reason" *ngIf="isCancelled(slot.number)">
                {{ getPeriod(slot.number)?.change?.reason }}
              </span>
            </div>

            <span class="badge"
                  [class.badge-success]="isActive(slot.number)"
                  [class.badge-danger]="isCancelled(slot.number)"
                  [class.badge-info]="hasExtra(slot.number)"
                  [class.badge-secondary]="isFree(slot.number)">
              {{ getStatus(slot.number) }}
            </span>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <a routerLink="/student/timetable" class="action-card">
          <i class="fas fa-table"></i><span>Full Timetable</span>
        </a>
        <a routerLink="/student/notifications" class="action-card">
          <i class="fas fa-bell"></i><span>Notifications</span>
        </a>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.25rem; display: flex; align-items: center; gap: 1rem; }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; }
    .icon-blue   { background: #dbeafe; color: #1d4ed8; }
    .icon-red    { background: #fee2e2; color: #dc2626; }
    .icon-green  { background: #d1fae5; color: #059669; }
    .icon-purple { background: #ede9fe; color: #7c3aed; }
    .stat-info { display: flex; flex-direction: column; }
    .stat-value { font-size: 1.5rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }

    .section-card { margin-bottom: 2rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .card-header h2 { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
    .today-badge { background: var(--secondary); color: #fff; padding: 0.2rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }

    .schedule-list { display: flex; flex-direction: column; gap: 0.45rem; }
    .sched-row { display: flex; align-items: center; gap: 0.85rem; padding: 0.65rem 0.9rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm); }
    .sched-active    { border-color: #93c5fd; background: #eff6ff; }
    .sched-cancelled { border-color: #fca5a5; background: #fff5f5; }
    .sched-extra     { border-color: #6ee7b7; background: #f0fdf4; }
    .sched-free      { border-color: var(--border); background: #fafafa; opacity: 0.65; }

    .sched-num { min-width: 32px; height: 32px; border-radius: 7px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.78rem; flex-shrink: 0; }
    .num-active    { background: #3b82f6; }
    .num-cancelled { background: var(--danger); }
    .num-extra     { background: var(--success); }
    .num-free      { background: #9ca3af; }

    .sched-info { flex: 1; display: flex; flex-direction: column; gap: 0.05rem; }
    .sched-subj { font-weight: 600; font-size: 0.88rem; }
    .extra-subj { color: #065f46; }
    .free-subj  { color: #9ca3af; font-weight: 400; display: flex; align-items: center; gap: 0.3rem; }
    .sched-time { font-size: 0.73rem; color: var(--text-muted); }
    .cancel-reason { font-size: 0.73rem; color: var(--danger); }
    .extra-tag { background: #6ee7b7; color: #065f46; padding: 0.1rem 0.35rem; border-radius: 4px; font-size: 0.68rem; margin-left: 0.3rem; font-weight: 700; }
    .badge-secondary { background: #f3f4f6; color: #6b7280; }

    .quick-actions { display: grid; grid-template-columns: repeat(2,1fr); gap: 1rem; }
    .action-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text); transition: all 0.2s; border: 2px solid transparent; }
    .action-card:hover { border-color: var(--secondary); color: var(--secondary); transform: translateY(-2px); }
    .action-card i { font-size: 1.75rem; }
    .action-card span { font-weight: 600; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr 1fr; } }
  `]
})
export class StudentDashboardComponent implements OnInit {
  user: any;
  allSlots       = ALL_SLOTS;
  todayEntries: any[] = [];
  todayFreeSlots: any[] = [];
  loadingToday   = true;
  todayName      = '';
  todayDate      = '';
  notifCount     = 0;

  get todayAssigned():  number { return this.todayEntries.filter((e:any) => !e.isChanged).length; }
  get todayCancelled(): number { return this.todayEntries.filter((e:any) => e.isChanged).length; }
  get todayExtra():     number { return this.todayFreeSlots.filter((f:any) => f.status === 'active').length; }

  constructor(
    private authService: AuthService,
    private timetableService: TimetableService,
    private notifService: NotificationService
  ) {}

  ngOnInit(): void {
    this.user      = this.authService.currentUser;
    const today    = new Date();
    this.todayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    this.todayDate = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const todayStr = toLocalISO(today);
    this.timetableService.getTimetableForDate(todayStr).subscribe({
      next: (r: any) => { this.todayEntries = r.timetable || []; this.loadingToday = false; },
      error: () => { this.loadingToday = false; }
    });
    this.timetableService.getFreeSlots({ date: todayStr }).subscribe({
      next: (r: any) => { this.todayFreeSlots = r.freeSlots || []; }
    });
    this.notifService.getNotifications().subscribe({
      next: (r: any) => { this.notifCount = r.notifications?.length || 0; }
    });
  }

  getPeriod(num: number):   any { return this.todayEntries.find((e:any) => e.periodNumber === num); }
  getFreeSlot(num: number): any { return this.todayFreeSlots.find((f:any) => f.periodNumber === num && f.status === 'active'); }
  isActive(num: number):    boolean { const e = this.getPeriod(num); return !!e && !e.isChanged; }
  isCancelled(num: number): boolean { const e = this.getPeriod(num); return !!e && !!e.isChanged; }
  hasExtra(num: number):    boolean { return !this.getPeriod(num) && !!this.getFreeSlot(num); }
  isFree(num: number):      boolean { return !this.getPeriod(num) && !this.getFreeSlot(num); }

  getStatus(num: number): string {
    if (this.isCancelled(num)) return '❌ Cancelled';
    if (this.isActive(num))    return '✅ Active';
    if (this.hasExtra(num))    return '📗 Extra';
    return '—';
  }
}
