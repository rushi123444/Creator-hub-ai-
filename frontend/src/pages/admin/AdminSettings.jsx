import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, Card, ErrorState, FormField, Input, PageHeader, Skeleton, Switch, Textarea, useToast } from '../../components';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { adminService, getFriendlyError } from '../../services';
import '../../styles/pagesB2.css';

export default function AdminSettings() {
  useDocumentTitle('Platform settings');
  const toast = useToast();
  const { data, loading, error, loaded, reload } = useAsync((signal) => adminService.getSettings({ signal }), []);
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setF({ open_registration: !!data.open_registration, ai_daily_limit_per_user: String(data.ai_daily_limit_per_user ?? 200), announcement: data.announcement || '' }); }, [data]);

  const limit = Number(f?.ai_daily_limit_per_user);
  const limitErr = f && (!Number.isInteger(limit) || limit < 1 || limit > 100000) ? 'Enter a whole number between 1 and 100000.' : '';
  const save = async () => {
    setSaving(true);
    try {
      await adminService.updateSettings({ open_registration: f.open_registration, ai_daily_limit_per_user: limit, announcement: f.announcement.trim() });
      toast.success('Settings saved'); reload();
    } catch (e) { toast.error(getFriendlyError(e)); }
    setSaving(false);
  };

  return (
    <div className="page">
      <PageHeader title="Settings" description="Platform-wide options." />
      {error && !data ? <ErrorState message={error} onRetry={reload} /> : !f || (!loaded && loading) ? (
        <Card><Skeleton height={24} width="40%" /><Skeleton height={60} style={{ marginTop: 16 }} /><Skeleton height={60} style={{ marginTop: 16 }} /></Card>
      ) : (
        <Card>
          <div className="b2-stack">
            <Switch checked={f.open_registration} onChange={(v) => setF({ ...f, open_registration: v })} label="Open registration" description="When off, new people cannot sign up." />
            <FormField label="Daily AI limit per user" hint="How many AI requests each user can make per day." error={limitErr}>
              <Input type="number" min={1} max={100000} value={f.ai_daily_limit_per_user} onChange={(e) => setF({ ...f, ai_daily_limit_per_user: e.target.value })} />
            </FormField>
            <FormField label="Announcement" optionalLabel="Optional" hint={`${f.announcement.length}/300`}>
              <Textarea rows={3} maxLength={300} value={f.announcement} onChange={(e) => setF({ ...f, announcement: e.target.value })} />
            </FormField>
            <div><Button icon={Save} loading={saving} disabled={!!limitErr} onClick={save}>Save settings</Button></div>
          </div>
        </Card>
      )}
    </div>
  );
}
