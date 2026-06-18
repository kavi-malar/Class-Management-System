import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login', canActivate: [loginGuard],
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'teacher', canActivate: [authGuard], data: { role: 'teacher' },
    children: [
      { path: 'dashboard',        loadComponent: () => import('./components/teacher/dashboard/teacher-dashboard.component').then(m => m.TeacherDashboardComponent) },
      { path: 'timetable',        loadComponent: () => import('./components/teacher/timetable/teacher-timetable.component').then(m => m.TeacherTimetableComponent) },
      { path: 'mark-unavailable', loadComponent: () => import('./components/teacher/mark-unavailable/mark-unavailable.component').then(m => m.MarkUnavailableComponent) },
      { path: 'mark-available',   loadComponent: () => import('./components/teacher/mark-available/mark-available.component').then(m => m.MarkAvailableComponent) },
      { path: 'changes',          loadComponent: () => import('./components/teacher/changes/teacher-changes.component').then(m => m.TeacherChangesComponent) },
      { path: 'polls',            loadComponent: () => import('./components/teacher/polls/teacher-polls.component').then(m => m.TeacherPollsComponent) },
      { path: 'rooms',            loadComponent: () => import('./components/shared/room-board/room-board-page.component').then(m => m.RoomBoardPageComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'student', canActivate: [authGuard], data: { role: 'student' },
    children: [
      { path: 'dashboard',     loadComponent: () => import('./components/student/dashboard/student-dashboard.component').then(m => m.StudentDashboardComponent) },
      { path: 'timetable',     loadComponent: () => import('./components/student/timetable/student-timetable.component').then(m => m.StudentTimetableComponent) },
      { path: 'notifications', loadComponent: () => import('./components/student/notifications/student-notifications.component').then(m => m.StudentNotificationsComponent) },
      { path: 'polls',         loadComponent: () => import('./components/student/polls/student-polls.component').then(m => m.StudentPollsComponent) },
      { path: 'rooms',         loadComponent: () => import('./components/shared/room-board/room-board-page.component').then(m => m.RoomBoardPageComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'cr', canActivate: [authGuard], data: { role: 'cr' },
    children: [
      { path: 'dashboard', loadComponent: () => import('./components/cr/dashboard/cr-dashboard.component').then(m => m.CrDashboardComponent) },
      { path: 'timetable', loadComponent: () => import('./components/cr/timetable/cr-timetable.component').then(m => m.CrTimetableComponent) },
      { path: 'rooms',     loadComponent: () => import('./components/shared/room-board/room-board-page.component').then(m => m.RoomBoardPageComponent) },
      { path: 'poll',      loadComponent: () => import('./components/cr/poll/cr-poll.component').then(m => m.CrPollComponent) },
      { path: 'polls',     loadComponent: () => import('./components/cr/poll/cr-polls.component').then(m => m.CrPollsComponent) },
      { path: 'reports',   loadComponent: () => import('./components/cr/report/cr-report.component').then(m => m.CrReportComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'admin', canActivate: [authGuard], data: { role: 'admin' },
    children: [
      { path: 'dashboard', loadComponent: () => import('./components/admin/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent) },
      { path: 'rooms',     loadComponent: () => import('./components/admin/rooms/admin-rooms.component').then(m => m.AdminRoomsComponent) },
      { path: 'timetable', loadComponent: () => import('./components/admin/timetable/admin-timetable.component').then(m => m.AdminTimetableComponent) },
      { path: 'classes',   loadComponent: () => import('./components/admin/classes/admin-classes.component').then(m => m.AdminClassesComponent) },
      { path: 'users',     loadComponent: () => import('./components/admin/users/admin-users.component').then(m => m.AdminUsersComponent) },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '/login' }
];
