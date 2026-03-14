/**
 * PDF Report Generator
 * 
 * Generates a professional Security Assessment Report PDF using PDFKit.
 * Sections: Executive Summary, Infrastructure Overview, Vulnerabilities,
 * Attack Scenarios, Compliance, Remediation Actions, Before/After,
 * Security Score, Timeline, Verification Instructions.
 */

const PDFDocument = require('pdfkit');

// ─── Color Palette ──────────────────────────────────────────────
const COLORS = {
    primary:    '#1B2A4A',  // dark navy
    secondary:  '#2D5F8A',  // steel blue
    accent:     '#4EA8DE',  // bright blue
    success:    '#27AE60',  // green
    warning:    '#F39C12',  // amber
    danger:     '#E74C3C',  // red
    critical:   '#8E44AD',  // purple
    text:       '#2C3E50',  // dark gray
    muted:      '#7F8C8D',  // gray
    light:      '#ECF0F1',  // light gray bg
    white:      '#FFFFFF',
    black:      '#1A1A2E',
};

const SEVERITY_COLORS = {
    CRITICAL: COLORS.critical,
    HIGH:     COLORS.danger,
    MEDIUM:   COLORS.warning,
    LOW:      COLORS.muted,
};

class PDFReportGenerator {

    /**
     * Generate a PDF report buffer from aggregated data.
     * @param {Object} reportData - Output from ReportDataAggregator.aggregate()
     * @returns {Promise<Buffer>} PDF file buffer
     */
    generate(reportData) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 60, bottom: 60, left: 50, right: 50 },
                info: {
                    Title: 'CloudGuard Security Assessment Report',
                    Author: 'CloudGuard AI Security Platform',
                    Subject: `Security Assessment — ${new Date().toLocaleDateString()}`,
                }
            });

            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            try {
                this._renderCoverPage(doc, reportData);
                this._renderExecutiveSummary(doc, reportData);
                this._renderInfrastructureOverview(doc, reportData);
                this._renderVulnerabilities(doc, reportData);
                if (reportData.cost_details) {
                    this._renderCostSection(doc, reportData);
                }
                this._renderCompliance(doc, reportData);
                this._renderRemediationActions(doc, reportData);
                this._renderSecurityTimeline(doc, reportData);
                this._renderScoreSummary(doc, reportData);
                this._renderVerificationInstructions(doc, reportData);
                doc.end();
            } catch (err) {
                doc.end();
                reject(err);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // COVER PAGE
    // ═══════════════════════════════════════════════════════════════

    _renderCoverPage(doc, data) {
        // Navy background header bar
        doc.rect(0, 0, doc.page.width, 320).fill(COLORS.primary);

        // Logo (Text-based instead of broken emoji)
        doc.fontSize(40).fillColor(COLORS.accent).text('[ CLOUDGUARD ]', 0, 80, { align: 'center', characterSpacing: 5 });

        // Title
        doc.fontSize(32).fillColor(COLORS.white)
            .text('Security Assessment', 0, 160, { align: 'center' });
        doc.fontSize(18).fillColor(COLORS.accent)
            .text('Report', 0, 200, { align: 'center' });

        // Subtitle
        doc.fontSize(11).fillColor('#AAB7C4')
            .text('CloudGuard AI Cloud Security Platform', 0, 240, { align: 'center' });

        // Report meta
        const meta = data.meta;
        doc.fontSize(10).fillColor(COLORS.text);
        doc.text(`Report ID: ${meta.report_id}`, 50, 360);
        doc.text(`Generated: ${new Date(meta.generated_at).toLocaleString()}`, 50, 378);
        doc.text(`Account: ${meta.user_email}`, 50, 396);

        // Status badge
        const posture = data.executive_summary.security_posture;
        const badgeColor = posture === 'STRONG' ? COLORS.success : posture === 'MODERATE' ? COLORS.warning : COLORS.danger;
        const badgeY = 440;
        doc.roundedRect(200, badgeY, 195, 35, 5).fill(badgeColor);
        doc.fontSize(14).fillColor(COLORS.white)
            .text(`Security Posture: ${posture}`, 200, badgeY + 9, { width: 195, align: 'center' });

        // Footer line
        doc.moveTo(50, 500).lineTo(545, 500).strokeColor(COLORS.light).stroke();
        doc.fontSize(8).fillColor(COLORS.muted)
            .text('CONFIDENTIAL — For authorized personnel only', 50, 510, { align: 'center', width: 495 });

        doc.addPage();
    }

    // ═══════════════════════════════════════════════════════════════
    // EXECUTIVE SUMMARY
    // ═══════════════════════════════════════════════════════════════

    _renderExecutiveSummary(doc, data) {
        const es = data.executive_summary;

        this._sectionHeader(doc, '1', 'Executive Summary');

        // Summary text
        doc.fontSize(10).fillColor(COLORS.text)
            .text(es.summary_text, { lineGap: 4 });
        doc.moveDown(1);

        // Key metrics row
        const metrics = [
            { label: 'Total Resources', value: es.total_resources, color: COLORS.secondary },
            { label: 'At Risk', value: es.resources_at_risk, color: COLORS.danger },
            { label: 'Secure', value: es.resources_secure, color: COLORS.success },
            { label: 'Avg Score', value: `${es.average_risk_score}/100`, color: COLORS.warning },
        ];

        const cardWidth = 115;
        const startX = 50;
        const cardY = doc.y;

        metrics.forEach((m, i) => {
            const x = startX + i * (cardWidth + 12);
            doc.roundedRect(x, cardY, cardWidth, 55, 4).fill(COLORS.light);
            doc.fontSize(22).fillColor(m.color).text(String(m.value), x, cardY + 8, { width: cardWidth, align: 'center' });
            doc.fontSize(8).fillColor(COLORS.muted).text(m.label, x, cardY + 38, { width: cardWidth, align: 'center' });
        });

        doc.y = cardY + 70;

        // Severity distribution
        this._subHeader(doc, 'Severity Distribution');
        const sev = es.severity_distribution;
        const sevItems = [
            { label: 'Critical', count: sev.CRITICAL, color: COLORS.critical },
            { label: 'High', count: sev.HIGH, color: COLORS.danger },
            { label: 'Medium', count: sev.MEDIUM, color: COLORS.warning },
            { label: 'Low', count: sev.LOW, color: COLORS.success },
        ];
        sevItems.forEach(item => {
            if (item.count > 0) {
                doc.circle(58, doc.y + 5, 4).fill(item.color);
                doc.fontSize(10).fillColor(COLORS.text).text(`  ${item.label}: ${item.count}`, 66, doc.y - 1);
            }
        });

        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // INFRASTRUCTURE OVERVIEW
    // ═══════════════════════════════════════════════════════════════

    _renderInfrastructureOverview(doc, data) {
        this._ensureSpace(doc, 200);
        this._sectionHeader(doc, '2', 'Infrastructure Overview');

        const infra = data.infrastructure_overview;

        // Service table
        this._tableHeader(doc, ['Service', 'Count', 'At Risk', 'Secure']);
        infra.services.forEach(svc => {
            this._tableRow(doc, [
                `${svc.name.replace(/[^\w\s-]/g, '').trim()}`,
                String(svc.count),
                String(svc.at_risk),
                String(svc.count - svc.at_risk)
            ]);
        });
        this._tableRow(doc, ['TOTAL', String(infra.total), '', ''], true);

        doc.moveDown(0.5);
        if (infra.regions && infra.regions.length > 0) {
            doc.fontSize(9).fillColor(COLORS.muted)
                .text(`Regions: ${infra.regions.join(', ')}`);
        }
        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // VULNERABILITIES
    // ═══════════════════════════════════════════════════════════════

    _renderVulnerabilities(doc, data) {
        this._ensureSpace(doc, 200);
        this._sectionHeader(doc, '3', 'Detected Vulnerabilities');

        const vulns = data.vulnerabilities;
        doc.fontSize(10).fillColor(COLORS.text)
            .text(`Total: ${vulns.total} vulnerability(ies) — ${vulns.by_severity.critical} Critical, ${vulns.by_severity.high} High, ${vulns.by_severity.medium} Medium, ${vulns.by_severity.low} Low`);
        doc.moveDown(0.5);

        // Vulnerability cards (top 15)
        const items = vulns.items.slice(0, 15);
        items.forEach((v, idx) => {
            this._ensureSpace(doc, 50);
            const y = doc.y;

            // Severity badge
            const sevColor = SEVERITY_COLORS[v.severity] || COLORS.muted;
            doc.roundedRect(50, y, 60, 16, 3).fill(sevColor);
            doc.fontSize(7).fillColor(COLORS.white).text(v.severity, 50, y + 4, { width: 60, align: 'center' });

            // Rule ID + Title
            const ruleLabel = v.rule_id ? `[${v.rule_id}] ` : '';
            doc.fontSize(9).fillColor(COLORS.primary).text(`${ruleLabel}${v.title}`, 118, y + 2, { width: 370 });

            // Resource
            doc.fontSize(8).fillColor(COLORS.muted).text(`Resource: ${v.resource}`, 118, doc.y + 1);
            doc.moveDown(0.3);

            // Separator
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(COLORS.light).lineWidth(0.5).stroke();
            doc.moveDown(0.3);
        });

        if (vulns.items.length > 15) {
            doc.fontSize(8).fillColor(COLORS.muted)
                .text(`... and ${vulns.items.length - 15} more vulnerability(ies). See full scan results for details.`);
        }

        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // COMPLIANCE
    // ═══════════════════════════════════════════════════════════════

    _renderCompliance(doc, data) {
        this._ensureSpace(doc, 200);
        this._sectionHeader(doc, '4', 'Compliance Status');

        const frameworks = data.compliance.frameworks;
        const fwNames = Object.keys(frameworks);

        if (fwNames.length === 0) {
            doc.fontSize(10).fillColor(COLORS.muted).text('No compliance data available. Run a scan to generate compliance mappings.');
            doc.moveDown(1);
            return;
        }

        this._tableHeader(doc, ['Framework', 'Controls', 'Passing', 'Failing', 'Score']);
        fwNames.forEach(name => {
            const fw = frameworks[name];
            if (!fw) return;
            this._tableRow(doc, [
                name,
                String(fw.total_controls || 0),
                String(fw.passing || 0),
                String(fw.failing || 0),
                `${fw.compliance_percent || 0}%`
            ]);
        });

        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // REMEDIATION ACTIONS
    // ═══════════════════════════════════════════════════════════════

    _renderRemediationActions(doc, data) {
        if (data.remediation_history.total_actions === 0) return;

        this._ensureSpace(doc, 200);
        this._sectionHeader(doc, '5', 'Remediation Actions Applied');

        const rh = data.remediation_history;
        doc.fontSize(10).fillColor(COLORS.text)
            .text(`${rh.total_actions} total action(s): ${rh.successful} successful, ${rh.failed} failed, ${rh.skipped} skipped.`);
        doc.moveDown(0.5);

        // Action table (latest 10)
        this._tableHeader(doc, ['Action', 'Resource', 'Decision', 'Status']);
        let appliedFixes = [];
        rh.actions.slice(-10).forEach(a => {
            this._tableRow(doc, [
                a.action,
                this._truncate(a.resource, 25),
                a.decision || 'N/A',
                a.status || 'UNKNOWN'
            ]);
            if (a.status === 'SUCCESS' || a.status === 'ALREADY_COMPLIANT') {
                appliedFixes.push(a);
            }
        });

        doc.moveDown(1);

        // Optional Section: Applied Fixes vs Remaining Recommendations
        if (appliedFixes.length > 0 || data.vulnerabilities.items.length > 0) {
            this._ensureSpace(doc, 150);
            this._subHeader(doc, 'Remediation Gap Analysis');
            
            doc.fontSize(10).fillColor(COLORS.success).text('Applied Auto-Fixes:');
            appliedFixes.forEach(a => doc.fontSize(9).fillColor(COLORS.text).text(`- ${a.action} (${a.status})`, { indent: 15 }));
            if (appliedFixes.length === 0) doc.fontSize(9).fillColor(COLORS.muted).text('- None applied recently.', { indent: 15 });

            doc.moveDown(0.5);
            doc.fontSize(10).fillColor(COLORS.warning).text('Remaining Recommendations:');
            
            // Show lower-priority or manual recommendations that remain
            const remaining = data.vulnerabilities.items.filter(v => 
                v.severity !== 'CRITICAL' || v.title.toLowerCase().includes('recommendation') || v.title.toLowerCase().includes('sse-s3') || v.title.toLowerCase().includes('encryption')
            ).slice(0, 10);
            
            remaining.forEach(r => doc.fontSize(9).fillColor(COLORS.text).text(`- ${r.title} [${r.severity}]`, { indent: 15 }));
            if (remaining.length === 0) doc.fontSize(9).fillColor(COLORS.muted).text('- No pending recommendations discovered.', { indent: 15 });
            
            doc.moveDown(1);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SECURITY TIMELINE
    // ═══════════════════════════════════════════════════════════════

    _renderSecurityTimeline(doc, data) {
        const events = data.security_timeline;
        if (events.length === 0) return;

        doc.addPage();
        this._sectionHeader(doc, '6', 'Security Timeline');

        doc.fontSize(9).fillColor(COLORS.muted)
            .text('Chronological record of security events.');
        doc.moveDown(0.5);

        // Timeline rendering
        const lineX = 80;
        const maxEvents = Math.min(events.length, 20);

        for (let i = 0; i < maxEvents; i++) {
            this._ensureSpace(doc, 45);
            const event = events[i];
            const y = doc.y;

            // Timeline dot
            const dotColor = event.type === 'SCAN' ? COLORS.secondary
                : event.type === 'REMEDIATION' ? COLORS.success
                : COLORS.warning;
            doc.circle(lineX, y + 7, 5).fill(dotColor);

            // Vertical line
            if (i < maxEvents - 1) {
                doc.moveTo(lineX, y + 12).lineTo(lineX, y + 42)
                    .strokeColor(COLORS.light).lineWidth(1.5).stroke();
            }

            // Timestamp
            const time = new Date(event.timestamp);
            const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            doc.fontSize(8).fillColor(COLORS.muted).text(timeStr, 50, y + 3, { width: 25 });

            // Event details (no emoji rendering)
            doc.fontSize(9).fillColor(COLORS.primary)
                .text(`[${event.type}] ${event.description}`, lineX + 15, y + 2, { width: 400 });
            doc.fontSize(8).fillColor(COLORS.muted)
                .text(`${event.resource}${event.risk_score !== undefined ? ` — Risk: ${event.risk_score}/100` : ''}`, lineX + 15, doc.y);

            doc.y = y + 42;
        }

        if (events.length > 20) {
            doc.fontSize(8).fillColor(COLORS.muted)
                .text(`... and ${events.length - 20} more events.`);
        }

        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // SCORE SUMMARY
    // ═══════════════════════════════════════════════════════════════

    _renderScoreSummary(doc, data) {
        this._ensureSpace(doc, 200);
        this._sectionHeader(doc, '7', 'Security Score Summary');

        const ss = data.score_summary;

        doc.fontSize(10).fillColor(COLORS.text)
            .text(`Average Risk Score: ${ss.average}/100`);
        doc.moveDown(0.5);

        if (ss.scores.length > 0) {
            this._tableHeader(doc, ['Resource', 'Type', 'Risk Score', 'Severity', 'Status']);
            ss.scores.forEach(s => {
                this._tableRow(doc, [
                    this._truncate(s.resource, 22),
                    s.resource_type,
                    `${s.risk_score}/100`,
                    s.severity,
                    s.status
                ]);
            });
        }

        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // VERIFICATION INSTRUCTIONS
    // ═══════════════════════════════════════════════════════════════

    _renderVerificationInstructions(doc, data) {
        this._ensureSpace(doc, 250);
        this._sectionHeader(doc, '8', 'Verification Instructions');

        doc.fontSize(10).fillColor(COLORS.text).text('Use these AWS CLI commands to verify the security improvements:', { lineGap: 3 });
        doc.moveDown(0.5);

        const instructions = [
            { title: 'S3 — Verify Block Public Access', cmd: 'aws s3api get-public-access-block --bucket <BUCKET_NAME>' },
            { title: 'S3 — Verify Encryption', cmd: 'aws s3api get-bucket-encryption --bucket <BUCKET_NAME>' },
            { title: 'S3 — Verify Versioning', cmd: 'aws s3api get-bucket-versioning --bucket <BUCKET_NAME>' },
            { title: 'EC2 — Verify IMDSv2', cmd: 'aws ec2 describe-instances --instance-ids <INSTANCE_ID> --query "Reservations[].Instances[].MetadataOptions"' },
            { title: 'EC2 — Verify Security Groups', cmd: 'aws ec2 describe-security-groups --group-ids <SG_ID> --query "SecurityGroups[].IpPermissions"' },
            { title: 'IAM — Verify MFA', cmd: 'aws iam list-mfa-devices --user-name <USERNAME>' },
            { title: 'IAM — Verify Access Keys', cmd: 'aws iam list-access-keys --user-name <USERNAME>' },
        ];

        instructions.forEach(inst => {
            this._ensureSpace(doc, 40);
            doc.fontSize(9).fillColor(COLORS.primary).text(`- ${inst.title}`);
            // Code block
            const codeY = doc.y;
            doc.roundedRect(60, codeY, 480, 18, 3).fill('#F4F6F8');
            doc.fontSize(8).fillColor('#555').font('Courier').text(inst.cmd, 66, codeY + 4, { width: 470 });
            doc.font('Helvetica');
            doc.y = codeY + 24;
        });

        // Footer
        doc.moveDown(2);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(COLORS.light).stroke();
        doc.moveDown(0.5);
        doc.fontSize(8).fillColor(COLORS.muted)
            .text('This report was generated by CloudGuard AI Security Platform. For questions, contact your security administrator.', { align: 'center' });
        doc.fontSize(7).fillColor(COLORS.muted)
            .text('CONFIDENTIAL — Do not distribute without authorization.', { align: 'center' });
    }

    // ═══════════════════════════════════════════════════════════════
    // COST OPTIMIZATION (ONLY FOR COST SCANS)
    // ═══════════════════════════════════════════════════════════════

    _renderCostSection(doc, data) {
        if (!data.cost_details) return;

        this._ensureSpace(doc, 250);
        this._sectionHeader(doc, '5', 'Cost Optimization Analysis');

        const cd = data.cost_details;

        doc.fontSize(10).fillColor(COLORS.text)
            .text(`Total Estimated Waste: $${cd.total_wasted || '0.00'}/month`, { font: 'Helvetica-Bold' });
        doc.moveDown(0.5);

        // Cost metrics row
        const metrics = [
            { label: 'Zombie Volumes', value: cd.zombie_volumes, color: COLORS.danger },
            { label: 'Idle Instances', value: cd.idle_instances, color: COLORS.warning },
            { label: 'Total Opportunities', value: cd.items.length, color: COLORS.secondary }
        ];

        const cardWidth = 155;
        const startX = 50;
        const cardY = doc.y;

        metrics.forEach((m, i) => {
            const x = startX + i * (cardWidth + 12);
            doc.roundedRect(x, cardY, cardWidth, 55, 4).fill(COLORS.light);
            doc.fontSize(22).fillColor(m.color).text(String(m.value), x, cardY + 8, { width: cardWidth, align: 'center' });
            doc.fontSize(8).fillColor(COLORS.muted).text(m.label, x, cardY + 38, { width: cardWidth, align: 'center' });
        });

        doc.y = cardY + 70;
        doc.moveDown(1);
    }

    // ═══════════════════════════════════════════════════════════════
    // LAYOUT HELPERS
    // ═══════════════════════════════════════════════════════════════

    _sectionHeader(doc, number, title) {
        // Section number badge + title
        const y = doc.y;
        doc.roundedRect(50, y, 24, 24, 4).fill(COLORS.primary);
        doc.fontSize(14).fillColor(COLORS.white).text(number, 50, y + 4, { width: 24, align: 'center' });
        doc.fontSize(16).fillColor(COLORS.primary).text(title, 82, y + 3);

        // Underline
        doc.moveTo(50, y + 30).lineTo(545, y + 30).strokeColor(COLORS.accent).lineWidth(2).stroke();
        doc.y = y + 40;
    }

    _subHeader(doc, title) {
        doc.fontSize(11).fillColor(COLORS.secondary).text(title);
        doc.moveDown(0.3);
    }

    _tableHeader(doc, columns) {
        const y = doc.y;
        const colWidth = 495 / columns.length;
        doc.rect(50, y, 495, 18).fill(COLORS.primary);
        columns.forEach((col, i) => {
            doc.fontSize(8).fillColor(COLORS.white)
                .text(col, 55 + i * colWidth, y + 4, { width: colWidth - 10 });
        });
        doc.y = y + 20;
    }

    _tableRow(doc, columns, isBold = false) {
        const y = doc.y;
        const colWidth = 495 / columns.length;
        const bgColor = isBold ? COLORS.light : COLORS.white;
        doc.rect(50, y, 495, 16).fill(bgColor);
        columns.forEach((col, i) => {
            doc.fontSize(8).fillColor(COLORS.text)
                .text(col, 55 + i * colWidth, y + 4, { width: colWidth - 10 });
        });
        doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor('#E0E0E0').lineWidth(0.5).stroke();
        doc.y = y + 17;
    }

    _ensureSpace(doc, needed) {
        if (doc.y + needed > doc.page.height - 80) {
            doc.addPage();
        }
    }

    _truncate(str, maxLen) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen - 2) + '...' : str;
    }
}

module.exports = new PDFReportGenerator();
