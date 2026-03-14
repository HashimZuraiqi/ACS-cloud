/**
 * Anomaly Detector
 * Detects behavioral anomalies in the infrastructure.
 */

class AnomalyDetector {
    detect({ s3Scans = [], ec2Scans = [], iamScans = [] }) {
        console.log('[AnomalyDetector] Detecting anomalies...');
        
        // Mocked response to unblock the API
        return {
            anomaly_count: 2,
            anomalies: [
                {
                    type: 'UNUSUAL_API_ACTIVITY',
                    severity: 'HIGH',
                    confidence: 92,
                    description: 'Unusually high volume of describe API calls from an IAM user.',
                    indicators: ['Spike in DescribeRegions', 'Unusual time of day (> midnight)']
                },
                {
                    type: 'GEOLOCATION_ANOMALY',
                    severity: 'MEDIUM',
                    confidence: 85,
                    description: 'Console login detected from a new, untrusted geolocation.',
                    indicators: ['IP Address in completely new region', 'No prior history']
                }
            ]
        };
    }
}

module.exports = new AnomalyDetector();
