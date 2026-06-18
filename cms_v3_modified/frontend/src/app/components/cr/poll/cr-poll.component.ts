import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';
import { environment } from '../../../../environments/environment';

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-cr-poll',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-chalkboard-teacher"></i> ClassMS</div>
      <div class="nav-links">
        <a routerLink="/cr/dashboard"><i class="fas fa-home"></i> Dashboard</a>
        <a routerLink="/cr/poll" class="active"><i class="fas fa-poll"></i> Launch Poll</a>
        <a routerLink="/cr/polls"><i class="fas fa-list"></i> My Polls</a>
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
        <h1><i class="fas fa-poll"></i> Launch Attendance Poll</h1>
        <p>Create a poll to check how many students will attend a particular class. Students will be notified on the app and via WhatsApp.</p>
      </div>

      <div class="alert alert-success" *ngIf="successMsg">
        <i class="fas fa-check-circle"></i> {{ successMsg }}
      </div>
      <div class="alert alert-error" *ngIf="errorMsg">
        <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
      </div>

      <div class="layout">
        <div class="form-card card">
          <h2>Poll Details</h2>

          <div class="form-group">
            <label><i class="fas fa-book"></i> Subject *</label>
            <select class="form-control" [(ngModel)]="form.subjectId" (change)="onSubjectChange()">
              <option value="">— Select Subject —</option>
              <option *ngFor="let s of subjects" [value]="s._id">{{ s.name }} ({{ s.code }})</option>
            </select>
          </div>

          <div class="form-group">
            <label><i class="fas fa-user-tie"></i> Teacher *</label>
            <select class="form-control" [(ngModel)]="form.teacherId">
              <option value="">— Select Teacher —</option>
              <option *ngFor="let t of filteredTeachers" [value]="t._id">{{ t.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label><i class="fas fa-calendar"></i> Class Date *</label>
            <input type="date" class="form-control" [(ngModel)]="form.pollDate" [min]="minDate" />
          </div>

          <div class="form-group">
            <label><i class="fas fa-clock"></i> Period Number *</label>
            <select class="form-control" [(ngModel)]="form.periodNumber">
              <option value="">— Select Period —</option>
              <option *ngFor="let p of periods" [value]="p.num">P{{ p.num }} ({{ p.time }})</option>
            </select>
          </div>

          <div class="form-group">
            <label><i class="fas fa-question-circle"></i> Poll Question *</label>
            <input type="text" class="form-control"
                   [(ngModel)]="form.question"
                   placeholder="e.g. Will you attend the Mathematics class tomorrow?" />
            <span class="hint">Students will see this question and tap Yes or No.</span>
          </div>

          <div class="form-group">
            <label><i class="fas fa-hourglass-half"></i> Poll Deadline *</label>
            <select class="form-control" [(ngModel)]="form.deadlineMinutes">
              <option value="30">30 minutes</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="180">3 hours</option>
              <option value="360">6 hours</option>
              <option value="720">12 hours</option>
            </select>
            <span class="hint">Poll auto-closes after this time and report is sent to teacher and CR.</span>
          </div>

          <div class="form-actions">
            <button class="btn btn-primary" [disabled]="submitting || !isValid" (click)="submit()">
              <i class="fas" [class.fa-paper-plane]="!submitting" [class.fa-circle-notch]="submitting" [class.fa-spin]="submitting"></i>
              {{ submitting ? 'Launching...' : 'Launch Poll' }}
            </button>
            <a routerLink="/cr/polls" class="btn btn-secondary">View My Polls</a>
          </div>
        </div>

        <div class="preview-card card">
          <h3><i class="fas fa-mobile-alt"></i> WhatsApp Preview</h3>
          <p class="preview-note">Students will receive this message:</p>
          <div class="whatsapp-bubble">
            <pre>{{ preview }}</pre>
          </div>
          <div class="rules">
            <h4>How it works</h4>
            <div class="rule"><span class="dot purple"></span> CR launches a poll with a deadline</div>
            <div class="rule"><span class="dot blue"></span> All students get WhatsApp notification</div>
            <div class="rule"><span class="dot green"></span> Students respond Yes/No on the app</div>
            <div class="rule"><span class="dot orange"></span> After deadline, report is sent to teacher and CR via WhatsApp</div>
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

    .page-container { max-width:1000px; margin:0 auto; padding:2rem 1.5rem; }
    .page-header { margin-bottom:1.5rem; }
    .page-header h1 { font-size:1.4rem; font-weight:700; color:#111827; margin:0 0 0.5rem; display:flex; align-items:center; gap:0.5rem; }
    .page-header p { color:#6b7280; margin:0; font-size:0.9rem; }

    .alert { padding:0.85rem 1rem; border-radius:8px; margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; }
    .alert-success { background:#d1fae5; color:#065f46; }
    .alert-error   { background:#fee2e2; color:#991b1b; }

    .layout { display:grid; grid-template-columns:1fr 340px; gap:1.5rem; align-items:start; }
    .card { background:#fff; border-radius:12px; border:1px solid #e5e7eb; padding:1.5rem; }
    .form-card h2 { font-size:1.05rem; font-weight:600; margin:0 0 1.25rem; color:#111827; }

    .form-group { margin-bottom:1.1rem; }
    .form-group label { display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; font-weight:500; color:#374151; margin-bottom:0.4rem; }
    .form-control { width:100%; padding:0.55rem 0.85rem; border:1px solid #d1d5db; border-radius:8px; font-size:0.875rem; color:#111827; background:#fff; box-sizing:border-box; }
    .form-control:focus { outline:none; border-color:#6d28d9; box-shadow:0 0 0 3px rgba(109,40,217,0.1); }
    .hint { font-size:0.75rem; color:#6b7280; margin-top:0.3rem; display:block; }

    .form-actions { display:flex; gap:0.75rem; margin-top:1.5rem; }
    .btn { display:inline-flex; align-items:center; gap:0.5rem; padding:0.6rem 1.25rem; border-radius:8px; font-size:0.875rem; font-weight:600; cursor:pointer; border:none; text-decoration:none; }
    .btn-primary { background:#6d28d9; color:#fff; }
    .btn-primary:hover:not(:disabled) { background:#5b21b6; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .btn-secondary { background:#f3f4f6; color:#374151; }
    .btn-secondary:hover { background:#e5e7eb; }

    .preview-card h3 { font-size:0.95rem; font-weight:600; margin:0 0 0.25rem; display:flex; align-items:center; gap:0.5rem; }
    .preview-note { font-size:0.8rem; color:#6b7280; margin:0 0 0.75rem; }
    .whatsapp-bubble { background:#dcf8c6; border-radius:8px; padding:0.85rem 1rem; margin-bottom:1.25rem; }
    .whatsapp-bubble pre { white-space:pre-wrap; font-family:inherit; font-size:0.8rem; color:#1a3c1a; margin:0; line-height:1.6; }

    .rules h4 { font-size:0.85rem; font-weight:600; color:#374151; margin:0 0 0.75rem; }
    .rule { display:flex; align-items:center; gap:0.6rem; font-size:0.8rem; color:#6b7280; margin-bottom:0.5rem; }
    .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .dot.purple { background:#6d28d9; }
    .dot.blue   { background:#2563eb; }
    .dot.green  { background:#059669; }
    .dot.orange { background:#d97706; }

    @media(max-width:800px) { .layout { grid-template-columns:1fr; } }
  `]
})
export class CrPollComponent implements OnInit {
  user: any;
  subjects: any[]  = [];
  teachers: any[]  = [];
  filteredTeachers: any[] = [];
  submitting = false;
  successMsg = '';
  errorMsg   = '';
  minDate    = '';

  periods = [
    { num: 1, time: '09:00–09:45' }, { num: 2, time: '09:45–10:30' },
    { num: 3, time: '10:45–11:30' }, { num: 4, time: '11:30–12:15' },
    { num: 5, time: '13:00–13:45' }, { num: 6, time: '13:45–14:30' },
    { num: 7, time: '14:30–15:15' }, { num: 8, time: '15:15–16:00' },
  ];

  form = {
    subjectId: '', teacherId: '', pollDate: '',
    periodNumber: '', question: '', deadlineMinutes: '60'
  };

  get initials(): string {
    return this.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CR';
  }

  get isValid(): boolean {
    return !!(this.form.subjectId && this.form.teacherId && this.form.pollDate &&
              this.form.periodNumber && this.form.question.trim() && this.form.deadlineMinutes);
  }

  get preview(): string {
    const subj = this.subjects.find(s => s._id === this.form.subjectId);
    const date = this.form.pollDate || 'Selected Date';
    const mins = Number(this.form.deadlineMinutes);
    const deadlineLabel = mins < 60 ? `${mins} mins` : `${mins/60} hour(s)`;
    return (
      `📋 ATTENDANCE POLL\n` +
      `${this.form.question || 'Your question here...'}\n` +
      `Subject: ${subj?.name || 'Subject'} — Period ${this.form.periodNumber || 'N'} on ${date}\n` +
      `Please respond on the Class Management app within ${deadlineLabel}.\n` +
      `- Class Management System`
    );
  }

  constructor(private auth: AuthService, private http: HttpClient, private router: Router) {}

  ngOnInit() {
    this.user    = this.auth.currentUser;
    this.minDate = toLocalISO(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    this.form.pollDate = toLocalISO(tomorrow);
    this.loadFormData();
  }

  loadFormData() {
    this.http.get<any>(`${environment.apiUrl}/polls/form-data`).subscribe({
      next: res => {
        this.subjects = res.subjects || [];
        this.teachers = res.teachers || [];
        this.filteredTeachers = this.teachers;
      },
      error: err => {
        this.errorMsg = 'Failed to load subjects: ' + (err.error?.message || err.message || 'Server error');
      }
    });
  }

  onSubjectChange() {
    if (!this.form.subjectId) {
      this.filteredTeachers = this.teachers;
      return;
    }
    this.filteredTeachers = this.teachers.filter(
      t => t.assignedSubject?._id === this.form.subjectId
    );
    if (this.filteredTeachers.length === 1) {
      this.form.teacherId = this.filteredTeachers[0]._id;
    } else {
      this.form.teacherId = '';
    }
    // Auto-fill question
    const subj = this.subjects.find(s => s._id === this.form.subjectId);
    if (subj && !this.form.question) {
      this.form.question = `Will you attend the ${subj.name} class?`;
    }
  }

  submit() {
    this.successMsg = ''; this.errorMsg = '';
    this.submitting = true;
    this.http.post<any>(`${environment.apiUrl}/polls`, {
      subjectId:       this.form.subjectId,
      teacherId:       this.form.teacherId,
      pollDate:        this.form.pollDate,
      periodNumber:    Number(this.form.periodNumber),
      question:        this.form.question,
      deadlineMinutes: Number(this.form.deadlineMinutes),
    }).subscribe({
      next: res => {
        this.submitting = false;
        this.successMsg = 'Poll launched! Students notified via WhatsApp.';
        setTimeout(() => this.router.navigate(['/cr/polls']), 1500);
      },
      error: err => {
        this.submitting = false;
        this.errorMsg = err.error?.message || 'Failed to launch poll.';
      }
    });
  }

  logout() { this.auth.logout(); }
}
