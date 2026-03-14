/**
 * Assisted Fix Generator Agent
 * 
 * Generates AWS CLI scripts, Terraform blocks, and verification steps
 * dynamically based on finding IDs for ASSISTED_FIX items.
 */

class AssistedFixGenerator {

    /**
     * Generate assisted fix metadata for the provided rule IDs.
     */
    generateForFinding(ruleId, resourceName, region = 'us-east-1') {
        const templates = {
            'S3-007': { // Encryption uses SSE-S3 instead of SSE-KMS
                explanation: 'SSE-KMS provides better audit trails and key rotation capabilities compared to SSE-S3. Configuring it requires a dedicated KMS Key.',
                cli: `# 1. Create a KMS Key\naws kms create-key --description "S3 Encryption Key for ${resourceName}" --region ${region}\n\n# 2. Attach the key to your bucket (replace KEY_ARN)\naws s3api put-bucket-encryption \\\n  --bucket ${resourceName} \\\n  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"KEY_ARN"}}]}'`,
                terraform: `resource "aws_kms_key" "mykey" {\n  description             = "This key is used to encrypt bucket objects"\n  deletion_window_in_days = 10\n}\n\nresource "aws_s3_bucket_server_side_encryption_configuration" "example" {\n  bucket = "${resourceName}"\n\n  rule {\n    apply_server_side_encryption_by_default {\n      kms_master_key_id = aws_kms_key.mykey.arn\n      sse_algorithm     = "aws:kms"\n    }\n  }\n}`,
                verification: '1. Go to Amazon S3 Console\n2. Click Bucket Properties\n3. Verify "Default encryption" is set to "AWS Key Management Service key (SSE-KMS)"'
            },
            'EC2-007': { // EBS Volumes Not Encrypted
                explanation: 'Existing EBS volumes cannot be encrypted in-place. You must snapshot the volume, create a new encrypted volume from the snapshot, and swap them.',
                cli: `# Run these commands for each unencrypted volume\n\n# 1. Create a snapshot\naws ec2 create-snapshot --volume-id <vol-id> --description "Pre-encryption backup"\n\n# 2. Copy the snapshot to an encrypted snapshot\naws ec2 copy-snapshot --source-region ${region} --source-snapshot-id <snap-id> --encrypted --description "Encrypted copy"\n\n# 3. Create a new encrypted volume from the new snapshot\naws ec2 create-volume --snapshot-id <encrypted-snap-id> --availability-zone <az> --encrypted\n\n# 4. Detach old volume, attach new volume\naws ec2 detach-volume --volume-id <old-vol-id>\naws ec2 attach-volume --volume-id <new-vol-id> --instance-id ${resourceName} --device /dev/sdf`,
                terraform: `# Terraform forces replacement of unencrypted root block devices.\n# Ensure your launch templates or aws_instance block define encryption.\n\nroot_block_device {\n  encrypted = true\n  # kms_key_id = aws_kms_key.example.arn (optional)\n}`,
                verification: '1. Go to EC2 Console -> Volumes\n2. Check the "Encrypted" column for the attached volume - it should read "Yes".'
            },
            'IAM-003': { // MFA Not Enabled
                explanation: 'MFA enforcement on console access requires user coordination to scan the QR code and register their device.',
                cli: `# 1. Create a virtual MFA device\naws iam create-virtual-mfa-device --virtual-mfa-device-name ${resourceName}-MFA --outfile QRCode.png --bootstrap-method QRCodePNG\n\n# 2. Tell the user to scan the QRCode.png\n\n# 3. Enable the MFA device\naws iam enable-mfa-device --user-name ${resourceName} --serial-number <mfa-serial-arn> --authentication-code1 <code1> --authentication-code2 <code2>`,
                terraform: `# Generally terraform does not manage virtual MFA devices for users directly, \n# but you should enforce MFA via IAM policies:\n\ndata "aws_iam_policy_document" "require_mfa" {\n  statement {\n    effect    = "Deny"\n    not_actions = ["iam:*MFA*", "sts:GetSessionToken"]\n    resources = ["*"]\n\n    condition {\n      test     = "BoolIfExists"\n      variable = "aws:MultiFactorAuthPresent"\n      values   = ["false"]\n    }\n  }\n}`,
                verification: '1. Go to IAM Console -> Users -> Security credentials\n2. Check the "Assigned MFA device" section.'
            },
            'IAM-004': { // Access Key Not Rotated
                explanation: 'Rotating keys without breaking applications requires creating a secondary key, shifting traffic, and then eliminating the old key.',
                cli: `# 1. Create the new key\naws iam create-access-key --user-name ${resourceName}\n\n# ... Update your application to use the NEW key ...\n\n# 2. Deactivate the old key\naws iam update-access-key --access-key-id <OLD_KEY_ID> --status Inactive --user-name ${resourceName}\n\n# 3. Delete the old key completely after verified no outages\naws iam delete-access-key --access-key-id <OLD_KEY_ID> --user-name ${resourceName}`,
                terraform: `resource "aws_iam_access_key" "key" {\n  user = aws_iam_user.example.name\n  # Manage rotation by creating multiple resources and shifting\n}`,
                verification: '1. Go to IAM Console -> Users -> Security credentials\n2. Confirm only the newer Access Key is "Active".'
            },
            'COST-IDLE': {
                explanation: 'Stopping instances will immediately save compute costs, but attached EBS volumes still incur small charges. Verify no background cron jobs are executing before stopping.',
                cli: `# Stop the idle instance gracefully\naws ec2 stop-instances --instance-ids ${resourceName} --region ${region}`,
                terraform: `# If migrating to a stopped state via Terraform without destroying the instance:\nresource "aws_instance" "idle_server" {\n  # ... existing config ...\n}\n\nresource "aws_ec2_instance_state" "stopped_state" {\n  instance_id = aws_instance.idle_server.id\n  state       = "stopped"\n}`,
                verification: '1. Go to EC2 Console -> Instances\n2. Verify Instance State says "Stopped".'
            }
        };

        return templates[ruleId] || {
            explanation: 'This action requires careful human validation and cannot be executed autonomously.',
            cli: '# Guided automated scripts are not available for this exact issue right now.\n# Please use the AWS Console to manually resolve it.',
            terraform: '',
            verification: 'Review configuration inside the AWS Console.'
        };
    }
}

module.exports = new AssistedFixGenerator();
