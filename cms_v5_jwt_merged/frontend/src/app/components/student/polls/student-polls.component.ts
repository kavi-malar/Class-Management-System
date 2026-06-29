import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-student-polls',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-graduation-cap"></i> ClassMS</div>
      <div class="nav-links">
        <a routerLink="/student/dashboard"><i class="fas fa-home"></i> Dashboard</a>
        <a routerLink="/student/timetable"><i class="fas fa-calendar"></i> Timetable</a>
        <a routerLink="/student/notifications"><i class="fas fa-bell"></i> Notifications</a>
        <a routerLink="/student/polls" class="active"><i class="fas fa-poll"></i> Polls</a>
      </div>
      <div class="nav-user">
        <div class="user-avatar">{{ initials }}</div>
        <div class="user-info">
          <span class="user-name">{{ user?.name }}</span>
          <span class="user-role">Student</span>
        </div>
        <button class="btn-logout" (click)="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </nav>

    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-poll"></i> Attendance Polls</h1>
        <p>Respond to polls launched by your Class Representative.</p>
      </div>

      <div *ngIf="loading" class="loading-center">
        <div class="spinner"></div><p>Loading polls…</p>
      </div>

      <div *ngIf="!loading && polls.length === 0" class="empty-card">
        <i class="fas fa-poll" style="font-size:2.5rem;opacity:0.3"></i>
        <p>No active polls right now. Check back later!</p>
      </div>

      <div class="poll-cards" *ngIf="!loading && polls.length > 0">
        <div *ngFor="let p of polls" class="poll-card" [class.responded]="p.myAnswer">

          <div class="poll-card-header">
            <div class="poll-card-title">
              <span class="subject-badge">{{ p.subject?.code }}</span>
              <span class="subject-name">{{ p.subject?.name }}</span>
            </div>
            <span *ngIf="p.myAnswer" class="answered-badge">
              {{ p.myAnswer === 'yes' ? '✅ You said Yes' : '❌ You said No' }}
            </span>
          </div>

          <p class="poll-question">"{{ p.question }}"</p>

          <div class="poll-meta-row">
            <span><i class="fas fa-user-tie"></i> {{ p.teacher?.name }}</span>
            <span><i class="fas fa-calendar"></i> {{ p.pollDate | date:'dd MMM yyyy' }}</span>
            <span><i class="fas fa-clock"></i> Period {{ p.periodNumber }}</span>
          </div>

          <div class="deadline-row">
            <i class="fas fa-hourglass-half"></i>
            Poll closes at <strong>{{ p.deadline | date:'dd MMM, hh:mm a' }}</strong>
          </div>

          <!-- Response buttons -->
          <div class="response-section" *ngIf="!p.myAnswer">
            <p class="response-prompt">Will you attend this class?</p>
            <div class="response-btns">
              <button class="btn btn-yes" [disabled]="responding === p._id" (click)="respond(p, 'yes')">
                <i class="fas fa-check"></i> Yes, I'll attend
              </button>
              <button class="btn btn-no" [disabled]="responding === p._id" (click)="respond(p, 'no')">
                <i class="fas fa-times"></i> No, I can't
              </button>
            </div>
          </div>

          <!-- Already responded -->
          <div class="already-responded" *ngIf="p.myAnswer">
            <p>Your response: <strong>{{ p.myAnswer === 'yes' ? '✅ Yes, I will attend' : '❌ No, I cannot attend' }}</strong></p>
            <p class="change-note">Want to change? Tap a button below.</p>
            <div class="response-btns">
              <button class="btn btn-yes btn-sm" [disabled]="responding === p._id"
                      [class.active-btn]="p.myAnswer === 'yes'"
                      (click)="respond(p, 'yes')">
                <i class="fas fa-check"></i> Yes
              </button>
              <button class="btn btn-no btn-sm" [disabled]="responding === p._id"
                      [class.active-btn]="p.myAnswer === 'no'"
                      (click)="respond(p, 'no')">
                <i class="fas fa-times"></i> No
              </button>
            </div>
          </div>

          <!-- Live count -->
          <div class="live-count">
            <span class="yes-count">✅ {{ p.yesCount }} attending</span>
            <span class="no-count">❌ {{ p.noCount }} not attending</span>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .navbar { display:flex; align-items:center; gap:1.5rem; padding:0 2rem; height:60px; background:#fff; border-bottom:1px solid #e5e7eb; position:sticky; top:0; z-index:100; }
    .nav-brand { font-size:1.2rem; font-weight:700; color:#2563eb; display:flex; align-items:center; gap:0.5rem; margin-right:1rem; }
    .nav-links { display:flex; gap:0.25rem; flex:1; }
    .nav-links a { padding:0.4rem 0.85rem; border-radius:8px; font-size:0.875rem; color:#6b7280; text-decoration:none; display:flex; align-items:center; gap:0.4rem; }
    .nav-links a:hover, .nav-links a.active { background:#dbeafe; color:#2563eb; }
    .nav-user { display:flex; align-items:center; gap:0.75rem; margin-left:auto; }
    .user-avatar { width:36px; height:36px; border-radius:50%; background:#2563eb; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:600; font-size:0.85rem; }
    .user-info { display:flex; flex-direction:column; }
    .user-name { font-size:0.875rem; font-weight:600; color:#111827; }
    .user-role { font-size:0.75rem; color:#2563eb; font-weight:500; }
    .btn-logout { background:none; border:1px solid #e5e7eb; border-radius:8px; padding:0.35rem 0.75rem; font-size:0.8rem; color:#6b7280; cursor:pointer; display:flex; align-items:center; gap:0.4rem; }
    .btn-logout:hover { background:#fee2e2; color:#dc2626; border-color:#dc2626; }

    .page-container { max-width:700px; margin:0 auto; padding:2rem 1.5rem; }
    .page-header { margin-bottom:1.5rem; }
    .page-header h1 { font-size:1.4rem; font-weight:700; color:#111827; margin:0 0 0.4rem; display:flex; align-items:center; gap:0.5rem; }
    .page-header p { color:#6b7280; margin:0; font-size:0.875rem; }

    .loading-center { display:flex; flex-direction:column; align-items:center; gap:0.5rem; padding:3rem; color:#6b7280; }
    .spinner { width:24px; height:24px; border:3px solid #e5e7eb; border-top-color:#2563eb; border-radius:50%; animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .empty-card { text-align:center; padding:4rem 2rem; color:#6b7280; display:flex; flex-direction:column; align-items:center; gap:1rem; }

    .poll-cards { display:flex; flex-direction:column; gap:1rem; }
    .poll-card { background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:1.25rem; transition:border-color 0.2s; }
    .poll-card.responded { border-color:#6d28d9; }

    .poll-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem; }
    .poll-card-title  { display:flex; align-items:center; gap:0.6rem; }
    .subject-badge { background:#ede9fe; color:#6d28d9; font-size:0.75rem; font-weight:600; padding:0.2rem 0.6rem; border-radius:6px; }
    .subject-name  { font-size:1rem; font-weight:600; color:#111827; }
    .answered-badge { font-size:0.78rem; font-weight:600; background:#d1fae5; color:#065f46; padding:0.25rem 0.75rem; border-radius:20px; }

    .poll-question { font-size:0.9rem; color:#374151; font-style:italic; margin:0 0 0.75rem; }
    .poll-meta-row { display:flex; gap:1.25rem; flex-wrap:wrap; margin-bottom:0.75rem; }
    .poll-meta-row span { font-size:0.78rem; color:#6b7280; display:flex; align-items:center; gap:0.3rem; }
    .deadline-row { font-size:0.8rem; color:#d97706; margin-bottom:1rem; display:flex; align-items:center; gap:0.4rem; }

    .response-section { background:#f9fafb; border-radius:8px; padding:1rem; margin-bottom:0.75rem; }
    .response-prompt  { font-size:0.875rem; font-weight:500; color:#374151; margin:0 0 0.75rem; }
    .response-btns { display:flex; gap:0.75rem; }

    .btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.65rem 1.5rem; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; border:none; }
    .btn-yes { background:#059669; color:#fff; }
    .btn-yes:hover:not(:disabled) { background:#047857; }
    .btn-no  { background:#dc2626; color:#fff; }
    .btn-no:hover:not(:disabled)  { background:#b91c1c; }
    .btn:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-sm { padding:0.4rem 1rem; font-size:0.8rem; }
    .active-btn { ring:2px solid #111827; opacity:0.7; }

    .already-responded { background:#f9fafb; border-radius:8px; padding:1rem; margin-bottom:0.75rem; }
    .already-responded p { font-size:0.875rem; color:#374151; margin:0 0 0.5rem; }
    .change-note { font-size:0.78rem; color:#6b7280; }

    .live-count { display:flex; gap:1rem; padding-top:0.75rem; border-top:1px solid #f3f4f6; }
    .yes-count  { font-size:0.82rem; color:#059669; font-weight:600; }
    .no-count   { font-size:0.82rem; color:#dc2626; font-weight:600; }
  `]
})
export class StudentPollsComponent implements OnInit {
  user: any;
  polls: any[] = [];
  loading = false;
  responding: string | null = null;

  get initials(): string {
    return this.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'ST';
  }

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

  respond(p: any, answer: 'yes' | 'no') {
    this.responding = p._id;
    this.http.patch<any>(`${environment.apiUrl}/polls/${p._id}/respond`, { answer }).subscribe({
      next: () => {
        p.myAnswer = answer;
        if (answer === 'yes') { p.yesCount++; if (p.noCount > 0 && p.myAnswer === 'no') p.noCount--; }
        else                  { p.noCount++;  if (p.yesCount > 0 && p.myAnswer === 'yes') p.yesCount--; }
        this.responding = null;
        this.loadPolls(); // refresh to get accurate counts
      },
      error: err => {
        alert(err.error?.message || 'Failed to respond.');
        this.responding = null;
      }
    });
  }

  logout() { this.auth.logout(); }
}
