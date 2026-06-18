import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TimetableService } from '../../services/timetable.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-page">
      <div class="login-brand">
        <div class="brand-content">
          <div class="brand-icon"><i class="fas fa-school"></i></div>
          <h1>Class Management System</h1>
          <p>Integrated timetable, room allocation and projector management with live SMS alerts.</p>
          <div class="feature-list">
            <div class="feature"><i class="fas fa-check-circle"></i> Multi-class timetable management</div>
            <div class="feature"><i class="fas fa-check-circle"></i> Live room allocation board (101–130)</div>
            <div class="feature"><i class="fas fa-check-circle"></i> Projector inventory tracking</div>
            <div class="feature"><i class="fas fa-check-circle"></i> Admin monitoring dashboard</div>
            <div class="feature"><i class="fas fa-check-circle"></i> Real-time SMS notifications</div>
          </div>
          <div class="role-pills">
            <span class="role-pill pill-admin"><i class="fas fa-shield-alt"></i> Admin</span>
            <span class="role-pill pill-teacher"><i class="fas fa-chalkboard-teacher"></i> Teacher</span>
            <span class="role-pill pill-cr"><i class="fas fa-user-tie"></i> CR</span>
            <span class="role-pill pill-student"><i class="fas fa-user-graduate"></i> Student</span>
          </div>
        </div>
      </div>

      <div class="login-form-panel">
        <div class="login-card">
          <div class="login-header">
            <h2>Welcome Back</h2>
            <p>Sign in to access your portal</p>
          </div>

          <!-- Quick fill buttons -->
          <div class="demo-creds">
            <div class="demo-title"><i class="fas fa-bolt"></i> Quick Login</div>
            <div class="demo-grid">
              <button class="demo-btn demo-admin"   (click)="fill('admin@school.edu','admin123')">
                <i class="fas fa-shield-alt"></i> Admin
              </button>
              <button class="demo-btn demo-teacher" (click)="fill('arjun@school.edu','teacher123')">
                <i class="fas fa-chalkboard-teacher"></i> Teacher
              </button>
              <button class="demo-btn demo-cr"      (click)="fill('cr.csea@student.edu','cr123456')">
                <i class="fas fa-user-tie"></i> CR (CSE-A)
              </button>
              <button class="demo-btn demo-student" (click)="fill('rahul@student.edu','student123')">
                <i class="fas fa-user-graduate"></i> Student
              </button>
            </div>
          </div>

          <div class="alert alert-error" *ngIf="errorMsg">
            <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
          </div>

          <div class="form-group">
            <label for="email"><i class="fas fa-envelope"></i> Email Address</label>
            <input id="email" type="email" name="email" class="form-control"
                   [(ngModel)]="email" placeholder="Enter your email" />
          </div>

          <div class="form-group">
            <label for="password"><i class="fas fa-lock"></i> Password</label>
            <div class="password-wrapper">
              <input id="password" [type]="showPwd ? 'text' : 'password'" name="password"
                     class="form-control" [(ngModel)]="password" placeholder="Enter your password" />
              <button type="button" class="pwd-toggle" (click)="showPwd = !showPwd">
                <i class="fas" [class.fa-eye]="!showPwd" [class.fa-eye-slash]="showPwd"></i>
              </button>
            </div>
          </div>

          <button class="btn btn-primary login-submit" [disabled]="loading || !email || !password" (click)="onLogin()">
            <span *ngIf="loading"><i class="fas fa-circle-notch fa-spin"></i> Signing in...</span>
            <span *ngIf="!loading"><i class="fas fa-sign-in-alt"></i> Sign In</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Teacher class selector overlay -->
    <div class="modal-overlay" *ngIf="showClassPicker">
      <div class="modal-card">
        <h3><i class="fas fa-chalkboard-teacher"></i> Select Class</h3>
        <p>You teach multiple classes. Which class timetable would you like to view?</p>
        <div class="class-list">
          <button class="class-btn" *ngFor="let cls of teacherClasses" (click)="selectTeacherClass(cls)">
            <i class="fas fa-users"></i> {{ cls }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .login-page { min-height:100vh; display:flex; }
    .login-brand { flex:1; background:linear-gradient(135deg,#4f46e5 0%,#1e1b4b 100%);
                   display:flex; align-items:center; justify-content:center; padding:3rem; }
    .brand-content { color:#fff; max-width:420px; }
    .brand-icon { width:80px; height:80px; background:rgba(255,255,255,.15); border-radius:20px;
                  display:flex; align-items:center; justify-content:center; font-size:2.5rem;
                  margin-bottom:1.5rem; }
    .brand-content h1 { font-size:2rem; font-weight:800; margin-bottom:1rem; }
    .brand-content p  { font-size:1rem; opacity:.85; margin-bottom:1.75rem; line-height:1.7; }
    .feature-list { display:flex; flex-direction:column; gap:0.65rem; margin-bottom:1.75rem; }
    .feature { display:flex; align-items:center; gap:0.75rem; font-size:0.88rem; opacity:.9; }
    .feature i { color:#a5f3fc; }
    .role-pills { display:flex; gap:0.5rem; flex-wrap:wrap; }
    .role-pill { padding:0.3rem 0.75rem; border-radius:20px; font-size:0.75rem; font-weight:600;
                 display:flex; align-items:center; gap:0.3rem; }
    .pill-admin   { background:#fef3c7; color:#92400e; }
    .pill-teacher { background:#dbeafe; color:#1d4ed8; }
    .pill-cr      { background:#ede9fe; color:#5b21b6; }
    .pill-student { background:#d1fae5; color:#065f46; }

    .login-form-panel { width:480px; display:flex; align-items:center; justify-content:center;
                        padding:2rem; background:#f8fafc; }
    .login-card { width:100%; max-width:420px; }
    .login-header { margin-bottom:1.5rem; }
    .login-header h2 { font-size:1.75rem; font-weight:700; color:#1e293b; }
    .login-header p  { color:#64748b; margin-top:0.3rem; }

    .demo-creds { background:#fff; border:1px solid #e2e8f0; border-radius:10px;
                  padding:0.9rem; margin-bottom:1.5rem; }
    .demo-title { font-size:0.78rem; font-weight:700; color:#64748b; margin-bottom:0.65rem;
                  display:flex; align-items:center; gap:0.35rem; }
    .demo-grid  { display:grid; grid-template-columns:1fr 1fr; gap:0.4rem; }
    .demo-btn   { padding:0.45rem 0.5rem; border:1px solid #e2e8f0; background:#f8fafc;
                  border-radius:8px; font-size:0.78rem; font-weight:600; cursor:pointer;
                  display:flex; align-items:center; justify-content:center; gap:0.35rem;
                  transition:all .2s; }
    .demo-admin:hover   { background:#fef3c7; border-color:#fcd34d; color:#92400e; }
    .demo-teacher:hover { background:#dbeafe; border-color:#93c5fd; color:#1d4ed8; }
    .demo-cr:hover      { background:#ede9fe; border-color:#c4b5fd; color:#5b21b6; }
    .demo-student:hover { background:#d1fae5; border-color:#6ee7b7; color:#065f46; }

    .alert-error { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;
                   border-radius:8px; padding:0.65rem 0.85rem; margin-bottom:1rem;
                   display:flex; align-items:center; gap:0.5rem; font-size:0.875rem; }
    .form-group { margin-bottom:1rem; }
    .form-group label { display:flex; align-items:center; gap:0.4rem; font-size:0.85rem;
                        font-weight:600; color:#374151; margin-bottom:0.4rem; }
    .form-control { width:100%; border:1.5px solid #e2e8f0; border-radius:8px;
                    padding:0.6rem 0.85rem; font-size:0.9rem; outline:none; font-family:inherit;
                    background:#fff; box-sizing:border-box; transition:border-color .2s; }
    .form-control:focus { border-color:#4f46e5; }
    .password-wrapper { position:relative; }
    .password-wrapper .form-control { padding-right:2.75rem; }
    .pwd-toggle { position:absolute; right:0.75rem; top:50%; transform:translateY(-50%);
                  background:none; border:none; cursor:pointer; color:#64748b; }
    .btn { display:flex; align-items:center; gap:0.4rem; border:none; border-radius:8px;
           font-size:0.9rem; font-weight:600; cursor:pointer; transition:all .2s; }
    .btn-primary { background:#4f46e5; color:#fff; padding:0.75rem 1.5rem; }
    .btn-primary:hover { background:#4338ca; }
    .btn-primary:disabled { opacity:0.5; cursor:not-allowed; }
    .login-submit { width:100%; justify-content:center; font-size:1rem; }
    @media (max-width:768px) { .login-brand{display:none;} .login-form-panel{width:100%;} }

    /* Teacher class-picker overlay */
    .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:500;
                     display:flex; align-items:center; justify-content:center; }
    .modal-card { background:#fff; border-radius:16px; padding:2rem; width:360px; max-width:90vw;
                  box-shadow:0 20px 60px rgba(0,0,0,.25); animation:popIn .25s ease; }
    @keyframes popIn { from{transform:scale(.92);opacity:0} to{transform:scale(1);opacity:1} }
    .modal-card h3 { font-size:1.15rem; font-weight:800; color:#1e293b; margin-bottom:0.4rem;
                     display:flex; align-items:center; gap:0.5rem; }
    .modal-card p  { color:#64748b; font-size:0.875rem; margin-bottom:1.25rem; }
    .class-list { display:flex; flex-direction:column; gap:0.6rem; }
    .class-btn { padding:0.8rem 1.1rem; border:2px solid #e2e8f0; border-radius:10px;
                 background:#f8fafc; text-align:left; cursor:pointer; font-size:0.95rem;
                 font-weight:600; color:#1e293b; transition:all .18s;
                 display:flex; align-items:center; gap:0.6rem; }
    .class-btn:hover { border-color:#4f46e5; background:#ede9fe; color:#4f46e5; }
    .class-btn i { color:#4f46e5; width:18px; text-align:center; }
  `]
})
export class LoginComponent {
  email    = '';
  password = '';
  loading  = false;
  errorMsg = '';
  showPwd  = false;

  // Teacher class-picker modal
  showClassPicker = false;
  teacherClasses: string[] = [];

  constructor(
    private authService: AuthService,
    private timetableService: TimetableService,
    private router: Router
  ) {}

  fill(email: string, pwd: string): void { this.email = email; this.password = pwd; }

  onLogin(): void {
    this.errorMsg = ''; this.loading = true;
    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        const role      = res.user.role;
        const className = res.user.className;

        if (role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else if (role === 'teacher') {
          // Fetch the distinct classes this teacher teaches
          this.timetableService.getTeacherClasses().subscribe({
            next: (r: any) => {
              const classes: string[] = r.classes || [];
              if (classes.length <= 1) {
                // Only one (or zero) class — go straight to timetable
                const nav: any[] = ['/teacher/timetable'];
                const extras = classes.length === 1 ? { queryParams: { className: classes[0] } } : {};
                this.router.navigate(nav, extras);
              } else {
                // Multiple classes — show picker modal
                this.teacherClasses = classes;
                this.showClassPicker = true;
              }
            },
            error: () => this.router.navigate(['/teacher/dashboard'])
          });
        } else if (role === 'cr') {
          // CR → their own class timetable
          this.router.navigate(['/cr/timetable']);
        } else {
          // student → their class timetable
          this.router.navigate(['/student/timetable']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.message || 'Login failed. Please check your credentials.';
      }
    });
  }

  selectTeacherClass(className: string): void {
    this.showClassPicker = false;
    this.router.navigate(['/teacher/timetable'], { queryParams: { className } });
  }
}
