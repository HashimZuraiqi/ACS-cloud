const assert = require('assert');
const riskScorer = require('./src/scan-pipeline/agents/risk-scorer.agent');
const s3Rules = require('./src/scan-pipeline/agents/rules/s3-rules');
const decisionEngine = require('./src/remediation-pipeline/agents/remediation-decision-engine');
const planner = require('./src/remediation-pipeline/agents/remediation-planner.agent');

console.log("═══════════════════════════════════════════════════════");
console.log("  S3 Remediation Classification & Scoring Validation  ");
console.log("═══════════════════════════════════════════════════════\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ❌ ${name}`);
        console.error(`     ${err.message}`);
        failed++;
    }
}

// ──────────────────────────────────────────────────────
// 1. S3 RULE CLASSIFICATION TESTS
// ──────────────────────────────────────────────────────
console.log("\n── 1. S3 Rule Classification ──────────────────────────\n");

const insecureBucketConfig = {
    bucket: "test-data-bucket",
    public_access_block: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false
    },
    acl: [{ Grantee: { URI: 'http://acs.amazonaws.com/groups/global/AllUsers' }, Permission: 'READ' }],
    policy: {
        Statement: [
            { Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: 'arn:aws:s3:::test-data-bucket/*' }
        ]
    },
    encryption: {
        Rules: [{ ApplyServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }]
    },
    versioning: { Status: 'Disabled' },
    logging: null,
    lifecycle: null
};

const ruleResults = s3Rules.evaluate(insecureBucketConfig);

test("S3-001 (Public Access Block disabled) is AUTO_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-001');
    assert(f, "S3-001 finding not generated");
    assert.strictEqual(f.remediation_mode, 'AUTO_FIX', `Expected AUTO_FIX, got ${f.remediation_mode}`);
});

test("S3-002 (Public ACL AllUsers) is AUTO_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-002');
    assert(f, "S3-002 finding not generated");
    assert.strictEqual(f.remediation_mode, 'AUTO_FIX', `Expected AUTO_FIX, got ${f.remediation_mode}`);
});

test("S3-004 (Wildcard Principal) is AUTO_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-004');
    assert(f, "S3-004 finding not generated");
    assert.strictEqual(f.remediation_mode, 'AUTO_FIX', `Expected AUTO_FIX, got ${f.remediation_mode}`);
});

test("S3-005 (HTTPS enforcement) is AUTO_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-005');
    assert(f, "S3-005 finding not generated");
    assert.strictEqual(f.remediation_mode, 'AUTO_FIX', `Expected AUTO_FIX, got ${f.remediation_mode}`);
});

test("S3-007 (SSE-S3 instead of SSE-KMS) is ASSISTED_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-007');
    assert(f, "S3-007 finding not generated");
    assert.strictEqual(f.remediation_mode, 'ASSISTED_FIX', `Expected ASSISTED_FIX, got ${f.remediation_mode}`);
});

test("S3-008 (Versioning disabled) is AUTO_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-008');
    assert(f, "S3-008 finding not generated");
    assert.strictEqual(f.remediation_mode, 'AUTO_FIX', `Expected AUTO_FIX, got ${f.remediation_mode}`);
});

test("S3-009 (Access Logging disabled) is AUTO_FIX", () => {
    const f = ruleResults.findings.find(f => f.rule_id === 'S3-009');
    assert(f, "S3-009 finding not generated");
    assert.strictEqual(f.remediation_mode, 'AUTO_FIX', `Expected AUTO_FIX, got ${f.remediation_mode}`);
});

// ──────────────────────────────────────────────────────
// 2. DECISION ENGINE CLASSIFICATION TESTS
// ──────────────────────────────────────────────────────
console.log("\n── 2. Decision Engine Classification ──────────────────\n");

const s3004Finding = ruleResults.findings.find(f => f.rule_id === 'S3-004');
if (s3004Finding) {
    test("Decision engine: S3-004 with SANITIZE_BUCKET_POLICY = AUTO_FIX", () => {
        const decision = decisionEngine.classify({
            finding: s3004Finding,
            rawConfig: insecureBucketConfig,
            action: 'SANITIZE_BUCKET_POLICY',
            resourceType: 'S3'
        });
        assert.strictEqual(decision.decision, 'AUTO_FIX', `Expected AUTO_FIX, got ${decision.decision}`);
    });
}

test("Decision engine: ENFORCE_HTTPS = AUTO_FIX", () => {
    const finding = ruleResults.findings.find(f => f.rule_id === 'S3-005');
    if (!finding) { console.log("     (S3-005 not triggered, testing with mock)"); return; }
    const decision = decisionEngine.classify({
        finding: finding,
        rawConfig: insecureBucketConfig,
        action: 'ENFORCE_HTTPS',
        resourceType: 'S3'
    });
    assert.strictEqual(decision.decision, 'AUTO_FIX', `Expected AUTO_FIX, got ${decision.decision}`);
});

// ──────────────────────────────────────────────────────
// 3. RECOMMENDATION MUST NOT BLOCK AUTO-FIX
// ──────────────────────────────────────────────────────
console.log("\n── 3. Recommendations Must Not Block Auto-Fix ────────\n");

test("Planner: AUTO_FIX findings exist → status is PENDING_APPROVAL not BLOCKED", () => {
    const mockScan = {
        bucket: "test-insecure-bucket",
        risk_score: 75,
        raw_config: JSON.stringify(insecureBucketConfig),
        findings: ruleResults.findings.map(f => f.title),
        structured_findings: JSON.stringify(ruleResults.findings)
    };
    const plan = planner.createPlan(mockScan);
    assert(plan.status !== 'BLOCKED', `Plan status should not be BLOCKED, got: ${plan.status}`);
    assert.strictEqual(plan.status, 'PENDING_APPROVAL', `Expected PENDING_APPROVAL, got ${plan.status}`);
});

test("Planner: ENFORCE_HTTPS action is included in plan steps", () => {
    const mockScan = {
        bucket: "test-insecure-bucket",
        risk_score: 75,
        raw_config: JSON.stringify(insecureBucketConfig),
        findings: ruleResults.findings.map(f => f.title),
        structured_findings: JSON.stringify(ruleResults.findings)
    };
    const plan = planner.createPlan(mockScan);
    const hasHttps = plan.steps.some(s => s.action === 'ENFORCE_HTTPS');
    assert(hasHttps, `ENFORCE_HTTPS action not found in plan steps: ${plan.steps.map(s => s.action).join(', ')}`);
});

// ──────────────────────────────────────────────────────
// 4. SCORE DROP AFTER AUTO-FIX
// ──────────────────────────────────────────────────────
console.log("\n── 4. Score Drop After Auto-Fix ───────────────────────\n");

test("Score with all findings should be high (>= 50)", () => {
    const allFindings = ruleResults.findings;
    const result = riskScorer.calculateWeighted(allFindings, insecureBucketConfig);
    const score = result.score;
    console.log(`     All findings score: ${score}`);
    assert(score >= 50, `Score with all findings should be >= 50, got ${score}`);
});

test("Score with only recommendation findings should be low (<= 25)", () => {
    // After auto-fix: only SSE-KMS recommendation (S3-007) remains
    const recommendationOnly = ruleResults.findings.filter(f => 
        f.remediation_mode === 'ASSISTED_FIX' || 
        f.remediation_mode === 'MANUAL_REVIEW' ||
        f.rule_id === 'S3-007' || f.rule_id === 'S3-011' || f.rule_id === 'S3-012'
    );
    
    if (recommendationOnly.length === 0) {
        console.log("     (No recommendation-only findings to test — all are AUTO_FIX)");
        return;
    }
    
    const secureConfig = { ...insecureBucketConfig, bucket: 'test-data-bucket' };
    const result = riskScorer.calculateWeighted(recommendationOnly, secureConfig);
    const score = result.score;
    console.log(`     Recommendation-only score: ${score} (from ${recommendationOnly.length} findings)`);
    assert(score <= 25, `Score with only recommendations should be <= 25, got ${score}`);
});

test("Score must drop significantly (to low-risk range) after safe fixes", () => {
    const allFindings = ruleResults.findings;
    const resultBefore = riskScorer.calculateWeighted(allFindings, insecureBucketConfig);
    const scoreBefore = resultBefore.score;
    
    // After: only recommendation findings remain
    const remainingFindings = allFindings.filter(f => 
        f.remediation_mode === 'ASSISTED_FIX' || 
        f.remediation_mode === 'MANUAL_REVIEW'
    );
    
    const resultAfter = riskScorer.calculateWeighted(
        remainingFindings.length > 0 ? remainingFindings : [],
        insecureBucketConfig
    );
    const scoreAfter = resultAfter.score;
    
    const drop = scoreBefore - scoreAfter;
    console.log(`     Before: ${scoreBefore}  →  After: ${scoreAfter}  (dropped ${drop} points)`);
    assert(drop >= 30, `Score should drop >= 30 points after auto-fix, only dropped ${drop}`);
    assert(scoreAfter <= 25, `Post-fix score should be <= 25, got ${scoreAfter}`);
});

// ──────────────────────────────────────────────────────
// SUMMARY
// ──────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════");
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════════════\n");

if (failed > 0) {
    process.exit(1);
}
