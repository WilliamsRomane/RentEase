import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

interface MaintenanceRequest {
  status: 'open' | 'in_progress' | 'resolved';
}

@Injectable({
  providedIn: 'root',
})
export class MaintenanceQueueService {
  private readonly maintenanceQueueCountSubject = new BehaviorSubject<number>(0);
  readonly maintenanceQueueCount$ = this.maintenanceQueueCountSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  refreshCount(): void {
    const currentUser = this.authService.currentUser;
    if (!currentUser) {
      this.maintenanceQueueCountSubject.next(0);
      return;
    }

    const endpoint =
      currentUser.role === 'landlord'
        ? 'http://localhost:4000/api/landlord/maintenance-requests'
        : 'http://localhost:4000/api/tenant/maintenance-requests';

    this.http.get<MaintenanceRequest[]>(endpoint).subscribe({
      next: (requests) => {
        this.setCountFromRequests(requests);
      },
      error: () => {
        this.maintenanceQueueCountSubject.next(0);
      },
    });
  }

  syncFromRequests(requests: MaintenanceRequest[]): void {
    this.setCountFromRequests(requests);
  }

  private setCountFromRequests(requests: MaintenanceRequest[]): void {
    const pendingCount = requests.filter((request) => request.status !== 'resolved').length;
    this.maintenanceQueueCountSubject.next(pendingCount);
  }
}
