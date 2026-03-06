import React from 'react';
import { Settings as SettingsIcon, Bell, Shield, User, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { Key } from 'lucide-react';

const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.5,
            ease: "easeOut"
        }
    })
};

const Settings = () => {
    const { currentUser } = useAuth();

    const [awsCreds, setAwsCreds] = React.useState({
        accessKeyId: '',
        secretAccessKey: ''
    });
    const [isSaving, setIsSaving] = React.useState(false);
    const [saveStatus, setSaveStatus] = React.useState({ type: '', message: '' });

    const handleSaveAwsCreds = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus({ type: '', message: '' });
        try {
            await api.updateAwsCredentials(awsCreds);
            setSaveStatus({ type: 'success', message: 'AWS Credentials encrypted and saved successfully.' });
            setAwsCreds({ accessKeyId: '', secretAccessKey: '' }); // clear form for security
        } catch (error) {
            setSaveStatus({ type: 'error', message: error.response?.data?.error || error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-8 pb-12">
            <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0} className="flex items-center gap-4 pb-6 border-b border-white/10">
                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/10">
                    <SettingsIcon className="w-8 h-8 text-blue-500" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Settings</h1>
                    <p className="text-muted-foreground text-sm mt-1">Manage your account preferences and application settings</p>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Navigation / Sidebar for settings could go here in a fuller implementation */}
                <div className="lg:col-span-3 space-y-6">

                    {/* Account Section */}
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><User className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
                        </div>

                        <div className="space-y-6 max-w-2xl">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Full Name</Label>
                                    <input
                                        type="text"
                                        id="fullName"
                                        defaultValue={currentUser?.name || "CloudGuard User"}
                                        disabled
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <input
                                        type="email"
                                        id="email"
                                        defaultValue={currentUser?.email || ""}
                                        disabled
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-muted-foreground cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                * Profile details are managed by your administrator.
                            </div>
                        </div>
                    </motion.div>

                    {/* Notifications Section */}
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500"><Bell className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-foreground">Notifications</h2>
                        </div>

                        <div className="space-y-4 max-w-2xl">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-medium">AI Security Agent</Label>
                                    <p className="text-xs text-muted-foreground">Enable Bedrock AI to generate remediation plans automatically</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-medium">Email Alerts</Label>
                                    <p className="text-xs text-muted-foreground">Receive daily summaries of scan results</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-medium">Critical Issues</Label>
                                    <p className="text-xs text-muted-foreground">Immediate notification for high-risk findings</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </div>
                    </motion.div>

                    {/* Security Section */}
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500"><Shield className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-foreground">Security</h2>
                        </div>

                        <div className="space-y-4 max-w-2xl">
                            <Button variant="outline" className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 h-auto py-4" disabled>
                                <div className="flex items-center gap-3">
                                    <Lock className="w-5 h-5 text-muted-foreground" />
                                    <div className="text-left">
                                        <p className="font-medium">Change Password</p>
                                        <p className="text-xs text-muted-foreground">Managed via Identity Provider</p>
                                    </div>
                                </div>
                                <span className="text-xs bg-white/10 px-2 py-1 rounded opacity-50">Locked</span>
                            </Button>
                        </div>
                    </motion.div>

                    {/* AWS Integration Section */}
                    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="bg-card/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 md:p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Key className="w-5 h-5" /></div>
                            <h2 className="text-xl font-bold text-foreground">AWS Integration</h2>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Form */}
                            <form onSubmit={handleSaveAwsCreds} className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="accessKeyId">Access Key ID</Label>
                                        <input
                                            type="text"
                                            id="accessKeyId"
                                            value={awsCreds.accessKeyId}
                                            onChange={(e) => setAwsCreds({ ...awsCreds, accessKeyId: e.target.value })}
                                            placeholder="AKIAIOSFODNN7EXAMPLE"
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-white placeholder-white/20"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                                        <input
                                            type="password"
                                            id="secretAccessKey"
                                            value={awsCreds.secretAccessKey}
                                            onChange={(e) => setAwsCreds({ ...awsCreds, secretAccessKey: e.target.value })}
                                            placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                                            required
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all text-white placeholder-white/20"
                                        />
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-200 flex gap-2">
                                    <span className="text-xl">🌍</span>
                                    <span>CloudGuard automatically maps and discovers your resources natively across all global AWS regions.</span>
                                </div>

                                {saveStatus.message && (
                                    <div className={`p-3 rounded-lg text-sm border ${saveStatus.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                                        {saveStatus.message}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="w-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                                >
                                    {isSaving ? 'Encrypting & Saving...' : 'Save Credentials securely'}
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">
                                    Your secret key is encrypted using AES-256-GCM before being stored in our database. It is decrypted only during active scans.
                                </p>
                            </form>

                            {/* Permissions Info */}
                            <div className="bg-white/5 rounded-xl border border-white/10 p-5 space-y-4 h-fit">
                                <h3 className="font-semibold text-white">Required IAM Permissions</h3>
                                <p className="text-sm text-muted-foreground">
                                    To utilize the CloudGuard Security Hub, your AWS credentials must have the following minimum permissions attached:
                                </p>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                                    <li><code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">s3:GetBucketLocation</code>, <code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">s3:GetBucketAcl</code>, <code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">s3:GetBucketPolicy</code>, etc. for scanning S3 configs.</li>
                                    <li><code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">s3:Put*</code> permissions if attempting Auto-Remediation on buckets.</li>
                                    <li><code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">ec2:DescribeInstances</code>, <code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">ec2:DescribeSecurityGroups</code>, <code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">ec2:DescribeVolumes</code> for EC2 scanning.</li>
                                    <li><code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">iam:ListUsers</code>, <code className="bg-black/30 px-1 py-0.5 rounded text-blue-400">iam:ListAttachedUserPolicies</code> for IAM capability.</li>
                                    <li><code className="bg-black/30 px-1 py-0.5 rounded text-orange-400">bedrock:InvokeModel</code> to use the Compliance Reasoner AI.</li>
                                </ul>
                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs leading-relaxed text-blue-200">
                                    <strong>Best Practice:</strong> We highly recommend creating a dedicated IAM User specifically for CloudGuard, rather than using root credentials or your primary admin key.
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
