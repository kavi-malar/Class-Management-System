import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const PERIODS = [
  { n:1, s:'09:00', e:'09:45' },
  { n:2, s:'09:45', e:'10:30' },
  { n:3, s:'10:45', e:'11:30' },
  { n:4, s:'11:30', e:'12:15' },
  { n:5, s:'13:00', e:'13:45' },
  { n:6, s:'13:45', e:'14:30' },
  { n:7, s:'14:30', e:'15:15' },
  { n:8, s:'15:15', e:'16:00' },
];

@Component({
  selector: 'app-admin-classes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <!-- ══════════════════════ NAVBAR ══════════════════════ -->
    <nav class="navbar">
      <div class="nav-brand">
        <i class="fas fa-shield-alt"></i> ClassMS Admin
      </div>
      <div class="nav-links">
        <a routerLink="/admin/dashboard" routerLinkActive="active">
          <i class="fas fa-tachometer-alt"></i> Dashboard
        </a>
        <a routerLink="/admin/rooms" routerLinkActive="active">
          <i class="fas fa-building"></i> Rooms
        </a>
        <a routerLink="/admin/timetable" routerLinkActive="active">
          <i class="fas fa-calendar-alt"></i> Timetable
        </a>
        <a routerLink="/admin/classes" routerLinkActive="active">
          <i class="fas fa-layer-group"></i> Classes
        </a>
        <a routerLink="/admin/users" routerLinkActive="active">
          <i class="fas fa-users"></i> Users
        </a>
      </div>
      <div class="nav-right">
        <div class="admin-pill"><i class="fas fa-shield-alt"></i> Admin</div>
        <button class="btn-logout" (click)="logout()">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </nav>

    <!-- ══════════════════════ MAIN ══════════════════════ -->
    <main class="page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1><i class="fas fa-layer-group"></i> Manage Classes</h1>
          <p class="page-sub">Create and manage class sections. Each class gets its own timetable.</p>
        </div>
        <button class="btn btn-primary" (click)="openWizard()">
          <i class="fas fa-plus"></i> Add New Class
        </button>
      </div>

      <!-- Toast -->
      <div class="toast toast-ok"  *ngIf="toast === 'ok'">
        <i class="fas fa-check-circle"></i> {{ toastMsg }}
      </div>
      <div class="toast toast-err" *ngIf="toast === 'err'">
        <i class="fas fa-times-circle"></i> {{ toastMsg }}
      </div>

      <!-- ════════════════ WIZARD MODAL ════════════════ -->
      <div class="overlay" *ngIf="wizardOpen">
        <div class="wizard-card">

          <!-- ── Progress Bar ── -->
          <div class="progress-bar">
            <div class="progress-fill" [style.width]="progressPct + '%'"></div>
          </div>

          <!-- ── Step Indicators ── -->
          <div class="step-row">
            <div class="step-dot" [class.s-done]="wizardStep > 1" [class.s-active]="wizardStep === 1">
              <span>{{ wizardStep > 1 ? '✓' : '1' }}</span>
              <small>Class Info</small>
            </div>
            <div class="step-line" [class.done]="wizardStep > 1"></div>
            <div class="step-dot" [class.s-done]="wizardStep > 2" [class.s-active]="wizardStep === 2">
              <span>{{ wizardStep > 2 ? '✓' : '2' }}</span>
              <small>Timetable</small>
            </div>
            <div class="step-line" [class.done]="wizardStep > 2"></div>
            <div class="step-dot" [class.s-active]="wizardStep === 3">
              <span>3</span>
              <small>Confirm</small>
            </div>
          </div>

          <!-- ════ STEP 1 — Class Info ════ -->
          <div *ngIf="wizardStep === 1" class="step-body">
            <h2 class="step-title">
              <i class="fas fa-layer-group"></i> New Class Section
            </h2>
            <p class="step-hint">Fill in the basic details for the new class.</p>

            <div class="field-grid">
              <div class="field">
                <label>Class Name <span class="req">*</span></label>
                <input class="inp" [(ngModel)]="newClass.name"
                       placeholder="e.g. CSE-C"
                       [class.inp-err]="touched && !newClass.name" />
                <span class="err-msg" *ngIf="touched && !newClass.name">Required</span>
              </div>
              <div class="field">
                <label>Department <span class="req">*</span></label>
                <input class="inp" [(ngModel)]="newClass.department"
                       placeholder="e.g. CSE"
                       [class.inp-err]="touched && !newClass.department" />
                <span class="err-msg" *ngIf="touched && !newClass.department">Required</span>
              </div>
              <div class="field">
                <label>Batch</label>
                <input class="inp" [(ngModel)]="newClass.batch" placeholder="e.g. 2023–2027" />
              </div>
              <div class="field">
                <label>Semester</label>
                <select class="inp" [(ngModel)]="newClass.semester">
                  <option *ngFor="let s of [1,2,3,4,5,6,7,8]" [value]="s">Semester {{ s }}</option>
                </select>
              </div>
            </div>

            <div class="step-actions">
              <button class="btn btn-ghost" (click)="closeWizard()">Cancel</button>
              <button class="btn btn-primary" (click)="goStep2()">
                Next: Set Timetable <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>

          <!-- ════ STEP 2 — Default Timetable ════ -->
          <div *ngIf="wizardStep === 2" class="step-body">
            <h2 class="step-title">
              <i class="fas fa-calendar-alt"></i> Default Timetable
              <span class="class-tag">{{ newClass.name }}</span>
            </h2>
            <p class="step-hint">
              Enter subject name and teacher name for each slot. Leave a cell empty to skip that period.
            </p>

            <!-- Copy from existing class -->
            <div class="copy-bar">
              <i class="fas fa-copy"></i>
              <span>Copy from:</span>
              <select class="inp-sm" [(ngModel)]="copyFromClass">
                <option value="">— select existing class —</option>
                <option *ngFor="let c of activeClasses" [value]="c.name">{{ c.name }}</option>
              </select>
              <button class="btn btn-sm btn-outline"
                      (click)="copyTimetable()"
                      [disabled]="!copyFromClass || copying">
                <i class="fas fa-download"></i> {{ copying ? 'Loading…' : 'Copy' }}
              </button>
              <button class="btn btn-sm btn-ghost-red" (click)="resetGrid()">
                <i class="fas fa-trash"></i> Clear All
              </button>
            </div>

            <!-- Grid -->
            <div class="tt-scroll">
              <table class="tt-table">
                <thead>
                  <tr>
                    <th class="th-fixed">Period</th>
                    <th class="th-fixed">Time</th>
                    <th *ngFor="let d of days" class="th-day">{{ d }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of periods">
                    <td class="td-center">
                      <span class="p-pill">P{{ p.n }}</span>
                    </td>
                    <td class="td-time">
                      {{ p.s }}<br /><small>{{ p.e }}</small>
                    </td>
                    <td *ngFor="let d of days"
                        class="td-cell"
                        [class.cell-filled]="ttGrid[d][p.n].subject">
                      <input class="cell-inp sub-inp"
                             [(ngModel)]="ttGrid[d][p.n].subject"
                             placeholder="Subject" />
                      <input class="cell-inp tchr-inp"
                             [(ngModel)]="ttGrid[d][p.n].teacherName"
                             placeholder="Teacher" />
                      <input class="cell-inp room-inp"
                             [(ngModel)]="ttGrid[d][p.n].room"
                             placeholder="Room" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="slot-count">
              <i class="fas fa-info-circle"></i>
              <strong>{{ countFilled() }}</strong> period(s) configured
            </div>

            <div class="step-actions">
              <button class="btn btn-ghost" (click)="wizardStep = 1">
                <i class="fas fa-arrow-left"></i> Back
              </button>
              <button class="btn btn-secondary" (click)="skipTimetable()">
                Skip for Now
              </button>
              <button class="btn btn-primary" (click)="wizardStep = 3">
                Review <i class="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>

          <!-- ════ STEP 3 — Confirm & Create ════ -->
          <div *ngIf="wizardStep === 3" class="step-body">
            <h2 class="step-title">
              <i class="fas fa-check-circle"></i> Confirm & Create
            </h2>

            <div class="summary">
              <div class="summary-row">
                <span>Class Name</span>
                <strong>{{ newClass.name }}</strong>
              </div>
              <div class="summary-row">
                <span>Department</span>
                <strong>{{ newClass.department }}</strong>
              </div>
              <div class="summary-row" *ngIf="newClass.batch">
                <span>Batch</span>
                <strong>{{ newClass.batch }}</strong>
              </div>
              <div class="summary-row">
                <span>Semester</span>
                <strong>Semester {{ newClass.semester }}</strong>
              </div>
              <div class="summary-row">
                <span>Timetable Slots</span>
                <strong [class.zero]="countFilled() === 0">
                  {{ skippedTimetable ? 'Skipped (set up later)' : countFilled() + ' periods configured' }}
                </strong>
              </div>
            </div>

            <div class="info-note" *ngIf="countFilled() > 0">
              <i class="fas fa-info-circle"></i>
              Teacher names will be matched exactly to existing users. Unmatched entries are skipped.
            </div>

            <!-- Day breakdown -->
            <div class="breakdown" *ngIf="countFilled() > 0 && !skippedTimetable">
              <div class="bd-title">Per-day breakdown:</div>
              <div class="bd-grid">
                <div class="bd-day" *ngFor="let d of days">
                  <span class="bd-name">{{ d.slice(0,3) }}</span>
                  <span class="bd-count">{{ countDay(d) }}</span>
                </div>
              </div>
            </div>

            <div class="step-actions">
              <button class="btn btn-ghost" (click)="goBackFromConfirm()">
                <i class="fas fa-arrow-left"></i> Back
              </button>
              <button class="btn btn-create" (click)="createClass()" [disabled]="saving">
                <i class="fas fa-circle-notch fa-spin" *ngIf="saving"></i>
                <i class="fas fa-plus-circle" *ngIf="!saving"></i>
                {{ saving ? 'Creating…' : 'Create Class' }}
              </button>
            </div>
          </div>

        </div>
      </div>
      <!-- ════════════════ END WIZARD ════════════════ -->

      <!-- ════════════════ CLASSES TABLE ════════════════ -->
      <div class="table-card">

        <div class="table-toolbar">
          <div class="toolbar-left">
            <i class="fas fa-layer-group"></i>
            <span>{{ activeClasses.length }} active / {{ classes.length }} total</span>
          </div>
          <input class="search-inp" [(ngModel)]="searchQuery" placeholder="🔍 Search classes…" />
        </div>

        <div class="loading-box" *ngIf="loading">
          <div class="spinner"></div>
          <p>Loading classes…</p>
        </div>

        <table *ngIf="!loading" class="data-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Department</th>
              <th>Batch</th>
              <th>Semester</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of filteredClasses" [class.row-inactive]="!c.isActive">
              <td>
                <div class="class-name-cell">
                  <span class="class-dot" [class.dot-active]="c.isActive"></span>
                  <strong>{{ c.name }}</strong>
                </div>
              </td>
              <td>{{ c.department }}</td>
              <td>{{ c.batch || '—' }}</td>
              <td>
                <span class="sem-badge">Sem {{ c.semester }}</span>
              </td>
              <td>
                <span class="status-pill pill-active"   *ngIf="c.isActive">Active</span>
                <span class="status-pill pill-inactive" *ngIf="!c.isActive">Inactive</span>
              </td>
              <td>
                <button class="btn-deactivate"
                        *ngIf="c.isActive"
                        (click)="deactivateClass(c._id, c.name)"
                        title="Deactivate {{ c.name }}">
                  <i class="fas fa-ban"></i> Deactivate
                </button>
                <button class="btn-activate"
                        *ngIf="!c.isActive"
                        (click)="activateClass(c._id, c.name)"
                        title="Activate {{ c.name }}">
                  <i class="fas fa-check-circle"></i> Activate
                </button>
              </td>
            </tr>
            <tr *ngIf="filteredClasses.length === 0">
              <td colspan="6" class="empty-cell">
                <i class="fas fa-search"></i>
                No classes found
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </main>
  `,
  styles: [`
    /* ─────────── Reset ─────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ─────────── Navbar ─────────── */
    .navbar {
      display: flex; align-items: center; gap: 1rem;
      padding: 0 2rem; height: 62px;
      background: #0f172a; color: #fff;
      position: sticky; top: 0; z-index: 200;
      box-shadow: 0 2px 8px rgba(0,0,0,.3);
    }
    .nav-brand {
      font-size: 1.1rem; font-weight: 800;
      color: #f59e0b; display: flex; align-items: center; gap: 0.5rem;
      white-space: nowrap;
    }
    .nav-links { display: flex; gap: 0.2rem; margin-left: auto; }
    .nav-links a {
      color: #94a3b8; text-decoration: none;
      padding: 0.4rem 0.85rem; border-radius: 7px;
      font-size: 0.84rem; display: flex; align-items: center; gap: 0.4rem;
      transition: all .18s;
    }
    .nav-links a:hover, .nav-links a.active {
      color: #fff; background: rgba(255,255,255,.1);
    }
    .nav-right { display: flex; align-items: center; gap: 0.6rem; margin-left: 1rem; }
    .admin-pill {
      background: rgba(245,158,11,.18); color: #f59e0b;
      padding: 0.25rem 0.7rem; border-radius: 20px;
      font-size: 0.75rem; font-weight: 700;
      display: flex; align-items: center; gap: 0.35rem;
    }
    .btn-logout {
      background: rgba(255,255,255,.07); border: none; color: #94a3b8;
      padding: 0.4rem 0.85rem; border-radius: 7px; cursor: pointer;
      font-size: 0.82rem; display: flex; align-items: center; gap: 0.35rem;
      transition: all .18s;
    }
    .btn-logout:hover { background: rgba(255,255,255,.15); color: #fff; }

    /* ─────────── Page ─────────── */
    .page { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 1.75rem; gap: 1rem;
    }
    .page-header h1 {
      font-size: 1.6rem; font-weight: 800; color: #1e293b;
      display: flex; align-items: center; gap: 0.6rem;
    }
    .page-header h1 i { color: #4f46e5; }
    .page-sub { color: #64748b; font-size: 0.875rem; margin-top: 0.3rem; }

    /* ─────────── Buttons ─────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 1.1rem; border: none; border-radius: 8px;
      font-size: 0.875rem; font-weight: 600; cursor: pointer;
      transition: all .18s; white-space: nowrap; font-family: inherit;
    }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn-primary  { background: #4f46e5; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #4338ca; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79,70,229,.35); }
    .btn-secondary { background: #f1f5f9; color: #475569; border: 1.5px solid #e2e8f0; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-ghost  { background: transparent; color: #64748b; border: 1.5px solid #e2e8f0; }
    .btn-ghost:hover { background: #f8fafc; }
    .btn-ghost-red { background: transparent; color: #ef4444; border: 1.5px solid #fca5a5; font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 6px; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 0.35rem; }
    .btn-ghost-red:hover { background: #fee2e2; }
    .btn-create {
      background: linear-gradient(135deg, #4f46e5, #7c3aed);
      color: #fff; padding: 0.65rem 1.5rem; font-size: 0.95rem;
    }
    .btn-create:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); }
    .btn-sm { padding: 0.3rem 0.7rem; font-size: 0.78rem; border-radius: 6px; }
    .btn-outline {
      background: transparent; color: #4f46e5; border: 1.5px solid #4f46e5;
      font-size: 0.78rem; padding: 0.28rem 0.7rem; border-radius: 6px;
      cursor: pointer; font-weight: 600; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.35rem;
    }
    .btn-outline:hover:not(:disabled) { background: #ede9fe; }

    /* ─────────── Toast ─────────── */
    .toast {
      position: fixed; top: 1.2rem; right: 1.5rem; z-index: 9999;
      padding: 0.75rem 1.25rem; border-radius: 10px;
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.875rem; font-weight: 500;
      box-shadow: 0 6px 20px rgba(0,0,0,.15);
      animation: slideIn .2s ease;
    }
    @keyframes slideIn { from { opacity:0; transform: translateY(-10px); } to { opacity:1; transform: none; } }
    .toast-ok  { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .toast-err { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

    /* ─────────── Wizard Overlay ─────────── */
    .overlay {
      position: fixed; inset: 0; background: rgba(15,23,42,.55);
      backdrop-filter: blur(3px);
      z-index: 500; display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    }
    .wizard-card {
      background: #fff; border-radius: 18px;
      width: 100%; max-width: 1020px; max-height: 92vh; overflow-y: auto;
      box-shadow: 0 24px 80px rgba(0,0,0,.3);
      animation: popIn .22s ease;
    }
    @keyframes popIn { from { transform: scale(.93); opacity:0 } to { transform: scale(1); opacity:1 } }

    /* ─── Progress bar ─── */
    .progress-bar {
      height: 4px; background: #e2e8f0; border-radius: 18px 18px 0 0; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, #4f46e5, #7c3aed);
      transition: width .35s ease;
    }

    /* ─── Step indicators ─── */
    .step-row {
      display: flex; align-items: center; padding: 1.4rem 2rem 0;
    }
    .step-dot {
      display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
      min-width: 56px;
    }
    .step-dot span {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e2e8f0; color: #94a3b8;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.82rem; font-weight: 800; transition: all .2s;
    }
    .step-dot small { font-size: 0.68rem; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .step-dot.s-active span { background: #4f46e5; color: #fff; box-shadow: 0 0 0 4px rgba(79,70,229,.2); }
    .step-dot.s-active small { color: #4f46e5; }
    .step-dot.s-done span   { background: #10b981; color: #fff; }
    .step-dot.s-done small  { color: #10b981; }
    .step-line { flex: 1; height: 2px; background: #e2e8f0; margin: 0 0.5rem; margin-bottom: 1.25rem; transition: background .3s; }
    .step-line.done { background: #10b981; }

    /* ─── Step body ─── */
    .step-body { padding: 1.5rem 2rem 2rem; }
    .step-title {
      font-size: 1.2rem; font-weight: 800; color: #1e293b;
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem;
    }
    .step-title i { color: #4f46e5; }
    .class-tag {
      background: #ede9fe; color: #5b21b6;
      padding: 0.2rem 0.65rem; border-radius: 6px; font-size: 0.82rem; font-weight: 700;
    }
    .step-hint { color: #64748b; font-size: 0.875rem; margin-bottom: 1.4rem; }
    .step-actions {
      display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1.75rem;
      padding-top: 1.25rem; border-top: 1px solid #f1f5f9;
    }

    /* ─────────── Step 1 Fields ─────────── */
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.1rem; }
    @media (max-width: 600px) { .field-grid { grid-template-columns: 1fr; } }
    .field { display: flex; flex-direction: column; gap: 0.35rem; }
    .field label { font-size: 0.82rem; font-weight: 700; color: #374151; }
    .req { color: #ef4444; }
    .inp {
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 0.6rem 0.85rem; font-size: 0.875rem; outline: none;
      font-family: inherit; transition: border-color .18s; background: #fff;
    }
    .inp:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.12); }
    .inp-err { border-color: #ef4444; }
    .err-msg { font-size: 0.72rem; color: #ef4444; }

    /* ─────────── Step 2 — Timetable ─────────── */
    .copy-bar {
      display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 0.7rem 1rem; margin-bottom: 1.1rem;
    }
    .copy-bar span { font-size: 0.82rem; font-weight: 600; color: #475569; white-space: nowrap; }
    .copy-bar i { color: #4f46e5; }
    .inp-sm {
      border: 1.5px solid #e2e8f0; border-radius: 7px;
      padding: 0.3rem 0.65rem; font-size: 0.82rem; outline: none;
      font-family: inherit; flex: 1; min-width: 160px;
    }
    .inp-sm:focus { border-color: #4f46e5; }

    .tt-scroll { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .tt-table { border-collapse: collapse; min-width: 900px; width: 100%; font-size: 0.76rem; }
    .tt-table th {
      padding: 0.55rem 0.5rem; background: #f1f5f9;
      border: 1px solid #e2e8f0; font-weight: 700; color: #475569;
      text-align: center; white-space: nowrap;
    }
    .tt-table td { border: 1px solid #eef0f5; padding: 0.25rem; vertical-align: top; }
    .th-fixed { width: 52px; }
    .th-day   { min-width: 120px; }
    .td-center { text-align: center; vertical-align: middle; }
    .td-time   { text-align: center; vertical-align: middle; color: #64748b; font-size: 0.7rem; line-height: 1.5; white-space: nowrap; }
    .p-pill {
      background: #4f46e5; color: #fff; border-radius: 5px;
      padding: 0.15rem 0.45rem; font-size: 0.72rem; font-weight: 800;
    }
    .td-cell { background: #fff; }
    .td-cell.cell-filled { background: #f0fdf4; }
    .cell-inp {
      border: 1px solid #e2e8f0; border-radius: 4px;
      padding: 0.22rem 0.3rem; font-size: 0.71rem; width: 100%;
      outline: none; font-family: inherit; margin-bottom: 2px;
      background: #fff;
    }
    .cell-inp:focus { border-color: #4f46e5; background: #fafafe; }
    .sub-inp  { color: #1e293b; font-weight: 600; }
    .tchr-inp { color: #475569; }
    .room-inp { color: #7c3aed; }

    .slot-count {
      margin-top: 0.75rem; font-size: 0.82rem; color: #475569;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .slot-count i { color: #4f46e5; }
    .slot-count strong { color: #1e293b; }

    /* ─────────── Step 3 — Summary ─────────── */
    .summary {
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;
      overflow: hidden; margin-bottom: 1rem;
    }
    .summary-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.7rem 1.1rem; border-bottom: 1px solid #f1f5f9;
      font-size: 0.875rem;
    }
    .summary-row:last-child { border-bottom: none; }
    .summary-row span { color: #64748b; }
    .summary-row strong { color: #1e293b; }
    .summary-row strong.zero { color: #94a3b8; font-weight: 500; }

    .info-note {
      background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
      border-radius: 8px; padding: 0.65rem 1rem; font-size: 0.82rem;
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;
    }

    .breakdown { margin-bottom: 0.5rem; }
    .bd-title { font-size: 0.78rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; }
    .bd-grid { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .bd-day {
      display: flex; flex-direction: column; align-items: center;
      background: #f1f5f9; border-radius: 8px; padding: 0.4rem 0.7rem; min-width: 50px;
    }
    .bd-name { font-size: 0.72rem; font-weight: 700; color: #475569; }
    .bd-count {
      font-size: 1.1rem; font-weight: 800; color: #4f46e5;
      line-height: 1.2;
    }

    /* ─────────── Classes Table ─────────── */
    .table-card {
      background: #fff; border-radius: 14px;
      border: 1px solid #e2e8f0; overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .table-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9;
      gap: 1rem;
    }
    .toolbar-left {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.82rem; color: #64748b; font-weight: 600;
    }
    .toolbar-left i { color: #4f46e5; }
    .search-inp {
      border: 1.5px solid #e2e8f0; border-radius: 8px;
      padding: 0.45rem 0.85rem; font-size: 0.875rem; outline: none;
      font-family: inherit; width: 220px; transition: border-color .18s;
    }
    .search-inp:focus { border-color: #4f46e5; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table thead th {
      padding: 0.65rem 1.1rem; text-align: left; font-size: 0.75rem;
      font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
      color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0;
    }
    .data-table tbody td {
      padding: 0.8rem 1.1rem; border-bottom: 1px solid #f1f5f9; vertical-align: middle;
    }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover td { background: #fafbff; }
    .row-inactive td { opacity: .55; }

    .class-name-cell { display: flex; align-items: center; gap: 0.6rem; }
    .class-dot {
      width: 9px; height: 9px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0;
    }
    .class-dot.dot-active { background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.18); }
    .sem-badge {
      background: #ede9fe; color: #5b21b6; padding: 0.18rem 0.55rem;
      border-radius: 6px; font-size: 0.75rem; font-weight: 700;
    }
    .status-pill {
      padding: 0.2rem 0.65rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700;
    }
    .pill-active   { background: #d1fae5; color: #065f46; }
    .pill-inactive { background: #f3f4f6; color: #6b7280; }

    .btn-deactivate {
      background: #fff1f2; color: #be123c; border: 1.5px solid #fecdd3;
      padding: 0.32rem 0.8rem; border-radius: 7px; cursor: pointer;
      font-size: 0.78rem; font-weight: 600; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.35rem;
      transition: all .18s;
    }
    .btn-deactivate:hover { background: #ffe4e6; border-color: #fb7185; transform: translateY(-1px); }
    .btn-activate {
      background: #f0fdf4; color: #15803d; border: 1.5px solid #86efac;
      padding: 0.32rem 0.8rem; border-radius: 7px; cursor: pointer;
      font-size: 0.78rem; font-weight: 600; font-family: inherit;
      display: inline-flex; align-items: center; gap: 0.35rem;
      transition: all .18s;
    }
    .btn-activate:hover { background: #dcfce7; border-color: #4ade80; transform: translateY(-1px); }

    .loading-box {
      display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
      padding: 3rem; color: #64748b;
    }
    .spinner {
      width: 38px; height: 38px; border: 3px solid #e2e8f0;
      border-top-color: #4f46e5; border-radius: 50%;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-cell {
      text-align: center; padding: 2.5rem; color: #9ca3af;
      font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    }
  `]
})
export class AdminClassesComponent implements OnInit {

  /* ── Data ── */
  classes:     any[] = [];
  loading      = true;
  saving       = false;
  searchQuery  = '';

  /* ── Toast ── */
  toast: '' | 'ok' | 'err' = '';
  toastMsg = '';

  /* ── Wizard ── */
  wizardOpen      = false;
  wizardStep      = 1;
  touched         = false;
  skippedTimetable = false;

  newClass = { name: '', department: '', batch: '', semester: 1 };

  /* ── Timetable grid ── */
  days    = DAYS;
  periods = PERIODS;
  ttGrid: Record<string, Record<number, { subject: string; teacherName: string; room: string }>> = {};

  /* ── Copy from class ── */
  copyFromClass = '';
  copying       = false;

  constructor(
    private adminSvc: AdminService,
    private authSvc:  AuthService,
    private http:     HttpClient
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.resetGrid();
  }

  /* ──────────── Computed ──────────── */

  get progressPct(): number {
    return this.wizardStep === 1 ? 15 : this.wizardStep === 2 ? 55 : 95;
  }

  get activeClasses(): any[] {
    return this.classes.filter(c => c.isActive);
  }

  get filteredClasses(): any[] {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return this.classes;
    return this.classes.filter(c =>
      c.name.toLowerCase().includes(q) || c.department.toLowerCase().includes(q)
    );
  }

  /* ──────────── Data Loading ──────────── */

  loadClasses(): void {
    this.loading = true;
    this.adminSvc.getClasses().subscribe({
      next:  (r: any) => { this.classes = r.classes || []; this.loading = false; },
      error: ()       => { this.loading = false; }
    });
  }

  /* ──────────── Wizard Control ──────────── */

  openWizard(): void {
    this.wizardOpen       = true;
    this.wizardStep       = 1;
    this.touched          = false;
    this.skippedTimetable = false;
    this.copyFromClass    = '';
    this.newClass         = { name: '', department: '', batch: '', semester: 1 };
    this.resetGrid();
  }

  closeWizard(): void { this.wizardOpen = false; }

  goStep2(): void {
    this.touched = true;
    if (!this.newClass.name.trim() || !this.newClass.department.trim()) return;
    this.touched    = false;
    this.wizardStep = 2;
  }

  skipTimetable(): void {
    this.skippedTimetable = true;
    this.wizardStep       = 3;
  }

  goBackFromConfirm(): void {
    this.skippedTimetable = false;
    this.wizardStep       = 2;
  }

  /* ──────────── Timetable Grid ──────────── */

  resetGrid(): void {
    this.ttGrid = {};
    for (const d of DAYS) {
      this.ttGrid[d] = {};
      for (const p of PERIODS) {
        this.ttGrid[d][p.n] = { subject: '', teacherName: '', room: '' };
      }
    }
  }

  countFilled(): number {
    let n = 0;
    for (const d of DAYS)
      for (const p of PERIODS)
        if (this.ttGrid[d]?.[p.n]?.subject?.trim()) n++;
    return n;
  }

  countDay(day: string): number {
    return PERIODS.filter(p => this.ttGrid[day]?.[p.n]?.subject?.trim()).length;
  }

  /* ──────────── Copy Timetable ──────────── */

  copyTimetable(): void {
    if (!this.copyFromClass) return;
    this.copying = true;
    this.adminSvc.getTimetableOverview(this.copyFromClass).subscribe({
      next: (r: any) => {
        const grouped = r.grouped?.[this.copyFromClass] || {};
        this.resetGrid();
        for (const day of DAYS) {
          for (const entry of (grouped[day] || [])) {
            const pn = entry.periodNumber;
            if (this.ttGrid[day]?.[pn] !== undefined) {
              this.ttGrid[day][pn] = {
                subject:     entry.subject?.name   || '',
                teacherName: entry.teacher?.name   || '',
                room:        entry.classroomNo     || '',
              };
            }
          }
        }
        this.copying = false;
      },
      error: () => { this.copying = false; }
    });
  }

  /* ──────────── Create ──────────── */

  createClass(): void {
    this.saving = true;

    const defaultTimetable: any[] = [];

    if (!this.skippedTimetable) {
      for (const d of DAYS) {
        for (const p of PERIODS) {
          const cell = this.ttGrid[d][p.n];
          if (cell.subject.trim()) {
            defaultTimetable.push({
              dayOfWeek:    d,
              periodNumber: p.n,
              startTime:    p.s,
              endTime:      p.e,
              subject:      cell.subject.trim(),
              teacher:      cell.teacherName.trim(),
              classroomNo:  cell.room.trim() || 'TBD',
            });
          }
        }
      }
    }

    const payload = { ...this.newClass, defaultTimetable };

    this.adminSvc.createClass(payload).subscribe({
      next: () => {
        this.saving = false;
        this.closeWizard();
        const extra = defaultTimetable.length > 0
          ? ` with ${defaultTimetable.length} timetable period(s)`
          : '';
        this.showToast('ok', `Class "${this.newClass.name}" created${extra}!`);
        this.loadClasses();
      },
      error: (e: any) => {
        this.saving = false;
        this.showToast('err', e?.error?.message || 'Failed to create class');
      }
    });
  }

  /* ──────────── Deactivate ──────────── */

  deactivateClass(id: string, name: string): void {
    if (!confirm(`Deactivate "${name}"? This will hide it from all users.`)) return;
    this.adminSvc.deleteClass(id).subscribe({
      next: () => {
        const cls = this.classes.find(c => c._id === id);
        if (cls) cls.isActive = false;
        this.showToast('ok', `"${name}" deactivated`);
      },
      error: () => this.showToast('err', 'Failed to deactivate')
    });
  }

  activateClass(id: string, name: string): void {
    if (!confirm(`Re-activate "${name}"?`)) return;
    this.adminSvc.updateClass(id, { isActive: true }).subscribe({
      next: () => {
        const cls = this.classes.find(c => c._id === id);
        if (cls) cls.isActive = true;
        this.showToast('ok', `"${name}" is now active`);
      },
      error: () => this.showToast('err', 'Failed to activate')
    });
  }

  /* ──────────── Helpers ──────────── */

  showToast(t: 'ok' | 'err', msg: string): void {
    this.toast = t; this.toastMsg = msg;
    setTimeout(() => this.toast = '', 4000);
  }

  logout(): void { this.authSvc.logout(); }
}
