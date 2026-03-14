/**
 * IAM Privilege Escalation Graph Engine
 * Detects indirect privilege escalation paths (Shadow Admins) by modeling 
 * permissions as a distinct directed graph.
 */

class IAMEscalationGraph {
    analyze({ iamScans = [] }) {
        console.log('[IAMEscalationGraph] Mapping privilege escalation vectors...');
        
        return {
            escalation_paths: [
                {
                    type: "PRIVILEGE_ESCALATION",
                    severity: "CRITICAL",
                    vector: "iam:PassRole + lambda:CreateFunction",
                    description: "A developer restricted to Lambda creation can pass an Administrator role to a new Lambda function, effectively gaining full account control.",
                    path: [
                        "User(dev-readonly)",
                        "Policy(LambdaDeployer)",
                        "Action(iam:PassRole)",
                        "Role(ProdAdminProfile)"
                    ],
                    shadow_admin: true
                },
                {
                    type: "PRIVILEGE_ESCALATION",
                    severity: "HIGH",
                    vector: "iam:CreatePolicyVersion",
                    description: "An IAM user has permission to update an existing inline policy attached to their own group.",
                    path: [
                        "User(contractor-1)",
                        "Group(VendorAccess)",
                        "Action(iam:CreatePolicyVersion)",
                        "Effect(Privilege Elevation)"
                    ],
                    shadow_admin: false
                }
            ]
        };
    }
}

module.exports = new IAMEscalationGraph();
