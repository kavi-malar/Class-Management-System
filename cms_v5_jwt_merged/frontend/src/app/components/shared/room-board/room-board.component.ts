import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../../services/room.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-room-board',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── Header ── -->
    <div class="rb-header">
      <div class="rb-title">
        <i class="fas fa-building"></i> Room Allocation Board
        <span class="rb-subtitle">Rooms 101–130 · Live Status</span>
      </div>
      <div class="rb-stats">
        <div class="rb-stat rb-stat-free">
          <span class="rb-stat-num">{{ counters.available }}</span>
          <span class="rb-stat-lbl">Available</span>
        </div>
        <div class="rb-stat rb-stat-occ">
          <span class="rb-stat-num">{{ counters.occupied }}</span>
          <span class="rb-stat-lbl">Occupied</span>
        </div>
        <div class="rb-stat rb-stat-manual">
          <i class="fas fa-hand-paper"></i>
          <span class="rb-stat-num">{{ counters.manualBookings }}</span>
          <span class="rb-stat-lbl">Manual</span>
        </div>
        <div class="rb-stat rb-stat-lab" *ngIf="counters.labOccupied > 0">
          <i class="fas fa-flask"></i>
          <span class="rb-stat-num">{{ counters.labOccupied }}</span>
          <span class="rb-stat-lbl">Lab</span>
        </div>
        <div class="rb-stat rb-stat-extra" *ngIf="counters.extraClassOccupied > 0">
          <i class="fas fa-plus-circle"></i>
          <span class="rb-stat-num">{{ counters.extraClassOccupied }}</span>
          <span class="rb-stat-lbl">Extra</span>
        </div>
        <div class="rb-stat rb-stat-proj">
          <i class="fas fa-tv"></i>
          <span class="rb-stat-num">{{ availableProjectors }}/{{ totalProjectors }}</span>
          <span class="rb-stat-lbl">Projectors</span>
        </div>
        <button class="rb-refresh" (click)="load()" title="Refresh">
          <i class="fas fa-sync-alt" [class.fa-spin]="loading"></i>
        </button>
      </div>
    </div>

    <!-- ── Period Banner ── -->
    <div class="rb-period-banner" *ngIf="meta.currentPeriod">
      <i class="fas fa-clock"></i>
      Period {{ meta.currentPeriod }} &nbsp;·&nbsp;
      {{ meta.periodInfo?.start }} – {{ meta.periodInfo?.end }} &nbsp;·&nbsp;
      {{ meta.dayName }}
      <span class="rb-last-updated">Updated: {{ lastUpdated }}</span>
    </div>
    <div class="rb-period-banner rb-period-free" *ngIf="!meta.currentPeriod && !loading">
      <i class="fas fa-coffee"></i> No active period — showing manual bookings only
      <span class="rb-last-updated">Updated: {{ lastUpdated }}</span>
    </div>

    <!-- ── Toast ── -->
    <div class="rb-toast rb-toast-success" *ngIf="toast === 'ok'">
      <i class="fas fa-check-circle"></i> {{ toastMsg }}
    </div>
    <div class="rb-toast rb-toast-error" *ngIf="toast === 'err'">
      <i class="fas fa-times-circle"></i> {{ toastMsg }}
    </div>

    <!-- ── Legend ── -->
    <div class="rb-legend">
      <span class="leg-item"><span class="leg-dot leg-free"></span> Available</span>
      <span class="leg-item"><span class="leg-dot leg-occ"></span> Timetable</span>
      <span class="leg-item"><span class="leg-dot leg-manual"></span> Manual Booking</span>
      <span class="leg-item"><span class="leg-dot leg-lab"></span> Lab</span>
      <span class="leg-item"><span class="leg-dot leg-extra"></span> Extra Class</span>
      <span class="leg-item"><i class="fas fa-tv leg-proj-icon"></i> Projector</span>
      <span class="leg-note" *ngIf="canEdit">
        <i class="fas fa-info-circle"></i>
        Click free room to manually book · Click manual booking to release
      </span>
      <span class="leg-note" *ngIf="!canEdit">
        <i class="fas fa-eye"></i> View only
      </span>
    </div>

    <!-- ── Room Grid ── -->
    <div class="rb-loading" *ngIf="loading"><div class="spinner"></div></div>

    <div class="rb-grid" *ngIf="!loading">
      <div *ngFor="let room of rooms"
           class="rb-cell"
           [class.rb-cell-free]="room.status === 'free'"
           [class.rb-cell-occ]="room.status === 'occupied' && (room.source === 'timetable' || room.source === 'extra_class')"
           [class.rb-cell-manual]="room.status === 'occupied' && room.source === 'manual'"
           [class.rb-cell-lab]="room.source === 'lab'"
           [class.rb-cell-clickable]="canEdit && (room.status === 'free' || room.isManualBooking)"
           (click)="canEdit && onCellClick(room)">

        <div class="rb-cell-top">
          <span class="rb-room-no">{{ room.roomNumber }}</span>
          <div class="rb-badges">
            <span class="rb-proj-badge" *ngIf="room.projectorPresent" title="Projector here">
              <i class="fas fa-tv"></i>
            </span>
            <span class="rb-src-badge rb-src-manual"  *ngIf="room.source === 'manual'"      title="CR Manual Booking">M</span>
            <span class="rb-src-badge rb-src-lab"     *ngIf="room.source === 'lab'"          title="Lab Period">L</span>
            <span class="rb-src-badge rb-src-tt"      *ngIf="room.source === 'timetable'"    title="From Timetable">T</span>
            <span class="rb-src-badge rb-src-extra"   *ngIf="room.source === 'extra_class'"  title="Extra Class">E</span>
          </div>
        </div>

        <div class="rb-cell-status">
          <span class="rb-dot"
            [class.rb-dot-free]="room.status === 'free'"
            [class.rb-dot-occ]="room.status === 'occupied' && room.source !== 'manual' && room.source !== 'lab'"
            [class.rb-dot-manual]="room.source === 'manual'"
            [class.rb-dot-lab]="room.source === 'lab'"></span>
          {{ room.status === 'occupied' ? (room.source === 'manual' ? 'Manual' : room.source === 'lab' ? 'Lab' : room.source === 'extra_class' ? 'Extra Class' : 'Occupied') : 'Free' }}
        </div>

        <div class="rb-cell-class" *ngIf="room.status === 'occupied'">
          {{ room.occupancyLabel || room.occupiedBy }}
        </div>
        <div class="rb-cell-class rb-cell-empty" *ngIf="room.status === 'free'">—</div>

        <!-- Source label -->
        <div class="rb-cell-source" *ngIf="room.status === 'occupied'">
          <span *ngIf="room.source === 'manual'">📌 CR Booked</span>
          <span *ngIf="room.source === 'timetable'">📅 Timetable · P{{ room.currentPeriod }}</span>
          <span *ngIf="room.source === 'lab'">🧪 Lab · P{{ room.currentPeriod }}</span>
          <span *ngIf="room.source === 'extra_class'">📗 Extra Class · P{{ room.currentPeriod }}</span>
        </div>

        <!-- Projector button (CR only, occupied rooms that are manually booked) -->
        <div class="rb-proj-row" *ngIf="isCR && room.status === 'occupied' && room.isManualBooking" (click)="$event.stopPropagation()">
          <button *ngIf="!room.projectorPresent" class="rb-proj-btn rb-proj-checkout"
                  (click)="checkoutProjector(room)" [disabled]="availableProjectors === 0"
                  title="Check out projector to this room">
            <i class="fas fa-tv"></i> +Projector
          </button>
          <button *ngIf="room.projectorPresent" class="rb-proj-btn rb-proj-return"
                  (click)="returnProjector(room)"
                  title="Return projector from this room">
            <i class="fas fa-undo"></i> Return
          </button>
        </div>
      </div>
    </div>

    <!-- ── Occupy Modal ── -->
    <div class="rb-modal-backdrop" *ngIf="showModal" (click)="closeModal()">
      <div class="rb-modal" (click)="$event.stopPropagation()">
        <div class="rb-modal-header">
          <h3><i class="fas fa-door-open"></i> Manually Book Room {{ selectedRoom?.roomNumber }}</h3>
          <button class="rb-modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="rb-modal-body">
          <div class="rb-modal-note">
            <i class="fas fa-info-circle"></i>
            Manual booking overrides timetable. Only you (CR) can release it.
          </div>
          <div class="form-group">
            <label>Class / Section *</label>
            <select class="form-control" [(ngModel)]="occupyClass">
              <option value="">— Select class —</option>
              <option *ngFor="let c of classList" [value]="c">{{ c }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>Label (shown in board)</label>
            <input class="form-control" [(ngModel)]="occupyLabel"
                   placeholder="e.g. CSE-A | Batch-1 | Math Lab" />
            <small>If blank, class name is used</small>
          </div>
          <div class="form-group">
            <label>Note (optional)</label>
            <input class="form-control" [(ngModel)]="occupyNote"
                   placeholder="e.g. Extra class, Exam, etc." />
          </div>
        </div>
        <div class="rb-modal-footer">
          <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
          <button class="btn btn-primary" (click)="confirmOccupy()" [disabled]="!occupyClass || saving">
            <i class="fas fa-hand-paper"></i> {{ saving ? 'Saving…' : 'Confirm Manual Booking' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Header */
    .rb-header { display: flex; align-items: center; justify-content: space-between;
                 flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
    .rb-title  { font-size: 1.1rem; font-weight: 700; color: #1e293b;
                 display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .rb-subtitle { font-size: 0.78rem; font-weight: 400; color: #64748b; }
    .rb-stats  { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .rb-stat   { display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem;
                 border-radius: 8px; font-size: 0.82rem; font-weight: 600; }
    .rb-stat-free   { background:#d1fae5; color:#065f46; }
    .rb-stat-occ    { background:#fee2e2; color:#991b1b; }
    .rb-stat-manual { background:#fef9c3; color:#854d0e; }
    .rb-stat-lab    { background:#ede9fe; color:#4c1d95; }
    .rb-stat-extra  { background:#d1fae5; color:#065f46; }
    .rb-stat-proj   { background:#e0f2fe; color:#075985; }
    .rb-stat-num  { font-size: 1rem; font-weight: 800; }
    .rb-stat-lbl  { font-size: 0.72rem; font-weight: 500; }
    .rb-refresh { background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569;
                  width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
                  display: flex; align-items: center; justify-content: center; transition: all .2s; }
    .rb-refresh:hover { background: #e2e8f0; }

    /* Period Banner */
    .rb-period-banner { display: flex; align-items: center; gap: 0.5rem;
                        background: #1e293b; color: #f8fafc;
                        padding: 0.5rem 1rem; border-radius: 8px;
                        font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem; }
    .rb-period-free { background: #64748b; }
    .rb-last-updated { margin-left: auto; font-size: 0.72rem; font-weight: 400; opacity: 0.7; }

    /* Toast */
    .rb-toast { position: fixed; top: 1.2rem; right: 1.5rem; z-index: 9999;
                padding: 0.75rem 1.25rem; border-radius: 8px;
                display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem;
                box-shadow: 0 4px 16px rgba(0,0,0,.15); animation: fadeUp .2s ease; }
    .rb-toast-success { background:#d1fae5; color:#065f46; border:1px solid #6ee7b7; }
    .rb-toast-error   { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }

    /* Legend */
    .rb-legend { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
                 margin-bottom: 1.25rem; font-size: 0.8rem; color: #475569; }
    .leg-item  { display: flex; align-items: center; gap: 0.35rem; }
    .leg-dot   { width: 10px; height: 10px; border-radius: 50%; }
    .leg-free   { background: #22c55e; }
    .leg-occ    { background: #ef4444; }
    .leg-manual { background: #f59e0b; }
    .leg-lab    { background: #7c3aed; }
    .leg-extra  { background: #10b981; }
    .leg-proj-icon { color: #0369a1; font-size: 0.85rem; }
    .leg-note  { background: #f8fafc; padding: 0.25rem 0.65rem; border-radius: 6px;
                 border: 1px solid #e2e8f0; font-size: 0.75rem; }

    /* Loading */
    .rb-loading { display: flex; justify-content: center; padding: 3rem; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0;
               border-top-color: #3b82f6; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Grid */
    .rb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.6rem; }

    .rb-cell { border: 2px solid #e2e8f0; border-radius: 10px; padding: 0.65rem 0.75rem;
               background: #fff; transition: all .2s; min-height: 100px;
               display: flex; flex-direction: column; gap: 0.2rem; }
    .rb-cell-free    { border-color: #86efac; background: #f0fdf4; }
    .rb-cell-occ     { border-color: #fca5a5; background: #fff5f5; }
    .rb-cell-manual  { border-color: #fcd34d; background: #fffbeb; }
    .rb-cell-lab     { border-color: #c4b5fd; background: #f5f3ff; }
    .rb-cell-clickable { cursor: pointer; }
    .rb-cell-clickable:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }

    .rb-cell-top { display: flex; align-items: center; justify-content: space-between; }
    .rb-room-no  { font-size: 1rem; font-weight: 800; color: #1e293b; }
    .rb-badges   { display: flex; align-items: center; gap: 0.2rem; }
    .rb-proj-badge { background: #e0f2fe; color: #075985; border-radius: 4px;
                     padding: 0.1rem 0.35rem; font-size: 0.68rem; }
    .rb-src-badge  { border-radius: 3px; padding: 0.1rem 0.3rem;
                     font-size: 0.65rem; font-weight: 700; }
    .rb-src-manual { background: #fef3c7; color: #92400e; }
    .rb-src-lab    { background: #ede9fe; color: #4c1d95; }
    .rb-src-tt     { background: #fee2e2; color: #991b1b; }
    .rb-src-extra  { background: #d1fae5; color: #065f46; }

    .rb-cell-status { display: flex; align-items: center; gap: 0.3rem;
                      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
                      letter-spacing: 0.04em; color: #64748b; }
    .rb-dot        { width: 8px; height: 8px; border-radius: 50%; }
    .rb-dot-free   { background: #22c55e; }
    .rb-dot-occ    { background: #ef4444; }
    .rb-dot-manual { background: #f59e0b; }
    .rb-dot-lab    { background: #7c3aed; }

    .rb-cell-class  { font-size: 0.78rem; font-weight: 600; color: #1e293b;
                      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rb-cell-empty  { color: #9ca3af; font-weight: 400; }
    .rb-cell-source { font-size: 0.68rem; color: #64748b; margin-top: 0.1rem; }

    .rb-proj-row   { margin-top: 0.3rem; }
    .rb-proj-btn   { width: 100%; border: none; border-radius: 5px; font-size: 0.7rem;
                     font-weight: 600; padding: 0.2rem 0.4rem; cursor: pointer;
                     display: flex; align-items: center; justify-content: center; gap: 0.25rem;
                     transition: all .15s; }
    .rb-proj-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .rb-proj-checkout { background: #e0f2fe; color: #075985; }
    .rb-proj-checkout:not(:disabled):hover { background: #0369a1; color: #fff; }
    .rb-proj-return   { background: #fef3c7; color: #92400e; }
    .rb-proj-return:hover { background: #d97706; color: #fff; }

    /* Modal */
    .rb-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 1000;
                         display: flex; align-items: center; justify-content: center; }
    .rb-modal { background: #fff; border-radius: 14px; width: 440px; max-width: 95vw;
                box-shadow: 0 20px 60px rgba(0,0,0,.25); }
    .rb-modal-header { display: flex; align-items: center; justify-content: space-between;
                       padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
    .rb-modal-header h3 { font-size: 1.05rem; font-weight: 700; margin: 0;
                          display: flex; align-items: center; gap: 0.5rem; }
    .rb-modal-close { background: none; border: none; font-size: 1rem; cursor: pointer;
                      color: #64748b; padding: 0.25rem; border-radius: 4px; }
    .rb-modal-close:hover { background: #f1f5f9; }
    .rb-modal-note { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px;
                     padding: 0.6rem 0.85rem; font-size: 0.8rem; color: #92400e;
                     display: flex; align-items: flex-start; gap: 0.4rem; }
    .rb-modal-body   { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .rb-modal-footer { padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0;
                       display: flex; justify-content: flex-end; gap: 0.6rem; }
    .form-group { display: flex; flex-direction: column; gap: 0.3rem; }
    .form-group label { font-size: 0.82rem; font-weight: 600; color: #374151; }
    .form-control { padding: 0.5rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 7px;
                    font-size: 0.875rem; transition: border-color .15s; }
    .form-control:focus { outline: none; border-color: #3b82f6; }
    .form-group small { color: #9ca3af; font-size: 0.75rem; }
    .btn { padding: 0.5rem 1.1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 600;
           cursor: pointer; border: none; display: flex; align-items: center; gap: 0.35rem; }
    .btn-secondary { background: #f1f5f9; color: #475569; }
    .btn-secondary:hover { background: #e2e8f0; }
    .btn-primary { background: #3b82f6; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #2563eb; }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
  `]
})
export class RoomBoardComponent implements OnInit, OnDestroy {
  @Input() classList: string[] = ['CSE-A','CSE-B','ECE-A','MECH-A'];

  rooms: any[]         = [];
  loading              = true;
  totalProjectors      = 0;
  availableProjectors  = 0;
  toast: 'ok'|'err'|'' = '';
  toastMsg             = '';
  lastUpdated          = '';

  counters = { total: 0, available: 0, occupied: 0, manualBookings: 0, labOccupied: 0, timetableOccupied: 0, extraClassOccupied: 0 };
  meta: any = { currentPeriod: null, periodInfo: null, dayName: '' };

  // Modal state
  showModal    = false;
  selectedRoom: any = null;
  occupyClass  = '';
  occupyLabel  = '';
  occupyNote   = '';
  saving       = false;

  private refreshTimer: any;

  constructor(private roomSvc: RoomService, private authSvc: AuthService) {}

  get canEdit(): boolean { return ['teacher','cr'].includes(this.authSvc.currentUser?.role || ''); }
  get isCR(): boolean    { return this.authSvc.currentUser?.role === 'cr'; }

  ngOnInit(): void {
    this.load();
    // Auto-refresh every 30 seconds
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }
  ngOnDestroy(): void { clearInterval(this.refreshTimer); }

  load(): void {
    this.loading = true;
    this.roomSvc.getRoomStatus().subscribe({
      next: (r: any) => {
        this.rooms               = r.rooms || [];
        this.counters            = r.counters || this.counters;
        this.meta                = r.meta || {};
        this.totalProjectors     = r.projectorInventory?.totalProjectors || 0;
        this.availableProjectors = r.projectorInventory?.availableProjectors || 0;
        this.lastUpdated         = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        this.loading = false;
      },
      error: () => {
        // Fallback to legacy endpoint if new one fails
        this.roomSvc.getRooms().subscribe({
          next: (r: any) => {
            this.rooms               = r.rooms || [];
            this.totalProjectors     = r.projectorInventory?.totalProjectors || 0;
            this.availableProjectors = r.projectorInventory?.availableProjectors || 0;
            // Compute counters from raw rooms
            this.counters.available = this.rooms.filter((x:any) => x.status === 'free').length;
            this.counters.occupied  = this.rooms.filter((x:any) => x.status === 'occupied').length;
            this.counters.total     = this.rooms.length;
            this.loading = false;
          },
          error: () => { this.loading = false; }
        });
      }
    });
  }

  onCellClick(room: any): void {
    if (!this.canEdit) return;
    if (room.status === 'free') {
      this.selectedRoom = room;
      this.occupyClass  = this.authSvc.currentUser?.className || '';
      this.occupyLabel  = '';
      this.occupyNote   = '';
      this.showModal    = true;
    } else if (room.isManualBooking) {
      // Only manual bookings can be released via click
      this.freeRoom(room);
    }
    // Timetable-occupied rooms cannot be freed via this UI
  }

  closeModal(): void { this.showModal = false; this.selectedRoom = null; }

  confirmOccupy(): void {
    if (!this.occupyClass || !this.selectedRoom) return;
    this.saving = true;
    const label = this.occupyLabel.trim() || this.occupyClass;
    this.roomSvc.occupyRoom(this.selectedRoom.roomNumber, this.occupyClass, label, this.occupyNote).subscribe({
      next: () => {
        this.saving = false; this.closeModal();
        this.showToast('ok', `Room ${this.selectedRoom?.roomNumber} manually booked for ${this.occupyClass}`);
        this.load();
      },
      error: (e: any) => {
        this.saving = false;
        this.showToast('err', e?.error?.message || 'Failed to book room');
      }
    });
  }

  freeRoom(room: any): void {
    if (!confirm(`Release manual booking for Room ${room.roomNumber}? (${room.occupiedBy})`)) return;
    this.roomSvc.freeRoom(room.roomNumber).subscribe({
      next: () => {
        this.showToast('ok', `Manual booking for Room ${room.roomNumber} released`);
        this.load();
      },
      error: (e: any) => this.showToast('err', e?.error?.message || 'Failed')
    });
  }

  checkoutProjector(room: any): void {
    this.roomSvc.checkoutProjector(room.roomNumber).subscribe({
      next: (r: any) => {
        this.availableProjectors = r.projectorInventory?.availableProjectors ?? this.availableProjectors - 1;
        this.showToast('ok', `Projector checked out to Room ${room.roomNumber}`);
        this.load();
      },
      error: (e: any) => this.showToast('err', e?.error?.message || 'No projectors available')
    });
  }

  returnProjector(room: any): void {
    this.roomSvc.returnProjector(room.roomNumber).subscribe({
      next: (r: any) => {
        this.availableProjectors = r.projectorInventory?.availableProjectors ?? this.availableProjectors + 1;
        this.showToast('ok', `Projector returned from Room ${room.roomNumber}`);
        this.load();
      },
      error: (e: any) => this.showToast('err', e?.error?.message || 'Failed')
    });
  }

  showToast(type: 'ok'|'err', msg: string): void {
    this.toast = type; this.toastMsg = msg;
    setTimeout(() => { this.toast = ''; }, 3500);
  }
}
