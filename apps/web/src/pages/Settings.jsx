import React from 'react';
import { Settings as SettingsIcon, Bell, Shield, User, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
                                    <input type="text" id="fullName" defaultValue="Demo User" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address</Label>
                                    <input type="email" id="email" defaultValue="demo@cloudguard.ai" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all" />
                                </div>
                            </div>
                            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10">Update Profile</Button>
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
                            <Button variant="outline" className="w-full justify-between bg-white/5 border-white/10 hover:bg-white/10 h-auto py-4">
                                <div className="flex items-center gap-3">
                                    <Lock className="w-5 h-5 text-muted-foreground" />
                                    <div className="text-left">
                                        <p className="font-medium">Change Password</p>
                                        <p className="text-xs text-muted-foreground">Last changed 30 days ago</p>
                                    </div>
                                </div>
                                <span className="text-xs bg-white/10 px-2 py-1 rounded">Update</span>
                            </Button>
                        </div>
                    </motion.div>

                </div>
            </div>
        </div>
    );
};

export default Settings;
