import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { AuthService } from '../../../services/auth.service';
import { TimetableService } from '../../../services/timetable.service';
import { RoomService } from '../../../services/room.service';

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
        <div class="stat-card" [class.stat-card-alert]="todayCancellations.length > 0">
          <div class="stat-icon icon-orange"><i class="fas fa-exclamation-triangle"></i></div>
          <div class="stat-info">
            <span class="stat-value">{{ todayCancellations.length }}</span>
            <span class="stat-label">Cancellations Today</span>
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

      <!-- ── Cancelled Classes Today (Feature 3 + Feature 5) ── -->
      <div class="card section-card cancellations-section" *ngIf="todayCancellations.length > 0">
        <div class="card-header cancellations-header">
          <h2><i class="fas fa-ban"></i> Cancelled Classes Today</h2>
          <span class="cancel-count-badge">{{ todayCancellations.length }} cancelled</span>
        </div>
        <div class="cancellations-list">
          <div class="cancel-item" *ngFor="let c of todayCancellations">
            <div class="cancel-period-badge">P{{ c.periodNumber }}</div>
            <div class="cancel-info">
              <div class="cancel-subject">
                <i class="fas fa-circle cancel-dot"></i>
                <strong>{{ c.subject?.name || 'Unknown Subject' }}</strong>
                <span class="cancel-class-tag">{{ c.className }}</span>
              </div>
              <div class="cancel-meta">
                <span><i class="fas fa-clock"></i> {{ c.startTime }} – {{ c.endTime }}</span>
                <span><i class="fas fa-user-times"></i> Cancelled by {{ c.teacher?.name || 'Unknown' }}</span>
                <span *ngIf="c.classroomNo && c.classroomNo !== 'TBD'">
                  <i class="fas fa-door-open"></i> Room {{ c.classroomNo }}
                </span>
                <!-- Feature 5: show date cancelled -->
                <span *ngIf="c.cancelledAt">
                  <i class="fas fa-calendar-times"></i>
                  Cancelled {{ c.cancelledAt | date:'dd MMM, h:mm a' }}
                </span>
              </div>
              <div class="cancel-reason" *ngIf="c.reason">
                <i class="fas fa-comment-alt"></i> {{ c.reason }}
              </div>
              <!-- Feature 5: Available for Extra Class indicator -->
              <div class="cancel-offerable">
                <span *ngIf="c.offerable && !c.claimedBy" class="offerable-pill offerable-open">
                  <i class="fas fa-door-open"></i> Available for Extra Class
                </span>
                <span *ngIf="c.offerable && c.claimedBy" class="offerable-pill offerable-taken">
                  <i class="fas fa-user-check"></i> Extra class claimed by {{ c.claimedBy?.name }}
                </span>
                <span *ngIf="!c.offerable" class="offerable-pill offerable-no">
                  <i class="fas fa-ban"></i> Not available (same-day)
                </span>
              </div>
            </div>
            <div class="cancel-status-tag">CANCELLED</div>
          </div>
        </div>
      </div>

      <!-- No cancellations banner -->
      <div class="no-cancellations-banner" *ngIf="!loadingCancellations && todayCancellations.length === 0">
        <i class="fas fa-check-circle"></i>
        <span>No class cancellations today</span>
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
              <span class="period-room" *ngIf="e.classroomNo && e.classroomNo !== 'TBD'">
                <i class="fas fa-door-open"></i> Room {{ e.classroomNo }}
              </span>
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
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1.25rem; margin-bottom: 2rem; }
    .stat-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow);
                 padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem;
                 border: 2px solid transparent; transition: border-color .2s; }
    .stat-card-alert { border-color: #f97316; animation: pulse-border 2s ease infinite; }
    @keyframes pulse-border { 0%,100%{border-color:#f97316} 50%{border-color:#fed7aa} }
    .stat-icon { width: 56px; height: 56px; border-radius: 14px; display: flex;
                 align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0; }
    .icon-blue   { background: #dbeafe; color: #1d4ed8; }
    .icon-red    { background: #fee2e2; color: #dc2626; }
    .icon-orange { background: #ffedd5; color: #c2410c; }
    .icon-green  { background: #d1fae5; color: #059669; }
    .stat-info   { display: flex; flex-direction: column; }
    .stat-value  { font-size: 1.75rem; font-weight: 700; line-height: 1; }
    .stat-label  { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem; }
    .section-card { margin-bottom: 2rem; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem; }
    .card-header h2 { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }
    .today-badge { background: var(--primary); color: #fff; padding: 0.2rem 0.75rem;
                   border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }

    /* ── Cancellations Section ── */
    .cancellations-section { border: 2px solid #fca5a5; }
    .cancellations-header { background: #fff5f5; margin: -1.25rem -1.25rem 1rem;
                            padding: 1rem 1.25rem; border-radius: 10px 10px 0 0; }
    .cancellations-header h2 { color: #b91c1c; }
    .cancel-count-badge { background: #dc2626; color: #fff; padding: 0.2rem 0.7rem;
                          border-radius: 9999px; font-size: 0.78rem; font-weight: 700; }
    .cancellations-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .cancel-item { display: flex; align-items: flex-start; gap: 1rem; padding: 0.9rem 1rem;
                   border: 1.5px solid #fecaca; border-radius: 8px; background: #fff5f5;
                   position: relative; }
    .cancel-period-badge { min-width: 42px; height: 42px; background: #dc2626; color: #fff;
                           border-radius: 8px; display: flex; align-items: center;
                           justify-content: center; font-size: 0.85rem; font-weight: 800;
                           flex-shrink: 0; }
    .cancel-info { flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
    .cancel-subject { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
    .cancel-dot { color: #dc2626; font-size: 0.5rem; }
    .cancel-class-tag { background: #fee2e2; color: #991b1b; padding: 0.1rem 0.45rem;
                        border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
    .cancel-meta { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
                   font-size: 0.78rem; color: #64748b; }
    .cancel-meta span { display: flex; align-items: center; gap: 0.3rem; }
    .cancel-reason { font-size: 0.78rem; color: #6b7280; font-style: italic; }
    .cancel-status-tag { position: absolute; top: 0.6rem; right: 0.75rem;
                         background: #dc2626; color: #fff; font-size: 0.65rem;
                         font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px;
                         letter-spacing: 0.06em; }

    /* Feature 5: offerable pill */
    .cancel-offerable { margin-top: 0.3rem; }
    .offerable-pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.65rem; border-radius: 6px; font-size: 0.74rem; font-weight: 600; }
    .offerable-open  { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .offerable-taken { background: #ede9fe; color: #4c1d95; border: 1px solid #c4b5fd; }
    .offerable-no    { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }

    .no-cancellations-banner { display: flex; align-items: center; gap: 0.5rem;
                               background: #f0fdf4; border: 1.5px solid #86efac;
                               color: #166534; padding: 0.65rem 1rem; border-radius: 8px;
                               font-size: 0.85rem; font-weight: 600; margin-bottom: 1.5rem; }

    /* Today periods */
    .today-periods { display: flex; flex-direction: column; gap: 0.75rem; }
    .period-card { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1rem;
                   border: 1.5px solid var(--border); border-radius: var(--radius-sm); }
    .period-card.period-cancelled { border-color: #fca5a5; background: #fff5f5; }
    .period-num  { font-size: 1.1rem; font-weight: 700; color: var(--primary); min-width: 2rem; }
    .period-info { flex: 1; display: flex; flex-direction: column; }
    .period-time    { font-size: 0.8rem; color: var(--text-muted); }
    .period-subject { font-weight: 600; }
    .period-room    { font-size: 0.78rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem; }
    .empty-state { text-align: center; padding: 2rem; color: var(--text-muted); }
    .empty-state i { font-size: 2.5rem; opacity: 0.4; display: block; margin-bottom: 0.75rem; }
    .loading-center { display: flex; justify-content: center; padding: 2rem; }
    .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0;
               border-top-color: #3b82f6; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Badges */
    .badge { padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-danger  { background: #fee2e2; color: #991b1b; }

    /* Quick actions */
    .quick-actions { display: grid; grid-template-columns: repeat(4,1fr); gap: 1rem; }
    .action-card { background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow);
                   padding: 1.5rem; display: flex; flex-direction: column; align-items: center;
                   gap: 0.75rem; text-decoration: none; color: var(--text); transition: all 0.2s;
                   border: 2px solid transparent; }
    .action-card:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-2px); }
    .action-card i { font-size: 1.75rem; }
    .action-card span { font-weight: 600; font-size: 0.9rem; }
    @media (max-width: 900px) {
      .stats-grid { grid-template-columns: 1fr 1fr; }
      .quick-actions { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class TeacherDashboardComponent implements OnInit, OnDestroy {
  user: any;
  myPeriods = 0;
  upcomingChanges = 0;
  todayEntries: any[] = [];
  todayCancellations: any[] = [];
  loadingToday = true;
  loadingCancellations = true;
  todayName = '';
  todayDate = '';

  private refreshTimer: any;

  constructor(
    private authService: AuthService,
    private timetableService: TimetableService,
    private roomService: RoomService
  ) {}

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

    // Feature 3: Load today's cancellations (visible to ALL teachers)
    this.loadCancellations();
    // Auto-refresh cancellations every 60 seconds
    this.refreshTimer = setInterval(() => this.loadCancellations(), 60000);
  }

  ngOnDestroy(): void { clearInterval(this.refreshTimer); }

  loadCancellations(): void {
    this.roomService.getTodayCancellations().subscribe({
      next: (res: any) => {
        this.todayCancellations  = res.cancellations || [];
        this.loadingCancellations = false;
      },
      error: () => { this.loadingCancellations = false; }
    });
  }
}
