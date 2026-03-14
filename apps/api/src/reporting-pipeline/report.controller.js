/**
 * Report Controller
 * 
 * API endpoints for generating and downloading security assessment reports.
 */

const reportAggregator = require('./report-data-aggregator');
const pdfGenerator = require('./pdf-report-generator');

/**
 * Generate and download a PDF Security Assessment Report.
 * GET /api/reports/download
 */
exports.downloadReport = async (req, res) => {
    try {
        console.log(`[ReportController] Generating report for ${req.user.email}`);

        // 1. Aggregate all data
        const reportData = await reportAggregator.aggregate(req.user.email);

        // 2. Generate PDF
        const pdfBuffer = await pdfGenerator.generate(reportData);

        // 3. Send as downloadable file
        const filename = `CloudGuard_Security_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);

        console.log(`[ReportController] Report sent: ${filename} (${pdfBuffer.length} bytes)`);
    } catch (err) {
        console.error("[ReportController] Report generation failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get report data as JSON (for frontend rendering).
 * GET /api/reports/data
 */
exports.getReportData = async (req, res) => {
    try {
        const reportData = await reportAggregator.aggregate(req.user.email);
        res.json(reportData);
    } catch (err) {
        console.error("[ReportController] Report data fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get just the security timeline.
 * GET /api/reports/timeline
 */
exports.getTimeline = async (req, res) => {
    try {
        const reportData = await reportAggregator.aggregate(req.user.email);
        res.json({
            timeline: reportData.security_timeline,
            count: reportData.security_timeline.length
        });
    } catch (err) {
        console.error("[ReportController] Timeline fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};

/**
 * Get executive summary only (for dashboard widgets).
 * GET /api/reports/summary
 */
exports.getSummary = async (req, res) => {
    try {
        const reportData = await reportAggregator.aggregate(req.user.email);
        res.json({
            executive_summary: reportData.executive_summary,
            infrastructure: reportData.infrastructure_overview,
            score_summary: reportData.score_summary
        });
    } catch (err) {
        console.error("[ReportController] Summary fetch failed:", err);
        res.status(500).json({ error: err.message });
    }
};
