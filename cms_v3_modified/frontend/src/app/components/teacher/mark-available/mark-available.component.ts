import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';
import { AuthService } from '../../../services/auth.service';

/** Format a JS Date as "YYYY-MM-DD" using LOCAL date parts (avoids UTC shift) */
function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** True if dateStr (YYYY-MM-DD) is strictly after today — local comparison, no UTC shift */
function isStrictlyFuture(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  return target > today;
}

@Component({
  selector: 'app-mark-available',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <div class="page-header">
        <h1><i class="fas fa-calendar-plus"></i> Mark Period Available</h1>
        <p>
          Only your <strong>free periods</strong> (no class scheduled) and
          <strong>cancelled periods</strong> (previously cancelled by you) are shown here.
          Regular active assigned classes are not shown.
        </p>
      </div>

      <div class="alert alert-success" *ngIf="successMsg">
        <i class="fas fa-check-circle"></i> {{ successMsg }}
      </div>
      <div class="alert alert-error" *ngIf="errorMsg">
        <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
      </div>

      <div class="layout">

        <!-- ── Left col ── -->
        <div class="left-col">

          <!-- Date picker -->
          <div class="card date-card">
            <div class="form-group" style="margin:0">
              <label><i class="fas fa-calendar"></i> Select Date *</label>
              <input type="date" class="form-control"
                     [(ngModel)]="selectedDate"
                     [min]="minDate"
                     name="date"
                     (change)="onDateChange()" />
              <span class="date-hint" *ngIf="selectedDate && !isFuture">
                <i class="fas fa-info-circle"></i>
                Select a <strong>future date</strong> to enable actions.
              </span>
            </div>
          </div>

          <!-- Loading -->
          <div *ngIf="loading" class="loading-center">
            <div class="spinner"></div><p>Loading your schedule…</p>
          </div>

          <ng-container *ngIf="!loading && selectedDate">

            <!-- ── SECTION 1: CANCELLED PERIODS ── -->
            <div class="section-card card" *ngIf="cancelledPeriods.length > 0">
              <div class="section-header cancelled-header">
                <span class="section-icon"><i class="fas fa-times-circle"></i></span>
                <div>
                  <h2>Cancelled Periods</h2>
                  <p>Your classes you previously cancelled. Restore them to put them back on.</p>
                </div>
                <span class="badge badge-danger">{{ cancelledPeriods.length }}</span>
              </div>
              <div class="period-list">
                <div *ngFor="let p of cancelledPeriods" class="period-row cancelled-row">
                  <div class="pr-left">
                    <span class="p-num cancelled-num">P{{ p.periodNumber }}</span>
                    <div class="pr-info">
                      <span class="pr-subj">{{ p.subject?.name }}</span>
                      <span class="pr-time">{{ p.startTime }} – {{ p.endTime }}</span>
                      <span class="pr-reason" *ngIf="p.change?.reason">
                        <i class="fas fa-comment-alt"></i> {{ p.change.reason }}
                      </span>
                    </div>
                  </div>
                  <div class="pr-right">
                    <button class="btn btn-success btn-sm"
                            *ngIf="isFuture"
                            [disabled]="acting === p.periodNumber"
                            (click)="restorePeriod(p)">
                      <i class="fas fa-undo"
                         [class.fa-circle-notch]="acting === p.periodNumber"
                         [class.fa-spin]="acting === p.periodNumber"></i>
                      Restore Class
                    </button>
                    <span class="lock-msg" *ngIf="!isFuture">
                      <i class="fas fa-lock"></i> Select a future date
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── SECTION 2: FREE PERIODS ONLY ── -->
            <div class="section-card card" *ngIf="freePeriods.length > 0">
              <div class="section-header free-header">
                <span class="section-icon"><i class="fas fa-plus-circle"></i></span>
                <div>
                  <h2>Free Periods</h2>
                  <p>No class is scheduled during these periods. Offer an extra class here.</p>
                </div>
                <span class="badge badge-warning">{{ freePeriods.length }}</span>
              </div>
              <div class="period-list">
                <div *ngFor="let p of freePeriods" class="period-row free-row">

                  <div class="pr-left">
                    <span class="p-num free-num">P{{ p.periodNumber }}</span>
                    <div class="pr-info">
                      <span class="pr-subj free-label">Free Period</span>
                      <span class="pr-time">{{ p.startTime }} – {{ p.endTime }}</span>
                    </div>
                  </div>

                  <!-- Active offer -->
                  <div class="pr-right" *ngIf="isOffered(p)">
                    <div class="offered-info">
                      <span class="offered-subj">{{ p.subject?.name }}</span>
                      <span class="offered-note" *ngIf="p.offer?.note">{{ p.offer.note }}</span>
                    </div>
                    <span class="badge badge-success">✅ Offered</span>
                    <button class="btn btn-danger btn-sm"
                            [disabled]="acting === p.periodNumber"
                            (click)="withdrawOffer(p)">
                      <i class="fas fa-times"></i> Withdraw
                    </button>
                  </div>

                  <!-- Withdrawn offer -->
                  <div class="pr-right" *ngIf="isWithdrawn(p)">
                    <span class="badge badge-secondary">↩ Withdrawn</span>
                    <button class="btn btn-success btn-sm" (click)="resetOffer(p)">
                      <i class="fas fa-redo"></i> Re-offer
                    </button>
                  </div>

                  <!-- No offer yet — offer form (only for tomorrow or later) -->
                  <div class="pr-right offer-form-col" *ngIf="isFreeOnly(p)">
                    <ng-container *ngIf="isFuture">
                      <select class="form-control fc-sm"
                              [(ngModel)]="p.draftSubject"
                              [name]="'subj_' + p.periodNumber">
                        <option value="">— select subject —</option>
                        <option [value]="user?.assignedSubject?._id">
                          {{ user?.assignedSubject?.name }}
                        </option>
                      </select>
                      <input type="text" class="form-control fc-sm"
                             [(ngModel)]="p.draftNote"
                             [name]="'note_' + p.periodNumber"
                             placeholder="Note (optional)" />
                      <button class="btn btn-success btn-sm"
                              [disabled]="!p.draftSubject || acting === p.periodNumber"
                              (click)="offerFreeSlot(p)">
                        <i class="fas fa-plus"
                           [class.fa-circle-notch]="acting === p.periodNumber"
                           [class.fa-spin]="acting === p.periodNumber"></i>
                        Offer Extra Class
                      </button>
                    </ng-container>
                    <span class="lock-msg" *ngIf="!isFuture">
                      <i class="fas fa-lock"></i> Must be tomorrow or later
                    </span>
                  </div>

                </div>
              </div>
            </div>

            <!-- Nothing actionable -->
            <div class="card empty-card"
                 *ngIf="cancelledPeriods.length === 0 && freePeriods.length === 0">
              <i class="fas fa-calendar-check"></i>
              <h3>All periods are active</h3>
              <p>No free or cancelled periods on <strong>{{ dayName }}</strong>.</p>
            </div>

          </ng-container>

          <div *ngIf="!loading && !selectedDate" class="card empty-card">
            <i class="fas fa-calendar"></i>
            <p>Select a date above to view actionable periods.</p>
          </div>

        </div>

        <!-- ── Right col ── -->
        <div class="right-col">

          <div class="card rule-card">
            <h3><i class="fas fa-info-circle"></i> Rules</h3>
            <div class="rule-item">
              <span class="rule-dot dot-red"></span>
              <span><strong>Cancelled periods</strong> — restore them on any future date.</span>
            </div>
            <div class="rule-item">
              <span class="rule-dot dot-yellow"></span>
              <span><strong>Free periods</strong> — offer an extra class, must be tomorrow or later.</span>
            </div>
            <div class="rule-item">
              <span class="rule-dot dot-blue"></span>
              <span>Regular active classes are <strong>not shown here</strong>. Use "Cancel Period" to manage those.</span>
            </div>
            <div class="rule-item">
              <span class="rule-dot dot-green"></span>
              <span>Students receive an <strong>SMS</strong> on every change.</span>
            </div>
          </div>

          <div class="card preview-card" *ngIf="lastPreview">
            <h3><i class="fas fa-mobile-alt"></i> SMS Preview</h3>
            <div class="sms-bubble"
                 [class.sms-restore]="lastPreview.type === 'restore'"
                 [class.sms-offer]="lastPreview.type === 'offer'"
                 [class.sms-withdraw]="lastPreview.type === 'withdraw'">
              <pre>{{ lastPreview.text }}</pre>
            </div>
          </div>

        </div>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 1050px; margin: 0 auto; padding: 2rem 1.5rem; }
    .layout   { display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; }
    .left-col { display: flex; flex-direction: column; gap: 1.25rem; }
    .right-col{ display: flex; flex-direction: column; gap: 1.25rem; }

    .date-card { padding: 1.1rem 1.25rem; }
    .date-hint { display: block; margin-top: 0.4rem; font-size: 0.8rem; color: var(--warning); }

    /* Section cards */
    .section-card { padding: 0; overflow: hidden; }
    .section-header {
      display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .cancelled-header { background: #fff5f5; }
    .free-header       { background: #fffbeb; }
    .section-icon {
      width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 1.1rem;
    }
    .cancelled-header .section-icon { background: #fee2e2; color: var(--danger); }
    .free-header .section-icon       { background: #fef3c7; color: #d97706; }
    .section-header h2 { font-size: 1rem; font-weight: 700; margin: 0 0 0.2rem; }
    .section-header p  { font-size: 0.8rem; color: var(--text-muted); margin: 0; }
    .section-header .badge { margin-left: auto; flex-shrink: 0; }

    /* Period rows */
    .period-list { display: flex; flex-direction: column; }
    .period-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border);
      gap: 1rem; flex-wrap: wrap;
    }
    .period-row:last-child { border-bottom: none; }
    .cancelled-row:hover { background: #fff5f5; }
    .free-row:hover      { background: #fffbeb; }

    .p-num {
      min-width: 36px; height: 36px; border-radius: 8px; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.88rem; flex-shrink: 0;
    }
    .cancelled-num { background: var(--danger); }
    .free-num      { background: #f59e0b; }

    .pr-left  { display: flex; align-items: center; gap: 0.85rem; }
    .pr-info  { display: flex; flex-direction: column; gap: 0.05rem; }
    .pr-subj  { font-weight: 600; font-size: 0.9rem; }
    .pr-time  { font-size: 0.76rem; color: var(--text-muted); }
    .pr-reason{ font-size: 0.75rem; color: var(--danger); display: flex; align-items: center; gap: 0.3rem; }
    .free-label { color: #92400e; }

    .pr-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .offered-info { display: flex; flex-direction: column; }
    .offered-subj { font-size: 0.85rem; font-weight: 600; color: var(--success); }
    .offered-note { font-size: 0.75rem; color: var(--text-muted); }

    .offer-form-col { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .fc-sm { padding: 0.38rem 0.6rem; font-size: 0.82rem; width: auto; }
    .lock-msg { font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; }
    .badge-secondary { background: #f3f4f6; color: #6b7280; }

    /* Empty */
    .empty-card {
      text-align: center; padding: 3rem 2rem; color: var(--text-muted);
      display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
    }
    .empty-card i  { font-size: 2.5rem; opacity: 0.3; }
    .empty-card h3 { font-size: 1rem; font-weight: 600; margin: 0; color: var(--text); }
    .empty-card p  { margin: 0; font-size: 0.875rem; }

    /* Right panel */
    .rule-card h3, .preview-card h3 {
      font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem;
      display: flex; align-items: center; gap: 0.5rem;
    }
    .rule-item { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.83rem; color: var(--text-muted); margin-bottom: 0.65rem; line-height: 1.5; }
    .rule-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .dot-red    { background: var(--danger); }
    .dot-yellow { background: #f59e0b; }
    .dot-blue   { background: var(--primary); }
    .dot-green  { background: var(--success); }

    .sms-bubble { border-radius: var(--radius-sm); padding: 0.8rem; font-size: 0.78rem; }
    .sms-bubble pre { white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; }
    .sms-restore { background: #d1fae5; border: 1px solid #6ee7b7; color: #065f46; }
    .sms-offer   { background: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; }
    .sms-withdraw{ background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }

    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `]
})
export class MarkAvailableComponent implements OnInit {
  selectedDate = '';
  minDate      = '';           // set in ngOnInit — NOT as a class field initializer
  allPeriods: any[] = [];
  loading   = false;
  acting: number | null = null;
  successMsg = '';
  errorMsg   = '';
  dayName    = '';
  lastPreview: { type: string; text: string } | null = null;
  user: any;

  constructor(
    private timetableService: TimetableService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.user    = this.auth.currentUser;

    // Set minDate = today using LOCAL date parts (toISOString() is UTC and shifts in IST)
    this.minDate = toLocalISO(new Date());

    // Default to next working day (skip weekends)
    const next = new Date();
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }
    this.selectedDate = toLocalISO(next);

    this.onDateChange();
  }

  // ── Filtered views: ONLY free and cancelled periods ───────────

  /** Periods where teacher already cancelled their assigned class */
  get cancelledPeriods(): any[] {
    return this.allPeriods.filter(p => p.type === 'cancelled');
  }

  /** Periods with NO class assigned at all on this weekday */
  get freePeriods(): any[] {
    return this.allPeriods.filter(p => p.type === 'free');
  }

  // ── Sub-state predicates for free periods ─────────────────────
  isFreeOnly(p: any):  boolean { return p.type === 'free' && !p.offer; }
  isOffered(p: any):   boolean { return p.type === 'free' && p.offer?.status === 'active'; }
  isWithdrawn(p: any): boolean { return p.type === 'free' && p.offer?.status === 'withdrawn'; }

  // ── Date helper ───────────────────────────────────────────────
  get isFuture(): boolean {
    return !!this.selectedDate && isStrictlyFuture(this.selectedDate);
  }

  // ── Data loading ──────────────────────────────────────────────
  onDateChange(): void {
    if (!this.selectedDate) return;
    this.loading    = true;
    this.allPeriods = [];
    this.clearMsgs();

    this.timetableService.getMyPeriodsForDate(this.selectedDate).subscribe({
      next: (res: any) => {
        this.dayName = res.dayName || '';

        // Map API response — assigned periods will be filtered out by getters above
        this.allPeriods = (res.periods || []).map((p: any) => ({
          ...p,
          draftSubject: this.user?.assignedSubject?._id || '',
          draftNote:    ''
        }));

        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  // ── Actions ───────────────────────────────────────────────────

  restorePeriod(p: any): void {
    if (!p.changeId) { this.errorMsg = 'Cancellation record not found. Refresh the page.'; return; }
    this.clearMsgs();
    this.acting = p.periodNumber;
    this.timetableService.restoreChange(p.changeId).subscribe({
      next: (res: any) => {
        this.acting     = null;
        this.successMsg = res.message || 'Period restored! Students notified via SMS.';
        this.setPreview('restore', p);
        this.onDateChange();
      },
      error: (err: any) => {
        this.acting   = null;
        this.errorMsg = err.error?.message || 'Could not restore period.';
      }
    });
  }

  offerFreeSlot(p: any): void {
    this.clearMsgs();
    this.acting = p.periodNumber;
    this.timetableService.createFreeSlot(
      this.selectedDate, p.periodNumber, p.draftSubject, p.draftNote
    ).subscribe({
      next: (res: any) => {
        this.acting     = null;
        this.successMsg = res.message || 'Extra class offered! Students notified via SMS.';
        this.setPreview('offer', p);
        this.onDateChange();
      },
      error: (err: any) => {
        this.acting   = null;
        this.errorMsg = err.error?.message || 'Failed to offer slot.';
      }
    });
  }

  withdrawOffer(p: any): void {
    if (!confirm('Withdraw this extra class offer? Students will be notified.')) return;
    this.clearMsgs();
    this.acting = p.periodNumber;
    this.timetableService.withdrawFreeSlot(p.offer._id).subscribe({
      next: (res: any) => {
        this.acting     = null;
        this.successMsg = res.message || 'Offer withdrawn. Students notified.';
        this.setPreview('withdraw', p);
        this.onDateChange();
      },
      error: (err: any) => {
        this.acting   = null;
        this.errorMsg = err.error?.message || 'Failed to withdraw.';
      }
    });
  }

  resetOffer(p: any): void {
    p.offer        = null;
    p.draftSubject = this.user?.assignedSubject?._id || '';
    p.draftNote    = '';
  }

  private setPreview(type: 'restore' | 'offer' | 'withdraw', p: any): void {
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const dateStr = new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const name = this.user?.name || 'Teacher';
    const subj = p.subject?.name || this.user?.assignedSubject?.name || 'Subject';

    if (type === 'restore') {
      this.lastPreview = { type: 'restore', text:
        `✅ CLASS RESTORED!\nOn ${dateStr}, Period ${p.periodNumber} ` +
        `(${p.startTime}–${p.endTime}) - ${subj} is BACK ON.\n` +
        `Teacher: ${name} is now available.\n- Class Management System`
      };
    } else if (type === 'offer') {
      this.lastPreview = { type: 'offer', text:
        `📗 EXTRA CLASS!\n${name} is offering an EXTRA ${subj} class on ${dateStr}.\n` +
        `Period ${p.periodNumber} (${p.startTime}–${p.endTime}).\n- Class Management System`
      };
    } else {
      this.lastPreview = { type: 'withdraw', text:
        `❌ EXTRA CLASS CANCELLED!\nThe extra ${subj} class by ${name} on ${dateStr}, ` +
        `Period ${p.periodNumber} has been withdrawn.\n- Class Management System`
      };
    }
  }

  private clearMsgs(): void { this.successMsg = ''; this.errorMsg = ''; }
}
