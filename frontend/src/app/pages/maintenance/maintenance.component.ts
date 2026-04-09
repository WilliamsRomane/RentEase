import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { MaintenanceQueueService } from '../../services/maintenance-queue.service';

interface MaintenanceRequest {
  id: number;
  issueTitle: string;
  issueDescription: string;
  status: 'open' | 'in_progress' | 'resolved';
  landlordResponse?: string | null;
  landlordRespondedAt?: string | null;
  createdAt: string;
  property?: { address?: string };
  tenant?: { user?: { name?: string; email?: string } };
}

@Component({
  selector: 'app-maintenance',
  templateUrl: './maintenance.component.html',
  styleUrls: ['./maintenance.component.scss'],
})
export class MaintenanceComponent implements OnInit {
  maintenanceRequests: MaintenanceRequest[] = [];
  loading = false;
  saving = false;

  newRequest = {
    issueTitle: '',
    issueDescription: '',
  };

  landlordResponses: Record<number, { landlordResponse: string; status: string }> = {};

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private maintenanceQueueService: MaintenanceQueueService,
  ) {}

  ngOnInit(): void {
    this.loadMaintenanceRequests();
  }

  get isLandlord(): boolean {
    return this.authService.currentUser?.role === 'landlord';
  }

  get isTenant(): boolean {
    return this.authService.currentUser?.role === 'tenant';
  }

  loadMaintenanceRequests(): void {
    this.loading = true;
    const endpoint = this.isLandlord
      ? 'http://localhost:4000/api/landlord/maintenance-requests'
      : 'http://localhost:4000/api/tenant/maintenance-requests';

    this.http.get<MaintenanceRequest[]>(endpoint).subscribe({
      next: (data) => {
        this.maintenanceRequests = data;
        this.maintenanceQueueService.syncFromRequests(data);
        this.loading = false;

        if (this.isLandlord) {
          this.landlordResponses = data.reduce((responses, request) => {
            responses[request.id] = {
              landlordResponse: request.landlordResponse || '',
              status: request.status || 'open',
            };
            return responses;
          }, {} as Record<number, { landlordResponse: string; status: string }>);
        }
      },
      error: (err) => {
        console.error('Failed to load maintenance requests', err);
        this.maintenanceQueueService.refreshCount();
        this.loading = false;
      },
    });
  }

  submitRequest(): void {
    if (!this.isTenant) {
      return;
    }

    this.saving = true;
    this.http
      .post('http://localhost:4000/api/tenant/maintenance-requests', this.newRequest)
      .subscribe({
        next: () => {
          this.newRequest = { issueTitle: '', issueDescription: '' };
          this.saving = false;
          this.loadMaintenanceRequests();
          this.snackBar.open('Maintenance request submitted.', 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          console.error('Failed to submit maintenance request', err);
          this.saving = false;
          this.snackBar.open(
            err?.error?.message || 'Could not submit maintenance request.',
            'Close',
            { duration: 4000 },
          );
        },
      });
  }

  respondToRequest(requestId: number): void {
    if (!this.isLandlord) {
      return;
    }

    const payload = this.landlordResponses[requestId];
    this.http
      .patch(
        `http://localhost:4000/api/landlord/maintenance-requests/${requestId}/respond`,
        payload,
      )
      .subscribe({
        next: () => {
          this.loadMaintenanceRequests();
          this.snackBar.open('Maintenance response sent.', 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          console.error('Failed to respond to maintenance request', err);
          this.snackBar.open(
            err?.error?.message || 'Could not send maintenance response.',
            'Close',
            { duration: 4000 },
          );
        },
      });
  }
}
