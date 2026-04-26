import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { API_BASE_URL } from '../../config/api.config';

interface RentInfo {
  rentAmount: number;
  nextDueDate: string;
  property: { address: string };
  dueAmount: number;
  outstanding: number;
  lateFee: number;
  isLate: boolean;
  daysUntilDue: number | null;
  dueSoon: boolean;
  reminderMessage: string | null;
}

interface PaymentMethodForm {
  paymentMethod: string;
  landlordBankName: string;
  landlordAccountName: string;
  landlordAccountNumber: string;
  landlordBranch: string;
  landlordAccountType: string;
  landlordRoutingNumber: string;
  landlordLynxPhoneNumber: string;
  paymentInstructions: string;
}

interface Payment {
  id: number;
  amount: number;
  status: string;
  paymentDate: string;
  transactionId: string;
}

@Component({
  selector: 'app-tenant-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  readonly jamaicanBanks = [
    'Bank of Nova Scotia Jamaica Limited (Scotiabank)',
    'National Commercial Bank Jamaica Limited (NCB)',
    'Sagicor Bank Jamaica Limited',
    'CIBC Caribbean Bank (Jamaica) Limited',
    'JMMB Bank (Jamaica) Limited',
    'First Global Bank Limited',
    'JN Bank Limited',
    'VM Building Society (VMBS)',
  ];
  readonly scotiabankBranches = [
    'Browns Town',
    'Christiana',
    'Constant Spring Road',
    'Fairview Financial Centre',
    'Ironshore',
    'Half Way Tree',
    'Hagley Park Road',
    'Junction',
    'Liguanea',
    'Linstead',
    'Mandeville',
    'May Pen',
    'Montego Bay',
    'Morant Bay',
    'Negril',
    'New Kingston',
    'Ocho Rios',
    'Oxford Road',
    'Port Antonio',
    'Port Maria',
    'Portmore',
    'Santa Cruz',
    'Savannah-la-Mar',
    'Scotiabank Centre (Main Branch)',
    'Spanish Town',
    'St. Ann’s Bay',
    'Trelawny',
    'University of the West Indies, Mona Campus',
  ];
  readonly ncbBranches = [
    'Head Office (Atrium)',
    'Half Way Tree',
    "Matilda's Corner",
    'Constant Spring',
    'Knutsford Boulevard',
    'Sovereign Centre',
    'Duke Street',
    'University of The West Indies (UWI)',
    'Portmore',
    'Hilo Portmore',
    'St. Jago Branch',
    'St. Jago Shopping Centre',
    'Linstead',
    'Old Harbour',
    'Port Maria',
    'Port Antonio',
    'May Pen',
    'Morant Bay',
    'Chapelton',
    'Ocho Rios',
    "St. Ann's Bay",
    'Spalding',
    "Brown's Town",
    'Black River',
    'Christiana',
    'Mandeville',
    'Junction',
    'Santa Cruz Branch',
    'Falmouth',
    'Half Moon',
    'St. James Street',
    'Fairview Financial Centre',
    'Baywest',
    'Savanna La Mar',
    'Lucea',
    'Green Island',
    'Negril',
    'NCB Cayman',
    'NCB London',
  ];
  readonly sagicorBranches = [
    'Portmore',
    'Tropical Plaza',
    'Head Office',
    'Hope Road',
    'New Brunswick Village',
    'Duke Street',
    'Tower Street',
    'Up Park Camp',
    'Shopping Centre',
    'New Kingston Business Centre',
    'May Pen',
    'Montego Bay',
    'Mandeville',
    'Montego Bay Commercial Centre',
    'LOJ',
  ];
  readonly cibcBranches = [
    'NEW KINGSTON',
    'HALF WAY TREE',
    'KING STREET',
    'LIGUANEA',
    'MANDEVILLE',
    'MANOR PARK',
    'MAYPEN',
    'FAIRVIEW',
    'OCHO RIOS',
    'PORT ANTONIO',
    'PORTMORE',
    'SAVANNA-LA-MAR',
    'ST. JAMES STREET',
  ];
  readonly jmmbBranches = [
    'Portmore',
    'Haughton Avenue',
    'Knutsford Boulevard',
    'Head Office',
    'May Pen',
    'Ocho Rios',
    'Mandeville',
    'Montego Bay - Fairview',
    'Santa Cruz',
  ];
  readonly firstGlobalBranches = [
    'Downtown Duke Street, Kingston',
    'Liguanea',
    'Mandeville',
    'Ocho Rios',
    'New Kingston',
    'Manor Park',
    'Montego Bay',
    'Portmore',
  ];
  readonly jnBranches = [
    'Half-Way-Tree',
    'New Kingston',
    'Duke Street, Kingston',
    'Morant Bay',
    'Mandeville',
    'May Pen',
    'Santa Cruz',
    'Spanish Town',
    'JN Financial Services',
    'Catherine Hall',
    'Montego Bay, St. James',
    'Savanna-la-Mar',
    'Hendon Corner',
    'Savanna-la-Mar, Westmoreland',
    "Brown's Town",
    'Ocho Rios',
    'Port Antonio',
    'Port Maria',
    'The University of the West Indies',
    'Christiana',
    'Falmouth',
    'Highgate, St. Mary',
    'Junction',
    'Linstead',
    'Lucea',
    'Montego Bay',
    'Old Harbour',
    'Portmore Pines',
    "St Ann's Bay",
    'Barbican',
    'JN Premier',
  ];
  readonly vmbsBranches = [
    'Duke Street',
    'Falmouth',
    'Half-Way-Tree',
    'Liguanea',
    'Linstead',
    'Mandeville',
    'May Pen',
    'Montego Bay',
    'Montego Bay (Fairview)',
    'New Kingston',
    'Ocho Rios',
    'Papine',
    'Portmore',
    'Santa Cruz',
    'Savanna-La-Mar',
    'Spanish Town',
  ];
  readonly accountTypes = ['checking', 'saving'];
  rentInfo: RentInfo | null = null;
  payments: Payment[] = [];
  loading = false;
  savingPaymentMethod = false;
  showPaymentDetailsModal = false;
  amountToPay = 0;
  private dueSoonReminderShown = false;
  paymentMethodForm: PaymentMethodForm = this.createEmptyPaymentMethodForm();
  savedPaymentMethod: PaymentMethodForm = this.createEmptyPaymentMethodForm();

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit() {
    this.loadRentInfo();
    this.loadPayments();
    this.loadPaymentMethod();
  }

  loadRentInfo() {
    this.http.get<RentInfo>(`${API_BASE_URL}/tenant/rent`).subscribe({
      next: (data) => {
        this.rentInfo = data;

        if (data.dueSoon && data.reminderMessage && !this.dueSoonReminderShown) {
          this.dueSoonReminderShown = true;
          this.snackBar.open(data.reminderMessage, 'Close', {
            duration: 5000,
          });
        }

        if (!data.dueSoon) {
          this.dueSoonReminderShown = false;
        }
      },
      error: (err) => console.error('Failed to load rent info', err),
    });
  }

  loadPayments() {
    this.http
      .get<Payment[]>(`${API_BASE_URL}/tenant/payments`)
      .subscribe({
        next: (data) => (this.payments = data),
        error: (err) => console.error('Failed to load payments', err),
      });
  }

  loadPaymentMethod() {
    this.http
      .get<PaymentMethodForm>(`${API_BASE_URL}/tenant/payment-method`)
      .subscribe({
        next: (data) => {
          this.savedPaymentMethod = data;
        },
        error: (err) => console.error('Failed to load payment method', err),
      });
  }

  savePaymentMethod() {
    this.savingPaymentMethod = true;
    if (this.paymentMethodForm.paymentMethod !== 'lynx') {
      this.paymentMethodForm.landlordLynxPhoneNumber = '';
    } else {
      this.paymentMethodForm.landlordBankName = '';
      this.paymentMethodForm.landlordAccountName = '';
      this.paymentMethodForm.landlordAccountNumber = '';
      this.paymentMethodForm.landlordBranch = '';
      this.paymentMethodForm.landlordAccountType = '';
      this.paymentMethodForm.landlordRoutingNumber = '';
      this.paymentMethodForm.paymentInstructions = '';
    }
    this.http
      .put(`${API_BASE_URL}/tenant/payment-method`, this.paymentMethodForm)
      .subscribe({
        next: () => {
          this.savingPaymentMethod = false;
          this.paymentMethodForm = this.createEmptyPaymentMethodForm();
          this.loadPaymentMethod();
          this.snackBar.open('Landlord banking information saved.', 'Close', {
            duration: 3000,
          });
          this.loadRentInfo();
        },
        error: (err) => {
          console.error('Failed to save payment method', err);
          this.savingPaymentMethod = false;
          this.snackBar.open(
            err?.error?.message || 'Could not save payment details.',
            'Close',
            { duration: 4000 },
          );
        },
      });
  }

  get isLynxSelected(): boolean {
    return this.paymentMethodForm.paymentMethod === 'lynx';
  }

  get isBankTransferSelected(): boolean {
    return this.paymentMethodForm.paymentMethod === 'bank_transfer';
  }

  get isCashAppSelected(): boolean {
    return this.paymentMethodForm.paymentMethod === 'cash_app';
  }

  get isScotiabankSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'Bank of Nova Scotia Jamaica Limited (Scotiabank)'
    );
  }

  get isNcbSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'National Commercial Bank Jamaica Limited (NCB)'
    );
  }

  get isSagicorSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'Sagicor Bank Jamaica Limited'
    );
  }

  get isCibcSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'CIBC Caribbean Bank (Jamaica) Limited'
    );
  }

  get isJmmbSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'JMMB Bank (Jamaica) Limited'
    );
  }

  get isFirstGlobalSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'First Global Bank Limited'
    );
  }

  get isJnSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'JN Bank Limited'
    );
  }

  get isVmbsSelected(): boolean {
    return (
      this.paymentMethodForm.landlordBankName ===
      'VM Building Society (VMBS)'
    );
  }

  get showBankDetails(): boolean {
    return !this.isLynxSelected;
  }

  get hasSavedPaymentMethod(): boolean {
    return !!this.savedPaymentMethod.paymentMethod;
  }

  payRent() {
    if (!this.hasRequiredPaymentDetails()) {
      this.snackBar.open(
        'Please save the payment details first before continuing.',
        'Close',
        { duration: 4000 },
      );
      return;
    }

    this.showPaymentDetailsModal = true;
  }

  closePaymentDetailsModal() {
    this.showPaymentDetailsModal = false;
  }

  editPaymentDetails() {
    this.paymentMethodForm = { ...this.savedPaymentMethod };
    this.showPaymentDetailsModal = false;
  }

  confirmPaymentDetails() {
    const amount =
      this.amountToPay && this.amountToPay > 0
        ? this.amountToPay
        : this.rentInfo?.outstanding || 0;

    this.http
      .post(`${API_BASE_URL}/tenant/confirm-payment`, { amount })
      .subscribe({
        next: () => {
          this.showPaymentDetailsModal = false;
          this.amountToPay = 0;
          this.loadPayments();
          this.loadRentInfo();
          this.snackBar.open(
            'Payment information confirmed rent paid.',
            'Close',
            { duration: 4000 },
          );
        },
        error: (err) => {
          console.error('Failed to confirm payment', err);
          this.snackBar.open(
            err?.error?.message || 'Could not notify landlord.',
            'Close',
            { duration: 4000 },
          );
        },
      });
  }

  get savedPaymentMethodLabel(): string {
    switch (this.savedPaymentMethod.paymentMethod) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'wire_transfer':
        return 'Wire Transfer';
      case 'cash_app':
        return 'Cash App';
      case 'lynx':
        return 'Lynx';
      default:
        return 'Payment Method';
    }
  }

  get showSavedBankDetails(): boolean {
    return this.savedPaymentMethod.paymentMethod !== 'lynx';
  }

  private createEmptyPaymentMethodForm(): PaymentMethodForm {
    return {
      paymentMethod: 'bank_transfer',
      landlordBankName: '',
      landlordAccountName: '',
      landlordAccountNumber: '',
      landlordBranch: '',
      landlordAccountType: '',
      landlordRoutingNumber: '',
      landlordLynxPhoneNumber: '',
      paymentInstructions: '',
    };
  }

  private hasRequiredPaymentDetails(): boolean {
    if (!this.savedPaymentMethod.paymentMethod) {
      return false;
    }

    if (this.savedPaymentMethod.paymentMethod === 'lynx') {
      return !!this.savedPaymentMethod.landlordLynxPhoneNumber;
    }

    if (this.savedPaymentMethod.paymentMethod === 'cash_app') {
      return true;
    }

    return !!this.savedPaymentMethod.landlordBankName;
  }

  downloadReceipt(paymentId: number) {
    this.http
      .get(`${API_BASE_URL}/tenant/receipt/${paymentId}`, {
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receipt-${paymentId}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: (err) => console.error('Failed to download receipt', err),
      });
  }
}
