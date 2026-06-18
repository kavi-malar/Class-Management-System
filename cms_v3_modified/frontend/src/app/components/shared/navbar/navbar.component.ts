import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { User } from '../../../models';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-school"></i><span>ClassMS</span></div>

      <div class="nav-links">
        <!-- Teacher links -->
        <ng-container *ngIf="isTeacher">
          <a routerLink="/teacher/dashboard"        routerLinkActive="active"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
          <a routerLink="/teacher/timetable"        routerLinkActive="active"><i class="fas fa-calendar-alt"></i> Timetable</a>
          <a routerLink="/teacher/rooms"            routerLinkActive="active"><i class="fas fa-building"></i> Rooms</a>
          <a routerLink="/teacher/mark-unavailable" routerLinkActive="active"><i class="fas fa-calendar-times"></i> Cancel Period</a>
          <a routerLink="/teacher/mark-available"   routerLinkActive="active"><i class="fas fa-calendar-plus"></i> Free Period</a>
          <a routerLink="/teacher/changes"          routerLinkActive="active"><i class="fas fa-history"></i> My Changes</a>
          <a routerLink="/teacher/polls"            routerLinkActive="active"><i class="fas fa-chart-bar"></i> Poll Reports</a>
        </ng-container>

        <!-- Student links -->
        <ng-container *ngIf="isStudent">
          <a routerLink="/student/dashboard"     routerLinkActive="active"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
          <a routerLink="/student/timetable"     routerLinkActive="active"><i class="fas fa-calendar-alt"></i> Timetable</a>
          <a routerLink="/student/rooms"         routerLinkActive="active"><i class="fas fa-building"></i> Rooms</a>
          <a routerLink="/student/notifications" routerLinkActive="active"><i class="fas fa-bell"></i> Notifications</a>
          <a routerLink="/student/polls"         routerLinkActive="active"><i class="fas fa-poll"></i> Polls</a>
        </ng-container>
      </div>

      <div class="nav-user">
        <div class="user-info">
          <div class="avatar">{{ initial }}</div>
          <div class="user-details">
            <span class="user-name">{{ user?.name }}</span>
            <span class="role-tag" [class.role-teacher]="isTeacher" [class.role-student]="isStudent">
              {{ user?.role | titlecase }}
            </span>
          </div>
        </div>
        <button class="btn-logout" (click)="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .navbar { display:flex; align-items:center; justify-content:space-between; background:var(--surface); padding:0 1.5rem; height:62px; box-shadow:var(--shadow); position:sticky; top:0; z-index:100; border-bottom:3px solid var(--primary); gap:1rem; }
    .nav-brand { display:flex; align-items:center; gap:0.5rem; font-size:1.2rem; font-weight:800; color:var(--primary); white-space:nowrap; }
    .nav-links { display:flex; align-items:center; gap:0.2rem; flex:1; justify-content:center; flex-wrap:wrap; }
    .nav-links a { display:flex; align-items:center; gap:0.35rem; padding:0.45rem 0.8rem; border-radius:var(--radius-sm); text-decoration:none; color:var(--text-muted); font-size:0.82rem; font-weight:500; transition:all .2s; white-space:nowrap; }
    .nav-links a:hover,.nav-links a.active { background:#ede9fe; color:var(--primary); }
    .nav-user { display:flex; align-items:center; gap:0.75rem; }
    .user-info { display:flex; align-items:center; gap:0.6rem; }
    .avatar { width:34px; height:34px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.9rem; }
    .user-details { display:flex; flex-direction:column; }
    .user-name { font-size:0.82rem; font-weight:600; color:var(--text); }
    .role-tag { font-size:0.68rem; font-weight:700; padding:0.1rem 0.4rem; border-radius:4px; text-transform:uppercase; }
    .role-teacher { background:#dbeafe; color:#1d4ed8; }
    .role-student { background:#d1fae5; color:#065f46; }
    .btn-logout { background:#f1f5f9; border:1px solid #e2e8f0; color:#475569; cursor:pointer; padding:0.4rem 0.8rem; border-radius:6px; font-size:0.82rem; display:flex; align-items:center; gap:0.35rem; transition:all .2s; font-family:inherit; }
    .btn-logout:hover { background:#fee2e2; color:#991b1b; border-color:#fca5a5; }
  `]
})
export class NavbarComponent implements OnInit {
  user: User | null = null;
  get isTeacher(): boolean { return this.user?.role === 'teacher'; }
  get isStudent(): boolean { return this.user?.role === 'student'; }
  get initial():  string   { return (this.user?.name || 'U')[0].toUpperCase(); }

  constructor(private authService: AuthService) {}
  ngOnInit(): void { this.user = this.authService.currentUser; }
  logout(): void  { this.authService.logout(); }
}
