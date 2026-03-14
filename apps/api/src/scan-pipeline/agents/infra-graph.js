/**
 * Infrastructure Graph Builder
 * 
 * In-memory directed graph representing AWS resources and their relationships.
 * Powers attack path analysis, blast radius calculations, and dependency mapping.
 * 
 * Nodes = AWS resources (S3 buckets, EC2 instances, IAM users/roles, security groups)
 * Edges = Relationships (EC2→SG, EC2→IAM Role, IAM User→Policy, S3→Policy)
 */

class InfraGraph {

    constructor() {
        this.nodes = new Map();  // id → { id, type, label, metadata }
        this.edges = [];         // [{ from, to, relationship, metadata }]
        this.adjacency = new Map();  // id → [{ target, relationship, metadata }]
    }

    /**
     * Reset the graph for a new scan cycle.
     */
    clear() {
        this.nodes.clear();
        this.edges = [];
        this.adjacency.clear();
    }

    /**
     * Add a node to the graph.
     * @param {string} id - Unique identifier (e.g., bucket name, instance ID, username)
     * @param {string} type - Resource type: 'S3', 'EC2', 'IAM_USER', 'IAM_ROLE', 'SG', 'VPC', 'INTERNET'
     * @param {Object} metadata - Additional data (findings, risk_score, etc.)
     */
    addNode(id, type, metadata = {}) {
        this.nodes.set(id, { id, type, label: metadata.label || id, ...metadata });
        if (!this.adjacency.has(id)) {
            this.adjacency.set(id, []);
        }
    }

    /**
     * Add a directed edge between two nodes.
     * @param {string} from - Source node ID
     * @param {string} to - Target node ID
     * @param {string} relationship - Edge type (e.g., 'has_security_group', 'assumes_role', 'can_access')
     * @param {Object} metadata - Additional context for this relationship
     */
    addEdge(from, to, relationship, metadata = {}) {
        // Ensure both nodes exist
        if (!this.nodes.has(from)) this.addNode(from, 'UNKNOWN');
        if (!this.nodes.has(to)) this.addNode(to, 'UNKNOWN');

        this.edges.push({ from, to, relationship, ...metadata });
        this.adjacency.get(from).push({ target: to, relationship, ...metadata });
    }

    /**
     * Find all paths between two nodes using BFS.
     * @param {string} from - Source node ID
     * @param {string} to - Target node ID
     * @param {number} maxDepth - Maximum path length (default: 5)
     * @returns {Array} Array of paths, each path is an array of { node, relationship }
     */
    findPaths(from, to, maxDepth = 5) {
        const paths = [];
        const queue = [[{ node: from, relationship: null }]];

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1].node;

            if (path.length > maxDepth + 1) continue;

            if (current === to && path.length > 1) {
                paths.push(path);
                continue;
            }

            const neighbors = this.adjacency.get(current) || [];
            for (const neighbor of neighbors) {
                // Avoid cycles
                if (path.some(p => p.node === neighbor.target)) continue;

                queue.push([...path, {
                    node: neighbor.target,
                    relationship: neighbor.relationship
                }]);
            }
        }

        return paths;
    }

    /**
     * Calculate blast radius — all nodes reachable from a compromised node.
     * @param {string} nodeId - The compromised node
     * @param {number} maxDepth - Maximum traversal depth
     * @returns {{ reachable: Array, count: number, summary: Object }}
     */
    getBlastRadius(nodeId, maxDepth = 4) {
        const visited = new Set();
        const reachable = [];
        const queue = [{ node: nodeId, depth: 0 }];

        while (queue.length > 0) {
            const { node, depth } = queue.shift();
            if (visited.has(node) || depth > maxDepth) continue;
            visited.add(node);

            if (node !== nodeId) {
                const nodeData = this.nodes.get(node);
                reachable.push({
                    id: node,
                    type: nodeData?.type || 'UNKNOWN',
                    depth,
                    label: nodeData?.label || node
                });
            }

            const neighbors = this.adjacency.get(node) || [];
            for (const n of neighbors) {
                if (!visited.has(n.target)) {
                    queue.push({ node: n.target, depth: depth + 1 });
                }
            }
        }

        // Summarize by type
        const summary = {};
        for (const r of reachable) {
            summary[r.type] = (summary[r.type] || 0) + 1;
        }

        return { reachable, count: reachable.length, summary };
    }

    /**
     * Find nodes with no incoming or outgoing connections (orphaned resources).
     * @returns {Array} Orphaned nodes
     */
    findOrphanedResources() {
        const connected = new Set();
        for (const edge of this.edges) {
            connected.add(edge.from);
            connected.add(edge.to);
        }

        const orphaned = [];
        for (const [id, node] of this.nodes) {
            if (!connected.has(id) && node.type !== 'INTERNET') {
                orphaned.push(node);
            }
        }
        return orphaned;
    }

    /**
     * Build the graph from scan results.
     * @param {Object} params
     * @param {Array} params.s3Scans - S3 scan results
     * @param {Array} params.ec2Scans - EC2 scan results
     * @param {Array} params.iamScans - IAM scan results
     */
    buildFromScanResults({ s3Scans = [], ec2Scans = [], iamScans = [] }) {
        this.clear();

        // Add the Internet node (source of external attacks)
        this.addNode('INTERNET', 'INTERNET', { label: 'Internet (External)' });

        // Process S3 buckets
        for (const scan of s3Scans) {
            const rawConfig = this._parseRawConfig(scan.raw_config);
            const bucketId = rawConfig.bucket || scan.bucket;
            if (!bucketId) continue;

            this.addNode(bucketId, 'S3', {
                label: bucketId,
                risk_score: scan.risk_score,
                severity: scan.severity,
                findings_count: (scan.findings || []).length
            });

            // If bucket is publicly accessible, connect from Internet
            if (scan.status === 'AT_RISK') {
                const isPublic = (scan.findings || []).some(f =>
                    typeof f === 'string'
                        ? (f.toLowerCase().includes('public') || f.toLowerCase().includes('alluser'))
                        : (f.rule_id === 'S3-002' || f.rule_id === 'S3-004')
                );
                if (isPublic) {
                    this.addEdge('INTERNET', bucketId, 'public_access', {
                        vulnerability: 'Public bucket access'
                    });
                }
            }
        }

        // Process EC2 instances
        for (const scan of ec2Scans) {
            const rawConfig = this._parseRawConfig(scan.raw_config);
            const instanceId = rawConfig.instance_id || scan.instance_id;
            if (!instanceId) continue;

            this.addNode(instanceId, 'EC2', {
                label: instanceId,
                risk_score: scan.risk_score,
                severity: scan.severity,
                public_ip: rawConfig.public_ip,
                findings_count: (scan.findings || []).length
            });

            // Security Groups
            for (const sg of (rawConfig.security_groups || [])) {
                const sgId = sg.group_id;
                this.addNode(sgId, 'SG', { label: `SG: ${sg.group_name || sgId}` });
                this.addEdge(instanceId, sgId, 'has_security_group');

                // Check if SG allows internet access
                for (const rule of (sg.inbound_rules || [])) {
                    const hasOpenCidr = (rule.ip_ranges || []).includes('0.0.0.0/0');
                    if (hasOpenCidr) {
                        this.addEdge('INTERNET', instanceId, 'network_access', {
                            via_sg: sgId,
                            port: rule.protocol === '-1' ? 'ALL' : `${rule.from_port}-${rule.to_port}`,
                            vulnerability: `Open port via ${sgId}`
                        });
                    }
                }
            }

            // IAM Instance Profile → creates edge from EC2 to any S3 buckets the role can access
            if (rawConfig.iam_profile) {
                const roleId = rawConfig.iam_profile.arn;
                this.addNode(roleId, 'IAM_ROLE', {
                    label: `Role: ${roleId.split('/').pop()}`
                });
                this.addEdge(instanceId, roleId, 'assumes_role');

                // Assume the role can access S3 buckets (simplified — real check needs role policy parsing)
                for (const [nodeId, node] of this.nodes) {
                    if (node.type === 'S3') {
                        this.addEdge(roleId, nodeId, 'can_access', {
                            access_type: 'assumed (needs policy validation)'
                        });
                    }
                }
            }
        }

        // Process IAM users
        for (const scan of iamScans) {
            const rawConfig = this._parseRawConfig(scan.raw_config);
            const username = rawConfig.username || scan.username;
            if (!username) continue;

            this.addNode(username, 'IAM_USER', {
                label: `User: ${username}`,
                risk_score: scan.risk_score,
                severity: scan.severity,
                has_admin: rawConfig.has_admin_access
            });

            // Policies
            for (const policy of (rawConfig.attached_policies || [])) {
                const policyId = policy.policy_arn || policy.policy_name;
                this.addNode(policyId, 'IAM_POLICY', {
                    label: `Policy: ${policy.policy_name}`
                });
                this.addEdge(username, policyId, 'has_policy');

                // If admin, connect to all resources
                if (policy.policy_name === 'AdministratorAccess') {
                    for (const [nodeId, node] of this.nodes) {
                        if (['S3', 'EC2'].includes(node.type)) {
                            this.addEdge(username, nodeId, 'admin_access', {
                                via_policy: policy.policy_name
                            });
                        }
                    }
                }
            }
        }

        console.log(`[InfraGraph] Built graph: ${this.nodes.size} nodes, ${this.edges.length} edges`);
    }

    /**
     * Serialize graph to JSON-friendly structure for API responses.
     */
    toJSON() {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges,
            stats: {
                total_nodes: this.nodes.size,
                total_edges: this.edges.length,
                node_types: this._countByType()
            }
        };
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    _parseRawConfig(rawConfig) {
        if (!rawConfig) return {};
        if (typeof rawConfig === 'string') {
            try { return JSON.parse(rawConfig); } catch { return {}; }
        }
        return rawConfig;
    }

    _countByType() {
        const counts = {};
        for (const [, node] of this.nodes) {
            counts[node.type] = (counts[node.type] || 0) + 1;
        }
        return counts;
    }
}

module.exports = new InfraGraph();
