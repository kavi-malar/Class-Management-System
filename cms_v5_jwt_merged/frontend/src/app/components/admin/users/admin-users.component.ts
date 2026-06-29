import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="nav-brand"><i class="fas fa-shield-alt"></i> ClassMS Admin</div>
      <div class="nav-links">
        <a routerLink="/admin/dashboard" routerLinkActive="active"><i class="fas fa-tachometer-alt"></i> Dashboard</a>
        <a routerLink="/admin/rooms"     routerLinkActive="active"><i class="fas fa-building"></i> Rooms</a>
        <a routerLink="/admin/timetable" routerLinkActive="active"><i class="fas fa-calendar-alt"></i> Timetable</a>
        <a routerLink="/admin/classes"   routerLinkActive="active"><i class="fas fa-layer-group"></i> Classes</a>
        <a routerLink="/admin/users"     routerLinkActive="active"><i class="fas fa-users"></i> Users</a>
      </div>
      <div class="nav-user">
        <div class="user-avatar">A</div>
        <button class="btn-logout" (click)="logout()"><i class="fas fa-sign-out-alt"></i> Logout</button>
      </div>
    </nav>
    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-users"></i> Manage Users</h1>
        <button class="btn btn-primary" (click)="showForm = !showForm">
          <i class="fas fa-user-plus"></i> Add User
        </button>
      </div>

      <div class="toast toast-ok"  *ngIf="toast === 'ok'"><i class="fas fa-check-circle"></i> {{ toastMsg }}</div>
      <div class="toast toast-err" *ngIf="toast === 'err'"><i class="fas fa-times-circle"></i> {{ toastMsg }}</div>

      <!-- Add user form -->
      <div class="card form-card" *ngIf="showForm">
        <h3><i class="fas fa-user-plus"></i> New User</h3>
        <div class="form-grid">
          <div class="form-group"><label>Name *</label><input class="form-control" [(ngModel)]="newUser.name" placeholder="Full name" /></div>
          <div class="form-group"><label>Email *</label><input class="form-control" [(ngModel)]="newUser.email" placeholder="email@school.edu" /></div>
          <div class="form-group"><label>Password *</label><input class="form-control" type="password" [(ngModel)]="newUser.password" placeholder="Min 6 chars" /></div>
          <div class="form-group"><label>Phone *</label><input class="form-control" [(ngModel)]="newUser.phone" placeholder="+91XXXXXXXXXX" /></div>
          <div class="form-group">
            <label>Role *</label>
            <select class="form-control" [(ngModel)]="newUser.role">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="cr">CR</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div class="form-group"><label>Class</label><input class="form-control" [(ngModel)]="newUser.className" placeholder="e.g. CSE-A" /></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-secondary" (click)="showForm = false">Cancel</button>
          <button class="btn btn-primary" (click)="createUser()" [disabled]="saving || !newUser.name || !newUser.email || !newUser.password || !newUser.phone">
            {{ saving ? 'Creating…' : 'Create User' }}
          </button>
        </div>
      </div>

      <!-- Filter -->
      <div class="filter-bar">
        <label>Filter by Role</label>
        <select class="form-control filter-select" [(ngModel)]="filterRole" (change)="loadUsers()">
          <option value="">All Roles</option>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
          <option value="cr">CR</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <!-- Users table -->
      <div class="card">
        <div *ngIf="loading" class="loading-center"><div class="spinner"></div></div>
        <table *ngIf="!loading">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Class</th><th>Phone</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let u of users" [class.inactive-row]="!u.isActive">
              <td><strong>{{ u.name }}</strong></td>
              <td class="email-cell">{{ u.email }}</td>
              <td><span class="role-badge role-{{u.role}}">{{ u.role }}</span></td>
              <td>{{ u.className || '—' }}</td>
              <td>{{ u.phone }}</td>
              <td>
                <span class="badge-ok" *ngIf="u.isActive">Active</span>
                <span class="badge-off" *ngIf="!u.isActive">Inactive</span>
              </td>
              <td>
                <button class="btn-del" *ngIf="u.isActive" (click)="deactivateUser(u._id)" title="Deactivate">
                  <i class="fas fa-user-slash"></i>
                </button>
              </td>
            </tr>
            <tr *ngIf="users.length === 0">
              <td colspan="7" class="empty-cell">No users found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  `,
  styles: [`
    .navbar{display:flex;align-items:center;gap:1.5rem;padding:0 2rem;height:60px;background:#0f172a;color:#fff;position:sticky;top:0;z-index:100;}
    .nav-brand{font-size:1.1rem;font-weight:800;display:flex;align-items:center;gap:0.5rem;color:#f59e0b;}
    .nav-links{display:flex;gap:0.25rem;margin-left:auto;}
    .nav-links a{color:#94a3b8;text-decoration:none;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;transition:all .2s;}
    .nav-links a.active,.nav-links a:hover{color:#fff;background:rgba(255,255,255,.1);}
    .nav-user{display:flex;align-items:center;gap:0.75rem;margin-left:1rem;}
    .user-avatar{width:34px;height:34px;border-radius:50%;background:#f59e0b;color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;}
    .btn-logout{background:rgba(255,255,255,.08);border:none;color:#94a3b8;cursor:pointer;padding:0.4rem 0.8rem;border-radius:6px;font-size:0.82rem;display:flex;align-items:center;gap:0.35rem;}
    .btn-logout:hover{background:rgba(255,255,255,.15);color:#fff;}
    .page-container{max-width:1200px;margin:0 auto;padding:2rem 1.5rem;}
    .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;}
    .page-header h1{font-size:1.5rem;font-weight:800;display:flex;align-items:center;gap:0.6rem;margin:0;}
    .card{background:#fff;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;margin-bottom:1.25rem;}
    .form-card h3{font-size:1rem;font-weight:700;display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;color:#4f46e5;}
    .form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;}
    .form-group{display:flex;flex-direction:column;gap:0.35rem;}
    .form-group label{font-size:0.8rem;font-weight:600;color:#475569;}
    .form-control{border:1.5px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none;font-family:inherit;}
    .form-control:focus{border-color:#4f46e5;}
    .form-actions{display:flex;gap:0.6rem;justify-content:flex-end;}
    .filter-bar{display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;font-size:0.85rem;font-weight:600;color:#475569;}
    .filter-select{width:180px;}
    .btn{padding:0.5rem 1rem;border:none;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:0.4rem;}
    .btn-primary{background:#4f46e5;color:#fff;}.btn-primary:hover{background:#4338ca;}.btn-primary:disabled{opacity:0.5;cursor:not-allowed;}
    .btn-secondary{background:#f1f5f9;color:#475569;}.btn-secondary:hover{background:#e2e8f0;}
    .toast{position:fixed;top:1.2rem;right:1.5rem;z-index:9999;padding:0.75rem 1.25rem;border-radius:8px;display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;box-shadow:0 4px 16px rgba(0,0,0,.15);}
    .toast-ok{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;}
    .toast-err{background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;}
    table{width:100%;border-collapse:collapse;font-size:0.85rem;}
    thead th{padding:0.6rem 1rem;text-align:left;font-weight:600;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
    tbody td{padding:0.65rem 1rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
    tbody tr:last-child td{border-bottom:none;}
    tr.inactive-row{opacity:0.5;}
    .email-cell{font-size:0.8rem;color:#64748b;}
    .role-badge{padding:0.15rem 0.55rem;border-radius:6px;font-size:0.72rem;font-weight:700;text-transform:uppercase;}
    .role-teacher{background:#dbeafe;color:#1d4ed8;}
    .role-student{background:#d1fae5;color:#065f46;}
    .role-cr{background:#ede9fe;color:#5b21b6;}
    .role-admin{background:#fef3c7;color:#92400e;}
    .badge-ok{background:#d1fae5;color:#065f46;padding:0.15rem 0.55rem;border-radius:6px;font-size:0.72rem;font-weight:600;}
    .badge-off{background:#f3f4f6;color:#6b7280;padding:0.15rem 0.55rem;border-radius:6px;font-size:0.72rem;font-weight:600;}
    .btn-del{background:#fee2e2;color:#991b1b;border:none;border-radius:6px;padding:0.3rem 0.6rem;cursor:pointer;font-size:0.78rem;}
    .btn-del:hover{background:#fca5a5;}
    .loading-center{display:flex;justify-content:center;padding:3rem;}
    .spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty-cell{text-align:center;color:#9ca3af;padding:2rem;}
  `]
})
export class AdminUsersComponent implements OnInit {
  users: any[] = [];
  loading  = true;
  showForm = false;
  saving   = false;
  filterRole = '';
  newUser = { name:'', email:'', password:'', phone:'', role:'student', className:'' };
  toast: 'ok'|'err'|'' = '';
  toastMsg = '';

  constructor(private adminSvc: AdminService, private authSvc: AuthService) {}
  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.loading = true;
    const params: any = {};
    if (this.filterRole) params.role = this.filterRole;
    this.adminSvc.getUsers(params).subscribe({
      next: (r: any) => { this.users = r.users || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  createUser(): void {
    this.saving = true;
    this.adminSvc.createUser(this.newUser).subscribe({
      next: () => { this.saving = false; this.showForm = false; this.newUser = {name:'',email:'',password:'',phone:'',role:'student',className:''}; this.showToast('ok','User created!'); this.loadUsers(); },
      error: (e: any) => { this.saving = false; this.showToast('err', e?.error?.message || 'Failed'); }
    });
  }
  deactivateUser(id: string): void {
    if (!confirm('Deactivate this user?')) return;
    this.adminSvc.deleteUser(id).subscribe({ next: () => { this.showToast('ok','User deactivated'); this.loadUsers(); }, error: () => this.showToast('err','Failed') });
  }
  showToast(t: 'ok'|'err', msg: string): void { this.toast = t; this.toastMsg = msg; setTimeout(()=>this.toast='', 3000); }
  logout(): void { this.authSvc.logout(); }
}
