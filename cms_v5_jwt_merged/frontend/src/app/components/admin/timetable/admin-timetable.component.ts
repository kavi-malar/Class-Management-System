import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

const ALL_SLOTS = [
  {n:1,s:'09:00',e:'09:45'},{n:2,s:'09:45',e:'10:30'},{n:3,s:'10:45',e:'11:30'},
  {n:4,s:'11:30',e:'12:15'},{n:5,s:'13:00',e:'13:45'},{n:6,s:'13:45',e:'14:30'},
  {n:7,s:'14:30',e:'15:15'},{n:8,s:'15:15',e:'16:00'}
];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

@Component({
  selector: 'app-admin-timetable',
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
        <h1><i class="fas fa-calendar-alt"></i> Timetable Management</h1>
        <p>View, edit, create and duplicate timetables for any department/class.</p>
      </div>

      <!-- Toast -->
      <div class="toast toast-success" *ngIf="toast === 'ok'"><i class="fas fa-check-circle"></i> {{ toastMsg }}</div>
      <div class="toast toast-error"   *ngIf="toast === 'err'"><i class="fas fa-times-circle"></i> {{ toastMsg }}</div>

      <!-- ── Top controls ── -->
      <div class="controls-bar card">
        <div class="ctrl-left">
          <label><i class="fas fa-layer-group"></i> Class</label>
          <select class="form-control" [(ngModel)]="activeClass" (change)="onClassChange()">
            <option value="">— select class —</option>
            <option *ngFor="let c of classList" [value]="c">{{ c }}</option>
          </select>
        </div>
        <div class="ctrl-right">
          <button class="btn btn-outline" (click)="toggleDuplicate()" title="Duplicate timetable from another class">
            <i class="fas fa-copy"></i> Duplicate
          </button>
          <button class="btn btn-primary" [disabled]="!activeClass" (click)="toggleEdit()">
            <i class="fas fa-pen"></i> {{ editMode ? 'Exit Edit' : 'Edit Timetable' }}
          </button>
        </div>
      </div>

      <!-- ── Duplicate panel ── -->
      <div class="card dup-card" *ngIf="showDuplicate">
        <h3><i class="fas fa-copy"></i> Duplicate Timetable</h3>
        <p>Copy all entries from a source class into a target class.</p>
        <div class="dup-row">
          <div class="form-group">
            <label>Source Class</label>
            <select class="form-control" [(ngModel)]="dupSource">
              <option value="">—</option>
              <option *ngFor="let c of classList" [value]="c">{{ c }}</option>
            </select>
          </div>
          <div class="dup-arrow"><i class="fas fa-arrow-right"></i></div>
          <div class="form-group">
            <label>Target Class</label>
            <input class="form-control" [(ngModel)]="dupTarget" placeholder="e.g. ECE-A" />
          </div>
          <div class="form-group">
            <label>Overwrite</label>
            <select class="form-control" [(ngModel)]="dupOverwrite">
              <option [ngValue]="false">Merge (skip existing)</option>
              <option [ngValue]="true">Overwrite all</option>
            </select>
          </div>
          <button class="btn btn-primary" [disabled]="!dupSource || !dupTarget || dupSaving"
                  (click)="executeDuplicate()">
            <i class="fas fa-copy" [class.fa-spin]="dupSaving"></i>
            {{ dupSaving ? 'Copying…' : 'Duplicate' }}
          </button>
          <button class="btn btn-outline" (click)="showDuplicate = false">Cancel</button>
        </div>
      </div>

      <!-- Today's changes banner -->
      <div class="changes-banner" *ngIf="todayChanges.length > 0">
        <div class="cb-title"><i class="fas fa-exclamation-triangle"></i> Today's Changes ({{ todayChanges.length }})</div>
        <div class="cb-list">
          <div *ngFor="let c of todayChanges" class="cb-item"
               [class.cb-cancelled]="c.status === 'cancelled'" [class.cb-available]="c.status === 'available'">
            <strong>{{ c.className }}</strong> — P{{ c.periodNumber }} {{ c.subject?.name }}
            <span class="cb-status">{{ c.status === 'cancelled' ? '❌ CANCELLED' : '✅ RESTORED' }}</span>
            <span class="cb-teacher">({{ c.teacher?.name }})</span>
          </div>
        </div>
      </div>

      <div *ngIf="loading" class="loading-center"><div class="spinner"></div></div>

      <!-- ── EDIT MODE LEGEND ── -->
      <div class="edit-legend" *ngIf="editMode && activeClass">
        <i class="fas fa-info-circle"></i>
        <strong>Edit Mode</strong> — click any cell to edit that slot.
        <span class="edit-class-tag">{{ activeClass }}</span>
        <span>Teachers loaded: {{ teachers.length }} · Subjects: {{ subjects.length }}</span>
      </div>

      <!-- ── Timetable tables (single class when selected, all when not) ── -->
      <div *ngIf="!loading">
        <ng-container *ngFor="let cls of classKeys">
          <div class="class-section" *ngIf="!activeClass || activeClass === cls">
            <div class="class-header">
              <h2><i class="fas fa-layer-group"></i> {{ cls }}</h2>
              <span class="badge-info-sm">{{ countEntries(cls) }} periods assigned</span>
            </div>

            <div *ngFor="let day of days" class="card day-card">
              <div class="day-hdr">
                <span class="day-name">{{ day }}</span>
                <span class="day-count">{{ getDayEntries(cls, day).length }} / 8 periods</span>
              </div>
              <div class="table-wrapper">
                <table>
                  <thead>
                    <tr><th>#</th><th>Time</th><th>Subject</th><th>Teacher</th><th>Room</th><th>Status</th>
                      <th *ngIf="editMode && activeClass === cls">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let slot of allSlots"
                        [class.row-assigned]="getEntry(cls, day, slot.n)"
                        [class.row-free]="!getEntry(cls, day, slot.n)"
                        [class.row-editable]="editMode && activeClass === cls && !getEntry(cls, day, slot.n)"
                        (click)="editMode && activeClass === cls && !getEntry(cls, day, slot.n) && openAdd(cls, day, slot.n)">

                      <td><span class="p-badge" [class.p-free]="!getEntry(cls, day, slot.n)">P{{slot.n}}</span></td>
                      <td class="time-cell">{{slot.s}} – {{slot.e}}</td>

                      <!-- DISPLAY MODE -->
                      <ng-container *ngIf="!isEditing(cls, day, slot.n)">
                        <ng-container *ngIf="getEntry(cls, day, slot.n) as e">
                          <td><strong>{{e.subject?.name}}</strong><span class="code">{{e.subject?.code}}</span></td>
                          <td>{{e.teacher?.name}}</td>
                          <td><span class="room-pill" [class.room-tbd]="!e.classroomNo||e.classroomNo==='TBD'"><i class="fas fa-map-marker-alt"></i>{{e.classroomNo||'TBD'}}</span></td>
                          <td><span class="badge-ok">Scheduled</span></td>
                          <td *ngIf="editMode && activeClass === cls">
                            <div class="edit-action-btns">
                              <button class="btn-cell-edit" (click)="$event.stopPropagation(); openEdit(cls, day, slot.n, e)" title="Edit">
                                <i class="fas fa-pen"></i>
                              </button>
                              <button class="btn-cell-del" (click)="$event.stopPropagation(); deleteEntry(cls, day, slot.n)" title="Delete">
                                <i class="fas fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </ng-container>
                        <ng-container *ngIf="!getEntry(cls, day, slot.n)">
                          <td colspan="4" class="free-cell">
                            <span *ngIf="!editMode || activeClass !== cls"><i class="fas fa-coffee"></i> Free</span>
                            <span *ngIf="editMode && activeClass === cls" class="add-hint"><i class="fas fa-plus-circle"></i> Click to add</span>
                          </td>
                          <td *ngIf="editMode && activeClass === cls"></td>
                        </ng-container>
                      </ng-container>

                      <!-- INLINE EDIT FORM -->
                      <ng-container *ngIf="isEditing(cls, day, slot.n)">
                        <td>
                          <select class="inline-ctrl" [(ngModel)]="editForm.subjectName">
                            <option value="">— subject —</option>
                            <option *ngFor="let s of subjects" [value]="s.name">{{s.name}}</option>
                          </select>
                        </td>
                        <td>
                          <select class="inline-ctrl" [(ngModel)]="editForm.teacherEmail">
                            <option value="">— teacher —</option>
                            <option *ngFor="let t of teachers" [value]="t.email">{{t.name}}</option>
                          </select>
                        </td>
                        <td>
                          <input class="inline-ctrl" [(ngModel)]="editForm.classroomNo" placeholder="Room" style="width:70px" />
                        </td>
                        <td>
                          <div class="inline-btns">
                            <button class="btn-save-inline" [disabled]="saving" (click)="$event.stopPropagation(); saveEntry(cls, day, slot.n)">
                              <i class="fas fa-check" [class.fa-spin]="saving"></i>
                            </button>
                            <button class="btn-cancel-inline" (click)="$event.stopPropagation(); cancelEdit()">
                              <i class="fas fa-times"></i>
                            </button>
                          </div>
                        </td>
                        <td *ngIf="editMode && activeClass === cls"></td>
                      </ng-container>

                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Empty: selected class has no timetable yet -->
        <div *ngIf="activeClass && !classKeys.includes(activeClass) && !loading" class="empty-state card">
          <i class="fas fa-calendar-times"></i>
          <p><strong>{{ activeClass }}</strong> has no timetable yet.</p>
          <p *ngIf="!editMode">Click <strong>Edit Timetable</strong> to start adding periods.</p>
          <p *ngIf="editMode">Click any row above after selecting a day view, or use <strong>Duplicate</strong> to copy from another class.</p>
          <button class="btn btn-primary" (click)="editMode = true; initEmptyClass()">
            <i class="fas fa-pen"></i> Start Building Timetable
          </button>
        </div>

        <div *ngIf="!activeClass && classKeys.length === 0" class="empty-state card">
          <i class="fas fa-calendar-times"></i><p>No timetable data found.</p>
        </div>
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
    .page-container{max-width:1300px;margin:0 auto;padding:2rem 1.5rem;}
    .page-header{margin-bottom:1.5rem;}
    .page-header h1{font-size:1.5rem;font-weight:800;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem;}
    .card{background:#fff;border-radius:12px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0;}

    /* Toast */
    .toast{position:fixed;top:1rem;right:1.5rem;z-index:9999;padding:0.75rem 1.25rem;border-radius:8px;display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;box-shadow:0 4px 16px rgba(0,0,0,.15);animation:fadeUp .2s ease;}
    .toast-success{background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;}
    .toast-error  {background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}

    /* Controls */
    .controls-bar{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;}
    .ctrl-left{display:flex;align-items:center;gap:0.75rem;}
    .ctrl-left label{font-size:0.85rem;font-weight:600;color:#475569;white-space:nowrap;}
    .ctrl-right{display:flex;gap:0.5rem;}
    .form-control{border:1.5px solid #e2e8f0;border-radius:8px;padding:0.5rem 0.75rem;font-size:0.875rem;outline:none;font-family:inherit;}
    .form-control:focus{border-color:#4f46e5;}
    .btn{padding:0.5rem 1rem;border-radius:8px;font-size:0.875rem;font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;gap:0.4rem;transition:all .15s;}
    .btn-primary{background:#4f46e5;color:#fff;}.btn-primary:hover:not(:disabled){background:#4338ca;}.btn-primary:disabled{opacity:.5;cursor:not-allowed;}
    .btn-outline{background:#fff;color:#475569;border:1.5px solid #e2e8f0;}.btn-outline:hover{background:#f1f5f9;}

    /* Duplicate panel */
    .dup-card{margin-bottom:1.25rem;}
    .dup-card h3{font-size:1rem;font-weight:700;margin-bottom:0.3rem;display:flex;align-items:center;gap:0.5rem;}
    .dup-card p{font-size:0.82rem;color:#64748b;margin-bottom:1rem;}
    .dup-row{display:flex;align-items:flex-end;gap:0.75rem;flex-wrap:wrap;}
    .form-group{display:flex;flex-direction:column;gap:0.3rem;}
    .form-group label{font-size:0.78rem;font-weight:600;color:#475569;}
    .dup-arrow{color:#4f46e5;font-size:1.1rem;padding-bottom:0.4rem;}

    /* Edit legend */
    .edit-legend{background:#ede9fe;border:1.5px solid #c4b5fd;border-radius:8px;padding:0.65rem 1rem;margin-bottom:1rem;font-size:0.83rem;color:#4c1d95;display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;}
    .edit-class-tag{background:#7c3aed;color:#fff;padding:0.15rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:700;}

    /* Changes banner */
    .changes-banner{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:1rem 1.25rem;margin-bottom:1.5rem;}
    .cb-title{font-size:0.85rem;font-weight:700;color:#92400e;margin-bottom:0.5rem;}
    .cb-list{display:flex;flex-direction:column;gap:0.3rem;}
    .cb-item{font-size:0.82rem;color:#1e293b;padding:0.3rem 0.5rem;border-radius:5px;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;}
    .cb-cancelled{background:#fee2e2;}.cb-available{background:#d1fae5;}
    .cb-status{font-weight:700;font-size:0.78rem;}.cb-teacher{color:#64748b;font-size:0.75rem;}

    /* Class tables */
    .class-section{margin-bottom:2rem;}
    .class-header{display:flex;align-items:center;gap:1rem;margin-bottom:0.75rem;padding-bottom:0.5rem;border-bottom:2px solid #e2e8f0;}
    .class-header h2{font-size:1.2rem;font-weight:800;color:#4f46e5;display:flex;align-items:center;gap:0.5rem;margin:0;}
    .badge-info-sm{background:#dbeafe;color:#1d4ed8;padding:0.2rem 0.6rem;border-radius:6px;font-size:0.75rem;font-weight:600;}
    .day-card{margin-bottom:0.75rem;padding:0;overflow:hidden;}
    .day-hdr{display:flex;align-items:center;justify-content:space-between;padding:0.6rem 1rem;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
    .day-name{font-weight:700;color:#1e293b;font-size:0.9rem;}.day-count{font-size:0.75rem;color:#64748b;}
    table{width:100%;border-collapse:collapse;font-size:0.85rem;}
    thead th{padding:0.5rem 0.85rem;text-align:left;font-weight:600;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;}
    tbody td{padding:0.6rem 0.85rem;border-bottom:1px solid #f1f5f9;vertical-align:middle;}
    tbody tr:last-child td{border-bottom:none;}
    tr.row-assigned{background:#fff;}tr.row-assigned:hover{background:#f8fafc;}
    tr.row-free{background:#fafafa;opacity:0.75;}
    tr.row-editable{cursor:pointer;}tr.row-editable:hover{background:#ede9fe!important;opacity:1;}
    .p-badge{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;font-size:0.72rem;font-weight:800;color:#fff;background:#4f46e5;}
    .p-free{background:#9ca3af;}
    .time-cell{font-size:0.78rem;color:#64748b;white-space:nowrap;}
    .code{background:#f1f5f9;color:#64748b;padding:0.1rem 0.35rem;border-radius:4px;font-size:0.7rem;margin-left:0.35rem;}
    .room-pill{display:inline-flex;align-items:center;gap:0.25rem;background:#ede9fe;color:#5b21b6;padding:0.15rem 0.5rem;border-radius:6px;font-size:0.75rem;font-weight:600;}
    .room-pill.room-tbd{background:#f3f4f6;color:#9ca3af;}
    .badge-ok{background:#d1fae5;color:#065f46;padding:0.15rem 0.5rem;border-radius:6px;font-size:0.72rem;font-weight:600;}
    .free-cell{color:#9ca3af;font-size:0.82rem;}
    .add-hint{color:#7c3aed;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:0.3rem;}

    /* Edit action buttons */
    .edit-action-btns{display:flex;gap:0.3rem;}
    .btn-cell-edit,.btn-cell-del{border:none;border-radius:5px;padding:0.2rem 0.45rem;cursor:pointer;font-size:0.75rem;transition:all .15s;}
    .btn-cell-edit{background:#ede9fe;color:#4f46e5;}.btn-cell-edit:hover{background:#7c3aed;color:#fff;}
    .btn-cell-del {background:#fee2e2;color:#dc2626;}.btn-cell-del:hover{background:#dc2626;color:#fff;}

    /* Inline edit controls */
    .inline-ctrl{border:1.5px solid #7c3aed;border-radius:6px;padding:0.3rem 0.5rem;font-size:0.8rem;outline:none;font-family:inherit;width:100%;}
    .inline-btns{display:flex;gap:0.3rem;}
    .btn-save-inline,.btn-cancel-inline{border:none;border-radius:5px;padding:0.3rem 0.6rem;cursor:pointer;font-size:0.8rem;font-weight:700;}
    .btn-save-inline{background:#4f46e5;color:#fff;}.btn-save-inline:disabled{opacity:.5;}
    .btn-cancel-inline{background:#f1f5f9;color:#475569;}

    /* Empty + loading */
    .loading-center{display:flex;justify-content:center;padding:4rem;}
    .spinner{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#4f46e5;border-radius:50%;animation:spin .7s linear infinite;}
    @keyframes spin{to{transform:rotate(360deg)}}
    .empty-state{text-align:center;padding:3rem 2rem;display:flex;flex-direction:column;align-items:center;gap:0.75rem;color:#9ca3af;}
    .empty-state i{font-size:3rem;display:block;}
    .empty-state p{margin:0;font-size:0.9rem;}
  `]
})
export class AdminTimetableComponent implements OnInit {
  allSlots   = ALL_SLOTS;
  days       = DAYS;
  classList: string[]  = [];
  activeClass = '';
  filterClass = ''; // keep for backward compat
  grouped: Record<string, Record<string, any[]>> = {};
  todayChanges: any[] = [];
  loading    = true;

  // Feature 3 — Edit mode
  editMode     = false;
  subjects:  any[] = [];
  teachers:  any[] = [];
  saving     = false;
  toast: 'ok'|'err'|'' = '';
  toastMsg   = '';

  // Inline edit state: key = cls+day+period
  editingKey = '';
  editForm = { subjectName: '', teacherEmail: '', classroomNo: '' };

  // Duplicate panel
  showDuplicate = false;
  dupSource     = '';
  dupTarget     = '';
  dupOverwrite  = false;
  dupSaving     = false;

  get classKeys(): string[] {
    if (this.activeClass && this.grouped[this.activeClass]) return [this.activeClass];
    if (this.activeClass && !this.grouped[this.activeClass])  return [];
    return Object.keys(this.grouped);
  }

  constructor(private adminSvc: AdminService, private authSvc: AuthService) {}

  ngOnInit(): void {
    this.loadClasses();
    // Load subjects & teachers immediately so dropdowns are ready
    // before the user clicks Edit (fixes empty dropdown bug)
    this.loadSubjectsTeachers();
  }

  loadClasses(): void {
    this.adminSvc.getTimetableClasses().subscribe({
      next: (r: any) => {
        this.classList = r.classes || [];
        this.loadOverview();
      },
      error: () => { this.classList = ['CSE-A','CSE-B','ECE-A','MECH-A']; this.loadOverview(); }
    });
  }

  loadOverview(): void {
    this.loading = true;
    this.adminSvc.getTimetableOverview(this.activeClass || undefined).subscribe({
      next: (r: any) => {
        this.grouped      = r.grouped || {};
        this.todayChanges = r.todayChanges || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onClassChange(): void {
    this.editMode = false; this.cancelEdit();
    this.loadOverview();
  }

  toggleEdit(): void {
    this.editMode = !this.editMode;
    // subjects/teachers already loaded in ngOnInit; reload if somehow empty
    if (this.editMode && this.subjects.length === 0) this.loadSubjectsTeachers();
    if (!this.editMode) this.cancelEdit();
  }

  toggleDuplicate(): void { this.showDuplicate = !this.showDuplicate; }

  loadSubjectsTeachers(): void {
    this.adminSvc.getSubjectsAndTeachers().subscribe({
      next: (r: any) => { this.subjects = r.subjects || []; this.teachers = r.teachers || []; }
    });
  }

  getDayEntries(cls: string, day: string): any[] { return (this.grouped[cls]?.[day] || []); }
  getEntry(cls: string, day: string, n: number): any {
    return this.getDayEntries(cls, day).find((e: any) => e.periodNumber === n) || null;
  }
  countEntries(cls: string): number {
    return Object.values(this.grouped[cls] || {}).reduce((s, arr) => s + arr.length, 0);
  }

  isEditing(cls: string, day: string, n: number): boolean {
    return this.editingKey === `${cls}|${day}|${n}`;
  }

  openAdd(cls: string, day: string, n: number): void {
    this.editingKey = `${cls}|${day}|${n}`;
    this.editForm   = { subjectName: '', teacherEmail: '', classroomNo: 'TBD' };
  }

  openEdit(cls: string, day: string, n: number, entry: any): void {
    this.editingKey = `${cls}|${day}|${n}`;
    this.editForm   = {
      subjectName:   entry.subject?.name || '',
      teacherEmail:  entry.teacher?.email || '',
      classroomNo:   entry.classroomNo || 'TBD'
    };
  }

  cancelEdit(): void { this.editingKey = ''; this.editForm = { subjectName: '', teacherEmail: '', classroomNo: '' }; }

  saveEntry(cls: string, day: string, n: number): void {
    if (!this.editForm.subjectName || !this.editForm.teacherEmail) {
      this.showToast('err', 'Subject and teacher are required'); return;
    }
    this.saving = true;
    this.adminSvc.upsertTimetableEntry({
      className:    cls,
      dayOfWeek:    day,
      periodNumber: n,
      subjectName:  this.editForm.subjectName,
      teacherEmail: this.editForm.teacherEmail,
      classroomNo:  this.editForm.classroomNo || 'TBD',
    }).subscribe({
      next: () => {
        this.saving = false; this.cancelEdit();
        this.showToast('ok', `P${n} ${day} saved for ${cls}`);
        this.loadOverview();
      },
      error: (e: any) => {
        this.saving = false;
        this.showToast('err', e?.error?.message || 'Failed to save entry');
      }
    });
  }

  deleteEntry(cls: string, day: string, n: number): void {
    if (!confirm(`Delete P${n} ${day} for ${cls}? This cannot be undone.`)) return;
    this.adminSvc.deleteTimetableEntry({ className: cls, dayOfWeek: day, periodNumber: n }).subscribe({
      next: () => { this.showToast('ok', `P${n} ${day} deleted`); this.loadOverview(); },
      error: (e: any) => this.showToast('err', e?.error?.message || 'Failed to delete')
    });
  }

  executeDuplicate(): void {
    if (!this.dupSource || !this.dupTarget) return;
    this.dupSaving = true;
    this.adminSvc.duplicateTimetable({ sourceClass: this.dupSource, targetClass: this.dupTarget, overwrite: this.dupOverwrite }).subscribe({
      next: (r: any) => {
        this.dupSaving = false; this.showDuplicate = false;
        this.showToast('ok', r.message || 'Duplicated');
        if (!this.classList.includes(this.dupTarget)) this.classList.push(this.dupTarget);
        this.activeClass = this.dupTarget;
        this.loadOverview();
      },
      error: (e: any) => { this.dupSaving = false; this.showToast('err', e?.error?.message || 'Duplication failed'); }
    });
  }

  initEmptyClass(): void {
    // Initialize empty grouped structure so the days render
    if (!this.grouped[this.activeClass]) {
      this.grouped[this.activeClass] = {};
      for (const d of this.days) this.grouped[this.activeClass][d] = [];
    }
    if (this.subjects.length === 0) this.loadSubjectsTeachers();
  }

  showToast(type: 'ok'|'err', msg: string): void {
    this.toast = type; this.toastMsg = msg;
    setTimeout(() => { this.toast = ''; }, 3500);
  }

  logout(): void { this.authSvc.logout(); }
}
