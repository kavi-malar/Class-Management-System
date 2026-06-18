import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { AuthService } from '../../../services/auth.service';
import { TimetableService } from '../../../services/timetable.service';

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">
      <div class="page-header">
        <h1>Teacher Dashboard</h1>
        <p>Welcome back, <strong>{{ user?.name }}</strong>!
          You teach <strong>{{ user?.assignedSubject?.name }}</strong>.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon icon-blue"><i class="fas fa-calendar-check"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ myPeriods }}</span>
            <span class="stat-label">My Periods / Week</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-red"><i class="fas fa-calendar-times"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ upcomingChanges }}</span>
            <span class="stat-label">Upcoming Cancellations</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon icon-green"><i class="fas fa-sms"></i></div>
          <div class="stat-info">
            <span class="stat-value">SMS</span>
            <span class="stat-label">Auto-alerts Active</span>
          </div>
        </div>
      </div>

      <!-- Today's schedule -->
      <div class="card section-card">
        <div class="card-header">
          <h2><i class="fas fa-clock"></i> Today — {{ todayName }}</h2>
          <span class="today-badge">{{ todayDate }}</span>
        </div>
        <div *ngIf="loadingToday" class="loading-center"><div class="spinner"></div></div>
        <div *ngIf="!loadingToday && todayEntries.length === 0" class="empty-state">
          <i class="fas fa-coffee"></i>
          <p>No periods assigned today. Enjoy your day!</p>
        </div>
        <div *ngIf="!loadingToday && todayEntries.length > 0" class="today-periods">
          <div class="period-card" *ngFor="let e of todayEntries"
               [class.period-cancelled]="e.isChanged">
            <div class="period-num">P{{ e.periodNumber }}</div>
            <div class="period-info">
              <span class="period-time">{{ e.startTime }} – {{ e.endTime }}</span>
              <span class="period-subject">{{ e.subject?.name }}</span>
            </div>
            <span class="badge" [class.badge-success]="!e.isChanged" [class.badge-danger]="e.isChanged">
              {{ e.isChanged ? 'Cancelled' : 'Scheduled' }}
            </span>
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <a routerLink="/teacher/mark-unavailable" class="action-card">
          <i class="fas fa-calendar-times"></i><span>Cancel Period</span>
        </a>
        <a routerLink="/teacher/mark-available" class="action-card">
          <i class="fas fa-calendar-plus"></i><span>Free Period</span>
        </a>
        <a routerLink="/teacher/timetable" class="action-card">
          <i class="fas fa-table"></i><span>View Timetable</span>
        </a>
        <a routerLink="/teacher/changes" class="action-card">
          <i class="fas fa-history"></i><span>My Changes</span>
        </a>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
    .stats-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.25rem; margin-bottom: 2rem; }
    .stat-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; }
    .stat-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0; }
    .icon-blue  { background: #dbeafe; color: #1d4ed8; }
    .icon-red   { background: #fee2e2; color: #dc2626; }
    .icon-green { background: #d1fae5; color: #059669; }
    .stat-info  { display: flex; flex-direction: column; }
    .stat-value { font-size: 1.75rem; font-weight: 700; line-height: 1; }
    .stat-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem; }
    .section-card { margin-bottom: 2rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
    .card-header h2 { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
    .today-badge { background: var(--primary); color: #fff; padding: 0.2rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
    .today-periods { display: flex; flex-direction: column; gap: 0.75rem; }
    .period-card { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1rem; border: 1.5px solid var(--border); border-radius: var(--radius-sm); }
    .period-card.period-cancelled { border-color: #fca5a5; background: #fff5f5; }
    .period-num { font-size: 1.1rem; font-weight: 700; color: var(--primary); min-width: 2rem; }
    .period-info { flex: 1; display: flex; flex-direction: column; }
    .period-time    { font-size: 0.8rem; color: var(--text-muted); }
    .period-subject { font-weight: 600; }
    .empty-state { text-align: center; padding: 2rem; color: var(--text-muted); }
    .empty-state i { font-size: 2.5rem; opacity: 0.4; display: block; margin-bottom: 0.75rem; }
    .quick-actions { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
    .action-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text); transition: all 0.2s; border: 2px solid transparent; }
    .action-card:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-2px); }
    .action-card i { font-size: 1.75rem; }
    .action-card span { font-weight: 600; font-size: 0.9rem; }
    @media (max-width: 768px) { .stats-grid { grid-template-columns: 1fr 1fr; } .quick-actions { grid-template-columns: 1fr 1fr; } }
  `]
})
export class TeacherDashboardComponent implements OnInit {
  user: any;
  myPeriods = 0;
  upcomingChanges = 0;
  todayEntries: any[] = [];
  loadingToday = true;
  todayName = '';
  todayDate = '';

  constructor(private authService: AuthService, private timetableService: TimetableService) {}

  ngOnInit(): void {
    this.user      = this.authService.currentUser;
    const today    = new Date();
    this.todayName = today.toLocaleDateString('en-US', { weekday: 'long' });
    this.todayDate = today.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    this.timetableService.getTeacherTimetable().subscribe({
      next: (res: any) => { this.myPeriods = res.timetable?.length || 0; }
    });

    this.timetableService.getChanges({ upcoming: true }).subscribe({
      next: (res: any) => { this.upcomingChanges = res.changes?.length || 0; }
    });

    const todayStr = toLocalISO(new Date());
    this.timetableService.getTimetableForDate(todayStr).subscribe({
      next: (res: any) => {
        const userId = this.user?._id;
        this.todayEntries = (res.timetable || []).filter(
          (e: any) => e.teacher?._id === userId || e.teacher === userId
        );
        this.loadingToday = false;
      },
      error: () => { this.loadingToday = false; }
    });
  }
}
