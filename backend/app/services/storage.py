"""S3 storage service for persistent document storage using Bucketeer."""

import os
import logging
from typing import Optional
from io import BytesIO

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class StorageService:
    """S3-compatible storage service using Bucketeer Heroku add-on."""

    def __init__(self):
        """Initialize the S3 client from Bucketeer environment variables."""
        self.aws_access_key_id = os.environ.get('BUCKETEER_AWS_ACCESS_KEY_ID')
        self.aws_secret_access_key = os.environ.get('BUCKETEER_AWS_SECRET_ACCESS_KEY')
        self.bucket_name = os.environ.get('BUCKETEER_BUCKET_NAME')
        self.region = os.environ.get('BUCKETEER_AWS_REGION', 'us-east-1')
        
        self._client = None
        self._enabled = bool(self.aws_access_key_id and self.bucket_name)
        
        if self._enabled:
            logger.info(f"S3 storage enabled with bucket: {self.bucket_name}")
        else:
            logger.warning("S3 storage not configured - falling back to local storage")

    @property
    def client(self):
        """Lazy initialization of S3 client."""
        if self._client is None and self._enabled:
            self._client = boto3.client(
                's3',
                aws_access_key_id=self.aws_access_key_id,
                aws_secret_access_key=self.aws_secret_access_key,
                region_name=self.region,
            )
        return self._client

    @property
    def is_enabled(self) -> bool:
        """Check if S3 storage is configured and enabled."""
        return self._enabled

    def _get_document_key(self, document_id: int, filename: str) -> str:
        """Generate S3 key for a document."""
        # Clean filename for S3 key
        safe_filename = filename.replace(' ', '_')
        return f"documents/{document_id}/{safe_filename}"

    async def upload_document(
        self,
        document_id: int,
        filename: str,
        file_content: bytes,
    ) -> Optional[str]:
        """
        Upload a document to S3.
        
        Args:
            document_id: The document's database ID
            filename: Original filename
            file_content: PDF file content as bytes
            
        Returns:
            S3 key if successful, None if S3 is not enabled
        """
        if not self._enabled:
            logger.warning("S3 not enabled, skipping upload")
            return None
        
        key = self._get_document_key(document_id, filename)
        
        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file_content,
                ContentType='application/pdf',
            )
            logger.info(f"Uploaded document {document_id} to S3: {key}")
            return key
        except ClientError as e:
            logger.error(f"Failed to upload document {document_id} to S3: {e}")
            raise

    async def download_document(self, s3_key: str) -> Optional[bytes]:
        """
        Download a document from S3.
        
        Args:
            s3_key: The S3 key for the document
            
        Returns:
            PDF content as bytes, or None if not found
        """
        if not self._enabled:
            return None
        
        try:
            response = self.client.get_object(
                Bucket=self.bucket_name,
                Key=s3_key,
            )
            content = response['Body'].read()
            logger.info(f"Downloaded document from S3: {s3_key}")
            return content
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                logger.warning(f"Document not found in S3: {s3_key}")
                return None
            logger.error(f"Failed to download from S3: {e}")
            raise

    async def delete_document(self, s3_key: str) -> bool:
        """
        Delete a document from S3.
        
        Args:
            s3_key: The S3 key for the document
            
        Returns:
            True if deleted successfully
        """
        if not self._enabled:
            return False
        
        try:
            self.client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key,
            )
            logger.info(f"Deleted document from S3: {s3_key}")
            return True
        except ClientError as e:
            logger.error(f"Failed to delete from S3: {e}")
            return False

    async def get_presigned_url(
        self,
        s3_key: str,
        expiration: int = 3600,
    ) -> Optional[str]:
        """
        Generate a presigned URL for temporary access to a document.
        
        Args:
            s3_key: The S3 key for the document
            expiration: URL expiration time in seconds (default 1 hour)
            
        Returns:
            Presigned URL string, or None if S3 is not enabled
        """
        if not self._enabled:
            return None
        
        try:
            url = self.client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                },
                ExpiresIn=expiration,
            )
            return url
        except ClientError as e:
            logger.error(f"Failed to generate presigned URL: {e}")
            return None

    async def document_exists(self, s3_key: str) -> bool:
        """Check if a document exists in S3."""
        if not self._enabled:
            return False
        
        try:
            self.client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key,
            )
            return True
        except ClientError:
            return False


# Singleton instance
storage_service = StorageService()
