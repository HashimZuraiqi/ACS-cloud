/**
 * Evidence Chain Builder
 * 
 * Builds structured, transparent evidence chains from rule evaluations and AI responses.
 * Each finding gets a full audit trail showing exactly how the conclusion was reached.
 */

class EvidenceChainBuilder {

    /**
     * Build evidence chains for all findings in a scan.
     * @param {Object} params
     * @param {Object} params.rawConfig - Raw resource configuration from the scanner
     * @param {Object} params.ruleResults - Output from the rule engine (.findings array)
     * @param {Object} params.aiResult - AI analysis result (from Bedrock)
     * @param {string} params.resourceType - 'S3' | 'EC2' | 'IAM'
     * @returns {Array} Array of evidence chain objects, one per finding
     */
    build({ rawConfig, ruleResults, aiResult, resourceType }) {
        const evidenceChains = [];

        for (const finding of (ruleResults.findings || [])) {
            const chain = {
                finding_id: this._generateFindingId(finding),
                rule_id: finding.rule_id,
                title: finding.title,
                severity: finding.severity,
                confidence: finding.confidence,

                evidence_chain: {
                    // Stage 1: Raw data that was collected
                    data_collected: {
                        source_api: finding.evidence?.source || 'Unknown',
                        timestamp: rawConfig.scan_time || new Date().toISOString(),
                        raw_values: finding.evidence || {},
                        resource_id: this._getResourceId(rawConfig, resourceType)
                    },

                    // Stage 2: Rule engine evaluation
                    rule_evaluation: {
                        rule_id: finding.rule_id,
                        rule_title: finding.title,
                        result: finding.passed ? 'PASS' : 'FAIL',
                        description: finding.description,
                        confidence: finding.confidence,
                        method: 'deterministic'
                    },

                    // Stage 3: AI assessment (if available)
                    ai_assessment: this._buildAIAssessment(finding, aiResult),

                    // Stage 4: Business context
                    context: this._buildContext(rawConfig, finding, resourceType)
                },

                // Final verdict
                verdict: this._computeVerdict(finding, aiResult),
                compliance_refs: finding.compliance || [],
                remediation: finding.remediation
            };

            evidenceChains.push(chain);
        }

        return evidenceChains;
    }

    /**
     * Merge rule findings with AI findings, deduplicating and cross-referencing.
     * @param {Array} ruleFindings - Findings from the rule engine
     * @param {Object} aiResult - AI analysis result
     * @returns {Array} Merged findings with cross-validation status
     */
    crossValidate(ruleFindings, aiResult) {
        const aiViolations = aiResult?.violations || [];
        const mergedFindings = [];

        for (const finding of ruleFindings) {
            const aiMentioned = this._aiMentionsFinding(finding, aiViolations, aiResult);

            mergedFindings.push({
                ...finding,
                validation: {
                    rule_engine: true,
                    ai_confirmed: aiMentioned,
                    confidence: aiMentioned ? Math.min(1.0, finding.confidence + 0.05) : finding.confidence,
                    status: aiMentioned ? 'CONFIRMED_BY_BOTH' : 'RULE_ENGINE_ONLY'
                }
            });
        }

        // Check if AI found anything the rule engine missed
        const aiOnlyFindings = this._findAIOnlyFindings(ruleFindings, aiViolations, aiResult);
        for (const aif of aiOnlyFindings) {
            mergedFindings.push({
                rule_id: 'AI-DETECTED',
                title: aif,
                severity: aiResult?.risk_score >= 80 ? 'HIGH' : 'MEDIUM',
                confidence: 0.75,
                passed: false,
                description: aif,
                evidence: { source: 'AI Analysis' },
                validation: {
                    rule_engine: false,
                    ai_confirmed: true,
                    confidence: 0.75,
                    status: 'AI_ONLY'
                },
                remediation: aiResult?.remediation_suggestion || 'Review this finding manually.'
            });
        }

        return mergedFindings;
    }

    // ─── Private Helpers ─────────────────────────────────────────────

    _generateFindingId(finding) {
        const timestamp = Date.now().toString(36);
        return `F-${finding.rule_id}-${timestamp}`;
    }

    _getResourceId(rawConfig, resourceType) {
        switch (resourceType) {
            case 'S3': return rawConfig.bucket;
            case 'EC2': return rawConfig.instance_id;
            case 'IAM': return rawConfig.username;
            default: return 'unknown';
        }
    }

    _buildAIAssessment(finding, aiResult) {
        if (!aiResult) {
            return { available: false, reason: 'AI analysis not performed' };
        }

        const aiViolations = aiResult.violations || [];
        const mentions = this._aiMentionsFinding(finding, aiViolations, aiResult);

        return {
            available: true,
            model: 'amazon.nova-lite-v1:0',
            ai_risk_score: aiResult.risk_score,
            reasoning: aiResult.reasoning || 'N/A',
            agrees_with_rule: mentions,
            ai_confidence: mentions ? 0.9 : 0.6
        };
    }

    _buildContext(rawConfig, finding, resourceType) {
        const context = {
            resource_type: resourceType,
            region: rawConfig.region || 'us-east-1'
        };

        // S3-specific context
        if (resourceType === 'S3') {
            const name = rawConfig.bucket || '';
            context.resource_name = name;
            context.name_suggests_sensitive = /prod|backup|private|secret|confidential|pii|customer|payment/i.test(name);
            context.name_suggests_public = /public|static|cdn|media|assets|website/i.test(name);
            context.estimated_sensitivity = context.name_suggests_sensitive ? 'HIGH' :
                context.name_suggests_public ? 'LOW' : 'MEDIUM';
        }

        // EC2-specific context
        if (resourceType === 'EC2') {
            context.resource_name = rawConfig.instance_id;
            context.has_public_ip = !!rawConfig.public_ip;
            context.instance_type = rawConfig.instance_type;
            const tags = rawConfig.tags || [];
            const envTag = tags.find(t => t.Key === 'Environment' || t.Key === 'env');
            context.environment = envTag?.Value || 'unknown';
            context.estimated_sensitivity = context.environment?.toLowerCase().includes('prod') ? 'HIGH' : 'MEDIUM';
        }

        // IAM-specific context
        if (resourceType === 'IAM') {
            context.resource_name = rawConfig.username;
            context.has_admin = rawConfig.has_admin_access;
            context.total_policies = (rawConfig.attached_policies?.length || 0) + (rawConfig.inline_policies?.length || 0);
            context.estimated_sensitivity = rawConfig.has_admin_access ? 'CRITICAL' : 'MEDIUM';
        }

        return context;
    }

    _computeVerdict(finding, aiResult) {
        if (!aiResult) {
            return {
                status: 'CONFIRMED',
                method: 'rule_engine_only',
                confidence: finding.confidence
            };
        }

        const aiMentions = this._aiMentionsFinding(finding, aiResult.violations || [], aiResult);

        if (aiMentions) {
            return {
                status: 'CONFIRMED',
                method: 'rule_engine_and_ai',
                confidence: Math.min(1.0, finding.confidence + 0.05)
            };
        }

        // Rule says fail, AI doesn't mention it — possible false positive or AI missed it
        return {
            status: 'NEEDS_REVIEW',
            method: 'rule_engine_only (AI did not mention)',
            confidence: Math.max(0.5, finding.confidence - 0.15)
        };
    }

    _aiMentionsFinding(finding, aiViolations, aiResult) {
        const ruleKeywords = this._getRuleKeywords(finding.rule_id);
        const aiText = [
            ...aiViolations,
            aiResult?.reasoning || ''
        ].join(' ').toLowerCase();

        return ruleKeywords.some(kw => aiText.includes(kw));
    }

    _getRuleKeywords(ruleId) {
        const keywordMap = {
            'S3-001': ['public access block', 'blockpublicacls', 'publicaccessblock'],
            'S3-002': ['acl', 'allusers', 'public acl'],
            'S3-003': ['authenticatedusers', 'authenticated users'],
            'S3-004': ['wildcard', 'principal', 'principal: *', '"*"'],
            'S3-005': ['https', 'securetransport', 'http'],
            'S3-006': ['encrypt', 'sse', 'server-side'],
            'S3-007': ['kms', 'sse-s3', 'aes256'],
            'S3-008': ['versioning'],
            'S3-009': ['logging', 'access log'],
            'S3-010': ['lifecycle'],
            'S3-011': ['cors', 'origin'],
            'S3-012': ['cross-account', 'condition'],
            'S3-013': ['partial', 'inconsistent'],
            'EC2-001': ['public ip', 'public address'],
            'EC2-002': ['ssh', 'port 22'],
            'EC2-003': ['rdp', 'port 3389'],
            'EC2-004': ['all traffic', 'all inbound', 'all ports'],
            'EC2-005': ['database', 'mysql', 'postgres', 'redis', 'mongo'],
            'EC2-006': ['imds', 'metadata', 'imdsv2'],
            'EC2-007': ['ebs', 'volume', 'encrypt'],
            'EC2-008': ['iam profile', 'instance profile'],
            'EC2-009': ['monitoring', 'cloudwatch'],
            'EC2-010': ['default vpc'],
            'EC2-011': ['egress', 'outbound'],
            'EC2-012': ['port range', 'broad'],
            'IAM-001': ['admin', 'administratoraccess'],
            'IAM-002': ['inactive', 'dormant', '90 days'],
            'IAM-003': ['mfa', 'multi-factor'],
            'IAM-004': ['rotate', 'key age', 'old key'],
            'IAM-005': ['multiple key', 'two key'],
            'IAM-006': ['inline', 'policy'],
            'IAM-007': ['never used', 'never active', 'orphan'],
            'IAM-008': ['stale', 'unused key'],
            'IAM-009': ['fullaccess', 'poweruser', 'permissive'],
        };

        return keywordMap[ruleId] || [];
    }

    _findAIOnlyFindings(ruleFindings, aiViolations, aiResult) {
        if (!aiViolations || aiViolations.length === 0) return [];

        const ruleTexts = ruleFindings.map(f =>
            `${f.title} ${f.description}`.toLowerCase()
        );

        return aiViolations.filter(violation => {
            if (!violation || violation === 'None') return false;
            const vLower = violation.toLowerCase();
            // Check if any rule finding already covers this AI violation
            return !ruleTexts.some(rt => {
                const keywords = vLower.split(/\s+/).filter(w => w.length > 4);
                const matchCount = keywords.filter(kw => rt.includes(kw)).length;
                return matchCount >= 2;
            });
        });
    }
}

module.exports = new EvidenceChainBuilder();
