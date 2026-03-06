import axios from 'axios';

const API_URL = 'http://localhost:4000/api';

const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const api = {
    // Auth
    login: async (email, password) => {
        const response = await client.post('/auth/login', { email, password });
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            client.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        }
        return response.data;
    },

    signup: async (data) => {
        const response = await client.post('/auth/signup', data);
        if (response.data.token) {
            localStorage.setItem('token', response.data.token);
            client.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        }
        return response.data;
    },

    getMe: async () => {
        const token = localStorage.getItem('token');
        if (!token) throw new Error("No token");
        client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const response = await client.get('/auth/me');
        return response.data;
    },

    updateAwsCredentials: async (credentials) => {
        const response = await client.put('/auth/aws-credentials', credentials);
        return response.data;
    },

    logout: () => {
        localStorage.removeItem('token');
        delete client.defaults.headers.common['Authorization'];
    },

    // Scan Pipeline
    triggerScan: async (bucketName) => {
        const response = await client.post('/scan', { bucketName });
        return response.data;
    },

    getScans: async () => {
        const response = await client.get('/scan');
        return response.data;
    },

    getScanResult: async (scanId) => {
        // In a real app this might be a specific endpoint, 
        // but for now we might filter from getScans or assumes the scan return includes it.
        // However, our backend POST /scan returns the result immediately.
        // If we need to fetch history, we use getScans.
        // For this MVP, let's assume we pass the result around or fetch by ID if implemented.
        // Adding a placeholder for future use:
        const response = await client.get(`/scan/${scanId}`);
        return response.data;
    },

    // Remediation Pipeline
    generatePlan: async (scanResult) => {
        const response = await client.post('/remediate/plan', { scanResult });
        return response.data;
    },

    approveFix: async (scanId) => {
        const response = await client.post('/remediate/approve', { scanId });
        return response.data;
    },

    // EC2 Scan Pipeline
    triggerEC2Scan: async (instanceId) => {
        const response = await client.post('/ec2-scan', instanceId ? { instanceId } : {});
        return response.data;
    },

    getEC2Scans: async () => {
        const response = await client.get('/ec2-scan');
        return response.data;
    },

    getEC2ScanResult: async (scanId) => {
        const response = await client.get(`/ec2-scan/${scanId}`);
        return response.data;
    },

    approveEC2Fix: async (scanId) => {
        const response = await client.post('/remediate/approve-ec2', { scanId });
        return response.data;
    },

    // IAM Scan Pipeline
    triggerIAMScan: async (username) => {
        const response = await client.post('/iam-scan', username ? { username } : {});
        return response.data;
    },

    getIAMScans: async () => {
        const response = await client.get('/iam-scan');
        return response.data;
    },

    getIAMScanResult: async (scanId) => {
        const response = await client.get(`/iam-scan/${scanId}`);
        return response.data;
    }
};
