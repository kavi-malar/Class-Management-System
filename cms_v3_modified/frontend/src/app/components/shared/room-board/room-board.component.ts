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
        <span class="rb-subtitle">Rooms 101 – 130 · Live Status</span>
      </div>
      <div class="rb-stats">
        <div class="rb-stat rb-stat-free">
          <span class="rb-stat-num">{{ freeCount }}</span>
          <span class="rb-stat-lbl">Free</span>
        </div>
        <div class="rb-stat rb-stat-occ">
          <span class="rb-stat-num">{{ occupiedCount }}</span>
          <span class="rb-stat-lbl">Occupied</span>
        </div>
        <div class="rb-stat rb-stat-proj">
          <i class="fas fa-tv"></i>
          <span class="rb-stat-num">{{ availableProjectors }}/{{ totalProjectors }}</span>
          <span class="rb-stat-lbl">Projectors Free</span>
        </div>
        <button class="rb-refresh" (click)="load()" title="Refresh">
          <i class="fas fa-sync-alt" [class.fa-spin]="loading"></i>
        </button>
      </div>
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
      <span class="leg-item"><span class="leg-dot leg-free"></span> Free</span>
      <span class="leg-item"><span class="leg-dot leg-occ"></span> Occupied</span>
      <span class="leg-item"><i class="fas fa-tv leg-proj-icon"></i> Projector present</span>
      <span class="leg-note" *ngIf="canEdit">
        <i class="fas fa-info-circle"></i>
        Click a free room to occupy · Click an occupied room to free it
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
           [class.rb-cell-occ]="room.status === 'occupied'"
           [class.rb-cell-clickable]="canEdit"
           (click)="canEdit && onCellClick(room)">

        <div class="rb-cell-top">
          <span class="rb-room-no">{{ room.roomNumber }}</span>
          <span class="rb-proj-badge" *ngIf="room.projectorPresent" title="Projector here">
            <i class="fas fa-tv"></i>
          </span>
        </div>

        <div class="rb-cell-status">
          <span class="rb-dot" [class.rb-dot-free]="room.status === 'free'" [class.rb-dot-occ]="room.status === 'occupied'"></span>
          {{ room.status === 'occupied' ? 'Active' : 'Free' }}
        </div>

        <div class="rb-cell-class" *ngIf="room.status === 'occupied'">
          {{ room.occupancyLabel || room.occupiedByClass }}
        </div>
        <div class="rb-cell-class rb-cell-empty" *ngIf="room.status === 'free'">
          —
        </div>

        <!-- Projector button (CR only, occupied rooms) -->
        <div class="rb-proj-row" *ngIf="isCR && room.status === 'occupied'" (click)="$event.stopPropagation()">
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
          <h3><i class="fas fa-door-open"></i> Occupy Room {{ selectedRoom?.roomNumber }}</h3>
          <button class="rb-modal-close" (click)="closeModal()"><i class="fas fa-times"></i></button>
        </div>
        <div class="rb-modal-body">
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
        </div>
        <div class="rb-modal-footer">
          <button class="btn btn-secondary" (click)="closeModal()">Cancel</button>
          <button class="btn btn-primary" (click)="confirmOccupy()" [disabled]="!occupyClass || saving">
            <i class="fas fa-check"></i> {{ saving ? 'Saving…' : 'Confirm Occupy' }}
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
    .rb-stat-free { background:#d1fae5; color:#065f46; }
    .rb-stat-occ  { background:#fee2e2; color:#991b1b; }
    .rb-stat-proj { background:#ede9fe; color:#5b21b6; }
    .rb-stat-num  { font-size: 1rem; font-weight: 800; }
    .rb-stat-lbl  { font-size: 0.72rem; font-weight: 500; }
    .rb-refresh { background: #f1f5f9; border: 1px solid #e2e8f0; color: #475569;
                  width: 34px; height: 34px; border-radius: 8px; cursor: pointer;
                  display: flex; align-items: center; justify-content: center; transition: all .2s; }
    .rb-refresh:hover { background: #e2e8f0; }

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
    .leg-free  { background: #22c55e; }
    .leg-occ   { background: #ef4444; }
    .leg-proj-icon { color: #7c3aed; font-size: 0.85rem; }
    .leg-note  { background: #f8fafc; padding: 0.25rem 0.65rem; border-radius: 6px;
                 border: 1px solid #e2e8f0; font-size: 0.75rem; color: #64748b;
                 display: flex; align-items: center; gap: 0.35rem; }

    /* Grid */
    .rb-loading { display: flex; justify-content: center; padding: 3rem; }
    .spinner { width: 36px; height: 36px; border: 3px solid #e2e8f0;
               border-top-color: #4f46e5; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to{transform:rotate(360deg)} }

    .rb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.6rem; }

    .rb-cell { border: 2px solid #e2e8f0; border-radius: 10px; padding: 0.65rem 0.75rem;
               background: #fff; transition: all .2s; min-height: 90px;
               display: flex; flex-direction: column; gap: 0.2rem; }
    .rb-cell-free { border-color: #86efac; background: #f0fdf4; }
    .rb-cell-occ  { border-color: #fca5a5; background: #fff5f5; }
    .rb-cell-clickable { cursor: pointer; }
    .rb-cell-clickable:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }

    .rb-cell-top { display: flex; align-items: center; justify-content: space-between; }
    .rb-room-no  { font-size: 1rem; font-weight: 800; color: #1e293b; }
    .rb-proj-badge { background: #ede9fe; color: #5b21b6; border-radius: 4px;
                     padding: 0.1rem 0.35rem; font-size: 0.7rem; }

    .rb-cell-status { display: flex; align-items: center; gap: 0.3rem;
                      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
                      letter-spacing: 0.04em; color: #64748b; }
    .rb-dot { width: 8px; height: 8px; border-radius: 50%; }
    .rb-dot-free { background: #22c55e; }
    .rb-dot-occ  { background: #ef4444; }

    .rb-cell-class { font-size: 0.78rem; font-weight: 600; color: #1e293b;
                     overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rb-cell-empty { color: #9ca3af; font-weight: 400; }

    .rb-proj-row   { margin-top: 0.3rem; }
    .rb-proj-btn   { width: 100%; border: none; border-radius: 5px; font-size: 0.7rem;
                     font-weight: 600; padding: 0.2rem 0.4rem; cursor: pointer;
                     display: flex; align-items: center; justify-content: center; gap: 0.25rem;
                     transition: all .15s; }
    .rb-proj-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .rb-proj-checkout { background: #ede9fe; color: #5b21b6; }
    .rb-proj-checkout:not(:disabled):hover { background: #7c3aed; color: #fff; }
    .rb-proj-return   { background: #fef3c7; color: #92400e; }
    .rb-proj-return:hover { background: #d97706; color: #fff; }

    /* Modal */
    .rb-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 1000;
                         display: flex; align-items: center; justify-content: center; }
    .rb-modal { background: #fff; border-radius: 14px; width: 420px; max-width: 95vw;
                box-shadow: 0 20px 60px rgba(0,0,0,.25); }
    .rb-modal-header { display: flex; align-items: center; justify-content: space-between;
                       padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; }
    .rb-modal-header h3 { font-size: 1.05rem; font-weight: 700; margin: 0;
                          display: flex; align-items: center; gap: 0.5rem; }
    .rb-modal-close { background: none; border: none; font-size: 1rem; cursor: pointer;
                      color: #64748b; padding: 0.25rem; border-radius: 4px; }
    .rb-modal-close:hover { background: #f1f5f9; }
    .rb-modal-body   { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
    .rb-modal-footer { padding: 1rem 1.5rem; border-top: 1px solid #e2e8f0;
                       display: flex; justify-content: flex-end; gap: 0.6rem; }
    .form-group small { color: #9ca3af; font-size: 0.75rem; margin-top: 0.2rem; display: block; }
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

  // Modal state
  showModal    = false;
  selectedRoom: any = null;
  occupyClass  = '';
  occupyLabel  = '';
  saving       = false;

  private refreshTimer: any;

  constructor(private roomSvc: RoomService, private authSvc: AuthService) {}

  get canEdit(): boolean { return ['teacher','cr'].includes(this.authSvc.currentUser?.role || ''); }
  get isCR(): boolean    { return this.authSvc.currentUser?.role === 'cr'; }
  get freeCount():     number { return this.rooms.filter(r => r.status === 'free').length; }
  get occupiedCount(): number { return this.rooms.filter(r => r.status === 'occupied').length; }

  ngOnInit(): void {
    this.load();
    // Auto-refresh every 30 seconds
    this.refreshTimer = setInterval(() => this.load(), 30000);
  }
  ngOnDestroy(): void { clearInterval(this.refreshTimer); }

  load(): void {
    this.loading = true;
    this.roomSvc.getRooms().subscribe({
      next: (r: any) => {
        this.rooms               = r.rooms || [];
        this.totalProjectors     = r.projectorInventory?.totalProjectors || 0;
        this.availableProjectors = r.projectorInventory?.availableProjectors || 0;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  onCellClick(room: any): void {
    if (!this.canEdit) return;
    if (room.status === 'free') {
      this.selectedRoom = room;
      this.occupyClass  = this.authSvc.currentUser?.className || '';
      this.occupyLabel  = '';
      this.showModal    = true;
    } else {
      this.freeRoom(room);
    }
  }

  closeModal(): void { this.showModal = false; this.selectedRoom = null; }

  confirmOccupy(): void {
    if (!this.occupyClass || !this.selectedRoom) return;
    this.saving = true;
    const label = this.occupyLabel.trim() || this.occupyClass;
    this.roomSvc.occupyRoom(this.selectedRoom.roomNumber, this.occupyClass, label).subscribe({
      next: (r: any) => {
        this.saving = false; this.closeModal();
        this.updateRoom(r.room);
        this.showToast('ok', `Room ${r.room.roomNumber} occupied by ${this.occupyClass}`);
      },
      error: (e: any) => {
        this.saving = false;
        this.showToast('err', e?.error?.message || 'Failed to occupy room');
      }
    });
  }

  freeRoom(room: any): void {
    if (!confirm(`Free room ${room.roomNumber}? (${room.occupiedByClass})`)) return;
    this.roomSvc.freeRoom(room.roomNumber).subscribe({
      next: (r: any) => {
        this.updateRoom(r.room);
        if (room.projectorPresent) this.availableProjectors = Math.min(this.totalProjectors, this.availableProjectors + 1);
        this.showToast('ok', `Room ${room.roomNumber} is now free`);
      },
      error: (e: any) => this.showToast('err', e?.error?.message || 'Failed')
    });
  }

  checkoutProjector(room: any): void {
    this.roomSvc.checkoutProjector(room.roomNumber).subscribe({
      next: (r: any) => {
        this.updateRoom(r.room);
        this.availableProjectors = r.projectorInventory?.availableProjectors ?? this.availableProjectors - 1;
        this.showToast('ok', `Projector checked out to Room ${room.roomNumber}`);
      },
      error: (e: any) => this.showToast('err', e?.error?.message || 'No projectors available')
    });
  }

  returnProjector(room: any): void {
    this.roomSvc.returnProjector(room.roomNumber).subscribe({
      next: (r: any) => {
        this.updateRoom(r.room);
        this.availableProjectors = r.projectorInventory?.availableProjectors ?? this.availableProjectors + 1;
        this.showToast('ok', `Projector returned from Room ${room.roomNumber}`);
      },
      error: (e: any) => this.showToast('err', e?.error?.message || 'Failed')
    });
  }

  private updateRoom(updated: any): void {
    const idx = this.rooms.findIndex(r => r.roomNumber === updated.roomNumber);
    if (idx >= 0) this.rooms[idx] = updated;
  }

  showToast(type: 'ok'|'err', msg: string): void {
    this.toast = type; this.toastMsg = msg;
    setTimeout(() => { this.toast = ''; }, 3500);
  }
}
