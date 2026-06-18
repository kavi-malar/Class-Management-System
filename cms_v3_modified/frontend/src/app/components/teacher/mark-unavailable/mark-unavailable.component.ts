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

@Component({
  selector: 'app-mark-unavailable',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-calendar-times"></i> Cancel Period</h1>
        <p>Select a date and mark one of your assigned periods as cancelled.
           Students will be notified via SMS automatically.</p>
      </div>

      <div class="alert alert-success" *ngIf="successMsg">
        <i class="fas fa-check-circle"></i> {{ successMsg }}
      </div>
      <div class="alert alert-error" *ngIf="errorMsg">
        <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
      </div>

      <div class="layout">
        <div class="card form-card">
          <div class="form-group">
            <label><i class="fas fa-calendar"></i> Select Date *</label>
            <input type="date" class="form-control"
                   [(ngModel)]="selectedDate" [min]="minDate"
                   name="date" (change)="onDateChange()" />
          </div>

          <div *ngIf="loadingPeriods" class="loading-center" style="padding:1.5rem">
            <div class="spinner"></div><p>Loading your periods…</p>
          </div>

          <div class="alert alert-info"
               *ngIf="!loadingPeriods && selectedDate && myPeriods.length === 0">
            <i class="fas fa-info-circle"></i>
            No periods assigned to you on <strong>{{ dayName }}</strong>.
          </div>

          <div *ngIf="!loadingPeriods && myPeriods.length > 0" class="period-list">
            <div *ngFor="let p of myPeriods" class="period-row"
                 [class.row-cancelled]="p.changeStatus === 'cancelled'">
              <div class="pr-left">
                <span class="p-num" [class.p-cancelled]="p.changeStatus === 'cancelled'">
                  P{{ p.periodNumber }}
                </span>
                <div class="pr-info">
                  <span class="pr-subj">{{ p.subject?.name }}</span>
                  <span class="pr-time">{{ p.startTime }} – {{ p.endTime }}</span>
                </div>
              </div>

              <div class="pr-right">
                <!-- Already cancelled -->
                <span class="badge badge-danger" *ngIf="p.changeStatus === 'cancelled'">
                  ❌ Already Cancelled
                </span>

                <!-- Active — show cancel form -->
                <ng-container *ngIf="p.changeStatus !== 'cancelled'">
                  <input type="text" class="form-control fc-sm"
                         [(ngModel)]="p.reasonDraft"
                         [name]="'reason_' + p._id"
                         placeholder="Reason (optional)" />
                  <button class="btn btn-danger btn-sm"
                          [disabled]="acting === p._id"
                          (click)="cancelPeriod(p)">
                    <i class="fas fa-ban"
                       [class.fa-circle-notch]="acting === p._id"
                       [class.fa-spin]="acting === p._id"></i>
                    Cancel Period
                  </button>
                </ng-container>
              </div>
            </div>
          </div>
        </div>

        <div class="info-panel">
          <div class="card rule-card">
            <h3><i class="fas fa-info-circle"></i> Rules</h3>
            <ul>
              <li><i class="fas fa-check text-green"></i> Cancel on any date including today.</li>
              <li><i class="fas fa-sms text-blue"></i> Students receive SMS instantly.</li>
              <li><i class="fas fa-undo text-orange"></i> Restore from the <strong>Free Period</strong> page.</li>
              <li><i class="fas fa-lock text-grey"></i> You can only cancel your own periods.</li>
            </ul>
          </div>

          <div class="card sms-preview" *ngIf="lastPreview">
            <h3><i class="fas fa-mobile-alt"></i> SMS Sent to Students</h3>
            <div class="sms-bubble"><pre>{{ lastPreview }}</pre></div>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
    .layout { display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; }
    .form-card { }
    .period-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .period-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 1rem; border: 1.5px solid var(--border);
      border-radius: var(--radius-sm); gap: 1rem; flex-wrap: wrap;
    }
    .period-row.row-cancelled { border-color: #fca5a5; background: #fff5f5; }
    .pr-left { display: flex; align-items: center; gap: 0.75rem; }
    .p-num {
      min-width: 36px; height: 36px; border-radius: 8px; background: var(--primary); color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.88rem;
    }
    .p-cancelled { background: var(--danger); }
    .pr-info { display: flex; flex-direction: column; }
    .pr-subj { font-weight: 600; font-size: 0.9rem; }
    .pr-time { font-size: 0.76rem; color: var(--text-muted); }
    .pr-right { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .fc-sm { padding: 0.38rem 0.6rem; font-size: 0.82rem; width: 180px; }

    .info-panel { display: flex; flex-direction: column; gap: 1.25rem; }
    .rule-card h3, .sms-preview h3 { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem; }
    .rule-card ul { list-style: none; }
    .rule-card li { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.83rem; color: var(--text-muted); margin-bottom: 0.5rem; line-height: 1.5; }
    .text-green  { color: var(--success); }
    .text-blue   { color: var(--primary); }
    .text-orange { color: var(--warning); }
    .text-grey   { color: #9ca3af; }
    .sms-bubble { background: #f0fdf4; border: 1px solid #6ee7b7; border-radius: var(--radius-sm); padding: 0.85rem; }
    .sms-bubble pre { white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 0.78rem; color: #065f46; line-height: 1.65; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .fc-sm { width: 130px; } }
  `]
})
export class MarkUnavailableComponent implements OnInit {
  selectedDate = '';
  minDate      = '';
  dayName      = '';
  myPeriods: any[] = [];
  loadingPeriods = false;
  acting   = '';
  successMsg = '';
  errorMsg   = '';
  lastPreview = '';
  user: any;

  constructor(
    private timetableService: TimetableService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.user    = this.authService.currentUser;
    this.minDate = toLocalISO(new Date());
    this.selectedDate = toLocalISO(new Date());
    this.onDateChange();
  }

  onDateChange(): void {
    if (!this.selectedDate) return;
    this.loadingPeriods = true;
    this.myPeriods = [];
    this.clearMsgs();

    this.timetableService.getTimetableForDate(this.selectedDate).subscribe({
      next: (res: any) => {
        this.dayName = res.dayName || '';
        const userId = this.user?._id;
        const all: any[] = res.timetable || [];
        const myEntries = all.filter(
          (e: any) => e.teacher?._id === userId || e.teacher === userId
        );
        this.myPeriods = myEntries.map((p: any) => ({
          ...p,
          changeStatus: p.change?.status || null,
          reasonDraft:  ''
        }));
        this.loadingPeriods = false;
      },
      error: () => { this.loadingPeriods = false; }
    });
  }

  cancelPeriod(p: any): void {
    this.clearMsgs();
    this.acting = p._id;
    this.timetableService.markUnavailable(
      p._id, this.selectedDate, p.reasonDraft || 'Teacher unavailable'
    ).subscribe({
      next: (res: any) => {
        this.acting     = '';
        this.successMsg = res.message || 'Period cancelled! Students notified via SMS.';
        const [y,m,d]   = this.selectedDate.split('-').map(Number);
        const dateStr   = new Date(y, m-1, d).toLocaleDateString('en-IN', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        this.lastPreview =
          `📚 CLASS ALERT!\n` +
          `On ${dateStr}, Period ${p.periodNumber} (${p.startTime}–${p.endTime}) ` +
          `- ${p.subject?.name} class is CANCELLED.\n` +
          `Teacher: ${this.user?.name} is unavailable.\n` +
          `Reason: ${p.reasonDraft || 'Teacher unavailable'}\n` +
          `- Class Management System`;
        this.onDateChange();
      },
      error: (err: any) => {
        this.acting   = '';
        this.errorMsg = err.error?.message || 'Failed to cancel period.';
      }
    });
  }

  private clearMsgs(): void { this.successMsg = ''; this.errorMsg = ''; }
}
