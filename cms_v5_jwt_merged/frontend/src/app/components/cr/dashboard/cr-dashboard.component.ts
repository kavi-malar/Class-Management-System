import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-cr-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand">
        <i class="fas fa-chalkboard-teacher"></i> ClassMS
      </div>
      <div class="nav-links">
        <a routerLink="/cr/dashboard" routerLinkActive="active">
          <i class="fas fa-home"></i> Dashboard
        </a>
        <a routerLink="/cr/timetable" routerLinkActive="active">
          <i class="fas fa-calendar-alt"></i> Timetable
        </a>
        <a routerLink="/cr/poll" routerLinkActive="active">
          <i class="fas fa-poll"></i> Launch Poll
        </a>
        <a routerLink="/cr/polls" routerLinkActive="active">
          <i class="fas fa-list"></i> My Polls
        </a>
      </div>
      <div class="nav-user">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-info">
          <span class="user-name">{{ user?.name }}</span>
          <span class="user-role">Class Representative</span>
        </div>
        <button class="btn-logout" (click)="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </nav>

    <main class="page-container">
      <div class="welcome-card">
        <div class="welcome-left">
          <h1>Welcome, {{ user?.name }}! 👋</h1>
          <p>You are the Class Representative for <strong>{{ user?.className }}</strong>.</p>
          <p>Use the poll system to check student attendance strength before a class.</p>
        </div>
        <div class="welcome-right">
          <a routerLink="/cr/poll" class="btn btn-primary">
            <i class="fas fa-plus-circle"></i> Launch New Poll
          </a>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon blue"><i class="fas fa-poll"></i></div>
          <div class="stat-info">
            <span class="stat-num">{{ totalPolls }}</span>
            <span class="stat-label">Total Polls</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon green"><i class="fas fa-check-circle"></i></div>
          <div class="stat-info">
            <span class="stat-num">{{ activePolls }}</span>
            <span class="stat-label">Active Polls</span>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon purple"><i class="fas fa-file-alt"></i></div>
          <div class="stat-info">
            <span class="stat-num">{{ reportedPolls }}</span>
            <span class="stat-label">Reports Sent</span>
          </div>
        </div>
      </div>

      <div class="recent-section">
        <div class="section-header">
          <h2><i class="fas fa-clock"></i> Recent Polls</h2>
          <a routerLink="/cr/polls" class="view-all">View all →</a>
        </div>

        <div *ngIf="loading" class="loading-center">
          <div class="spinner"></div><p>Loading polls…</p>
        </div>

        <div *ngIf="!loading && polls.length === 0" class="empty-card">
          <i class="fas fa-poll" style="font-size:2.5rem;opacity:0.3"></i>
          <p>No polls yet. Launch your first poll!</p>
          <a routerLink="/cr/poll" class="btn btn-primary">Launch Poll</a>
        </div>

        <div class="poll-list" *ngIf="!loading && polls.length > 0">
          <div *ngFor="let p of polls.slice(0,5)" class="poll-row">
            <div class="poll-left">
              <span class="poll-badge" [class]="'badge-' + p.status">{{ p.status }}</span>
              <div class="poll-info">
                <span class="poll-subject">{{ p.subject?.name }}</span>
                <span class="poll-meta">Teacher: {{ p.teacher?.name }} &bull; Period {{ p.periodNumber }} &bull; {{ p.pollDate | date:'dd MMM yyyy' }}</span>
              </div>
            </div>
            <div class="poll-right">
              <span class="poll-count yes">✅ {{ p.yesCount }}</span>
              <span class="poll-count no">❌ {{ p.noCount }}</span>
              <span class="deadline" *ngIf="p.status === 'active'">
                Closes: {{ p.deadline | date:'hh:mm a' }}
              </span>
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
    .nav-links a { padding:0.4rem 0.85rem; border-radius:8px; font-size:0.875rem; color:#6b7280; text-decoration:none; display:flex; align-items:center; gap:0.4rem; transition:all 0.15s; }
    .nav-links a:hover, .nav-links a.active { background:#f3e8ff; color:#6d28d9; }
    .nav-user { display:flex; align-items:center; gap:0.75rem; margin-left:auto; }
    .user-avatar { width:36px; height:36px; border-radius:50%; background:#6d28d9; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:0.85rem; }
    .user-info { display:flex; flex-direction:column; }
    .user-name { font-size:0.875rem; font-weight:600; color:#111827; }
    .user-role { font-size:0.75rem; color:#6d28d9; font-weight:500; }
    .btn-logout { background:none; border:1px solid #e5e7eb; border-radius:8px; padding:0.35rem 0.75rem; font-size:0.8rem; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:0.4rem; }
    .btn-logout:hover { background:#fee2e2; color:#dc2626; border-color:#dc2626; }

    .page-container { max-width:1000px; margin:0 auto; padding:2rem 1.5rem; }

    .welcome-card { background:linear-gradient(135deg,#6d28d9,#8b5cf6); border-radius:16px; padding:2rem; display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; color:#fff; }
    .welcome-card h1 { font-size:1.4rem; font-weight:700; margin:0 0 0.5rem; }
    .welcome-card p { margin:0 0 0.25rem; opacity:0.9; font-size:0.9rem; }

    .btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.6rem 1.25rem; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; text-decoration:none; border:none; }
    .btn-primary { background:#fff; color:#6d28d9; }
    .btn-primary:hover { background:#f3e8ff; }

    .stats-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:1.5rem; }
    .stat-card { background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:1.25rem; display:flex; align-items:center; gap:1rem; }
    .stat-icon { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.25rem; flex-shrink:0; }
    .stat-icon.blue   { background:#dbeafe; color:#2563eb; }
    .stat-icon.green  { background:#d1fae5; color:#059669; }
    .stat-icon.purple { background:#ede9fe; color:#6d28d9; }
    .stat-num   { font-size:1.75rem; font-weight:700; color:#111827; }
    .stat-label { font-size:0.8rem; color:#6b7280; }
    .stat-info  { display:flex; flex-direction:column; }

    .recent-section { background:#fff; border-radius:12px; border:1px solid #e5e7eb; overflow:hidden; }
    .section-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 1.25rem; border-bottom:1px solid #e5e7eb; }
    .section-header h2 { font-size:1rem; font-weight:600; margin:0; display:flex; align-items:center; gap:0.5rem; }
    .view-all { font-size:0.85rem; color:#6d28d9; text-decoration:none; }

    .loading-center { display:flex; flex-direction:column; align-items:center; gap:0.5rem; padding:2rem; color:#6b7280; }
    .spinner { width:24px; height:24px; border:3px solid #e5e7eb; border-top-color:#6d28d9; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    .empty-card { text-align:center; padding:3rem 2rem; color:#6b7280; display:flex; flex-direction:column; align-items:center; gap:1rem; }

    .poll-list { display:flex; flex-direction:column; }
    .poll-row { display:flex; align-items:center; justify-content:space-between; padding:0.85rem 1.25rem; border-bottom:1px solid #f3f4f6; gap:1rem; }
    .poll-row:last-child { border-bottom:none; }
    .poll-row:hover { background:#fafafa; }
    .poll-left { display:flex; align-items:center; gap:0.75rem; }
    .poll-badge { font-size:0.7rem; font-weight:600; padding:0.2rem 0.6rem; border-radius:20px; text-transform:uppercase; letter-spacing:0.5px; }
    .badge-active   { background:#d1fae5; color:#065f46; }
    .badge-closed   { background:#fee2e2; color:#991b1b; }
    .badge-reported { background:#ede9fe; color:#4c1d95; }
    .poll-subject { font-size:0.9rem; font-weight:600; color:#111827; display:block; }
    .poll-meta    { font-size:0.75rem; color:#6b7280; }
    .poll-right   { display:flex; align-items:center; gap:0.75rem; }
    .poll-count   { font-size:0.85rem; font-weight:600; }
    .poll-count.yes { color:#059669; }
    .poll-count.no  { color:#dc2626; }
    .deadline { font-size:0.75rem; color:#d97706; }
  `]
})
export class CrDashboardComponent implements OnInit {
  user: any;
  polls: any[] = [];
  loading = false;

  get initials(): string {
    return this.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CR';
  }
  get totalPolls()    { return this.polls.length; }
  get activePolls()   { return this.polls.filter(p => p.status === 'active').length; }
  get reportedPolls() { return this.polls.filter(p => p.status === 'reported').length; }

  constructor(private auth: AuthService, private http: HttpClient) {}

  ngOnInit() {
    this.user = this.auth.currentUser;
    this.loadPolls();
  }

  loadPolls() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/polls`).subscribe({
      next: res => { this.polls = res.polls || []; this.loading = false; },
      error: ()  => { this.loading = false; }
    });
  }

  logout() { this.auth.logout(); }
}
