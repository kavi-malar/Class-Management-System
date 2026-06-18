import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { NotificationService } from '../../../services/notification.service';

@Component({
  selector: 'app-student-notifications',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page-container">

      <div class="page-header">
        <h1><i class="fas fa-bell"></i> My Notifications</h1>
        <p>All SMS alerts sent to your number <strong>{{ userPhone }}</strong>.</p>
      </div>

      <!-- Summary bar -->
      <div class="summary-bar card" *ngIf="notifications.length > 0">
        <div class="sum-item">
          <span class="sum-num">{{ notifications.length }}</span>
          <span class="sum-label">Total</span>
        </div>
        <div class="sum-item sum-sent">
          <span class="sum-num">{{ countByStatus('sent') + countByStatus('delivered') }}</span>
          <span class="sum-label">Delivered</span>
        </div>
        <div class="sum-item sum-failed" *ngIf="countByStatus('failed') > 0">
          <span class="sum-num">{{ countByStatus('failed') }}</span>
          <span class="sum-label">Failed</span>
        </div>
        <div class="sum-item sum-pending" *ngIf="countByStatus('pending') > 0">
          <span class="sum-num">{{ countByStatus('pending') }}</span>
          <span class="sum-label">Pending</span>
        </div>
      </div>

      <div *ngIf="loading" class="loading-center">
        <div class="spinner"></div><p>Loading notifications…</p>
      </div>

      <div class="card empty-card" *ngIf="!loading && notifications.length === 0">
        <i class="fas fa-bell-slash"></i>
        <h3>No notifications yet</h3>
        <p>You will receive an SMS and see it here whenever a teacher makes a change.</p>
      </div>

      <div class="notif-list card" *ngIf="!loading && notifications.length > 0">
        <div *ngFor="let n of notifications" class="notif-item"
             [class.type-change]="n.type === 'timetable_change'"
             [class.type-reminder]="n.type === 'daily_reminder'">

          <!-- Icon -->
          <div class="notif-icon">
            <i class="fas"
               [class.fa-calendar-times]="n.type === 'timetable_change'"
               [class.fa-clock]="n.type === 'daily_reminder'"
               [class.fa-bell]="n.type === 'general'"></i>
          </div>

          <!-- Content -->
          <div class="notif-body">
            <div class="notif-top">
              <!-- Type badge -->
              <span class="badge"
                    [class.badge-danger]="n.type === 'timetable_change'"
                    [class.badge-info]="n.type === 'daily_reminder'">
                {{ n.type === 'timetable_change' ? 'Timetable Change' : n.type === 'daily_reminder' ? 'Daily Reminder' : 'General' }}
              </span>

              <!-- SMS delivery status -->
              <span class="sms-status"
                    [class.status-ok]="n.status === 'sent' || n.status === 'delivered'"
                    [class.status-fail]="n.status === 'failed'"
                    [class.status-pending]="n.status === 'pending'">
                <i class="fas"
                   [class.fa-check-circle]="n.status === 'sent' || n.status === 'delivered'"
                   [class.fa-times-circle]="n.status === 'failed'"
                   [class.fa-hourglass-half]="n.status === 'pending'"></i>
                SMS {{ n.status | titlecase }}
                <span class="twilio-sid" *ngIf="n.twilioSid && !n.twilioSid.startsWith('MOCK')">
                  · SID: {{ n.twilioSid | slice:0:12 }}…
                </span>
                <span class="mock-badge" *ngIf="n.twilioSid?.startsWith('MOCK')">
                  · Mock (Twilio not configured)
                </span>
              </span>

              <span class="notif-time">{{ n.createdAt | date:'dd MMM yyyy, hh:mm a' }}</span>
            </div>

            <!-- SMS message bubble -->
            <div class="sms-bubble">
              <div class="sms-to">
                <i class="fas fa-mobile-alt"></i> Sent to: {{ n.recipientPhone }}
              </div>
              <pre class="sms-text">{{ n.message }}</pre>
            </div>

            <!-- Error if failed -->
            <div class="error-msg" *ngIf="n.status === 'failed' && n.errorMessage">
              <i class="fas fa-exclamation-triangle"></i> Error: {{ n.errorMessage }}
            </div>
          </div>

        </div>
      </div>

    </main>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding: 2rem 1.5rem; }

    /* Summary bar */
    .summary-bar {
      display: flex; gap: 2rem; align-items: center;
      padding: 1rem 1.5rem; margin-bottom: 1.25rem; flex-wrap: wrap;
    }
    .sum-item    { display: flex; flex-direction: column; align-items: center; }
    .sum-num     { font-size: 1.5rem; font-weight: 800; line-height: 1; }
    .sum-label   { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }
    .sum-sent    .sum-num  { color: var(--success); }
    .sum-failed  .sum-num  { color: var(--danger); }
    .sum-pending .sum-num  { color: var(--warning); }

    /* Empty state */
    .empty-card { text-align: center; padding: 3rem; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }
    .empty-card i { font-size: 3rem; opacity: 0.3; }
    .empty-card h3 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--text); }
    .empty-card p  { margin: 0; font-size: 0.875rem; }

    /* Notification list */
    .notif-list { padding: 0; overflow: hidden; }
    .notif-item {
      display: flex; gap: 1rem; padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border); transition: background 0.15s;
    }
    .notif-item:last-child { border-bottom: none; }
    .notif-item:hover { background: #f8fafc; }
    .notif-item.type-change  { border-left: 4px solid var(--danger); }
    .notif-item.type-reminder{ border-left: 4px solid var(--secondary); }

    .notif-icon {
      width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 1rem;
    }
    .type-change  .notif-icon { background: #fee2e2; color: var(--danger); }
    .type-reminder .notif-icon{ background: #cffafe; color: var(--secondary); }

    .notif-body { flex: 1; min-width: 0; }

    .notif-top {
      display: flex; align-items: center; gap: 0.75rem;
      flex-wrap: wrap; margin-bottom: 0.75rem;
    }
    .notif-time { font-size: 0.75rem; color: var(--text-muted); margin-left: auto; }

    /* SMS delivery status */
    .sms-status {
      display: inline-flex; align-items: center; gap: 0.35rem;
      font-size: 0.78rem; font-weight: 600; padding: 0.2rem 0.6rem;
      border-radius: 9999px;
    }
    .status-ok      { background: #d1fae5; color: #065f46; }
    .status-fail    { background: #fee2e2; color: #991b1b; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .twilio-sid  { font-weight: 400; opacity: 0.75; font-family: monospace; }
    .mock-badge  { font-weight: 400; color: #6b7280; }

    /* SMS message bubble */
    .sms-bubble {
      background: #f8fafc; border: 1px solid var(--border);
      border-radius: var(--radius-sm); padding: 0.75rem 1rem;
    }
    .sms-to {
      font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem;
      display: flex; align-items: center; gap: 0.35rem;
    }
    .sms-text {
      white-space: pre-wrap; font-family: inherit; margin: 0;
      font-size: 0.85rem; line-height: 1.65; color: var(--text);
    }

    .error-msg {
      margin-top: 0.5rem; font-size: 0.8rem; color: var(--danger);
      display: flex; align-items: center; gap: 0.4rem;
    }
  `]
})
export class StudentNotificationsComponent implements OnInit {
  notifications: any[] = [];
  loading   = true;
  userPhone = '';

  constructor(private notifService: NotificationService) {}

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.userPhone = user.phone || '';

    this.notifService.getNotifications().subscribe({
      next: (res: any) => {
        this.notifications = res.notifications || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  countByStatus(status: string): number {
    return this.notifications.filter(n => n.status === status).length;
  }
}
