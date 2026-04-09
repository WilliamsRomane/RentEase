import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

interface Property {
  id: number;
  address: string;
  rentAmount: number;
  dueDay: number;
  gracePeriodDays: number;
  dailyLateFee: number;
  tenants: any[];
}

interface Payment {
  id: number;
  amount: number;
  status: string;
  paymentDate: string | null;
  expectedAmount?: number;
  balanceRemaining?: number;
  statusLabel?: string;
  isShortPayment?: boolean;
  tenant?: { user?: { name?: string } };
  property?: { address?: string };
}

interface TenantSummary {
  id: number;
  propertyId?: number;
  rentAmount: number;
  nextDueDate: string | null;
  user?: { name?: string; email?: string };
  property?: { address?: string };
  payments?: Payment[];
}

interface DashboardNotification {
  id: number;
  message: string;
  createdAt: string;
  tenant?: { user?: { name?: string } };
  property?: { address?: string };
}

interface BillingStatus {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  isActive: boolean;
}

@Component({
  selector: 'app-landlord-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  properties: Property[] = [];
  payments: Payment[] = [];
  tenants: TenantSummary[] = [];
  notifications: DashboardNotification[] = [];
  reminders: any[] = [];
  reports: any = null;
  billingStatus: BillingStatus | null = null;
  loadingBillingStatus = false;
  startingSubscription = false;
  openingBillingPortal = false;
  showPropertyForm = false;
  showTenantForm = false;
  selectedPropertyId: number | null = null;

  newProperty = {
    address: '',
    rentAmount: 0,
    dueDay: 1,
    gracePeriodDays: 5,
    dailyLateFee: 0,
  };

  newTenant = {
    name: '',
    email: '',
    propertyId: 0,
    rentAmount: 0,
    nextDueDate: '',
  };

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.handleBillingReturn();
    this.loadProperties();
    this.loadPayments();
    this.loadTenants();
    this.loadReminders();
    this.loadReports();
    this.loadNotifications();
    this.loadBillingStatus();
  }

  loadBillingStatus() {
    this.loadingBillingStatus = true;
    this.http.get<BillingStatus>('http://localhost:4000/api/billing/subscription-status').subscribe({
      next: (data) => {
        this.billingStatus = data;
        this.loadingBillingStatus = false;
      },
      error: (err) => {
        console.error('Failed to load billing status', err);
        this.loadingBillingStatus = false;
      },
    });
  }

  startSubscription() {
    this.startingSubscription = true;
    const baseUrl = window.location.origin;
    this.http.post<{ sessionUrl: string }>('http://localhost:4000/api/billing/checkout-session', {
      successUrl: `${baseUrl}/landlord/dashboard?billing=success`,
      cancelUrl: `${baseUrl}/landlord/dashboard?billing=cancelled`,
    }).subscribe({
      next: (data) => {
        this.startingSubscription = false;
        window.location.href = data.sessionUrl;
      },
      error: (err) => {
        console.error('Failed to start subscription checkout', err);
        this.startingSubscription = false;
        this.snackBar.open(
          this.getErrorMessage(err, 'Could not start subscription checkout.'),
          'Close',
          { duration: 4500 },
        );
      },
    });
  }

  openBillingPortal() {
    this.openingBillingPortal = true;
    const baseUrl = window.location.origin;
    this.http.post<{ url: string }>('http://localhost:4000/api/billing/portal-session', {
      returnUrl: `${baseUrl}/landlord/dashboard`,
    }).subscribe({
      next: (data) => {
        this.openingBillingPortal = false;
        window.location.href = data.url;
      },
      error: (err) => {
        console.error('Failed to open billing portal', err);
        this.openingBillingPortal = false;
        this.snackBar.open(
          this.getErrorMessage(err, 'Could not open billing portal.'),
          'Close',
          { duration: 4500 },
        );
      },
    });
  }

  get subscriptionStatusLabel(): string {
    const rawStatus = (this.billingStatus?.subscriptionStatus || 'inactive').replace('_', ' ');
    return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
  }

  private handleBillingReturn() {
    const query = new URLSearchParams(window.location.search);
    const billingState = query.get('billing');
    if (!billingState) {
      return;
    }

    if (billingState === 'success') {
      this.snackBar.open(
        'Payment completed. Verifying subscription status...',
        'Close',
        { duration: 3500 },
      );
      this.pollBillingStatusAfterReturn();
      this.clearBillingQueryParams();
      return;
    }

    if (billingState === 'cancelled') {
      this.snackBar.open('Subscription checkout was cancelled.', 'Close', { duration: 3500 });
      this.clearBillingQueryParams();
    }
  }

  private clearBillingQueryParams() {
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  }

  private pollBillingStatusAfterReturn(attempt = 0) {
    const maxAttempts = 8;
    const delayMs = 2000;

    this.http.get<BillingStatus>('http://localhost:4000/api/billing/subscription-status').subscribe({
      next: (data) => {
        this.billingStatus = data;
        if (data.isActive) {
          this.snackBar.open('Subscription activated.', 'Close', { duration: 3500 });
          return;
        }

        if (attempt < maxAttempts - 1) {
          window.setTimeout(() => this.pollBillingStatusAfterReturn(attempt + 1), delayMs);
          return;
        }

        this.snackBar.open(
          'Subscription is still pending verification. It will activate after provider confirmation.',
          'Close',
          { duration: 5000 },
        );
      },
      error: (err) => {
        console.error('Failed to verify subscription status after return', err);
        if (attempt < maxAttempts - 1) {
          window.setTimeout(() => this.pollBillingStatusAfterReturn(attempt + 1), delayMs);
          return;
        }
        this.snackBar.open(
          this.getErrorMessage(err, 'Could not verify subscription status yet.'),
          'Close',
          { duration: 4500 },
        );
      },
    });
  }

  loadNotifications() {
    this.http.get<DashboardNotification[]>('http://localhost:4000/api/landlord/notifications').subscribe({
      next: (data) => {
        this.notifications = data;
      },
      error: (err) => console.error('Failed to load notifications', err),
    });
  }

  markNotificationAsRead(notificationId: number) {
    this.http
      .patch(`http://localhost:4000/api/landlord/notifications/${notificationId}/read`, {})
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(
            (notification) => notification.id !== notificationId,
          );
        },
        error: (err) => {
          console.error('Failed to update notification', err);
          this.snackBar.open(
            this.getErrorMessage(err, 'Could not update notification.'),
            'Close',
            { duration: 4000 },
          );
        },
      });
  }

  loadReminders() {
    this.http.get<any[]>('http://localhost:4000/api/landlord/reminders').subscribe({
      next: (data) => {
        this.reminders = data;
      },
      error: (err) => console.error('Failed to load reminders', err),
    });
  }

  loadReports() {
    this.http.get<any>('http://localhost:4000/api/landlord/reports').subscribe({
      next: (data) => {
        this.reports = data;
      },
      error: (err) => console.error('Failed to load reports', err),
    });
  }

  loadProperties() {
    this.http.get<Property[]>('http://localhost:4000/api/landlord/properties').subscribe({
      next: (data) => {
        this.properties = data;
        if (!data.length) {
          this.selectedPropertyId = null;
        } else if (
          this.selectedPropertyId === null ||
          !data.some((property) => property.id === this.selectedPropertyId)
        ) {
          this.selectedPropertyId = data[0].id;
        }
      },
      error: (err) => console.error('Failed to load properties', err),
    });
  }

  loadTenants() {
    this.http.get<TenantSummary[]>('http://localhost:4000/api/landlord/tenants').subscribe({
      next: (data) => {
        this.tenants = data;
      },
      error: (err) => console.error('Failed to load tenants', err),
    });
  }

  loadPayments() {
    this.http
      .get<TenantSummary[]>('http://localhost:4000/api/landlord/payments')
      .subscribe({
        next: (data) => {
          this.payments = data.flatMap((tenant) => {
            const expectedAmount = Number(tenant.rentAmount || 0);
            const payments = tenant.payments || [];
            const monthlyTotals = new Map<string, number>();

            for (const payment of payments) {
              const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
              const monthKey = paymentDate
                ? `${paymentDate.getFullYear()}-${paymentDate.getMonth() + 1}`
                : 'unknown';
              const runningTotal = monthlyTotals.get(monthKey) || 0;
              monthlyTotals.set(monthKey, runningTotal + Number(payment.amount || 0));
            }

            return payments.map((payment) => {
              const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;
              const monthKey = paymentDate
                ? `${paymentDate.getFullYear()}-${paymentDate.getMonth() + 1}`
                : 'unknown';
              const totalPaidForMonth = monthlyTotals.get(monthKey) || 0;
              const balanceRemaining = Math.max(0, expectedAmount - totalPaidForMonth);
              const isShortPayment = balanceRemaining > 0;

              return {
                ...payment,
                expectedAmount,
                balanceRemaining,
                isShortPayment,
                statusLabel: isShortPayment
                  ? `Balance Owed: $${balanceRemaining.toFixed(2)}`
                  : payment.status,
                tenant: { user: tenant.user },
                property: tenant.property,
              };
            });
          });
        },
        error: (err) => console.error('Failed to load payments', err),
      });
  }

  createProperty() {
    this.http
      .post('http://localhost:4000/api/landlord/property', this.newProperty)
      .subscribe({
        next: () => {
          this.newProperty = {
            address: '',
            rentAmount: 0,
            dueDay: 1,
            gracePeriodDays: 5,
            dailyLateFee: 0,
          };
          this.showPropertyForm = false;
          this.loadProperties();
          this.loadPayments();
          this.snackBar.open('Property added successfully.', 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          console.error('Failed to create property', err);
          this.snackBar.open(this.getErrorMessage(err, 'Could not create property.'), 'Close', {
            duration: 4000,
          });
        },
      });
  }

  createTenant() {
    this.http
      .post('http://localhost:4000/api/landlord/tenant', this.newTenant)
      .subscribe({
        next: () => {
          this.newTenant = { name: '', email: '', propertyId: 0, rentAmount: 0, nextDueDate: '' };
          this.showTenantForm = false;
          this.loadProperties();
          this.loadTenants();
          this.loadPayments();
          this.snackBar.open('Tenant added successfully.', 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          console.error('Failed to add tenant', err);
          this.snackBar.open(
            this.getErrorMessage(
              err,
              'Could not add tenant. Make sure the email belongs to a registered tenant account.',
            ),
            'Close',
            { duration: 5000 },
          );
        },
      });
  }

  togglePropertyForm() {
    this.showPropertyForm = !this.showPropertyForm;
    if (this.showPropertyForm) {
      this.showTenantForm = false;
    }
  }

  toggleTenantForm() {
    this.showTenantForm = !this.showTenantForm;
    if (this.showTenantForm) {
      this.showPropertyForm = false;
    }
  }

  deleteTenant(tenantId: number) {
    this.http
      .delete(`http://localhost:4000/api/landlord/tenant/${tenantId}`)
      .subscribe({
        next: () => {
          this.loadProperties();
          this.loadTenants();
          this.loadPayments();
          this.loadReports();
          this.loadReminders();
          this.loadNotifications();
          this.snackBar.open('Tenant deleted successfully.', 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          console.error('Failed to delete tenant', err);
          this.snackBar.open(
            this.getErrorMessage(err, 'Could not delete tenant.'),
            'Close',
            { duration: 4000 },
          );
        },
      });
  }

  deleteProperty(propertyId: number) {
    this.http
      .delete(`http://localhost:4000/api/landlord/property/${propertyId}`)
      .subscribe({
        next: () => {
          this.loadProperties();
          this.loadTenants();
          this.loadPayments();
          this.loadReports();
          this.loadReminders();
          this.loadNotifications();
          this.snackBar.open('Property deleted successfully.', 'Close', {
            duration: 3000,
          });
        },
        error: (err) => {
          console.error('Failed to delete property', err);
          this.snackBar.open(
            this.getErrorMessage(err, 'Could not delete property.'),
            'Close',
            { duration: 4000 },
          );
        },
      });
  }

  togglePropertyCard(propertyId: number): void {
    this.selectedPropertyId = this.selectedPropertyId === propertyId ? null : propertyId;
  }

  isPropertySelected(propertyId: number): boolean {
    return this.selectedPropertyId === propertyId;
  }

  getTenantsForProperty(propertyId: number): TenantSummary[] {
    return this.tenants.filter((tenant) => tenant.propertyId === propertyId);
  }

  private getErrorMessage(err: any, fallback: string): string {
    if (err?.error?.message) {
      return err.error.message;
    }

    if (Array.isArray(err?.error?.errors) && err.error.errors.length > 0) {
      return err.error.errors[0].msg || fallback;
    }

    return fallback;
  }
}
