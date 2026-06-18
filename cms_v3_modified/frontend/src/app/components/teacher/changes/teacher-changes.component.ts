import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';

@Component({
  selector: 'app-teacher-changes',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <div class="page-header">
        <h1><i class="fas fa-history"></i> My Timetable Changes</h1>
        <p>Manage your cancelled periods. You can restore a period back to <strong>available</strong> as long as you do it <strong>at least one day before</strong>.</p>
      </div>

      <!-- Filter bar -->
      <div class="filter-bar card">
        <div class="filter-group">
          <label><i class="fas fa-filter"></i> Filter by status</label>
          <div class="btn-group">
            <button class="btn btn-sm" [class.btn-primary]="filter==='all'"       (click)="setFilter('all')">All</button>
            <button class="btn btn-sm" [class.btn-danger]="filter==='cancelled'"  [class.btn-secondary]="filter!=='cancelled'"  (click)="setFilter('cancelled')">
              <i class="fas fa-times-circle"></i> Cancelled
            </button>
            <button class="btn btn-sm" [class.btn-success]="filter==='available'" [class.btn-secondary]="filter!=='available'" (click)="setFilter('available')">
              <i class="fas fa-check-circle"></i> Restored
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
      </div>

      <!-- Toast notification -->
      <div class="toast" *ngIf="toast.show" [class.toast-success]="toast.type==='success'" [class.toast-error]="toast.type==='error'">
        <i class="fas" [class.fa-check-circle]="toast.type==='success'" [class.fa-exclamation-circle]="toast.type==='error'"></i>
        {{ toast.message }}
      </div>

      <!-- Table -->
      <div class="card">
        <div *ngIf="loading" class="loading-center"><div class="spinner"></div><p>Loading...</p></div>

        <div *ngIf="!loading && displayed.length === 0" class="empty-state">
          <i class="fas fa-clipboard-check"></i>
          <p>No changes found for the selected filters.</p>
        </div>

        <div *ngIf="!loading && displayed.length > 0" class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Period</th>
                <th>Time</th>
                <th>Subject</th>
                <th>Reason</th>
                <th>Status</th>
                <th>SMS</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of displayed" [class.row-available]="c.status==='available'" [class.row-cancelled]="c.status==='cancelled'">

                <!-- Date -->
                <td>
                  <div class="date-primary">{{ c.changeDate | date:'dd MMM yyyy' }}</div>
                  <div class="date-sub">{{ c.changeDate | date:'EEEE' }}</div>
                </td>

                <!-- Period -->
                <td><span class="p-badge">P{{ c.periodNumber }}</span></td>

                <!-- Time -->
                <td class="nowrap">{{ c.startTime }} – {{ c.endTime }}</td>

                <!-- Subject -->
                <td><strong>{{ c.subject?.name }}</strong></td>

                <!-- Reason -->
                <td class="reason-cell">{{ c.reason }}</td>

                <!-- Status badge -->
                <td>
                  <span class="badge" [class.badge-danger]="c.status==='cancelled'" [class.badge-success]="c.status==='available'">
                    <i class="fas" [class.fa-times-circle]="c.status==='cancelled'" [class.fa-check-circle]="c.status==='available'"></i>
                    {{ c.status === 'cancelled' ? 'Cancelled' : 'Available' }}
                  </span>
                </td>

                <!-- SMS -->
                <td>
                  <span class="badge" [class.badge-success]="c.smsSent" [class.badge-warning]="!c.smsSent">
                    {{ c.smsSent ? 'Sent' : 'Pending' }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="action-cell">
                  <!-- RESTORE button: only if cancelled AND date is in the future -->
                  <button
                    *ngIf="c.status === 'cancelled' && isFuture(c.changeDate)"
                    class="btn btn-success btn-sm action-btn"
                    [disabled]="busy === c._id"
                    (click)="restorePeriod(c)"
                    title="Mark this period as available again (sends SMS to students)"
                  >
                    <i class="fas" [class.fa-circle-notch]="busy===c._id" [class.fa-spin]="busy===c._id" [class.fa-undo]="busy!==c._id"></i>
                    {{ busy === c._id ? '' : 'Restore' }}
                  </button>

                  <!-- RE-CANCEL button: only if restored AND date is in the future -->
                  <button
                    *ngIf="c.status === 'available' && isFuture(c.changeDate)"
                    class="btn btn-danger btn-sm action-btn"
                    [disabled]="busy === c._id"
                    (click)="cancelPeriod(c)"
                    title="Cancel this period again"
                  >
                    <i class="fas" [class.fa-circle-notch]="busy===c._id" [class.fa-spin]="busy===c._id" [class.fa-times]="busy!==c._id"></i>
                    {{ busy === c._id ? '' : 'Cancel Again' }}
                  </button>

                  <!-- Past indicator -->
                  <span *ngIf="!isFuture(c.changeDate)" class="past-label">
                    <i class="fas fa-lock"></i> Past
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Legend -->
        <div class="legend" *ngIf="!loading && displayed.length > 0">
          <span class="legend-item"><span class="dot dot-red"></span> Cancelled — students notified, period is off</span>
          <span class="legend-item"><span class="dot dot-green"></span> Restored — students notified, period is back on</span>
          <span class="legend-item"><i class="fas fa-lock" style="color:var(--text-muted);font-size:.7rem"></i> Past — no changes allowed</span>
        </div>
      </div>

      <!-- Info box -->
      <div class="card info-box">
        <h3><i class="fas fa-info-circle"></i> How Restore Works</h3>
        <div class="info-steps">
          <div class="step"><div class="step-num">1</div><div>You previously marked a period as cancelled.</div></div>
          <div class="step"><div class="step-num">2</div><div>You decide you are now available — click <strong>Restore</strong>.</div></div>
          <div class="step"><div class="step-num">3</div><div>The system only allows this <strong>at least 1 day before</strong> the scheduled date.</div></div>
          <div class="step"><div class="step-num">4</div><div>All students receive an SMS: <em>"Class is back on!"</em></div></div>
        </div>
      </div>

    </main>
  `,
  styles: [`
    .page-container { max-width: 1150px; margin: 0 auto; padding: 2rem 1.5rem; }

    /* Filter bar */
    .filter-bar { display: flex; align-items: flex-end; gap: 2rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .filter-group { display: flex; flex-direction: column; gap: 0.4rem; }
    .filter-group label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem; }
    .btn-group { display: flex; gap: 0.35rem; }
    .date-filter { width: 170px; padding: 0.45rem 0.75rem; font-size: 0.85rem; }

    /* Toast */
    .toast {
      padding: 0.85rem 1.1rem; border-radius: var(--radius-sm);
      margin-bottom: 1rem; font-size: 0.875rem;
      display: flex; align-items: center; gap: 0.6rem;
      animation: fadeIn 0.3s ease;
    }
    .toast-success { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .toast-error   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }

    /* Table rows */
    tr.row-cancelled { background: #fff9f9; }
    tr.row-available { background: #f0fdf4; }

    .date-primary { font-weight: 600; font-size: 0.9rem; }
    .date-sub     { font-size: 0.75rem; color: var(--text-muted); }
    .p-badge      { background: var(--primary); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
    .nowrap       { white-space: nowrap; }
    .reason-cell  { max-width: 160px; font-size: 0.82rem; color: var(--text-muted); }
    .action-cell  { white-space: nowrap; }
    .action-btn   { min-width: 90px; justify-content: center; }
    .past-label   { font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; }

    /* Legend */
    .legend { display: flex; gap: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border); margin-top: 0.75rem; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: var(--text-muted); }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-red   { background: var(--danger); }
    .dot-green { background: var(--success); }

    /* Info box */
    .info-box { margin-top: 1.5rem; }
    .info-box h3 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary); }
    .info-steps { display: flex; flex-direction: column; gap: 0.7rem; }
    .step { display: flex; gap: 0.75rem; align-items: flex-start; }
    .step-num { min-width: 24px; height: 24px; background: var(--primary); color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; }
    .step div:last-child { font-size: 0.875rem; color: var(--text-muted); padding-top: 3px; line-height: 1.5; }

    .empty-state { text-align: center; padding: 3rem; color: var(--text-muted); }
    .empty-state i { font-size: 3rem; opacity: 0.3; display: block; margin-bottom: 1rem; }
  `]
})
export class TeacherChangesComponent implements OnInit {
  all: any[] = [];
  displayed: any[] = [];
  loading = true;
  busy = '';          // _id of the row currently being processed
  filter = 'all';
  dateFilter = '';

  toast = { show: false, message: '', type: 'success' };

  constructor(private timetableService: TimetableService) {}

  ngOnInit(): void { this.loadAll(); }

  loadAll(): void {
    this.loading = true;
    this.timetableService.getChanges().subscribe({
      next: (res) => {
        this.all = res.changes || [];
        this.applyFilters();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  setFilter(f: string): void { this.filter = f; this.applyFilters(); }

  applyFilters(): void {
    let list = [...this.all];
    if (this.filter !== 'all') list = list.filter(c => c.status === this.filter);
    if (this.dateFilter) {
      list = list.filter(c => {
        const dt = new Date(c.changeDate);
        const d = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
        return d === this.dateFilter;
      });
    }
    this.displayed = list;
  }

  /** True if the changeDate is strictly in the future (tomorrow or later) */
  isFuture(changeDate: string): boolean {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    // Parse stored date safely — stored as ISO string from MongoDB e.g. "2025-01-20T00:00:00.000Z"
    const dt = new Date(changeDate);
    const target = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); // local midnight
    return target > now;
  }

  restorePeriod(change: any): void {
    if (!confirm(`Restore Period ${change.periodNumber} on ${new Date(change.changeDate).toDateString()} back to AVAILABLE?\n\nStudents will be notified via SMS.`)) return;
    this.busy = change._id;

    this.timetableService.restoreChange(change._id).subscribe({
      next: (res) => {
        this.busy = '';
        // Update locally
        const idx = this.all.findIndex(c => c._id === change._id);
        if (idx > -1) { this.all[idx].status = 'available'; this.all[idx].smsSent = false; }
        this.applyFilters();
        this.showToast('Period restored! Students notified via SMS ✅', 'success');
      },
      error: (err) => {
        this.busy = '';
        this.showToast(err.error?.message || 'Failed to restore period.', 'error');
      }
    });
  }

  cancelPeriod(change: any): void {
    if (!confirm(`Cancel Period ${change.periodNumber} on ${new Date(change.changeDate).toDateString()} again?\n\nStudents will be notified via SMS.`)) return;
    this.busy = change._id;

    // Re-create the cancellation by posting again
    const dt = new Date(change.changeDate);
    const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    this.timetableService.markUnavailable(
      change.fixedTimetableEntry?._id || change.fixedTimetableEntry,
      dateStr,
      change.reason
    ).subscribe({
      next: () => {
        this.busy = '';
        const idx = this.all.findIndex(c => c._id === change._id);
        if (idx > -1) { this.all[idx].status = 'cancelled'; this.all[idx].smsSent = false; }
        this.applyFilters();
        this.showToast('Period cancelled again. Students notified via SMS.', 'success');
      },
      error: (err) => {
        this.busy = '';
        this.showToast(err.error?.message || 'Failed to cancel period.', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { show: true, message, type };
    setTimeout(() => { this.toast.show = false; }, 4000);
  }
}
