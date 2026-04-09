import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { ForgotPasswordComponent } from './auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './auth/reset-password/reset-password.component';
import { DashboardComponent as TenantDashboard } from './tenant/dashboard/dashboard.component';
import { DashboardComponent as LandlordDashboard } from './landlord/dashboard/dashboard.component';
import { HomeComponent } from './pages/home/home.component';
import { PricingComponent } from './pages/pricing/pricing.component';
import { AboutComponent } from './pages/about/about.component';
import { ContactComponent } from './pages/contact/contact.component';
import { FaqsComponent } from './pages/faqs/faqs.component';
import { PrivacyPolicyComponent } from './pages/privacy-policy/privacy-policy.component';
import { MaintenanceComponent } from './pages/maintenance/maintenance.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'pricing', component: PricingComponent },
  { path: 'about', component: AboutComponent },
  { path: 'contact', component: ContactComponent },
  { path: 'faqs', component: FaqsComponent },
  { path: 'privacy-policy', component: PrivacyPolicyComponent },
  { path: 'maintenance', component: MaintenanceComponent, canActivate: [AuthGuard] },
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'tenant/dashboard',
    component: TenantDashboard,
    canActivate: [AuthGuard],
  },
  {
    path: 'landlord/dashboard',
    component: LandlordDashboard,
    canActivate: [AuthGuard],
  },
  { path: 'dashboard', redirectTo: '/tenant/dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
