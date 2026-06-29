import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { TimetableService } from '../../../services/timetable.service';

const PERIOD_TIMES: { number: number; start: string; end: string }[] = [
  { number: 1, start: '09:00', end: '09:45' },
  { number: 2, start: '09:45', end: '10:30' },
  { number: 3, start: '10:45', end: '11:30' },
  { number: 4, start: '11:30', end: '12:15' },
  { number: 5, start: '13:00', end: '13:45' },
  { number: 6, start: '13:45', end: '14:30' },
  { number: 7, start: '14:30', end: '15:15' },
  { number: 8, start: '15:15', end: '16:00' },
];

@Component({
  selector: 'app-student-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">
      <div class="page-header">
        <h1><i class="fas fa-calendar-alt"></i> Timetable</h1>
        <p>View the weekly schedule or check a specific date including cancellations and extra classes.</p>
      </div>

      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab-btn" [class.active]="tab === 'weekly'" (click)="tab = 'weekly'">
          <i class="fas fa-calendar-week"></i> Weekly Schedule
        </button>
        <button class="tab-btn" [class.active]="tab === 'date'" (click)="tab = 'date'">
          <i class="fas fa-calendar-day"></i> Check a Date
        </button>
      </div>

      <!-- ── Weekly tab ── -->
      <div *ngIf="tab === 'weekly'">
        <div *ngIf="loadingWeekly" class="loading-center"><div class="spinner"></div></div>
        <div *ngIf="!loadingWeekly">
          <div *ngFor="let day of days" class="card day-card">
            <div class="day-hdr">
              <h3>{{ day }}</h3>
              <span class="badge badge-info">{{ countAssigned(day) }} of 8 assigned</span>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Time</th><th>Subject</th><th>Teacher</th>
                    <th><i class="fas fa-door-open"></i> Room</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let slot of allSlots"
                      [class.free-row]="!getPeriod(day, slot.number)">
                    <td>
                      <span class="p-badge" [class.p-free]="!getPeriod(day, slot.number)">
                        P{{ slot.number }}
                      </span>
                    </td>
                    <td>{{ slot.start }} – {{ slot.end }}</td>
                    <ng-container *ngIf="getPeriod(day, slot.number) as e">
                      <td><strong>{{ e.subject?.name }}</strong></td>
                      <td>{{ e.teacher?.name }}</td>
                      <td>
                        <span class="room-badge" [class.room-tbd]="!e.classroomNo || e.classroomNo === 'TBD'">
                          <i class="fas fa-map-marker-alt"></i>
                          {{ e.classroomNo || 'TBD' }}
                        </span>
                      </td>
                      <td><span class="badge badge-success">Scheduled</span></td>
                    </ng-container>
                    <ng-container *ngIf="!getPeriod(day, slot.number)">
                      <td colspan="4" class="free-cell">
                        <i class="fas fa-coffee"></i> Free Period
                      </td>
                    </ng-container>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Date tab ── -->
      <div *ngIf="tab === 'date'">
        <div class="card mb-1">
          <div class="form-group" style="margin:0">
            <label><i class="fas fa-calendar"></i> Select Date</label>
            <div class="date-row">
              <input type="date" class="form-control" [(ngModel)]="selectedDate" (change)="loadDate()" />
              <button class="btn btn-primary" (click)="loadDate()" [disabled]="!selectedDate || loadingDate">
                <i class="fas fa-search"></i> View
              </button>
            </div>
          </div>
        </div>

        <div *ngIf="loadingDate" class="loading-center"><div class="spinner"></div></div>

        <div *ngIf="!loadingDate && selectedDate" class="card">
          <div class="date-hdr">
            <h3>{{ selectedDate | date:'fullDate' }}</h3>
            <span class="badge badge-primary">{{ dateDayName }}</span>
          </div>

          <!-- Summary banners -->
          <div class="banners">
            <div class="banner banner-red" *ngIf="cancelledCount > 0">
              <i class="fas fa-exclamation-triangle"></i>
              <strong>{{ cancelledCount }} period(s) cancelled</strong> today.
            </div>
            <div class="banner banner-green" *ngIf="extraCount > 0">
              <i class="fas fa-plus-circle"></i>
              <strong>{{ extraCount }} extra class(es) offered</strong> by teachers!
            </div>
            <div class="banner banner-grey" *ngIf="cancelledCount === 0 && extraCount === 0">
              <i class="fas fa-check-circle"></i> No changes — regular schedule in effect.
            </div>
          </div>

          <!-- Full 8-period view -->
          <div class="date-periods">
            <div *ngFor="let slot of allSlots"
                 class="drow"
                 [class.drow-active]="isActive(slot.number)"
                 [class.drow-cancelled]="isCancelled(slot.number)"
                 [class.drow-extra]="hasExtra(slot.number)"
                 [class.drow-free]="isTrulyFree(slot.number)">

              <div class="drow-left">
                <span class="p-badge"
                      [class.p-active]="isActive(slot.number)"
                      [class.p-cancelled]="isCancelled(slot.number)"
                      [class.p-extra]="hasExtra(slot.number)"
                      [class.p-free]="isTrulyFree(slot.number)">P{{ slot.number }}</span>
                <div class="drow-time">{{ slot.start }}<br>{{ slot.end }}</div>
              </div>

              <!-- Active assigned period -->
              <div class="drow-mid" *ngIf="isActive(slot.number)">
                <span class="drow-subj">{{ getDatePeriod(slot.number)?.subject?.name }}</span>
                <span class="drow-teacher">{{ getDatePeriod(slot.number)?.teacher?.name }}</span>
                <span class="drow-room">
                  <i class="fas fa-door-open"></i>
                  Room: <strong>{{ getEffectiveRoom(slot.number) }}</strong>
                </span>
              </div>

              <!-- Cancelled period -->
              <div class="drow-mid" *ngIf="isCancelled(slot.number)">
                <span class="drow-subj cancelled-text">{{ getDatePeriod(slot.number)?.subject?.name }}</span>
                <span class="drow-teacher">{{ getDatePeriod(slot.number)?.teacher?.name }}</span>
                <span class="cancel-reason">
                  <i class="fas fa-exclamation-triangle"></i>
                  {{ getDatePeriod(slot.number)?.change?.reason }}
                </span>
              </div>

              <!-- Extra class on a free period -->
              <div class="drow-mid" *ngIf="hasExtra(slot.number)">
                <span class="drow-subj extra-text">
                  {{ getFreeSlot(slot.number)?.subject?.name }}
                  <span class="extra-tag">EXTRA</span>
                </span>
                <span class="drow-teacher">{{ getFreeSlot(slot.number)?.teacher?.name }}</span>
                <span class="extra-note" *ngIf="getFreeSlot(slot.number)?.note">
                  {{ getFreeSlot(slot.number).note }}
                </span>
              </div>

              <!-- Truly free — no class, no extra -->
              <div class="drow-mid free-mid" *ngIf="isTrulyFree(slot.number)">
                <i class="fas fa-coffee"></i> Free Period
              </div>

              <div class="drow-right">
                <span class="badge"
                      [class.badge-success]="isActive(slot.number)"
                      [class.badge-danger]="isCancelled(slot.number)"
                      [class.badge-info]="hasExtra(slot.number)"
                      [class.badge-secondary]="isTrulyFree(slot.number)">
                  {{ getDateStatus(slot.number) }}
                </span>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  `,
  styles: [`
    .page-container { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
    .mb-1 { margin-bottom: 1.25rem; }

    /* Tabs */
    .tab-bar { display: flex; gap: 0.4rem; margin-bottom: 1.5rem; background: var(--surface);
               border-radius: var(--radius); padding: 0.3rem; box-shadow: var(--shadow); width: fit-content; }
    .tab-btn { padding: 0.5rem 1.1rem; border: none; background: transparent; border-radius: var(--radius-sm);
               font-family: inherit; font-size: 0.875rem; font-weight: 500; cursor: pointer;
               color: var(--text-muted); display: flex; align-items: center; gap: 0.4rem; transition: all 0.2s; }
    .tab-btn.active { background: var(--primary); color: #fff; }

    /* Weekly table */
    .day-card { margin-bottom: 1.25rem; }
    .day-hdr  { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.9rem; }
    .day-hdr h3 { font-weight: 700; color: var(--primary); }
    .p-badge { background: var(--primary); color: #fff; padding: 0.2rem 0.45rem;
               border-radius: 4px; font-size: 0.72rem; font-weight: 700; }
    .p-free  { background: #9ca3af; }
    .free-row td { color: var(--text-muted); font-style: italic; }
    .free-cell { font-size: 0.85rem; }

    /* Room badge */
    .room-badge { display: inline-flex; align-items: center; gap: 0.3rem;
                  background: #ede9fe; color: #5b21b6; padding: 0.2rem 0.55rem;
                  border-radius: 6px; font-size: 0.78rem; font-weight: 600; }
    .room-badge.room-tbd { background: #f3f4f6; color: #9ca3af; }

    /* Date tab */
    .date-row { display: flex; gap: 0.75rem; margin-top: 0.4rem; }
    .date-row .form-control { flex: 1; }
    .date-hdr { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
    .date-hdr h3 { font-size: 1.1rem; font-weight: 600; }

    .banners { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; }
    .banner { display: flex; align-items: center; gap: 0.6rem; padding: 0.65rem 1rem;
              border-radius: var(--radius-sm); font-size: 0.875rem; }
    .banner-red   { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .banner-green { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
    .banner-grey  { background: #f1f5f9; color: var(--text-muted); border: 1px solid var(--border); }
    .badge-secondary { background: #f3f4f6; color: #6b7280; }

    /* Date period rows */
    .date-periods { display: flex; flex-direction: column; gap: 0.5rem; }
    .drow { display: flex; align-items: center; gap: 0.9rem; padding: 0.7rem 0.9rem;
            border: 1.5px solid var(--border); border-radius: var(--radius-sm); }
    .drow-active    { border-color: #93c5fd; background: #eff6ff; }
    .drow-cancelled { border-color: #fca5a5; background: #fff5f5; }
    .drow-extra     { border-color: #6ee7b7; background: #f0fdf4; }
    .drow-free      { border-color: var(--border); background: #fafafa; opacity: 0.6; }

    .drow-left { display: flex; flex-direction: column; align-items: center; gap: 0.15rem; min-width: 50px; }
    .drow-time { font-size: 0.68rem; color: var(--text-muted); text-align: center; line-height: 1.4; }
    .p-active    { background: #3b82f6; }
    .p-cancelled { background: var(--danger); }
    .p-extra     { background: var(--success); }

    .drow-mid { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
    .drow-subj    { font-weight: 600; font-size: 0.88rem; }
    .drow-teacher { font-size: 0.76rem; color: var(--text-muted); }
    .drow-room    { font-size: 0.76rem; color: #5b21b6; margin-top: 0.1rem; }
    .cancelled-text { text-decoration: line-through; color: var(--danger); }
    .cancel-reason  { font-size: 0.76rem; color: var(--danger); }
    .extra-text { color: #065f46; }
    .extra-tag { background: #6ee7b7; color: #065f46; padding: 0.1rem 0.4rem;
                 border-radius: 4px; font-size: 0.68rem; margin-left: 0.3rem; font-weight: 700; }
    .extra-note { font-size: 0.76rem; color: #059669; }
    .free-mid   { font-size: 0.85rem; color: #9ca3af; display: flex; align-items: center; gap: 0.35rem; }

    .drow-right { flex-shrink: 0; }
  `]
})
export class StudentTimetableComponent implements OnInit {
  tab           = 'weekly';
  days          = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  grouped: Record<string, any[]> = {};
  loadingWeekly = true;
  allSlots      = PERIOD_TIMES;

  selectedDate   = '';
  dateTimetable: any[] = [];
  dateFreeSlots: any[] = [];
  dateDayName   = '';
  loadingDate   = false;

  private className = '';

  get cancelledCount(): number { return this.dateTimetable.filter((e: any) => e.isChanged).length; }
  get extraCount():     number { return this.dateFreeSlots.filter((f: any) => f.status === 'active').length; }

  constructor(private svc: TimetableService) {}

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.className = user.className || '';

    // Load weekly timetable scoped to this student's class
    this.svc.getFixedTimetable(this.className).subscribe({
      next:  (r: any) => { this.grouped = r.timetable || {}; this.loadingWeekly = false; },
      error: ()       => { this.loadingWeekly = false; }
    });
    const _t = new Date();
    this.selectedDate = `${_t.getFullYear()}-${String(_t.getMonth()+1).padStart(2,'0')}-${String(_t.getDate()).padStart(2,'0')}`;
  }

  countAssigned(day: string): number { return (this.grouped[day] || []).length; }
  getPeriod(day: string, num: number): any {
    return (this.grouped[day] || []).find((e: any) => e.periodNumber === num);
  }

  loadDate(): void {
    if (!this.selectedDate) return;
    this.loadingDate   = true;
    this.dateTimetable = [];
    this.dateFreeSlots = [];
    this.svc.getTimetableForDate(this.selectedDate, this.className).subscribe({
      next:  (r: any) => { this.dateTimetable = r.timetable || []; this.dateDayName = r.dayName || ''; this.loadingDate = false; },
      error: ()       => { this.loadingDate = false; }
    });
    this.svc.getFreeSlots({ date: this.selectedDate, className: this.className }).subscribe({
      next: (r: any) => { this.dateFreeSlots = r.freeSlots || []; }
    });
  }

  getDatePeriod(num: number): any {
    return this.dateTimetable.find((e: any) => e.periodNumber === num);
  }
  getFreeSlot(num: number): any {
    return this.dateFreeSlots.find((f: any) => f.periodNumber === num && f.status === 'active');
  }

  // Effective room: use change override if present, else fixed entry classroomNo
  getEffectiveRoom(num: number): string {
    const e = this.getDatePeriod(num);
    if (!e) return 'TBD';
    const overrideRoom = e.change?.classroomNo;
    return overrideRoom || e.classroomNo || 'TBD';
  }

  isActive(num: number):    boolean { const e = this.getDatePeriod(num); return !!e && !e.isChanged; }
  isCancelled(num: number): boolean { const e = this.getDatePeriod(num); return !!e && !!e.isChanged; }
  hasExtra(num: number):    boolean { return !this.getDatePeriod(num) && !!this.getFreeSlot(num); }
  isTrulyFree(num: number): boolean { return !this.getDatePeriod(num) && !this.getFreeSlot(num); }

  getDateStatus(num: number): string {
    if (this.isCancelled(num)) return '❌ Cancelled';
    if (this.isActive(num))    return '✅ Active';
    if (this.hasExtra(num))    return '📗 Extra';
    return '—';
  }
}
