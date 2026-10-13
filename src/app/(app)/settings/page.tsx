import { getCtx } from "@/lib/context";
import { integrationStatus } from "@/lib/env";
import { aiModel } from "@/lib/integrations/ai";
import { deliveryLog } from "@/lib/services/reminders";
import { PageHeader } from "@/components/ui/bits";
import { CategoriesForm, DataPanel, QuickLinksForm, DeliveryLog, IntegrationsPanel, ProfileForm, ReminderPrefsForm } from "@/components/settings/settings";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await getCtx();
  const status = integrationStatus();
  const log = await deliveryLog(ctx);
  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" description="Profile, timezone, categories, reminders and integrations." />
      <div className="space-y-5">
        <ProfileForm name={ctx.profile.display_name} timezone={ctx.tz} />
        <QuickLinksForm />
        <ReminderPrefsForm prefs={ctx.prefs} profileEmail={ctx.profile.email} emailConfigured={status.email} />
        <DeliveryLog log={log} emailConfigured={status.email} recipient={ctx.reminderEmail} />
        <CategoriesForm categories={ctx.categories} />
        <IntegrationsPanel status={{ ...status, aiModel: status.ai ? aiModel() : null }} mode={ctx.mode} />
        <DataPanel />
      </div>
    </div>
  );
}
