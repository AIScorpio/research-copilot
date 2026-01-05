import SourceManager from "@/components/settings/source-manager"

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">Manage your preferences and account settings.</p>
            </div>

            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4">Appearance</h3>
                <div className="flex items-center justify-between">
                    <span className="text-sm">Theme Preferences</span>
                    <span className="text-sm text-muted-foreground">Managed via System/Header</span>
                </div>
            </div>

            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4">Notifications</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm">Email Digest</span>
                        <div className="h-4 w-4 rounded border bg-primary" />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm">New Paper Alerts</span>
                        <div className="h-4 w-4 rounded border bg-primary" />
                    </div>
                </div>
            </div>

            <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-semibold mb-4 text-red-600">Danger Zone</h3>
                <button className="text-sm text-red-600 hover:underline">Delete Account</button>
            </div>

            <SourceManager />
        </div>
    )
}
