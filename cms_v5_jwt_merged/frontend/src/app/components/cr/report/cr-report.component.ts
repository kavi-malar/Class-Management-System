import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cr-report',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-chalkboard-teacher"></i> ClassMS</div>
      <div class="nav-links">
        <a routerLink="/cr/dashboard"><i class="fas fa-home"></i> Dashboard</a>
        <a routerLink="/cr/poll"><i class="fas fa-poll"></i> Launch Poll</a>
        <a routerLink="/cr/polls"><i class="fas fa-list"></i> My Polls</a>
        <a routerLink="/cr/reports" class="active"><i class="fas fa-chart-bar"></i> Reports</a>
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
        <h1><i class="fas fa-chart-bar"></i> Poll Reports</h1>
        <p>Detailed attendance reports for all polls you have launched.</p>
      </div>

      <div *ngIf="loading" class="loading-center">
        <div class="spinner"></div><p>Loading reports…</p>
      </div>

      <div *ngIf="!loading && polls.length === 0" class="empty-card">
        <i class="fas fa-chart-bar" style="font-size:2.5rem;opacity:0.25"></i>
        <h3>No reports yet</h3>
        <p>Launch a poll first to see reports here.</p>
        <a routerLink="/cr/poll" class="btn btn-primary">Launch Poll</a>
      </div>

      <div class="poll-list" *ngIf="!loading && polls.length > 0">
        <div *ngFor="let p of polls" class="poll-card">

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
            <span><i class="fas fa-user-tie"></i> {{ p.teacher?.name }}</span>
            <span><i class="fas fa-clock"></i> Deadline: {{ p.deadline | date:'hh:mm a, dd MMM' }}</span>
          </div>

          <!-- Summary stats -->
          <div class="report-box">
            <div class="report-title"><i class="fas fa-chart-pie"></i> Attendance Summary</div>

            <div class="stats-row">
              <div class="stat yes">
                <span class="stat-num">{{ p.yesCount }}</span>
                <span class="stat-label">Will Attend</span>
                <span class="stat-pct">{{ getPct(p.yesCount, p.totalStudents) }}%</span>
              </div>
              <div class="stat no">
                <span class="stat-num">{{ p.noCount }}</span>
                <span class="stat-label">Won't Attend</span>
                <span class="stat-pct">{{ getPct(p.noCount, p.totalStudents) }}%</span>
              </div>
              <div class="stat pending">
                <span class="stat-num">{{ getPending(p) }}</span>
                <span class="stat-label">No Response</span>
                <span class="stat-pct">{{ getPct(getPending(p), p.totalStudents) }}%</span>
              </div>
              <div class="stat total">
                <span class="stat-num">{{ p.totalStudents }}</span>
                <span class="stat-label">Total</span>
                <span class="stat-pct">100%</span>
              </div>
            </div>

            <div class="bar-container">
              <div class="bar-segment yes-bar"  [style.width]="getPct(p.yesCount, p.totalStudents) + '%'"></div>
              <div class="bar-segment no-bar"   [style.width]="getPct(p.noCount, p.totalStudents) + '%'"></div>
              <div class="bar-segment pend-bar" [style.width]="getPct(getPending(p), p.totalStudents) + '%'"></div>
            </div>

            <!-- Student response breakdown -->
            <div class="response-breakdown" *ngIf="p.responses?.length > 0">
              <div class="breakdown-title">Student Responses</div>
              <div class="response-list">
                <div *ngFor="let r of p.responses" class="response-row">
                  <span class="student-name">{{ r.student?.name }}</span>
                  <span class="response-answer" [class]="r.answer === 'yes' ? 'ans-yes' : 'ans-no'">
                    {{ r.answer === 'yes' ? '✅ Will attend' : '❌ Won\'t attend' }}
                  </span>
                  <span class="response-time">{{ r.answeredAt | date:'hh:mm a' }}</span>
                </div>
              </div>
            </div>

            <div class="report-sent" *ngIf="p.reportSentAt">
              <i class="fas fa-check-circle"></i>
              Report sent to teacher & CR via WhatsApp at {{ p.reportSentAt | date:'hh:mm a, dd MMM' }}
            </div>
            <div class="report-pending" *ngIf="!p.reportSentAt && p.status === 'active'">
              <i class="fas fa-hourglass-half"></i>
              Report will be sent after deadline or when all students respond
            </div>
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
    .page-header { margin-bottom:1.5rem; }
    .page-header h1 { font-size:1.4rem; font-weight:700; color:#111827; margin:0 0 0.4rem; display:flex; align-items:center; gap:0.5rem; }
    .page-header p  { color:#6b7280; margin:0; font-size:0.875rem; }

    .loading-center { display:flex; flex-direction:column; align-items:center; gap:0.5rem; padding:3rem; color:#6b7280; }
    .spinner { width:24px; height:24px; border:3px solid #e5e7eb; border-top-color:#6d28d9; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .empty-card { text-align:center; padding:4rem 2rem; color:#6b7280; display:flex; flex-direction:column; align-items:center; gap:1rem; }
    .empty-card h3 { font-size:1rem; font-weight:600; margin:0; color:#111827; }
    .empty-card p  { margin:0; font-size:0.875rem; }
    .btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.6rem 1.25rem; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; border:none; text-decoration:none; }
    .btn-primary { background:#6d28d9; color:#fff; }

    .poll-list { display:flex; flex-direction:column; gap:1.25rem; }
    .poll-card { background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:1.25rem; }

    .poll-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.6rem; flex-wrap:wrap; gap:0.5rem; }
    .poll-title  { display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
    .subj-badge  { background:#ede9fe; color:#6d28d9; font-size:0.75rem; font-weight:600; padding:0.2rem 0.6rem; border-radius:6px; }
    .subj-name   { font-size:1rem; font-weight:600; color:#111827; }
    .period-tag  { font-size:0.75rem; color:#6b7280; background:#f9fafb; padding:0.2rem 0.5rem; border-radius:4px; border:1px solid #e5e7eb; }

    .status-badge { font-size:0.72rem; font-weight:600; padding:0.25rem 0.65rem; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px; }
    .status-active   { background:#d1fae5; color:#065f46; }
    .status-closed   { background:#fee2e2; color:#991b1b; }
    .status-reported { background:#ede9fe; color:#4c1d95; }

    .poll-question { font-size:0.875rem; color:#6b7280; font-style:italic; margin:0 0 0.75rem; }
    .meta-row { display:flex; gap:1.25rem; flex-wrap:wrap; margin-bottom:1rem; }
    .meta-row span { font-size:0.78rem; color:#6b7280; display:flex; align-items:center; gap:0.3rem; }

    .report-box { background:#f9fafb; border-radius:10px; padding:1rem 1.25rem; border:1px solid #e5e7eb; }
    .report-title { font-size:0.875rem; font-weight:600; color:#111827; margin-bottom:1rem; display:flex; align-items:center; gap:0.4rem; }

    .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:0.75rem; margin-bottom:1rem; }
    .stat { background:#fff; border-radius:8px; padding:0.75rem; text-align:center; border:1px solid #e5e7eb; display:flex; flex-direction:column; gap:0.15rem; }
    .stat-num  { font-size:1.5rem; font-weight:700; }
    .stat-label{ font-size:0.7rem; color:#6b7280; }
    .stat-pct  { font-size:0.72rem; font-weight:600; }
    .stat.yes .stat-num, .stat.yes .stat-pct   { color:#059669; }
    .stat.no  .stat-num, .stat.no  .stat-pct   { color:#dc2626; }
    .stat.pending .stat-num, .stat.pending .stat-pct { color:#d97706; }
    .stat.total .stat-num, .stat.total .stat-pct     { color:#6d28d9; }

    .bar-container { height:12px; border-radius:6px; overflow:hidden; background:#f3f4f6; display:flex; margin-bottom:1rem; }
    .bar-segment { height:100%; transition:width 0.5s; }
    .yes-bar  { background:#059669; }
    .no-bar   { background:#dc2626; }
    .pend-bar { background:#d97706; }

    .response-breakdown { margin-top:0.75rem; border-top:1px solid #e5e7eb; padding-top:0.75rem; }
    .breakdown-title { font-size:0.82rem; font-weight:600; color:#374151; margin-bottom:0.6rem; }
    .response-list { display:flex; flex-direction:column; gap:0.4rem; }
    .response-row { display:flex; align-items:center; justify-content:space-between; padding:0.4rem 0.75rem; background:#fff; border-radius:6px; border:1px solid #f3f4f6; flex-wrap:wrap; gap:0.4rem; }
    .student-name { font-size:0.82rem; font-weight:500; color:#111827; flex:1; }
    .response-answer { font-size:0.78rem; font-weight:600; }
    .ans-yes { color:#059669; }
    .ans-no  { color:#dc2626; }
    .response-time { font-size:0.72rem; color:#6b7280; }

    .report-sent    { font-size:0.78rem; color:#059669; display:flex; align-items:center; gap:0.4rem; font-weight:500; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid #e5e7eb; }
    .report-pending { font-size:0.78rem; color:#d97706; display:flex; align-items:center; gap:0.4rem; margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid #e5e7eb; }

    @media(max-width:600px) { .stats-row { grid-template-columns:repeat(2,1fr); } }
  `]
})
export class CrReportComponent implements OnInit {
  user: any;
  polls: any[]  = [];
  loading       = false;

  get initials(): string {
    return this.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CR';
  }

  getPct(count: number, total: number): number {
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }

  getPending(p: any): number {
    return Math.max(0, (p.totalStudents || 0) - (p.yesCount || 0) - (p.noCount || 0));
  }

  constructor(private auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.user = this.auth.currentUser;
    this.loadReports();
  }

  loadReports() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/polls`).subscribe({
      next: res => {
        this.polls = (res.polls || []).map((p: any) => ({
          ...p,
          totalStudents: res.totalStudents || 5,
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  logout() { this.auth.logout(); }
}
