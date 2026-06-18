import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-teacher-polls',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <div class="page-header">
        <h1><i class="fas fa-poll"></i> Poll Reports</h1>
        <p>Attendance polls launched by the Class Representative for your subjects.</p>
      </div>

      <div class="alert alert-success" *ngIf="successMsg">
        <i class="fas fa-check-circle"></i> {{ successMsg }}
      </div>
      <div class="alert alert-error" *ngIf="errorMsg">
        <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
      </div>

      <div *ngIf="loading" class="loading-center">
        <div class="spinner"></div><p>Loading polls...</p>
      </div>

      <div *ngIf="!loading && polls.length === 0" class="empty-card">
        <i class="fas fa-poll" style="font-size:2.5rem;opacity:0.25"></i>
        <h3>No polls yet</h3>
        <p>The Class Representative has not launched any polls for your subjects yet.</p>
      </div>

      <div class="poll-list" *ngIf="!loading && polls.length > 0">
        <div *ngFor="let p of polls" class="poll-card" [class.card-reported]="p.status === 'reported'">

          <div class="poll-header">
            <div class="poll-title">
              <span class="subj-badge">{{ p.subject?.code }}</span>
              <span class="subj-name">{{ p.subject?.name }}</span>
              <span class="period-tag">Period {{ p.periodNumber }}</span>
            </div>
            <span class="status-badge" [class]="'status-' + p.status">{{ p.status }}</span>
          </div>

          <p class="poll-question">"{{ p.question }}"</p>

          <div class="meta-row">
            <span><i class="fas fa-calendar"></i> {{ p.pollDate | date:'dd MMM yyyy' }}</span>
            <span><i class="fas fa-user"></i> Poll by: {{ p.createdBy?.name }}</span>
            <span><i class="fas fa-clock"></i> Deadline: {{ p.deadline | date:'dd MMM, hh:mm a' }}</span>
          </div>

          <div class="report-box">
            <div class="report-title"><i class="fas fa-chart-bar"></i> Attendance Report</div>
            <div class="stats-row">
              <div class="stat yes">
                <span class="stat-num">{{ p.yesCount }}</span>
                <span class="stat-label">Will Attend</span>
              </div>
              <div class="stat no">
                <span class="stat-num">{{ p.noCount }}</span>
                <span class="stat-label">Won't Attend</span>
              </div>
              <div class="stat pending">
                <span class="stat-num">{{ p.pendingCount }}</span>
                <span class="stat-label">No Response</span>
              </div>
              <div class="stat total">
                <span class="stat-num">{{ p.totalStudents }}</span>
                <span class="stat-label">Total Students</span>
              </div>
            </div>

            <div class="bar-container">
              <div class="bar-segment yes-bar"  [style.width]="getPct(p.yesCount, p.totalStudents) + '%'"></div>
              <div class="bar-segment no-bar"   [style.width]="getPct(p.noCount, p.totalStudents) + '%'"></div>
              <div class="bar-segment pend-bar" [style.width]="getPct(p.pendingCount, p.totalStudents) + '%'"></div>
            </div>
            <div class="bar-legend">
              <span class="leg yes-leg">Yes: {{ getPct(p.yesCount, p.totalStudents) }}%</span>
              <span class="leg no-leg">No: {{ getPct(p.noCount, p.totalStudents) }}%</span>
              <span class="leg pend-leg">Pending: {{ getPct(p.pendingCount, p.totalStudents) }}%</span>
            </div>

            <div class="report-sent" *ngIf="p.reportSentAt">
              <i class="fas fa-check-circle"></i>
              Report sent via WhatsApp at {{ p.reportSentAt | date:'hh:mm a, dd MMM' }}
            </div>
          </div>

          <!-- Cancel Period Prompt -->
          <div class="cancel-prompt" *ngIf="p.status === 'reported' && !p.cancelledFromPoll && !p.keptPeriod">
            <div class="prompt-header">
              <i class="fas fa-exclamation-triangle"></i>
              <div>
                <p class="prompt-title">Do you want to cancel this period?</p>
                <p class="prompt-sub">
                  Based on the poll, only <strong>{{ p.yesCount }}</strong> out of
                  <strong>{{ p.totalStudents }}</strong> students will attend
                  Period {{ p.periodNumber }} on {{ p.pollDate | date:'dd MMM yyyy' }}.
                </p>
              </div>
            </div>

            <div class="reason-row" *ngIf="cancellingPollId === p._id">
              <input type="text" class="form-control"
                     [(ngModel)]="cancelReason"
                     placeholder="Reason (optional)" />
              <button class="btn btn-danger"
                      [disabled]="cancelling"
                      (click)="confirmCancel(p)">
                <i class="fas" [class.fa-check]="!cancelling"
                               [class.fa-circle-notch]="cancelling"
                               [class.fa-spin]="cancelling"></i>
                {{ cancelling ? 'Cancelling...' : 'Confirm Cancel' }}
              </button>
              <button class="btn btn-secondary" (click)="cancellingPollId = null">
                Back
              </button>
            </div>

            <div class="prompt-actions" *ngIf="cancellingPollId !== p._id">
              <button class="btn btn-danger" (click)="startCancel(p)">
                <i class="fas fa-times-circle"></i> Yes, Cancel the Period
              </button>
              <button class="btn btn-success" (click)="keepPeriod(p)">
                <i class="fas fa-check-circle"></i> No, Keep the Period
              </button>
            </div>
          </div>

          <div class="already-cancelled" *ngIf="p.cancelledFromPoll">
            <i class="fas fa-ban"></i>
            Period cancelled based on poll. Students notified via WhatsApp.
          </div>

          <div class="kept-period" *ngIf="p.keptPeriod">
            <i class="fas fa-check-circle"></i>
            You chose to keep this period active.
          </div>

        </div>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }
    .page-header { margin-bottom: 1.5rem; }
    .page-header h1 { font-size: 1.4rem; font-weight: 700; margin: 0 0 0.4rem; display: flex; align-items: center; gap: 0.5rem; }
    .page-header p  { color: var(--text-muted); margin: 0; font-size: 0.875rem; }
    .alert { padding: 0.85rem 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .alert-error   { background: #fee2e2; color: #991b1b; }
    .loading-center { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem; color: var(--text-muted); }
    .spinner { width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-card { text-align: center; padding: 4rem 2rem; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem; }
    .empty-card h3 { font-size: 1rem; font-weight: 600; margin: 0; }
    .empty-card p  { margin: 0; font-size: 0.875rem; }
    .poll-list { display: flex; flex-direction: column; gap: 1.25rem; }
    .poll-card { background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); padding: 1.25rem; }
    .card-reported { border-color: #6d28d9; }
    .poll-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem; flex-wrap: wrap; gap: 0.5rem; }
    .poll-title  { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .subj-badge  { background: #ede9fe; color: #6d28d9; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 6px; }
    .subj-name   { font-size: 1rem; font-weight: 600; color: var(--text); }
    .period-tag  { font-size: 0.75rem; color: var(--text-muted); background: var(--bg); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--border); }
    .status-badge { font-size: 0.72rem; font-weight: 600; padding: 0.25rem 0.65rem; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-active   { background: #d1fae5; color: #065f46; }
    .status-closed   { background: #fee2e2; color: #991b1b; }
    .status-reported { background: #ede9fe; color: #4c1d95; }
    .poll-question { font-size: 0.875rem; color: var(--text-muted); font-style: italic; margin: 0 0 0.75rem; }
    .meta-row { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .meta-row span { font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; }
    .report-box { background: var(--bg); border-radius: 10px; padding: 1rem 1.25rem; border: 1px solid var(--border); margin-bottom: 1rem; }
    .report-title { font-size: 0.875rem; font-weight: 600; color: var(--text); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.4rem; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1rem; }
    .stat { background: var(--surface); border-radius: 8px; padding: 0.75rem; text-align: center; border: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.2rem; }
    .stat-num   { font-size: 1.5rem; font-weight: 700; }
    .stat-label { font-size: 0.72rem; color: var(--text-muted); }
    .stat.yes .stat-num     { color: #059669; }
    .stat.no .stat-num      { color: #dc2626; }
    .stat.pending .stat-num { color: #d97706; }
    .stat.total .stat-num   { color: #6d28d9; }
    .bar-container { height: 12px; border-radius: 6px; overflow: hidden; background: #f3f4f6; display: flex; margin-bottom: 0.5rem; }
    .bar-segment { height: 100%; transition: width 0.5s; }
    .yes-bar  { background: #059669; }
    .no-bar   { background: #dc2626; }
    .pend-bar { background: #d97706; }
    .bar-legend { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .leg { font-size: 0.78rem; font-weight: 500; }
    .yes-leg  { color: #059669; }
    .no-leg   { color: #dc2626; }
    .pend-leg { color: #d97706; }
    .report-sent { font-size: 0.78rem; color: #059669; display: flex; align-items: center; gap: 0.4rem; font-weight: 500; padding-top: 0.5rem; border-top: 1px solid var(--border); }
    .cancel-prompt { background: #fff5f5; border: 1.5px solid #fca5a5; border-radius: 10px; padding: 1rem 1.25rem; }
    .prompt-header { display: flex; align-items: flex-start; gap: 0.75rem; margin-bottom: 1rem; }
    .prompt-header i { font-size: 1.25rem; color: #dc2626; margin-top: 2px; flex-shrink: 0; }
    .prompt-title { font-size: 0.95rem; font-weight: 700; color: #991b1b; margin: 0 0 0.3rem; }
    .prompt-sub   { font-size: 0.82rem; color: #7f1d1d; margin: 0; line-height: 1.5; }
    .prompt-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .reason-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
    .form-control { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 0.875rem; min-width: 200px; }
    .form-control:focus { outline: none; border-color: #dc2626; }
    .btn { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: none; }
    .btn-danger   { background: #dc2626; color: #fff; }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-success  { background: #059669; color: #fff; }
    .btn-success:hover { background: #047857; }
    .btn-secondary{ background: #f3f4f6; color: #374151; }
    .btn-secondary:hover { background: #e5e7eb; }
    .already-cancelled { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #991b1b; background: #fee2e2; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 500; }
    .kept-period       { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: #065f46; background: #d1fae5; border-radius: 8px; padding: 0.6rem 1rem; font-weight: 500; }
    @media (max-width: 600px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class TeacherPollsComponent implements OnInit {
  polls: any[]  = [];
  loading       = false;
  successMsg    = '';
  errorMsg      = '';
  cancellingPollId: string | null = null;
  cancelReason  = '';
  cancelling    = false;

  constructor(private auth: AuthService, private http: HttpClient) {}

  ngOnInit() { this.loadPolls(); }

  loadPolls() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/polls/teacher/my-polls`).subscribe({
      next: res => { this.polls = res.polls || []; this.loading = false; },
      error: ()  => { this.loading = false; }
    });
  }

  getPct(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }

  startCancel(p: any) {
    this.cancellingPollId = p._id;
    this.cancelReason     = 'Low attendance based on poll results';
    this.successMsg = '';
    this.errorMsg   = '';
  }

  confirmCancel(p: any) {
    this.cancelling = true;
    this.http.post<any>(`${environment.apiUrl}/polls/cancel-from-poll`, {
      pollId: p._id,
      reason: this.cancelReason || 'Low attendance based on poll results',
    }).subscribe({
      next: () => {
        this.cancelling       = false;
        this.cancellingPollId = null;
        this.cancelReason     = '';
        this.successMsg       = 'Period ' + p.periodNumber + ' cancelled! Students notified via WhatsApp.';
        p.cancelledFromPoll   = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: err => {
        this.cancelling = false;
        this.errorMsg   = err.error?.message || 'Failed to cancel period.';
      }
    });
  }

  keepPeriod(p: any) {
    p.keptPeriod    = true;
    this.successMsg = 'You chose to keep Period ' + p.periodNumber + ' active.';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
