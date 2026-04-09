import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './services/auth.service';
import { MaintenanceQueueService } from './services/maintenance-queue.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  maintenanceQueueCount = 0;
  private readonly subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private router: Router,
    private maintenanceQueueService: MaintenanceQueueService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user) => {
        if (user) {
          this.maintenanceQueueService.refreshCount();
          return;
        }

        this.maintenanceQueueCount = 0;
      }),
    );

    this.subscriptions.add(
      this.maintenanceQueueService.maintenanceQueueCount$.subscribe((count) => {
        this.maintenanceQueueCount = count;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  get isLoggedIn(): boolean {
    return !!this.authService.getToken();
  }

  get dashboardRoute(): string {
    return this.authService.currentUser?.role === 'landlord'
      ? '/landlord/dashboard'
      : '/tenant/dashboard';
  }

  get currentUserName(): string {
    return this.authService.currentUser?.name || 'Account';
  }
}
