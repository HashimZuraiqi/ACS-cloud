/**
 * Remediation Audit Logger
 * 
 * Immutable log of every remediation event: who, what, when, before/after, decision, outcome.
 * Stored in DynamoDB for compliance and accountability.
 */

const { docClient } = require('../../config/db');
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require('uuid');

const TABLE_NAME = "CloudGuard_Remediation_Audit";

class RemediationAuditLogger {

    /**
     * Log a remediation event.
     * @param {Object} params
     * @param {string} params.user_email - Who initiated the remediation
     * @param {string} params.resource_id - What resource was affected
     * @param {string} params.resource_type - S3, EC2, IAM
     * @param {string} params.action - Remediation action taken
     * @param {string} params.decision - AUTO_FIX | SUGGEST_FIX | INTENTIONAL_SKIP | MANUAL_APPROVED
     * @param {string} params.status - SUCCESS | FAILED | SKIPPED | ROLLED_BACK
     * @param {string} params.plan_id - Associated plan ID
     * @param {string} params.snapshot_id - Pre-remediation snapshot ID
     * @param {Object} params.details - Action-specific details
     * @param {string} params.reasoning - Why this decision was made
     */
    async log(params) {
        const entry = {
            audit_id: uuidv4(),
            user_email: params.user_email,
            resource_id: params.resource_id,
            resource_type: params.resource_type,
            action: params.action,
            decision: params.decision || 'UNKNOWN',
            status: params.status,
            plan_id: params.plan_id,
            snapshot_id: params.snapshot_id || null,
            details: JSON.stringify(params.details || {}),
            reasoning: params.reasoning || '',
            risk_before: params.risk_before || null,
            risk_after: params.risk_after || null,
            timestamp: new Date().toISOString()
        };

        try {
            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: entry
            }));
            console.log(`[AuditLog] Logged: ${entry.action} on ${entry.resource_id} → ${entry.status}`);
        } catch (err) {
            // Never let audit logging failure block remediation
            console.error(`[AuditLog] Failed to log (non-blocking): ${err.message}`);
        }

        return entry;
    }

    /**
     * Log a batch of remediation actions (one plan with multiple steps).
     */
    async logBatch(userEmail, resourceId, resourceType, planId, snapshotId, steps) {
        const entries = [];
        for (const step of steps) {
            const entry = await this.log({
                user_email: userEmail,
                resource_id: resourceId,
                resource_type: resourceType,
                action: step.action,
                decision: step.decision || 'MANUAL_APPROVED',
                status: step.status || 'PENDING',
                plan_id: planId,
                snapshot_id: snapshotId,
                details: step,
                reasoning: step.reasoning || ''
            });
            entries.push(entry);
        }
        return entries;
    }

    /**
     * Retrieve audit log for a specific resource.
     */
    async getResourceLog(resourceId, userEmail) {
        try {
            const response = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: "resource_id = :rid AND user_email = :email",
                ExpressionAttributeValues: {
                    ":rid": resourceId,
                    ":email": userEmail
                }
            }));
            return (response.Items || []).sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (err) {
            console.error(`[AuditLog] Error retrieving log: ${err.message}`);
            if (err.name === 'ResourceNotFoundException') return [];
            throw err;
        }
    }

    /**
     * Get full audit log for a user.
     */
    async getUserLog(userEmail) {
        try {
            const response = await docClient.send(new ScanCommand({
                TableName: TABLE_NAME,
                FilterExpression: "user_email = :email",
                ExpressionAttributeValues: { ":email": userEmail }
            }));
            return (response.Items || []).sort((a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
            );
        } catch (err) {
            console.error(`[AuditLog] Error retrieving user log: ${err.message}`);
            if (err.name === 'ResourceNotFoundException') return [];
            throw err;
        }
    }
}

module.exports = new RemediationAuditLogger();
