import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';
import { AuthService } from '../../../services/auth.service';

function toLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
        <h1><i class="fas fa-calendar-plus"></i> Offer Extra Class</h1>
        <p>
          Choose a date to see your <strong>free</strong> and <strong>cancelled</strong> periods,
          plus <strong>slots freed by other teachers</strong> (Feature: Offer Cancelled Slot).
        </p>
      </div>

      <div class="alert alert-success" *ngIf="successMsg"><i class="fas fa-check-circle"></i> {{ successMsg }}</div>
      <div class="alert alert-error"   *ngIf="errorMsg"  ><i class="fas fa-exclamation-circle"></i> {{ errorMsg }}</div>

      <div class="layout">
        <!-- ── Left col ── -->
        <div class="left-col">

          <div class="card date-card">
            <div class="form-group" style="margin:0">
              <label><i class="fas fa-calendar"></i> Select Date *</label>
              <input type="date" class="form-control"
                     [(ngModel)]="selectedDate" [min]="minDate" name="date"
                     (change)="onDateChange()" />
              <span class="date-hint" *ngIf="selectedDate && !isFuture">
                <i class="fas fa-info-circle"></i> Select a <strong>future date</strong> to enable actions.
              </span>
            </div>
          </div>

          <div *ngIf="loading" class="loading-center"><div class="spinner"></div><p>Loading your schedule…</p></div>

          <ng-container *ngIf="!loading && selectedDate">

            <!-- ── SECTION 1: MY CANCELLED PERIODS ── -->
            <div class="section-card card" *ngIf="cancelledPeriods.length > 0">
              <div class="section-header cancelled-header">
                <span class="section-icon"><i class="fas fa-times-circle"></i></span>
                <div>
                  <h2>My Cancelled Periods</h2>
                  <p>Previously cancelled by you. Restore to put them back on.</p>
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
                    <button class="btn btn-success btn-sm" *ngIf="isFuture"
                            [disabled]="acting === p.periodNumber" (click)="restorePeriod(p)">
                      <i class="fas fa-undo" [class.fa-spin]="acting === p.periodNumber"></i> Restore Class
                    </button>
                    <span class="lock-msg" *ngIf="!isFuture"><i class="fas fa-lock"></i> Future dates only</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── SECTION 2: OFFERABLE CANCELLED SLOTS (Feature 1) ── -->
            <div class="section-card card" *ngIf="offerableSlots.length > 0">
              <div class="section-header offerable-header">
                <span class="section-icon"><i class="fas fa-handshake"></i></span>
                <div>
                  <h2>Available Cancelled Slots</h2>
                  <p>Another teacher cancelled at least 1 day in advance. You can offer an extra class here.</p>
                </div>
                <span class="badge badge-offerable">{{ offerableSlots.length }}</span>
              </div>
              <div class="period-list">
                <div *ngFor="let p of offerableSlots" class="period-row offerable-row">
                  <div class="pr-left">
                    <span class="p-num offerable-num">P{{ p.periodNumber }}</span>
                    <div class="pr-info">
                      <span class="pr-subj">
                        <i class="fas fa-ban pr-cancel-icon"></i>
                        {{ p.originalSubject?.name || 'Class cancelled' }}
                        <span class="original-teacher-tag">by {{ p.originalTeacher?.name }}</span>
                      </span>
                      <span class="pr-time">{{ p.startTime }} – {{ p.endTime }}</span>
                      <span class="pr-room" *ngIf="p.classroomNo && p.classroomNo !== 'TBD'">
                        <i class="fas fa-door-open"></i> Room {{ p.classroomNo }} freed
                      </span>
                    </div>
                  </div>
                  <div class="pr-right">
                    <!-- Already offered by this teacher -->
                    <ng-container *ngIf="p.offer?.status === 'active'">
                      <span class="badge badge-success">✅ You offered</span>
                      <button class="btn btn-danger btn-sm" [disabled]="acting === p.periodNumber"
                              (click)="withdrawOffer(p)">
                        <i class="fas fa-times"></i> Withdraw
                      </button>
                    </ng-container>
                    <!-- Offer form -->
                    <ng-container *ngIf="isFuture && !p.offer">
                      <select class="form-control fc-sm" [(ngModel)]="p.draftSubject" [name]="'subj_o_' + p.periodNumber">
                        <option value="">— select subject —</option>
                        <option [value]="user?.assignedSubject?._id">{{ user?.assignedSubject?.name }}</option>
                      </select>
                      <button class="btn btn-offerable btn-sm"
                              [disabled]="!p.draftSubject || acting === p.periodNumber"
                              (click)="offerOnCancelledSlot(p)">
                        <i class="fas fa-plus" [class.fa-spin]="acting === p.periodNumber"></i>
                        Claim &amp; Offer
                      </button>
                    </ng-container>
                    <span class="lock-msg" *ngIf="!isFuture"><i class="fas fa-lock"></i> Future only</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── SECTION 3: FREE PERIODS ── -->
            <div class="section-card card" *ngIf="freePeriods.length > 0">
              <div class="section-header free-header">
                <span class="section-icon"><i class="fas fa-plus-circle"></i></span>
                <div>
                  <h2>Free Periods</h2>
                  <p>No class scheduled. Offer an extra class here.</p>
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
                    <button class="btn btn-danger btn-sm" [disabled]="acting === p.periodNumber" (click)="withdrawOffer(p)">
                      <i class="fas fa-times"></i> Withdraw
                    </button>
                  </div>
                  <!-- Withdrawn -->
                  <div class="pr-right" *ngIf="isWithdrawn(p)">
                    <span class="badge badge-secondary">↩ Withdrawn</span>
                    <button class="btn btn-success btn-sm" (click)="resetOffer(p)"><i class="fas fa-redo"></i> Re-offer</button>
                  </div>
                  <!-- Free only -->
                  <div class="pr-right offer-form-col" *ngIf="isFreeOnly(p)">
                    <ng-container *ngIf="isFuture">
                      <select class="form-control fc-sm" [(ngModel)]="p.draftSubject" [name]="'subj_' + p.periodNumber">
                        <option value="">— select subject —</option>
                        <option [value]="user?.assignedSubject?._id">{{ user?.assignedSubject?.name }}</option>
                      </select>
                      <input type="text" class="form-control fc-sm" [(ngModel)]="p.draftNote"
                             [name]="'note_' + p.periodNumber" placeholder="Note (optional)" />
                      <button class="btn btn-success btn-sm"
                              [disabled]="!p.draftSubject || acting === p.periodNumber"
                              (click)="offerFreeSlot(p)">
                        <i class="fas fa-plus" [class.fa-spin]="acting === p.periodNumber"></i>
                        Offer Extra Class
                      </button>
                    </ng-container>
                    <span class="lock-msg" *ngIf="!isFuture"><i class="fas fa-lock"></i> Must be tomorrow or later</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ── SECTION 4: ALREADY RESERVED (Feature 2) ── -->
            <div class="section-card card" *ngIf="alreadyReservedPeriods.length > 0">
              <div class="section-header reserved-header">
                <span class="section-icon"><i class="fas fa-lock"></i></span>
                <div>
                  <h2>Already Reserved</h2>
                  <p>Another teacher has already offered an extra class in these slots.</p>
                </div>
                <span class="badge badge-reserved">{{ alreadyReservedPeriods.length }}</span>
              </div>
              <div class="period-list">
                <div *ngFor="let p of alreadyReservedPeriods" class="period-row reserved-row">
                  <div class="pr-left">
                    <span class="p-num reserved-num">P{{ p.periodNumber }}</span>
                    <div class="pr-info">
                      <span class="pr-subj">{{ p.subject?.name || 'Extra Class' }}</span>
                      <span class="pr-time">{{ p.startTime }} – {{ p.endTime }}</span>
                      <span class="reserved-by" *ngIf="p.reservedBy">
                        <i class="fas fa-user-check"></i> Reserved by {{ p.reservedBy?.name }}
                      </span>
                    </div>
                  </div>
                  <div class="pr-right">
                    <span class="badge badge-reserved-tag"><i class="fas fa-ban"></i> Already Reserved</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Nothing actionable -->
            <div class="card empty-card"
                 *ngIf="cancelledPeriods.length === 0 && freePeriods.length === 0 && offerableSlots.length === 0 && alreadyReservedPeriods.length === 0">
              <i class="fas fa-calendar-check"></i>
              <h3>All periods active</h3>
              <p>No free, cancelled, or offerable periods on <strong>{{ dayName }}</strong>.</p>
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
            <div class="rule-item"><span class="rule-dot dot-red"></span><span><strong>Cancelled periods</strong> — restore them on any future date.</span></div>
            <div class="rule-item"><span class="rule-dot dot-purple"></span><span><strong>Cancelled by others</strong> — if they cancelled ≥1 day before, you can offer a class in that slot.</span></div>
            <div class="rule-item"><span class="rule-dot dot-yellow"></span><span><strong>Free periods</strong> — offer an extra class, must be tomorrow or later.</span></div>
            <div class="rule-item"><span class="rule-dot dot-grey"></span><span><strong>Already Reserved</strong> — another teacher claimed that slot. Cannot double-book.</span></div>
            <div class="rule-item"><span class="rule-dot dot-green"></span><span>Students receive an <strong>SMS</strong> on every change.</span></div>
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
    .section-card { padding: 0; overflow: hidden; }
    .section-header { display: flex; align-items: flex-start; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); }
    .cancelled-header  { background: #fff5f5; }
    .offerable-header  { background: #f5f3ff; }
    .free-header       { background: #fffbeb; }
    .reserved-header   { background: #f1f5f9; }
    .section-icon { width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; }
    .cancelled-header .section-icon  { background: #fee2e2; color: var(--danger); }
    .offerable-header .section-icon  { background: #ede9fe; color: #7c3aed; }
    .free-header .section-icon       { background: #fef3c7; color: #d97706; }
    .reserved-header .section-icon   { background: #e2e8f0; color: #64748b; }
    .section-header h2 { font-size: 1rem; font-weight: 700; margin: 0 0 0.2rem; }
    .section-header p  { font-size: 0.8rem; color: var(--text-muted); margin: 0; }
    .section-header .badge { margin-left: auto; flex-shrink: 0; }
    .badge-offerable { background: #ede9fe; color: #4c1d95; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; }
    .badge-reserved  { background: #e2e8f0; color: #374151; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 700; }
    .badge-reserved-tag { background: #e2e8f0; color: #374151; display: flex; align-items: center; gap: 0.3rem; font-size: 0.75rem; font-weight: 600; padding: 0.2rem 0.65rem; border-radius: 6px; }
    .period-list { display: flex; flex-direction: column; }
    .period-row { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1.25rem; border-bottom: 1px solid var(--border); gap: 1rem; flex-wrap: wrap; }
    .period-row:last-child { border-bottom: none; }
    .cancelled-row:hover  { background: #fff5f5; }
    .offerable-row:hover  { background: #f5f3ff; }
    .free-row:hover       { background: #fffbeb; }
    .reserved-row         { background: #f8fafc; opacity: 0.8; }
    .p-num { min-width: 36px; height: 36px; border-radius: 8px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.88rem; flex-shrink: 0; }
    .cancelled-num  { background: var(--danger); }
    .offerable-num  { background: #7c3aed; }
    .free-num       { background: #f59e0b; }
    .reserved-num   { background: #94a3b8; }
    .pr-left  { display: flex; align-items: center; gap: 0.85rem; }
    .pr-info  { display: flex; flex-direction: column; gap: 0.05rem; }
    .pr-subj  { font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .pr-cancel-icon { color: #dc2626; font-size: 0.75rem; }
    .original-teacher-tag { background: #ede9fe; color: #4c1d95; padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.72rem; font-weight: 600; }
    .pr-time  { font-size: 0.76rem; color: var(--text-muted); }
    .pr-room  { font-size: 0.75rem; color: #059669; display: flex; align-items: center; gap: 0.3rem; }
    .pr-reason { font-size: 0.75rem; color: var(--danger); display: flex; align-items: center; gap: 0.3rem; }
    .free-label { color: #92400e; }
    .reserved-by { font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem; }
    .pr-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .offered-info { display: flex; flex-direction: column; }
    .offered-subj { font-size: 0.85rem; font-weight: 600; color: var(--success); }
    .offered-note { font-size: 0.75rem; color: var(--text-muted); }
    .offer-form-col { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .fc-sm { padding: 0.38rem 0.6rem; font-size: 0.82rem; width: auto; }
    .lock-msg { font-size: 0.78rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem; }
    .badge-secondary { background: #f3f4f6; color: #6b7280; }
    .btn-offerable { background: #7c3aed; color: #fff; }
    .btn-offerable:hover:not(:disabled) { background: #5b21b6; }
    .empty-card { text-align: center; padding: 3rem 2rem; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .empty-card i { font-size: 2.5rem; opacity: 0.3; }
    .empty-card h3 { font-size: 1rem; font-weight: 600; margin: 0; color: var(--text); }
    .empty-card p  { margin: 0; font-size: 0.875rem; }
    .rule-card h3, .preview-card h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .rule-item { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.83rem; color: var(--text-muted); margin-bottom: 0.65rem; line-height: 1.5; }
    .rule-dot  { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
    .dot-red    { background: var(--danger); }
    .dot-purple { background: #7c3aed; }
    .dot-yellow { background: #f59e0b; }
    .dot-grey   { background: #9ca3af; }
    .dot-green  { background: var(--success); }
    .sms-bubble { border-radius: var(--radius-sm); padding: 0.8rem; font-size: 0.78rem; }
    .sms-bubble pre { white-space: pre-wrap; font-family: inherit; margin: 0; line-height: 1.6; }
    .sms-restore { background: #d1fae5; border: 1px solid #6ee7b7; color: #065f46; }
    .sms-offer   { background: #dbeafe; border: 1px solid #93c5fd; color: #1e40af; }
    .sms-withdraw{ background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
    .loading-center { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem; color: var(--text-muted); }
    .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
  `]
})
export class MarkAvailableComponent implements OnInit {
  selectedDate = '';
  minDate      = '';
  allPeriods: any[] = [];
  loading   = false;
  acting: number | null = null;
  successMsg = '';
  errorMsg   = '';
  dayName    = '';
  lastPreview: { type: string; text: string } | null = null;
  user: any;

  constructor(private timetableService: TimetableService, private auth: AuthService) {}

  ngOnInit(): void {
    this.user    = this.auth.currentUser;
    this.minDate = toLocalISO(new Date());
    const next = new Date();
    next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    this.selectedDate = toLocalISO(next);
    this.onDateChange();
  }

  // Filtered views
  get cancelledPeriods():       any[] { return this.allPeriods.filter(p => p.type === 'cancelled'); }
  get freePeriods():            any[] { return this.allPeriods.filter(p => p.type === 'free'); }
  /** Feature 1: slots freed by other teachers */
  get offerableSlots():         any[] { return this.allPeriods.filter(p => p.type === 'offerable_cancelled'); }
  /** Feature 2: already reserved by another teacher */
  get alreadyReservedPeriods(): any[] { return this.allPeriods.filter(p => p.type === 'already_reserved'); }

  isFreeOnly(p: any):  boolean { return p.type === 'free' && !p.offer; }
  isOffered(p: any):   boolean { return (p.type === 'free' || p.type === 'offerable_cancelled') && p.offer?.status === 'active'; }
  isWithdrawn(p: any): boolean { return p.type === 'free' && p.offer?.status === 'withdrawn'; }

  get isFuture(): boolean { return !!this.selectedDate && isStrictlyFuture(this.selectedDate); }

  onDateChange(): void {
    if (!this.selectedDate) return;
    this.loading = true; this.allPeriods = []; this.clearMsgs();
    this.timetableService.getMyPeriodsForDate(this.selectedDate).subscribe({
      next: (res: any) => {
        this.dayName = res.dayName || '';
        this.allPeriods = (res.periods || []).map((p: any) => ({
          ...p,
          draftSubject: this.user?.assignedSubject?._id || '',
          draftNote: ''
        }));
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  restorePeriod(p: any): void {
    if (!p.changeId) { this.errorMsg = 'Cancellation record not found.'; return; }
    this.clearMsgs(); this.acting = p.periodNumber;
    this.timetableService.restoreChange(p.changeId).subscribe({
      next: (res: any) => {
        this.acting = null; this.successMsg = res.message || 'Period restored!';
        this.setPreview('restore', p); this.onDateChange();
      },
      error: (err: any) => { this.acting = null; this.errorMsg = err.error?.message || 'Could not restore period.'; }
    });
  }

  offerFreeSlot(p: any): void {
    this.clearMsgs(); this.acting = p.periodNumber;
    this.timetableService.createFreeSlot(this.selectedDate, p.periodNumber, p.draftSubject, p.draftNote).subscribe({
      next: (res: any) => {
        this.acting = null; this.successMsg = res.message || 'Extra class offered!';
        this.setPreview('offer', p); this.onDateChange();
      },
      error: (err: any) => { this.acting = null; this.errorMsg = err.error?.message || 'Failed to offer slot.'; }
    });
  }

  /** Feature 1: Offer on a cancelled slot from another teacher */
  offerOnCancelledSlot(p: any): void {
    this.clearMsgs(); this.acting = p.periodNumber;
    // Pass cancelChangeId so backend marks it as claimed
    this.timetableService.createFreeSlot(
      this.selectedDate, p.periodNumber, p.draftSubject, '', p.cancelChangeId
    ).subscribe({
      next: (res: any) => {
        this.acting = null;
        this.successMsg = res.message || 'Slot claimed and extra class offered!';
        this.setPreview('offer', p); this.onDateChange();
      },
      error: (err: any) => {
        this.acting = null;
        this.errorMsg = err.error?.message || 'Failed to claim slot.';
      }
    });
  }

  withdrawOffer(p: any): void {
    if (!confirm('Withdraw this extra class offer? Students will be notified.')) return;
    this.clearMsgs(); this.acting = p.periodNumber;
    this.timetableService.withdrawFreeSlot(p.offer._id).subscribe({
      next: (res: any) => {
        this.acting = null; this.successMsg = res.message || 'Offer withdrawn.';
        this.setPreview('withdraw', p); this.onDateChange();
      },
      error: (err: any) => { this.acting = null; this.errorMsg = err.error?.message || 'Failed to withdraw.'; }
    });
  }

  resetOffer(p: any): void { p.offer = null; p.draftSubject = this.user?.assignedSubject?._id || ''; p.draftNote = ''; }

  private setPreview(type: 'restore' | 'offer' | 'withdraw', p: any): void {
    const [y, m, d] = this.selectedDate.split('-').map(Number);
    const dateStr = new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const name = this.user?.name || 'Teacher';
    const subj = p.subject?.name || p.originalSubject?.name || this.user?.assignedSubject?.name || 'Subject';
    if (type === 'restore') {
      this.lastPreview = { type: 'restore', text: `✅ CLASS RESTORED!\nOn ${dateStr}, Period ${p.periodNumber} (${p.startTime}–${p.endTime}) - ${subj} is BACK ON.\nTeacher: ${name}.\n- Class Management System` };
    } else if (type === 'offer') {
      this.lastPreview = { type: 'offer', text: `📗 EXTRA CLASS!\n${name} is offering an EXTRA ${subj} class on ${dateStr}.\nPeriod ${p.periodNumber} (${p.startTime}–${p.endTime}).\n- Class Management System` };
    } else {
      this.lastPreview = { type: 'withdraw', text: `❌ EXTRA CLASS CANCELLED!\nThe extra ${subj} class by ${name} on ${dateStr}, Period ${p.periodNumber} has been withdrawn.\n- Class Management System` };
    }
  }

  private clearMsgs(): void { this.successMsg = ''; this.errorMsg = ''; }
}
