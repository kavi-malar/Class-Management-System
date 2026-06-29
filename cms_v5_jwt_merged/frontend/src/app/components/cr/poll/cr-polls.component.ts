import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cr-polls',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-chalkboard-teacher"></i> ClassMS</div>
      <div class="nav-links">
        <a routerLink="/cr/dashboard"><i class="fas fa-home"></i> Dashboard</a>
        <a routerLink="/cr/poll"><i class="fas fa-poll"></i> Launch Poll</a>
        <a routerLink="/cr/polls" class="active"><i class="fas fa-list"></i> My Polls</a>
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
        <h1><i class="fas fa-list"></i> My Polls</h1>
        <a routerLink="/cr/poll" class="btn btn-primary"><i class="fas fa-plus"></i> New Poll</a>
      </div>

      <div class="alert alert-success" *ngIf="successMsg">
        <i class="fas fa-check-circle"></i> {{ successMsg }}
      </div>

      <div *ngIf="loading" class="loading-center">
        <div class="spinner"></div><p>Loading polls…</p>
      </div>

      <div *ngIf="!loading && polls.length === 0" class="empty-card">
        <i class="fas fa-poll" style="font-size:2.5rem;opacity:0.3"></i>
        <p>No polls yet.</p>
        <a routerLink="/cr/poll" class="btn btn-primary">Launch First Poll</a>
      </div>

      <div class="poll-cards" *ngIf="!loading && polls.length > 0">
        <div *ngFor="let p of polls" class="poll-card">
          <div class="poll-card-header">
            <div class="poll-card-title">
              <span class="subject-badge">{{ p.subject?.code }}</span>
              <span class="subject-name">{{ p.subject?.name }}</span>
            </div>
            <span class="status-badge" [class]="'status-' + p.status">{{ p.status }}</span>
          </div>

          <p class="poll-question">"{{ p.question }}"</p>

          <div class="poll-meta-row">
            <span><i class="fas fa-user-tie"></i> {{ p.teacher?.name }}</span>
            <span><i class="fas fa-calendar"></i> {{ p.pollDate | date:'dd MMM yyyy' }}</span>
            <span><i class="fas fa-clock"></i> Period {{ p.periodNumber }}</span>
          </div>

          <div class="poll-results">
            <div class="result-bar">
              <div class="bar-fill yes" [style.width]="getYesPct(p) + '%'"></div>
            </div>
            <div class="result-labels">
              <span class="yes-label">✅ Yes: {{ p.yesCount }} ({{ getYesPct(p) }}%)</span>
              <span class="no-label">❌ No: {{ p.noCount }}</span>
              <span class="pending-label">⏳ Pending: {{ getPending(p) }}</span>
            </div>
          </div>

          <div class="poll-footer">
            <span class="deadline-info">
              <i class="fas fa-hourglass-half"></i>
              Deadline: {{ p.deadline | date:'dd MMM, hh:mm a' }}
            </span>
            <button *ngIf="p.status === 'active'"
                    class="btn btn-danger btn-sm"
                    [disabled]="closing === p._id"
                    (click)="closePoll(p)">
              <i class="fas fa-stop-circle"></i>
              {{ closing === p._id ? 'Closing...' : 'Close & Send Report' }}
            </button>
            <span *ngIf="p.status === 'reported'" class="report-sent">
              <i class="fas fa-check-circle"></i> Report sent at {{ p.reportSentAt | date:'hh:mm a' }}
            </span>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .navbar { display:flex; align-items:center; gap:1.5rem; padding:0 2rem; height:60px; background:#fff; border-bottom:1px solid #e5e7eb; position:sticky; top:0; z-index:100; }
    .nav-brand { font-size:1.2rem; font-weight:700; color:#6d28d9; display:flex; align-items:center; gap:0.5rem; margin-right:1rem; }
    .nav-links { display:flex; gap:0.25rem; flex:1; }
    .nav-links a { padding:0.4rem 0.85rem; border-radius:8px; font-size:0.875rem; color:#6b7280; text-decoration:none; display:flex; align-items:center; gap:0.4rem; }
    .nav-links a:hover, .nav-links a.active { background:#f3e8ff; color:#6d28d9; }
    .nav-user { display:flex; align-items:center; gap:0.75rem; margin-left:auto; }
    .user-avatar { width:36px; height:36px; border-radius:50%; background:#6d28d9; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:0.85rem; }
    .user-info { display:flex; flex-direction:column; }
    .user-name { font-size:0.875rem; font-weight:600; color:#111827; }
    .user-role { font-size:0.75rem; color:#6d28d9; font-weight:500; }
    .btn-logout { background:none; border:1px solid #e5e7eb; border-radius:8px; padding:0.35rem 0.75rem; font-size:0.8rem; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:0.4rem; }
    .btn-logout:hover { background:#fee2e2; color:#dc2626; border-color:#dc2626; }

    .page-container { max-width:900px; margin:0 auto; padding:2rem 1.5rem; }
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; }
    .page-header h1 { font-size:1.4rem; font-weight:700; color:#111827; margin:0; display:flex; align-items:center; gap:0.5rem; }

    .alert { padding:0.85rem 1rem; border-radius:8px; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; }
    .alert-success { background:#d1fae5; color:#065f46; }

    .btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.6rem 1.25rem; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; border:none; text-decoration:none; }
    .btn-primary { background:#6d28d9; color:#fff; }
    .btn-primary:hover { background:#5b21b6; }
    .btn-danger  { background:#dc2626; color:#fff; }
    .btn-danger:hover:not(:disabled) { background:#b91c1c; }
    .btn-danger:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-sm { padding:0.4rem 0.85rem; font-size:0.8rem; }

    .loading-center { display:flex; flex-direction:column; align-items:center; gap:0.5rem; padding:3rem; color:#6b7280; }
    .spinner { width:24px; height:24px; border:3px solid #e5e7eb; border-top-color:#6d28d9; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .empty-card { text-align:center; padding:4rem 2rem; color:#6b7280; display:flex; flex-direction:column; align-items:center; gap:1rem; }

    .poll-cards { display:flex; flex-direction:column; gap:1rem; }
    .poll-card { background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:1.25rem; }

    .poll-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; }
    .poll-card-title  { display:flex; align-items:center; gap:0.6rem; }
    .subject-badge { background:#ede9fe; color:#6d28d9; font-size:0.75rem; font-weight:600; padding:0.2rem 0.6rem; border-radius:6px; }
    .subject-name  { font-size:1rem; font-weight:600; color:#111827; }

    .status-badge { font-size:0.72rem; font-weight:600; padding:0.25rem 0.65rem; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px; }
    .status-active   { background:#d1fae5; color:#065f46; }
    .status-closed   { background:#fee2e2; color:#991b1b; }
    .status-reported { background:#ede9fe; color:#4c1d95; }

    .poll-question { font-size:0.875rem; color:#374151; font-style:italic; margin:0 0 0.75rem; }

    .poll-meta-row { display:flex; gap:1.25rem; flex-wrap:wrap; margin-bottom:0.85rem; }
    .poll-meta-row span { font-size:0.78rem; color:#6b7280; display:flex; align-items:center; gap:0.3rem; }

    .poll-results { margin-bottom:0.85rem; }
    .result-bar   { height:8px; background:#f3f4f6; border-radius:4px; overflow:hidden; margin-bottom:0.4rem; }
    .bar-fill.yes { height:100%; background:#059669; border-radius:4px; transition:width 0.5s; }
    .result-labels { display:flex; gap:1rem; flex-wrap:wrap; }
    .yes-label     { font-size:0.8rem; color:#059669; font-weight:600; }
    .no-label      { font-size:0.8rem; color:#dc2626; font-weight:600; }
    .pending-label { font-size:0.8rem; color:#d97706; }

    .poll-footer { display:flex; align-items:center; justify-content:space-between; padding-top:0.75rem; border-top:1px solid #f3f4f6; flex-wrap:wrap; gap:0.5rem; }
    .deadline-info { font-size:0.78rem; color:#6b7280; display:flex; align-items:center; gap:0.4rem; }
    .report-sent   { font-size:0.78rem; color:#059669; display:flex; align-items:center; gap:0.4rem; font-weight:600; }
  `]
})
export class CrPollsComponent implements OnInit {
  user: any;
  polls: any[]  = [];
  loading       = false;
  successMsg    = '';
  closing: string | null = null;
  totalStudents = 0;

  get initials(): string {
    return this.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CR';
  }

  getYesPct(p: any): number {
    if (!this.totalStudents) return 0;
    return Math.round((p.yesCount / this.totalStudents) * 100);
  }

  getPending(p: any): number {
    return Math.max(0, this.totalStudents - p.yesCount - p.noCount);
  }

  constructor(private auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.user = this.auth.currentUser;
    this.loadPolls();
  }

  loadPolls() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/polls`).subscribe({
      next: res => {
        this.polls        = res.polls || [];
        this.totalStudents = res.totalStudents || 5;
        this.loading      = false;
      },
      error: () => { this.loading = false; }
    });
  }

  closePoll(p: any) {
    if (!confirm('Close this poll and send the report to teacher and CR via WhatsApp?')) return;
    this.closing = p._id;
    this.http.patch<any>(`${environment.apiUrl}/polls/${p._id}/close`, {}).subscribe({
      next: res => {
        this.closing    = null;
        this.successMsg = res.message || 'Poll closed and report sent!';
        this.loadPolls();
      },
      error: err => {
        this.closing = null;
        alert(err.error?.message || 'Failed to close poll.');
      }
    });
  }

  logout() { this.auth.logout(); }
}
