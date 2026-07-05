import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';

type ActionType = 'cancelled' | 'restored' | 'extra_offered' | 'extra_withdrawn' | 'room_updated' | 'all';

@Component({
  selector: 'app-teacher-changes',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <div class="page-header">
        <h1><i class="fas fa-history"></i> My Activity History</h1>
        <p>Complete log of all actions — cancellations, restorations, extra classes, and room changes. Newest first.</p>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar card">
        <div class="filter-group">
          <label><i class="fas fa-filter"></i> Filter by action</label>
          <div class="btn-group">
            <button class="btn btn-sm" [class.btn-primary]="filter==='all'"             (click)="setFilter('all')">All</button>
            <button class="btn btn-sm" [class.btn-danger]="filter==='cancelled'"        [class.btn-secondary]="filter!=='cancelled'"       (click)="setFilter('cancelled')">
              <i class="fas fa-times-circle"></i> Cancelled
            </button>
            <button class="btn btn-sm" [class.btn-success]="filter==='restored'"        [class.btn-secondary]="filter!=='restored'"        (click)="setFilter('restored')">
              <i class="fas fa-undo"></i> Restored
            </button>
            <button class="btn btn-sm" [class.btn-info]="filter==='extra_offered'"      [class.btn-secondary]="filter!=='extra_offered'"   (click)="setFilter('extra_offered')">
              <i class="fas fa-plus-circle"></i> Extra Offered
            </button>
            <button class="btn btn-sm" [class.btn-warning]="filter==='extra_withdrawn'" [class.btn-secondary]="filter!=='extra_withdrawn'" (click)="setFilter('extra_withdrawn')">
              <i class="fas fa-minus-circle"></i> Extra Withdrawn
            </button>
            <button class="btn btn-sm" [class.btn-secondary]="filter!=='room_updated'"  [class.btn-purple]="filter==='room_updated'"       (click)="setFilter('room_updated')">
              <i class="fas fa-map-marker-alt"></i> Room Updated
            </button>
          </div>
        </div>
        <div class="filter-group">
          <label><i class="fas fa-calendar"></i> Filter by date</label>
          <input type="date" class="form-control date-filter" [(ngModel)]="dateFilter" (change)="applyFilters()" />
          <button *ngIf="dateFilter" class="btn btn-secondary btn-sm" (click)="dateFilter=''; applyFilters()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="filter-group">
          <label>&nbsp;</label>
          <span class="count-badge">{{ displayed.length }} record{{ displayed.length !== 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Toast notification -->
      <div class="toast" *ngIf="toast.show" [class.toast-success]="toast.type==='success'" [class.toast-error]="toast.type==='error'">
        <i class="fas" [class.fa-check-circle]="toast.type==='success'" [class.fa-exclamation-circle]="toast.type==='error'"></i>
        {{ toast.message }}
      </div>

      <!-- Table -->
      <div class="card">
        <div *ngIf="loading" class="loading-center"><div class="spinner"></div><p>Loading history...</p></div>

        <div *ngIf="!loading && displayed.length === 0" class="empty-state">
          <i class="fas fa-clipboard-check"></i>
          <p>No activity found for the selected filters.</p>
        </div>

        <div *ngIf="!loading && displayed.length > 0" class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Period</th>
                <th>Time</th>
                <th>Subject</th>
                <th>Class</th>
                <th>Room</th>
                <th>Action</th>
                <th>Details</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of displayed" [class]="rowClass(item)">

                <!-- Date -->
                <td>
                  <div class="date-primary">{{ formatDate(item.date) }}</div>
                  <div class="date-sub">{{ formatDay(item.date) }}</div>
                </td>

                <!-- Period -->
                <td>
                  <span class="p-badge">P{{ item.periodNumber }}</span>
                  <span *ngIf="item.dayOfWeek" class="day-badge">{{ item.dayOfWeek.slice(0,3) }}</span>
                </td>

                <!-- Time -->
                <td class="nowrap">{{ item.startTime }} – {{ item.endTime }}</td>

                <!-- Subject -->
                <td><strong>{{ item.subject?.name || '—' }}</strong></td>

                <!-- Class -->
                <td>{{ item.className || '—' }}</td>

                <!-- Room -->
                <td>
                  <span class="room-pill" [class.room-tbd]="!item.classroomNo || item.classroomNo==='TBD'">
                    <i class="fas fa-map-marker-alt"></i> {{ item.classroomNo || 'TBD' }}
                  </span>
                </td>

                <!-- Action badge -->
                <td>
                  <span class="action-badge" [class]="actionClass(item.actionType)">
                    <i class="fas" [class]="actionIcon(item.actionType)"></i>
                    {{ actionLabel(item.actionType) }}
                  </span>
                </td>

                <!-- Details -->
                <td class="details-cell">
                  <span *ngIf="item.actionType==='cancelled'">
                    {{ item.reason }}
                    <br *ngIf="item.offerable">
                    <span *ngIf="item.offerable && !item.claimedBy" class="offerable-badge offerable-yes">
                      <i class="fas fa-check-circle"></i> Open for extra class
                    </span>
                    <span *ngIf="item.offerable && item.claimedBy" class="offerable-badge offerable-claimed">
                      <i class="fas fa-user-check"></i> Claimed by {{ item.claimedBy?.name }}
                    </span>
                    <span *ngIf="!item.offerable" class="offerable-badge offerable-no">
                      <i class="fas fa-times-circle"></i> Same-day — not offerable
                    </span>
                  </span>
                  <span *ngIf="item.actionType==='restored'">Class restored — students notified</span>
                  <span *ngIf="item.actionType==='extra_offered'">{{ item.note || 'Extra class offered' }}</span>
                  <span *ngIf="item.actionType==='extra_withdrawn'">Extra class withdrawn</span>
                  <span *ngIf="item.actionType==='room_updated'">
                    Classroom set to <strong>{{ item.classroomNo }}</strong> on {{ item.dayOfWeek }}
                  </span>
                </td>

                <!-- Actions column: only for cancellations/restorations -->
                <td class="action-cell">
                  <button
                    *ngIf="item.actionType==='cancelled' && isFuture(item.date)"
                    class="btn btn-success btn-sm action-btn"
                    [disabled]="busy === item._id"
                    (click)="restorePeriod(item)"
                    title="Restore this period"
                  >
                    <i class="fas" [class.fa-circle-notch]="busy===item._id" [class.fa-spin]="busy===item._id" [class.fa-undo]="busy!==item._id"></i>
                    {{ busy === item._id ? '' : 'Restore' }}
                  </button>

                  <button
                    *ngIf="item.actionType==='restored' && isFuture(item.date)"
                    class="btn btn-danger btn-sm action-btn"
                    [disabled]="busy === item._id"
                    (click)="cancelPeriod(item)"
                    title="Cancel this period again"
                  >
                    <i class="fas" [class.fa-circle-notch]="busy===item._id" [class.fa-spin]="busy===item._id" [class.fa-times]="busy!==item._id"></i>
                    {{ busy === item._id ? '' : 'Cancel Again' }}
                  </button>

                  <button
                    *ngIf="item.actionType==='extra_offered'"
                    class="btn btn-warning btn-sm action-btn"
                    [disabled]="busy === item._id"
                    (click)="withdrawExtra(item)"
                    title="Withdraw this extra class"
                  >
                    <i class="fas" [class.fa-circle-notch]="busy===item._id" [class.fa-spin]="busy===item._id" [class.fa-minus]="busy!==item._id"></i>
                    {{ busy === item._id ? '' : 'Withdraw' }}
                  </button>

                  <span *ngIf="!isFuture(item.date) && (item.actionType==='cancelled' || item.actionType==='restored')" class="past-label">
                    <i class="fas fa-lock"></i> Past
                  </span>
                  <span *ngIf="item.actionType==='extra_withdrawn' || item.actionType==='room_updated'" class="past-label">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Legend -->
        <div class="legend" *ngIf="!loading && displayed.length > 0">
          <span class="legend-item"><span class="dot dot-red"></span> Cancelled</span>
          <span class="legend-item"><span class="dot dot-green"></span> Restored</span>
          <span class="legend-item"><span class="dot dot-blue"></span> Extra Class Offered</span>
          <span class="legend-item"><span class="dot dot-orange"></span> Extra Class Withdrawn</span>
          <span class="legend-item"><span class="dot dot-purple"></span> Room Updated</span>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 1250px; margin: 0 auto; padding: 2rem 1.5rem; }

    .filter-bar { display: flex; align-items: flex-end; gap: 2rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .filter-group { display: flex; flex-direction: column; gap: 0.4rem; }
    .filter-group label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; }
    .btn-group { display: flex; gap: 0.35rem; flex-wrap: wrap; }
    .date-filter { width: 170px; padding: 0.45rem 0.75rem; font-size: 0.85rem; }
    .count-badge { background: var(--primary); color: #fff; padding: 0.3rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 600; }

    .toast { padding: 0.85rem 1.1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.875rem; display: flex; align-items: center; gap: 0.6rem; animation: fadeIn 0.3s ease; }
    .toast-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .toast-error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }

    tr.row-cancelled  { background: #fff9f9; }
    tr.row-restored   { background: #f0fdf4; }
    tr.row-extra      { background: #eff6ff; }
    tr.row-withdrawn  { background: #fefce8; }
    tr.row-room       { background: #faf5ff; }

    .date-primary { font-weight: 600; font-size: 0.9rem; }
    .date-sub     { font-size: 0.75rem; color: var(--text-muted); }
    .p-badge      { background: var(--primary); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
    .day-badge    { display: block; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem; }
    .nowrap       { white-space: nowrap; }
    .details-cell { max-width: 200px; font-size: 0.82rem; color: var(--text-muted); }
    .action-cell  { white-space: nowrap; }
    .action-btn   { min-width: 90px; justify-content: center; }
    .past-label   { font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; }

    .room-pill    { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.18rem 0.5rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600; background: #ede9fe; color: #4f46e5; }
    .room-tbd     { background: #f3f4f6; color: #9ca3af; }

    .action-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.22rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
    .ab-cancelled  { background: #fee2e2; color: #991b1b; }
    .ab-restored   { background: #d1fae5; color: #065f46; }
    .ab-extra      { background: #dbeafe; color: #1e40af; }
    .ab-withdrawn  { background: #fef9c3; color: #854d0e; }
    .ab-room       { background: #f3e8ff; color: #6b21a8; }

    .offerable-badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.55rem; border-radius: 6px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
    .offerable-yes     { background: #d1fae5; color: #065f46; }
    .offerable-claimed { background: #ede9fe; color: #4c1d95; }
    .offerable-no      { background: #f3f4f6; color: #6b7280; }

    .btn-info    { background: #3b82f6; color: #fff; border-color: #3b82f6; }
    .btn-warning { background: #f59e0b; color: #fff; border-color: #f59e0b; }
    .btn-purple  { background: #7c3aed; color: #fff; border-color: #7c3aed; }

    .legend { display: flex; gap: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); margin-top: 0.75rem; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--text-muted); }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-red    { background: #ef4444; }
    .dot-green  { background: #22c55e; }
    .dot-blue   { background: #3b82f6; }
    .dot-orange { background: #f59e0b; }
    .dot-purple { background: #7c3aed; }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }
    .empty-state i { font-size: 3rem; opacity: 0.3; display: block; margin-bottom: 1rem; }
  `]
})
export class TeacherChangesComponent implements OnInit {
  all:       any[] = [];
  displayed: any[] = [];
  loading = true;
  busy    = '';
  filter: string = 'all';
  dateFilter = '';

  toast = { show: false, message: '', type: 'success' };

  constructor(private timetableService: TimetableService) {}

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.timetableService.getMyHistory().subscribe({
      next: (res) => {
        this.all = res.history || [];
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        // Fallback to old endpoint
        this.timetableService.getChanges().subscribe({
          next: (res) => {
            this.all = (res.changes || []).map((c: any) => ({
              ...c,
              actionType: c.status === 'cancelled' ? 'cancelled' : 'restored',
              date:       c.changeDate,
              source:     'timetable_change',
            }));
            this.applyFilters();
            this.loading = false;
          },
          error: () => { this.loading = false; }
        });
      }
    });
  }

  setFilter(f: string): void { this.filter = f; this.applyFilters(); }

  applyFilters(): void {
    let list = [...this.all];
    if (this.filter !== 'all') list = list.filter(c => c.actionType === this.filter);
    if (this.dateFilter) {
      list = list.filter(c => {
        const dt = new Date(c.date || c.changeDate || c.slotDate);
        const d = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        return d === this.dateFilter;
      });
    }
    this.displayed = list;
  }

  isFuture(dateVal: any): boolean {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const dt  = new Date(dateVal);
    const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    return target > now;
  }

  formatDate(d: any): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  formatDay(d: any): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { weekday: 'long' });
  }

  actionLabel(t: string): string {
    const map: Record<string, string> = {
      cancelled: 'Cancelled', restored: 'Restored', extra_offered: 'Extra Offered',
      extra_withdrawn: 'Extra Withdrawn', room_updated: 'Room Updated'
    };
    return map[t] || t;
  }
  actionClass(t: string): string {
    const map: Record<string, string> = {
      cancelled: 'action-badge ab-cancelled', restored: 'action-badge ab-restored',
      extra_offered: 'action-badge ab-extra', extra_withdrawn: 'action-badge ab-withdrawn',
      room_updated: 'action-badge ab-room'
    };
    return map[t] || 'action-badge';
  }
  actionIcon(t: string): string {
    const map: Record<string, string> = {
      cancelled: 'fa-times-circle', restored: 'fa-undo', extra_offered: 'fa-plus-circle',
      extra_withdrawn: 'fa-minus-circle', room_updated: 'fa-map-marker-alt'
    };
    return map[t] || 'fa-circle';
  }
  rowClass(item: any): string {
    const map: Record<string, string> = {
      cancelled: 'row-cancelled', restored: 'row-restored', extra_offered: 'row-extra',
      extra_withdrawn: 'row-withdrawn', room_updated: 'row-room'
    };
    return map[item.actionType] || '';
  }

  restorePeriod(item: any): void {
    if (!confirm(`Restore Period ${item.periodNumber} on ${this.formatDate(item.date)}?\nStudents will be notified via SMS.`)) return;
    this.busy = item._id;
    this.timetableService.restoreChange(item._id).subscribe({
      next: (res) => {
        this.busy = '';
        const idx = this.all.findIndex(c => c._id === item._id);
        if (idx > -1) { this.all[idx].actionType = 'restored'; this.all[idx].status = 'available'; }
        this.applyFilters();
        this.showToast(res.message || 'Period restored! Students notified ✅', 'success');
      },
      error: (err) => { this.busy = ''; this.showToast(err.error?.message || 'Failed to restore.', 'error'); }
    });
  }

  cancelPeriod(item: any): void {
    if (!confirm(`Cancel Period ${item.periodNumber} on ${this.formatDate(item.date)} again?`)) return;
    this.busy = item._id;
    const dt = new Date(item.date);
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    this.timetableService.markUnavailable(
      item.fixedTimetableEntry?._id || item.fixedTimetableEntry,
      dateStr, item.reason
    ).subscribe({
      next: () => {
        this.busy = '';
        const idx = this.all.findIndex(c => c._id === item._id);
        if (idx > -1) { this.all[idx].actionType = 'cancelled'; this.all[idx].status = 'cancelled'; }
        this.applyFilters();
        this.showToast('Period cancelled. Students notified.', 'success');
      },
      error: (err) => { this.busy = ''; this.showToast(err.error?.message || 'Failed to cancel.', 'error'); }
    });
  }

  withdrawExtra(item: any): void {
    if (!confirm(`Withdraw extra class for Period ${item.periodNumber}?`)) return;
    this.busy = item._id;
    this.timetableService.withdrawFreeSlot(item._id).subscribe({
      next: () => {
        this.busy = '';
        const idx = this.all.findIndex(c => c._id === item._id);
        if (idx > -1) this.all[idx].actionType = 'extra_withdrawn';
        this.applyFilters();
        this.showToast('Extra class withdrawn.', 'success');
      },
      error: (err) => { this.busy = ''; this.showToast(err.error?.message || 'Failed to withdraw.', 'error'); }
    });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { show: true, message, type };
    setTimeout(() => { this.toast.show = false; }, 4500);
  }
}
